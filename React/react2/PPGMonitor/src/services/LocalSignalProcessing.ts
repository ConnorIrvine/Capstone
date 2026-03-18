/**
 * LocalSignalProcessing.ts
 *
 * Pure TypeScript port of the Python API signal processing algorithms.
 * Replaces neurokit2 / scipy calls so all computation runs on-device
 * with no network requirement.
 *
 * Algorithms ported from Python API (main.py):
 *   - initial_cleaning()
 *   - clean_peaks()
 *   - is_segment_bad()
 *   - analyze_window_quality()
 *   - calculate_hrv_rmssd()
 *   - find_peaks() (scipy.signal.find_peaks equivalent)
 *   - ppg_process / ppg_peaks (neurokit2 equivalent via IIR bandpass + local maxima)
 */

// ─── Statistical Helpers ──────────────────────────────────────────────────────

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/** Count distinct integer-rounded values (mirrors numpy unique). */
function uniqueCount(arr: number[]): number {
  const s = new Set<number>();
  for (let i = 0; i < arr.length; i++) {
    s.add(Math.round(arr[i]));
  }
  return s.size;
}

// ─── IIR Filtering ────────────────────────────────────────────────────────────

/**
 * First-order IIR high-pass filter.
 * Implements the RC high-pass: y[n] = alpha*(y[n-1] + x[n] - x[n-1])
 * alpha = tau / (tau + T), tau = 1/(2π·fc), T = 1/fs
 * Removes slow baseline drift below fc Hz.
 */
function iirHighPass(signal: number[], fcLow: number, fs: number): number[] {
  const tau = 1 / (2 * Math.PI * fcLow);
  const T = 1 / fs;
  const alpha = tau / (tau + T);
  const n = signal.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    out[i] = alpha * (out[i - 1] + signal[i] - signal[i - 1]);
  }
  return out;
}

/**
 * First-order IIR low-pass filter.
 * y[n] = alpha*y[n-1] + (1-alpha)*x[n]
 * alpha = tau / (tau + T), tau = 1/(2π·fc), T = 1/fs
 * Smooths out noise above fc Hz.
 */
function iirLowPass(signal: number[], fcHigh: number, fs: number): number[] {
  const tau = 1 / (2 * Math.PI * fcHigh);
  const T = 1 / fs;
  const alpha = tau / (tau + T);
  const n = signal.length;
  const out = new Array<number>(n).fill(0);
  out[0] = signal[0] * (1 - alpha);
  for (let i = 1; i < n; i++) {
    out[i] = alpha * out[i - 1] + (1 - alpha) * signal[i];
  }
  return out;
}

/**
 * Bandpass filter: cascade high-pass then low-pass IIR filters.
 * Approximates a Butterworth bandpass (0.5–8 Hz) as used by neurokit2's
 * ppg_process() default pipeline.
 */
function bandpassFilter(
  signal: number[],
  fcLow: number,
  fcHigh: number,
  fs: number,
): number[] {
  const hp = iirHighPass(signal, fcLow, fs);
  return iirLowPass(hp, fcHigh, fs);
}

// ─── Peak Detection (scipy.signal.find_peaks equivalent) ─────────────────────

/**
 * Compute peak prominence for each candidate peak.
 * For each peak, prominence = peak_value - max(left_base, right_base)
 * where bases are the minimum values between the peak and any higher peak
 * (or the signal edge) on each side.
 *
 * This matches the definition used by scipy.signal.find_peaks(prominence=...).
 */
function computeProminence(signal: number[], peaks: number[]): number[] {
  const n = signal.length;
  return peaks.map(pi => {
    const peakVal = signal[pi];

    // Left base: minimum between this peak and nearest higher peak to the left
    let leftMin = peakVal;
    for (let j = pi - 1; j >= 0; j--) {
      if (signal[j] < leftMin) leftMin = signal[j];
      if (signal[j] > peakVal) break; // hit a taller peak
    }

    // Right base: minimum between this peak and nearest higher peak to the right
    let rightMin = peakVal;
    for (let j = pi + 1; j < n; j++) {
      if (signal[j] < rightMin) rightMin = signal[j];
      if (signal[j] > peakVal) break; // hit a taller peak
    }

    return peakVal - Math.max(leftMin, rightMin);
  });
}

/**
 * Find peaks in a 1-D signal with optional minimum distance and prominence.
 *
 * Equivalent to scipy.signal.find_peaks(signal, distance=distance, prominence=prominence).
 * Used for HR oscillation detection in amplitude feedback (RealTimeHRVAmplitude.update).
 */
export function findPeaks(
  signal: number[],
  distance: number = 1,
  prominence: number = 0,
): number[] {
  const n = signal.length;
  if (n < 3) return [];

  // Step 1: collect all strict local maxima
  const localMaxima: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      localMaxima.push(i);
    }
  }

  // Step 2: enforce minimum distance — keep highest peak when two are too close
  const distFiltered: number[] = [];
  for (const pk of localMaxima) {
    if (distFiltered.length === 0) {
      distFiltered.push(pk);
    } else {
      const last = distFiltered[distFiltered.length - 1];
      if (pk - last < distance) {
        if (signal[pk] > signal[last]) {
          distFiltered[distFiltered.length - 1] = pk;
        }
      } else {
        distFiltered.push(pk);
      }
    }
  }

  if (prominence <= 0) return distFiltered;

  // Step 3: filter by prominence
  const proms = computeProminence(signal, distFiltered);
  return distFiltered.filter((_, i) => proms[i] >= prominence);
}

// ─── PPG Peak Cleaning (direct port from Python API) ─────────────────────────

/**
 * Remove peaks that sit on a rising edge.
 * A peak is on a rising edge when every one of the next `risingWindow` samples
 * is strictly greater than the previous one.
 *
 * Direct port of initial_cleaning() from main.py.
 */
export function initialCleaning(
  ppgWindow: number[],
  peakIndices: number[],
  risingWindow: number = 5,
): number[] {
  const cleaned: number[] = [];
  for (const idx of peakIndices) {
    const endIdx = Math.min(idx + risingWindow + 1, ppgWindow.length);
    const after = ppgWindow.slice(idx, endIdx);
    if (after.length > 1) {
      let isStrictlyRising = true;
      for (let i = 0; i < after.length - 1; i++) {
        if (after[i] >= after[i + 1]) {
          isStrictlyRising = false;
          break;
        }
      }
      if (isStrictlyRising) {
        continue; // skip — this peak is on a rising edge
      }
    }
    cleaned.push(idx);
  }
  return cleaned;
}

/**
 * Clean peaks:
 *   1. Remove peaks on rising edges (via initialCleaning).
 *   2. Of any two peaks closer than minDistance samples, remove the smaller one.
 *
 * Direct port of clean_peaks() from main.py.
 */
export function cleanPeaks(
  ppgWindow: number[],
  peakIndices: number[],
  risingWindow: number = 5,
  minDistance: number = 20,
): number[] {
  const cleaned = initialCleaning(ppgWindow, peakIndices, risingWindow);
  let i = 0;
  while (i < cleaned.length - 1) {
    if (cleaned[i + 1] - cleaned[i] < minDistance) {
      // Remove the smaller peak; keep the larger one
      if (ppgWindow[cleaned[i]] >= ppgWindow[cleaned[i + 1]]) {
        cleaned.splice(i + 1, 1); // remove next
      } else {
        cleaned.splice(i, 1); // remove current
      }
    } else {
      i++;
    }
  }
  return cleaned;
}

// ─── PPG Peak Detection (nk.ppg_process equivalent) ──────────────────────────

/**
 * Detect peaks in a PPG signal.
 *
 * Pipeline:
 *   1. Bandpass filter 0.5–8 Hz (mirrors neurokit2 ppg_process default).
 *   2. Find local maxima with minimum distance for ≤ 200 bpm.
 *   3. Keep only positive excursions (above zero after HPF).
 *   4. Adaptive amplitude threshold (reject peaks < 30 % of mean peak height).
 *   5. Apply clean_peaks on original signal for accurate rising-edge removal.
 *
 * Returns an array of peak indices into the original signal.
 */
export function detectPPGPeaks(signal: number[], samplingRate: number): number[] {
  if (signal.length < 10) return [];

  // Bandpass 0.5–8 Hz
  const filtered = bandpassFilter(signal, 0.5, 8, samplingRate);

  // Min distance between peaks: max physiological HR = 200 bpm
  const minDist = Math.max(1, Math.round((60 / 200) * samplingRate)); // ~30 at 100 Hz

  // Find local maxima with distance constraint (no prominence filter here)
  const rawPeaks = findPeaks(filtered, minDist, 0);

  // Keep only positive peaks (above the high-pass zero line)
  const positivePeaks = rawPeaks.filter(i => filtered[i] > 0);
  if (positivePeaks.length === 0) return [];

  // Adaptive threshold: reject peaks < 30 % of the mean peak height
  const heights = positivePeaks.map(i => filtered[i]);
  const meanHeight = mean(heights);
  const thresholded = positivePeaks.filter(i => filtered[i] > 0.3 * meanHeight);
  if (thresholded.length === 0) return [];

  // Apply clean_peaks using the *original* signal values for rising-edge logic
  return cleanPeaks(signal, thresholded, 5, minDist);
}

// ─── Signal Quality Assessment (is_segment_bad / analyze_window_quality) ──────

/**
 * Fast SQI checks that work on any window size (≥ 1 sample).
 * Catches flatline, clipping, and extreme jumps immediately.
 * Returns true if the segment is clearly bad.
 */
export function isSegmentBadFast(segment: number[]): boolean {
  if (segment.length === 0) return true;

  // 1. Low variance (flatline)
  if (std(segment) < 1.0) return true;

  // 2. Clipping / saturation
  const uniqueRatio = uniqueCount(segment) / segment.length;
  if (uniqueRatio < 0.02) return true;

  // 3. Extreme jump
  let maxAbsDiff = 0;
  for (let i = 1; i < segment.length; i++) {
    const d = Math.abs(segment[i] - segment[i - 1]);
    if (d > maxAbsDiff) maxAbsDiff = d;
  }
  if (maxAbsDiff > 2000) return true;

  return false;
}

/**
 * Full SQI check — requires a complete 3-second segment.
 * Adds peak plausibility on top of the fast checks.
 * Returns true if the segment is bad.
 */
export function isSegmentBad(segment: number[], samplingRate: number): boolean {
  if (isSegmentBadFast(segment)) return true;

  // Peak plausibility — expect 2–6 peaks in 3 s (40–120 bpm).
  // Light bandpass + raw local maxima count (no heavy cleaning).
  try {
    const filtered = bandpassFilter(segment, 0.5, 8, samplingRate);
    const minDist = Math.max(1, Math.round((60 / 200) * samplingRate));
    const peaks = findPeaks(filtered, minDist, 0).filter(i => filtered[i] > 0);
    if (peaks.length < 2 || peaks.length > 6) return true;
  } catch {
    return true;
  }

  return false;
}

/**
 * Split a PPG window into 3-second segments and count bad ones.
 *
 * Direct port of analyze_window_quality() from main.py.
 * Returns { isBad, badSegments }.
 */
export function analyzeWindowQuality(
  ppgWindow: number[],
  samplingRate: number,
  segmentSec: number = 3,
  maxBadSegments: number = 0,
): { isBad: boolean; badSegments: number } {
  const segLen = Math.round(segmentSec * samplingRate);
  if (segLen <= 0) return { isBad: true, badSegments: 0 };

  let badSegments = 0;
  const totalSegments = Math.floor(ppgWindow.length / segLen);

  for (let i = 0; i < totalSegments; i++) {
    const start = i * segLen;
    const segment = ppgWindow.slice(start, start + segLen);
    if (isSegmentBad(segment, samplingRate)) {
      badSegments++;
      if (badSegments > maxBadSegments) {
        return { isBad: true, badSegments };
      }
    }
  }

  return { isBad: false, badSegments };
}

// ─── HRV RMSSD (nk.ppg_intervalrelated equivalent) ───────────────────────────

/**
 * Calculate HRV RMSSD from a PPG window.
 *
 * Pipeline (mirrors calculate_hrv_rmssd() in main.py):
 *   1. Detect peaks with detectPPGPeaks (≈ nk.ppg_process).
 *   2. Apply cleanPeaks (identical logic to Python clean_peaks).
 *   3. Derive inter-beat intervals in milliseconds.
 *   4. Filter physiologically implausible IBIs (< 300 ms or > 2000 ms).
 *   5. Compute RMSSD = sqrt( mean( successive_differences² ) ).
 *
 * Returns the RMSSD value in milliseconds, or null on failure.
 */
export function calculateHRVRMSSD(
  ppgWindow: number[],
  samplingRate: number,
): number | null {
  try {
    // detectPPGPeaks already applies cleanPeaks internally — use directly.
    const cleaned = detectPPGPeaks(ppgWindow, samplingRate);

    if (cleaned.length < 3) return null;

    // Inter-beat intervals in milliseconds
    const ibis: number[] = [];
    for (let i = 1; i < cleaned.length; i++) {
      const ibiMs = ((cleaned[i] - cleaned[i - 1]) / samplingRate) * 1000;
      if (ibiMs >= 300 && ibiMs <= 2000) {
        ibis.push(ibiMs);
      }
    }
    if (ibis.length < 2) return null;

    // RMSSD = sqrt( mean( (IBI[i] - IBI[i-1])² ) )
    let sumSqDiff = 0;
    for (let i = 1; i < ibis.length; i++) {
      const diff = ibis[i] - ibis[i - 1];
      sumSqDiff += diff * diff;
    }
    return Math.sqrt(sumSqDiff / (ibis.length - 1));
  } catch {
    return null;
  }
}
