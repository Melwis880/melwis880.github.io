# OPTIMIZATIONS.md

> Kapsam: `phase-2` dalı (a105172). Temasız iki dilli Hugo sitesi (EN `/`, TR `/tr/`), 2. aşamada eklenen Projeler / Hakkımda / Şu an / 404 sayfaları, `/kart/`, Pagefind araması, GitHub Actions deploy hattı.
> Yöntem: `hugo --gc --minify --cleanDestinationDir --templateMetrics --templateMetricsHints` ile gerçek build; `public/` dosya listesi ve gzip boyutları; `main.css` sınıflarının şablon/JS/içerik/çıktıda kullanılıp kullanılmadığı tarandı; i18n anahtarları şablonlarla karşılaştırıldı. Önerilen her config/şablon değişikliği `~/snap/hugo/common/opt-test/` altındaki atılabilir bir kopyada denendi ve çıktı `diff -r` ile karşılaştırıldı. Rakamlar aksi belirtilmedikçe ölçülmüştür.
> Tarih: 2026-10-10. Aynı gün c0f1e7f üzerinde yapılan denetimin yerini alır; o denetimin bulguları (O1-O12) aynı numaralarla en altta, yeni bulgular O13'ten başlıyor. Test kopyası (`opt-test`) işi bitince silindi.

## Durum (2026-10-10, uygulama oturumu)

| Bulgu | Durum | Not |
|---|---|---|
| O13 | **Uygulandı** | `layouts/home.rss.xml` (sadece yazılar), iki `/now/` sayfasına sabit `date: 2026-10-10`, `timeZone = "Europe/Istanbul"` (ayrı commit; çıktıda sadece saat dilimi ekleri `+00:00` → `+03:00` değişti, görünen 34 tarihin hepsi aynı) |
| O14 | **Uygulandı** | `[languages.tr] disableKinds = ["404"]` |
| O15 | **Uygulandı** | `_default/post.html` silindi, 6 i18n anahtarı x 2 dil çıkarıldı, 4 eski yorum düzeltildi, `.visually-hidden` silindi. CLAUDE.md güncellendi |
| O16 | Bilerek açık | Sahibinin kararı: `notes` dalları kalıyor |
| O7, O8, O9, O10, O11, O12 | Açık | Düşük öncelik |

**Doğrulama:** `hugo --gc --minify --cleanDestinationDir` uyarısız, 77 → **76 dosya**. Önceki çıktıyla karşılaştırma (CSS parmak izi ve SRI değeri eşitlenerek): gerçek fark sadece `404.html` (TR `hreflang` satırı gitti, dil düğmesi `/tr/404.html` yerine `/tr/`), `index.xml` ve `tr/index.xml` (5 → 2 öğe, başlık `M. Meriç Ordu`). `tr/404.html` artık yok. CSS'te tek fark `.visually-hidden`. Sitemap'ler değişmedi. İki akış geçerli XML. İç link kontrolü: 43 yerel yol, 0 eksik. `/now/` koruması: `lastmod` geçici olarak 2026-11-10 yapılınca sayfa ve alt bilgi linki yine üretildi (dosya sonra eski haline getirildi).

---

## 1) Optimization Summary

Site performans açısından iyi durumda. Bir yazı sayfasının ilk ziyareti toplam **~21 KB gzip**: HTML 5.3 KB, CSS 6.0 KB, JS 2.5 KB, tema-init 0.2 KB, avatar 1.9 KB, favicon 5.2 KB. Çıktı **77 dosya / 677,148 byte**, build **162 ms**, uyarı yok. Temanın ölü dosyaları gitti, `main.css`'te kullanılmayan tek sınıf var. Kalan sorunlar hız değil **doğruluk ve hijyen** sorunları: RSS akışı, 404 sayfaları ve küçük miktarda ölü kod.

**En yüksek etkili 3 iyileştirme:**
1. **O13: Ana RSS akışında Hakkımda, Projeler ve Şu an da var.** Bu sayfalar abonelere "yazı" olarak görünüyor. About ve Projects'in `pubDate` alanı `Mon, 01 Jan 0001`. Şu an sayfasının yayın tarihi `lastmod`'dan geliyor: her aylık güncellemede akışta yeniden "yeni yazı" olarak çıkıyor. `lastmod` CI saatine (UTC) göre gelecekteyse sayfa build'den tamamen düşüyor.
2. **O14: `/tr/404.html` hiç 404 olarak sunulmuyor** (GitHub Pages sadece kökteki `/404.html`'i kullanır). Ama kök 404 sayfasındaki dil düğmesi ve `hreflang` etiketi oraya gidiyor. Ziyaretçi ve tarayıcı, 200 koduyla dönen bir "bulunamadı" sayfasına yönleniyor. Çözüm tek satır config.
3. **O15: Kanıtlanmış ölü kod.** `_default/post.html` silindiğinde çıktı byte byte aynı kalıyor. Ayrıca iki dilde 6 kullanılmayan i18n anahtarı ve 5 şablonda artık doğru olmayan "tema" yorumları var.

**Hiçbir şey değişmezse en büyük risk:** `/now/` sayfası gece 00:00-03:00 (TR saati) arasında güncellenip push edilirse, CI tarihi gelecekte görür ve sayfa sitede 404 olur, alt bilgideki link de kaybolur. Sonraki deploy'a kadar böyle kalır. İkincisi, RSS abonelerinin her ay "Now" sayfasını yeni yazı olarak görmesi.

---

## 2) Findings (Prioritized)

### O13. (UYGULANDI) Ana RSS akışı yazı olmayan sayfaları içeriyor; /now/ tarihi `lastmod`'a bağlı
- **Category:** Reliability
- **Severity:** Medium
- **Impact:** RSS abonelerinin gördüğü içerik, `/now/` sayfasının yayında kalması
- **Evidence:**
  - `public/index.xml` (her sayfada `<link rel=alternate>` ve alt bilgideki RSS ikonu buraya gider) 5 öğe içeriyor:

    | Öğe | pubDate |
    |---|---|
    | Now | Sat, 10 Oct 2026 (= `lastmod`) |
    | Turning 2,047 n8n workflows... | Fri, 09 Oct 2026 |
    | flx: a clean job feed... | Thu, 08 Oct 2026 |
    | About | **Mon, 01 Jan 0001** |
    | Projects | **Mon, 01 Jan 0001** |

    `public/tr/index.xml` da aynı durumda. Hugo'nun gömülü `rss.xml`'i ana sayfada `site.RegularPages`'in tamamını kullanıyor. `layouts/index.html` ise listeyi `Section in (post, notes)` ile süzüyor, yani akış sitenin kendisiyle tutarsız. Akışın başlığı da `Home on M. Meriç Ordu` (içerikteki "Home" başlığından geliyor).
  - `content/now/index*.md`'de `date` yok, sadece `lastmod` var. Hugo'nun varsayılan `frontmatter.date` sırası `date → publishDate → lastmod` olduğu için sayfanın yayın tarihi `lastmod`.
  - Deneme: atılabilir kopyada `lastmod: 2026-11-10` yapınca `out/now/` **hiç üretilmedi**, alt bilgideki /now linki de kayboldu (`buildFuture` kapalı). Front matter'daki `2026-11-10`, `2026-11-10T00:00:00Z` olarak okunur. Türkiye'de 10 Kasım 01:00'de yapılan bir push, CI'da hâlâ 9 Kasım 22:00 UTC'dir.
- **Why it's inefficient:** Feed okuyucuları sayfaları `guid`/`pubDate` ile izler. Statik sayfalar akışta kalıcı gürültü yaratıyor, `/now/` ise her güncellemede tepeye çıkıyor. Bir danışmanlık portföyünde RSS'i takip eden okur azdır ama takip eden okur en ilgili okurdur. Yayın tarihinin `lastmod`'a bağlı olması da ilgisiz bir alanın sayfanın yayında kalıp kalmayacağını belirlemesi demek.
- **Recommended fix:**
  1. Sadece yazıları listeleyen site seviyesinde bir ana sayfa RSS şablonu: `layouts/home.rss.xml`. Gömülü şablonun kopyası, tek fark `$pages` satırı (Bölüm 6). Denendi: iki akışta da sadece 2 yazı kaldı, sıra ve içerik aynı, build uyarısız, başka hiçbir dosya değişmedi. Akış başlığı `M. Meriç Ordu` olur.
  2. `content/now/index.md` ve `index.tr.md`'ye sabit bir `date: 2026-10-10` ekle. `lastmod` sadece "Güncellendi" satırını belirler; yayın tarihi artık değişmez. İsteğe bağlı: `hugo.toml`'a `timeZone = "Europe/Istanbul"`. Bu, saat yazılmamış bütün tarihleri (yazıların `date`'i dahil) TR saatiyle okutur ve aynı gece yarısı sorununu yazılar için de kapatır.
- **Tradeoffs / Risks:** Şablon, Hugo'nun gömülü RSS'inin bir kopyası. Hugo onu değiştirirse kopya güncellenmez (bu boyutta önemsiz). **Denenip reddedilen yol:** sayfalara `build: {list: local}` eklemek akışı temizliyor ama Hakkımda/Projeler/Şu an'ı **sitemap'ten de çıkarıyor** (denendi), bu yüzden önerilmiyor.
- **Expected impact estimate:** Akışta 5 → 2 öğe (yazı sayısı kadar). Bir sınıf "sayfa sessizce kayboldu" hatası kapanır. Hız etkisi yok.
- **Removal Safety:** Safe (çıktı farkı sadece iki `index.xml`)
- **Reuse Scope:** site-wide (layouts + 2 içerik dosyası)

### O14. (UYGULANDI) `/tr/404.html` ölü çıktı ve kök 404'ün dil düğmesi onu gösteriyor
- **Category:** Reliability / Dead Code
- **Severity:** Low-Medium
- **Impact:** 404'e düşen ziyaretçinin yönlendirildiği yer, arama motoru sinyali, 1 ölü dosya (9 KB)
- **Evidence:** Build iki 404 üretiyor: `public/404.html` ve `public/tr/404.html`. CLAUDE.md'nin de belirttiği gibi GitHub Pages her eksik adres için sadece kökteki dosyayı sunar. Bu yüzden `/tr/404.html` hiçbir zaman 404 olarak gösterilmez, sadece doğrudan adresiyle ve **200** koduyla açılır. Kök `404.html`'de:
  ```html
  <link rel=alternate hreflang=tr href=https://melwis880.github.io/tr/404.html>
  <a class=icon-btn href=/tr/404.html hreflang=tr ...>   <!-- "Bu sayfayı Türkçe oku" -->
  ```
  Yani 404 sayfasında TR düğmesine basan kişi bir "bulunamadı" sayfasına daha gidiyor. Arama motoru da 200 dönen bir "soft 404" adresi görüyor.
- **Recommended fix:** `hugo.toml`'da `[languages.tr]` altına `disableKinds = ["404"]`. Denendi: tek farklar `tr/404.html`'in kaybolması ve kök 404'te `hreflang` satırının gitmesi. Dil düğmesi, header'daki "çeviri yoksa o dilin ana sayfası" kuralıyla artık `/tr/`'ye gidiyor. Alttaki Türkçe "aradığın sayfa yok" satırı (`notFoundOther*`) aynen duruyor.
- **Tradeoffs / Risks:** Yok. Türkçe 404 metni zaten kök sayfada var. `layouts/404.html`'deki yorum ve CLAUDE.md'deki 404 cümlesi aynı kalabilir.
- **Expected impact estimate:** −1 dosya, doğru dil düğmesi, soft-404 adresi gider.
- **Removal Safety:** Safe (diff ile doğrulandı)
- **Reuse Scope:** config

### O15. (UYGULANDI) Kanıtlanmış ölü kod: `_default/post.html`, 6 i18n anahtarı, eski "tema" yorumları, 1 CSS sınıfı
- **Category:** Maintainability / Dead Code
- **Severity:** Low
- **Impact:** Okunabilirlik, yanlış bağlam (insan ya da ajan için)
- **Evidence:**
  - `layouts/_default/post.html`: atılabilir kopyada silindi, `diff -rq` **çıktı birebir aynı**. Temanın aynı adlı dosyası gittiği için `/post/` listesi artık `post/list.html`'den geliyor. CLAUDE.md bu kontrolü zaten istiyordu.
  - `i18n/en.toml` ve `i18n/tr.toml`: `postedBy`, `on`, `lastModified`, `newerPosts`, `olderPosts`, `featuredTags`. `layouts/` içinde hiçbir çağrısı yok, tema döneminden kalma. `printf "type-%s"`, `project-%s`, `aiNote-%s`, `callout-%s` ile dinamik çağrılanlar ayrı kontrol edildi, onlar kullanılıyor.
  - Artık doğru olmayan yorumlar: `_default/baseof.html:2-3` ("CleanWhite temasının baseof'u yerine geçer; tema klasörü şimdilik yerinde duruyor"), `taxonomy/category.html:1`, `taxonomy/tag.html:1`, `taxonomy/terms.html:1` ("Tema dosyasının yerine geçer").
  - `assets/css/main.css`: `.visually-hidden` hiçbir şablonda, JS'te ya da içerikte kullanılmıyor. (`.footnotes`/`.footnote-backref` Goldmark'ın dipnot çıktısı, `.g4` 4. rozet grubunun rengi: bunlar ileride kullanılabilir, kalsın.)
- **Recommended fix:** `_default/post.html`'i sil (**açık "evet" ile**) ve CLAUDE.md'deki "may be removable" cümlesini güncelle. 6 anahtarı iki i18n dosyasından çıkar. 4 yorumu düzelt. `.visually-hidden`'ı ya sil ya da ilk erişilebilirlik ihtiyacında kullanmak üzere bırak (tek kural, küçük).
- **Tradeoffs / Risks:** Yok.
- **Expected impact estimate:** ~20 satır ve 1 dosya eksilir. Hız etkisi yok.
- **Removal Safety:** `post.html`: Safe (diff boş). i18n: Safe. Yorumlar: Safe.
- **Reuse Scope:** module (layouts, i18n)

### O16. (AÇIK, sahibinin kararıyla kalıyor) Var olmayan `notes/` bölümü için kod dalları
- **Category:** Maintainability / Over-Abstracted Code
- **Severity:** Low
- **Impact:** Okunabilirlik
- **Evidence:** `content/notes/` yok. Buna rağmen: `layouts/index.html:23` (`slice "post" "notes"`), `layouts/partials/site/post-type.html:7-8` (`notes` → `"note"`), `icon.html`'de `"note"` simgesi, i18n'de `type-note`. CLAUDE.md'ye göre yazı türleri üç kategori (`case-study`, `field-note`, `research`). "Kısa not" ihtiyacı `field-note` kategorisiyle karşılanıyor, ayrı bölüm planı yazılı değil.
- **Why it's inefficient:** Hiç çalışmayan bir dal, okuyana iki ayrı yazı sistemi varmış izlenimi veriyor.
- **Recommended fix:** `notes/` bölümü planlanmıyorsa bu dört parçayı kaldır. Planlanıyorsa olduğu gibi bırak. **Sahibinin kararı.**
- **Not:** `_default/section.html` ve `_default/single.html` de bugün hiçbir sayfa için render edilmiyor (`--templateMetrics` listesinde yoklar). Ama ikisi bilinçli yedek şablon: silinirlerse yeni bir bölüm ya da sayfa türü `WARN found no layout file` verir. **Kalmalılar.**
- **Removal Safety:** Needs Verification (sahibine sor)
- **Reuse Scope:** module (layouts, i18n)

### O9. (GÜNCELLENDİ) Footer her sayfada yeniden render ediliyor
- **Category:** Build / Caching
- **Severity:** Low
- **Impact:** Build süresi
- **Evidence:** `--templateMetricsHints`: `site/footer.html` 36 çağrı, **cache potential %98**. `site/header.html` %69 (sayfaya bağlı: `aria-current`, çeviri linki). `site/icon.html` 418 çağrı.
- **Recommended fix:** `baseof.html`'de `{{ partialCached "site/footer.html" . site.Language.Lang }}`. Footer'daki her şey dile bağlı (`site.GetPage "/now"`, `i18n`, `now.Year` build başına sabit). **Denendi:** çıktı birebir aynı. Build 5 çalıştırmada medyan **118 → 102 ms**.
- **Tradeoffs / Risks:** Footer'a ileride sayfaya özel bir şey eklenirse cache anahtarı yanlış olur. Partial'ın başına bir satırlık not düş.
- **Expected impact estimate:** ~%13 daha hızlı build. Mutlak değer önemsiz. **Hijyen, zorunlu değil.**
- **Removal Safety:** Safe
- **Reuse Scope:** local (`baseof.html`)

### O7. (AÇIK) Avatar dönüşümü üç yerde, önceki/sonraki yazı döngüsü O(n²)
- **Category:** Maintainability / Reuse Opportunity / Algorithm
- **Severity:** Low
- **Impact:** Drift riski; çok sayıda yazıda build süresi
- **Evidence:**
  - `resources.Get site.Params.avatar` + `.Fill` üç şablonda: `partials/site/header.html:5-8` ve `post/single.html:60-62` (ikisi de `"96x96 webp Center q85"`, 48x48 gösterim), `_default/about.html:19-22` (`"240x240 webp Center q85"`). İlk ikisinin ayarı elle senkron tutuluyor.
  - `post/single.html:73-78` önceki/sonraki yazıyı bölümdeki bütün yazılar üzerinde elle döngüyle buluyor. Yazı başına O(n), toplamda O(n²). n şu an dil başına 2.
- **Recommended fix:** Avatarı `partials/site/avatar.html` olarak çıkar (boyutu argüman alan ve kaynağı `return` eden bir partial; header ve yazı altı aynı çağrıyı kullanır). Önceki/sonraki için `{{ $pages := (where site.RegularPages "Section" .Section).ByDate }}`, ardından `$pages.Prev .` / `$pages.Next .`. **Dikkat:** Hugo'nun `Pages.Next/Prev` yönü liste sırasının tersidir. Yönü çıktıyı mevcut sürümle diff'leyerek doğrula.
- **Expected impact estimate:** Performans etkisi ancak yüzlerce yazıda ölçülebilir olur. Kazanç ~10 satır tekrar ve tek bir avatar ayarı.
- **Removal Safety:** Needs Verification (çıktı diff'i)
- **Reuse Scope:** module (layouts)

### O8. (AÇIK, GENİŞLEDİ) Gereksiz feed'ler ve ince sitemap girdileri
- **Category:** Build / Cost
- **Severity:** Low
- **Impact:** Çıktı dosya sayısı, tarama bütçesi
- **Evidence:** 24 `index.xml` üretiliyor. Bunların 2'si boş arama feed'i (`/search/index.xml`, `/tr/search/index.xml`), 16'sı etiket/kategori feed'i. Sitemap'te `/search/` ve `/tr/search/` var (JS ile dolan, `?q=` olmadan boş sayfa). 6 etiket x 2 dil = 12 etiket sayfası, her biri 1-2 yazı listeliyor.
- **Recommended fix:** `content/search/_index.md` ve `_index.tr.md` front matter'ına `outputs: ["HTML"]` ve `sitemap: {disable: true}`. İsteğe bağlı: `[outputs] term = ["HTML"]`, `taxonomy = ["HTML"]` (etiket/kategori RSS'i gerekmiyorsa, −16 dosya). Etiket sayfaları kalsın: yazı sayısı arttıkça değer kazanırlar.
- **Expected impact estimate:** 2-18 dosya daha az; sitemap'te ince sayfa yok.
- **Removal Safety:** Safe
- **Reuse Scope:** content front matter / config

### O11. (AÇIK) `/search/` sayfası her tuşta listeyi boşaltıyor
- **Category:** Frontend
- **Severity:** Low
- **Impact:** Yazarken titreme ve düzen kayması
- **Evidence:** `assets/js/search.js:203-212` `pageUpdate()`: `pList.replaceChildren()`, `more.hidden = true` ve `history.replaceState` sorgu sonucu beklenmeden **önce** çalışıyor. `debouncedSearch` 150 ms sonra döndüğü için her tuşta liste boşalıp yeniden doluyor. Üstteki açılır panel (`update()`, satır 121) bunu doğru yapıyor: eski sonuçlar yenisi gelene kadar ekranda kalıyor.
- **Recommended fix:** Temizleme ve URL güncellemesini, `res` gelip sorgunun hâlâ güncel olduğu doğrulandıktan sonraya taşı (Bölüm 6).
- **Expected impact estimate:** Görsel kararlılık. Ölçülebilir hız etkisi yok.
- **Removal Safety:** Safe
- **Reuse Scope:** local file

### O10. (AÇIK) og:image 1920x1440 WebP
- **Category:** Reliability / Network
- **Severity:** Low
- **Impact:** LinkedIn/WhatsApp link önizlemesi
- **Evidence:** Her sayfada `og:image` = `head_image1_hu_*.webp` (47,020 byte, 1920x1440, 4:3). Önizleme kartları 1.91:1 (1200x630) kırpar. LinkedIn'in WebP og:image desteği tutarsız. Site LinkedIn odaklı bir portföy.
- **Recommended fix:** `site/head.html`'de og:image için ayrı bir türev: `.Fill "1200x630 jpg Center q80"`. LinkedIn Post Inspector ile önce/sonra kontrol et.
- **Removal Safety:** Needs Verification (LinkedIn Post Inspector)
- **Reuse Scope:** local (`site/head.html`)

### O12. (AÇIK) CI her çalışmada Hugo `.deb` ve Pagefind'i sıfırdan indiriyor
- **Category:** Build / Network
- **Severity:** Low
- **Impact:** Deploy süresi (birkaç saniye)
- **Evidence:** `.github/workflows/hugo.yaml`: `wget` ile `.deb` + SHA256 kontrolü, `npx --yes pagefind@1.5.2`. Tema gittiği için checkout artık küçük.
- **Recommended fix:** İsteğe bağlı: SHA ile pinli `actions/cache` ile `~/.npm`. SHA256 kontrolü önbellekten sonra da çalışmalı. Bu boyutta site için **düşük öncelik**.
- **Expected impact estimate:** Çalışma başına ~5-10 sn.
- **Removal Safety:** Safe
- **Reuse Scope:** CI

---

## 3) Quick Wins (Do First)

| # | İş | Süre | Kazanç | Onay gerekir mi |
|---|---|---|---|---|
| 1 | O13.1: `layouts/home.rss.xml` (sadece yazılar) | 5 dk | Akışta 3 yanlış öğe gider | Hayır (yeni dosya) |
| 2 | O13.2: `/now/` sayfalarına sabit `date` | 1 dk | Sayfa gece yarısı push'unda kaybolmaz, akışta tekrar çıkmaz | Hayır |
| 3 | O14: `[languages.tr] disableKinds = ["404"]` | 1 dk | Kök 404'ün dil düğmesi doğru yere gider, −1 ölü dosya | Hayır |
| 4 | O15: 6 i18n anahtarı + 4 eski yorum | 5 dk | Doğru bağlam | Hayır |
| 5 | O15: `_default/post.html`'i sil | 1 dk | −1 ölü şablon (diff boş) | **Evet** (silme) |
| 6 | O8: arama sayfası `outputs`/`sitemap` | 2 dk | Boş feed ve ince sitemap girdisi gider | Hayır |
| 7 | O9: footer `partialCached` | 1 dk | Build −%13 (diff boş) | Hayır |

## 4) Deeper Optimizations (Do Next)

1. **O7 refactor'u** (avatar partial + `Pages.Prev/Next`). Tek commit, önce/sonra `public/` diff'i boş olmalı.
2. **O10 paylaşım görseli.** LinkedIn Post Inspector ile birlikte, 3. aşama planıyla.
3. **`/kart/` için Tailwind kaynağını yeniden kurmak** (`tools/kart/`). Bu bir performans kazancı değil, ilk sınıf değişikliğinden önce gereken bir ön koşul (CLAUDE.md).
4. **Önbellek başlıkları.** GitHub Pages fingerprint'li dosyalar dahil her şeye `Cache-Control: max-age=600` veriyor ve `immutable` ayarlanamıyor. Tek çözüm önüne bir CDN koymak. Bu boyutta site için gerekmez, kayıt için yazıldı.

**Bilerek önerilmeyenler (ölçüldü):**
- **`syntax.css`'i ayırmak:** küçültülüp gzip'lenince ~1 KB. Bugün hiçbir sayfada kod bloğu yok (çıktıda `class=chroma` geçmiyor), ama ayırmak tek CSS isteğini ikiye böler. Kazanç bir RTT'den az.
- **`/kart/business_foto1.jpg`'yi yeniden sıkıştırmak:** 102,181 byte, 540x486, zaten ~q80. Yeniden kodlama: JPEG q75 96,111 (−%6), WebP q75 88,292 (−%14). Gösterim `background-size:145%` ile ~232 CSS px, yani 2x ekranda boyut da doğru. Değmez.
- **`theme-init.js`'i inline etmek:** CSP'ye hash eklemek gerekir, CLAUDE.md inline script'i yasaklıyor. Kazanç ~1 RTT, dosya 160 byte.

## 5) Validation Plan

**Referans (a105172):** 77 dosya, 677,148 byte, build 162 ms (`--templateMetrics` ile), uyarı yok.

**Ölçüm (önce/sonra):**
- `hugo --gc --minify --cleanDestinationDir` uyarısız bitmeli. `du -sb public; find public -type f | wc -l`.
- Her değişiklikten önce `cp -r public ~/snap/hugo/common/public.before`, sonra build ve `diff -rq ~/snap/hugo/common/public.before public`. Beklenen farklar:
  - O13: sadece `index.xml` ve `tr/index.xml`
  - O14: `tr/404.html` gider, `404.html` değişir (hreflang ve dil düğmesi)
  - O15 `post.html` silme, O9 footer, i18n temizliği: **fark yok**
  - O8: `search/index.xml`, `tr/search/index.xml` gider, iki sitemap değişir
- `hugo --templateMetrics --templateMetricsHints`: O9 sonrası footer satırı `cached` sütununda 34/36 göstermeli.

**Doğruluk testleri:**
- O13: `grep -o '<item><title>[^<]*' public/index.xml public/tr/index.xml` sadece yazıları listelemeli. Akışı bir validator'da (ör. W3C Feed Validation Service) kontrol et. `/now/` için: atılabilir kopyada `lastmod`'u ileri bir tarihe al, `public/now/` yine üretilmeli (sabit `date` sayesinde).
- O14: Canlıda var olmayan bir adres aç (`/tr/yok/`), TR düğmesi `/tr/`'ye gitmeli. `curl -sI https://melwis880.github.io/tr/404.html` 404 dönmeli (dosya artık yok).
- O7: Önceki/sonraki linkleri iki dilde de aynı yönü gösteriyor.
- O8: `/search/?q=n8n` CI'daki Pagefind ile hâlâ çalışıyor, sitemap'te `search` yok.
- O11: `/search/` sayfasında hızlı yazarken liste boşalmıyor, URL'deki `?q=` sonuçla eşleşiyor.
- Her değişiklikten sonra tarayıcı konsolunda CSP ihlali yok.

## 6) Optimized Code / Patch (O13, O14, O15 uygulandı; gerisi öneri)

**O13.1: yeni dosya `layouts/home.rss.xml`** (atılabilir kopyada denendi)
```go-html-template
{{- /* Ana sayfa RSS'i: sadece yazılar (Hakkımda, Projeler, /now akışa girmez; layouts/index.html ile
     aynı süzgeç). Hugo'nun gömülü rss.xml'inden; fark $pages satırı ve sabit kanal başlığı. */ -}}
{{- $pages := where site.RegularPages "Section" "in" (slice "post" "notes") }}
{{- with site.Config.Services.RSS.Limit }}{{ if ge . 1 }}{{ $pages = $pages | first . }}{{ end }}{{ end }}
{{- printf "<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\"?>" | safeHTML }}
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{{ site.Title }}</title>
    <link>{{ .Permalink }}</link>
    <description>Recent content on {{ site.Title }}</description>
    <generator>Hugo</generator>
    <language>{{ site.Language.Locale }}</language>
    {{- with $pages }}<lastBuildDate>{{ (index .ByLastmod.Reverse 0).Lastmod.Format "Mon, 02 Jan 2006 15:04:05 -0700" | safeHTML }}</lastBuildDate>{{ end }}
    {{- with .OutputFormats.Get "rss" }}
    {{ printf "<atom:link href=%q rel=\"self\" type=%q />" .Permalink .MediaType | safeHTML }}
    {{- end }}
    {{- range $pages }}
    <item>
      <title>{{ .Title }}</title>
      <link>{{ .Permalink }}</link>
      <pubDate>{{ .PublishDate.Format "Mon, 02 Jan 2006 15:04:05 -0700" | safeHTML }}</pubDate>
      <guid>{{ .Permalink }}</guid>
      <description>{{ .Summary | transform.XMLEscape | safeHTML }}</description>
    </item>
    {{- end }}
  </channel>
</rss>
```
(O16'da `notes` kaldırılırsa süzgeç `where site.RegularPages "Section" "post"` olur. İsteğe bağlı: `description` metnini bir i18n anahtarına taşı; TR akışında şu an da İngilizce.)

**O13.2: `content/now/index.md` ve `index.tr.md`**
```diff
 layout: now
+date: 2026-10-10        # yayın tarihi; sabit kalır. Aylık güncellemede sadece lastmod değişir.
 lastmod: 2026-10-10
```
İsteğe bağlı, `hugo.toml` en üst seviyesi:
```diff
 defaultContentLanguageInSubdir = false
+# Saat yazılmamış tarihler (date: 2026-10-10) TR saatiyle okunur; CI UTC'de çalışsa da
+# gece yarısından sonra push edilen yazı/sayfa "gelecekte" sayılıp düşmez.
+timeZone = "Europe/Istanbul"
```

**O14: `hugo.toml`** (atılabilir kopyada denendi)
```diff
   [languages.tr]
     label = "Türkçe"
     locale = "tr-TR"
     weight = 2
+    # GitHub Pages sadece kökteki /404.html'i sunar (TR satırı onun içinde). /tr/404.html
+    # hiç 404 olarak gösterilmiyordu, kök 404'ün dil düğmesi de oraya gidiyordu.
+    disableKinds = ["404"]
```

**O15: i18n (`en.toml` ve `tr.toml` ikisinden de)**
```diff
-[postedBy]
-other = "Posted by"
-[on]
-other = "on"
-[lastModified]
-other = "Last modified on"
-[newerPosts]
-other = "Newer Posts"
-[olderPosts]
-other = "Older Posts"
-[featuredTags]
-other = "FEATURED TAGS"
```
**O15: yorumlar**
```diff
 layouts/_default/baseof.html
-{{- /* Sitenin temel iskeleti. CleanWhite temasının baseof'u yerine geçer; tema klasörü
-     şimdilik yerinde duruyor ama onun Bootstrap/jQuery tabanlı parçaları artık çağrılmıyor.
+{{- /* Sitenin temel iskeleti (tema yok; bütün şablonlar layouts/ altında).
      data-copy / data-copied: assets/js/site.js içindeki Kopyala butonunun metinleri. */ -}}

 layouts/taxonomy/{category,tag,terms}.html
-... Tema dosyasının yerine geçer. */ -}}
+... */ -}}
```
**O15: silme (sadece açık "evet" ile)**
```bash
git rm layouts/_default/post.html
```
ve CLAUDE.md'de: "`_default/post.html` was added because the theme's file of that name hijacked the `/post/` list; with the theme gone it may be removable, check with a `public/` diff first" → kaldırıldı notu.

**O9: `layouts/_default/baseof.html`** (atılabilir kopyada denendi, diff boş)
```diff
-  {{ partial "site/footer.html" . }}
+  {{- /* Footer sayfaya değil dile bağlı: dil başına bir kez render edilir. */}}
+  {{ partialCached "site/footer.html" . site.Language.Lang }}
```

**O8: `content/search/_index.md` ve `_index.tr.md`**
```diff
 ---
 title: "Search"
 description: "Search the site."
+outputs: ["HTML"]
+sitemap:
+  disable: true
 ---
```

**O11: `assets/js/search.js` `pageUpdate()`**
```diff
+  function reset() { pList.replaceChildren(); more.hidden = true; current = []; shown = 0; }
+  function syncUrl(q) {
+    var url = new URL(window.location.href);
+    if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");
+    history.replaceState(null, "", url);
+  }
+
   async function pageUpdate() {
     var q = pInput.value.trim();
-    var url = new URL(window.location.href);
-    if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");
-    history.replaceState(null, "", url);
-    pList.replaceChildren();
-    more.hidden = true;
-    current = [];
-    shown = 0;
-    if (!q) { pStatus.textContent = ""; return; }
+    if (!q) { reset(); syncUrl(q); pStatus.textContent = ""; return; }
     var res;
     try {
       res = await search(q);
     } catch (e) {
       pStatus.textContent = S.unavailable;
       return;
     }
     if (res === null || pInput.value.trim() !== q) return;
+    // Eski sonuçlar yenisi gelene kadar ekranda kalır: yazarken liste titremez.
+    reset();
+    syncUrl(q);
     current = res.results;
```

---

## Önceki denetimlerin durumu

| Bulgu | Durum |
|---|---|
| O1. Build çıktısının 4.46 MB'ı ölü (tema static'i, eski görseller) | **Uygulandı** (0477e31). Çıktı 5.16 MB → 0.68 MB |
| O2. Temanın math/mermaid hook'ları ve `passthrough` | **Uygulandı** (tema ile gitti) |
| O3. Tema tek partial için yükleniyordu | **Uygulandı** (`layouts/partials/webp-image.html`) |
| O4. `favicon.ico` 72 KB | **Uygulandı** (5,238 byte) |
| O5. Görsel hook'u boyutsuz ve hep `lazy` | **Uygulandı** (d88043f: `width`/`height`, ilk görsel eager; Hakkımda fotoğrafı `fetchpriority=high`) |
| O6. `hugo.toml`'da ~30 ölü ayar | **Uygulandı** |
| O7. Şablon tekrarları | **Kısmen**: `page.html` silindi. Avatar (artık 3 yer) ve önceki/sonraki açık → yukarıda |
| O8. Gereksiz feed/sitemap | **Açık**, genişletildi → yukarıda |
| O9. Header/footer cache | **Açık**, ölçüldü → yukarıda |
| O10. og:image biçimi | **Açık** → yukarıda |
| O11. Arama sayfası titremesi | **Açık** → yukarıda |
| O12. CI indirme önbelleği | **Açık**, düşük öncelik → yukarıda |
| 2026-10-09 denetimi (B1-B13) | Hepsi kapandı ya da yukarıdaki O-bulgularına taşındı |
