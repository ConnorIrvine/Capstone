import { useState, useCallback, useRef } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  BleManager,
  Device,
  BleError,
  Characteristic,
  State,
  Subscription,
} from 'react-native-ble-plx';

// ─── Arduino BLE constants ────────────────────────────────────────────────────
export const DEVICE_NAME = 'NanoESP32_PPG';
const SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const TX_CHAR_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

// Maximum number of PPG samples kept in state (5 s at 100 Hz)
const CHART_WINDOW = 500;

// Chart refresh rate (ms) – batches incoming 100 Hz data down to ~30 fps
const CHART_INTERVAL_MS = 33;

// ─── Public types ─────────────────────────────────────────────────────────────
export interface ScannedDevice {
  id: string;
  name: string | null;
  rssi: number | null;
}

// Single manager instance shared across the app lifetime
const bleManager = new BleManager();

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useBLE() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [ppgData, setPPGData] = useState<number[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Refs – hold mutable values that must not trigger re-renders
  const connectedDeviceRef = useRef<Device | null>(null);
  const dataBufferRef = useRef<number[]>([]);           // raw incoming data before chart flush
  const chartIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifSubscriptionRef = useRef<Subscription | null>(null);
  const disconnectSubscriptionRef = useRef<Subscription | null>(null);

  // ── Permissions ─────────────────────────────────────────────────────────────
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    const apiLevel = typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(Platform.Version, 10);

    if (apiLevel >= 31) {
      // Android 12+ – needs fine-grained BLE permissions
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED,
      );
    } else {
      // Android < 12 – only location permission needed for BLE
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  };

  // ── Chart interval helpers ───────────────────────────────────────────────────
  const startChartInterval = () => {
    if (chartIntervalRef.current) clearInterval(chartIntervalRef.current);
    chartIntervalRef.current = setInterval(() => {
      if (dataBufferRef.current.length === 0) return;
      const newPoints = dataBufferRef.current.splice(0);
      setPPGData((prev: number[]) => {
        const combined = [...prev, ...newPoints];
        return combined.length > CHART_WINDOW
          ? combined.slice(combined.length - CHART_WINDOW)
          : combined;
      });
    }, CHART_INTERVAL_MS);
  };

  const stopChartInterval = () => {
    if (chartIntervalRef.current) {
      clearInterval(chartIntervalRef.current);
      chartIntervalRef.current = null;
    }
  };

  // ── Core cleanup (call on any disconnect path) ──────────────────────────────
  const cleanupConnection = useCallback(() => {
    stopChartInterval();
    notifSubscriptionRef.current?.remove();
    notifSubscriptionRef.current = null;
    disconnectSubscriptionRef.current?.remove();
    disconnectSubscriptionRef.current = null;
    connectedDeviceRef.current = null;
    dataBufferRef.current = [];
    setConnectedDeviceId(null);
    setPPGData([]);
  }, []);

  // ── Scanning ─────────────────────────────────────────────────────────────────
  const scanForDevices = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setConnectionError('Bluetooth permissions were denied. Please enable them in Settings.');
      return;
    }

    const bleState = await bleManager.state();
    if (bleState !== State.PoweredOn) {
      setConnectionError('Bluetooth is disabled. Please enable it and try again.');
      return;
    }

    setScannedDevices([]);
    setConnectionError(null);
    setIsScanning(true);

    bleManager.startDeviceScan(
      null,
      { allowDuplicates: false },
      (error: BleError | null, device: Device | null) => {
        if (error) {
          setConnectionError(error.message);
          setIsScanning(false);
          return;
        }
        if (device) {
          const name = device.name ?? device.localName ?? null;
          setScannedDevices((prev: ScannedDevice[]) => {
            if (prev.find((d: ScannedDevice) => d.id === device.id)) return prev;
            return [...prev, { id: device.id, name, rssi: device.rssi }];
          });
        }
      },
    );

    // Auto-stop after 10 seconds
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
    }, 10_000);
  }, []);

  const stopScan = useCallback(() => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
  }, []);

  // ── Connection ───────────────────────────────────────────────────────────────
  const connectToDevice = useCallback(async (deviceId: string) => {
    stopScan();
    setIsConnecting(true);
    setConnectionError(null);
    dataBufferRef.current = [];

    try {
      const device = await bleManager.connectToDevice(deviceId, { timeout: 15_000 });
      await device.discoverAllServicesAndCharacteristics();

      connectedDeviceRef.current = device;

      // Watch for unexpected disconnects
      disconnectSubscriptionRef.current = device.onDisconnected(
        (_err: BleError | null, _dev: Device) => {
          cleanupConnection();
        },
      );

      // Subscribe to PPG notifications
      notifSubscriptionRef.current = device.monitorCharacteristicForService(
        SERVICE_UUID,
        TX_CHAR_UUID,
        (error: BleError | null, char: Characteristic | null) => {
          if (error || !char?.value) return;

          // char.value is Base64-encoded bytes from the Arduino
          // The Arduino sends: "%d\n" e.g. "1024\n"
          let decoded: string;
          try {
            decoded = atob(char.value);
          } catch {
            return;
          }

          // Handle potential multi-line payloads defensively
          const lines = decoded.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const val = parseInt(trimmed, 10);
            if (!isNaN(val)) {
              dataBufferRef.current.push(val);
            }
          }
        },
      );

      startChartInterval();
      setConnectedDeviceId(device.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setConnectionError(message);
      cleanupConnection();
    } finally {
      setIsConnecting(false);
    }
  }, [cleanupConnection]);

  const disconnectFromDevice = useCallback(async () => {
    const deviceId = connectedDeviceRef.current?.id;
    cleanupConnection();
    if (deviceId) {
      try {
        await bleManager.cancelDeviceConnection(deviceId);
      } catch {
        // Device may already be disconnected; ignore
      }
    }
  }, [cleanupConnection]);

  return {
    isScanning,
    scannedDevices,
    connectedDeviceId,
    ppgData,
    connectionError,
    isConnecting,
    scanForDevices,
    stopScan,
    connectToDevice,
    disconnectFromDevice,
  };
}
