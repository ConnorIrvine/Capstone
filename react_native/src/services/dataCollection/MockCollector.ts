/**
 * MOCK DATA COLLECTOR
 * ====================
 * Mock implementation for testing without hardware
 * 
 * USE CASES:
 * - Development without physical sensor
 * - Automated testing
 * - UI development and prototyping
 * - Demo mode
 * 
 * BEHAVIOR:
 * - Simulates realistic PPG waveform using sine wave + noise
 * - Generates data at configurable sample rate (default 130 Hz)
 * - Simulates connection delays
 * - Can inject artificial artifacts for testing edge cases
 */

import { IDataCollector } from './IDataCollector';
import { PPGDataPoint, PPGDataBatch, DeviceInfo } from '@/types';

export class MockCollector implements IDataCollector {
  // Configuration
  // private sampleRate: number = 130; // Hz
  // private baseHeartRate: number = 70; // bpm for simulation
  // private dataBuffer: PPGDataPoint[] = [];
  // private collectionInterval: NodeJS.Timer | null = null;
  // private mockDeviceInfo: DeviceInfo;

  constructor() {
    // Initialize mock device info
    // Set up simulation parameters
  }

  async initialize(): Promise<boolean> {
    // Simulate initialization delay
    // Always return true for mock
    return true;
  }

  async scanDevices(timeout: number): Promise<DeviceInfo[]> {
    // Simulate scan delay
    // Return array of mock devices
    // Example: 'Mock Polar H10', 'Mock Device 2'
    return [];
  }

  async connect(deviceId: string): Promise<boolean> {
    // Simulate connection delay (500ms)
    // Set isConnected to true
    // Store device info
    return true;
  }

  async disconnect(): Promise<void> {
    // Clear collection interval
    // Set isConnected to false
  }

  async startCollection(
    onData: (dataPoint: PPGDataPoint) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    // 1. Set up interval timer based on sample rate
    //    Interval = 1000ms / sampleRate
    // 2. Generate synthetic PPG data each interval:
    //    - Base waveform: sine wave at heart rate frequency
    //    - Add realistic noise: random variation
    //    - Add breathing artifacts: slow sine wave modulation
    //    - Occasional motion artifacts: random spikes
    // 3. Create PPGDataPoint with current timestamp and value
    // 4. Call onData callback
    // 5. Buffer data point for batch retrieval
  }

  async stopCollection(): Promise<PPGDataBatch> {
    // Stop interval timer
    // Compile buffer into PPGDataBatch
    // Return batch and clear buffer
    return {} as PPGDataBatch;
  }

  isConnected(): boolean {
    return false;
  }

  getDeviceInfo(): DeviceInfo | null {
    return null;
  }

  async cleanup(): Promise<void> {
    // Stop collection
    // Clear all timers and references
  }

  // Private helper methods for data generation
  // private generatePPGValue(timestamp: number): number {}
  // private addNoise(value: number): number {}
}
