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


def calculate_hrv_rmssd(ppg_window, sampling_rate=60):
    """
    Calculate HRV using RMSSD from PPG signal
    
    Args:
        ppg_window: Array of PPG signal values
        sampling_rate: Sampling rate in Hz (default 60)
    
    Returns:
        RMSSD value in ms, or None if calculation fails
    """
    if len(ppg_window) < sampling_rate * 10:  # Need at least 10 seconds
        return None
    
    try:
        # Process PPG signal to extract heart rate variability
        signals, info = nk.ppg_process(ppg_window, sampling_rate=sampling_rate)
        
        # Calculate HRV metrics
        hrv_metrics = nk.ppg_intervalrelated(signals, sampling_rate=sampling_rate)
        
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


def collect_and_analyze_hrv(serial_port, duration, baud_rate=9600):
    """
    Main function to collect PPG data and perform real-time HRV analysis
    
    Uses rolling 30-second windows, updating every 10 seconds
    """
    SAMPLING_RATE = 100  # Approximate sampling rate (Hz)
    WINDOW_SIZE_SEC = 30
    UPDATE_INTERVAL_SEC = 10
    
    window_size_samples = WINDOW_SIZE_SEC * SAMPLING_RATE
    update_interval_samples = UPDATE_INTERVAL_SEC * SAMPLING_RATE
    
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
        all_ppg_data = []  # Store all data
        
        start_time = time.time()
        last_calculation_time = 0
        previous_rmssd = None
        window_count = 0
        sample_count = 0
        
        # Track status counts for summary
        status_counts = {0: 0, 1: 0, 2: 0}
        
        while True:
            elapsed_time = time.time() - start_time
            
            # Check if duration is complete
            if elapsed_time > duration:
                print("\n\nRecording complete!")
                break
            
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
                            print(f"Samples collected: {sample_count} | Time: {elapsed_time:.1f}s", end='\r')
                
                except Exception as e:
                    continue
            
            # Perform HRV calculation every 10 seconds (after initial 30 seconds)
            if (elapsed_time >= WINDOW_SIZE_SEC and 
                elapsed_time - last_calculation_time >= UPDATE_INTERVAL_SEC and
                len(ppg_buffer) >= window_size_samples * 0.8):  # Allow 20% tolerance
                
                window_count += 1
                last_calculation_time = elapsed_time
                
                # Calculate HRV for current window
                ppg_window = np.array(ppg_buffer)
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


if __name__ == "__main__":
    main()