import asyncio
import time
from bleak import BleakScanner, BleakClient
from bleak.exc import BleakError

DEVICE_NAME = "NanoESP32_PPG"
TX_CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

# Rate stats
lines_this_second = 0
total_lines = 0
start_time = None

def on_notify(sender, data: bytearray):
    global lines_this_second, total_lines
    txt = data.decode("utf-8", errors="ignore").strip()
    if txt:
        print(txt)
        lines_this_second += 1
        total_lines += 1

async def scan_for_device(timeout=10):
    print(f"Scanning for {DEVICE_NAME}...")
    devices = await BleakScanner.discover(timeout=timeout, return_adv=True)
    for dev, adv in devices.values():
        name = dev.name or adv.local_name
        if name == DEVICE_NAME:
            print(f"Found: {name} ({dev.address}) RSSI={adv.rssi}")
            return dev
    return None

async def rate_monitor(client):
    global lines_this_second, start_time, total_lines
    start_time = time.time()

    while client.is_connected:
        await asyncio.sleep(1.0)

        elapsed = time.time() - start_time
        instant_lps = lines_this_second
        avg_lps = (total_lines / elapsed) if elapsed > 0 else 0.0

        print(f"[RATE] {instant_lps} lines/sec | avg {avg_lps:.2f} lines/sec | total {total_lines}")
        lines_this_second = 0

async def connect_and_stream():
    global lines_this_second, total_lines

    while True:
        dev = await scan_for_device()
        if not dev:
            print("Device not found. Retrying in 2s...")
            await asyncio.sleep(2)
            continue

        try:
            print(f"Connecting to {dev.name} ({dev.address})...")
            async with BleakClient(dev, timeout=20.0) as client:
                if not client.is_connected:
                    print("Connect failed.")
                    await asyncio.sleep(2)
                    continue

                lines_this_second = 0
                total_lines = 0

                print("Connected. Subscribing...")
                await client.start_notify(TX_CHAR_UUID, on_notify)
                print("Streaming... Ctrl+C to stop.")

                rate_task = asyncio.create_task(rate_monitor(client))
                try:
                    while client.is_connected:
                        await asyncio.sleep(0.5)
                finally:
                    rate_task.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await rate_task
                    await client.stop_notify(TX_CHAR_UUID)

                print("Disconnected. Reconnecting...")

        except BleakError as e:
            print(f"BleakError: {repr(e)}")
            await asyncio.sleep(2)
        except Exception as e:
            print(f"Exception: {type(e).__name__}: {repr(e)}")
            await asyncio.sleep(2)

if __name__ == "__main__":
    import contextlib
    try:
        asyncio.run(connect_and_stream())
    except KeyboardInterrupt:
        print("\nStopped.")