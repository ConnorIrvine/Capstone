# API Reference

## Data Types

### PPGDataPoint
```typescript
interface PPGDataPoint {
  timestamp: number;  // Unix timestamp in milliseconds
  value: number;      // Raw PPG sensor value
}
```

### PPGDataBatch
```typescript
interface PPGDataBatch {
  sessionId: string;
  deviceId: string;
  dataPoints: PPGDataPoint[];
  sampleRate: number;    // Hz (e.g., 130)
  startTime: number;
  endTime: number;
}
```

### HRVMetrics
```typescript
interface HRVMetrics {
  rmssd: number;        // ms
  sdnn?: number;        // ms
  meanHR?: number;      // bpm
  nnIntervals?: number[];
  timestamp: number;
  quality?: 'good' | 'fair' | 'poor';
}
```

### MeditationSession
```typescript
interface MeditationSession {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;     // seconds
  hrvMetrics: HRVMetrics[];
  averageRMSSD: number;
  notes?: string;
  type: 'short' | 'medium' | 'long';
}
```

## IDataCollector Interface

```typescript
interface IDataCollector {
  initialize(): Promise<boolean>;
  scanDevices(timeout: number): Promise<DeviceInfo[]>;
  connect(deviceId: string): Promise<boolean>;
  disconnect(): Promise<void>;
  startCollection(
    onData: (dataPoint: PPGDataPoint) => void,
    onError: (error: Error) => void
  ): Promise<void>;
  stopCollection(): Promise<PPGDataBatch>;
  isConnected(): boolean;
  getDeviceInfo(): DeviceInfo | null;
  cleanup(): Promise<void>;
}
```

## IHRVProcessor Interface

```typescript
interface IHRVProcessor {
  initialize(): Promise<boolean>;
  processData(data: PPGDataBatch): Promise<HRVMetrics>;
  processRealtime(
    recentData: PPGDataBatch,
    windowSize: number
  ): Promise<HRVMetrics | null>;
  checkSignalQuality(data: PPGDataBatch): Promise<{
    quality: 'good' | 'fair' | 'poor';
    score: number;
    issues?: string[];
  }>;
  getProcessorInfo(): {
    name: string;
    version: string;
    type: 'javascript' | 'python' | 'hybrid';
  };
  cleanup(): Promise<void>;
}
```

## StorageService

```typescript
class StorageService {
  // Session Management
  saveSession(session: MeditationSession): Promise<void>;
  loadSession(sessionId: string): Promise<MeditationSession | null>;
  loadAllSessions(limit?: number, offset?: number): Promise<MeditationSession[]>;
  deleteSession(sessionId: string): Promise<void>;
  
  // Raw Data
  saveRawData(sessionId: string, data: PPGDataBatch): Promise<void>;
  loadRawData(sessionId: string): Promise<PPGDataBatch | null>;
  
  // Trends
  getTrends(days: number): Promise<HRVTrend[]>;
  
  // Preferences
  savePreferences(preferences: any): Promise<void>;
  loadPreferences(): Promise<any>;
  
  // Privacy
  exportAllData(): Promise<string>;
  deleteAllData(): Promise<void>;
  getStorageSize(): Promise<number>;
}
```

## App State Context

```typescript
interface AppState {
  isBluetoothEnabled: boolean;
  connectedDevice: DeviceInfo | null;
  availableDevices: DeviceInfo[];
  isSessionActive: boolean;
  currentSession: MeditationSession | null;
  currentHRV: HRVMetrics | null;
  heartRate: number | null;
  recentSessions: MeditationSession[];
  isLoading: boolean;
  error: string | null;
}

interface AppActions {
  scanForDevices(): Promise<void>;
  connectToDevice(deviceId: string): Promise<boolean>;
  disconnectDevice(): Promise<void>;
  startSession(): Promise<void>;
  stopSession(): Promise<void>;
  pauseSession(): void;
  resumeSession(): void;
  loadRecentSessions(count: number): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  clearError(): void;
}
```

## Factory Methods

### DataCollectorFactory
```typescript
type CollectorType = 'polar_h10' | 'mock' | 'generic_ble';

DataCollectorFactory.create(type: CollectorType): IDataCollector;
DataCollectorFactory.fromConfig(): IDataCollector;
```

### HRVProcessorFactory
```typescript
type ProcessorType = 'javascript' | 'python' | 'hybrid';

HRVProcessorFactory.create(type: ProcessorType): IHRVProcessor;
HRVProcessorFactory.fromConfig(): IHRVProcessor;
HRVProcessorFactory.forUseCase(
  useCase: 'realtime' | 'post-session' | 'development'
): IHRVProcessor;
```

## Python API

```python
class HRVProcessor:
    def __init__(self, sample_rate: float = 130.0)
    def process_ppg_data(self, ppg_data: Dict) -> Dict
```

### Input Format (JSON)
```json
{
  "sessionId": "session-123",
  "sampleRate": 130,
  "dataPoints": [
    {"timestamp": 1705234567000, "value": 1024},
    ...
  ]
}
```

### Output Format (JSON)
```json
{
  "rmssd": 45.2,
  "sdnn": 52.3,
  "meanHR": 72.5,
  "nnIntervals": [820, 835, 810],
  "quality": "good",
  "timestamp": 1705234567000
}
```

## Utility Functions

```typescript
// Date/Time
formatDate(timestamp: number): string;
formatTime(timestamp: number): string;
formatDuration(seconds: number): string;

// ID Generation
generateId(): string;

// Math
average(values: number[]): number;
standardDeviation(values: number[]): number;
isPhysiologicallyValid(value: number, min: number, max: number): boolean;

// Async
delay(ms: number): Promise<void>;
```

## Constants

```typescript
// Physiological Limits
const MIN_RR_INTERVAL = 300;   // ms (200 bpm)
const MAX_RR_INTERVAL = 2000;  // ms (30 bpm)

// Signal Processing
const MIN_PEAK_DISTANCE_MS = 300;
const BANDPASS_LOW_HZ = 0.5;
const BANDPASS_HIGH_HZ = 8.0;

// Session Types
const SESSION_DURATION_SHORT = 300;    // 5 minutes
const SESSION_DURATION_MEDIUM = 900;   // 15 minutes
const SESSION_DURATION_LONG = 1800;    // 30 minutes

// Quality Thresholds
const QUALITY_GOOD_THRESHOLD = 0.9;
const QUALITY_FAIR_THRESHOLD = 0.7;
```
