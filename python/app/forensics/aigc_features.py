"""
Forgify · AIGC Feature Extraction
=================================
Shared feature extraction pipeline for Generative-AI image detection.
Extracts frequency, spatial noise, and chromatic signatures that distinguish
synthetic generative decoders (diffusion/GAN) from physical optical sensors.
"""

from __future__ import annotations

import math
from typing import Any
import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None

from PIL import Image

FEATURE_NAMES: tuple[str, ...] = (
    "spectral_peak",
    "rolloff",
    "high_freq_energy",
    "noise_variance",
    "rg_diff",
    "rb_diff",
    "gb_diff",
    "autocorr_lag2",
    "autocorr_lag4",
    "pseudo_text_ratio",
    "corr_rb",
    "corr_rg",
    "lap_kurtosis",
)


def to_gray(image: np.ndarray) -> np.ndarray:
    """Convert an image array (BGR or RGB) to 2D grayscale."""
    if image.ndim == 2:
        return image
    if cv2 is not None:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return np.mean(image[:, :, :3], axis=2).astype(np.uint8)


def extract_aigc_features(
    image: np.ndarray | Image.Image,
    ocr: Any = None,
) -> dict[str, float]:
    """Extract numerical feature dict for an input image."""
    if isinstance(image, Image.Image):
        image = np.array(image.convert("RGB"))
        if cv2 is not None:
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

    if not isinstance(image, np.ndarray) or image.size == 0:
        return {name: 0.0 for name in FEATURE_NAMES}

    # Normalize to 3-channel if grayscale
    if image.ndim == 2:
        image = np.stack([image, image, image], axis=2)

    gray = to_gray(image).astype(np.float32)
    if cv2 is not None:
        gray = cv2.resize(gray, (512, 512), interpolation=cv2.INTER_AREA)
    else:
        gray = gray[:512, :512]

    # 1. 2-D FFT spectral analysis
    spectrum = np.log1p(np.abs(np.fft.fftshift(np.fft.fft2(gray))))
    h, w = spectrum.shape
    centre = np.array([h // 2, w // 2])
    yy, xx = np.ogrid[:h, :w]
    radius = np.sqrt((yy - centre[0]) ** 2 + (xx - centre[1]) ** 2)
    max_radius = radius.max() if radius.max() > 0 else 1.0

    outer_mask = radius > max_radius * 0.55
    mid_mask = (radius > max_radius * 0.25) & (radius <= max_radius * 0.55)

    outer = spectrum[outer_mask]
    mid = spectrum[mid_mask]

    spectral_peak = float(outer.max() - np.median(outer)) if outer.size else 0.0
    rolloff = float(np.median(mid) - np.median(outer)) if (mid.size and outer.size) else 0.0
    high_freq_energy = float(np.mean(outer)) if outer.size else 0.0

    # 2. Laplacian noise / spatial texture
    if cv2 is not None:
        lap = cv2.Laplacian(gray, cv2.CV_32F)
        noise_variance = float(lap.var())
        lap_std = float(lap.std())
        lap_kurtosis = float(np.mean(((lap - float(lap.mean())) / (lap_std + 1e-6)) ** 4)) if lap_std > 1e-4 else 0.0
    else:
        diff_y = np.diff(gray, axis=0)
        noise_variance = float(np.var(diff_y))
        diff_std = float(np.std(diff_y))
        lap_kurtosis = float(np.mean(((diff_y - float(np.mean(diff_y))) / (diff_std + 1e-6)) ** 4)) if diff_std > 1e-4 else 0.0

    # 3. Chromatic / inter-channel residual covariance & cross-channel correlation
    img_float = image.astype(np.float32)
    b, g, r = img_float[:, :, 0], img_float[:, :, 1], img_float[:, :, 2]
    rg_diff = float(np.std(r - g))
    rb_diff = float(np.std(r - b))
    gb_diff = float(np.std(g - b))
    try:
        corr_rb = float(np.corrcoef(r.ravel(), b.ravel())[0, 1])
        corr_rg = float(np.corrcoef(r.ravel(), g.ravel())[0, 1])
    except Exception:
        corr_rb, corr_rg = 1.0, 1.0
    if not math.isfinite(corr_rb):
        corr_rb = 1.0
    if not math.isfinite(corr_rg):
        corr_rg = 1.0

    # 4. Residual noise autocorrelation (detects periodic transposed-conv upsampling)
    corr2, corr4 = 0.0, 0.0
    if cv2 is not None:
        blurred = cv2.GaussianBlur(gray, (5, 5), 1.0)
        noise = gray - blurred
        if float(np.std(noise)) > 1e-4:
            try:
                corr2 = float(np.corrcoef(noise[:, :-2].ravel(), noise[:, 2:].ravel())[0, 1])
                corr4 = float(np.corrcoef(noise[:, :-4].ravel(), noise[:, 4:].ravel())[0, 1])
            except Exception:
                pass

    # 5. OCR pseudo-glyph ratio (diffusion text hallucination)
    pseudo_text_ratio = 0.0
    if ocr is not None:
        words = getattr(ocr, "words", []) or []
        if words:
            low_conf = [w for w in words if 0 <= float(w.get("conf", 100)) < 45]
            pseudo_text_ratio = float(len(low_conf) / len(words))

    features = {
        "spectral_peak": round(spectral_peak, 4),
        "rolloff": round(rolloff, 4),
        "high_freq_energy": round(high_freq_energy, 4),
        "noise_variance": round(noise_variance, 4),
        "rg_diff": round(rg_diff, 4),
        "rb_diff": round(rb_diff, 4),
        "gb_diff": round(gb_diff, 4),
        "autocorr_lag2": round(corr2, 4),
        "autocorr_lag4": round(corr4, 4),
        "pseudo_text_ratio": round(pseudo_text_ratio, 4),
        "corr_rb": round(corr_rb, 4),
        "corr_rg": round(corr_rg, 4),
        "lap_kurtosis": round(lap_kurtosis, 4),
    }

    # Ensure finite floats
    for k, v in features.items():
        if not math.isfinite(v):
            features[k] = 0.0

    return features


def extract_feature_vector(
    image: np.ndarray | Image.Image,
    ocr: Any = None,
) -> list[float]:
    """Return a flat list of features aligned with FEATURE_NAMES."""
    feat_dict = extract_aigc_features(image, ocr)
    return [feat_dict[name] for name in FEATURE_NAMES]
