# Tasarım Bülteni (telefon uygulaması)

Her gece 00:23'te (İstanbul) zamanlanmış bir Claude oturumu bir önceki günün haberlerini
araştırır (kategori başına bir Sonnet alt ajanı), Opus kontrol eder, `data/GGGG-AA-GG.json` olarak bu dala push eder.
03:47'de yedek çalıştırma yalnızca dosya eksikse çalışır. Gün içinde hiçbir araştırma yapılmaz.

- Arayüz: `index.html` + `app.js` (PWA, ana ekrana eklenebilir)
- Kategoriler: `categories.json`
- Gece talimatı: `GECE_GOREVI.md`
- Doğrulama: `python3 tools/validate.py data/GGGG-AA-GG.json`
