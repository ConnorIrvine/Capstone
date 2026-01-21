/**
 * TYPE DEFINITIONS
 * =================
 * Central type definitions for the entire application
 * Modify these types as your data models evolve
 */

/**
 * Raw PPG Data Point
 * ------------------
 * Represents a single data point from the PPG sensor
 * timestamp: milliseconds since epoch
 * value: raw PPG sensor value (format depends on your device)
 */
export interface PPGDataPoint {
  timestamp: number;
  value: number;
}

/**
 * PPG Data Batch
 * --------------
 * A collection of PPG data points with metadata
 * sessionId: unique identifier for this recording session
 * deviceId: identifier for the Bluetooth device
 * dataPoints: array of raw sensor readings
 * sampleRate: Hz (e.g., 130 for Polar H10)
 */
export interface PPGDataBatch {
  sessionId: string;
  deviceId: string;
  dataPoints: PPGDataPoint[];
  sampleRate: number;
  startTime: number;
  endTime: number;
}

/**
 * HRV Metrics
 * -----------
 * Heart rate variability analysis results
 * rmssd: Root Mean Square of Successive Differences (ms)
 * sdnn: Standard Deviation of NN intervals (ms)
 * meanHR: Average heart rate (bpm)
 * nnIntervals: Array of beat-to-beat intervals (ms)
 */
export interface HRVMetrics {
  rmssd: number;
  sdnn?: number;
  meanHR?: number;
  nnIntervals?: number[];
  timestamp: number;
  quality?: 'good' | 'fair' | 'poor'; // Signal quality indicator
}

/**
 * Meditation Session
 * ------------------
 * Complete meditation session with HRV data
 */
export interface MeditationSession {
  id: string;
  startTime: number;
  endTime: number;
  duration: number; // seconds
  hrvMetrics: HRVMetrics[];
  averageRMSSD: number;
  notes?: string;
  type: 'short' | 'medium' | 'long'; // For categorization
}

/**
 * Long-term HRV Trend
 * -------------------
 * Aggregated HRV data for trend analysis
 */
export interface HRVTrend {
  date: string; // YYYY-MM-DD
  averageRMSSD: number;
  sessionCount: number;
  totalDuration: number; // seconds
}

/**
 * Bluetooth Device Info
 * ---------------------
 * Information about connected PPG device
 */
export interface DeviceInfo {
  id: string;
  name: string;
  type: 'polar_h10' | 'other'; // Add more as needed
  isConnected: boolean;
  batteryLevel?: number;
}
