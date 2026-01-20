/**
 * HRV PROCESSING INTERFACE
 * =========================
 * Abstract interface for HRV calculation and processing
 * 
 * This interface allows swapping between different processing implementations:
 * - JavaScript/TypeScript implementation (for pure RN)
 * - Python-bridge implementation (calling local Python scripts)
 * - Cloud-based processing (if requirements change)
 * - Different HRV algorithms (time-domain, frequency-domain)
 * 
 * PROCESSING PIPELINE:
 * Raw PPG Data → Peak Detection → RR Intervals → HRV Metrics
 */

import { PPGDataBatch, HRVMetrics } from '@/types';

export interface IHRVProcessor {
  /**
   * Initialize the processor
   * - Load any required models or configurations
   * - Set up processing environment
   */
  initialize(): Promise<boolean>;

  /**
   * Process raw PPG data to extract HRV metrics
   * 
   * @param data - Raw PPG data batch from sensor
   * @returns HRV metrics including RMSSD
   * 
   * PROCESSING STEPS:
   * 1. Signal quality check and filtering
   * 2. Peak detection (find heartbeats in PPG signal)
   * 3. Calculate RR intervals (beat-to-beat intervals)
   * 4. Validate RR intervals (remove artifacts)
   * 5. Calculate HRV metrics (RMSSD, SDNN, etc.)
   */
  processData(data: PPGDataBatch): Promise<HRVMetrics>;

  /**
   * Real-time processing for live feedback
   * Processes a sliding window of recent data
   * 
   * @param recentData - Last N seconds of PPG data
   * @param windowSize - Size of analysis window in seconds
   */
  processRealtime(
    recentData: PPGDataBatch,
    windowSize: number
  ): Promise<HRVMetrics | null>;

  /**
   * Validate signal quality
   * Returns quality score and whether data is suitable for analysis
   */
  checkSignalQuality(data: PPGDataBatch): Promise<{
    quality: 'good' | 'fair' | 'poor';
    score: number;
    issues?: string[];
  }>;

  /**
   * Get processor information
   * Useful for debugging and logging which processor is being used
   */
  getProcessorInfo(): {
    name: string;
    version: string;
    type: 'javascript' | 'python' | 'hybrid';
  };

  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;
}
