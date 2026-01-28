# Python HRV Processing Module

This directory contains Python code for HRV (Heart Rate Variability) analysis.

## Files

- `hrv_processor.py`: Main processing module with HRV calculation algorithms
- `requirements.txt`: Python dependencies
- `test_data/`: Sample data for testing (create this directory)

## Setup

### Install Dependencies

```bash
pip install -r requirements.txt
```

Or install individually:
```bash
pip install numpy scipy
```

## Usage

### Standalone Testing

Process a JSON file containing PPG data:

```bash
python hrv_processor.py input.json output.json
```

### Input Format

JSON file with structure:
```json
{
  "sessionId": "session-123",
  "sampleRate": 130,
  "dataPoints": [
    {"timestamp": 1705234567000, "value": 1024},
    {"timestamp": 1705234567008, "value": 1028},
    ...
  ]
}
```

### Output Format

JSON file with HRV metrics:
```json
{
  "rmssd": 45.2,
  "sdnn": 52.3,
  "meanHR": 72.5,
  "nnIntervals": [820, 835, 810, ...],
  "quality": "good",
  "timestamp": 1705234567000
}
```

## Integration with React Native

### Option 1: Chaquopy (Recommended for Production)

Chaquopy embeds Python in your Android app. See integration guide in main README.

### Option 2: File-Based Bridge (Development)

1. React Native writes PPG data to JSON file
2. Execute Python script via subprocess
3. Read results from output JSON file

Example in TypeScript:
```typescript
const inputPath = `${RNFS.TemporaryDirectoryPath}/ppg_input.json`;
const outputPath = `${RNFS.TemporaryDirectoryPath}/hrv_output.json`;

await RNFS.writeFile(inputPath, JSON.stringify(ppgData));
await executeCommand(`python python/hrv_processor.py ${inputPath} ${outputPath}`);
const result = JSON.parse(await RNFS.readFile(outputPath));
```

## Algorithm Implementation Notes

### Signal Processing Pipeline

1. **Filtering**: Band-pass filter (0.5-8 Hz) to remove:
   - DC offset and baseline wander
   - Breathing artifacts
   - High-frequency noise

2. **Peak Detection**: Identify heartbeats in PPG signal
   - Adaptive threshold or scipy.signal.find_peaks
   - Minimum distance constraint (~300ms)

3. **RR Interval Calculation**: Time between consecutive peaks

4. **Artifact Rejection**: Remove invalid intervals
   - Physiological limits (300-2000 ms)
   - Statistical outliers (mean ± 3 SD)
   - Sudden changes (> 20% difference)

5. **HRV Metrics**:
   - RMSSD: sqrt(mean(diff(RR)²))
   - SDNN: std(RR intervals)
   - Mean HR: 60000 / mean(RR)

### References

- Task Force guidelines for HRV measurement (1996)
- PPG signal processing: "Photoplethysmography and its application" (Allen, 2007)
- Peak detection algorithms for wearable sensors

## Testing

Create test data:
```bash
python -c "import json; import numpy as np; ..."
# Generate synthetic PPG signal with known characteristics
```

Run tests:
```bash
python hrv_processor.py --test
```

## Performance Considerations

- Typical processing time: < 100ms for 2-minute recording
- Memory usage: ~10MB for 130Hz @ 10 minutes
- Batch processing recommended for long recordings

## Future Improvements

- Frequency-domain HRV metrics (LF, HF, LF/HF ratio)
- Poincaré plot analysis (SD1, SD2)
- Detrended fluctuation analysis (DFA)
- Real-time processing with sliding windows
- GPU acceleration for large datasets
