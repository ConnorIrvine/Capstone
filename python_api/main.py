"""
HRV Analysis API

A FastAPI-based REST API for calculating Heart Rate Variability (HRV) RMSSD
from PPG (photoplethysmography) signal data with signal quality assessment.
"""

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
import numpy as np
import neurokit2 as nk
import os
import warnings

# Suppress warnings from neurokit2
warnings.filterwarnings("ignore")

app = FastAPI(
    title="HRV Analysis API",
    description="Calculate HRV RMSSD from PPG signal data with quality checks",
    version="1.0.0"
)


def _get_allowed_origins() -> List[str]:
    raw = os.getenv("HRV_ALLOWED_ORIGINS", "*").strip()
    if raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


allowed_origins = _get_allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HRVRequest(BaseModel):
    """Request model for HRV analysis"""

    ppg_data: List[float] = Field(
        ...,
        description="Array of PPG signal values",
        min_length=1000,
        example=[438, 445, 452, 460, 468]
    )
    sampling_rate: float = Field(
        ...,
        description="Sampling rate in Hz",
        gt=0,
        le=1000,
        example=100
    )
    max_bad_segments: int = Field(
        default=0,
        description="Maximum number of bad 3-second segments allowed (default: 0)",
        ge=0,
        example=0
    )

    @field_validator("ppg_data")
    @classmethod
    def validate_ppg_data(cls, v):
        """Validate PPG data array"""
        if not v:
            raise ValueError("ppg_data cannot be empty")
        if any(not isinstance(x, (int, float)) for x in v):
            raise ValueError("ppg_data must contain only numeric values")
        return v


class HRVResponse(BaseModel):
    """Response model for successful HRV calculation"""

    success: bool = Field(True, description="Indicates successful calculation")
    rmssd: float = Field(..., description="Calculated RMSSD value in milliseconds")
    bad_segments: int = Field(..., description="Number of bad 3-second segments detected")


class HRVErrorResponse(BaseModel):
    """Response model for failed HRV calculation"""

    success: bool = Field(False, description="Indicates calculation failure")
    error: str = Field(..., description="Error message describing what went wrong")
    bad_segments: int = Field(..., description="Number of bad 3-second segments detected")


def is_segment_bad(segment: np.ndarray, sampling_rate: float) -> bool:
    """
    Quick Signal Quality Index (SQI) checks to detect bad 3-second segments.

    Args:
        segment: Numpy array of PPG values for a 3-second segment
        sampling_rate: Sampling rate in Hz

    Returns:
        True if the segment is likely corrupted, False otherwise
    """
    if len(segment) == 0:
        return True

    seg = np.asarray(segment, dtype=float)

    # 1. Flatline / low variance check
    if np.std(seg) < 1.0:
        return True

    # 2. Clipping / saturation check (too many identical values)
    unique_ratio = len(np.unique(seg)) / len(seg)
    if unique_ratio < 0.02:
        return True

    # 3. Extreme jump check
    if np.max(np.abs(np.diff(seg))) > 2000:
        return True

    # 4. Peak plausibility check (very rough)
    try:
        peaks, _ = nk.ppg_peaks(seg, sampling_rate=sampling_rate)
        if "PPG_Peaks" in peaks:
            peak_count = int(np.sum(peaks["PPG_Peaks"]))
        else:
            peak_count = 0

        # For 3s segment, expect roughly 2-6 peaks at 40-120 bpm
        if peak_count < 2 or peak_count > 6:
            return True
    except Exception:
        return True

    return False


def analyze_window_quality(
    ppg_window: np.ndarray,
    sampling_rate: float,
    segment_sec: int = 3,
    max_bad_segments: int = 0
) -> tuple:
    """
    Split window into 3-second segments and check signal quality.

    Args:
        ppg_window: Array of PPG signal values
        sampling_rate: Sampling rate in Hz
        segment_sec: Length of each segment in seconds (default: 3)
        max_bad_segments: Maximum number of bad segments allowed (default: 0)

    Returns:
        Tuple of (is_bad, bad_segments_count)
    """
    seg_len = int(segment_sec * sampling_rate)
    if seg_len <= 0:
        return True, 0

    bad_segments = 0
    total_segments = len(ppg_window) // seg_len

    for i in range(total_segments):
        start = i * seg_len
        end = start + seg_len
        segment = ppg_window[start:end]
        if is_segment_bad(segment, sampling_rate):
            bad_segments += 1
            if bad_segments > max_bad_segments:
                return True, bad_segments

    return False, bad_segments


def calculate_hrv_rmssd(ppg_window: np.ndarray, sampling_rate: float) -> Optional[float]:
    """
    Calculate HRV using RMSSD (Root Mean Square of Successive Differences) from PPG signal.

    Args:
        ppg_window: Array of PPG signal values
        sampling_rate: Sampling rate in Hz

    Returns:
        RMSSD value in milliseconds, or None if calculation fails
    """
    try:
        signals, _ = nk.ppg_process(ppg_window, sampling_rate=sampling_rate)
        hrv_metrics = nk.ppg_intervalrelated(signals, sampling_rate=sampling_rate)
        rmssd = hrv_metrics["HRV_RMSSD"].values[0]
        return float(rmssd)
    except Exception:
        return None


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "HRV Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "/analyze": "POST - Analyze PPG data and calculate HRV RMSSD",
            "/docs": "GET - Interactive API documentation",
            "/health": "GET - Health check endpoint"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post(
    "/analyze",
    response_model=HRVResponse,
    responses={
        200: {"model": HRVResponse, "description": "Successful HRV calculation"},
        422: {"model": HRVErrorResponse, "description": "Signal quality too poor or calculation failed"}
    },
)
async def analyze_hrv(request: HRVRequest):
    """
    Analyze PPG data and calculate HRV RMSSD with signal quality assessment.

    This endpoint accepts PPG signal data and calculates the RMSSD (Root Mean Square
    of Successive Differences) metric for Heart Rate Variability analysis. It performs
    signal quality checks by dividing the data into 3-second segments and rejecting
    windows with too many bad segments.

    Args:
        request: HRVRequest containing ppg_data, sampling_rate, and max_bad_segments

    Returns:
        HRVResponse with rmssd value and bad_segments count on success

    Raises:
        HTTPException (422): If signal quality is too poor or HRV calculation fails
    """
    ppg_array = np.array(request.ppg_data)

    # Minimum data length check (at least 10 seconds)
    min_samples = int(request.sampling_rate * 10)
    if len(ppg_array) < min_samples:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "success": False,
                "error": (
                    f"Insufficient data: need at least {min_samples} samples "
                    f"({10} seconds), got {len(ppg_array)}"
                ),
                "bad_segments": 0,
            },
        )

    is_bad, bad_segments = analyze_window_quality(
        ppg_array,
        request.sampling_rate,
        segment_sec=3,
        max_bad_segments=request.max_bad_segments,
    )

    if is_bad:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "success": False,
                "error": (
                    "Poor signal quality: "
                    f"{bad_segments} bad segments detected "
                    f"(max allowed: {request.max_bad_segments})"
                ),
                "bad_segments": bad_segments,
            },
        )

    rmssd = calculate_hrv_rmssd(ppg_array, request.sampling_rate)

    if rmssd is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "success": False,
                "error": "HRV calculation failed: unable to process PPG signal",
                "bad_segments": bad_segments,
            },
        )

    return HRVResponse(
        success=True,
        rmssd=rmssd,
        bad_segments=bad_segments,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
