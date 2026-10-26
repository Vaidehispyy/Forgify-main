"""
Download genuine, authentic public-domain receipts, invoices, IDs, and document scans
from Wikimedia Commons for the Forgify dataset.
"""

from __future__ import annotations

import json
import shutil
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
GENUINE_DIR = REPO_ROOT / "dataset" / "genuine_documents"
AIGC_REAL_DIR = REPO_ROOT / "dataset" / "aigc_images" / "real"
PUBLIC_SAMPLES_DIR = REPO_ROOT / "public" / "samples"

GENUINE_DIR.mkdir(parents=True, exist_ok=True)
AIGC_REAL_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

DOCUMENT_TITLES = [
    ("genuine_receipt_swiss.jpg", "File:ReceiptSwiss.jpg"),
    ("genuine_invoice_kristiania.jpg", "File:Invoice_kristiania_001.jpg"),
    ("genuine_bill_coffee.jpg", "File:Paid_bill_for_coffee.jpg"),
    ("genuine_id_card_finnish.jpg", "File:New_Finnish_ID_card_(front_side).jpg"),
    ("genuine_certificate_sample.jpg", "File:Sample_Certificate_of_Change_of_Mention_of_Sex_-_Quebec.jpg"),
    ("genuine_restaurant_invoice.jpg", "File:Invoice_of_a_traditional_restaurant_in_downtown_Kanazawa.jpg"),
]

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def download_genuine_files() -> list[Path]:
    saved_files: list[Path] = []
    
    # 1. Resolve URLs via Wikimedia API
    titles_str = "|".join(t[1] for t in DOCUMENT_TITLES)
    api_url = f"https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(titles_str)}&prop=imageinfo&iiprop=url|size&format=json"
    
    req = urllib.request.Request(api_url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode())
    
    title_to_url: dict[str, str] = {}
    for page in data.get("query", {}).get("pages", {}).values():
        if "imageinfo" in page and page["imageinfo"]:
            title_to_url[page["title"].replace(" ", "_")] = page["imageinfo"][0]["url"]

    # 2. Download files
    for local_name, remote_title in DOCUMENT_TITLES:
        norm_title = remote_title.replace(" ", "_")
        url = title_to_url.get(norm_title)
        if not url:
            # Fallback to direct title lookup
            for k, v in title_to_url.items():
                if k.lower() in norm_title.lower() or norm_title.lower() in k.lower():
                    url = v
                    break

        if not url:
            print(f"URL not found for {remote_title}")
            continue

        target_path = GENUINE_DIR / local_name
        try:
            download_req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(download_req, timeout=20) as resp:
                content = resp.read()
                if len(content) > 5000:
                    target_path.write_bytes(content)
                    saved_files.append(target_path)
                    print(f"Downloaded {local_name} ({len(content)} bytes)")
                    
                    # Also copy into aigc_images/real
                    shutil.copy2(target_path, AIGC_REAL_DIR / local_name)
                    
                    # Also populate public/samples
                    if "invoice" in local_name or "receipt" in local_name:
                        shutil.copy2(target_path, PUBLIC_SAMPLES_DIR / "genuine_invoice.jpg")
                    if "certificate" in local_name:
                        shutil.copy2(target_path, PUBLIC_SAMPLES_DIR / "certificate.jpg")
        except Exception as err:
            print(f"Failed to download {local_name}: {err}")

    # Also copy existing clean documents from workspace if present
    for src in (REPO_ROOT / "documents").glob("*clean*.jpg"):
        dest = GENUINE_DIR / f"workspace_{src.name}"
        shutil.copy2(src, dest)
        shutil.copy2(src, AIGC_REAL_DIR / f"workspace_{src.name}")
        saved_files.append(dest)

    # Ensure public/samples/tampered-invoice.jpg and certificate.jpg exist for the UI buttons
    tampered_src = REPO_ROOT / "documents" / "invoice_tampered.jpg"
    if tampered_src.exists():
        shutil.copy2(tampered_src, PUBLIC_SAMPLES_DIR / "tampered-invoice.jpg")
    cert_src = REPO_ROOT / "documents" / "degree_certificate.jpg"
    if cert_src.exists() and not (PUBLIC_SAMPLES_DIR / "certificate.jpg").exists():
        shutil.copy2(cert_src, PUBLIC_SAMPLES_DIR / "certificate.jpg")

    print(f"\nTotal genuine files in {GENUINE_DIR}: {len(list(GENUINE_DIR.glob('*.*')))}")
    return saved_files


if __name__ == "__main__":
    download_genuine_files()
