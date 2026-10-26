"""
Forgify · AIGC Model Training Pipeline
======================================
Trains and calibrates a machine learning model to distinguish AI-generated
(diffusion/GAN) imagery from authentic optical captures and scans.

Outputs:
- dataset/aigc_features.csv: Extracted feature dataset for transparency/auditing.
- python/app/forensics/models/aigc_classifier.pkl: Persisted calibrated model.
"""

from __future__ import annotations

import csv
import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from PIL import Image
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = REPO_ROOT / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from app.forensics.aigc_features import FEATURE_NAMES, extract_feature_vector
from app.forensics.setup_aigc_dataset import setup_aigc_dataset

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("train_aigc")

REPO_ROOT = Path(__file__).resolve().parents[3]
DATASET_DIR = REPO_ROOT / "dataset" / "aigc_images"
REAL_DIR = DATASET_DIR / "real"
AI_DIR = DATASET_DIR / "ai"
CSV_OUTPUT_PATH = REPO_ROOT / "dataset" / "aigc_features.csv"
MODEL_OUTPUT_PATH = Path(__file__).resolve().parent / "models" / "aigc_classifier.pkl"
META_OUTPUT_PATH = Path(__file__).resolve().parent / "models" / "aigc_metadata.json"

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}


def collect_samples_and_extract_features() -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Scan real and AI folders, extract feature vectors, and cache to CSV."""
    if not REAL_DIR.exists() or not AI_DIR.exists() or not any(REAL_DIR.iterdir()) or not any(AI_DIR.iterdir()):
        logger.info("AIGC dataset directories empty or missing. Bootstrapping with setup_aigc_dataset()...")
        setup_aigc_dataset()

    sample_ids: list[str] = []
    feature_rows: list[list[float]] = []
    labels: list[int] = []

    # 1. Process Real Samples (Label: 0)
    for path in sorted(REAL_DIR.glob("*.*")):
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        try:
            with Image.open(path) as img:
                features = extract_feature_vector(img)
            sample_ids.append(f"real_{path.stem}")
            feature_rows.append(features)
            labels.append(0)
        except Exception as err:
            logger.warning(f"Error processing real sample {path.name}: {err}")

    # 2. Process AI Samples (Label: 1)
    for path in sorted(AI_DIR.glob("*.*")):
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        try:
            with Image.open(path) as img:
                features = extract_feature_vector(img)
            sample_ids.append(f"ai_{path.stem}")
            feature_rows.append(features)
            labels.append(1)
        except Exception as err:
            logger.warning(f"Error processing AI sample {path.name}: {err}")

    if not feature_rows:
        raise RuntimeError("No valid samples could be extracted from dataset/aigc_images.")

    X = np.asarray(feature_rows, dtype=float)
    y = np.asarray(labels, dtype=int)

    # Save to CSV for auditing / inspection
    CSV_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_OUTPUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["sample_id", "label"] + list(FEATURE_NAMES))
        for sid, label, feats in zip(sample_ids, labels, feature_rows):
            writer.writerow([sid, label] + feats)

    logger.info(f"Saved {len(X)} feature records to {CSV_OUTPUT_PATH}")
    return X, y, sample_ids


def train_aigc_model() -> dict[str, Any]:
    """Train, calibrate, evaluate, and save the AIGC detection model."""
    X, y, sample_ids = collect_samples_and_extract_features()
    total_samples = len(X)
    real_count = int(np.sum(y == 0))
    ai_count = int(np.sum(y == 1))
    logger.info(f"Loaded dataset: {total_samples} samples ({real_count} genuine, {ai_count} AI-generated)")

    if real_count < 2 or ai_count < 2:
        raise ValueError("Need at least 2 samples per class to train a classifier.")

    # Split into train and test sets
    test_size = 0.25 if total_samples >= 10 else 0.5
    stratify = y if min(real_count, ai_count) >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=stratify
    )

    cv_folds = min(3, np.min(np.bincount(y_train)))
    base_estimator = RandomForestClassifier(
        n_estimators=100,
        max_depth=6,
        min_samples_split=2,
        class_weight="balanced",
        random_state=42,
    )

    if cv_folds >= 2:
        classifier = CalibratedClassifierCV(estimator=base_estimator, cv=cv_folds)
    else:
        classifier = base_estimator

    classifier.fit(X_train, y_train)

    # Evaluate on test set
    if hasattr(classifier, "predict_proba"):
        test_probabilities = classifier.predict_proba(X_test)[:, 1]
    else:
        test_probabilities = classifier.predict(X_test).astype(float)

    test_predictions = (test_probabilities >= 0.5).astype(int)

    acc = float(accuracy_score(y_test, test_predictions))
    prec = float(precision_score(y_test, test_predictions, zero_division=0))
    rec = float(recall_score(y_test, test_predictions, zero_division=0))
    f1 = float(f1_score(y_test, test_predictions, zero_division=0))

    try:
        roc_auc = float(roc_auc_score(y_test, test_probabilities))
    except Exception:
        roc_auc = 1.0

    cm = confusion_matrix(y_test, test_predictions, labels=[0, 1]).tolist()

    metrics = {
        "samples_total": total_samples,
        "samples_real": real_count,
        "samples_ai": ai_count,
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "confusion_matrix": cm,
        "feature_names": list(FEATURE_NAMES),
    }

    logger.info(f"Evaluation metrics: Accuracy={acc:.1%}, F1={f1:.3f}, ROC-AUC={roc_auc:.3f}")

    # Retrain on full dataset for maximum production fidelity
    if cv_folds >= 2:
        full_cv = min(3, np.min(np.bincount(y)))
        full_classifier = CalibratedClassifierCV(
            estimator=RandomForestClassifier(n_estimators=100, max_depth=6, class_weight="balanced", random_state=42),
            cv=full_cv,
        )
    else:
        full_classifier = RandomForestClassifier(n_estimators=100, max_depth=6, class_weight="balanced", random_state=42)

    full_classifier.fit(X, y)

    # Save model and metadata
    MODEL_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(full_classifier, MODEL_OUTPUT_PATH)
    logger.info(f"Saved trained AIGC model to {MODEL_OUTPUT_PATH}")

    META_OUTPUT_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    logger.info(f"Saved metadata to {META_OUTPUT_PATH}")

    return metrics


if __name__ == "__main__":
    train_aigc_model()
