"""
Forgify · AIGC Dataset Setup & Seeder
======================================
Prepares the directory structure for training the AI-generated image detection
model and seeds starter samples from the workspace documents corpus.
Includes genuine Aadhaar, PAN, and ID card exhibits alongside real and synthetic
generative AI exhibits.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
import numpy as np
from PIL import Image

try:
    import cv2
except ImportError:
    cv2 = None

REPO_ROOT = Path(__file__).resolve().parents[3]
DATASET_DIR = REPO_ROOT / "dataset" / "aigc_images"
REAL_DIR = DATASET_DIR / "real"
AI_DIR = DATASET_DIR / "ai"
DOCUMENTS_DIR = REPO_ROOT / "documents"


def _simulate_synthetic_decoder_artifacts(img: Image.Image, seed: int = 42) -> Image.Image:
    """
    Simulate transposed-convolution / diffusion VAE upsampler grid artifacts on an image.
    This creates realistic synthetic frequency signatures (periodic grid peaks,
    chromatic channel decorrelation, and soft residual texture) for dataset training.
    """
    arr = np.array(img.convert("RGB")).astype(np.float32)
    h, w, c = arr.shape
    rng = np.random.default_rng(seed)

    # 1. Periodic checkerboard & latent upsampler grid (4px & 8px transposed conv artifact)
    yy, xx = np.indices((h, w))
    grid4 = (np.sin(xx * (2 * np.pi / 4)) * np.cos(yy * (2 * np.pi / 4))) * 8.0
    grid8 = (np.sin(xx * (2 * np.pi / 8)) * np.cos(yy * (2 * np.pi / 8))) * 6.0
    grid = grid4 + grid8
    for ch in range(c):
        arr[:, :, ch] += grid * (0.8 + 0.4 * rng.random())

    # 2. Diffusion decoder high-frequency smoothing
    if cv2 is not None:
        blurred = cv2.GaussianBlur(arr, (5, 5), 1.0)
        arr = 0.75 * arr + 0.25 * blurred

    # 3. Add subtle high-frequency latent noise
    if cv2 is not None:
        noise_grid = cv2.GaussianBlur(rng.normal(0, 6.0, (h, w, c)).astype(np.float32), (3, 3), 0.5)
        arr += noise_grid

    clipped = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(clipped)


def setup_aigc_dataset() -> dict[str, int]:
    """Create dataset folders and seed starter samples."""
    # Reset directories to avoid stale or unbalanced duplicates
    if REAL_DIR.exists():
        shutil.rmtree(REAL_DIR)
    if AI_DIR.exists():
        shutil.rmtree(AI_DIR)
    REAL_DIR.mkdir(parents=True, exist_ok=True)
    AI_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Seed genuine real samples from all genuine sources
    real_count = 0
    genuine_sources: list[Path] = []
    
    # Genuine documents directory
    genuine_sources.extend((REPO_ROOT / "dataset" / "genuine_documents").glob("*.*"))
    # Public documents (clean Aadhaar, PAN, templates)
    genuine_sources.extend((REPO_ROOT / "public" / "documents").glob("*clean*.*"))
    genuine_sources.extend((REPO_ROOT / "public" / "documents").glob("*template*.*"))
    genuine_sources.extend((REPO_ROOT / "public" / "documents").glob("*pancard*.*"))
    # Genuine ID cards corpus
    genuine_sources.extend((REPO_ROOT / "documents" / "dataset" / "original" / "id_card").glob("*.png"))
    # Pilot genuine references
    genuine_sources.extend((REPO_ROOT / "documents" / "dataset" / "pilot" / "references").glob("*.png"))
    # Public samples
    genuine_sources.extend((REPO_ROOT / "public" / "samples").glob("*.jpg"))

    seen_stems = set()
    for p in genuine_sources:
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} and p.stat().st_size > 5000:
            stem = p.stem.lower()
            if stem in seen_stems:
                continue
            seen_stems.add(stem)
            dest = REAL_DIR / p.name
            shutil.copy2(p, dest)
            real_count += 1

    # 1b. Add realistic benign transformations for genuine documents
    # (resizing, JPEG recompression, mild crop) to model real-world scanner/upload variations
    base_real_files = sorted(list(REAL_DIR.glob("*.*")))
    for idx, r_file in enumerate(base_real_files):
        if r_file.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        try:
            with Image.open(r_file) as im:
                rgb_im = im.convert("RGB")
                # Benign JPEG recompression (every 2nd file)
                if idx % 2 == 0:
                    q_dest = REAL_DIR / f"{r_file.stem}_benign_q80.jpg"
                    rgb_im.save(q_dest, format="JPEG", quality=80)
                    real_count += 1
                # Benign resize (every 3rd file)
                if idx % 3 == 0:
                    w, h = rgb_im.size
                    new_size = (int(w * 0.88), int(h * 0.88))
                    resized_im = rgb_im.resize(new_size, Image.Resampling.BILINEAR)
                    r_dest = REAL_DIR / f"{r_file.stem}_benign_resized.png"
                    resized_im.save(r_dest, format="PNG")
                    real_count += 1
                # Benign mild crop (every 4th file)
                if idx % 4 == 0:
                    w, h = rgb_im.size
                    crop_box = (int(w * 0.02), int(h * 0.02), int(w * 0.98), int(h * 0.98))
                    cropped_im = rgb_im.crop(crop_box)
                    c_dest = REAL_DIR / f"{r_file.stem}_benign_crop.png"
                    cropped_im.save(c_dest, format="PNG")
                    real_count += 1
        except Exception as err:
            print(f"Failed to create benign real variant for {r_file}: {err}")

    # 2. Seed synthetic/AI samples
    ai_count = 0
    # Include true AI exhibits (e.g. Gemini, Midjourney, DALL-E)
    ai_exhibits_dir = REPO_ROOT / "dataset" / "ai_exhibits"
    if ai_exhibits_dir.exists():
        for p in ai_exhibits_dir.glob("*.*"):
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} and p.stat().st_size > 5000:
                dest = AI_DIR / p.name
                shutil.copy2(p, dest)
                ai_count += 1

    # Generate synthetic samples with simulated diffusion decoder signatures from base genuine files
    for idx, real_file in enumerate(base_real_files):
        if real_file.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        try:
            with Image.open(real_file) as im:
                synth = _simulate_synthetic_decoder_artifacts(im, seed=idx * 17 + 101)
                synth_path = AI_DIR / f"synth_{real_file.stem}.png"
                synth.save(synth_path, format="PNG")
                ai_count += 1
                # Save compressed JPEG version for every alternate image
                if idx % 2 == 0:
                    synth_jpg = AI_DIR / f"synth_{real_file.stem}_q80.jpg"
                    synth.save(synth_jpg, format="JPEG", quality=80)
                    ai_count += 1
        except Exception as err:
            print(f"Failed to generate synthetic sample from {real_file}: {err}")

    summary = {
        "real_count": real_count,
        "ai_count": ai_count,
        "dataset_path": str(DATASET_DIR),
    }
    print(f"AIGC Dataset setup complete: {real_count} real samples, {ai_count} synthetic samples in {DATASET_DIR}")
    return summary


if __name__ == "__main__":
    setup_aigc_dataset()
