import serial
import serial.tools.list_ports
import time
from datetime import datetime

# Configuration
SERIAL_PORT = 'COM5'  # Change to your Arduino port
BAUD_RATE = 9600
OUTPUT_FILE = 'serial_output.txt'
DURATION_SECONDS = 60  # How long to record (0 = infinite, Ctrl+C to stop)

def capture_serial_to_txt(port, baudrate, output_file, duration=0):
    """
    Capture all serial data from Arduino and save to text file
    
    Args:
        port: Serial port (e.g., 'COM5' or '/dev/ttyUSB0')
        baudrate: Baud rate (must match Arduino)
        output_file: Output text filename
        duration: Recording duration in seconds (0 for infinite)
    """
    ser = None
    try:
        # Open serial connection
        ser = serial.Serial(port, baudrate, timeout=1)
        time.sleep(2)  # Wait for Arduino to reset
        
        print(f"Connected to {port} at {baudrate} baud")
        print(f"Recording to {output_file}")
        if duration > 0:
            print(f"Recording for {duration} seconds...")
        else:
            print("Recording until Ctrl+C is pressed...")
        
        # Open output file
        with open(output_file, 'w', encoding='utf-8') as txtfile:
            # Write header with start time
            start_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            txtfile.write(f"Serial Monitor Capture Started: {start_timestamp}\n")
            txtfile.write(f"Port: {port} | Baud Rate: {baudrate}\n")
            txtfile.write("="*60 + "\n\n")
            
            start_time = time.time()
            line_count = 0
            
            while True:
                # Check duration limit
                if duration > 0 and (time.time() - start_time) > duration:
                    print("\nRecording complete!")
                    break
                
                # Read line from serial
                if ser.in_waiting > 0:
                    try:
                        line = ser.readline().decode('utf-8', errors='replace').strip()
                        
                        if line:
                            # Write timestamp and line to file
                            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
                            txtfile.write(f"[{timestamp}] {line}\n")
                            txtfile.flush()  # Ensure data is written immediately
                            
                            line_count += 1
                            # Print status every 10 lines
                            if line_count % 10 == 0:
                                print(f"Lines recorded: {line_count}", end='\r')
                    
                    except Exception as e:
                        # Log errors but continue
                        txtfile.write(f"[ERROR] {e}\n")
                        continue
        
        if ser:
            ser.close()
        
        end_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"\n\nData saved to {output_file}")
        print(f"Total lines recorded: {line_count}")
        
    except serial.SerialException as e:
        print(f"Error: Could not open serial port {port}")
        print(f"Details: {e}")
        print("\nAvailable ports:")
        ports = serial.tools.list_ports.comports()
        for p in ports:
            print(f"  {p.device}: {p.description}")
    
    except KeyboardInterrupt:
        print("\n\nRecording stopped by user")
        if ser:
            ser.close()
        print(f"Data saved to {output_file}")

if __name__ == "__main__":
    # Run the capture
    capture_serial_to_txt(SERIAL_PORT, BAUD_RATE, OUTPUT_FILE, DURATION_SECONDS)
    
    print("\n" + "="*50)
    print("Text file created successfully!")
    print(f"File: {OUTPUT_FILE}")
    print("="*50)