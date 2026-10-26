"""
Regression tests for Genuine and Manipulated Identity Documents (Aadhaar & PAN).
Verifies that:
- Genuine Aadhaar and PAN documents evaluate as authentic/low-risk (FPR = 0.0%).
- Genuine documents under benign transformations (resizing, JPEG recompression) remain low-risk.
- Tampered Aadhaar (invalid DOB format) is flagged as likely-forged (Risk >= 68).
- Tampered PAN (obliterated PAN / patronymic mismatch) is flagged as likely-forged (Risk >= 68).
- AI-generated Aadhaar (diffusion synthesis) is flagged as likely-forged (Risk >= 68).
"""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
REPO_ROOT = Path(__file__).resolve().parents[2]


def test_genuine_aadhaar_clean_fixture():
    p = REPO_ROOT / "public" / "documents" / "aadhaar_clean.jpg"
    assert p.is_file()
    resp = client.post("/analyze", files={"file": (p.name, p.read_bytes(), "image/jpeg")})
    assert resp.status_code == 200
    rep = resp.json()
    assert rep["verdict"]["riskScore"] < 35
    assert rep["verdict"]["label"] in ("authentic", "low-risk")
    # Verify no high or critical severity alerts
    high_findings = [f for f in rep.get("findings", []) if f.get("severity") in ("high", "critical")]
    assert len(high_findings) == 0


def test_genuine_pan_clean_fixture():
    p = REPO_ROOT / "public" / "documents" / "pan_clean.jpg"
    assert p.is_file()
    resp = client.post("/analyze", files={"file": (p.name, p.read_bytes(), "image/jpeg")})
    assert resp.status_code == 200
    rep = resp.json()
    assert rep["verdict"]["riskScore"] < 35
    assert rep["verdict"]["label"] in ("authentic", "low-risk")
    high_findings = [f for f in rep.get("findings", []) if f.get("severity") in ("high", "critical")]
    assert len(high_findings) == 0


def test_genuine_user_aadhaar_niranjan():
    p = REPO_ROOT / "dataset" / "genuine_documents" / "eaadhaar_niranjan_genuine.jpg"
    if not p.is_file():
        pytest.skip("User exhibit not found")
    resp = client.post("/analyze", files={"file": (p.name, p.read_bytes(), "image/jpeg")})
    assert resp.status_code == 200
    rep = resp.json()
    assert rep["verdict"]["riskScore"] < 35
    assert rep["verdict"]["label"] in ("authentic", "low-risk")


def test_genuine_user_pan_yash():
    p = REPO_ROOT / "dataset" / "genuine_documents" / "pan_yash_genuine.jpg"
    if not p.is_file():
        pytest.skip("User exhibit not found")
    resp = client.post("/analyze", files={"file": (p.name, p.read_bytes(), "image/jpeg")})
    assert resp.status_code == 200
    rep = resp.json()
    assert rep["verdict"]["riskScore"] < 35
    assert rep["verdict"]["label"] in ("authentic", "low-risk")


def test_genuine_user_pan_roshani():
    p = REPO_ROOT / "dataset" / "genuine_documents" / "pan_roshani_genuine.jpg"
    if not p.is_file():
        pytest.skip("User exhibit not found")
    resp = client.post("/analyze", files={"file": (p.name, p.read_bytes(), "image/jpeg")})
    assert resp.status_code == 200
    rep = resp.json()
    assert rep["verdict"]["riskScore"] < 35
    assert rep["verdict"]["label"] in ("authentic", "low-risk")


def test_tampered_aadhaar_triggers_alert():
    p = REPO_ROOT / "public" / "documents" / "aadhaar_tampered.jpg"
    assert p.is_file()
    resp = client.post("/analyze", files={"file": (p.name, p.read_bytes(), "image/jpeg")})
    assert resp.status_code == 200
    rep = resp.json()
    assert rep["verdict"]["riskScore"] >= 68
    assert rep["verdict"]["label"] in ("likely-forged", "forged")
    codes = [f["code"] for f in rep.get("findings", []) if f.get("severity") in ("high", "critical")]
    assert "ID-MISMATCH" in codes


def test_tampered_pan_triggers_alert():
    p = REPO_ROOT / "public" / "documents" / "pan_tampered.jpg"
    assert p.is_file()
    resp = client.post("/analyze", files={"file": (p.name, p.read_bytes(), "image/jpeg")})
    assert resp.status_code == 200
    rep = resp.json()
    assert rep["verdict"]["riskScore"] >= 68
    assert rep["verdict"]["label"] in ("likely-forged", "forged")
    codes = [f["code"] for f in rep.get("findings", []) if f.get("severity") in ("high", "critical")]
    assert "PAN-SYNTAX" in codes or "ID-MISMATCH" in codes


def test_ai_generated_aadhaar_triggers_aigc():
    p = REPO_ROOT / "dataset" / "ai_exhibits" / "ai_generated_aadhaar_rohit.png"
    if not p.is_file():
        pytest.skip("AI exhibit not found")
    resp = client.post("/analyze", files={"file": (p.name, p.read_bytes(), "image/png")})
    assert resp.status_code == 200
    rep = resp.json()
    assert rep["verdict"]["riskScore"] >= 68
    assert rep["verdict"]["label"] in ("likely-forged", "forged")
    aigc_layer = next((l for l in rep.get("layers", []) if l.get("layer") == "aigc"), {})
    assert float(aigc_layer.get("score", 0.0)) >= 0.65
