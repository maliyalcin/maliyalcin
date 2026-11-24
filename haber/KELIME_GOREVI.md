# Günün Kelimeleri — Gece Görevi (00:00–08:00)

Okuyucu: Inventor/AutoCAD ile makine tasarlayan ve imalata hazırlayan bir makine mühendisi.
Amaç: kelimeyi **bir daha unutmayacak** şekilde öğretmek. Dil Türkçe, sade ve doğru.

## Orkestratör (Opus) — token tasarrufu öncelikli
1. D = `TZ=Europe/Istanbul date +%F`. `haber/kelime/D.json` varsa ve `python3 haber/tools/kelime.py dogrula D` GEÇERLİ ise bitir.
2. `python3 haber/tools/kelime.py sec D` → 6 terim (6 farklı kategori). Kendin seçme.
3. **3 paralel alt ajan** (Agent, `model: "sonnet"`), her birine 2 terim ver. Kısa istem:
   "haber/KELIME_GOREVI.md 'Alt ajan görevi'ni uygula. D=<D>. Terimler: <2 öğe JSON>."
4. `python3 haber/tools/kelime.py birlestir D`; hataları düzelt.
5. **Opus kontrolü:** her kelimenin `short`, `explanation`, `confusions` ve `quiz` alanlarını `python3 -c` ile çıkarıp oku;
   teknik doğruluk (tanım, birim, standart adları, sayısal örnekler), quiz cevabının gerçekten doğru şık olması ve
   yanlış şıkların açıkça yanlış olması. Hataları JSON'da düzelt. SVG'leri tek tek okuma.
6. `dogrula D` GEÇERLİ → `haber/kelime/parca/` sil, yalnızca `haber/kelime/D.json` + `index.json` commit ("Kelimeler: D"), push.

## Alt ajan görevi (Sonnet)
Her terim için ayrı dosya: `haber/kelime/parca/D/<id>.json` (Write; klasör yoksa `mkdir -p`). Web araması yok.
Yardımcı betik gerekirse `<id>_gen.py` adıyla scratchpad'e yaz, `haber/` altına bırakma. JSON'u `json.load` ile kontrol et.
Yanıt olarak yalnızca 1-2 satır özet döndür.

```json
{
  "id": "<katalog id>", "term": "<katalogdaki Türkçe terim>", "en": "İngilizce karşılığı", "category": "<katalog kategorisi>",
  "short": "Tek cümlelik net tanım (ezberlenecek cümle)",
  "explanation": ["Nedir, nasıl çalışır/oluşur (2-4 kısa paragraf); formül varsa birimleriyle; sayısal mini örnek"],
  "analogy": "Günlük hayattan akılda kalıcı benzetme (somut, görsel)",
  "mnemonic": "Hafıza kancası: kelimenin sesi/kökü/harfleriyle kurulan kısa, eğlenceli hatırlatıcı",
  "etymology": "Kökeni (İngilizce/Fransızca/Latince kök, sektörde neden böyle denir)",
  "example": "Atölyede veya Inventor/AutoCAD'de karşılaşılan somut senaryo (ölçü/sayı içersin)",
  "confusions": [{"term": "Sık karıştırılan terim", "diff": "Farkı tek cümlede"}],
  "related": ["İlişkili terim 1", "İlişkili terim 2", "İlişkili terim 3"],
  "figure": {"caption": "Şekil açıklaması", "svg": "<svg viewBox=\"0 0 400 240\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"},
  "quiz": {"q": "Anlamayı ölçen soru (ezber değil, uygulama)", "options": ["A", "B", "C", "D"], "answer": 0, "why": "Doğru cevabın açıklaması"}
}
```
Kurallar: SVG `viewBox` + `xmlns` zorunlu; yalnızca temel öğeler (line, rect, circle, path, polygon, text, g, defs, marker);
script/foreignObject/image/on*/dış bağlantı YASAK; < 10 KB; açık arka planda okunur renkler (#1f2a37 çizgi, #e8711a vurgu,
#4a90c2 ikincil), etiketli, kelimeyi **görsel olarak açıklayan** şema (kesit, kuvvet oku, önce/sonra, karşılaştırma).
Quiz doğru cevabının yerini rastgele seç (her zaman 0 olmasın).
