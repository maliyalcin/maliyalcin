# Gece Haber Görevi (her gece ~00:23 İstanbul)

Bu dosya, zamanlanmış gece oturumunun izlediği talimattır. Gündüz hiçbir araştırma yapılmaz;
uygulama yalnızca bu görevin ürettiği hazır JSON dosyalarını okur.

## Hedef
- **Hedef gün (D):** İstanbul saatine göre *dün* (`TZ=Europe/Istanbul date -d yesterday +%F`).
- **Çıktı:** `haber/data/D.json` + güncel `haber/data/index.json`, `claude/mechanical-design-news-app-uw58x3`
  dalına push edilmiş olarak. Sabah 06:00'dan önce bitmiş olmalı.
- `haber/data/D.json` zaten varsa ve doğrulamadan geçiyorsa **hiçbir şey yapma, bitir** (yedek çalıştırma bu sayede boşa harcamaz).

## Akış

### 1) Görev dağıtımı — alt ajanlar (Sonnet)
`haber/categories.json` içindeki **her kategori için ayrı bir alt ajan** başlat (Agent aracı,
`model: "sonnet"`, hepsi paralel/arka planda). Her alt ajana şunu ver:
- kategori başlığı + `scope` metni,
- hedef gün D,
- görev: **son 72 saatte (D-3 … D+1)** yayımlanmış ve önceki bültenlerde (`haber/data/*.json`) yer almamış, o kapsamdaki **gerçek** haberleri **WebSearch** ile araştır
  (Türkçe ve İngilizce, kategori başına en az 6-8 farklı arama; sorgulara ay/yıl ekle, ör. "Autodesk Inventor November 2026"),
- **ÖNEMLİ — ağ kısıtı:** Bu bulut ortamı çoğu haber sitesinin sayfasını açmaya (WebFetch/curl) izin vermez
  (ENOTFOUND / 403). Bu normaldir. Sayfayı açmayı en fazla bir kez dene; açılmazsa **haberi eleme**:
  teyidi WebSearch sonucundaki başlık, kaynak, URL, tarih ve özet metniyle yap. Sayfa açılamadı diye boş liste döndürme.
  WebSearch'te `mode: "extended"` kullan (taze sonuç için). Bir haberi yalnızca tarihi son 72 saat dışındaysa, konu kapsam dışıysa ya da arama sonucunda gerçekten yoksa ele,
- en fazla 8 haber; hedef kategori başına en az 2-3 haber (kapsam geniş yorumlanabilir); uydurma yok, tarih tutmuyorsa alma, basın bülteni tekrarlarını tek habere indir,
- dönüş biçimi: yalnızca JSON dizi —
  `[{"title": "...(Türkçe başlık)", "summary": "2-3 cümle Türkçe özet; makine tasarımcısı için neden önemli",
     "source": "Yayın adı", "url": "https://...", "published": "YYYY-AA-GG", "importance": 1|2|3,
     "tags": ["..."]}]`
  (`importance`: 3 = doğrudan Inventor/AutoCAD/imalata hazırlık iş akışını etkiler, 2 = önemli, 1 = bilgi).

### 2) Kontrol — Opus (bu oturumun kendisi)
Alt ajanlar dönünce, orkestratör (Opus) her kategoriyi kendisi denetler:
- Her haberi teyit et: URL'yi açmak mümkün değilse (ağ kısıtı) haberin başlığıyla kısa bir WebSearch yap ve
  aynı kaynak/URL/tarihin sonuçlarda göründüğünü doğrula. Tarih son 72 saat dışındaysa, kaynak güvenilmezse veya içerik
  özetle uyuşmuyorsa **çıkar**. Sayfanın açılamaması tek başına çıkarma nedeni değildir.
- Tüm kategoriler boş kaldıysa bu bir arıza işaretidir: bir kez daha, kendin WebSearch ile her kategori için
  2-3 arama yaparak boşlukları doldurmayı dene. Yine de boşsa dosyayı yazma ve nedeni özetle bildir.
- Kategoriler arası tekrarları kaldır (haber en uygun tek kategoride kalsın).
- Özetleri sadeleştir, Türkçesini düzelt, `importance` değerlerini tutarlı hale getir, her kategoride
  önem sırasına göre sırala.
- Boş kalan kategoriler `items: []` ile kalır (uydurma ile doldurulmaz).
- Kategori başına 1 cümlelik `brief` (günün özeti) yaz; haber yoksa `brief: ""`.

### 3) Dosyayı yaz ve doğrula
```json
{
  "date": "D",
  "generated_at": "ISO zaman damgası (+03:00)",
  "verified_by": "opus",
  "headline": "Günün en önemli gelişmesi tek cümle",
  "categories": [
    {"id": "<categories.json id>", "title": "...", "icon": "...", "brief": "...", "items": [ ... ]}
  ]
}
```
`python3 haber/tools/validate.py haber/data/D.json` → "GEÇERLİ" çıkana kadar düzelt
(bu komut `index.json`'u da günceller).

### 4) Yayınla
```
git add haber/data && git commit -m "Haberler: D" && git push -u origin claude/mechanical-design-news-app-uw58x3
```
Ağ hatasında 4 kez (2s, 4s, 8s, 16s) tekrar dene. Push reddedilirse `git fetch origin <dal> && git merge --no-edit FETCH_HEAD` sonra tekrar push.
Başka dosyaya dokunma, PR açma.
