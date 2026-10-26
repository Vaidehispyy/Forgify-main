"""Baseline benchmark script to record precision, recall, F1, FPR, FNR, ROC-AUC, and fixture performance."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from app.main import app
from evaluation.identity_card import binary_metrics, auc, mask_from_regions

client = TestClient(app)
REPO_ROOT = Path(__file__).resolve().parents[2]


def run_pilot_benchmark(mode: str = "reference_free") -> dict[str, Any]:
    manifest_path = REPO_ROOT / "documents" / "dataset" / "pilot" / "manifest.json"
    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    samples = manifest.get("samples", [])
    labels = []
    predictions = []
    scores = []
    ious = []
    times = []

    for s in samples:
        evidence_path = REPO_ROOT / "documents" / "dataset" / s["evidenceImage"]
        ref_path = REPO_ROOT / "documents" / "dataset" / s["referenceImage"] if (mode == "reference_assisted" and s.get("referenceImage")) else None
        
        is_manipulated = (s.get("expectedDocumentStatus") != "genuine")
        labels.append(is_manipulated)

        t0 = time.time()
        files = {"file": (evidence_path.name, evidence_path.read_bytes(), "image/png")}
        if ref_path and ref_path.is_file():
            files["reference"] = (ref_path.name, ref_path.read_bytes(), "image/png")

        resp = client.post("/analyze", files=files)
        dur = time.time() - t0
        times.append(dur)

        rep = resp.json()
        risk = int(rep.get("verdict", {}).get("riskScore", 0))
        scores.append(risk / 100.0)
        # Threshold 45 is the boundary for suspicious/forged
        pred = (risk >= 45)
        predictions.append(pred)

        # IoU with mask if available
        mask_rel = s.get("mask_path")
        if mask_rel:
            mask_file = REPO_ROOT / "documents" / "dataset" / mask_rel
            if mask_file.is_file():
                from PIL import Image
                import numpy as np
                gt_mask = np.array(Image.open(mask_file).convert("1"))
                pred_mask = mask_from_regions(rep.get("unifiedRegions", []), gt_mask.shape[::-1])
                inter = np.logical_and(gt_mask, pred_mask).sum()
                union = np.logical_or(gt_mask, pred_mask).sum()
                iou = inter / union if union > 0 else 0.0
                ious.append(iou)

    metrics = binary_metrics(labels, predictions)
    roc = auc(labels, scores)
    mean_iou = float(sum(ious) / len(ious)) if ious else 0.0
    avg_time = float(sum(times) / len(times)) if times else 0.0

    return {
        "mode": mode,
        "sampleCount": len(samples),
        "confusionMatrix": metrics["confusionMatrix"],
        "precision": round(metrics["precision"], 4),
        "recall": round(metrics["recall"], 4),
        "f1": round(metrics["f1"], 4),
        "fpr": round(metrics["fpr"], 4),
        "fnr": round(metrics["fnr"], 4),
        "rocAuc": round(roc, 4) if roc is not None else None,
        "meanIoU": round(mean_iou, 4),
        "avgInferenceTimeSec": round(avg_time, 3),
    }


def run_fixtures_benchmark() -> dict[str, Any]:
    fixtures = [
        ("invoice_clean.jpg", "genuine"),
        ("invoice_tampered.jpg", "manipulated"),
        ("marksheet_clean.jpg", "genuine"),
        ("marksheet_tampered.jpg", "manipulated"),
        ("aadhaar_clean.jpg", "genuine"),
        ("aadhaar_tampered.jpg", "manipulated"),
        ("pan_clean.jpg", "genuine"),
        ("pan_tampered.jpg", "manipulated"),
    ]

    results = {}
    for fname, expected in fixtures:
        p = REPO_ROOT / "documents" / fname
        if not p.is_file():
            continue
        resp = client.post("/analyze", files={"file": (fname, p.read_bytes(), "image/jpeg")})
        rep = resp.json()
        risk = rep["verdict"]["riskScore"]
        label = rep["verdict"]["label"]
        alerts = [f["code"] for f in rep.get("findings", []) if f.get("severity") in ("high", "critical")]
        sem = next((l["score"] for l in rep["layers"] if l["layer"] == "semantic"), 0.0)
        aigc = next((l["score"] for l in rep["layers"] if l["layer"] == "aigc"), 0.0)
        results[fname] = {
            "expected": expected,
            "riskScore": risk,
            "verdict": label,
            "semanticScore": sem,
            "aigcScore": aigc,
            "alerts": alerts,
            "isCorrect": (expected == "genuine" and risk < 45) or (expected == "manipulated" and risk >= 45),
        }
    return results


def main():
    print("=== BASELINE EVALUATION ===")
    ref_free = run_pilot_benchmark("reference_free")
    print("Reference-Free Metrics:", json.dumps(ref_free, indent=2))

    ref_assisted = run_pilot_benchmark("reference_assisted")
    print("Reference-Assisted Metrics:", json.dumps(ref_assisted, indent=2))

    fixtures = run_fixtures_benchmark()
    print("Fixture Results:")
    for k, v in fixtures.items():
        print(f"  {k:24s} | Expected: {v['expected']:11s} | Risk: {v['riskScore']:2d} ({v['verdict']:14s}) | Correct: {v['isCorrect']} | Alerts: {v['alerts']}")

    output = {
        "reference_free": ref_free,
        "reference_assisted": ref_assisted,
        "fixtures": fixtures,
    }
    out_path = REPO_ROOT / "dataset" / "baseline_benchmark_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"Saved baseline results to {out_path}")


if __name__ == "__main__":
    main()
