# PPG Live Monitor — React Native (Android)

Real-time PPG (Photoplethysmography) signal viewer for Android. Connects to a **NanoESP32_PPG** Arduino device over BLE and displays live waveform data with minimal latency.

## Architecture

```
Arduino Nano ESP32               Android App
┌─────────────────┐              ┌──────────────────────────────────┐
│ Pulse Sensor    │              │  BleService (react-native-ble-plx)│
│ → 100 Hz ADC    │──── BLE ───▶│  → parse CSV batches              │
│ → batch 4 vals  │  (notify)   │  → push to data buffer (ref)      │
│ → CSV notify    │              │                                    │
└─────────────────┘              │  PPGChart (@shopify/react-native- │
                                 │  skia)                             │
                                 │  → 30 fps canvas redraw            │
                                 │  → scrolling 600-sample window     │
                                 └──────────────────────────────────┘
```

## BLE Protocol

| Parameter        | Value                                          |
| ---------------- | ---------------------------------------------- |
| Device Name      | `NanoESP32_PPG`                                |
| Service UUID     | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`        |
| TX Char UUID     | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E`        |
| Notification     | 25 packets/sec, 4 comma-separated ints each    |
| Effective Rate   | 100 Hz (4 samples × 25 notifications)          |
| Value Range      | 0–4095 (12-bit ADC)                            |
| Data Format      | `"1234,2345,3456,4567\n"` (UTF-8, CSV)         |

## Low-Latency Design

- **BLE Connection Priority**: `ConnectionPriority.High` requested immediately after connect (shortest BLE interval)
- **MTU**: Requested 185 bytes to eliminate fragmentation overhead
- **No React state for data**: PPG samples stored in a `useRef` buffer — zero re-renders from incoming data
- **Skia canvas rendering**: GPU-accelerated drawing via `@shopify/react-native-skia` — bypasses React Native's bridge entirely
- **30 fps redraw loop**: `requestAnimationFrame` drives chart updates, decoupled from BLE notification rate
- **Minimal parsing**: Direct `split(',')` + `parseInt` on decoded base64 — no regex

## Prerequisites

- **Node.js** ≥ 18
- **Android Studio** with SDK 34+ and NDK installed
- **Java JDK** 17
- An Android device (physical) with BLE support — emulators don't support BLE

### Environment Variables (Windows)

```
ANDROID_HOME = C:\Users\<you>\AppData\Local\Android\Sdk
JAVA_HOME = C:\Program Files\Java\jdk-17
```

Ensure `platform-tools` is on your PATH.

## Setup

```bash
cd PPGMonitor
npm install
```

## Running

1. Connect your Android phone via USB (enable USB debugging)
2. Verify device is detected:
   ```bash
   adb devices
   ```
3. Build and run:
   ```bash
   npx react-native run-android
   ```

## Building a Release APK

To generate and install a release APK:

1. (First time only) Generate a signing key and configure it in `android/app/build.gradle` and `android/gradle.properties` (see React Native docs for details).
2. Build the release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
3. The APK will be output to:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```
4. To install the APK on your device via USB:
   ```bash
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```
5. The app will now appear in your app drawer, ready to use.
4. Power on the Arduino Nano ESP32 with the pulse sensor
5. Tap **Connect** in the app
6. Place your finger on the pulse sensor — the PPG waveform appears in real time

## HTTPS / Self-Signed Certificate Setup

The app connects to your local API server over HTTPS. Because the server uses a **self-signed certificate**, you must bundle it into the APK before building. The certificate is excluded from Git (`.gitignore`) and must be regenerated whenever the server cert changes.

### 1. Fetch the certificate from your running server

Run the following from the **root of the project** (`PPGMonitor/`) with your server running:

```powershell
# Run from: PPGMonitor/  (NOT from inside the android/ folder)
New-Item -ItemType Directory -Force "android\app\src\main\res\raw" | Out-Null
$tcpClient = New-Object System.Net.Sockets.TcpClient("{YOURIP}", 8000)
$sslStream = New-Object System.Net.Security.SslStream($tcpClient.GetStream(), $false, {$true})
$sslStream.AuthenticateAsClient("{YOURIP}")
$cert = $sslStream.RemoteCertificate
$bytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
[System.IO.File]::WriteAllBytes("$PWD\android\app\src\main\res\raw\server_cert.crt", $bytes)
$sslStream.Close(); $tcpClient.Close()
Write-Host "Certificate saved!"
```

Replace `{YOURIP}` with the IP address of your server (e.g. `192.168.0.70`).

The cert will be saved to `android/app/src/main/res/raw/server_cert.crt`.

### 2. Build the APK

After the cert is in place, build normally:

```bash
# Run from: PPGMonitor/android/
./gradlew assembleRelease
```

The bundled cert is trusted automatically — **no manual installation on the device is needed**.

> **Note:** If your server certificate ever regenerates, repeat Step 1 and rebuild the APK.

## Project Structure

```
PPGMonitor/
├── App.tsx                          # App entry point
├── src/
│   ├── services/
│   │   └── BleService.ts           # BLE scanning, connection, data parsing
│   ├── components/
│   │   └── PPGChart.tsx            # Skia-based real-time chart
│   └── screens/
│       └── PPGMonitorScreen.tsx    # Main UI screen
├── android/
│   └── app/src/main/
│       └── AndroidManifest.xml     # BLE permissions
├── babel.config.js                 # Reanimated plugin
└── package.json
```

## Key Dependencies

| Package                       | Purpose                            |
| ----------------------------- | ---------------------------------- |
| `react-native-ble-plx`       | BLE scanning, connect, notify      |
| `@shopify/react-native-skia`  | GPU-accelerated chart rendering    |
| `react-native-reanimated`     | Required peer dep for Skia         |

## Corresponding Source Files

- **Arduino firmware**: `arduino_code/src/bluetooth.cpp` — sensor read + BLE notify
- **Python reference viewer**: `python_code/data_viewer.py` — desktop BLE viewer (same protocol)

## Troubleshooting

| Issue | Fix |
| --- | --- |
| "Scan timeout" | Ensure Arduino is powered and advertising. Check it's not connected to another device. |
| "Permissions denied" | Go to Android Settings → Apps → PPGMonitor → Permissions → enable Location & Nearby Devices |
| Flat line / no data | Verify finger is on sensor. Check Arduino serial output for ADC readings. |
| Choppy chart | Ensure phone isn't in battery saver mode (throttles BLE interval). |
| Build fails on Skia | Run `cd android && ./gradlew clean` then rebuild. |
