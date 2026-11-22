# Tasarım Analizleri — Gece Görevi (her gece 00:00–08:00 arası)

Okuyucu: makine imalatı yapan, Inventor/AutoCAD ile 3B tasarım yapan bir makine mühendisi.
Dil: Türkçe, anlaşılır, mühendislik terimleri doğru (gerekirse İngilizce karşılığı parantez içinde).

## Orkestratör (Opus) akışı — token tasarrufu öncelikli
1. D = `TZ=Europe/Istanbul date +%F` (bugünün tarihi). `haber/tasarim/D.json` varsa ve
   `python3 haber/tools/tasarim.py dogrula D` GEÇERLİ ise bitir.
2. `python3 haber/tools/tasarim.py sec D` → 5 katalog öğesi (rastgele, son 60 günde kullanılmamış). Kendin seçim yapma.
3. Her öğe için **paralel bir alt ajan** başlat (Agent, `model: "sonnet"`). Alt ajan istemi kısa olsun:
   "haber/TASARIM_GOREVI.md dosyasının 'Alt ajan görevi' bölümünü oku ve uygula. Öğe: <öğe JSON>. Tarih: D."
   Alt ajanlar web araması yapmaz; mühendislik bilgisiyle çalışır ve dosyaya yazar; sana yalnızca kısa bir özet döner.
4. `python3 haber/tools/tasarim.py birlestir D` → hataları ilgili alt ajana (SendMessage) ya da kendin düzelt.
5. **Opus kontrolü (yalnızca gerekli kısımları oku):** her tasarımın `analysis` adımlarını ve `specs`'i
   `python3 -c` ile çıkarıp oku; birim tutarlılığı, büyüklük mertebesi (ör. kW, N·m, devir, ivme), formül doğruluğu,
   emniyet katsayıları ve sonuç yorumlarını denetle. Hatalı değerleri doğrudan JSON'da düzelt. SVG/3B modeli tek tek okuma;
   doğrulayıcı geçiyorsa yeterli.
6. `python3 haber/tools/tasarim.py dogrula D` GEÇERLİ → `haber/tasarim/parca/` klasörünü sil (commit etme),
   yalnızca `haber/tasarim/D.json` ve `haber/tasarim/index.json` commit et ("Tasarımlar: D") ve push et.

## Alt ajan görevi (Sonnet)
Verilen katalog öğesi için **gerçekçi, somut ölçülü bir örnek tasarım** kurgula (ör. "80 kg yük, 600 mm strok,
0,5 m/s, 1 m/s² ivme") ve aşağıdaki JSON'u **tek dosya** olarak
`haber/tasarim/parca/D/<id>.json` yoluna yaz (Write aracı; klasörü gerekirse `mkdir -p` ile oluştur).
Sonra `python3 -c "import json;json.load(open('<yol>'))"` ile JSON'un geçerli olduğunu kontrol et.
Yanıt olarak yalnızca 2-3 satırlık özet döndür (dosya içeriğini geri yazma).

```json
{
  "id": "<katalog id>",
  "title": "Türkçe başlık",
  "category": "Kısa kategori (ör. Lineer eksen, Redüktör, Konveyör, Pnömatik, Hidrolik, Rulman yataklama)",
  "summary": "1-2 cümle: bu tasarım nedir, ne işe yarar",
  "chat_context": "Claude'a soru sorulurken bağlam olarak gidecek 3-5 cümlelik teknik özet: senaryo, ana ölçüler, seçilen elemanlar, kritik sonuçlar",
  "principle": ["Çalışma prensibi paragraf 1", "paragraf 2", "... (3-5 paragraf; kuvvet/hareket akışını motordan yüke adım adım anlat)"],
  "components": [{"name": "Eleman", "role": "Görevi ve neden seçildiği"}],
  "specs": [{"k": "Yük kütlesi", "v": "80 kg"}, {"k": "Strok", "v": "600 mm"}],
  "analysis": [
    {"title": "1. Yük ve sürtünme kuvvetleri",
     "steps": [{"label": "Sürtünme kuvveti", "formula": "F_s = μ · m · g = 0,005 · 80 · 9,81", "value": "3,9", "unit": "N", "note": "Profil ray için μ≈0,005"}],
     "comment": "Bu adımın yorumu / tasarıma etkisi"}
  ],
  "figures": [{"caption": "Şekil açıklaması", "svg": "<svg viewBox=\"0 0 400 240\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"}],
  "advantages": ["..."],
  "disadvantages": ["..."],
  "example": ["Gerçek bir sektörden somut uygulama örneği; rakamlarla (1-2 paragraf)"],
  "design_tips": ["Inventor/AutoCAD'de modellerken ve imalata hazırlarken dikkat edilecekler: tolerans, alıştırma, montaj, bakım, katalog seçimi"],
  "model3d": { "camera": [1, 0.7, 1.2], "anim_scale": 1, "parts": [ ... ] }
}
```

### Analiz içeriği (en az 5 blok, her blokta 3+ adım)
Mekanizmaya uygun olanları seç ve **sayısal** hesapla; her adımda formül + sayılar + sonuç + birim olsun:
- Yük, ağırlık, sürtünme (μ değerleri kaynaklı ve gerçekçi), statik kuvvet ve momentler
- Dinamik: ivmelenme kuvveti, hareket profili (ivmelenme–sabit hız–yavaşlama süreleri), çevrim süresi
- Atalet: yükün, milin/vidalı milin, kasnak/dişlinin ataleti ve motora indirgenmiş atalet; atalet oranı (J_yük/J_motor)
- Tork ve güç: gerekli motor torku (sürtünme + ivme + yerçekimi), devir, güç (kW), servis/emniyet katsayısı, seçilecek standart motor
- Redüktör/kademe oranları, verimler (η), çıkış torku ve hızı
- Eleman seçimi/ömür: rulman L10 ömrü, vidalı mil kritik devir ve burkulma, kayış çekme kuvveti, zincir seçimi, silindir çapı ve hava/yağ tüketimi, ray–araba ömrü vb.
- Son blok: "Sonuç ve seçim" — seçilen standart elemanların özeti
Değerler mühendislik açısından tutarlı olmalı; sayı formatı Türkçe (virgül ondalık). Uydurma marka/model numarası verme;
"ör. 0,75 kW 4 kutuplu motor" gibi genel tanımla.

### Şekiller (en az 2 SVG)
- 1. şekil: mekanizmanın sade şematik çizimi (yan görünüş/kesit), elemanlar etiketli, hareket yönleri oklarla. Bu şekil
  listede küçük resim olarak da kullanılır; açık renk arka planda okunur olsun (koyu çizgi #1f2a37, vurgu #e8711a, ikincil #4a90c2).
- 2. şekil: serbest cisim diyagramı / kuvvet-moment şeması **veya** hız-zaman (trapez hareket profili) grafiği.
- Kurallar: `viewBox` zorunlu, `xmlns` ekle, yalnızca temel SVG öğeleri (line, rect, circle, path, polygon, text, g, defs, marker).
  script, foreignObject, image, on* öznitelikleri, dış bağlantı YASAK. Metin font-size 11-14, `font-family="sans-serif"`. Her SVG < 12 KB.

### 3B model (`model3d.parts`, 8-25 parça, mm cinsinden, Y ekseni yukarı)
Ortak alanlar: `type`, `pos:[x,y,z]` (parça merkezi), `color` ("#rrggbb"), isteğe bağlı `label` (lejantta görünür; ana
elemanlara ver), `rot:[derece x,y,z]`, `opacity`, `metal:false`, `axis:"x"|"y"|"z"` (silindirik parçaların ekseni), `anim`.
- `box`: `size:[x,y,z]` — gövde, ray, araba, tabla, şase
- `cylinder`: `r`, `h`, `axis` — mil, kasnak, tambur, piston kolu, motor gövdesi
- `tube`: `r`, `ri`, `h`, `axis` — silindir gövdesi, rulman dış bileziği, burç
- `gear`: `r` (dış yarıçap), `teeth`, `h` (genişlik), `axis`, isteğe bağlı `bore` — dişli, zincir dişlisi, pinyon
- `screw`: `r`, `length`, `pitch`, `axis` — vidalı/trapez mil, sonsuz vida
- `belt`: `p1:[x,y,z]`, `p2:[x,y,z]` (iki kasnak merkezi), `r1`, `r2`, `axis` (kasnak ekseni), `t` (kalınlık/2) — kayış veya zincir
- `sphere`: `r`
Hareket: `anim: {"spin": {"rpm": 30}}` parçayı kendi `axis`'i etrafında döndürür (görsel hız: 5-60 rpm arası seç, gerçek değil;
kademe oranlarını oranlı tut, ters dönenlerde negatif rpm). `anim: {"slide": {"axis": "x", "amp": 150, "period": 4}}`
parçayı ileri-geri hareket ettirir (araba, piston kolu, somun gibi; aynı hareketli gruba aynı slide değerlerini ver).
Renk önerisi: gövde/şase #8d99a6, ray/mil #c9d1d9, motor #2f5d8a, hareketli araba/yük #e8711a, dişli/zincir #5b6470,
pnömatik/hidrolik gövde #3b8f6e, kayış #222222. Parçalar birbirine temas edecek şekilde gerçekçi yerleştir.
