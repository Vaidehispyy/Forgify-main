"""
Forgify · AIGC and Synthetic Document Evaluation Benchmark
==========================================================
Evaluates the dedicated Generative-AI image detection capability across
genuine documents, synthetic generative exhibits, and AI-generated ID cards.
Measures Accuracy, Precision, Recall, F1, FPR, FNR, ROC-AUC, and Confusion Matrix.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from app.main import app
from evaluation.identity_card import binary_metrics, auc

client = TestClient(app)
REPO_ROOT = Path(__file__).resolve().parents[2]


def evaluate_aigc_documents() -> dict[str, Any]:
    test_cases = [
        # 1. Genuine documents
        ("dataset/genuine_documents/workspace_aadhaar_clean.jpg", False, "genuine_aadhaar"),
        ("dataset/genuine_documents/workspace_pan_clean.jpg", False, "genuine_pan"),
        ("dataset/genuine_documents/workspace_invoice_clean.jpg", False, "genuine_invoice"),
        ("dataset/genuine_documents/workspace_marksheet_clean.jpg", False, "genuine_marksheet"),
        ("dataset/genuine_documents/genuine_certificate_sample.jpg", False, "genuine_certificate"),
        ("dataset/genuine_documents/genuine_bill_coffee.jpg", False, "genuine_bill"),
        ("documents/aadhaar_clean.jpg", False, "clean_aadhaar_fixture"),
        ("documents/pan_clean.jpg", False, "clean_pan_fixture"),
        # 2. AI-generated / Synthetic documents & exhibits
        ("dataset/ai_exhibits/ai_generated_aadhaar_rohit.png", True, "ai_aadhaar_card"),
        ("dataset/ai_exhibits/gemini_generated_vertical_farm.jpg", True, "gemini_ai_exhibit"),
        ("dataset/aigc_images/ai/synth_aadhaar_clean.png", True, "synth_aadhaar_diffusion"),
        ("dataset/aigc_images/ai/synth_pan_clean.png", True, "synth_pan_diffusion"),
        ("dataset/aigc_images/ai/synth_invoice_clean.png", True, "synth_invoice_diffusion"),
        ("dataset/aigc_images/ai/synth_marksheet_clean.png", True, "synth_marksheet_diffusion"),
        ("dataset/aigc_images/ai/synth_genuine_bill_coffee.png", True, "synth_bill_diffusion"),
        ("dataset/aigc_images/ai/synth_aadhaar_clean_q80.jpg", True, "synth_aadhaar_compressed"),
    ]

    labels = []
    predictions = []
    scores = []
    case_results = []

    for rel_path, is_ai, label_desc in test_cases:
        p = REPO_ROOT / rel_path
        if not p.is_file():
            continue
        labels.append(is_ai)

        resp = client.post("/analyze", files={"file": (p.name, p.read_bytes(), "image/png" if p.suffix == ".png" else "image/jpeg")})
        rep = resp.json()

        verdict = rep.get("verdict", {})
        risk = int(verdict.get("riskScore", 0))
        aigc_layer = next((l for l in rep.get("layers", []) if l.get("layer") == "aigc"), {})
        aigc_score = float(aigc_layer.get("score", 0.0))
        aigc_status = aigc_layer.get("status", "pass")
        has_ai_alert = any(f.get("code") == "AI-GEN" for f in rep.get("findings", []))

        pred = (aigc_score >= 0.50 or has_ai_alert or risk >= 60)
        predictions.append(pred)
        scores.append(aigc_score)

        case_results.append({
            "case": label_desc,
            "filename": p.name,
            "expected_ai": is_ai,
            "predicted_ai": pred,
            "aigc_score": round(aigc_score, 4),
            "aigc_status": aigc_status,
            "fused_risk": risk,
            "verdict": verdict.get("label"),
            "correct": (pred == is_ai),
        })

    metrics = binary_metrics(labels, predictions)
    roc = auc(labels, scores)

    cm = metrics["confusionMatrix"]
    total = sum(cm.values()) if sum(cm.values()) > 0 else 1
    accuracy = (cm["tp"] + cm["tn"]) / total

    summary = {
        "benchmark": "Forgify AIGC Synthetic Document Benchmark",
        "sampleCount": len(labels),
        "realCount": len([l for l in labels if not l]),
        "aiCount": len([l for l in labels if l]),
        "confusionMatrix": cm,
        "accuracy": round(accuracy, 4),
        "precision": round(metrics["precision"], 4),
        "recall": round(metrics["recall"], 4),
        "f1": round(metrics["f1"], 4),
        "fpr": round(metrics["fpr"], 4),
        "fnr": round(metrics["fnr"], 4),
        "rocAuc": round(roc, 4) if roc is not None else None,
        "cases": case_results,
    }

    report_path = REPO_ROOT / "dataset" / "aigc_benchmark_report.json"
    report_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


if __name__ == "__main__":
    res = evaluate_aigc_documents()
    print("=== AIGC EVALUATION RESULTS ===")
    print(f"Accuracy:  {res['accuracy']:.1%}")
    print(f"Precision: {res['precision']:.3f}")
    print(f"Recall:    {res['recall']:.3f}")
    print(f"F1 Score:  {res['f1']:.3f}")
    print(f"ROC-AUC:   {res['rocAuc']:.3f}")
    print("Confusion Matrix (TP, TN, FP, FN):", res["confusionMatrix"])
    print("\nCase Details:")
    for c in res["cases"]:
        print(f"  {c['case']:28s} | Expected AI: {str(c['expected_ai']):5s} | Pred AI: {str(c['predicted_ai']):5s} | AIGC: {c['aigc_score']:.3f} | Risk: {c['fused_risk']:2d} ({c['verdict']}) | Correct: {c['correct']}")
