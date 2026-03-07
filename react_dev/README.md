# PPG Monitor — React Native App

A React Native (Expo) app that connects to the **NanoESP32_PPG** Arduino sensor over BLE and displays a live PPG waveform.

---

## Prerequisites

| Tool | Download |
|---|---|
| Node.js (LTS) | https://nodejs.org |
| Android Studio | https://developer.android.com/studio |
| Git | https://git-scm.com |

---

## 1. Clone and install dependencies

```bash
git clone <repo-url>
cd react_dev
npm install
```

---

## 2. Set up Android Studio

### Install the Android SDK

1. Open **Android Studio**
2. Go to **More Actions** → **SDK Manager**
3. Under **SDK Platforms**, check **Android 14 (API 34)**
4. Under **SDK Tools**, make sure these are checked:
   - Android SDK Build-Tools
   - Android Emulator
   - Android SDK Platform-Tools
5. Click **Apply** and let everything download

### Set environment variables (Windows)

1. Press **Win + S** → search **"Edit the system environment variables"** → open it
2. Click **"Environment Variables…"**
3. Under **User variables**, click **New**:
   - Name: `ANDROID_HOME`
   - Value: `C:\Users\<your-username>\AppData\Local\Android\Sdk`
4. Click **New** again to add a second variable:
   - Name: `JAVA_HOME`
   - Value: `C:\Program Files\Android\Android Studio\jbr`

   > **Tip:** To confirm the exact path, open Android Studio → **File** → **Settings** → **Build, Execution, Deployment** → **Build Tools** → **Gradle** and check the **Gradle JDK** path shown there.
5. Find **`Path`** in User variables → **Edit** → add two new entries:
   - `C:\Users\<your-username>\AppData\Local\Android\Sdk\platform-tools`
   - `C:\Users\<your-username>\AppData\Local\Android\Sdk\emulator`
6. Click **OK** on all dialogs, then **restart your terminal**

Verify it worked:
```bash
adb --version
java -version
```

---

## 3. Generate the native Android project (one-time)

```bash
npx expo prebuild --platform android
```

This creates the `android/` folder. Only needs to be run once, or again if you change `app.json` plugins.

---

## 4a. Run on Android Emulator

### Create a virtual device

1. Open Android Studio → **More Actions** → **Virtual Device Manager**
2. Click **Create Device** → select **Pixel 8** → **Next**
3. Select **API 34** (download it if needed) → **Next** → **Finish**
4. Press ▶ to start the emulator and wait for the Android home screen

### Confirm the emulator is detected

```bash
adb devices
# Should show: emulator-5554   device
```

### Build and run

```bash
npx expo run:android
```

> First build takes ~5 minutes. Subsequent builds are much faster.

> **Note:** BLE (Bluetooth) does not work on emulators. You can test all UI and navigation, but scanning for devices will not find anything.

---

## 4b. Run on a Physical Android Device

### Enable Developer Mode on your phone

1. Open **Settings** → **About Phone**
2. Tap **Build Number** 7 times until you see "You are now a developer"
3. Go back to **Settings** → **Developer Options**
4. Enable **USB Debugging**

### Connect and run

1. Plug your phone into your PC via USB
2. Accept the "Allow USB debugging" prompt on your phone
3. Verify it's detected:
   ```bash
   adb devices
   # Should show your device serial number with "device" status
   ```
4. Build and install:
   ```bash
   npx expo run:android
   ```

The app will install and launch automatically on your phone. BLE will work fully on a physical device.

---

## 5. Using the app

### Connect Screen
- Tap **Scan for Devices** — the app will scan for nearby BLE devices for 10 seconds
- Your Arduino device (**NanoESP32_PPG**) will be highlighted in the list
- Tap **Connect** next to it

### Data Screen
- Once connected, the live PPG waveform will begin streaming
- **Current Value** — latest raw ADC reading (0–4095)
- **Sample Rate** — measured incoming samples per second (~100 Hz)
- **Buffer** — number of data points currently in the chart window
- Tap **Disconnect** to close the connection and return to the Connect screen

---

## Project Structure

```
react_dev/
├── App.tsx                        # Navigation root + BLE context provider
├── app.json                       # Expo config + Android permissions
├── src/
│   ├── ble/useBLE.ts              # BLE scan, connect, stream logic
│   ├── context/BLEContext.tsx     # React context for BLE state
│   ├── screens/
│   │   ├── ConnectScreen.tsx      # Screen 1: scan & connect
│   │   └── DataScreen.tsx         # Screen 2: live PPG chart
│   └── components/
│       └── PPGChart.tsx           # SVG waveform chart component
```

---

## Arduino Device Reference

| Property | Value |
|---|---|
| Device name | `NanoESP32_PPG` |
| Service UUID | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` |
| TX Characteristic | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` |
| Data format | ASCII integer + newline e.g. `1024\n` |
| Sample rate | 100 Hz |
| ADC range | 0 – 4095 (12-bit) |
