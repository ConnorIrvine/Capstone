import time
from collections import deque
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from pathlib import Path

PPG_FILE = Path("ppg_window_data.txt")
PEAKS_FILE = Path("ppg_peaks_data.txt")

SAMPLING_RATE = 100
WINDOW_SECONDS = 30
WINDOW_SAMPLES = SAMPLING_RATE * WINDOW_SECONDS

# Rolling window for signal
ppg_window = deque(maxlen=WINDOW_SAMPLES)

# Track total samples read (absolute index)
total_samples = 0

# Peak indices (absolute indices)
peak_indices = []

# File read positions
ppg_pos = 0
peaks_pos = 0


def read_new_lines(path, last_pos):
    if not path.exists():
        return [], last_pos
    with path.open("r") as f:
        f.seek(last_pos)
        lines = f.readlines()
        last_pos = f.tell()
    return lines, last_pos


def update(_):
    global ppg_pos, peaks_pos, total_samples, peak_indices

    # Read new PPG samples
    ppg_lines, ppg_pos = read_new_lines(PPG_FILE, ppg_pos)
    for line in ppg_lines:
        line = line.strip()
        if not line:
            continue
        try:
            val = float(line)
        except ValueError:
            continue
        ppg_window.append(val)
        total_samples += 1

    # Read new peak indices
    peak_lines, peaks_pos = read_new_lines(PEAKS_FILE, peaks_pos)
    for line in peak_lines:
        line = line.strip()
        if not line:
            continue
        try:
            idx = int(line)
        except ValueError:
            continue
        peak_indices.append(idx)

    # Prune old peak indices to keep memory small
    if len(ppg_window) > 0:
        start_index = total_samples - len(ppg_window)
        peak_indices = [i for i in peak_indices if i >= start_index]

    # Update plot
    if len(ppg_window) == 0:
        return line_plot, peak_plot

    y = np.array(ppg_window)
    x = np.arange(len(y))

    line_plot.set_data(x, y)

    # Plot peaks within the current window
    start_index = total_samples - len(ppg_window)
    in_window = [i for i in peak_indices if start_index <= i < start_index + len(ppg_window)]
    peak_x = np.array([i - start_index for i in in_window], dtype=int)
    peak_y = y[peak_x] if len(peak_x) else np.array([])

    peak_plot.set_data(peak_x, peak_y)

    ax.set_xlim(0, max(len(y), 1))
    if len(y) > 0:
        ax.set_ylim(y.min() - 50, y.max() + 50)

    return line_plot, peak_plot


# Wait for files to exist
while not PPG_FILE.exists():
    print("Waiting for ppg_window_data.txt...")
    time.sleep(0.5)

# Plot setup
fig, ax = plt.subplots(figsize=(10, 5))
ax.set_title("PPG Window Data (Real-Time) with Peaks")
ax.set_xlabel("Samples (window)")
ax.set_ylabel("PPG Value")

line_plot, = ax.plot([], [], color="blue", linewidth=1)
peak_plot, = ax.plot([], [], "ro", markersize=4)

ani = FuncAnimation(fig, update, interval=100, blit=True)
plt.tight_layout()
plt.show()