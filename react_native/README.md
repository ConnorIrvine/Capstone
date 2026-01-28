# HRV Meditation App - React Native

A privacy-focused meditation app with real-time Heart Rate Variability (HRV) monitoring using Bluetooth PPG sensors. Built with modular architecture to allow easy swapping of data collection and processing components.

## 🎯 Project Overview

This application:
- Collects raw PPG (photoplethysmography) sensor data via Bluetooth
- Calculates HRV metrics (RMSSD, SDNN) locally on device
- Provides real-time biofeedback during meditation
- Tracks long-term HRV trends
- **Keeps all data local** for maximum privacy

## 🏗️ Architecture

### Modular Design

The app is built with swappable components:

```
┌─────────────────┐
│   UI Layer      │  React Native screens & components
├─────────────────┤
│  State Manager  │  React Context (AppState)
├─────────────────┤
│  Data Collection│  IDataCollector interface
│    - Polar H10  │    → PolarH10Collector
│    - Mock       │    → MockCollector
│    - Generic BLE│    → Future implementations
├─────────────────┤
│  Processing     │  IHRVProcessor interface
│    - JavaScript │    → JavaScriptHRVProcessor
│    - Python     │    → PythonBridgeHRVProcessor
├─────────────────┤
│  Storage        │  Local file system + AsyncStorage
└─────────────────┘
```

### Key Features

- **Modular Data Collection**: Swap between real devices and mock data
- **Flexible Processing**: Choose between JavaScript or Python algorithms
- **Privacy-First**: All data stored locally, no cloud sync
- **Real-time Feedback**: Live HRV metrics during meditation
- **Long-term Tracking**: Trend analysis over days/weeks/months

## 📁 Project Structure

```
react_native/
├── src/
│   ├── types/
│   │   └── index.ts                    # TypeScript type definitions
│   ├── services/
│   │   ├── dataCollection/
│   │   │   ├── IDataCollector.ts       # Collection interface
│   │   │   ├── PolarH10Collector.ts    # Polar H10 implementation
│   │   │   ├── MockCollector.ts        # Mock for testing
│   │   │   └── DataCollectorFactory.ts # Factory pattern
│   │   ├── processing/
│   │   │   ├── IHRVProcessor.ts        # Processing interface
│   │   │   ├── JavaScriptHRVProcessor.ts  # JS implementation
│   │   │   ├── PythonBridgeHRVProcessor.ts # Python bridge
│   │   │   └── HRVProcessorFactory.ts  # Factory pattern
│   │   └── storage/
│   │       └── StorageService.ts       # Local data persistence
│   ├── state/
│   │   └── AppState.tsx                # Global state management
│   ├── screens/
│   │   ├── HomeScreen.tsx              # Main dashboard
│   │   ├── DeviceScreen.tsx            # Bluetooth connection
│   │   ├── SessionScreen.tsx           # Active meditation
│   │   ├── HistoryScreen.tsx           # Past sessions & trends
│   │   └── SettingsScreen.tsx          # App configuration
│   └── components/
│       └── common.tsx                  # Reusable UI components
├── python/
│   ├── hrv_processor.py                # Python HRV algorithms
│   ├── requirements.txt                # Python dependencies
│   └── README.md                       # Python module docs
├── App.tsx                             # Root component
├── package.json                        # Node dependencies
├── tsconfig.json                       # TypeScript config
└── README.md                           # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: >= 18
- **React Native CLI**: `npm install -g react-native-cli`
- **Android Studio**: For Android development
- **Python**: >= 3.8 (optional, for Python processing)
- **Bluetooth PPG Device**: Polar H10 or compatible (for real data)

### Installation

1. **Install Node dependencies:**
   ```bash
   npm install
   ```

2. **Install Python dependencies (if using Python processing):**
   ```bash
   cd python
   pip install -r requirements.txt
   ```

3. **Set up Android environment:**
   - Install Android SDK
   - Create virtual device or connect physical device
   - Enable Developer Mode on device

### Running the App

#### Development with Mock Data

```bash
# Start Metro bundler
npm start

# Run on Android
npm run android
```

The app will start with `MockCollector` by default, generating synthetic PPG data.

#### Production with Real Device

1. Update configuration in [src/services/dataCollection/DataCollectorFactory.ts](src/services/dataCollection/DataCollectorFactory.ts):
   ```typescript
   return DataCollectorFactory.create('polar_h10');
   ```

2. Implement Bluetooth connection in [PolarH10Collector.ts](src/services/dataCollection/PolarH10Collector.ts)

3. Test with physical Bluetooth device

## 🔧 Development Workflow

### Phase 1: UI Development (Start Here)

1. **Implement UI screens**
   - Uncomment component code in screen files
   - Add actual styling
   - Test navigation flow
   - Use `MockCollector` for data

2. **Implement state management**
   - Complete `AppProvider` in [AppState.tsx](src/state/AppState.tsx)
   - Connect screens to global state
   - Test state updates

### Phase 2: Data Collection

1. **Implement MockCollector** (for testing)
   - Generate realistic synthetic PPG data
   - Simulate connection delays
   - Test without hardware

2. **Implement PolarH10Collector**
   - Install `react-native-ble-plx`
   - Request Bluetooth permissions
   - Parse Polar H10 protocol
   - Test with real device

### Phase 3: HRV Processing

Choose your implementation path:

#### Option A: JavaScript Processing (Recommended)

1. Implement algorithms in [JavaScriptHRVProcessor.ts](src/services/processing/JavaScriptHRVProcessor.ts)
2. No additional dependencies needed
3. Better performance for real-time processing

#### Option B: Python Processing

1. Complete Python algorithms in [python/hrv_processor.py](python/hrv_processor.py)
2. Test Python script standalone first
3. Implement bridge in [PythonBridgeHRVProcessor.ts](src/services/processing/PythonBridgeHRVProcessor.ts)
4. Consider Chaquopy for production

### Phase 4: Storage & History

1. Implement storage methods in [StorageService.ts](src/services/storage/StorageService.ts)
2. Test session persistence
3. Implement trend calculations
4. Add data export/deletion features

### Phase 5: Polish & Testing

1. Add error handling throughout
2. Implement loading states
3. Add user feedback (toasts, modals)
4. Test edge cases
5. Optimize performance

## 📱 Android-Specific Setup

### Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### Request Permissions at Runtime

Using `react-native-permissions`:

```typescript
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const requestBluetooth = async () => {
  const result = await request(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
  return result === RESULTS.GRANTED;
};
```

## 🔬 Testing

### Unit Testing

```bash
npm test
```

### Testing with Mock Data

1. Use `MockCollector` for UI testing
2. Adjust mock data generation in [MockCollector.ts](src/services/dataCollection/MockCollector.ts)
3. Test different scenarios (good/poor signal, disconnections)

### Testing with Real Device

1. Pair Polar H10 via Bluetooth settings
2. Use `DeviceScreen` to connect
3. Start meditation session
4. Verify HRV calculations
5. Check data persistence

## 🔐 Privacy & Security

### Privacy Principles

- **Local-Only Data**: No cloud storage or sync
- **User Control**: Easy data export and deletion
- **Transparent**: Clear about what's stored
- **Optional Raw Data**: Users can choose to save or discard raw PPG

### Data Retention

- Raw PPG data: Optional, can be deleted after processing
- HRV metrics: Kept for trend analysis
- Sessions: Retained until user deletion
- All data stored in app's private directory

### GDPR Considerations

- Data export: `StorageService.exportAllData()`
- Data deletion: `StorageService.deleteAllData()`
- No tracking or analytics (by default)

## 🧠 HRV Science

### What is HRV?

Heart Rate Variability measures the variation in time between heartbeats. Higher HRV generally indicates:
- Better stress resilience
- Good parasympathetic (rest & digest) activity
- Overall cardiovascular health

### RMSSD Metric

**Root Mean Square of Successive Differences (RMSSD)**:
- Time-domain HRV metric
- Reflects parasympathetic activity
- Less affected by breathing patterns than other metrics
- Ideal for short-term measurements

Formula: `RMSSD = sqrt(mean((RR[i+1] - RR[i])²))`

### Typical Values

- **Low HRV**: < 20 ms (stress, fatigue)
- **Normal HRV**: 20-80 ms (varies by age, fitness)
- **High HRV**: > 80 ms (good recovery, fitness)

Note: Values are highly individual. Track your own trends over time.

## 📚 Resources

### React Native

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [React Navigation](https://reactnavigation.org/)
- [React Native BLE PLX](https://github.com/dotintent/react-native-ble-plx)

### HRV & Signal Processing

- Task Force HRV Standards (1996)
- [Polar H10 Documentation](https://www.polar.com/en/products/accessories/H10-heart-rate-sensor)
- [HeartPy Python Package](https://python-heart-rate-analysis-toolkit.readthedocs.io/)

### Python Integration

- [Chaquopy](https://chaquo.com/chaquopy/) - Python on Android
- [React Native Python](https://www.npmjs.com/package/react-native-python)

## 🛠️ Troubleshooting

### Bluetooth Connection Issues

- Ensure Bluetooth is enabled
- Check location permissions (required for BLE scanning on Android)
- Verify device is not paired in system Bluetooth settings
- Try restarting Bluetooth service

### Build Errors

- Clear Metro cache: `npm start -- --reset-cache`
- Clean Android build: `cd android && ./gradlew clean`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### Python Bridge Issues

- Verify Python is accessible on device
- Check file paths for temp files
- Test Python script standalone first
- Consider using JavaScript implementation instead

## 🎯 Next Steps

1. **Start with UI**: Implement screen layouts and navigation
2. **Add Mock Data**: Test UI with MockCollector
3. **Implement Processing**: Choose JS or Python approach
4. **Add Real Device**: Integrate Polar H10
5. **Test & Iterate**: Validate HRV calculations
6. **Polish**: Add animations, feedback, error handling

## 📝 License

This project is for educational/research purposes. If using commercially, ensure compliance with:
- Bluetooth device licensing (Polar H10)
- Medical device regulations (if applicable)
- Privacy laws (GDPR, HIPAA, etc.)

## 🤝 Contributing

This is a capstone project. For educational use:
1. Fork for your own modifications
2. Test thoroughly with real sensors
3. Validate HRV algorithms against known implementations

## 📧 Support

For React Native issues: Check React Native documentation
For HRV questions: Consult scientific literature on HRV measurement
For Polar H10: See Polar developer documentation

---

**Good luck with your development!** 🚀

Remember: Start simple (UI + Mock data), then gradually add complexity (real device, processing, storage). The modular architecture makes it easy to develop and test each component independently.
