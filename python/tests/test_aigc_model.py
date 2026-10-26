"""
Tests for the AI-generated image detection (AIGC) feature extraction,
trained model inference, and module contract.
"""

from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from app.forensics.aigc_features import (
    FEATURE_NAMES,
    extract_aigc_features,
    extract_feature_vector,
)
from app.forensics.modules import AigcModule, AIGC_CLASSIFIER, AIGC_MODEL_PATH


def test_extract_aigc_features_keys_and_values():
    """Verify all 8 features are returned as finite floats."""
    img = np.random.randint(0, 256, (200, 200, 3), dtype=np.uint8)
    feats = extract_aigc_features(img)
    assert set(feats.keys()) == set(FEATURE_NAMES)
    for k, v in feats.items():
        assert isinstance(v, float)
        assert np.isfinite(v)

    vec = extract_feature_vector(img)
    assert len(vec) == len(FEATURE_NAMES)
    assert all(isinstance(x, float) and np.isfinite(x) for x in vec)


def test_extract_aigc_features_with_pil_image():
    """Verify PIL Image input works identically."""
    im = Image.new("RGB", (128, 128), color=(100, 150, 200))
    feats = extract_aigc_features(im)
    assert len(feats) == len(FEATURE_NAMES)
    assert feats["spectral_peak"] >= 0.0


def test_aigc_module_contract_with_live_image():
    """Verify AigcModule returns a valid LayerResult dict."""
    module = AigcModule()
    img = np.random.randint(50, 200, (256, 256, 3), dtype=np.uint8)
    context = {"image": img, "_ocr": None}

    result = module.run(context)
    assert result["layer"] == "aigc"
    assert 0.0 <= result["score"] <= 1.0
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["status"] in {"pass", "review", "alert"}
    assert isinstance(result["findings"], list)
    assert len(result["findings"]) >= 1
    assert result["findings"][0]["layer"] == "aigc"
    assert result["findings"][0]["code"] in {"AI-GEN", "AI-SPEC"}
    assert isinstance(result["metrics"], list)
    assert any(m["label"] == "AI probability" for m in result["metrics"])


def test_aigc_model_file_exists_and_predicts():
    """Verify the persisted model loads and outputs calibrated probabilities."""
    assert AIGC_MODEL_PATH.is_file(), f"Model file missing: {AIGC_MODEL_PATH}"
    assert AIGC_CLASSIFIER is not None, "AIGC_CLASSIFIER failed to load"

    img = np.zeros((128, 128, 3), dtype=np.uint8)
    vec = np.asarray([extract_feature_vector(img)], dtype=float)

    probs = AIGC_CLASSIFIER.predict_proba(vec)[0]
    assert len(probs) == 2
    assert 0.0 <= probs[1] <= 1.0
    assert np.isclose(np.sum(probs), 1.0)


def test_aigc_module_graceful_fallback_without_image():
    """When raster is unavailable, module returns neutral 0.0 score."""
    module = AigcModule()
    result = module.run({"image": None})
    assert result["layer"] == "aigc"
    assert result["score"] == 0.0
    assert result["findings"] == []
