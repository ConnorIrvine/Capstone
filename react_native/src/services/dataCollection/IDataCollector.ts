/**
 * DATA COLLECTION INTERFACE
 * ==========================
 * Abstract interface for PPG data collection
 * 
 * This interface ensures that different sensor implementations
 * can be swapped without changing the rest of the application.
 * 
 * IMPLEMENTATION STRATEGY:
 * - Create concrete classes that implement this interface
 * - Example: PolarH10Collector, GenericBLECollector, MockCollector
 * - Switch implementations via dependency injection or factory pattern
 */

import { PPGDataPoint, PPGDataBatch, DeviceInfo } from '@/types';

export interface IDataCollector {
  /**
   * Initialize the data collector
   * - Request necessary permissions (Bluetooth, location)
   * - Set up event listeners
   * Returns: success status
   */
  initialize(): Promise<boolean>;

  /**
   * Scan for available Bluetooth devices
   * timeout: milliseconds to scan
   * Returns: array of discovered devices
   */
  scanDevices(timeout: number): Promise<DeviceInfo[]>;

  /**
   * Connect to a specific device
   * deviceId: the device identifier from scanDevices
   * Returns: connection success status
   */
  connect(deviceId: string): Promise<boolean>;

  /**
   * Disconnect from current device
   */
  disconnect(): Promise<void>;

  /**
   * Start collecting PPG data
   * onData: callback function that receives data points in real-time
   * onError: callback for error handling
   */
  startCollection(
    onData: (dataPoint: PPGDataPoint) => void,
    onError: (error: Error) => void
  ): Promise<void>;

  /**
   * Stop collecting data
   * Returns: complete batch of collected data
   */
  stopCollection(): Promise<PPGDataBatch>;

  /**
   * Get current connection status
   */
  isConnected(): boolean;

  /**
   * Get current device info
   */
  getDeviceInfo(): DeviceInfo | null;

  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;
}
