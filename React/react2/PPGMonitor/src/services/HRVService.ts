import {analyzeWindowQuality, calculateHRVRMSSD} from './LocalSignalProcessing';

export interface HRVResult {
  success: boolean;
  rmssd?: number;
  bad_segments: number;
  error?: string;
  timestamp: number;
}

/**
 * Analyze a PPG window and return HRV RMSSD — runs entirely on-device.
 *
 * The `apiUrl` parameter is retained for interface compatibility but is
 * no longer used; all computation is performed locally via LocalSignalProcessing.
 *
 * Mirrors the /analyze endpoint logic from the Python API (main.py):
 *   1. Minimum data length check (≥ 10 seconds).
 *   2. 3-second segment quality assessment (SQI).
 *   3. RMSSD calculation using cleaned PPG peaks.
 */
export async function analyzeHRV(
  _apiUrl: string,
  ppgData: number[],
  samplingRate: number,
  maxBadSegments: number = 0,
): Promise<HRVResult> {
  const timestamp = Date.now();

  // Minimum data: at least 10 seconds (mirrors Python API validation)
  const minSamples = Math.round(samplingRate * 10);
  if (ppgData.length < minSamples) {
    return {
      success: false,
      bad_segments: 0,
      error: `Insufficient data: need at least ${minSamples} samples (10 seconds), got ${ppgData.length}`,
      timestamp,
    };
  }

  // Signal quality assessment across 3-second segments
  const {isBad, badSegments} = analyzeWindowQuality(
    ppgData,
    samplingRate,
    3,
    maxBadSegments,
  );

  if (isBad) {
    return {
      success: false,
      bad_segments: badSegments,
      error: `Poor signal quality: ${badSegments} bad segments detected (max allowed: ${maxBadSegments})`,
      timestamp,
    };
  }

  // Calculate RMSSD locally
  const rmssd = calculateHRVRMSSD(ppgData, samplingRate);

  if (rmssd === null) {
    return {
      success: false,
      bad_segments: badSegments,
      error: 'HRV calculation failed: unable to process PPG signal',
      timestamp,
    };
  }

  return {
    success: true,
    rmssd,
    bad_segments: badSegments,
    timestamp,
  };
}
