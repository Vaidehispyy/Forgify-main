"""Evidence fusion, verdict mapping and recommendation text (mirrors fusion.ts)."""

from __future__ import annotations

import math


FAMILY_WEIGHTS = {
    "pixel/residual": 0.18,
    "generative-ai": 0.16,
    "structural/reference": 0.22,
    "semantic": 0.22,
    "encoded-data": 0.10,
    "file-history": 0.08,
    "copy-move": 0.04,
}


def _family_for(layer_id: str) -> str:
    return {
        "pixel": "pixel/residual", "deep-tamper-srm": "pixel/residual", "ml-classifier": "pixel/residual",
        "aigc": "generative-ai",
        "layout": "semantic", "semantic": "semantic",
        "qr-barcode": "encoded-data", "metadata": "file-history", "compression": "file-history",
        "copy-move": "copy-move", "reference": "structural/reference",
    }.get(layer_id, "file-history")


def _finding_family(finding: dict) -> str | None:
    code = str(finding.get("code", ""))
    # Specific comparative findings must be classified before the generic
    # REF-* structural bucket.
    if code.startswith(("AI-", "AIGC-", "SYNTH-")):
        return "generative-ai"
    if code.startswith(("REF-FIELD", "REF-TEXT", "OCR_FIELD", "SEM-", "LY-")):
        return "semantic"
    if code.startswith(("QR_", "REF-QR")):
        return "encoded-data"
    if code.startswith(("MD-", "META-", "COMP-", "CQ-")):
        return "file-history"
    if code.startswith(("CM-", "COPY-")):
        return "copy-move"
    if code.startswith("REF-"):
        return "structural/reference"
    if code.startswith(("PX-", "SRM-", "ML-")):
        return "pixel/residual"
    return None


def fuse(layer_results: list[dict], findings: list[dict]) -> dict:
    executed = [layer for layer in layer_results if layer.get("status") != "skipped"]
    family_layers: dict[str, list[dict]] = {family: [] for family in FAMILY_WEIGHTS}
    for layer in executed:
        family_layers.setdefault(_family_for(layer["layer"]), []).append(layer)
    family_findings: dict[str, int] = {family: 0 for family in FAMILY_WEIGHTS}
    for item in findings:
        family = _finding_family(item)
        if family:
            family_findings[family] += 1

    # Within a family use the strongest calibrated member, with only a small
    # diminishing boost for corroborating members. This prevents ELA+SRM+noise
    # from behaving like three independent observations.
    family_scores = {}
    for family, members in family_layers.items():
        values = sorted((float(m.get("score", 0)) for m in members), reverse=True)
        if not values:
            family_scores[family] = 0.0
            continue
        family_scores[family] = min(1.0, values[0] + sum(v * (0.12 / (i + 1)) for i, v in enumerate(values[1:], start=1)))
        family_scores[family] = min(1.0, family_scores[family] + min(0.08, family_findings[family] * 0.01))
    active_families = [family for family, score in family_scores.items() if score > 0]
    family_mass = {family: FAMILY_WEIGHTS[family] * family_scores[family] for family in FAMILY_WEIGHTS}
    mass = sum(family_mass.values())
    contributions = []
    for layer in layer_results:
        family = _family_for(layer["layer"])
        members = family_layers.get(family, [])
        member_total = sum(float(m.get("score", 0)) for m in members) or 1.0
        share = float(layer.get("score", 0)) / member_total if layer.get("status") != "skipped" else 0.0
        contribution = family_mass.get(family, 0.0) * share
        contributions.append({"layer": layer["layer"], "name": layer["name"], "weight": round(FAMILY_WEIGHTS.get(family, 0.0) * share, 4), "score": round(float(layer.get("score", 0)), 4), "contribution": round(contribution, 4), "status": layer.get("status", "pass")})
    risk = int(round(_calibrate(mass) * 100))

    # Evidence-specific integrity floors:
    # 1. Direct mathematical/arithmetic forgery (e.g., invoice total or marksheet sum breached)
    arith_alert = any(
        f.get("code") == "SEM-ARITH" and float(f.get("confidence", 0)) >= 0.70
        for f in findings
    )
    if arith_alert:
        risk = max(risk, 74)

    # 2. Reference comparison field tampering, barcode mismatch, or identity format violation
    ref_tamper = any(
        f.get("code") in {"REF-FIELD", "OCR_FIELD_MISMATCH", "QR_BARCODE_MISMATCH", "PAN-SYNTAX", "ID-MISMATCH"}
        and float(f.get("confidence", 0)) >= 0.70
        for f in findings
    )
    if ref_tamper:
        risk = max(risk, 72)

    # 3. Generative-AI integrity floor:
    # Activated on validated synthetic probability with high confidence
    ai_alert = any(
        l.get("layer") == "aigc" and l.get("status") == "alert" and float(l.get("score", 0)) >= 0.65 and float(l.get("confidence", 0)) >= 0.75
        for l in executed
    )
    if ai_alert:
        ai_layer = next(l for l in executed if l.get("layer") == "aigc")
        ai_score = float(ai_layer.get("score", 0))
        risk = max(risk, int(round(max(0.68, ai_score) * 100)))

    # Distinguish three separate forensic tasks internally:
    # A. Localized image manipulation (splicing, ELA, copy-move, SRM residuals)
    manip_scores = [float(l.get("score", 0)) for l in executed if l.get("layer") in {"pixel", "copy-move", "deep-tamper-srm"}]
    task_manipulation = round(max(manip_scores, default=0.0), 3)

    # B. AI-generated / synthetic origin (diffusion / GAN decoders, spectral grid, chromatic variance)
    aigc_layer = next((l for l in executed if l.get("layer") == "aigc"), None)
    task_synthetic = round(float(aigc_layer.get("score", 0.0)), 3) if aigc_layer else 0.0

    # C. Document consistency (semantic arithmetic, layout geometry, metadata, identity rules)
    consistency_layers = [float(l.get("score", 0)) for l in executed if l.get("layer") in {"semantic", "layout", "metadata", "qr-barcode"}]
    task_consistency = round(max(consistency_layers, default=0.0), 3)

    scores = [family_scores[family] for family in active_families]
    mean = sum(scores) / max(1, len(scores))
    variance = sum((value - mean) ** 2 for value in scores) / max(1, len(scores))
    stdev = math.sqrt(variance)
    agreement = round(max(0.0, 1 - stdev / 0.32), 3)

    mean_confidence = sum(max((m.get("confidence", 0.0) for m in family_layers[family]), default=0.0) for family in active_families) / max(1, len(active_families))
    coverage = len(active_families) / len(FAMILY_WEIGHTS)
    cross_family_bonus = min(0.16, max(0, len(active_families) - 1) * 0.04)
    confidence = round(min(0.98, 0.30 + mean_confidence * 0.26 + agreement * 0.12 + coverage * 0.16 + cross_family_bonus), 3)

    top = sorted(contributions, key=lambda item: item["contribution"], reverse=True)[:3]
    rationale = [
        f"Dependency-aware family evidence mass = {round(mass, 4)} across {len(active_families)} active families; correlated members are capped within each family, "
        f"calibrated through a logistic at midpoint 0.45 → risk {risk}/100.",
        "Dominant contributors: "
        + "; ".join(f"{item['name']} ({round(item['contribution'] * 100, 1)}%)" for item in top)
        + ".",
        f"Family agreement index {agreement} (σ = {round(stdev, 3)}).",
        f"{len([f for f in findings if f.get('severity') in {'high', 'critical'}])} high-or-critical finding(s) recorded.",
    ]

    return {
        "method": "confidence-weighted linear opinion pool → logistic calibration (midpoint 0.45, slope 5.2)",
        "riskScore": risk,
        "confidence": confidence,
        "agreement": agreement,
        "taskBreakdown": {
            "manipulationScore": task_manipulation,
            "syntheticScore": task_synthetic,
            "consistencyScore": task_consistency,
        },
        "entropy": 0.0,
        "alertCount": len([f for f in findings if f.get("severity") in {"high", "critical"}]),
        "contributions": contributions,
        "familyEvidence": [{"family": family, "score": round(family_scores[family], 4), "weight": FAMILY_WEIGHTS[family], "contribution": round(family_mass[family], 4), "members": [layer["layer"] for layer in family_layers[family]], "findingCount": family_findings[family]} for family in FAMILY_WEIGHTS],
        "rationale": rationale,
    }


def _calibrate(value: float) -> float:
    result = 1 / (1 + math.exp(-5.2 * (value - 0.45)))
    return min(0.995, max(0.005, result))


def verdict_for(risk: int) -> str:
    if risk >= 86:
        return "forged"
    if risk >= 68:
        return "likely-forged"
    if risk >= 45:
        return "suspicious"
    if risk >= 24:
        return "low-risk"
    return "authentic"


def recommendation(risk: int) -> str:
    if risk >= 68:
        return (
            "Converging evidence from independent layers indicates deliberate alteration. Quarantine the "
            "exhibit, open a formal case, and collect the source system for examiner-led acquisition."
        )
    if risk >= 45:
        return (
            "Multiple layers disagree with the container's declared history. Escalate to a senior examiner "
            "and request the original file before the exhibit is relied upon."
        )
    if risk >= 24:
        return "Minor container anomalies only. Request the original capture from the custodian for confirmation."
    return "No manipulation indicator exceeded threshold. Retain the exhibit and this report in the case file."


def case_code(seed: int) -> str:
    year = 2026
    return f"SF-{year}-{(seed % 900000) + 100000}"
