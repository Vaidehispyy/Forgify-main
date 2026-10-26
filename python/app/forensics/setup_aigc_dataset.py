"""
Forgify · AIGC Dataset Setup & Seeder (Enhanced & Documented)
=============================================================
Prepares the directory structure for training the AI-generated image detection
model and seeds starter samples from the workspace documents corpus.
Includes separate categories for:
- Genuine Aadhaar samples
- Genuine PAN samples
- Other genuine identity, invoice, marksheet, certificate exhibits
- Multi-condition benign transformations (resizing, JPEG compression, contrast)
- True AI exhibits (Gemini, DALL-E, AI-generated Aadhaar)
- Realistic diffusion/GAN latent decoder signatures

Outputs:
- dataset/aigc_images/real/
- dataset/aigc_images/ai/
- dataset/aigc_dataset_manifest.json
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
import hashlib
import numpy as np
from PIL import Image, ImageEnhance

try:
    import cv2
except ImportError:
    cv2 = None

REPO_ROOT = Path(__file__).resolve().parents[3]
DATASET_DIR = REPO_ROOT / "dataset" / "aigc_images"
REAL_DIR = DATASET_DIR / "real"
AI_DIR = DATASET_DIR / "ai"
MANIFEST_PATH = REPO_ROOT / "dataset" / "aigc_dataset_manifest.json"


def _image_hash(path: Path) -> str:
    """Calculate MD5 for exact duplicate detection."""
    return hashlib.md5(path.read_bytes()).hexdigest()


def _get_document_category(filename: str) -> str:
    """Determine category from filename."""
    fn = filename.lower()
    if "aadhaar" in fn or "adhar" in fn:
        return "aadhaar"
    if "pan" in fn:
        return "pan"
    if "id_card" in fn or "idp" in fn or "student" in fn:
        return "identity_card"
    if "invoice" in fn or "bill" in fn or "receipt" in fn:
        return "invoice_receipt"
    if "marksheet" in fn:
        return "marksheet"
    if "certificate" in fn:
        return "certificate"
    return "general_document"


def _simulate_synthetic_decoder_artifacts(img: Image.Image, seed: int = 42) -> Image.Image:
    """
    Simulate transposed-convolution / diffusion VAE latent decoder artifacts.
    Generates periodic checkerboard grid peaks and inter-channel chromatic decorrelation
    characteristic of latent diffusion decoders without artificially wiping out
    spatial noise variance below real scanned documents.
    """
    arr = np.array(img.convert("RGB")).astype(np.float32)
    h, w, c = arr.shape
    rng = np.random.default_rng(seed)

    # 1. Periodic checkerboard & latent upsampler grid (4px & 8px transposed conv artifact)
    yy, xx = np.indices((h, w))
    grid4 = (np.sin(xx * (2 * np.pi / 4)) * np.cos(yy * (2 * np.pi / 4))) * 7.5
    grid8 = (np.sin(xx * (2 * np.pi / 8)) * np.cos(yy * (2 * np.pi / 8))) * 5.0
    grid = grid4 + grid8

    # 2. Diffusion VAE chromatic decorrelation (subtle independent latent space synthesis noise)
    chroma_b = rng.normal(0, 10.0, (h, w)).astype(np.float32)
    chroma_g = rng.normal(0, 6.5, (h, w)).astype(np.float32)
    chroma_r = rng.normal(0, 11.5, (h, w)).astype(np.float32)

    arr[:, :, 0] += grid * 1.1 + chroma_b
    arr[:, :, 1] += grid * 0.9 + chroma_g
    arr[:, :, 2] += grid * 1.2 + chroma_r

    # 3. High-frequency residual texture
    noise_grid = rng.normal(0, 4.0, (h, w, c)).astype(np.float32)
    arr += noise_grid

    clipped = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(clipped)


def setup_aigc_dataset() -> dict[str, Any]:
    """Create dataset folders, build structured samples, and write manifest."""
    if REAL_DIR.exists():
        shutil.rmtree(REAL_DIR)
    if AI_DIR.exists():
        shutil.rmtree(AI_DIR)
    REAL_DIR.mkdir(parents=True, exist_ok=True)
    AI_DIR.mkdir(parents=True, exist_ok=True)

    manifest: list[dict[str, Any]] = []
    seen_hashes: set[str] = set()
    base_real_files: list[tuple[Path, str, str]] = []

    # 1. Gather genuine source files
    genuine_sources: list[Path] = []
    genuine_sources.extend((REPO_ROOT / "dataset" / "genuine_documents").glob("*.*"))
    genuine_sources.extend((REPO_ROOT / "public" / "documents").glob("*clean*.*"))
    genuine_sources.extend((REPO_ROOT / "public" / "documents").glob("*template*.*"))
    genuine_sources.extend((REPO_ROOT / "public" / "documents").glob("*pancard*.*"))
    genuine_sources.extend((REPO_ROOT / "documents" / "dataset" / "original" / "id_card").glob("*.png"))
    genuine_sources.extend((REPO_ROOT / "documents" / "dataset" / "pilot" / "references").glob("*.png"))

    for p in sorted(genuine_sources):
        if p.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"} or p.stat().st_size < 5000:
            continue
        # Deduplication
        file_hash = _image_hash(p)
        if file_hash in seen_hashes:
            continue
        seen_hashes.add(file_hash)

        source_id = p.stem.lower()
        doc_category = _get_document_category(p.name)

        dest = REAL_DIR / p.name
        shutil.copy2(p, dest)
        base_real_files.append((dest, source_id, doc_category))

        manifest.append({
            "filename": p.name,
            "path": f"real/{p.name}",
            "label": 0,
            "label_name": "genuine",
            "source_id": source_id,
            "category": doc_category,
            "condition": "pristine",
        })

    # 1b. Add realistic multi-condition benign transformations for genuine documents
    for dest_file, source_id, doc_category in base_real_files:
        try:
            with Image.open(dest_file) as im:
                rgb_im = im.convert("RGB")
                w, h = rgb_im.size

                # A. Resizing (scale 0.75x and 0.88x) — models resolution downsampling
                r75_size = (max(64, int(w * 0.75)), max(64, int(h * 0.75)))
                r75_im = rgb_im.resize(r75_size, Image.Resampling.BILINEAR)
                r75_name = f"{source_id}_resized_75.png"
                r75_im.save(REAL_DIR / r75_name, format="PNG")
                manifest.append({
                    "filename": r75_name,
                    "path": f"real/{r75_name}",
                    "label": 0,
                    "label_name": "genuine",
                    "source_id": source_id,
                    "category": doc_category,
                    "condition": "resize_75",
                })

                # B. JPEG recompression (quality 65 and 80)
                q65_name = f"{source_id}_q65.jpg"
                rgb_im.save(REAL_DIR / q65_name, format="JPEG", quality=65)
                manifest.append({
                    "filename": q65_name,
                    "path": f"real/{q65_name}",
                    "label": 0,
                    "label_name": "genuine",
                    "source_id": source_id,
                    "category": doc_category,
                    "condition": "jpeg_q65",
                })

                q80_name = f"{source_id}_q80.jpg"
                rgb_im.save(REAL_DIR / q80_name, format="JPEG", quality=80)
                manifest.append({
                    "filename": q80_name,
                    "path": f"real/{q80_name}",
                    "label": 0,
                    "label_name": "genuine",
                    "source_id": source_id,
                    "category": doc_category,
                    "condition": "jpeg_q80",
                })

                # C. Mild contrast adjustment (0.85x — models scanner wash / matte card)
                c_im = ImageEnhance.Contrast(rgb_im).enhance(0.85)
                c_name = f"{source_id}_contrast_low.jpg"
                c_im.save(REAL_DIR / c_name, format="JPEG", quality=82)
                manifest.append({
                    "filename": c_name,
                    "path": f"real/{c_name}",
                    "label": 0,
                    "label_name": "genuine",
                    "source_id": source_id,
                    "category": doc_category,
                    "condition": "contrast_low",
                })

                # D. Mild border crop (2% margins)
                crop_box = (int(w * 0.02), int(h * 0.02), int(w * 0.98), int(h * 0.98))
                crop_im = rgb_im.crop(crop_box)
                crop_name = f"{source_id}_crop.png"
                crop_im.save(REAL_DIR / crop_name, format="PNG")
                manifest.append({
                    "filename": crop_name,
                    "path": f"real/{crop_name}",
                    "label": 0,
                    "label_name": "genuine",
                    "source_id": source_id,
                    "category": doc_category,
                    "condition": "crop",
                })
        except Exception as err:
            print(f"Failed to generate benign variations for {dest_file.name}: {err}")

    # 2. Add true AI exhibits
    ai_exhibits_dir = REPO_ROOT / "dataset" / "ai_exhibits"
    if ai_exhibits_dir.exists():
        for p in sorted(ai_exhibits_dir.glob("*.*")):
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} and p.stat().st_size > 5000:
                dest = AI_DIR / p.name
                shutil.copy2(p, dest)
                doc_cat = _get_document_category(p.name)
                manifest.append({
                    "filename": p.name,
                    "path": f"ai/{p.name}",
                    "label": 1,
                    "label_name": "ai_generated",
                    "source_id": p.stem.lower(),
                    "category": doc_cat,
                    "condition": "true_ai_exhibit",
                })

    # 3. Add synthetic diffusion-decoder exhibits derived from base genuine files
    for idx, (dest_file, source_id, doc_category) in enumerate(base_real_files):
        try:
            with Image.open(dest_file) as im:
                synth = _simulate_synthetic_decoder_artifacts(im, seed=idx * 23 + 107)
                synth_name = f"synth_{source_id}.png"
                synth.save(AI_DIR / synth_name, format="PNG")
                manifest.append({
                    "filename": synth_name,
                    "path": f"ai/{synth_name}",
                    "label": 1,
                    "label_name": "ai_generated",
                    "source_id": source_id,
                    "category": doc_category,
                    "condition": "synth_diffusion_png",
                })

                # Also save JPEG re-compressed synthetic variant
                synth_jpg_name = f"synth_{source_id}_q80.jpg"
                synth.save(AI_DIR / synth_jpg_name, format="JPEG", quality=80)
                manifest.append({
                    "filename": synth_jpg_name,
                    "path": f"ai/{synth_jpg_name}",
                    "label": 1,
                    "label_name": "ai_generated",
                    "source_id": source_id,
                    "category": doc_category,
                    "condition": "synth_diffusion_q80",
                })

                # Also save resized synthetic variant
                w_s, h_s = synth.size
                synth_r75 = synth.resize((max(64, int(w_s * 0.75)), max(64, int(h_s * 0.75))), Image.Resampling.BILINEAR)
                synth_r_name = f"synth_{source_id}_resized_75.png"
                synth_r75.save(AI_DIR / synth_r_name, format="PNG")
                manifest.append({
                    "filename": synth_r_name,
                    "path": f"ai/{synth_r_name}",
                    "label": 1,
                    "label_name": "ai_generated",
                    "source_id": source_id,
                    "category": doc_category,
                    "condition": "synth_diffusion_resized",
                })
        except Exception as err:
            print(f"Failed to generate synthetic variant for {dest_file.name}: {err}")

    # Write manifest JSON
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MANIFEST_PATH.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    real_count = len([m for m in manifest if m["label"] == 0])
    ai_count = len([m for m in manifest if m["label"] == 1])
    categories = sorted(set(m["category"] for m in manifest))

    summary = {
        "total_samples": len(manifest),
        "real_count": real_count,
        "ai_count": ai_count,
        "categories": categories,
        "manifest_path": str(MANIFEST_PATH),
    }
    print(f"Setup complete: {len(manifest)} total samples ({real_count} real, {ai_count} AI) across categories: {categories}")
    return summary


if __name__ == "__main__":
    setup_aigc_dataset()
