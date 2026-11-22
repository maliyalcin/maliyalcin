#!/usr/bin/env python3
"""Tasarım Analizleri yardımcı aracı.

  python3 haber/tools/tasarim.py sec D            -> D günü için 5 katalog öğesi seçer (son 60 günde kullanılmamış), JSON yazdırır
  python3 haber/tools/tasarim.py birlestir D      -> haber/tasarim/parca/D/*.json dosyalarını D.json'a birleştirir ve doğrular
  python3 haber/tools/tasarim.py dogrula D        -> haber/tasarim/D.json'u doğrular, index.json'u günceller
"""
import json
import random
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "tasarim"
KATALOG = json.loads((DIR / "katalog.json").read_text("utf-8"))
ADET = 5
PART_TYPES = {"box", "cylinder", "tube", "gear", "screw", "belt", "sphere"}


def used_ids(before: date, days: int = 60) -> set[str]:
    out = set()
    for p in DIR.glob("????-??-??.json"):
        try:
            d = date.fromisoformat(p.stem)
        except ValueError:
            continue
        if before - timedelta(days=days) <= d < before:
            out |= {x.get("id") for x in json.loads(p.read_text("utf-8")).get("designs", [])}
    return out


def sec(d: date) -> list[dict]:
    pool = [k for k in KATALOG if k["id"] not in used_ids(d)]
    if len(pool) < ADET:
        pool = KATALOG[:]
    rnd = random.Random(d.isoformat())
    return rnd.sample(pool, ADET)


def check_svg(svg: str, where: str, errors: list[str]) -> None:
    s = svg.strip()
    if not s.startswith("<svg") or not s.endswith("</svg>"):
        errors.append(f"{where}: svg <svg ...>...</svg> olmalı")
    if re.search(r"<script|<foreignObject|\son\w+\s*=|javascript:|<image|<iframe", s, re.I):
        errors.append(f"{where}: svg'de izin verilmeyen içerik var")
    if "viewBox" not in s:
        errors.append(f"{where}: svg viewBox içermeli")
    if len(s) > 30000:
        errors.append(f"{where}: svg çok büyük (>30 KB)")


def check_design(x: dict, where: str, errors: list[str]) -> None:
    req_str = ["id", "title", "category", "summary", "chat_context"]
    for k in req_str:
        if not str(x.get(k, "")).strip():
            errors.append(f"{where}: '{k}' boş")
    for k, n in (("principle", 2), ("components", 3), ("specs", 5), ("analysis", 3),
                 ("advantages", 3), ("disadvantages", 3), ("figures", 1), ("design_tips", 2)):
        if not isinstance(x.get(k), list) or len(x[k]) < n:
            errors.append(f"{where}: '{k}' en az {n} öğe içeren liste olmalı")
    for i, a in enumerate(x.get("analysis") or []):
        if not a.get("title") or not isinstance(a.get("steps"), list) or len(a["steps"]) < 2:
            errors.append(f"{where}.analysis[{i}]: başlık ve en az 2 adım gerekli")
        for j, s in enumerate(a.get("steps") or []):
            if not s.get("label") or s.get("value") in (None, ""):
                errors.append(f"{where}.analysis[{i}].steps[{j}]: label/value eksik")
    for i, f in enumerate(x.get("figures") or []):
        if not f.get("caption"):
            errors.append(f"{where}.figures[{i}]: caption eksik")
        check_svg(str(f.get("svg", "")), f"{where}.figures[{i}]", errors)
    rv = x.get("review")
    if not isinstance(rv, dict) or not rv.get("status") or not isinstance(rv.get("checks"), list) or len(rv["checks"]) < 2:
        errors.append(f"{where}: 'review' (profesör teyidi: status + en az 2 check) eksik")
    m = x.get("model3d")
    if not isinstance(m, dict) or not isinstance(m.get("parts"), list) or len(m["parts"]) < 3:
        errors.append(f"{where}: model3d.parts en az 3 parça olmalı")
    else:
        for i, p in enumerate(m["parts"]):
            if p.get("type") not in PART_TYPES:
                errors.append(f"{where}.model3d.parts[{i}]: bilinmeyen tip {p.get('type')}")
            if p.get("type") == "belt" and not all(k in p for k in ("p1", "p2", "r1", "r2")):
                errors.append(f"{where}.model3d.parts[{i}]: belt için p1,p2,r1,r2 gerekli")
            if p.get("axis") not in (None, "x", "y", "z"):
                errors.append(f"{where}.model3d.parts[{i}]: axis x/y/z olmalı")


def dogrula(d: date) -> list[str]:
    path = DIR / f"{d.isoformat()}.json"
    try:
        doc = json.loads(path.read_text("utf-8"))
    except Exception as e:  # noqa: BLE001
        return [f"JSON okunamadı: {e}"]
    errors: list[str] = []
    if doc.get("date") != d.isoformat():
        errors.append("'date' dosya adıyla aynı olmalı")
    if not doc.get("verified_by"):
        errors.append("'verified_by' eksik")
    ds = doc.get("designs")
    if not isinstance(ds, list) or len(ds) != ADET:
        errors.append(f"'designs' {ADET} öğe olmalı")
        return errors
    ids = [x.get("id") for x in ds]
    if len(set(ids)) != len(ids):
        errors.append("tekrar eden tasarım id")
    for i, x in enumerate(ds):
        check_design(x, f"designs[{i}]({x.get('id')})", errors)
    return errors


def rebuild_index() -> None:
    days = sorted((p.stem for p in DIR.glob("????-??-??.json")), reverse=True)
    idx = {"updated_at": datetime.now().astimezone().isoformat(timespec="seconds"), "days": days}
    (DIR / "index.json").write_text(json.dumps(idx, ensure_ascii=False, indent=2) + "\n", "utf-8")


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] not in ("sec", "birlestir", "dogrula"):
        print(__doc__)
        return 1
    d = date.fromisoformat(sys.argv[2])
    if sys.argv[1] == "sec":
        print(json.dumps(sec(d), ensure_ascii=False, indent=1))
        return 0
    if sys.argv[1] == "birlestir":
        order = [k["id"] for k in sec(d)]
        parts = DIR / "parca" / d.isoformat()
        designs = []
        for cid in order:
            f = parts / f"{cid}.json"
            if not f.exists():
                print(f"EKSİK: {f}")
                return 1
            try:
                designs.append(json.loads(f.read_text("utf-8")))
            except Exception as e:  # noqa: BLE001
                print(f"JSON HATASI {f.name}: {e}")
                return 1
        doc = {"date": d.isoformat(), "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
               "verified_by": "opus", "designs": designs}
        (DIR / f"{d.isoformat()}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", "utf-8")
    errors = dogrula(d)
    if errors:
        print("GEÇERSİZ:")
        for e in errors:
            print(" -", e)
        return 1
    rebuild_index()
    print("GEÇERLİ — tasarim/index.json güncellendi")
    return 0


if __name__ == "__main__":
    sys.exit(main())
