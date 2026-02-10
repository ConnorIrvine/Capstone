import time
import re
from datetime import datetime
from collections import deque
import numpy as np
import neurokit2 as nk
import warnings
import sys

# Suppress all warnings from neurokit2 and pandas
warnings.filterwarnings('ignore')


class DualOutput:
    """Write to both console and file"""
    def __init__(self, filename):
        self.terminal = sys.stdout
        self.log = open(filename, 'w', encoding='utf-8')
    
    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)
    
    def flush(self):
        self.terminal.flush()
        self.log.flush()
    
    def close(self):
        self.log.close()


def get_user_input():
    """Get recording parameters from user"""
    print("\n" + "="*60)
    print("HRV MONITORING SYSTEM - Meditation Feedback (TEST MODE)")
    print("="*60)
    
    # Get duration
    print("\nReading from: serial_output.txt")
    duration_input = input("\nEnter max duration to simulate in seconds (e.g., 180): ").strip()
    try:
        duration = int(duration_input)
        if duration < 30:
            print("Duration must be at least 30 seconds for HRV calculation!")
            return None, None, None
        sim_speed = input("\nSimulation speed multiplier (1=realtime, 10=10x faster, press Enter for 10): ").strip()
        sim_speed = float(sim_speed) if sim_speed else 10.0
        sampling_rate = input("\nEnter sampling rate in Hz (press Enter for 100): ").strip()
        sampling_rate = int(sampling_rate) if sampling_rate else 100

    except ValueError:
        print("Invalid input!")
        return None, None, None
    
    return duration, sim_speed, sampling_rate


def parse_serial_line(line):
    """
    Parse a line from serial_output.txt
    Returns: (timestamp, ppg_value) or (None, None) if not parseable
    """
    # Format: [2026-01-13 17:44:38.783] >PPGSignal:523
    match = re.match(r'\[([\d\-: .]+)\]\s+(.+)', line)
    if not match:
        return None, None
    
    timestamp_str = match.group(1)
    data_str = match.group(2).strip()
    
    # Extract PPG signal
    ppg_match = re.search(r'>PPGSignal:(\d+)', data_str)
    if not ppg_match:
        return None, None
    
    try:
        timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S.%f')
        ppg_value = int(ppg_match.group(1))
        return timestamp, ppg_value
    except:
        return None, None


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
    
    try:
        # Process PPG signal to find peaks
        signals, info = nk.ppg_process(ppg_window, sampling_rate=sampling_rate)
        
        # Extract peaks for HRV calculation
        peaks = info["PPG_Peaks"]
        
        # Calculate only time-domain HRV metrics (including RMSSD)
        # This avoids the non-linear metrics that require longer windows
        hrv_metrics = nk.hrv_time(peaks, sampling_rate=sampling_rate, show=False)
        
        # Extract RMSSD (Root Mean Square of Successive Differences)
        rmssd = hrv_metrics['HRV_RMSSD'].values[0]
        
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


def simulate_realtime_analysis(input_file, duration, sim_speed=10.0, sampling_rate=100):
    """
    Simulate real-time HRV analysis by reading from serial_output.txt
    
    Args:
        input_file: Path to serial_output.txt
        duration: Maximum duration to simulate in seconds
        sim_speed: Speed multiplier (1.0 = realtime, 10.0 = 10x faster)
        sampling_rate: Sampling rate in Hz
    """
    WINDOW_SIZE_SEC = 30
    UPDATE_INTERVAL_SEC = 10
    
    window_size_samples = WINDOW_SIZE_SEC * sampling_rate
    
    try:
        print(f"\n{'='*60}")
        print(f"Reading from: {input_file}")
        print(f"Simulating {duration} seconds at {sim_speed}x speed")
        print(f"Sampling rate: {sampling_rate} Hz")
        print(f"HRV calculated every 10 seconds using 30-second windows")
        print(f"{'='*60}")
        print("\nStatus Colors:")
        print("  GREEN (✓)  - HRV improving")
        print("  YELLOW (~) - Minor decrease (< 5ms)")
        print("  RED (✗)    - Significant decrease (≥ 5ms)")
        print(f"{'='*60}")
        print("\nCollecting initial data (30 seconds)...\n")
        
        # Data structures
        ppg_buffer = deque(maxlen=window_size_samples)  # Sliding window
        all_ppg_data = []  # Store all data
        
        start_time = time.time()
        simulation_start_time = None
        last_calculation_time = 0
        previous_rmssd = None
        window_count = 0
        sample_count = 0
        
        # Track status counts for summary
        status_counts = {0: 0, 1: 0, 2: 0}
        
        # Read file
        with open(input_file, 'r', encoding='utf-8') as f:
            for line in f:
                # Parse line
                timestamp, ppg_value = parse_serial_line(line)
                
                if ppg_value is None:
                    continue
                
                # Set simulation start time from first data point
                if simulation_start_time is None:
                    simulation_start_time = timestamp
                
                # Calculate elapsed time in simulation
                sim_elapsed = (timestamp - simulation_start_time).total_seconds()
                
                # Check if we've exceeded duration
                if sim_elapsed > duration:
                    print("\n\nSimulation duration reached!")
                    break
                
                # Simulate timing (sleep to match real-time speed)
                real_elapsed = time.time() - start_time
                expected_real_time = sim_elapsed / sim_speed
                sleep_time = expected_real_time - real_elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)
                
                # Add data to buffer
                ppg_buffer.append(ppg_value)
                all_ppg_data.append(ppg_value)
                sample_count += 1
                
                # Print progress
                if sample_count % 100 == 0:
                    print(f"Samples: {sample_count} | Sim Time: {sim_elapsed:.1f}s | Real Time: {(time.time()-start_time):.1f}s", end='\r')
                
                # Perform HRV calculation every 10 seconds (after initial 30 seconds)
                if (sim_elapsed >= WINDOW_SIZE_SEC and 
                    sim_elapsed - last_calculation_time >= UPDATE_INTERVAL_SEC and
                    len(ppg_buffer) >= window_size_samples * 0.8):  # Allow 20% tolerance
                    
                    window_count += 1
                    last_calculation_time = sim_elapsed
                    
                    # Calculate HRV for current window
                    ppg_window = np.array(ppg_buffer)
                    current_rmssd = calculate_hrv_rmssd(ppg_window, sampling_rate)
                    
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
        
    except FileNotFoundError:
        print(f"\nError: Could not find file '{input_file}'")
        print("Make sure serial_output.txt exists in the current directory.")
    
    except KeyboardInterrupt:
        print("\n\nSimulation stopped by user")
    
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Main entry point"""
    INPUT_FILE = 'serial_output.txt'
    OUTPUT_FILE = 'results.txt'
    
    # Get user input (before redirecting output)
    duration, sim_speed, sampling_rate = get_user_input()
    
    if duration is None:
        print("\nExiting...")
        return
    
    # Confirm settings
    print(f"\n{'='*60}")
    print("CONFIGURATION")
    print(f"{'='*60}")
    print(f"Input File: {INPUT_FILE}")
    print(f"Duration: {duration} seconds ({duration/60:.1f} minutes)")
    print(f"Simulation Speed: {sim_speed}x realtime")
    print(f"Sampling Rate: {sampling_rate} Hz")
    print(f"Output will be saved to: {OUTPUT_FILE}")
    print(f"{'='*60}")
    
    confirm = input("\nStart simulation? (y/n): ").strip().lower()
    if confirm != 'y':
        print("Cancelled.")
        return
    
    # Redirect output to both console and file
    dual_output = DualOutput(OUTPUT_FILE)
    original_stdout = sys.stdout
    sys.stdout = dual_output
    
    try:
        # Start simulation
        simulate_realtime_analysis(INPUT_FILE, duration, sim_speed, sampling_rate)
        
        print("\nSimulation complete. Thank you!")
        print(f"\nResults saved to: {OUTPUT_FILE}")
        
    finally:
        # Restore original stdout
        sys.stdout = original_stdout
        dual_output.close()
        print(f"\nResults saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()