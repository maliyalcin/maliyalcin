#!/usr/bin/env python3
"""Gece görevi tarafından üretilen haber dosyasını doğrular ve index.json'u günceller.

Kullanım:  python3 haber/tools/validate.py haber/data/2026-11-18.json
Çıkış kodu 0 = geçerli (index güncellendi), 1 = hata (hatalar listelenir).
"""
import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CATEGORIES = {c["id"]: c for c in json.loads((ROOT / "categories.json").read_text("utf-8"))}


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        doc = json.loads(path.read_text("utf-8"))
    except Exception as e:  # noqa: BLE001
        return [f"JSON okunamadı: {e}"]

    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(doc.get("date", ""))):
        errors.append("'date' YYYY-AA-GG biçiminde olmalı")
        return errors
    day = date.fromisoformat(doc["date"])
    if path.stem != doc["date"]:
        errors.append(f"Dosya adı ({path.stem}) 'date' ile aynı olmalı ({doc['date']})")
    for key in ("generated_at", "verified_by", "categories"):
        if key not in doc:
            errors.append(f"'{key}' alanı eksik")
    cats = doc.get("categories", [])
    ids = [c.get("id") for c in cats]
    for cid in CATEGORIES:
        if cid not in ids:
            errors.append(f"Kategori eksik: {cid} (haber yoksa boş 'items' ile ekleyin)")
    seen_urls: set[str] = set()
    old_urls: set[str] = set()
    for prev in DATA.glob("????-??-??.json"):
        if prev.stem < doc["date"]:
            try:
                for pc in json.loads(prev.read_text("utf-8")).get("categories", []):
                    for pit in pc.get("items", []):
                        pu = urlparse(str(pit.get("url", "")))
                        old_urls.add((pu.netloc.lower().removeprefix("www.") + pu.path.rstrip("/")).lower())
            except Exception:  # noqa: BLE001
                pass
    for c in cats:
        cid = c.get("id")
        if cid not in CATEGORIES:
            errors.append(f"Bilinmeyen kategori: {cid}")
            continue
        items = c.get("items")
        if not isinstance(items, list):
            errors.append(f"{cid}: 'items' liste olmalı")
            continue
        for i, it in enumerate(items):
            where = f"{cid}[{i}]"
            for key in ("title", "summary", "source", "url", "published"):
                if not str(it.get(key, "")).strip():
                    errors.append(f"{where}: '{key}' boş")
            u = urlparse(str(it.get("url", "")))
            if u.scheme not in ("http", "https") or not u.netloc:
                errors.append(f"{where}: geçersiz url")
            norm = (u.netloc.lower().removeprefix("www.") + u.path.rstrip("/")).lower()
            if norm in old_urls and u.path.strip("/"):
                errors.append(f"{where}: bu haber önceki bir bültende zaten var")
            if norm in seen_urls:
                errors.append(f"{where}: tekrar eden haber (url)")
            seen_urls.add(norm)
            try:
                pub = date.fromisoformat(str(it.get("published", ""))[:10])
                if not (day - timedelta(days=3) <= pub <= day + timedelta(days=1)):
                    errors.append(f"{where}: yayın tarihi {pub} son 72 saat dışında (hedef gün {day})")
            except ValueError:
                errors.append(f"{where}: 'published' tarih değil")
            imp = it.get("importance", 2)
            if imp not in (1, 2, 3):
                errors.append(f"{where}: 'importance' 1, 2 veya 3 olmalı")
    return errors


def rebuild_index() -> None:
    days = sorted((p.stem for p in DATA.glob("????-??-??.json")), reverse=True)
    index = {"updated_at": datetime.now().astimezone().isoformat(timespec="seconds"), "days": days}
    (DATA / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", "utf-8")


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    errors = validate(Path(sys.argv[1]))
    if errors:
        print("GEÇERSİZ:")
        for e in errors:
            print(" -", e)
        return 1
    rebuild_index()
    print("GEÇERLİ — index.json güncellendi")
    return 0


if __name__ == "__main__":
    sys.exit(main())
