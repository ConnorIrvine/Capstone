import serial
import serial.tools.list_ports
import time
import re
from datetime import datetime
from collections import deque
import numpy as np
import neurokit2 as nk
import warnings

# Suppress all warnings from neurokit2 and pandas
warnings.filterwarnings('ignore')

def list_available_ports():
    """List all available serial ports"""
    ports = serial.tools.list_ports.comports()
    if not ports:
        print("No serial ports found!")
        return []
    
    print("\nAvailable serial ports:")
    for i, port in enumerate(ports):
        print(f"  {i+1}. {port.device}: {port.description}")
    return [p.device for p in ports]


def get_user_input():
    """Get recording parameters from user"""
    print("\n" + "="*60)
    print("HRV MONITORING SYSTEM - Meditation Feedback")
    print("="*60)
    
    # Get serial port
    available_ports = list_available_ports()
    if not available_ports:
        return None, None, None
    
    port_choice = input(f"\nSelect port number (1-{len(available_ports)}): ").strip()
    try:
        port_idx = int(port_choice) - 1
        if port_idx < 0 or port_idx >= len(available_ports):
            print("Invalid port selection!")
            return None, None, None
        serial_port = available_ports[port_idx]
    except ValueError:
        # Allow direct port entry
        serial_port = port_choice
    
    # Get duration
    duration_input = input("\nEnter recording duration in seconds (e.g., 180 for 3 minutes): ").strip()
    try:
        duration = int(duration_input)
        if duration < 30:
            print("Duration must be at least 30 seconds for HRV calculation!")
            return None, None, None
    except ValueError:
        print("Invalid duration!")
        return None, None, None
    
    # Get baud rate (default 9600)
    baud_input = input("\nEnter baud rate (press Enter for 9600): ").strip()
    baud_rate = int(baud_input) if baud_input else 9600
    
    return serial_port, duration, baud_rate


def parse_ppg_signal(line):
    """Extract PPG signal value from serial line"""
    # Format: 438
    ppg_match = re.search(r'(\d+)', line)
    if ppg_match:
        return int(ppg_match.group(1))
    return None


def calculate_hrv_rmssd(ppg_window, sampling_rate=100):
    """
    Calculate HRV using RMSSD from PPG signal
    
    Args:
        ppg_window: Array of PPG signal values
        sampling_rate: Sampling rate in Hz (default 100)
    
    Returns:
        RMSSD value in ms, or None if calculation fails
    """
    if len(ppg_window) < sampling_rate * 10:  # Need at least 10 seconds
        return None

    global appended_samples

    # Add first 30 seconds, then only the newest 10 seconds each update
    step_samples = sampling_rate * 10
    if appended_samples == 0:
        new_samples = ppg_window
    else:
        new_samples = ppg_window[-step_samples:]

    ppg_window_data_combined.extend(new_samples)
    appended_samples += len(new_samples)

    try:
        # Process PPG signal to extract heart rate variability
        signals, info = nk.ppg_process(ppg_window, sampling_rate=sampling_rate)
        
        # Calculate HRV metrics
        hrv_metrics = nk.ppg_intervalrelated(signals, sampling_rate=sampling_rate)
        
        # Extract RMSSD (Root Mean Square of Successive Differences)
        rmssd = hrv_metrics['HRV_RMSSD'].values[0]

        # Deal with the peaks
        if 'PPG_Peaks' in signals:
            peaks_indices = np.where(signals['PPG_Peaks'] == 1)[0]
        else:
            peaks_indices = np.array([])

        # Offset peaks by absolute index of window start
        window_start_index = appended_samples - len(ppg_window)
        peaks_indices = [i + window_start_index for i in peaks_indices]
        ppg_peaks_data_combined.extend(peaks_indices)
        
        return rmssd
    except Exception as e:
        print(f"\n[WARNING] HRV calculation failed: {e}")
        return None


def check_hrv_status(current_rmssd, previous_rmssd):
    """
    Determine HRV status based on change from previous measurement
    
    Returns:
        0: Better (improvement) - GREEN
        1: Drops less than 5ms - YELLOW
        2: Drops 5ms or more - RED
    
    Args:
        current_rmssd: Current window RMSSD value
        previous_rmssd: Previous window RMSSD value
    
    Returns:
        Integer: 0, 1, or 2 representing status
    """
    if previous_rmssd is None or current_rmssd is None:
        return 1  # Default to yellow if no previous data
    
    # Calculate change (current - previous)
    change = current_rmssd - previous_rmssd
    
    if change >= 0:
        # Improved or stayed the same
        return 0  # GREEN
    elif change > -5:
        # Dropped but less than 5ms
        return 1  # YELLOW
    else:
        # Dropped 5ms or more
        return 2  # RED


def display_feedback(status, current_rmssd, previous_rmssd, window_number):
    """
    Display visual feedback to user with color-coded status
    
    Args:
        status: 0 (green), 1 (yellow), or 2 (red)
        current_rmssd: Current RMSSD value
        previous_rmssd: Previous RMSSD value
        window_number: Current window number
    """
    # Define status information
    status_info = {
        0: {"symbol": "✓", "color": "GREEN", "message": "EXCELLENT - HRV IMPROVING"},
        1: {"symbol": "~", "color": "YELLOW", "message": "GOOD - SLIGHT DECREASE"},
        2: {"symbol": "✗", "color": "RED", "message": "REFOCUS - SIGNIFICANT DROP"}
    }
    
    info = status_info.get(status, status_info[1])
    
    # Calculate change
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
    """
    Quick SQI checks to detect bad 3s segments.
    Returns True if the segment is likely corrupted.
    """
    if len(segment) == 0:
        print("[DEBUG] Segment is empty")
        return True

    seg = np.asarray(segment, dtype=float)

    # Flatline / low variance
    if np.std(seg) < 1.0:
        print("[DEBUG] Segment failed flatline/low variance check")
        return True

    # Clipping / saturation (too many identical values)
    unique_ratio = len(np.unique(seg)) / len(seg)
    if unique_ratio < 0.02:
        print("[DEBUG] Segment failed clipping/saturation check")
        return True

    # Extreme jump check
    if np.max(np.abs(np.diff(seg))) > 2000:  # tweak if needed
        print("[DEBUG] Segment failed extreme jump check")
        return True

    # Peak plausibility (very rough)
    try:
        peaks, _ = nk.ppg_peaks(seg, sampling_rate=sampling_rate)
        if "PPG_Peaks" in peaks:
            peak_count = int(np.sum(peaks["PPG_Peaks"]))
        else:
            peak_count = 0

        # For 3s segment, expect roughly 2–6 peaks at 40–120 bpm
        if peak_count < 2 or peak_count > 6:
            print("[DEBUG] Segment failed peak plausibility check")
            return True
    except Exception:
        return True

    return False


def is_window_bad(ppg_window, sampling_rate, segment_sec=3, max_bad_segments=0):
    """
    Split window into 3s segments and flag if too many are bad.
    Default strict policy: if any segment is bad, window is bad.
    """
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


def collect_and_analyze_hrv(serial_port, duration, baud_rate=9600):
    """
    Main function to collect PPG data and perform real-time HRV analysis
    
    Uses rolling 30-second windows, updating every 10 seconds
    """
    SAMPLING_RATE = 100  # Approximate sampling rate (Hz)
    WINDOW_SIZE_SEC = 30
    UPDATE_INTERVAL_SEC = 10
    
    window_size_samples = WINDOW_SIZE_SEC * SAMPLING_RATE
    
    ser = None
    
    try:
        # Open serial connection
        ser = serial.Serial(serial_port, baud_rate, timeout=1)
        time.sleep(2)  # Wait for Arduino to reset
        
        print(f"\n{'='*60}")
        print(f"Connected to {serial_port} at {baud_rate} baud")
        print(f"Recording for {duration} seconds...")
        print(f"HRV calculated every 10 seconds using 30-second windows")
        print(f"{'='*60}")
        print("\nStatus Colors:")
        print("  GREEN (✓)  - HRV improving")
        print("  YELLOW (~) - Minor decrease (< 5ms)")
        print("  RED (✗)    - Significant decrease (≥ 5ms)")
        print(f"{'='*60}")
        print("\nCollecting initial data (30 seconds)...\n")
        
        # Data collection
        ppg_buffer = deque(maxlen=window_size_samples)  # Sliding window
        global all_ppg_data
        all_ppg_data = []  # Store all data
        global ppg_window_data_combined
        ppg_window_data_combined = []  # Store windowed data for analysis

        global ppg_peaks_data_combined
        ppg_peaks_data_combined = []  # Store peaks data for analysis

        global appended_samples
        appended_samples = 0
        
        last_calculation_time = 0.0
        previous_rmssd = None
        window_count = 0
        sample_count = 0
        
        # Track status counts for summary
        status_counts = {0: 0, 1: 0, 2: 0}
        
        while True:
            # Read PPG data from serial
            if ser.in_waiting > 0:
                try:
                    line = ser.readline().decode('utf-8', errors='replace').strip()
                    
                    # Extract PPG signal
                    ppg_value = parse_ppg_signal(line)
                    
                    if ppg_value is not None:
                        ppg_buffer.append(ppg_value)
                        all_ppg_data.append(ppg_value)
                        sample_count += 1
                        
                        # Print progress
                        if sample_count % 100 == 0:
                            data_time = sample_count / SAMPLING_RATE
                            print(f"Samples collected: {sample_count} | Time: {data_time:.1f}s", end='\r')
                
                except Exception:
                    continue
            
            # Use data-derived time so windows align with samples
            data_time = sample_count / SAMPLING_RATE
            
            # Perform HRV calculation every 10 seconds (after initial 30 seconds)
            if (data_time >= WINDOW_SIZE_SEC and 
                data_time - last_calculation_time >= UPDATE_INTERVAL_SEC and
                len(ppg_buffer) >= window_size_samples * 0.8):  # Allow 20% tolerance
                
                window_count += 1
                last_calculation_time = data_time
                
                # Calculate HRV for current window
                ppg_window = np.array(ppg_buffer)

                # Segment-based quality check (10 x 3s segments)
                if is_window_bad(ppg_window, SAMPLING_RATE, segment_sec=3, max_bad_segments=15):
                    print(f"\n[Window #{window_count}] Bad data detected (segment SQI). Skipping HRV.")
                    continue

                current_rmssd = calculate_hrv_rmssd(ppg_window, SAMPLING_RATE)
                
                if current_rmssd is not None:
                    # Check HRV status
                    status = check_hrv_status(current_rmssd, previous_rmssd)
                    
                    # Track status
                    status_counts[status] += 1
                    
                    # Display feedback
                    display_feedback(status, current_rmssd, previous_rmssd, window_count)
                    
                    # Update previous RMSSD
                    previous_rmssd = current_rmssd
                else:
                    print(f"\n[Window #{window_count}] Unable to calculate HRV")
            
            # Stop after all due windows are computed
            if data_time >= duration:
                print("\n\nRecording complete!")
                break
        
        # Close serial connection
        if ser:
            ser.close()
        
        # Final summary
        print("\n" + "="*60)
        print("SESSION SUMMARY")
        print("="*60)
        print(f"Total samples collected: {len(all_ppg_data)}")
        print(f"Total HRV windows analyzed: {window_count}")
        if previous_rmssd:
            print(f"Final RMSSD: {previous_rmssd:.2f} ms")
        print(f"\nStatus Distribution:")
        print(f"  GREEN (Improving):        {status_counts[0]} windows")
        print(f"  YELLOW (Minor decrease):  {status_counts[1]} windows")
        print(f"  RED (Significant drop):   {status_counts[2]} windows")
        print("="*60)
        
    except serial.SerialException as e:
        print(f"\nError: Could not open serial port {serial_port}")
        print(f"Details: {e}")
    
    except KeyboardInterrupt:
        print("\n\nRecording stopped by user")
        if ser:
            ser.close()
    
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        if ser:
            ser.close()


def main():
    """Main entry point"""
    # Get user input
    serial_port, duration, baud_rate = get_user_input()
    
    if serial_port is None:
        print("\nExiting...")
        return
    
    # Confirm settings
    print(f"\n{'='*60}")
    print("CONFIGURATION")
    print(f"{'='*60}")
    print(f"Port: {serial_port}")
    print(f"Baud Rate: {baud_rate}")
    print(f"Duration: {duration} seconds ({duration/60:.1f} minutes)")
    print(f"{'='*60}")
    
    confirm = input("\nStart recording? (y/n): ").strip().lower()
    if confirm != 'y':
        print("Cancelled.")
        return
    
    # Start collection and analysis
    collect_and_analyze_hrv(serial_port, duration, baud_rate)
    
    print("\nSession complete. Thank you!")

    # output the ppg data to a txt file
    with open("ppg_data.txt", "w") as f:
        for ppg_value in all_ppg_data:
            f.write(f"{ppg_value}\n")

    with open("ppg_window_data.txt", "w") as f:
        for ppg_value in ppg_window_data_combined:
            f.write(f"{ppg_value}\n")
    
    with open("ppg_peaks_data.txt", "w") as f:
        for peak_index in ppg_peaks_data_combined:
            f.write(f"{peak_index}\n")


if __name__ == "__main__":
    main()