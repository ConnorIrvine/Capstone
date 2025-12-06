import pandas as pd
import matplotlib.pyplot as plt

# Configuration
INPUT_CSV = 'parsed_data.csv'

def visualize_from_csv(csv_file):
    """
    Load CSV data and generate visualizations
    """
    print(f"Loading data from {csv_file}...")
    
    # Read CSV
    df = pd.read_csv(csv_file)
    
    # Convert SystemTime to datetime
    df['SystemTime'] = pd.to_datetime(df['SystemTime'])
    
    if df.empty:
        print("No data found in the CSV file!")
        return
    
    print(f"Total records loaded: {len(df)}")
    
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
    
    # Create visualizations
    print("\nGenerating visualizations...")
    
    # Calculate time in seconds from start
    df['TimeSeconds'] = (df['SystemTime'] - df['SystemTime'].iloc[0]).dt.total_seconds()
    
    # Create figure with subplots
    fig, axes = plt.subplots(3, 1, figsize=(14, 10))
    fig.suptitle('CSV Data Visualization', fontsize=16, fontweight='bold')
    
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
    print("Visualization saved to data_visualization.png")
    
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
        print("Heart rate comparison saved to heart_rate_comparison.png")
        plt.show()
    
    # Create PPG and Heart Rate overlay with dual y-axes
    if not ppg_data.empty and not polar_rt_data.empty:
        fig3, ax_ppg = plt.subplots(figsize=(14, 6))
        
        # Plot PPG on primary y-axis
        color_ppg = 'tab:blue'
        ax_ppg.set_xlabel('Time (seconds)', fontsize=12)
        ax_ppg.set_ylabel('PPG Signal', color=color_ppg, fontsize=12)
        ax_ppg.plot(ppg_data['TimeSeconds'], ppg_data['PPGSignal'], 
                   linewidth=0.5, color=color_ppg, alpha=0.6, label='PPG Signal')
        ax_ppg.tick_params(axis='y', labelcolor=color_ppg)
        ax_ppg.grid(True, alpha=0.3)
        
        # Create secondary y-axis for Heart Rate
        ax_hr = ax_ppg.twinx()
        color_hr = 'tab:red'
        ax_hr.set_ylabel('Heart Rate (BPM)', color=color_hr, fontsize=12)
        ax_hr.plot(polar_rt_data['TimeSeconds'], polar_rt_data['PolarRealtimeBPM'], 
                  marker='o', linestyle='-', linewidth=2, markersize=4, 
                  color=color_hr, label='Heart Rate (BPM)', alpha=0.8)
        ax_hr.tick_params(axis='y', labelcolor=color_hr)
        
        # Title
        ax_ppg.set_title('PPG Signal and Heart Rate Overlay (Dual Axes)', 
                        fontsize=14, fontweight='bold', pad=20)
        
        # Add legends
        lines1, labels1 = ax_ppg.get_legend_handles_labels()
        lines2, labels2 = ax_hr.get_legend_handles_labels()
        ax_ppg.legend(lines1 + lines2, labels1 + labels2, loc='upper left', fontsize=10)
        
        plt.tight_layout()
        plt.savefig('ppg_hr_overlay.png', dpi=300, bbox_inches='tight')
        print("PPG and Heart Rate overlay saved to ppg_hr_overlay.png")
        plt.show()

if __name__ == "__main__":
    visualize_from_csv(INPUT_CSV)
    
    print("\n" + "="*50)
    print("Visualization complete!")
    print("Plots: data_visualization.png, heart_rate_comparison.png, ppg_hr_overlay.png")
    print("="*50)