#!/usr/bin/env python3
"""Günün Kelimeleri yardımcı aracı.

  python3 haber/tools/kelime.py sec D        -> D günü için 6 terim (6 farklı kategori, son 180 günde kullanılmamış)
  python3 haber/tools/kelime.py birlestir D  -> haber/kelime/parca/D/*.json -> haber/kelime/D.json + doğrulama
  python3 haber/tools/kelime.py dogrula D    -> doğrula, index.json'u güncelle
"""
import json
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tasarim import check_svg  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "kelime"
KATALOG = json.loads((DIR / "katalog.json").read_text("utf-8"))
ADET = 6


def used_ids(before: date, days: int = 180) -> set[str]:
    out = set()
    for p in DIR.glob("????-??-??.json"):
        try:
            d = date.fromisoformat(p.stem)
        except ValueError:
            continue
        if before - timedelta(days=days) <= d < before:
            out |= {w.get("id") for w in json.loads(p.read_text("utf-8")).get("words", [])}
    return out


def sec(d: date) -> list[dict]:
    rnd = random.Random("kelime-" + d.isoformat())
    used = used_ids(d)
    cats = sorted({k["category"] for k in KATALOG})
    rnd.shuffle(cats)
    out = []
    for c in cats:
        pool = [k for k in KATALOG if k["category"] == c and k["id"] not in used] or [k for k in KATALOG if k["category"] == c]
        out.append(rnd.choice(pool))
        if len(out) == ADET:
            break
    return out


def check_word(w: dict, where: str, errors: list[str]) -> None:
    for k in ("id", "term", "en", "category", "short", "analogy", "mnemonic", "example", "etymology"):
        if not str(w.get(k, "")).strip():
            errors.append(f"{where}: '{k}' boş")
    for k, n in (("explanation", 2), ("confusions", 1), ("related", 2)):
        if not isinstance(w.get(k), list) or len(w[k]) < n:
            errors.append(f"{where}: '{k}' en az {n} öğe olmalı")
    f = w.get("figure") or {}
    if not f.get("caption"):
        errors.append(f"{where}: figure.caption eksik")
    check_svg(str(f.get("svg", "")), f"{where}.figure", errors)
    q = w.get("quiz") or {}
    if not q.get("q") or not isinstance(q.get("options"), list) or len(q["options"]) != 4 or q.get("answer") not in (0, 1, 2, 3) or not q.get("why"):
        errors.append(f"{where}: quiz {{q, options[4], answer 0-3, why}} hatalı")


def dogrula(d: date) -> list[str]:
    try:
        doc = json.loads((DIR / f"{d.isoformat()}.json").read_text("utf-8"))
    except Exception as e:  # noqa: BLE001
        return [f"JSON okunamadı: {e}"]
    errors: list[str] = []
    if doc.get("date") != d.isoformat():
        errors.append("'date' dosya adıyla aynı olmalı")
    ws = doc.get("words")
    if not isinstance(ws, list) or len(ws) != ADET:
        return errors + [f"'words' {ADET} öğe olmalı"]
    if len({w.get("id") for w in ws}) != ADET:
        errors.append("tekrar eden kelime id")
    for i, w in enumerate(ws):
        check_word(w, f"words[{i}]({w.get('id')})", errors)
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
        words = []
        for k in sec(d):
            f = DIR / "parca" / d.isoformat() / f"{k['id']}.json"
            if not f.exists():
                print(f"EKSİK: {f}")
                return 1
            words.append(json.loads(f.read_text("utf-8")))
        doc = {"date": d.isoformat(), "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
               "verified_by": "opus", "words": words}
        (DIR / f"{d.isoformat()}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", "utf-8")
    errors = dogrula(d)
    if errors:
        print("GEÇERSİZ:")
        for e in errors:
            print(" -", e)
        return 1
    rebuild_index()
    print("GEÇERLİ — kelime/index.json güncellendi")
    return 0


if __name__ == "__main__":
    sys.exit(main())
