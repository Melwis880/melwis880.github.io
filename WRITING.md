# WRITING.md

Bu sitede yazı yazmanın kısa rehberi. Yazılar benim: kendi gördüğüm bir sorunu, nasıl çözdüğümü ve
ölçülen sonucu anlatır. LinkedIn/X gönderisi gibi değil, sonradan tekrar okunacak bir kayıt gibi yazılır.
Teknik kurallar (şablonlar, CSP, görseller) CLAUDE.md'de; bu dosya içerik ve akış içindir.

## Türler

| Tür | Ne zaman | Uzunluk | Nerede |
|---|---|---|---|
| **Vaka analizi** (`case-study`) | Bitmiş, herkese açık bir proje: sorun, nasıl çalışıyor, ölçülen sonuç | 400-900 kelime | `content/post/` |
| **Saha notu** (`field-note`) | Bir yerde gördüğüm somut bir sorun ve çözümü (müşteri, ilan, kendi işim) | 300-700 kelime | `content/post/` |
| **Araştırma notu** (`research`) | Test ettiğim bir soru: ne denedim, ne çıktı, neyi bilmiyorum | serbest | `content/post/` |
| **Not** (TIL) | Tek bir şey öğrendim: bir komut, bir ayar, bir tuzak | 50-200 kelime | `content/notes/` |

Tür, yazının ilk (ve tek) kategorisidir; notlarda kategori yazılmaz, türü bölümden gelir. Başlıkta türü
tekrarlama ("Vaka analizi: ..." yok), tür etiketi zaten görünür.

## Yeni yazı

Önce Türkçe yazılır, İngilizcesi birlikte çıkarılır, ikisini de ben okurum. Tek dilde kalacaksa İngilizce.

```bash
hugo new content post/<slug>.tr.md     # Türkçe taslak (şablon başlıkları Türkçe)
hugo new content post/<slug>.md        # İngilizce karşılığı, aynı slug
hugo new content notes/<slug>.tr.md    # not için aynısı
hugo new content notes/<slug>.md
```

- `slug` İngilizce ve ASCII: `n8n-organizer-case-study`, `regex-in-n8n`. İki dil aynı slug'ı kullanır; dil
  düğmesi bu eşleşmeyle çalışır.
- Şablon (`archetypes/`) her dosyayı `draft: true` ve `TODO:` satırlarıyla açar. Taslak build'e girmez.
  `TODO:` satırı kalmış bir yazı yayına alınırsa build uyarı verir.
- Yerelde görmek için: `hugo server -D` (taslaklar dahil).

## Yapı

Her yazı şu üç soruya cevap verir (Projeler sayfası ve vaka analizleri de aynı soruları izler):

1. **Sorun ne?** Elle nasıl yapılıyordu, neden yetmiyordu. Somut: kim, ne kadar sürüyordu, neyi bozuyordu.
2. **Nasıl çalışıyor?** Araçlar, kararlar, neden onlar. Kod gerekiyorsa kısa bir parça.
3. **Gerçek bir işte somut sonuç ne?** Ölçülen sayılar. Ölçülmeyen şey "henüz ölçülmedi" diye yazılır.

İlk paragraf (`<!--more-->` işaretinden önceki kısım) listelerde ve RSS'te özet olarak görünür; okur
sorunu orada tanımalı.

## Ön bilgi (front matter)

| Alan | Zorunlu | Not |
|---|---|---|
| `title` | evet | Türü tekrarlamaz. Paylaşım kartına da bu yazılır (70 karakteri geçerse küçülür) |
| `subtitle` | hayır | Başlık altı tek cümle; listelerde özet olarak da kullanılır |
| `description` | evet (yazılarda) | Arama motoru ve paylaşım önizlemesi metni, 1-2 cümle |
| `date` | evet | `YYYY-MM-DD`. Saat yazılmaz; TR saatiyle okunur |
| `categories` | yazılarda evet | Tek değer: `case-study`, `field-note`, `research` |
| `tags` | hayır | ASCII küçük harf: `n8n`, `python`, `ai-agents`, `automation` |
| `ai_use` | hayır | Sadece doğruysa: `edit` (YZ düzeltti) ya da `draft` (YZ taslağı yazdı, ben düzelttim). Yazının altına not ekler |
| `updates` | hayır | Yayından sonra düzeltme: `[{date: 2026-10-20, note: "..."}]` |
| `toc` | hayır | İçindekiler; verilmezse 3 ve üstü `##` başlıkta kendiliğinden açılır |

## Kanıt ve dürüstlük

- Sadece özel profil notlarımdaki **Public proof** listesinde olan projeler anılır. Demo, "demo" diye etiketlenir.
- Sayılar ölçülmüş olmalı ve Projeler sayfasındakiyle (`data/projects.yaml`) birebir aynı olmalı.
- Müşteri işi yoksa varmış gibi yazılmaz; kendi aracımsa "kendi aracım, müşteri işi değil" denir.
- Mezuniyetten önce unvan olarak "Engineer" / "Mühendis" kullanılmaz.

## Üslup

- Uzun tire (—) kullanılmaz; virgül, iki nokta ya da yeni cümle.
- Kısa paragraflar, somut fiiller. "Devrim yaratan", "güçlü", "sorunsuz" gibi boş sıfatlar yok.
- Birinci tekil şahıs; ne yaptığımı ve neyi bilmediğimi söylerim.
- İçerik içi linkler tam yolla yazılır: Türkçe sayfaya `/tr/...`, İngilizceye `/...`.

## Görseller

- Bir yazının görselleri `assets/img/<slug>/` altına konur ve `![Açıklama](/img/<slug>/akis.png)` diye
  bağlanır; build WebP'ye çevirir. `static/` kullanılmaz.
- Her görselin `alt` metni anlamlı olmalı (ne gösterdiği).
- Paylaşım görseli (LinkedIn/WhatsApp önizlemesi) **otomatik**: tür, başlık ve isimle her yazı için
  çizilir. Özel bir görsel gerekirse ön bilgiye `image: img/<slug>/kapak.jpg` yazılır.

## Yayından önce

- [ ] İki dil de var, aynı slug, ikisi de okundu
- [ ] `draft: true` satırı kaldırıldı, `TODO:` kalmadı
- [ ] `description` ve `categories` dolu; sayılar Projeler sayfasıyla aynı
- [ ] `ai_use` doğru (ya da yok)
- [ ] `hugo --gc --minify --cleanDestinationDir` uyarısız
- [ ] `hugo server` ile iki dilde bakıldı: liste, yazı sayfası, dil düğmesi
