/**
 * AmplitudeService.ts — local on-device implementation.
 *
 * All session state and signal processing that was previously handled by the
 * Python API (/amplitude/start, /amplitude/data, /amplitude/stop) now runs
 * entirely on-device via LocalSignalProcessing.
 *
 * Public function signatures are unchanged so AmplitudeScreen.tsx requires
 * no modifications.  The `apiUrl` parameters are accepted but not used.
 *
 * Python API parity (main.py):
 *   - Constants:         AMP_BUFFER_SEC, AMP_SEGMENT_SEC, AMP_PROCESS_INTERVAL, etc.
 *   - SQI checking:      isSegmentBad()
 *   - PPG → HR:          detectPPGPeaks() + IBI → bpm
 *   - Amplitude tracker: RealTimeHRVAmplitude class (find_peaks on HR series)
 *   - Feedback colour:   green / yellow (≥90% prev) / red
 */

import {
  isSegmentBad,
  isSegmentBadFast,
  detectPPGPeaks,
  findPeaks,
  mean,
} from './LocalSignalProcessing';

// ─── Constants (mirrors Python API) ──────────────────────────────────────────

const AMP_SAMPLING_RATE = 100;
const AMP_BUFFER_SEC = 10;
const AMP_BUFFER_SAMPLES = AMP_BUFFER_SEC * AMP_SAMPLING_RATE; // 1000
const AMP_SEGMENT_SEC = 3;
const AMP_SEGMENT_SAMPLES = AMP_SEGMENT_SEC * AMP_SAMPLING_RATE; // 300
const AMP_PROCESS_INTERVAL = 100; // process every 100 new samples (~1 s)
const AMP_BAD_RESET_DELAY = 4.0; // seconds of bad signal before resetting peak state
const AMP_YELLOW_THRESHOLD = 0.90; // amplitude ≥ 90 % of previous → yellow

// ─── Public Interfaces (unchanged from original AmplitudeService.ts) ─────────

export interface AmplitudeEvent {
  peak_hr: number;
  trough_hr: number;
  amplitude: number;
  breathing_rate_bpm: number;
  feedback_color: 'green' | 'yellow' | 'red';
  time_s: number;
  peak_time_s: number;
}

export interface HRDataPoint {
  time_s: number;
  hr_bpm: number;
}

export interface AmplitudeDataResult {
  hr: number | null;
  signal_quality: string;
  events: AmplitudeEvent[];
  hr_data: HRDataPoint[];
  sample_count: number;
  timestamp: number;
}

export interface AmplitudeStopResult {
  total_samples: number;
  total_amplitude_events: number;
  mean_hr: number | null;
  min_hr: number | null;
  max_hr: number | null;
  mean_amplitude: number | null;
  min_amplitude: number | null;
  max_amplitude: number | null;
  mean_breathing_rate: number | null;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface AmplitudeFeedback {
  peakIdx: number;
  troughIdx: number;
  peakHR: number;
  troughHR: number;
  amplitude: number;
  breathingRateBpm: number;
}

// ─── RealTimeHRVAmplitude (port of Python class) ──────────────────────────────

/**
 * Tracks HR oscillations in real time to detect breathing-related
 * amplitude events.  Mirrors RealTimeHRVAmplitude in main.py.
 */
class RealTimeHRVAmplitude {
  lastPeakIdx: number | null = null;
  lastPeakHR: number | null = null;
  amplitudes: number[] = [];
  lastConfirmedIdx: number = -1;
  paused: boolean = false;

  resetPeakState(hrLen: number = 0): void {
    this.lastPeakIdx = null;
    this.lastPeakHR = null;
    this.lastConfirmedIdx = hrLen - 1;
  }

  /**
   * Process accumulated HR time-series and return any newly detected
   * amplitude events.  Mirrors RealTimeHRVAmplitude.update() in main.py.
   *
   * Uses findPeaks(distance=4, prominence=1.5) on both the HR series and
   * its negation (for troughs), then pairs adjacent peak→trough events.
   */
  update(hrTimes: number[], hrValues: number[]): AmplitudeFeedback[] {
    const n = hrValues.length;
    if (n < 10) return [];

    const CONFIRM_MARGIN = 3;

    // find_peaks on HR (peaks) and -HR (troughs) — mirrors scipy find_peaks
    const peaks = findPeaks(hrValues, 4, 1.5);
    const troughs = findPeaks(
      hrValues.map(v => -v),
      4,
      1.5,
    );

    // Merge and sort events chronologically
    const events: Array<{idx: number; type: 'peak' | 'trough'}> = [
      ...peaks.map(i => ({idx: i, type: 'peak' as const})),
      ...troughs.map(i => ({idx: i, type: 'trough' as const})),
    ].sort((a, b) => a.idx - b.idx);

    const feedback: AmplitudeFeedback[] = [];

    for (const {idx, type} of events) {
      if (idx <= this.lastConfirmedIdx) continue;
      if (idx >= n - CONFIRM_MARGIN) continue;

      if (type === 'peak') {
        this.lastPeakIdx = idx;
        this.lastPeakHR = hrValues[idx];
        this.lastConfirmedIdx = idx;
      } else {
        // trough
        this.lastConfirmedIdx = idx;
        if (this.lastPeakHR !== null && this.lastPeakIdx !== null) {
          const amplitude = this.lastPeakHR - hrValues[idx];
          if (amplitude > 1.0) {
            this.amplitudes.push(amplitude);

            const peakT = hrTimes[this.lastPeakIdx];
            const troughT = hrTimes[idx];
            const halfPeriod = troughT - peakT;
            const breathingRate =
              halfPeriod > 0 ? 60.0 / (2 * halfPeriod) : 0;

            feedback.push({
              peakIdx: this.lastPeakIdx,
              troughIdx: idx,
              peakHR: this.lastPeakHR,
              troughHR: hrValues[idx],
              amplitude,
              breathingRateBpm: breathingRate,
            });
          }
          this.lastPeakHR = null;
          this.lastPeakIdx = null;
        }
      }
    }

    return feedback;
  }
}

// ─── AmplitudeSession (port of Python AmplitudeSession) ───────────────────────

/**
 * All state for one local amplitude monitoring session.
 * Mirrors the AmplitudeSession class and its processing loop in main.py.
 */
class AmplitudeSession {
  // Rolling 10-second buffer of raw PPG samples (maxlen = 1000)
  ppgBuffer: number[] = [];
  // Sliding 3-second window for SQI checks (maxlen = 300)
  segmentBuffer: number[] = [];

  tracker = new RealTimeHRVAmplitude();

  hrTimes: number[] = [];
  hrValues: number[] = [];
  ampTimes: number[] = [];
  ampValues: number[] = [];
  bpmValues: number[] = [];

  sampleCount: number = 0;
  lastProcessCount: number = 0;
  isPaused: boolean = false;
  badStartTime: number | null = null;
  peakStateReset: boolean = false;

  /** Append one sample and maintain buffer lengths. */
  pushSample(val: number): void {
    this.ppgBuffer.push(val);
    if (this.ppgBuffer.length > AMP_BUFFER_SAMPLES) {
      this.ppgBuffer.shift();
    }
    this.segmentBuffer.push(val);
    if (this.segmentBuffer.length > AMP_SEGMENT_SAMPLES) {
      this.segmentBuffer.shift();
    }
    this.sampleCount++;
  }
}

// ─── In-memory session store ──────────────────────────────────────────────────

const _sessions = new Map<string, AmplitudeSession>();
let _sessionCounter = 0;

function generateSessionId(): string {
  _sessionCounter++;
  return `local_${Date.now()}_${_sessionCounter}`;
}

// ─── Public API functions ─────────────────────────────────────────────────────

/**
 * Start a new amplitude monitoring session.
 * Returns a session ID used in subsequent calls.
 * Mirrors POST /amplitude/start.
 */
export async function amplitudeStart(
  _apiUrl: string,
): Promise<string> {
  const id = generateSessionId();
  _sessions.set(id, new AmplitudeSession());
  return id;
}

/**
 * Process a batch of new PPG samples for an active session.
 * Mirrors POST /amplitude/data.
 *
 * Processing loop (identical to Python):
 *   - Each sample → ppgBuffer + segmentBuffer.
 *   - SQI check on full segment; pause/resume session.
 *   - Every AMP_PROCESS_INTERVAL samples when not paused and buffer ≥ 5 s:
 *       • detect PPG peaks → IBIs → avg HR → push to hr_times / hr_values.
 *       • run RealTimeHRVAmplitude.update() → emit amplitude events.
 *   - Colour feedback: green / yellow / red.
 */
export async function amplitudeSendData(
  _apiUrl: string,
  sessionId: string,
  samples: number[],
): Promise<AmplitudeDataResult> {
  const session = _sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const timestamp = Date.now();
  const newEvents: AmplitudeEvent[] = [];
  const hrBefore = session.hrValues.length;

  // ── Ingest samples and check SQI on every sample, exactly like Python ──
  for (const val of samples) {
    session.pushSample(val);

    // Check SQI on every sample using the rolling segment buffer.
    // Fast checks (std/unique/jump) run immediately from the first sample.
    // Full check (+ peak plausibility) kicks in once the 3-second window is full.
    const t = session.sampleCount / AMP_SAMPLING_RATE;
    const bad =
      session.segmentBuffer.length >= AMP_SEGMENT_SAMPLES
        ? isSegmentBad(session.segmentBuffer, AMP_SAMPLING_RATE)
        : isSegmentBadFast(session.segmentBuffer);

    if (bad) {
      if (!session.isPaused) {
        session.isPaused = true;
        session.tracker.paused = true;
        session.badStartTime = t;
        session.peakStateReset = false;
      } else if (
        !session.peakStateReset &&
        session.badStartTime !== null &&
        t - session.badStartTime >= AMP_BAD_RESET_DELAY
      ) {
        session.tracker.resetPeakState(session.hrValues.length);
        session.peakStateReset = true;
      }
    } else {
      if (session.isPaused) {
        session.isPaused = false;
        session.tracker.paused = false;
        session.badStartTime = null;
        session.peakStateReset = false;
      }
    }
  }

  // ── Process every AMP_PROCESS_INTERVAL samples when eligible ────────────
  while (
    session.sampleCount - session.lastProcessCount >= AMP_PROCESS_INTERVAL &&
    session.ppgBuffer.length >= AMP_SAMPLING_RATE * 5 &&
    !session.isPaused
  ) {
    session.lastProcessCount += AMP_PROCESS_INTERVAL;

    // ── PPG peaks → IBI → average HR ──────────────────────────────────────
    try {
      const buf = session.ppgBuffer.slice(); // copy the rolling buffer
      const cleaned = detectPPGPeaks(buf, AMP_SAMPLING_RATE);

      if (cleaned.length >= 2) {
        const ibis: number[] = [];
        for (let i = 1; i < cleaned.length; i++) {
          const ibiSec = (cleaned[i] - cleaned[i - 1]) / AMP_SAMPLING_RATE;
          if (ibiSec > 0.3 && ibiSec < 2.0) {
            ibis.push(ibiSec);
          }
        }
        if (ibis.length > 0) {
          const avgHR = 60.0 / mean(ibis);
          const tHr = session.sampleCount / AMP_SAMPLING_RATE;
          session.hrTimes.push(tHr);
          session.hrValues.push(avgHR);
        }
      }
    } catch {
      // ignore processing errors; continue accumulating
    }

    // ── HR oscillation → amplitude events ─────────────────────────────────
    try {
      const results = session.tracker.update(session.hrTimes, session.hrValues);
      for (const item of results) {
        const troughT = session.hrTimes[item.troughIdx];
        const amp = item.amplitude;

        const prevAmp =
          session.ampValues.length > 0
            ? session.ampValues[session.ampValues.length - 1]
            : null;

        session.ampTimes.push(troughT);
        session.ampValues.push(amp);
        session.bpmValues.push(item.breathingRateBpm);

        let color: 'green' | 'yellow' | 'red';
        if (prevAmp === null || amp >= prevAmp) {
          color = 'green';
        } else if (amp >= prevAmp * AMP_YELLOW_THRESHOLD) {
          color = 'yellow';
        } else {
          color = 'red';
        }

        const peakT = session.hrTimes[item.peakIdx];
        newEvents.push({
          peak_hr: item.peakHR,
          trough_hr: item.troughHR,
          amplitude: amp,
          breathing_rate_bpm: item.breathingRateBpm,
          feedback_color: color,
          time_s: troughT,
          peak_time_s: peakT,
        });
      }
    } catch {
      // ignore tracker errors
    }
  }

  // Collect newly added HR data points for this call
  const newHrData: HRDataPoint[] = [];
  for (let i = hrBefore; i < session.hrValues.length; i++) {
    newHrData.push({
      time_s: session.hrTimes[i],
      hr_bpm: session.hrValues[i],
    });
  }

  return {
    hr: session.hrValues.length > 0
      ? session.hrValues[session.hrValues.length - 1]
      : null,
    signal_quality: session.isPaused ? 'PAUSED (bad signal)' : 'ACTIVE',
    events: newEvents,
    hr_data: newHrData,
    sample_count: session.sampleCount,
    timestamp,
  };
}

/**
 * Stop a session and return summary statistics.
 * Mirrors POST /amplitude/stop.
 */
export async function amplitudeStop(
  _apiUrl: string,
  sessionId: string,
): Promise<AmplitudeStopResult> {
  const session = _sessions.get(sessionId);
  _sessions.delete(sessionId);

  if (!session) {
    throw new Error('Session not found');
  }

  const result: AmplitudeStopResult = {
    total_samples: session.sampleCount,
    total_amplitude_events: session.ampValues.length,
    mean_hr: null,
    min_hr: null,
    max_hr: null,
    mean_amplitude: null,
    min_amplitude: null,
    max_amplitude: null,
    mean_breathing_rate: null,
  };

  if (session.hrValues.length > 0) {
    result.mean_hr = mean(session.hrValues);
    result.min_hr = Math.min(...session.hrValues);
    result.max_hr = Math.max(...session.hrValues);
  }

  if (session.ampValues.length > 0) {
    result.mean_amplitude = mean(session.ampValues);
    result.min_amplitude = Math.min(...session.ampValues);
    result.max_amplitude = Math.max(...session.ampValues);
  }

  if (session.bpmValues.length > 0) {
    result.mean_breathing_rate = mean(session.bpmValues);
  }

  return result;
}

