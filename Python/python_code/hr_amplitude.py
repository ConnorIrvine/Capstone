"""
HR Amplitude Monitoring - Real-time peak-to-trough HRV amplitude biofeedback.

Streams PPG data from BLE, filters into the HRV breathing band, detects
peaks/troughs adaptively, and outputs the peak-to-trough amplitude in real
time. Bad segments (detected via SQI) pause the amplitude calculation until
good data resumes.
"""

import os
import sys
import asyncio
import threading
import queue as queue_module
from bleak import BleakScanner, BleakClient
import time
from datetime import datetime
from collections import deque
import numpy as np
import neurokit2 as nk
from scipy.signal import butter, filtfilt, find_peaks
from scipy.fft import rfft, rfftfreq
import matplotlib
matplotlib.use('TkAgg')
import matplotlib.pyplot as plt
from matplotlib.widgets import Slider, Button
import warnings

warnings.filterwarnings('ignore')

# BLE settings
BLE_DEVICE_NAME = "NanoESP32_PPG"
TX_CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"


# ─────────────────────────────────────────────────────────────
# Utility classes
# ─────────────────────────────────────────────────────────────

class TeeStdout:
    def __init__(self, *streams):
        self.streams = streams

    def write(self, data):
        for stream in self.streams:
            stream.write(data)

    def flush(self):
        for stream in self.streams:
            stream.flush()


# ─────────────────────────────────────────────────────────────
# Real-time Adaptive HRV Biofeedback
# ─────────────────────────────────────────────────────────────

class RealTimeHRVAmplitude:
    """
    Low-latency peak-to-trough amplitude tracker.

    Works on raw PPG data directly — bandpass filters into the HRV breathing
    band, then detects peaks/troughs incrementally. Each call to `update()`
    processes only *new* samples and emits amplitude events as soon as a
    peak→trough pair is found.

    Call `reset_peak_state()` when a bad segment is detected to discard any
    partial peak context.
    """

    def __init__(self, fs=100):
        self.fs = fs

        # Bandpass for HRV breathing band (0.04 – 0.4 Hz)
        low = 0.04
        high = 0.4
        self.b, self.a = butter(
            2,
            [low / (fs / 2), high / (fs / 2)],
            btype='band'
        )

        self.last_peak_value = None
        self.amplitudes = []           # running list for smoothing
        self.paused = False
        # Track which buffer-absolute index we last processed up to
        self.last_processed_idx = -1

    def reset_peak_state(self):
        """Discard partial peak context (called on bad-segment detection)."""
        self.last_peak_value = None
        self.last_processed_idx = -1

    def estimate_breathing_freq(self, signal):
        n = len(signal)
        freqs = rfftfreq(n, 1 / self.fs)
        fft_vals = np.abs(rfft(signal))

        mask = (freqs >= 0.04) & (freqs <= 0.4)
        if np.sum(mask) == 0:
            return 0.1
        dominant_freq = freqs[mask][np.argmax(fft_vals[mask])]
        return dominant_freq if dominant_freq > 0 else 0.1

    def update(self, raw_ppg_buffer, buffer_start_global):
        """
        Incrementally process the rolling raw PPG buffer.

        Args:
            raw_ppg_buffer: numpy array of the current rolling PPG buffer
            buffer_start_global: the global sample index of buffer[0]

        Returns list of dicts with global-time amplitude events found since
        the last call.
        """
        buf = np.asarray(raw_ppg_buffer, dtype=float)
        n = len(buf)
        # Need at least 5 seconds for the bandpass to be usable
        if n < self.fs * 5:
            return []

        filtered = filtfilt(self.b, self.a, buf)

        dom_freq = self.estimate_breathing_freq(filtered)
        period = 1 / dom_freq
        period = np.clip(period, 3, 15)

        min_distance = int(self.fs * period * 0.5)
        prominence = max(np.std(filtered) * 0.5, 0.01)

        peaks, _ = find_peaks(filtered, distance=min_distance, prominence=prominence)
        troughs, _ = find_peaks(-filtered, distance=min_distance, prominence=prominence)

        events = sorted(
            [(i, 'peak') for i in peaks] +
            [(i, 'trough') for i in troughs]
        )

        feedback = []
        for local_idx, event_type in events:
            global_idx = buffer_start_global + local_idx
            # Skip events we already processed
            if global_idx <= self.last_processed_idx:
                continue

            value = filtered[local_idx]

            if event_type == 'peak':
                self.last_peak_value = value
                self.last_processed_idx = global_idx
            elif event_type == 'trough':
                self.last_processed_idx = global_idx
                if self.last_peak_value is not None:
                    amplitude = self.last_peak_value - value
                    if amplitude > 0.5:
                        self.amplitudes.append(amplitude)
                        smooth_amp = np.mean(self.amplitudes[-3:])
                        feedback.append({
                            'global_idx': global_idx,
                            'amplitude': smooth_amp,
                            'breathing_rate_bpm': dom_freq * 60
                        })
                    self.last_peak_value = None

        return feedback


# ─────────────────────────────────────────────────────────────
# Signal quality checks (from program.py)
# ─────────────────────────────────────────────────────────────

def is_segment_bad(segment, sampling_rate):
    if len(segment) == 0:
        return True
    seg = np.asarray(segment, dtype=float)
    if np.std(seg) < 1.0:
        return True
    unique_ratio = len(np.unique(seg)) / len(seg)
    if unique_ratio < 0.02:
        return True
    if np.max(np.abs(np.diff(seg))) > 2000:
        return True
    try:
        peaks, _ = nk.ppg_peaks(seg, sampling_rate=sampling_rate)
        if "PPG_Peaks" in peaks:
            peak_count = int(np.sum(peaks["PPG_Peaks"]))
        else:
            peak_count = 0
        if peak_count < 2 or peak_count > 6:
            return True
    except Exception:
        return True
    return False


# ─────────────────────────────────────────────────────────────
# BLE helpers (unchanged from program.py)
# ─────────────────────────────────────────────────────────────

def scan_ble_devices(timeout=10):
    async def _scan():
        print(f"\nScanning for BLE device '{BLE_DEVICE_NAME}'...")
        devices = await BleakScanner.discover(timeout=timeout, return_adv=True)
        found = []
        for dev, adv in devices.values():
            name = dev.name or adv.local_name or ""
            if name == BLE_DEVICE_NAME:
                found.append(dev)
                print(f"  Found: {name} ({dev.address}) RSSI={adv.rssi}")
        if not found:
            print("No PPG devices found!")
        return found
    return asyncio.run(_scan())


def parse_ppg_signal(line):
    try:
        values = [int(v.strip()) for v in line.split(',') if v.strip()]
        return values if values else None
    except ValueError:
        return None


def get_user_input():
    print("\n" + "=" * 60)
    print("HR AMPLITUDE MONITORING - Real-Time Biofeedback")
    print("=" * 60)

    devices = scan_ble_devices()
    if not devices:
        return None, None

    if len(devices) == 1:
        device = devices[0]
        print(f"\nAuto-selected device: {device.name} ({device.address})")
    else:
        print("\nMultiple devices found:")
        for i, dev in enumerate(devices):
            print(f"  {i + 1}. {dev.name} ({dev.address})")
        choice = input(f"\nSelect device number (1-{len(devices)}): ").strip()
        try:
            idx = int(choice) - 1
            if idx < 0 or idx >= len(devices):
                print("Invalid selection!")
                return None, None
            device = devices[idx]
        except ValueError:
            print("Invalid input!")
            return None, None

    duration_input = input(
        "\nEnter recording duration in seconds (e.g., 180 for 3 minutes): "
    ).strip()
    try:
        duration = int(duration_input)
        if duration < 30:
            print("Duration must be at least 30 seconds!")
            return None, None
    except ValueError:
        print("Invalid duration!")
        return None, None

    return device.address, duration


def _ble_stream_thread(device_address, data_queue, stop_event, connected_event):
    async def _run():
        try:
            async with BleakClient(device_address, timeout=20.0) as client:
                if not client.is_connected:
                    print("\nBLE connection failed!")
                    return

                connected_event.set()

                def on_notify(sender, data: bytearray):
                    txt = data.decode("utf-8", errors="ignore").strip()
                    for line in txt.split('\n'):
                        line = line.strip()
                        if line:
                            values = parse_ppg_signal(line)
                            if values:
                                for v in values:
                                    data_queue.put(v)

                await client.start_notify(TX_CHAR_UUID, on_notify)

                while not stop_event.is_set() and client.is_connected:
                    await asyncio.sleep(0.1)

                await client.stop_notify(TX_CHAR_UUID)
        except Exception as e:
            print(f"\nBLE error: {e}")

    asyncio.run(_run())


# ─────────────────────────────────────────────────────────────
# Main collection + real-time amplitude analysis
# ─────────────────────────────────────────────────────────────

def collect_and_analyze_amplitude(device_address, duration):
    SAMPLING_RATE = 100
    SEGMENT_SEC = 3
    SEGMENT_SAMPLES = SEGMENT_SEC * SAMPLING_RATE   # 300 samples per SQI check
    BUFFER_SEC = 10                                 # rolling buffer length
    BUFFER_SAMPLES = BUFFER_SEC * SAMPLING_RATE
    PROCESS_INTERVAL = 100                          # process every 1 s (100 samples)

    data_queue = queue_module.Queue()
    stop_event = threading.Event()
    connected_event = threading.Event()

    all_ppg_data = []
    all_detected_peaks = set()   # global sample indices of detected PPG peaks
    ppg_buffer = deque(maxlen=BUFFER_SAMPLES)

    tracker = RealTimeHRVAmplitude(fs=SAMPLING_RATE)

    # Real-time plot setup
    plt.ion()
    fig, (ax_hr, ax_amp, ax_bpm) = plt.subplots(3, 1, figsize=(12, 9), sharex=True)
    fig.suptitle('Real-Time HR Amplitude Biofeedback')

    hr_times = []
    hr_values = []
    amp_times = []
    amp_values = []
    bpm_values = []
    bad_segment_times = []

    line_hr, = ax_hr.plot([], [], 'g-o', markersize=3, label='Heart Rate')
    ax_hr.set_ylabel('Heart Rate (BPM)')
    ax_hr.legend(loc='upper left')
    ax_hr.grid(True, alpha=0.3)

    line_amp, = ax_amp.plot([], [], 'b-o', markersize=4, label='Amplitude')
    ax_amp.set_ylabel('Peak-to-Trough Amplitude')
    ax_amp.legend(loc='upper left')
    ax_amp.grid(True, alpha=0.3)

    line_bpm, = ax_bpm.plot([], [], 'r-x', markersize=4, label='Breathing Rate')
    ax_bpm.set_ylabel('Breathing Rate (BPM)')
    ax_bpm.set_xlabel('Time (s)')
    ax_bpm.legend(loc='upper left')
    ax_bpm.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.show(block=False)
    plt.pause(0.01)

    ble_thread = threading.Thread(
        target=_ble_stream_thread,
        args=(device_address, data_queue, stop_event, connected_event),
        daemon=True,
    )

    try:
        print(f"\n{'=' * 60}")
        print(f"Connecting to BLE device {device_address}...")
        ble_thread.start()

        if not connected_event.wait(timeout=30):
            print("Failed to connect within 30 seconds.")
            stop_event.set()
            return

        print(f"Connected! Recording for {duration}s")
        print(f"Processing every {PROCESS_INTERVAL / SAMPLING_RATE:.1f}s "
              f"on a {BUFFER_SEC}s rolling buffer")
        print(f"{'=' * 60}\n")

        sample_count = 0
        last_process_count = 0
        is_paused = False

        # Segment buffer for SQI checking
        segment_buffer = []
        need_plot_update = False

        while True:
            # Drain the BLE queue
            try:
                while True:
                    ppg_value = data_queue.get_nowait()
                    ppg_buffer.append(ppg_value)
                    all_ppg_data.append(ppg_value)
                    segment_buffer.append(ppg_value)
                    sample_count += 1

                    if sample_count % 100 == 0:
                        t = sample_count / SAMPLING_RATE
                        status = "PAUSED (bad signal)" if is_paused else "ACTIVE"
                        print(f"  Samples: {sample_count} | "
                              f"Time: {t:.1f}s | Status: {status}",
                              end='\r')

                    # ── Segment-level SQI check every 3 s ──
                    if len(segment_buffer) >= SEGMENT_SAMPLES:
                        seg = np.array(segment_buffer[-SEGMENT_SAMPLES:])
                        segment_buffer = segment_buffer[-SEGMENT_SAMPLES:]

                        if is_segment_bad(seg, SAMPLING_RATE):
                            if not is_paused:
                                t = sample_count / SAMPLING_RATE
                                print(f"\n[{t:.1f}s] !! BAD SEGMENT detected — "
                                      f"amplitude tracking PAUSED")
                                bad_segment_times.append(t)
                                is_paused = True
                                tracker.paused = True
                                tracker.reset_peak_state()
                        else:
                            if is_paused:
                                t = sample_count / SAMPLING_RATE
                                print(f"\n[{t:.1f}s] Signal recovered — "
                                      f"amplitude tracking RESUMED")
                                is_paused = False
                                tracker.paused = False

            except queue_module.Empty:
                pass

            time.sleep(0.01)

            data_time = sample_count / SAMPLING_RATE

            # ── Process every PROCESS_INTERVAL samples (~1 s) ──
            if (sample_count - last_process_count >= PROCESS_INTERVAL
                    and len(ppg_buffer) >= SAMPLING_RATE * 5
                    and not is_paused):

                last_process_count = sample_count
                buf_array = np.array(ppg_buffer)
                # Global index of buffer[0]
                buffer_start = sample_count - len(buf_array)

                # ── Heart rate from PPG peaks ──
                try:
                    ppg_peaks, _ = find_peaks(
                        buf_array,
                        distance=int(SAMPLING_RATE * 0.4),   # min ~150 bpm
                        prominence=np.std(buf_array) * 0.3
                    )
                    # Store detected peaks as global indices
                    for pk in ppg_peaks:
                        all_detected_peaks.add(buffer_start + pk)

                    if len(ppg_peaks) >= 2:
                        ibi = np.diff(ppg_peaks) / SAMPLING_RATE  # seconds
                        ibi = ibi[(ibi > 0.3) & (ibi < 2.0)]     # 30-200 bpm
                        if len(ibi) > 0:
                            avg_hr = 60.0 / np.mean(ibi)
                            t_hr = sample_count / SAMPLING_RATE
                            hr_times.append(t_hr)
                            hr_values.append(avg_hr)
                            need_plot_update = True
                except Exception:
                    pass

                # ── Amplitude from breathing-band peaks/troughs ──
                try:
                    results = tracker.update(buf_array, buffer_start)

                    for item in results:
                        t_event = item['global_idx'] / SAMPLING_RATE
                        amp = item['amplitude']
                        bpm = item['breathing_rate_bpm']

                        amp_times.append(t_event)
                        amp_values.append(amp)
                        bpm_values.append(bpm)
                        need_plot_update = True

                        latest_hr = hr_values[-1] if hr_values else 0
                        print(f"\n  >> HR: {latest_hr:.0f} bpm | "
                              f"Amplitude: {amp:.2f} | "
                              f"Breathing Rate: {bpm:.1f} bpm | "
                              f"Time: {t_event:.1f}s")

                except Exception as e:
                    print(f"\n[Processing error] {e}")

            # ── Update plot when we have new data ──
            if need_plot_update:
                need_plot_update = False
                line_hr.set_data(hr_times, hr_values)
                line_amp.set_data(amp_times, amp_values)
                line_bpm.set_data(amp_times, bpm_values)

                for ax in (ax_hr, ax_amp, ax_bpm):
                    ax.relim()
                    ax.autoscale_view()

                for bt in bad_segment_times:
                    for ax in (ax_hr, ax_amp, ax_bpm):
                        ax.axvline(bt, color='gray', alpha=0.3,
                                   linestyle='--', linewidth=0.8)
                bad_segment_times.clear()

                fig.canvas.draw_idle()
                fig.canvas.flush_events()
                plt.pause(0.001)

            # ── Check termination ──
            if data_time >= duration:
                print("\n\nRecording complete!")
                break

            if not ble_thread.is_alive():
                print("\n\nBLE connection lost!")
                break

        stop_event.set()
        ble_thread.join(timeout=5)

        # ── Final summary ──
        print(f"\n{'=' * 60}")
        print("SESSION SUMMARY")
        print(f"{'=' * 60}")
        print(f"Total samples: {len(all_ppg_data)}")
        print(f"Amplitude events: {len(amp_values)}")
        if hr_values:
            print(f"Mean heart rate: {np.mean(hr_values):.1f} bpm")
            print(f"Min heart rate:  {np.min(hr_values):.1f} bpm")
            print(f"Max heart rate:  {np.max(hr_values):.1f} bpm")
        if amp_values:
            print(f"Mean amplitude: {np.mean(amp_values):.2f}")
            print(f"Min amplitude:  {np.min(amp_values):.2f}")
            print(f"Max amplitude:  {np.max(amp_values):.2f}")
        if bpm_values:
            print(f"Mean breathing rate: {np.mean(bpm_values):.1f} bpm")
        print(f"{'=' * 60}")

        # Keep plot open
        plt.ioff()
        plt.show()

        # ── Post-session PPG + peaks viewer ──
        show_ppg_peaks_viewer(np.array(all_ppg_data, dtype=float),
                              sorted(all_detected_peaks),
                              SAMPLING_RATE)

    except KeyboardInterrupt:
        print("\n\nStopped by user")
        stop_event.set()
        ble_thread.join(timeout=5)

    except Exception as e:
        print(f"\nUnexpected error: {e}")
        stop_event.set()
        ble_thread.join(timeout=5)

    # Save raw data
    with open("ppg_data.txt", "w") as f:
        for v in all_ppg_data:
            f.write(f"{v}\n")


def show_ppg_peaks_viewer(y, peaks, fs):
    """Scrollable post-session viewer showing raw PPG with detected peaks."""
    peaks = np.array(peaks, dtype=int)
    n = len(y)
    if n == 0:
        print("No PPG data to display.")
        return

    t = np.arange(n) / fs
    win_sec = 5.0

    fig, ax = plt.subplots(figsize=(12, 5))
    plt.subplots_adjust(bottom=0.30)

    win_samples = int(win_sec * fs)
    end = min(win_samples, n)
    line, = ax.plot(t[:end], y[:end], lw=1, color='blue')
    peak_scatter, = ax.plot([], [], 'ro', markersize=5)

    ax.set_title('PPG Signal with Detected Peaks (Post-Session)')
    ax.set_xlabel('Time (s)')
    ax.set_ylabel('PPG')
    ax.grid(True)

    auto_scale = [True]

    ax_start = plt.axes([0.12, 0.17, 0.78, 0.03])
    ax_win = plt.axes([0.12, 0.12, 0.78, 0.03])

    max_start = max(0, n - 1) / fs
    s_start = Slider(ax_start, 'Start (s)', 0.0, max_start,
                     valinit=0.0, valstep=1 / fs)
    s_win = Slider(ax_win, 'Window (s)', 1.0, max(5.0, n / fs),
                   valinit=win_sec, valstep=0.5)

    ax_btn_reset = plt.axes([0.12, 0.05, 0.15, 0.05])
    btn_reset = Button(ax_btn_reset, 'Reset 5s')

    ax_btn_auto = plt.axes([0.30, 0.05, 0.20, 0.05])
    btn_auto = Button(ax_btn_auto, 'Auto Scale: ON')

    def update(_=None):
        start_idx = int(s_start.val * fs)
        win_samp = int(s_win.val * fs)
        end_idx = min(start_idx + win_samp, n)
        if end_idx - start_idx < 2:
            return

        x = t[start_idx:end_idx]
        yseg = y[start_idx:end_idx]
        line.set_data(x, yseg)
        ax.set_xlim(x[0], x[-1])

        in_window = peaks[(peaks >= start_idx) & (peaks < end_idx)]
        peak_scatter.set_data(in_window / fs,
                              y[in_window] if len(in_window) else [])

        if auto_scale[0]:
            pad = 0.05 * np.ptp(yseg) if np.ptp(yseg) > 0 else 1.0
            ax.set_ylim(np.min(yseg) - pad, np.max(yseg) + pad)

        fig.canvas.draw_idle()

    def reset(_):
        s_win.set_val(5.0)

    def toggle_auto(_):
        auto_scale[0] = not auto_scale[0]
        btn_auto.label.set_text(
            'Auto Scale: ON' if auto_scale[0] else 'Auto Scale: OFF')
        update()

    s_start.on_changed(update)
    s_win.on_changed(update)
    btn_reset.on_clicked(reset)
    btn_auto.on_clicked(toggle_auto)

    update()
    plt.show()


# ─────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────

def main():
    results_path = os.path.join(os.path.dirname(__file__), "results.txt")

    with open(results_path, "w", encoding="utf-8") as results_file:
        original_stdout = sys.stdout
        original_stderr = sys.stderr
        sys.stdout = TeeStdout(sys.stdout, results_file)
        sys.stderr = TeeStdout(sys.stderr, results_file)
        try:
            device_address, duration = get_user_input()
            if device_address is None:
                print("\nExiting...")
                return

            print(f"\n{'=' * 60}")
            print("CONFIGURATION")
            print(f"{'=' * 60}")
            print(f"BLE Device: {device_address}")
            print(f"Duration: {duration} seconds ({duration / 60:.1f} minutes)")
            print(f"{'=' * 60}")

            confirm = input("\nStart recording? (y/n): ").strip().lower()
            if confirm != 'y':
                print("Cancelled.")
                return

            collect_and_analyze_amplitude(device_address, duration)
            print("\nSession complete. Thank you!")
        finally:
            sys.stdout = original_stdout
            sys.stderr = original_stderr


if __name__ == "__main__":
    main()
