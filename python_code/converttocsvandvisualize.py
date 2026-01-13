import pandas as pd
import matplotlib.pyplot as plt
import re
from datetime import datetime
import numpy as np

# Configuration
INPUT_FILE = 'serial_output.txt'
OUTPUT_CSV = 'parsed_data.csv'

def parse_serial_output(input_file):
    """
    Parse serial_output.txt and extract data with forward-fill logic
    Each value holds until a new value arrives
    """
    data = []
    
    # Current state - holds last known values
    current_state = {
        'PolarRealtimeBPM': None,
        'PolarBPM': None,
        'PPGSignal': None
    }
    
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            # Skip header lines and empty lines
            if line.startswith('Serial Monitor') or line.startswith('Port:') or line.startswith('===') or not line.strip():
                continue
            
            # Skip non-data lines
            if 'Waiting for heart beat' in line or 'Heart beat detected' in line:
                continue
            
            # Extract timestamp and data
            match = re.match(r'\[([\d\-: .]+)\]\s+(.+)', line)
            if match:
                timestamp_str = match.group(1)
                data_str = match.group(2).strip()
                
                # Try to parse timestamp
                try:
                    timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S.%f')
                except:
                    continue
                
                # Parse different data formats
                # Format 1: >PPGSignal:438
                ppg_match = re.search(r'>PPGSignal:(\d+)', data_str)
                if ppg_match:
                    current_state['PPGSignal'] = int(ppg_match.group(1))
                
                # Format 2: >PolarRealtimeBPM:63,PolarBPM:64
                polar_match = re.search(r'>PolarRealtimeBPM:(\d+),PolarBPM:(\d+)', data_str)
                if polar_match:
                    current_state['PolarRealtimeBPM'] = int(polar_match.group(1))
                    current_state['PolarBPM'] = int(polar_match.group(2))
                
                # Record current state with timestamp
                data.append({
                    'SystemTime': timestamp,
                    'PolarRealtimeBPM': current_state['PolarRealtimeBPM'],
                    'PolarBPM': current_state['PolarBPM'],
                    'PPGSignal': current_state['PPGSignal']
                })
    
    return pd.DataFrame(data)

def create_overlay_visualization(df):
    """
    Create a dual-axis overlay plot showing PPG signal with Polar Realtime BPM
    """
    print("\nGenerating PPG + BPM overlay visualization...")
    
    # Calculate time in seconds from start
    df['TimeSeconds'] = (df['SystemTime'] - df['SystemTime'].iloc[0]).dt.total_seconds()
    
    # Filter data where both PPG and BPM exist
    ppg_data = df[df['PPGSignal'].notna()].copy()
    bpm_data = df[df['PolarRealtimeBPM'].notna()].copy()
    
    if ppg_data.empty or bpm_data.empty:
        print("Warning: Missing PPG or BPM data. Cannot create overlay.")
        return
    
    # Create figure with dual y-axes
    fig, ax1 = plt.subplots(figsize=(16, 8))
    fig.suptitle('PPG Signal with Realtime BPM Overlay', fontsize=16, fontweight='bold')
    
    # Plot PPG signal on primary y-axis
    color_ppg = 'steelblue'
    ax1.set_xlabel('Time (seconds)', fontsize=13)
    ax1.set_ylabel('PPG Signal (raw)', fontsize=13, color=color_ppg)
    line1 = ax1.plot(ppg_data['TimeSeconds'], ppg_data['PPGSignal'], 
                     linewidth=0.8, color=color_ppg, alpha=0.7, label='PPG Signal')
    ax1.tick_params(axis='y', labelcolor=color_ppg)
    ax1.grid(True, alpha=0.3, linestyle='--')
    
    # Create secondary y-axis for BPM
    ax2 = ax1.twinx()
    color_bpm = 'crimson'
    ax2.set_ylabel('Heart Rate (BPM)', fontsize=13, color=color_bpm)
    line2 = ax2.plot(bpm_data['TimeSeconds'], bpm_data['PolarRealtimeBPM'], 
                     marker='o', linestyle='-', linewidth=2.5, markersize=5, 
                     color=color_bpm, label='Polar Realtime BPM', alpha=0.8)
    ax2.tick_params(axis='y', labelcolor=color_bpm)
    
    # Add combined legend
    lines = line1 + line2
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc='upper left', fontsize=11, framealpha=0.9)
    
    # Add data info text box
    info_text = f'PPG Samples: {len(ppg_data):,}\nBPM Samples: {len(bpm_data):,}\nDuration: {ppg_data["TimeSeconds"].max():.1f}s'
    ax1.text(0.98, 0.02, info_text, transform=ax1.transAxes, 
             fontsize=10, verticalalignment='bottom', horizontalalignment='right',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    plt.tight_layout()
    
    # Save the figure
    plt.savefig('ppg_bpm_overlay.png', dpi=300, bbox_inches='tight')
    print("✓ Overlay visualization saved to ppg_bpm_overlay.png")
    
    plt.show()

def create_csv_and_visualize(input_file, output_csv):
    """
    Parse serial output, create CSV, and generate all visualizations including overlays
    """
    print(f"Parsing {input_file}...")
    df = parse_serial_output(input_file)
    
    if df.empty:
        print("No data found in the input file!")
        return
    
    # Save to CSV
    df.to_csv(output_csv, index=False)
    print(f"CSV saved to {output_csv}")
    print(f"Total records: {len(df)}")
    
    # Display first few rows
    print("\nFirst 10 rows:")
    print(df.head(10))
    
    # Display data summary
    print("\nData Summary:")
    print(df.describe())
    
    # Count non-null values
    print("\nData availability:")
    print(f"PPG readings: {df['PPGSignal'].notna().sum()}")
    print(f"Polar Realtime BPM readings: {df['PolarRealtimeBPM'].notna().sum()}")
    print(f"Polar BPM readings: {df['PolarBPM'].notna().sum()}")
    
    # Create original visualizations
    print("\nGenerating original visualizations...")
    
    # Calculate time in seconds from start
    df['TimeSeconds'] = (df['SystemTime'] - df['SystemTime'].iloc[0]).dt.total_seconds()
    
    # Create figure with subplots
    fig, axes = plt.subplots(3, 1, figsize=(14, 10))
    fig.suptitle('Serial Data Visualization', fontsize=16, fontweight='bold')
    
    # Plot 1: PPG Signal (high frequency data)
    ax1 = axes[0]
    ppg_data = df[df['PPGSignal'].notna()]
    if not ppg_data.empty:
        ax1.plot(ppg_data['TimeSeconds'], ppg_data['PPGSignal'], 
                linewidth=0.5, color='blue', alpha=0.7)
        ax1.set_ylabel('PPG Signal', fontsize=12)
        ax1.set_title(f'PPG Signal Over Time (n={len(ppg_data)} samples)', fontsize=12)
        ax1.grid(True, alpha=0.3)
    else:
        ax1.text(0.5, 0.5, 'No PPG data', ha='center', va='center', transform=ax1.transAxes)
    
    # Plot 2: Polar Realtime BPM
    ax2 = axes[1]
    polar_rt_data = df[df['PolarRealtimeBPM'].notna()]
    if not polar_rt_data.empty:
        ax2.plot(polar_rt_data['TimeSeconds'], polar_rt_data['PolarRealtimeBPM'], 
                marker='o', linestyle='-', linewidth=1.5, markersize=4, 
                color='red', label='Realtime BPM')
        ax2.set_ylabel('Heart Rate (BPM)', fontsize=12)
        ax2.set_title(f'Polar Realtime Heart Rate (n={len(polar_rt_data)} samples)', fontsize=12)
        ax2.legend(loc='upper right')
        ax2.grid(True, alpha=0.3)
    else:
        ax2.text(0.5, 0.5, 'No Polar Realtime BPM data', ha='center', va='center', transform=ax2.transAxes)
    
    # Plot 3: Polar BPM
    ax3 = axes[2]
    polar_bpm_data = df[df['PolarBPM'].notna()]
    if not polar_bpm_data.empty:
        ax3.plot(polar_bpm_data['TimeSeconds'], polar_bpm_data['PolarBPM'], 
                marker='s', linestyle='-', linewidth=1.5, markersize=4, 
                color='green', label='Polar BPM')
        ax3.set_ylabel('Heart Rate (BPM)', fontsize=12)
        ax3.set_xlabel('Time (seconds)', fontsize=12)
        ax3.set_title(f'Polar Heart Rate (n={len(polar_bpm_data)} samples)', fontsize=12)
        ax3.legend(loc='upper right')
        ax3.grid(True, alpha=0.3)
    else:
        ax3.text(0.5, 0.5, 'No Polar BPM data', ha='center', va='center', transform=ax3.transAxes)
    
    plt.tight_layout()
    
    # Save the figure
    plt.savefig('data_visualization.png', dpi=300, bbox_inches='tight')
    print("✓ Original visualization saved to data_visualization.png")
    
    # Show the plot
    plt.show()
    
    # Create additional combined plot for heart rate comparison
    if not polar_rt_data.empty and not polar_bpm_data.empty:
        fig2, ax = plt.subplots(figsize=(14, 6))
        ax.plot(polar_rt_data['TimeSeconds'], polar_rt_data['PolarRealtimeBPM'], 
               marker='o', linestyle='-', linewidth=1, markersize=3, 
               color='red', label='Realtime BPM', alpha=0.7)
        ax.plot(polar_bpm_data['TimeSeconds'], polar_bpm_data['PolarBPM'], 
               marker='s', linestyle='-', linewidth=2, markersize=4, 
               color='green', label='Polar BPM')
        ax.set_xlabel('Time (seconds)', fontsize=12)
        ax.set_ylabel('Heart Rate (BPM)', fontsize=12)
        ax.set_title('Polar Heart Rate Comparison', fontsize=14, fontweight='bold')
        ax.legend(loc='upper right', fontsize=10)
        ax.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig('heart_rate_comparison.png', dpi=300, bbox_inches='tight')
        print("✓ Heart rate comparison saved to heart_rate_comparison.png")
        plt.show()
    
    # NEW: Create overlay visualizations
    print("\n" + "="*60)
    print("Creating NEW overlay visualizations...")
    print("="*60)
    
    create_overlay_visualization(df)

if __name__ == "__main__":
    create_csv_and_visualize(INPUT_FILE, OUTPUT_CSV)
    
    print("\n" + "="*60)
    print("Processing complete!")
    print("="*60)
    print(f"CSV: {OUTPUT_CSV}")
    print("\nOriginal visualizations:")
    print("  - data_visualization.png")
    print("  - heart_rate_comparison.png")
    print("\nNEW overlay visualizations:")
    print("  - ppg_bpm_overlay.png (dual-axis overlay)")
    print("="*60)
