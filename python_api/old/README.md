# HRV Analysis API

A FastAPI-based REST API for calculating Heart Rate Variability (HRV) RMSSD from PPG (photoplethysmography) signal data with built-in signal quality assessment.

## Features

- ✅ Calculate HRV RMSSD (Root Mean Square of Successive Differences) from PPG data
- ✅ Signal quality assessment using 3-second segment analysis
- ✅ Configurable tolerance for bad signal segments
- ✅ Automatic API documentation with FastAPI
- ✅ Input validation and comprehensive error handling
- ✅ Based on NeuroKit2 library for signal processing

## Installation

### Prerequisites

- Python 3.8 or higher
- pip package manager

### Setup

1. Navigate to the `python_api` directory:
```bash
cd python_api
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv

# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the API

### Start the server

```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### Interactive Documentation

FastAPI automatically generates interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### `GET /`
Root endpoint providing API information and available endpoints.

**Response:**
```json
{
  "message": "HRV Analysis API",
  "version": "1.0.0",
  "endpoints": {
    "/analyze": "POST - Analyze PPG data and calculate HRV RMSSD",
    "/docs": "GET - Interactive API documentation",
    "/health": "GET - Health check endpoint"
  }
}
```

### `GET /health`
Health check endpoint to verify the API is running.

**Response:**
```json
{
  "status": "healthy"
}
```

### `POST /analyze`
Analyze PPG data and calculate HRV RMSSD with signal quality assessment.

#### Request Body

```json
{
  "ppg_data": [438, 445, 452, 460, 468, ...],
  "sampling_rate": 100,
  "max_bad_segments": 0
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `ppg_data` | array of floats | Yes | - | Array of PPG signal values (min 1000 samples) |
| `sampling_rate` | float | Yes | - | Sampling rate in Hz (must be > 0 and ≤ 1000) |
| `max_bad_segments` | integer | No | 0 | Maximum number of bad 3-second segments allowed |

#### Success Response (200 OK)

```json
{
  "success": true,
  "rmssd": 42.56,
  "bad_segments": 0
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` on success |
| `rmssd` | float | Calculated RMSSD value in milliseconds |
| `bad_segments` | integer | Number of bad 3-second segments detected |

#### Error Response (422 Unprocessable Entity)

```json
{
  "detail": {
    "success": false,
    "error": "Poor signal quality: 3 bad segments detected (max allowed: 2)",
    "bad_segments": 3
  }
}
```

## Usage Examples

### Python with `requests`

```python
import requests
import json

# Example PPG data (replace with your actual data)
ppg_data = [438, 445, 452, 460, 468] * 300  # Example data

# Prepare request
url = "http://localhost:8000/analyze"
payload = {
    "ppg_data": ppg_data,
    "sampling_rate": 100,
    "max_bad_segments": 2
}

# Send request
response = requests.post(url, json=payload)

# Handle response
if response.status_code == 200:
    result = response.json()
    print(f"✓ Success!")
    print(f"  RMSSD: {result['rmssd']:.2f} ms")
    print(f"  Bad segments: {result['bad_segments']}")
else:
    error = response.json()['detail']
    print(f"✗ Error: {error['error']}")
    print(f"  Bad segments: {error['bad_segments']}")
```

### JavaScript with `fetch`

```javascript
const ppgData = [438, 445, 452, 460, 468]; // Add more data...

fetch('http://localhost:8000/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ppg_data: ppgData,
    sampling_rate: 100,
    max_bad_segments: 2
  })
})
.then(response => {
  if (response.ok) {
    return response.json();
  } else {
    return response.json().then(err => Promise.reject(err));
  }
})
.then(data => {
  console.log(`✓ Success!`);
  console.log(`  RMSSD: ${data.rmssd.toFixed(2)} ms`);
  console.log(`  Bad segments: ${data.bad_segments}`);
})
.catch(error => {
  console.error(`✗ Error: ${error.detail.error}`);
  console.error(`  Bad segments: ${error.detail.bad_segments}`);
});
```

### cURL

```bash
curl -X POST "http://localhost:8000/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "ppg_data": [438, 445, 452, 460, 468],
    "sampling_rate": 100,
    "max_bad_segments": 2
  }'
```

### TypeScript (React Native)

```typescript
interface HRVRequest {
  ppg_data: number[];
  sampling_rate: number;
  max_bad_segments?: number;
}

interface HRVResponse {
  success: boolean;
  rmssd: number;
  bad_segments: number;
}

interface HRVError {
  detail: {
    success: false;
    error: string;
    bad_segments: number;
  };
}

async function analyzeHRV(
  ppgData: number[], 
  samplingRate: number, 
  maxBadSegments: number = 0
): Promise<HRVResponse> {
  const response = await fetch('http://localhost:8000/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ppg_data: ppgData,
      sampling_rate: samplingRate,
      max_bad_segments: maxBadSegments,
    }),
  });

  if (!response.ok) {
    const error: HRVError = await response.json();
    throw new Error(error.detail.error);
  }

  return response.json();
}

// Usage
try {
  const result = await analyzeHRV(ppgData, 100, 2);
  console.log(`RMSSD: ${result.rmssd.toFixed(2)} ms`);
  console.log(`Bad segments: ${result.bad_segments}`);
} catch (error) {
  console.error(`Error: ${error.message}`);
}
```

## Signal Quality Checks

The API performs the following signal quality assessments on 3-second segments:

1. **Flatline/Low Variance**: Detects segments with standard deviation < 1.0
2. **Clipping/Saturation**: Identifies segments with too many identical values (< 2% unique values)
3. **Extreme Jumps**: Flags segments with sudden value changes > 2000 units
4. **Peak Plausibility**: Validates expected heart rate (2-6 peaks per 3s segment, corresponding to 40-120 bpm)

### Tolerance for Bad Segments

Use the `max_bad_segments` parameter to control strictness:

- `0` (default): Strict mode - any bad segment fails quality check
- `1-3`: Moderate - allows some noise/artifacts
- `4+`: Lenient - accepts lower quality signals

**Recommendation**: Start with `0` for highest quality. Increase only if you're consistently getting quality errors with visually good signals.

## Data Requirements

- **Minimum duration**: 10 seconds of data (e.g., 1000 samples at 100 Hz)
- **Recommended duration**: 30+ seconds for reliable HRV calculation
- **Sampling rate**: Typically 50-250 Hz for PPG signals
- **Data format**: Numeric array of PPG amplitude values

## Error Handling

The API returns `422 Unprocessable Entity` status code for the following cases:

1. **Insufficient data**: Less than 10 seconds of samples
2. **Poor signal quality**: Too many bad segments detected
3. **HRV calculation failure**: Unable to process the PPG signal

All errors include:
- `success: false`
- `error`: Human-readable error message
- `bad_segments`: Number of bad segments detected (for diagnostics)

## Testing

You can test the API using the interactive documentation at http://localhost:8000/docs

Or use the provided Python script:

```python
# test_api.py
import requests
import numpy as np

# Generate test data (simulated PPG signal)
t = np.linspace(0, 30, 3000)  # 30 seconds at 100 Hz
ppg_signal = 500 + 50 * np.sin(2 * np.pi * 1.2 * t)  # ~72 bpm
ppg_data = ppg_signal.tolist()

# Test the API
response = requests.post(
    "http://localhost:8000/analyze",
    json={
        "ppg_data": ppg_data,
        "sampling_rate": 100,
        "max_bad_segments": 0
    }
)

print(response.status_code)
print(response.json())
```

## Troubleshooting

### Port already in use
```bash
# Kill process on port 8000 (Windows)
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Kill process on port 8000 (macOS/Linux)
lsof -ti:8000 | xargs kill -9
```

### Import errors
Ensure all dependencies are installed:
```bash
pip install -r requirements.txt --upgrade
```

### CORS issues (for web clients)
If calling from a web application, you may need to enable CORS in `main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Technical Details

### HRV Calculation Method

- **Algorithm**: NeuroKit2's PPG processing pipeline
- **Metric**: RMSSD (Root Mean Square of Successive Differences)
- **Process**:
  1. PPG peak detection
  2. Peak-to-peak interval calculation
  3. RMSSD computation from inter-beat intervals

### Performance

- **Processing time**: ~1-3 seconds for 30 seconds of data (100 Hz)
- **Memory usage**: Proportional to data length
- **Recommended**: Process data in chunks if analyzing long recordings

## License

This API is part of the HRV Monitoring System for meditation feedback.

## Support

For issues or questions, please refer to the main project documentation or contact the development team.
