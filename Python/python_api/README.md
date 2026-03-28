# HRV Analysis API (LAN Demo)

FastAPI-based REST API for calculating HRV RMSSD from PPG data with signal quality checks, and real-time HR amplitude (RSA) biofeedback via session-based endpoints. This version is configured for local network demos (phones on the same Wi-Fi) over HTTPS.

## Features

- Calculate HRV RMSSD (Root Mean Square of Successive Differences) from PPG data
- Signal quality assessment using 3-second segment analysis
- Configurable tolerance for bad signal segments
- Real-time HR amplitude (RSA) biofeedback via session-based endpoints
- HTTPS enforcement with HSTS headers
- Self-signed RSA certificate support for LAN demo use
- CORS enabled for web/mobile clients on the same network
- Auto-generated API docs via FastAPI

## Setup

### Prerequisites

- Python 3.8+
- pip
- OpenSSL (for certificate generation)

### Install

```bash
pip install -r requirements.txt
```

### Generate TLS Certificate (RSA)

The API requires a TLS certificate and private key to run over HTTPS. Generate a self-signed RSA certificate valid for 365 days:

```bash
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -sha256 -days 365 -nodes -subj "/CN=localhost"
```

This creates `server.crt` and `server.key` in the current directory. These files are gitignored and must be regenerated on each new machine.

### Configure Environment

Create a `.env` file in the project root (also gitignored):

```env
SSL_CERTFILE=server.crt
SSL_KEYFILE=server.key
PORT=8000
ENFORCE_HTTPS=true
AES_SECRET_KEY=<base64-encoded-32-byte-key>
```

To generate a new `AES_SECRET_KEY`:

```bash
python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
```

Set `ENFORCE_HTTPS=false` only when a TLS-terminating proxy (nginx, ALB, etc.) handles HTTPS upstream.

## Run (LAN Access)

```bash
python main.py
```

The API binds to `0.0.0.0:<PORT>` (default `8000`) over HTTPS, making it reachable from other devices on the same network.

## Build a Windows .exe

This creates a single-file executable you can run on the demo laptop.

```powershell
./build.ps1
```

The output is:

```
dist\hrv-api.exe
```

Run it:

```powershell
./dist/hrv-api.exe
```

If Windows Defender prompts for network access, allow it for Private networks.

### Find Your LAN IP

On Windows:
```bash
ipconfig
```
Use the IPv4 address (example: `192.168.1.42`).

### Test From a Phone

- Open `https://<your-lan-ip>:8000/docs` (accept the self-signed cert warning)
- Health check: `https://<your-lan-ip>:8000/health`

### Windows Firewall

Allow inbound TCP on port 8000:

- Windows Defender Firewall > Advanced Settings > Inbound Rules > New Rule
- Port > TCP > 8000 > Allow

## CORS (Web/React Clients)

CORS is enabled by default for demo use. You can restrict origins in `.env` or via environment variable:

```bash
set HRV_ALLOWED_ORIGINS=https://192.168.1.42:5173,https://192.168.1.42:3000
```

Use `*` to allow all origins (default). Use `https://` origins since the API enforces HTTPS.

## API Endpoints

### `GET /`
Returns basic API info and endpoints.

### `GET /health`
Health check.

### `POST /analyze`
Analyze PPG data and calculate RMSSD with signal quality checks.

### `POST /amplitude/start`
Start a new real-time HR amplitude (RSA) monitoring session. Returns a `session_id`.

### `POST /amplitude/data`
Stream PPG samples into a session and receive HR values and amplitude biofeedback events.

### `POST /amplitude/stop`
Stop a session and retrieve summary statistics (mean/min/max HR, amplitude, breathing rate).

#### Request

```json
{
  "ppg_data": [438, 445, 452, 460, 468, ...],
  "sampling_rate": 100,
  "max_bad_segments": 0
}
```

#### Success Response (200)

```json
{
  "success": true,
  "rmssd": 42.56,
  "bad_segments": 0
}
```

#### Error Response (422)

```json
{
  "detail": {
    "success": false,
    "error": "Poor signal quality: 3 bad segments detected (max allowed: 2)",
    "bad_segments": 3
  }
}
```

## React/Phone Demo Notes

- Phone and laptop must be on the same Wi-Fi.
- Use the laptop LAN IP for API requests (not `localhost`), with `https://`.
- The phone will show a self-signed certificate warning — tap "Advanced" and proceed to accept it once.
- If the React dev server is running on the laptop, also bind it to `0.0.0.0` and open it via LAN IP on the phone.

## Old Files

Archived versions are in the `old` folder.
