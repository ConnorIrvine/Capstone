import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBLEContext } from '../context/BLEContext';
import { ScannedDevice, DEVICE_NAME } from '../ble/useBLE';
import { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Connect'>;

export function ConnectScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const {
    isScanning,
    isConnecting,
    scannedDevices,
    connectedDeviceId,
    connectionError,
    scanForDevices,
    stopScan,
    connectToDevice,
  } = useBLEContext();

  // Navigate to data screen as soon as a connection is established
  useEffect(() => {
    if (connectedDeviceId) {
      navigation.navigate('Data');
    }
  }, [connectedDeviceId, navigation]);

  const renderDevice = ({ item }: ListRenderItemInfo<ScannedDevice>) => {
    const isTarget = item.name === DEVICE_NAME;
    const rssiLabel = item.rssi != null ? `${item.rssi} dBm` : '— dBm';
    const nameLabel = item.name ?? 'Unknown Device';

    return (
      <View style={[styles.deviceCard, isTarget && styles.deviceCardTarget]}>
        <View style={styles.deviceInfo}>
          <Text style={[styles.deviceName, isTarget && styles.deviceNameTarget]}>
            {nameLabel}
          </Text>
          <Text style={styles.deviceMeta}>{item.id}</Text>
          <Text style={styles.deviceMeta}>RSSI: {rssiLabel}</Text>
        </View>
        <TouchableOpacity
          style={[styles.connectButton, isConnecting && styles.connectButtonDisabled]}
          onPress={() => connectToDevice(item.id)}
          disabled={isConnecting}
          accessibilityLabel={`Connect to ${nameLabel}`}
        >
          {isConnecting ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : (
            <Text style={styles.connectButtonText}>Connect</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PPG Monitor</Text>
        <Text style={styles.headerSubtitle}>Connect to your Arduino sensor</Text>
      </View>

      {/* Scan button */}
      <View style={styles.scanRow}>
        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonActive]}
          onPress={isScanning ? stopScan : scanForDevices}
          disabled={isConnecting}
          accessibilityLabel={isScanning ? 'Stop scanning' : 'Scan for devices'}
        >
          {isScanning ? (
            <View style={styles.scanButtonInner}>
              <ActivityIndicator size="small" color="#22d3ee" style={{ marginRight: 8 }} />
              <Text style={styles.scanButtonTextActive}>Scanning… (tap to stop)</Text>
            </View>
          ) : (
            <Text style={styles.scanButtonText}>Scan for Devices</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {connectionError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{connectionError}</Text>
        </View>
      ) : null}

      {/* Device list */}
      {scannedDevices.length === 0 ? (
        <View style={styles.emptyState}>
          {isScanning ? (
            <Text style={styles.emptyText}>Searching for nearby BLE devices…</Text>
          ) : (
            <Text style={styles.emptyText}>
              Press "Scan for Devices" to find your{'\n'}
              <Text style={styles.targetName}>{DEVICE_NAME}</Text>
            </Text>
          )}
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>
            {scannedDevices.length} device{scannedDevices.length !== 1 ? 's' : ''} found
          </Text>
          <FlatList
            data={scannedDevices}
            keyExtractor={(item: ScannedDevice) => item.id}
            renderItem={renderDevice}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      {/* Connection progress overlay */}
      {isConnecting && (
        <View style={styles.connectingOverlay}>
          <View style={styles.connectingBox}>
            <ActivityIndicator size="large" color="#22d3ee" />
            <Text style={styles.connectingText}>Connecting…</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  scanRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scanButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonActive: {
    borderColor: '#22d3ee',
  },
  scanButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#22d3ee',
    fontSize: 15,
    fontWeight: '600',
  },
  scanButtonTextActive: {
    color: '#22d3ee',
    fontSize: 15,
    fontWeight: '600',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#450a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
    padding: 12,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  deviceCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceCardTarget: {
    borderColor: '#22d3ee',
    backgroundColor: '#0c2a3a',
  },
  deviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  deviceName: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  deviceNameTarget: {
    color: '#22d3ee',
  },
  deviceMeta: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  connectButton: {
    backgroundColor: '#22d3ee',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#475569',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  targetName: {
    color: '#22d3ee',
    fontWeight: '600',
  },
  connectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectingBox: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  connectingText: {
    color: '#94a3b8',
    fontSize: 15,
    marginTop: 14,
  },
});
