"""Generic identity-document field extraction and paired comparison."""

from __future__ import annotations

import difflib
import re
from typing import Any

import numpy as np

try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None


FIELD_LABELS: dict[str, tuple[str, ...]] = {
    "name": ("name", "full name", "candidate name", "student name"),
    "student_id": ("student id", "studentid", "id no", "id number"),
    "registration_number": ("reg no", "reg.no", "registration no", "registration number", "document no", "document no.", "doc no", "document number"),
    "prn": ("prn", "permanent registration number"),
    "roll_number": ("roll no", "roll number", "roll"),
    "date_of_birth": ("date of birth", "dob", "birth date"),
    "department": ("department", "dept", "branch", "faculty"),
    "course": ("course", "program", "programme", "class"),
    "academic_year": ("academic year", "academic yr", "year"),
    "validity": ("valid upto", "valid up to", "validity", "expires", "expiry"),
    "institution_name": ("institution", "university", "college", "school"),
    "father_name": ("father's name", "father name", "father", "fathers name", "parent name", "fathershlame"),
    "pan_number": ("permanent account number card", "permanent account number", "pan no", "pan number", "pan card"),
    "aadhaar_number": ("distinguished permanent number", "aadhaar", "aadhaar no", "aadhaar number", "uid"),
    "gender": ("gender", "sex"),
}

_NORMAL = re.compile(r"[^a-z0-9]+")
_OCR_SEPARATORS = re.compile(r"[|¦·•]+")


def _norm(value: str) -> str:
    value = str(value or "").replace("–", "-").replace("—", "-").replace("−", "-")
    value = _OCR_SEPARATORS.sub(" ", value).lower()
    return _NORMAL.sub(" ", value).strip()


def _comparison(reference: dict, evidence: dict, field_type: str) -> tuple[str, float, list[str]]:
    ref, ev = reference["normalizedText"], evidence["normalizedText"]
    if ref == ev:
        return "MATCH", 0.98, ["normalized OCR text matches"]
    similarity = difflib.SequenceMatcher(None, ref, ev).ratio()
    ref_tokens, ev_tokens = ref.split(), ev.split()
    if field_type in {"date_of_birth", "registration_number", "student_id", "prn", "roll_number", "pan_number", "aadhaar_number"}:
        ref_digits = "".join(c for c in ref if c.isdigit())
        ev_digits = "".join(c for c in ev if c.isdigit())
        if ref_digits and ev_digits and ref_digits != ev_digits:
            return "MISMATCH", 0.92, [f"numerical/identifier token mismatch: '{ref_digits}' vs '{ev_digits}'"]
        if (len(ev_tokens) > len(ref_tokens) and ev_tokens[:len(ref_tokens)] == ref_tokens
                and len(ev_tokens) - len(ref_tokens) <= 2
                and all(len(token) <= 8 for token in ev_tokens[len(ref_tokens):])):
            return "UNRELIABLE_OCR", 0.48, ["identifier plus short trailing OCR token"]
        if similarity >= 0.92:
            return "LIKELY_MATCH", 0.62, [f"identifier similarity {similarity:.3f}"]
    if similarity >= 0.86:
        return "LIKELY_MATCH", 0.68, [f"normalized text similarity {similarity:.3f}"]
    if similarity >= 0.55:
        return "LIKELY_MISMATCH", 0.68, [f"normalized text similarity {similarity:.3f}"]
    return "MISMATCH", 0.90 if field_type == "name" else 0.85, ["normalized OCR text mismatch", f"text similarity {similarity:.3f}"]


def _label_match(text: str) -> tuple[str, int] | None:
    value = _norm(text)
    for field, labels in FIELD_LABELS.items():
        for label in labels:
            if value == _norm(label):
                return field, 1
    return None


def _label_spans(words: list[dict]) -> dict[int, tuple[str, int]]:
    """Match single- and multi-token labels across normal OCR line breaks."""
    spans: dict[int, tuple[str, int]] = {}
    for start, word in enumerate(words):
        for field_type, labels in FIELD_LABELS.items():
            for label in labels:
                tokens = _norm(label).split()
                if not tokens or start + len(tokens) > len(words):
                    continue
                candidate = words[start:start + len(tokens)]
                if [_norm(str(item.get("text", ""))) for item in candidate] != tokens:
                    continue
                if any(abs(float(item.get("top", 0)) - float(word.get("top", 0))) > max(18, float(word.get("height", 12)) * 1.8) for item in candidate):
                    continue
                if any(float(candidate[i + 1].get("left", 0)) < float(candidate[i].get("left", 0)) for i in range(len(candidate) - 1)):
                    continue
                spans[start] = (field_type, start + len(tokens) - 1)
                break
            if start in spans:
                break
    return spans


def _box(word: dict, shape) -> dict[str, float]:
    h, w = shape[:2]
    return {"x": word["left"] / w, "y": word["top"] / h, "width": word["width"] / w, "height": word["height"] / h}


def _sort_reading_order(words: list[dict], line_thresh: float = 12.0) -> list[dict]:
    if not words:
        return []
    sorted_by_y = sorted(words, key=lambda w: float(w.get("top", 0)))
    lines: list[list[dict]] = []
    for w in sorted_by_y:
        placed = False
        for line in lines:
            line_top = float(np.mean([float(item.get("top", 0)) for item in line]))
            line_h = float(np.mean([float(item.get("height", 12)) for item in line]))
            if abs(float(w.get("top", 0)) - line_top) <= max(line_thresh, line_h * 0.6):
                line.append(w)
                placed = True
                break
        if not placed:
            lines.append([w])
    lines.sort(key=lambda line: float(np.mean([float(item.get("top", 0)) for item in line])))
    result = []
    for line in lines:
        line.sort(key=lambda item: float(item.get("left", 0)))
        result.extend(line)
    return result


def extract_fields(words: list[dict], shape) -> list[dict]:
    """Extract only fields supported by visible OCR labels; never invent missing fields."""
    usable = [word for word in words if str(word.get("text", "")).strip() and float(word.get("conf", -1)) >= 20]
    fields: list[dict] = []
    spans = _label_spans(usable)
    for index, label_word in enumerate(usable):
        span = spans.get(index)
        if span is None:
            match = _label_match(str(label_word["text"]).strip().rstrip(":"))
            if not match:
                continue
            field_type, _ = match
            label_end = index
        else:
            field_type, label_end = span
        label_tail = usable[label_end]
        label_indices = set(range(index, label_end + 1))
        inline_words = [
            word for idx, word in enumerate(usable)
            if idx not in label_indices
            and word["left"] > label_tail["left"] + label_tail["width"] * 0.4
            and word["left"] <= label_tail["left"] + label_tail["width"] + max(180.0, float(label_tail["height"]) * 6.0)
            and abs(float(word["top"]) - float(label_tail["top"])) <= max(10.0, min(16.0, float(label_tail["height"]) * 0.7))
        ]
        below_words = [
            word for idx, word in enumerate(usable)
            if idx not in label_indices
            and float(word["top"]) > max(float(label_tail["top"]), float(label_word["top"])) + 4
            and float(word["top"]) <= max(float(label_tail["top"]), float(label_word["top"])) + max(55.0, float(label_tail["height"]) * 4.5)
            and word["left"] >= label_word["left"] - 20
            and word["left"] <= label_word["left"] + max(250.0, float(label_tail["width"]) * 4.0)
        ]
        cand_words = inline_words if inline_words else below_words
        cand_words = _sort_reading_order(cand_words)
        if field_type == "pan_number" and inline_words:
            first_w = _norm(inline_words[0].get("text", ""))
            if first_w in {"card", "patra", "cardcard", "card card"} and below_words:
                cand_words = _sort_reading_order(below_words)
        if not cand_words:
            continue
        first_line_top = cand_words[0]["top"]
        first_line_height = cand_words[0]["height"]
        value_words: list[dict] = []
        prev_right = cand_words[0]["left"]
        for word in cand_words[:8]:
            if abs(word["top"] - first_line_top) > max(16.0, first_line_height * 1.5):
                break
            if value_words and (word["left"] - prev_right > max(55.0, first_line_height * 2.8)):
                break
            if value_words and _label_match(str(word["text"]).strip().rstrip(":")):
                break
            value_words.append(word)
            prev_right = word["left"] + word["width"]
        if not value_words:
            continue
        x0 = min(word["left"] for word in value_words)
        y0 = min(word["top"] for word in value_words)
        x1 = max(word["left"] + word["width"] for word in value_words)
        y1 = max(word["top"] + word["height"] for word in value_words)
        label_conf = float(label_word.get("conf", 0)) / 100.0
        value_conf = float(np.mean([float(word.get("conf", 0)) for word in value_words])) / 100.0
        raw_text = " ".join(str(word["text"]).strip() for word in value_words).strip(" :")
        fields.append({
            "fieldType": field_type,
            "text": raw_text,
            "rawText": raw_text,
            "normalizedText": _norm(raw_text),
            "bbox": {"x": x0 / shape[1], "y": y0 / shape[0], "width": (x1 - x0) / shape[1], "height": (y1 - y0) / shape[0]},
            "confidence": round(max(0.0, min(1.0, 0.5 * label_conf + 0.5 * value_conf)), 3),
        })
    # Keep the highest-confidence observation if OCR sees a label more than once.
    unique: dict[str, dict] = {}
    for field in fields:
        if field["fieldType"] not in unique or field["confidence"] > unique[field["fieldType"]]["confidence"]:
            unique[field["fieldType"]] = field
    return list(unique.values())


def _validate_identity_document(fields: list[dict], words: list[dict], shape: tuple[int, int]) -> list[dict]:
    """Validate internal field consistency and domain formats for single-document analysis."""
    findings = []
    field_map = {f["fieldType"]: f for f in fields}
    h, w = shape[:2]
    full_text = " ".join(str(w.get("text", "")) for w in words)
    upper_text = full_text.upper()

    # 1. PAN card validation
    is_pan = ("PERMANENT ACCOUNT" in upper_text or "INCOME TAX" in upper_text or "PAN CARD" in upper_text or ("GOVT" in upper_text and "INDIA" in upper_text and "ACCOUNT" in upper_text))
    if is_pan:
        pan_field = field_map.get("pan_number")
        pan_raw = pan_field.get("rawText", "") if pan_field else ""

        # Build candidate tokens: single tokens and concatenated adjacent pairs (for split OCR tokens)
        raw_candidates: list[str] = []
        for i, w in enumerate(words):
            clean_w = re.sub(r"[^A-Z0-9]", "", str(w.get("text", "")).upper())
            if len(clean_w) >= 6:
                raw_candidates.append(clean_w)
            if i + 1 < len(words):
                clean_pair = re.sub(r"[^A-Z0-9]", "", (str(w.get("text", "")) + str(words[i + 1].get("text", ""))).upper())
                if 8 <= len(clean_pair) <= 12:
                    raw_candidates.append(clean_pair)

        def _is_valid_pan_str(s: str) -> bool:
            if re.match(r"^[A-Z]{3,5}[0-9]{4}[A-Z]$", s):
                return True
            # Check OCR substitutions if length 10: 5 letters, 4 digits, 1 letter
            if len(s) == 10:
                prefix = s[:5]
                digits = s[5:9].replace("O", "0").replace("I", "1").replace("Z", "2").replace("S", "5").replace("B", "8")
                suffix = s[9]
                if re.match(r"^[A-Z]{5}$", prefix) and digits.isdigit() and suffix.isalpha():
                    return True
            return False

        valid_pan_cand = next((c for c in raw_candidates if _is_valid_pan_str(c)), None)
        valid_pan = valid_pan_cand is not None

        if pan_field:
            cleaned = re.sub(r"[^A-Z0-9]", "", pan_raw.upper())
            # If pan_field captured header noise ('Card', etc.) or noisy text but a valid candidate is present, adopt it
            if not _is_valid_pan_str(cleaned) and valid_pan_cand:
                pan_raw = valid_pan_cand
                pan_field["rawText"] = valid_pan_cand
                pan_field["text"] = valid_pan_cand
                pan_field["normalizedText"] = _norm(valid_pan_cand)
                cleaned = valid_pan_cand

            if not _is_valid_pan_str(cleaned):
                ocr_confs = [w.get("conf", 0) for w in words if w.get("conf", -1) >= 0]
                avg_conf = float(np.mean(ocr_confs)) if ocr_confs else 0.0
                if len(cleaned) >= 7 and avg_conf >= 55.0 and cleaned not in {"CARD", "PATRA", "NUMBER"}:
                    findings.append({
                        "fieldType": "pan_number",
                        "type": "PAN-SYNTAX",
                        "comparisonState": "INVALID_FORMAT",
                        "referenceText": "Valid Indian PAN format [A-Z]{3,5}[0-9]{4}[A-Z]",
                        "evidenceText": pan_raw,
                        "bbox": pan_field.get("bbox", {"x": 0.24, "y": 0.50, "width": 0.40, "height": 0.08}),
                        "confidence": 0.88,
                        "evidence": [f"Permanent Account Number '{pan_raw}' violates standard PAN syntax."],
                    })
                else:
                    findings.append({
                        "fieldType": "pan_number",
                        "type": "OCR-UNRELIABLE",
                        "comparisonState": "LOW_CONFIDENCE_SCAN",
                        "referenceText": "Standard Indian PAN [A-Z]{3,5}[0-9]{4}[A-Z]",
                        "evidenceText": pan_raw or "Unreadable PAN string",
                        "bbox": pan_field.get("bbox", {"x": 0.24, "y": 0.50, "width": 0.40, "height": 0.08}),
                        "confidence": 0.40,
                        "evidence": ["OCR resolution or contrast was insufficient for reliable PAN verification."],
                    })
        elif not valid_pan:
            ocr_confs = [w.get("conf", 0) for w in words if w.get("conf", -1) >= 0]
            avg_conf = float(np.mean(ocr_confs)) if ocr_confs else 0.0
            has_readable_identity = ("name" in field_map or "father_name" in field_map or len(words) >= 35)
            if has_readable_identity and len(words) >= 20 and avg_conf >= 40.0:
                findings.append({
                    "fieldType": "pan_number",
                    "type": "PAN-SYNTAX",
                    "comparisonState": "MISSING_OR_CORRUPT",
                    "referenceText": "Standard Indian PAN [A-Z]{3,5}[0-9]{4}[A-Z]",
                    "evidenceText": "Unreadable or corrupt PAN number",
                    "bbox": {"x": 0.24, "y": 0.50, "width": 0.40, "height": 0.08},
                    "confidence": 0.85,
                    "evidence": ["Document identified as PAN card but contains no valid PAN string structure."],
                })
            else:
                findings.append({
                    "fieldType": "pan_number",
                    "type": "OCR-UNRELIABLE",
                    "comparisonState": "LOW_CONFIDENCE_SCAN",
                    "referenceText": "Standard Indian PAN [A-Z]{3,5}[0-9]{4}[A-Z]",
                    "evidenceText": "OCR resolution insufficient to parse PAN number",
                    "bbox": {"x": 0.24, "y": 0.50, "width": 0.40, "height": 0.08},
                    "confidence": 0.40,
                    "evidence": ["OCR confidence or word count was insufficient for reliable PAN verification."],
                })

        # Name / Father's Name consistency check (only when middle name is not a common title/name)
        name_field = field_map.get("name")
        father_field = field_map.get("father_name")
        if name_field and father_field:
            name_tokens = name_field.get("normalizedText", "").split()
            father_tokens = father_field.get("normalizedText", "").split()
            NON_PATRONYMIC = {
                "kumar", "kumari", "singh", "kaur", "prasad", "chandra", "chand", "lal",
                "devi", "nath", "prakash", "swaroop", "kant", "dayal", "bhai", "ben", "rao",
                "sharma", "verma", "gupta", "das", "ali", "ahmed", "hussain", "khan", "mohan",
                "charan", "dutt", "mani", "saran", "ratan", "kiran", "rani", "sen", "shekhar", "deep",
            }
            if len(name_tokens) >= 3 and len(father_tokens) >= 1:
                middle_name = name_tokens[1]
                father_first = father_tokens[0]
                if middle_name.lower() not in NON_PATRONYMIC and middle_name != father_first and len(middle_name) > 2 and len(father_first) > 2:
                    findings.append({
                        "fieldType": "father_name",
                        "type": "ID-MISMATCH",
                        "comparisonState": "INCONSISTENT_NAME",
                        "referenceText": f"Father given name matching middle name '{middle_name}'",
                        "evidenceText": father_field.get("text", ""),
                        "bbox": father_field.get("bbox", {"x": 0.24, "y": 0.28, "width": 0.40, "height": 0.08}),
                        "confidence": 0.85,
                        "evidence": [f"Cardholder patronymic '{middle_name}' conflicts with father name '{father_field.get('text')}'."],
                    })

    # 2. Aadhaar / Identity card validation
    is_aadhaar = ("UNIQUE IDENTIFICATION" in upper_text or "AADHAAR" in upper_text or "E-KYC" in upper_text or ("GOVERNMENT" in upper_text and "INDIA" in upper_text and "UIDAI" in upper_text))
    if is_aadhaar:
        dob_field = field_map.get("date_of_birth")
        if dob_field:
            dob_text = dob_field.get("text", "").strip()
            dob_normalized = re.sub(r"\s*([/.-])\s*", r"\1", dob_text)
            has_valid_date = (
                bool(re.search(r"\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[012])[-/.](19\d\d|20\d\d)\b", dob_normalized))
                or bool(re.search(r"\b(19\d\d|20\d\d)[-/.](0[1-9]|1[012])[-/.](0[1-9]|[12][0-9]|3[01])\b", dob_normalized))
                or bool(re.search(r"(?:year of birth|yob|birth)\s*[:\-]?\s*(19\d\d|20\d\d)\b", dob_text, re.IGNORECASE))
                or (bool(re.search(r"\b(19\d\d|20\d\d)\b", dob_text)) and sum(c.isdigit() for c in dob_text) == 4)
            )
            if not has_valid_date:
                ocr_confs = [w.get("conf", 0) for w in words if w.get("conf", -1) >= 0]
                avg_conf = float(np.mean(ocr_confs)) if ocr_confs else 0.0
                if len(words) >= 12 and (avg_conf >= 35.0 or len(words) >= 20):
                    findings.append({
                        "fieldType": "date_of_birth",
                        "type": "ID-MISMATCH",
                        "comparisonState": "INVALID_FORMAT",
                        "referenceText": "Valid Date of Birth (DD/MM/YYYY)",
                        "evidenceText": dob_text,
                        "bbox": dob_field.get("bbox", {"x": 0.25, "y": 0.35, "width": 0.30, "height": 0.08}),
                        "confidence": 0.85,
                        "evidence": [f"Date of birth field contains invalid or corrupted date string '{dob_text}'."],
                    })
                else:
                    findings.append({
                        "fieldType": "date_of_birth",
                        "type": "OCR-UNRELIABLE",
                        "comparisonState": "LOW_CONFIDENCE_SCAN",
                        "referenceText": "Valid Date of Birth (DD/MM/YYYY)",
                        "evidenceText": dob_text or "Unreadable date string",
                        "bbox": dob_field.get("bbox", {"x": 0.25, "y": 0.35, "width": 0.30, "height": 0.08}),
                        "confidence": 0.40,
                        "evidence": ["Date of birth could not be conclusively verified from available OCR resolution."],
                    })

    return findings


def _decode_codes(image) -> list[str]:
    if cv2 is None or image is None:
        return []
    values: list[str] = []
    try:
        detector = cv2.QRCodeDetector()
        ok, decoded, _, _ = detector.detectAndDecodeMulti(image)
        if ok and decoded:
            values.extend(str(value).strip() for value in decoded if str(value).strip())
        value, _, _ = detector.detectAndDecode(image)
        if value and value.strip() not in values:
            values.append(value.strip())
    except Exception:
        pass
    return values


def analyze_identity(image, ocr, reference_image=None, reference_ocr=None) -> dict[str, Any]:
    shape = image.shape[:2] if image is not None else (1, 1)
    fields = extract_fields(getattr(ocr, "words", []) if ocr else [], shape)
    result: dict[str, Any] = {"fields": fields, "fieldFindings": [], "fieldComparisons": [], "codes": _decode_codes(image), "referenceCodes": [], "visualFindings": []}
    if reference_image is None or reference_ocr is None:
        internal_findings = _validate_identity_document(fields, getattr(ocr, "words", []) if ocr else [], shape)
        result["fieldFindings"].extend(internal_findings)
        return result
    reference_shape = reference_image.shape[:2]
    reference_fields = {field["fieldType"]: field for field in extract_fields(getattr(reference_ocr, "words", []), reference_shape)}
    evidence_fields = {field["fieldType"]: field for field in fields}
    for field_type in sorted(set(reference_fields) | set(evidence_fields)):
        reference_field = reference_fields.get(field_type)
        evidence_field = evidence_fields.get(field_type)
        if reference_field is None or evidence_field is None:
            # Absence is reported as a comparison difference, never as a
            # suspicious missing field by itself.
            comparison = {
                "fieldType": field_type,
                "type": "OCR_FIELD_REMOVED" if evidence_field is None else "OCR_FIELD_ADDED",
                "referenceText": reference_field["text"] if reference_field else None,
                "evidenceText": evidence_field["text"] if evidence_field else None,
                "bbox": (evidence_field or reference_field)["bbox"],
                "confidence": 0.82,
                "evidence": ["field exists in only one compared exhibit"],
            }
            result["fieldComparisons"].append(comparison)
            result["fieldFindings"].append(comparison)
            continue
        position_delta = abs(reference_field["bbox"]["x"] - evidence_field["bbox"]["x"]) + abs(reference_field["bbox"]["y"] - evidence_field["bbox"]["y"])
        state, confidence, comparison_evidence = _comparison(reference_field, evidence_field, field_type)
        result["fieldComparisons"].append({
            "fieldType": field_type, "comparisonState": state,
            "referenceText": reference_field["text"], "evidenceText": evidence_field["text"],
            "referenceRawText": reference_field["rawText"], "evidenceRawText": evidence_field["rawText"],
            "referenceNormalizedText": reference_field["normalizedText"], "evidenceNormalizedText": evidence_field["normalizedText"],
            "bbox": evidence_field["bbox"], "confidence": round(confidence, 3), "evidence": comparison_evidence,
        })
        if state not in {"MATCH", "LIKELY_MATCH"}:
            result["fieldFindings"].append({
                "fieldType": field_type,
                "type": "OCR_FIELD_MISMATCH" if state in {"MISMATCH", "LIKELY_MISMATCH"} else "OCR_FIELD_UNRELIABLE",
                "comparisonState": state,
                "referenceText": reference_field["text"],
                "referenceRawText": reference_field["rawText"],
                "referenceNormalizedText": reference_field["normalizedText"],
                "evidenceText": evidence_field["text"],
                "evidenceRawText": evidence_field["rawText"],
                "evidenceNormalizedText": evidence_field["normalizedText"],
                "bbox": evidence_field["bbox"],
                "confidence": round(confidence, 3),
                "evidence": comparison_evidence,
            })
        elif position_delta > 0.08:
            result["fieldFindings"].append({
                "fieldType": field_type, "type": "OCR_FIELD_POSITION_CHANGE",
                "comparisonState": "LIKELY_MATCH",
                "referenceText": reference_field["text"], "evidenceText": evidence_field["text"],
                "bbox": evidence_field["bbox"], "confidence": 0.72,
                "evidence": [f"normalized bbox displacement {position_delta:.3f}"],
            })
    result["referenceCodes"] = _decode_codes(reference_image)
    if sorted(result["codes"]) != sorted(result["referenceCodes"]) and (result["codes"] or result["referenceCodes"]):
        result["fieldFindings"].append({
            "fieldType": "qr_or_barcode", "type": "QR_BARCODE_MISMATCH",
            "referenceText": "; ".join(result["referenceCodes"]), "evidenceText": "; ".join(result["codes"]),
            "bbox": {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0}, "confidence": 0.95,
            "evidence": ["decoded payloads differ between reference and evidence"],
        })
    return result
