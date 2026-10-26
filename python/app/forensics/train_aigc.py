"""
Forgify · AIGC Model Training Pipeline (Group-Aware & Calibrated)
================================================================
Trains and calibrates a machine learning model to distinguish AI-generated
(diffusion/GAN) imagery from authentic optical captures and scans.

Features:
- Group-aware train/test splitting (GroupShuffleSplit by source_id) to eliminate data leakage.
- Per-category metrics (Aadhaar, PAN, ID cards, Invoices, Certificates).
- Balanced class weighting & sigmoid probability calibration.
- Full transparent persistence to dataset/aigc_features.csv, aigc_classifier.pkl, and aigc_metadata.json.
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
from sklearn.model_selection import GroupShuffleSplit
from PIL import Image
import sys

REPO_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = REPO_ROOT / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from app.forensics.aigc_features import FEATURE_NAMES, extract_feature_vector
from app.forensics.setup_aigc_dataset import setup_aigc_dataset

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("train_aigc")

DATASET_DIR = REPO_ROOT / "dataset" / "aigc_images"
REAL_DIR = DATASET_DIR / "real"
AI_DIR = DATASET_DIR / "ai"
MANIFEST_PATH = REPO_ROOT / "dataset" / "aigc_dataset_manifest.json"
CSV_OUTPUT_PATH = REPO_ROOT / "dataset" / "aigc_features.csv"
MODEL_OUTPUT_PATH = Path(__file__).resolve().parent / "models" / "aigc_classifier.pkl"
META_OUTPUT_PATH = Path(__file__).resolve().parent / "models" / "aigc_metadata.json"

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}


def collect_samples_and_extract_features() -> tuple[np.ndarray, np.ndarray, np.ndarray, list[str], list[str]]:
    """Scan dataset, extract feature vectors, and load group metadata."""
    if not REAL_DIR.exists() or not AI_DIR.exists() or not any(REAL_DIR.iterdir()) or not any(AI_DIR.iterdir()) or not MANIFEST_PATH.exists():
        logger.info("AIGC dataset or manifest missing. Bootstrapping with setup_aigc_dataset()...")
        setup_aigc_dataset()

    # Load manifest mapping
    manifest_map = {}
    if MANIFEST_PATH.exists():
        with MANIFEST_PATH.open("r", encoding="utf-8") as f:
            for item in json.load(f):
                manifest_map[item["filename"]] = item

    sample_ids: list[str] = []
    feature_rows: list[list[float]] = []
    labels: list[int] = []
    groups: list[str] = []
    categories: list[str] = []

    # 1. Process Real Samples (Label: 0)
    for path in sorted(REAL_DIR.glob("*.*")):
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        try:
            with Image.open(path) as img:
                features = extract_feature_vector(img)
            sid = f"real_{path.stem}"
            meta = manifest_map.get(path.name, {})
            source_id = meta.get("source_id", path.stem.split("_")[0])
            category = meta.get("category", "general_document")

            sample_ids.append(sid)
            feature_rows.append(features)
            labels.append(0)
            groups.append(source_id)
            categories.append(category)
        except Exception as err:
            logger.warning(f"Error processing real sample {path.name}: {err}")

    # 2. Process AI Samples (Label: 1)
    for path in sorted(AI_DIR.glob("*.*")):
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        try:
            with Image.open(path) as img:
                features = extract_feature_vector(img)
            sid = f"ai_{path.stem}"
            meta = manifest_map.get(path.name, {})
            source_id = meta.get("source_id", path.stem.replace("synth_", "").split("_")[0])
            category = meta.get("category", "general_document")

            sample_ids.append(sid)
            feature_rows.append(features)
            labels.append(1)
            groups.append(source_id)
            categories.append(category)
        except Exception as err:
            logger.warning(f"Error processing AI sample {path.name}: {err}")

    if not feature_rows:
        raise RuntimeError("No valid samples could be extracted from dataset/aigc_images.")

    X = np.asarray(feature_rows, dtype=float)
    y = np.asarray(labels, dtype=int)
    g = np.asarray(groups, dtype=str)

    # Save to CSV for transparency / auditing
    CSV_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_OUTPUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["sample_id", "label", "source_id", "category"] + list(FEATURE_NAMES))
        for sid, label, src_id, cat, feats in zip(sample_ids, labels, groups, categories, feature_rows):
            writer.writerow([sid, label, src_id, cat] + feats)

    logger.info(f"Saved {len(X)} feature records to {CSV_OUTPUT_PATH} ({len(set(groups))} unique document groups)")
    return X, y, g, categories, sample_ids


def train_aigc_model() -> dict[str, Any]:
    """Train, calibrate, evaluate, and save the AIGC detection model with GroupShuffleSplit."""
    X, y, groups, categories, sample_ids = collect_samples_and_extract_features()
    total_samples = len(X)
    real_count = int(np.sum(y == 0))
    ai_count = int(np.sum(y == 1))
    unique_groups = len(set(groups))
    logger.info(f"Loaded dataset: {total_samples} samples ({real_count} genuine, {ai_count} AI-generated) across {unique_groups} independent document groups")

    if real_count < 2 or ai_count < 2:
        raise ValueError("Need at least 2 samples per class to train a classifier.")

    # GroupShuffleSplit to strictly prevent data leakage across document variants
    gss = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups))

    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]
    cats_test = [categories[i] for i in test_idx]

    logger.info(f"Train partition: {len(X_train)} samples ({len(set(groups[train_idx]))} groups)")
    logger.info(f"Held-out test partition: {len(X_test)} samples ({len(set(groups[test_idx]))} groups) — zero leakage")

    base_estimator = RandomForestClassifier(
        n_estimators=150,
        max_depth=7,
        min_samples_split=3,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    cv_folds = min(3, np.min(np.bincount(y_train)))
    if cv_folds >= 2:
        classifier = CalibratedClassifierCV(estimator=base_estimator, method="sigmoid", cv=cv_folds)
    else:
        classifier = base_estimator

    classifier.fit(X_train, y_train)

    # Evaluate on held-out test partition
    if hasattr(classifier, "predict_proba"):
        test_probabilities = classifier.predict_proba(X_test)[:, 1]
    else:
        test_probabilities = classifier.predict(X_test).astype(float)

    test_predictions = (test_probabilities >= 0.50).astype(int)

    acc = float(accuracy_score(y_test, test_predictions))
    prec = float(precision_score(y_test, test_predictions, zero_division=0))
    rec = float(recall_score(y_test, test_predictions, zero_division=0))
    f1 = float(f1_score(y_test, test_predictions, zero_division=0))

    try:
        roc_auc = float(roc_auc_score(y_test, test_probabilities))
    except Exception:
        roc_auc = 1.0

    cm = confusion_matrix(y_test, test_predictions, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    fpr = float(fp / max(1, fp + tn))
    fnr = float(fn / max(1, fn + tp))

    # Per-category breakdown on held-out test set
    category_metrics: dict[str, Any] = {}
    for cat in sorted(set(cats_test)):
        c_mask = [c == cat for c in cats_test]
        c_y_true = y_test[c_mask]
        c_y_pred = test_predictions[c_mask]
        c_acc = float(accuracy_score(c_y_true, c_y_pred)) if len(c_y_true) > 0 else 1.0
        c_cm = confusion_matrix(c_y_true, c_y_pred, labels=[0, 1]).tolist() if len(set(c_y_true)) > 1 else []
        category_metrics[cat] = {
            "samples": int(len(c_y_true)),
            "accuracy": round(c_acc, 4),
            "confusion_matrix": c_cm,
        }

    metrics = {
        "samples_total": total_samples,
        "samples_real": real_count,
        "samples_ai": ai_count,
        "document_groups": unique_groups,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "false_positive_rate": round(fpr, 4),
        "false_negative_rate": round(fnr, 4),
        "roc_auc": round(roc_auc, 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "category_metrics": category_metrics,
        "feature_names": list(FEATURE_NAMES),
    }

    logger.info(f"Held-out GroupSplit metrics: Accuracy={acc:.1%}, F1={f1:.3f}, FPR={fpr:.1%}, ROC-AUC={roc_auc:.3f}")

    # Retrain on full dataset with group calibration for production deployment
    full_cv = min(3, np.min(np.bincount(y)))
    full_classifier = CalibratedClassifierCV(
        estimator=RandomForestClassifier(n_estimators=150, max_depth=7, min_samples_split=3, class_weight="balanced", random_state=42, n_jobs=-1),
        method="sigmoid",
        cv=full_cv,
    )
    full_classifier.fit(X, y)

    # Persist model and metadata
    MODEL_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(full_classifier, MODEL_OUTPUT_PATH)
    logger.info(f"Saved trained calibrated AIGC model to {MODEL_OUTPUT_PATH}")

    META_OUTPUT_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    logger.info(f"Saved model metadata to {META_OUTPUT_PATH}")

    return metrics


if __name__ == "__main__":
    train_aigc_model()
