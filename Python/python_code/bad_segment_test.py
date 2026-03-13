import os
import sys
import numpy as np
import neurokit2 as nk
import warnings
from collections import deque

# Suppress all warnings from neurokit2 and pandas
warnings.filterwarnings('ignore')

# Settings
SAMPLING_RATE = 100  # Hz
WINDOW_SIZE_SEC = 30
UPDATE_INTERVAL_SEC = 10
SEGMENT_SEC = 3
MAX_BAD_SEGMENTS = 15  # match program.py default

# Output directory
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output_filter_testing")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Input file (change as needed)
INPUT_FILE = os.path.join(os.path.dirname(__file__), "ppg_dataset", "ppg_data.txt")

# Globals for output
all_ppg_data = []
ppg_window_data_combined = []
ppg_peaks_data_combined = []
appended_samples = 0

def parse_ppg_signal(line):
    try:
        values = [int(v.strip()) for v in line.split(',') if v.strip()]
        return values if values else None
    except ValueError:
        return None

def calculate_hrv_rmssd(ppg_window, sample_count, window_size_samples, sampling_rate=100):
    global appended_samples
    step_samples = sampling_rate * 10
    if appended_samples == 0:
        new_samples = ppg_window
        new_peaks_offset = 0
    else:
        new_samples = ppg_window[-step_samples:]
        new_peaks_offset = len(ppg_window) - step_samples
    try:
        signals, info = nk.ppg_process(ppg_window, sampling_rate=sampling_rate)
        hrv_metrics = nk.ppg_intervalrelated(signals, sampling_rate=sampling_rate)
        rmssd = hrv_metrics['HRV_RMSSD'].values[0]
        if 'PPG_Peaks' in signals:
            peaks_indices = np.where(signals['PPG_Peaks'] == 1)[0]
        else:
            peaks_indices = np.array([])
        # Calculate the absolute start index of the current window in the data stream
        window_start_index = sample_count - window_size_samples
        # Only append peaks from the newest 10s segment
        new_peaks = [i for i in peaks_indices if i >= new_peaks_offset]
        new_peaks = [i + window_start_index for i in new_peaks]
        # Only append window data and peaks if HRV calculation is successful
        ppg_window_data_combined.extend(new_samples)
        appended_samples += len(new_samples)
        ppg_peaks_data_combined.extend(new_peaks)
        return rmssd
    except Exception as e:
        print(f"\n[WARNING] HRV calculation failed: {e}")
        return None

def check_hrv_status(current_rmssd, previous_rmssd):
    if previous_rmssd is None or current_rmssd is None:
        return 1
    change = current_rmssd - previous_rmssd
    if change >= 0:
        return 0
    elif change > -5:
        return 1
    else:
        return 2

def display_feedback(status, current_rmssd, previous_rmssd, window_number):
    status_info = {
        0: {"symbol": "✓", "color": "GREEN", "message": "EXCELLENT - HRV IMPROVING"},
        1: {"symbol": "~", "color": "YELLOW", "message": "GOOD - SLIGHT DECREASE"},
        2: {"symbol": "✗", "color": "RED", "message": "REFOCUS - SIGNIFICANT DROP"}
    }
    info = status_info.get(status, status_info[1])
    if previous_rmssd is not None:
        change = current_rmssd - previous_rmssd
        change_str = f"{change:+.2f} ms"
    else:
        change_str = "N/A (first reading)"
    print(f"\n{'='*60}")
    print(f"Window #{window_number}")
    print(f"RMSSD: {current_rmssd:.2f} ms | Change: {change_str}")
    print(f"Status: [{info['symbol']}] {info['color']} - {info['message']}")
    print(f"{'='*60}")

def is_segment_bad(segment, sampling_rate):
    if len(segment) == 0:
        print("[DEBUG] Segment is empty")
        return True
    seg = np.asarray(segment, dtype=float)
    if np.std(seg) < 1.0:
        print("[DEBUG] Segment failed flatline/low variance check")
        return True
    unique_ratio = len(np.unique(seg)) / len(seg)
    if unique_ratio < 0.02:
        print("[DEBUG] Segment failed clipping/saturation check")
        return True
    if np.max(np.abs(np.diff(seg))) > 2000:
        print("[DEBUG] Segment failed extreme jump check")
        return True
    try:
        peaks, _ = nk.ppg_peaks(seg, sampling_rate=sampling_rate)
        if "PPG_Peaks" in peaks:
            peak_count = int(np.sum(peaks["PPG_Peaks"]))
        else:
            peak_count = 0
        if peak_count < 2 or peak_count > 6:
            print("[DEBUG] Segment failed peak plausibility check")
            return True
    except Exception:
        return True
    return False

def is_window_bad(ppg_window, sampling_rate, segment_sec=3, max_bad_segments=0):
    seg_len = int(segment_sec * sampling_rate)
    if seg_len <= 0:
        return True
    bad_segments = 0
    total_segments = len(ppg_window) // seg_len
    for i in range(total_segments):
        start = i * seg_len
        end = start + seg_len
        segment = ppg_window[start:end]
        if is_segment_bad(segment, sampling_rate):
            bad_segments += 1
            print(f"[DEBUG] Bad segment detected in window (segment #{i+1})")
            if bad_segments > max_bad_segments:
                return True
    return False

def collect_and_analyze_hrv_from_file(input_file, duration=None):
    window_size_samples = WINDOW_SIZE_SEC * SAMPLING_RATE
    all_data = []
    with open(input_file, 'r') as f:
        for line in f:
            vals = parse_ppg_signal(line)
            if vals:
                all_data.extend(vals)
    if duration is not None:
        max_samples = int(duration * SAMPLING_RATE)
        all_data = all_data[:max_samples]
    total_samples = len(all_data)
    print(f"Loaded {total_samples} samples from {input_file}")
    ppg_buffer = deque(maxlen=window_size_samples)
    global all_ppg_data
    all_ppg_data = []
    global ppg_window_data_combined
    ppg_window_data_combined = []
    global ppg_peaks_data_combined
    ppg_peaks_data_combined = []
    global appended_samples
    appended_samples = 0
    previous_rmssd = None
    window_count = 0
    sample_count = 0
    last_calculation_time = 0.0
    status_counts = {0: 0, 1: 0, 2: 0}

    # Simulate real-time streaming with a sliding window and update every 10s
    for ppg_value in all_data:
        ppg_buffer.append(ppg_value)
        all_ppg_data.append(ppg_value)
        sample_count += 1
        if sample_count % 100 == 0:
            data_time = sample_count / SAMPLING_RATE
            print(f"Samples processed: {sample_count} | Time: {data_time:.1f}s", end='\r')

        data_time = sample_count / SAMPLING_RATE
        # Perform HRV calculation every 10 seconds (after initial 30 seconds)
        if (
            data_time >= WINDOW_SIZE_SEC and
            data_time - last_calculation_time >= UPDATE_INTERVAL_SEC and
            len(ppg_buffer) >= window_size_samples * 0.8
        ):
            window_count += 1
            last_calculation_time = data_time
            ppg_window = np.array(ppg_buffer)
            if is_window_bad(ppg_window, SAMPLING_RATE, segment_sec=SEGMENT_SEC, max_bad_segments=MAX_BAD_SEGMENTS):
                print(f"\n[Window #{window_count}] Bad data detected (segment SQI). Skipping HRV.")
                continue
            current_rmssd = calculate_hrv_rmssd(ppg_window, sample_count, window_size_samples, SAMPLING_RATE)
            if current_rmssd is not None:
                status = check_hrv_status(current_rmssd, previous_rmssd)
                status_counts[status] += 1
                display_feedback(status, current_rmssd, previous_rmssd, window_count)
                previous_rmssd = current_rmssd
            else:
                print(f"\n[Window #{window_count}] Unable to calculate HRV")

    print("\n\nProcessing complete!")
    print("\n" + "="*60)
    print("SESSION SUMMARY")
    print("="*60)
    print(f"Total samples processed: {len(all_ppg_data)}")
    print(f"Total HRV windows analyzed: {window_count}")
    if previous_rmssd:
        print(f"Final RMSSD: {previous_rmssd:.2f} ms")
    print(f"\nStatus Distribution:")
    print(f"  GREEN (Improving):        {status_counts[0]} windows")
    print(f"  YELLOW (Minor decrease):  {status_counts[1]} windows")
    print(f"  RED (Significant drop):   {status_counts[2]} windows")
    print("="*60)
    # Output files
    with open(os.path.join(OUTPUT_DIR, "ppg_data.txt"), "w") as f:
        for ppg_value in all_ppg_data:
            f.write(f"{ppg_value}\n")
    with open(os.path.join(OUTPUT_DIR, "ppg_window_data.txt"), "w") as f:
        for ppg_value in ppg_window_data_combined:
            f.write(f"{ppg_value}\n")
    with open(os.path.join(OUTPUT_DIR, "ppg_peaks_data.txt"), "w") as f:
        for peak_index in ppg_peaks_data_combined:
            f.write(f"{peak_index}\n")

def main():
    # Optionally, allow user to specify file and duration
    import argparse
    parser = argparse.ArgumentParser(description="Analyze PPG file for HRV (offline mode)")
    parser.add_argument('--file', type=str, default=INPUT_FILE, help='Path to PPG data file')
    parser.add_argument('--duration', type=int, default=None, help='Duration in seconds to process (optional)')
    args = parser.parse_args()
    collect_and_analyze_hrv_from_file(args.file, args.duration)

if __name__ == "__main__":
    main()
