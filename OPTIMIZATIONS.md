# OPTIMIZATIONS.md

> Kapsam: `redesign` dalı (c0f1e7f). İki dilli Hugo sitesi (EN `/`, TR `/tr/`), site seviyesindeki yeni layout'lar, hâlâ `theme =` ile yüklenen vendored `hugo-theme-cleanwhite`, `/kart/`, Pagefind araması ve GitHub Actions deploy hattı.
> Yöntem: `hugo --gc --minify --cleanDestinationDir --templateMetrics --templateMetricsHints` ile gerçek build alındı, `public/` içindeki her dosyanın üretilen HTML/XML/CSS içinde referans alıp almadığı tarandı, bundle boyutları gzip ile ölçüldü. Rakamlar aksi belirtilmedikçe ölçülmüş değerlerdir.
> Tarih: 2026-10-10. Kaynak dosyalara dokunulmadı (bu dosya hariç). 2026-10-09 tarihli denetimin yerini alır; redesign'dan önceki bulguların çoğu artık geçersiz, durumları en altta.


## Durum (2026-10-10, yayın öncesi temizlik oturumu)

| Bulgu | Durum | Not |
|---|---|---|
| O1 | **Uygulandı** | Tema kaldırıldı (`theme =` satırı + `themes/`, 173 dosya, 8.3 MB), `static/img/` altındaki 10 ölü görsel ve `static/css/custom.css` silindi, `head_image1.jpg` ile `profil-buyuk.png` `assets/img/`'e taşındı |
| O2 | **Uygulandı** | `passthrough` bloğu kaldırıldı; tema gidince math/chem/mermaid hook'ları da gitti |
| O3 | **Uygulandı** | `layouts/partials/webp-image.html` site seviyesinde |
| O4 | **Uygulandı** | `favicon.ico` 16+32 px, 72,398 → 5,238 byte (aynı görsel). `apple-touch-icon` eklenmedi. `/kart/` kendi favicon'unu tanımlamadığı için tarayıcı hâlâ `/favicon.ico` isteyip 404 alıyor (önceden de böyleydi) |
| O5 | Ertelendi | Hakkımda sayfası 2. aşamada baştan yazılacak |
| O6 | **Uygulandı** | 36 ölü ayar ve yorum blokları silindi, `[module]` bloğu kaldırıldı (`static -> assets` mount'u dahil), `sidebar_avatar` → `avatar`. `useEmbedded = "never"` bilerek kaldı. CLAUDE.md düzeltildi |
| O7 | Kısmen | `page.html` 2. aşamadaki Hakkımda/Projeler şablonları için kaldı; avatar ve önceki/sonraki tekrarı açık |
| O8 | Ertelendi | Sitemap'te `/search/` sonraya kaldı |
| O9, O11 | Açık | Düşük öncelik |
| O10 | Ertelendi | Paylaşım kartları / og:image biçimi 3. aşamada |
| O12 | Ertelendi | CI önbelleği sonraya kaldı; tema gidince checkout zaten ~8 MB küçüldü |

**Ölçüm (sonra):** `public/` 5,158,364 → **633,946 byte** (%87.7 azalma), 146 → **75 dosya**, build uyarısız. Önce/sonra `diff -r`: tüm HTML/XML/CSS/JS byte byte aynı, değişen tek ortak dosya `favicon.ico`. İç link kontrolü: 97 yerel yol, 0 eksik. 10 sayfa türü x 2 dil + `/kart/` + açık tema + mobil + başlık araması (26 görüntü) piksel piksel aynı; Pagefind 1.5.2 ile arama iki dilde çalışıyor, CSP ihlali yok.

---

## 1) Optimization Summary

Redesign sonrası sayfa başına yük çok iyi: her sayfa **3 istek** (HTML + 5.1 KB gzip CSS + 2.5 KB gzip JS + 160 B tema-init), jQuery/Bootstrap/Font Awesome tamamen gitti, build **203 ms** ve uyarısız. Çalışma zamanı performansında ciddi bir sorun yok. Sorunlar artık **deploy'a giren ölü dosyalar**, **tema klasörünün hâlâ aktif olan görünmez parçaları** ve birkaç küçük sayfa kalitesi (CLS, favicon) konusunda.

**En yüksek etkili 3 iyileştirme:**
1. **Build çıktısının %86'sı ölü.** `public/` 5.16 MB, bunun **4.46 MB'ı (71 dosya)** hiçbir sayfadan referans almıyor: temanın `static/` klasörü (3.08 MB: Bootstrap, jQuery, FA v4/v5 fontları, iDisqus, kityminder, ödeme QR'ları) ve `static/img/` içindeki 10 eski görsel (1.27 MB). Hepsi her deploy'da herkese açık URL olarak yayında.
2. **Temanın render hook'ları hâlâ devrede.** `render-passthrough.html` + `passthrough` uzantısı açık: düz metinde eşleşmiş bir `\( ... \)` geçerse KaTeX'e gönderiliyor, geçersizse `errorf` ile **build kırılıyor**; geçerliyse KaTeX CSS'i yüklenmediği için formül iki kez görünüyor. Mermaid bloğu da JS olmadan ham metin olarak kalıyor.
3. **`favicon.ico` 72 KB**: ilk ziyarette inen en büyük tek dosya. Bir yazı sayfasının HTML + CSS + JS toplamından (~11 KB gzip) büyük.

**Hiçbir şey değişmezse en büyük risk:** Biri teknik bir yazıda kod bloğu dışında `\(` kullandığında CI'ın sebebi belirsiz bir KaTeX hatasıyla kırılması. İkincisi, ölü tema dosyalarının (bilinen açıkları olan eski jQuery 1.x/Bootstrap 3 kopyaları dahil) sitenin alan adında yayında kalmaya devam etmesi.

---

## 2) Findings (Prioritized)

### O1. (UYGULANDI) Build çıktısının 4.46 MB'ı (71 dosya, %86) ölü
- **Category:** Build / Cost / Dead Code
- **Severity:** High
- **Impact:** Deploy artifact boyutu, herkese açık gereksiz URL'ler, CI upload süresi
- **Evidence:** Üretilen HTML/XML içinde referans alan yerel varlıklar sadece şunlar: `css/site.min.*.css`, `js/site.min.*.js`, `js/theme-init.min.*.js`, `img/favicon.ico`, 3 adet `*_hu_*.webp` (avatar 2 boyut + og:image) ve `/kart/` dosyaları. `public/css`, `public/js`, `public/webfonts`, `public/img` altındaki geri kalan her şey ölü:

  | Kaynak | Dosya | Boyut | Not |
  |---|---|---|---|
  | `themes/hugo-theme-cleanwhite/static/` | 61 | 3,080,569 | `theme =` satırı yüzünden kopyalanıyor. Temanın `head.html`/`footer.html`'i artık render edilmiyor, yani bu dosyaları yükleyen hiçbir şey yok |
  | `static/img/` (10 dosya) | 10 | 1,265,257 | `post.png`, `home-bg-jeep.jpg`, `contact-bg.jpg`, `404-bg.jpg`, `post-bg-coffee.jpeg`, `post-bg-unix-linux.jpg`, `tag-bg.jpg`, `disqus.png`, `favicon.png`, `search.png` |
  | `static/css/custom.css` | 1 | 7,017 | Sadece temanın `head.html`'i (`params.custom_css`) yüklüyordu; o şablon artık çalışmıyor. İçeriği eski navbar sınıfları (`.navbar-custom`) |
  | `static/img/head_image1.jpg`, `profil-buyuk.png` | 2 | 168,165 | Sadece `resources.Get` kaynağı olarak gerekli; çıktıdaki kopyalarına link yok, WebP türevleri kullanılıyor |

  Ayrıca temanın `exampleSite/` (2.5 MB) ve `images/` (2.4 MB) klasörleri build'e girmiyor ama her CI checkout'unda iniyor.
- **Why it's inefficient:** Hugo `static/` (sitenin ve temanın) altındaki her şeyi koşulsuz kopyalıyor. Ziyaretçi bunları indirmiyor ama artifact'in 6'da 5'i çöp; eski `jquery.js` 1.x / Bootstrap 3 kopyaları güvenlik tarayıcılarında "bilinen açıklı kütüphane barındırıyor" uyarısı üretir. CLAUDE.md'deki "`static/img/` sadece referans edilen görselleri içerir" kuralı da çiğneniyor.
- **Recommended fix (üç adım, her biri bağımsız):**
  1. **Tema static'ini kes (silme yok):** Tema bağımlılığını sadece layout'larla sınırla. `hugo.toml`'da `theme = "hugo-theme-cleanwhite"` yerine:
     ```toml
     [[module.imports]]
       path = "hugo-theme-cleanwhite"
       [[module.imports.mounts]]
         source = "layouts"
         target = "layouts"
     ```
     Ya da planlanan tema kaldırma adımının ilk yarısı olarak: `webp-image.html`'i `layouts/partials/`'a kopyala (O3'e bak), sonra `theme =` satırını kaldır. Bu ikinci yol CLAUDE.md'ye göre **açık "evet" gerektiriyor**.
  2. **Site static'indeki 10 ölü görseli ve `custom.css`'i sil** (açık "evet" ile). `hugo.toml`'daki `custom_css` ve `image_404` anahtarları da onlarla gider (O6).
  3. **Sadece kaynak olan görselleri `assets/img/`'e taşı** (`head_image1.jpg`, `profil-buyuk.png`; taşıma için açık "evet"). `resources.Get "img/..."` yolu aynı kalır. Bu yapılınca `static -> assets` mount'una ihtiyaç kalıp kalmadığı ayrıca değerlendirilebilir (bkz. Deeper #3).
- **Tradeoffs / Risks:** Adım 1'de tema shortcode'ları (`figure`, `notice`, `gallery`...) layout mount'unda kaldığı için hâlâ kullanılabilir; `theme =` kaldırılırsa onlar da gider (içerikte şu an hiç shortcode yok, `grep '{{[<%]' content` boş). Adım 3'te `content/hakkimda/index*.md` içindeki `/img/profil-buyuk.png` linki `render-image.html` üzerinden `resources.Get` ile çözüldüğü için çalışmaya devam eder, ama bulunamazsa hook sessizce orijinal yola düşer ve 404 verir: build sonrası kontrol et.
- **Expected impact estimate:** `public/` 5.16 MB → ~0.7 MB (~%86 azalma), dosya sayısı 146 → ~75. CI artifact upload'u buna oranla kısalır.
- **Removal Safety:** Adım 1 (mount): Likely Safe. Adım 2: Safe (referans taraması temiz). Adım 3: Needs Verification.
- **Reuse Scope:** site-wide / CI

### O2. (UYGULANDI) Temanın render hook'ları ve `passthrough` uzantısı görünmez şekilde aktif
- **Category:** Reliability / Dead Code
- **Severity:** Medium
- **Impact:** Build kırılması riski, bozuk görünen içerik
- **Evidence:** Site seviyesinde karşılığı olmayan, bu yüzden hâlâ temadan gelen hook'lar: `_markup/render-passthrough.html`, `render-codeblock-math.html`, `render-codeblock-chem.html` (hepsi `transform.ToMath`, hata durumunda `errorf`), `render-codeblock-mermaid.html` (`<pre class="mermaid">` basar). `hugo.toml`'da `passthrough` açık, sınırlayıcılar `\[ \]`, `$$ $$` ve satır içi `\( \)`. KaTeX CSS'ini ve Mermaid JS'ini yükleyen tema `head.html`/`footer.html`'i artık render edilmiyor; site CSP'si (`style-src 'self'`, `script-src 'self'`) zaten CDN'den yüklemeye izin vermez.
- **Why it's inefficient:** Sonuçlar: (a) kod span'ı dışındaki `\(...\)` metni (regex anlatan bir yazıda olası) TeX olarak ayrıştırılır, geçersizse **build durur**; (b) geçerliyse `htmlAndMathml` çıktısı CSS'siz basılır, formül hem HTML hem MathML olarak iki kez görünür; (c) ` ```mermaid ` bloğu çizim yerine ham metin gösterir ve normal kod bloklarındaki Kopyala butonu/vurgulama da almaz. İçerikte şu an bunlardan hiçbiri yok, yani bu tamamen ölü ama tetiklenmeye hazır davranış.
- **Recommended fix:** Matematik kullanılmıyorsa `[markup.goldmark.extensions.passthrough] enable = false` yap (o bloğu sil). Math/mermaid code-block hook'larını etkisizleştirmek için ya temayı kaldır (O1 adım 1'deki `theme =` yolu) ya da site seviyesinde onları normal kod bloğu gibi basan hook'lar ekle. Matematik ileride gerekirse: `transform.ToMath` + yerel (assets'ten, fingerprint'li) KaTeX CSS'i, sadece `.Page.Store.Get "hasMath"` olan sayfalarda.
- **Tradeoffs / Risks:** Yok denecek kadar az; içerikte kullanımı yok.
- **Expected impact estimate:** Performans etkisi yok; bir sınıf build hatasını ortadan kaldırır.
- **Removal Safety:** Safe (passthrough kapatma), Likely Safe (hook'lar)
- **Reuse Scope:** site-wide (markup)

### O3. (UYGULANDI) Tema yalnızca tek bir partial için yükleniyor
- **Category:** Maintainability / Over-Abstracted Code
- **Severity:** Medium
- **Impact:** O1 ve O2'nin kök nedeni; şablon çakışmaları
- **Evidence:** Site layout'larının temadan kullandığı tek şey `partials/webp-image.html` (`layouts/partials/site/head.html` og:image). Tema `i18n/` içermiyor, içerikte tema shortcode'u yok. Buna karşın tema 44 layout dosyası sağlıyor ve bunlardan bazıları siteyi sessizce etkiliyor: O2'deki hook'lar ve `_default/page.html` (sitenin `_default/page.html`'i, temanınkini gölgelemek için `_default/single.html`'in birebir kopyası olarak durmak zorunda, bkz. O5). CLAUDE.md'deki "the site still uses the theme's ... shortcodes" ifadesi artık doğru değil.
- **Why it's inefficient:** Görünmez bir fallback katmanı: site seviyesinde bir şablon eksik kalırsa (ya da silinirse) hata yerine Bootstrap/jQuery'ye bağlı eski tema şablonu render edilir ve CSP'yi ihlal eden sayfa çıkar.
- **Recommended fix:** `themes/hugo-theme-cleanwhite/layouts/partials/webp-image.html` dosyasını `layouts/partials/webp-image.html` olarak **kopyala** (site seviyesi override; davranış aynı, risk yok). Bu yapıldıktan sonra tema kaldırma adımı tek satırlık bir config değişikliğine iner. Kaldırmanın kendisi CLAUDE.md'ye göre ayrı bir adım ve **açık "evet" ister**.
- **Tradeoffs / Risks:** Kopyalama sıfır risk. Tema kaldırıldıktan sonra `hugo.toml`'daki `[mediaTypes]` woff blokları ve tema parametreleri de ölü olur (O6).
- **Expected impact estimate:** O1 adım 1 + O2'nin tamamı tek hamlede çözülür; checkout'tan ~8 MB tema dosyası düşer.
- **Removal Safety:** Kopyalama: Safe. Tema kaldırma: Needs Verification (build + çıktı diff'i).
- **Reuse Scope:** site-wide

### O4. (UYGULANDI) `favicon.ico` 72 KB; ilk ziyaretteki en büyük dosya
- **Category:** Frontend / Network
- **Severity:** Medium
- **Impact:** İlk ziyaret transfer boyutu, özellikle mobil (`/kart/` QR akışı ayrıca kendi faviconunu tanımlamıyor, tarayıcı `/favicon.ico` arar)
- **Evidence:** `static/img/favicon.ico`: 72,398 byte, tek ikon, 132x132, 32 bpp (`file` çıktısı). Her sayfada `<link rel="icon" href="/img/favicon.ico">`. Karşılaştırma: `/post/flx-case-study/` HTML 13.9 KB ham, CSS 5.1 KB gzip, JS 2.5 KB gzip. `apple-touch-icon` tanımlı değil; iOS `/apple-touch-icon.png` isteyip 404 alır.
- **Why it's inefficient:** Tarayıcı sekme ikonu için 16/32 px gösteriyor; 132 px 32-bit bitmap yaklaşık 15-20 katı veri.
- **Recommended fix:** 16+32 px'lik çok boyutlu bir `favicon.ico` (~5 KB) üret, aynı yolda değiştir. İsteğe bağlı: 180x180 `apple-touch-icon.png` ekle ve `head.html`'e `<link rel="apple-touch-icon" ...>` koy. Komut Bölüm 6'da.
- **Tradeoffs / Risks:** Yok. Görsel olarak kontrol et.
- **Expected impact estimate:** ~72 KB → ~5 KB (~%93). İlk ziyaret toplamı yazı sayfasında ~95 KB → ~28 KB.
- **Removal Safety:** Safe (aynı dosya adı)
- **Reuse Scope:** local file

### O5. Görsel hook'u boyutsuz ve hep `lazy`: CLS ve geciken LCP
- **Category:** Frontend
- **Severity:** Low-Medium
- **Impact:** CLS, `/about/` ve `/tr/hakkimda/` sayfasında LCP
- **Evidence:** `layouts/_default/_markup/render-image.html` çıktısı: `<img src=/img/profil-buyuk_hu_b8248d425cc81cfa.webp alt="M. Meriç Ordu" loading=lazy>`. `width`/`height` yok. Bu görsel `content/hakkimda/index.md:9`'da sayfanın ilk öğesi, yani ekranın üstünde ve muhtemelen sayfanın LCP öğesi.
- **Why it's inefficient:** Boyut olmadan tarayıcı yer ayıramaz; görsel gelince altındaki metin kayar (CLS). Ekranın üstündeki görseli `lazy` yapmak, Chrome'un onu düzen hesaplanana kadar ertelemesine yol açar (Lighthouse "LCP image was lazily loaded" uyarısı).
- **Recommended fix:** İşlenen görselin `.Width`/`.Height` değerlerini bas, sayfadaki ilk görsel (`.Ordinal 0`) için `loading` verme; `decoding="async"` ekle. `main.css:74`'teki `img { max-width:100%; height:auto }` en/boy oranını korur. Patch Bölüm 6'da.
- **Tradeoffs / Risks:** İlk görsel ekranın altındaysa eager yüklenir; bu sitede kabul edilebilir.
- **Expected impact estimate:** Hakkımda sayfasında CLS → ~0, LCP'de birkaç yüz ms (yavaş 3G'de ölç).
- **Removal Safety:** Safe
- **Reuse Scope:** site-wide (markup hook)

### O6. (UYGULANDI) `hugo.toml`'da ~30 ölü ayar; CLAUDE.md'de olmayan bir ayara atıf
- **Category:** Maintainability / Dead Code
- **Severity:** Low
- **Impact:** Config okunabilirliği; ajanın/insanın yanlış varsayımı
- **Evidence:** Site layout'larının okuduğu `site.Params` anahtarları sadece: `social`, `sidebar_avatar`, `header_image`, `tagline`, `SEOTitle`, `description`, `keyword`, `title_404`. Geri kalanlar sadece render edilmeyen tema şablonlarında kullanılıyor:
  - `[params]`: `custom_css`, `sidebar`, `upstreamAttribution`, `archive_title`, `image_404`, `omit_categories`, `page_view_counter`, `leancloud_*`, `featured_tags`, `featured_condition_size`, `ba_track_id`, `disqus_proxy`, `disqus_site`, `twikoo_env_id`, `artalk_*`, `reward`, `friends`, `bookmarks`, `about_me`, `last_posts` + yorumlu `custom_css/custom_js` ve 15 satır yorumlu sosyal hesap şablonu.
  - `[languages.*.params]`: `slogan`, `sidebar_about_description`, `last_posts_title`.
  - Üst seviye: `preserveTaxonomyNames` (Hugo 0.55'te kaldırıldı, yok sayılıyor), `[pagination] pagerSize` (hiçbir şablon `.Paginate` kullanmıyor), `[services.disqus]`, `[services.googleAnalytics]`, `[mediaTypes]` woff/woff2 (sadece tema FA fontları için).
  - `sidebar_avatar` adı yanıltıcı: artık header'daki ve yazı altındaki avatar için kullanılıyor.
  - CLAUDE.md "`algolia_search = false` in hugo.toml" diyor; `hugo.toml`'da böyle bir satır yok.
- **Why it's inefficient:** Config'in ~%40'ı etkisiz; okuyan kişi Disqus/ödül/sidebar'ın açılabilir olduğunu sanar.
- **Recommended fix:** Listeyi sil. `sidebar_avatar` → `avatar` olarak yeniden adlandır (2 şablonda `site.Params.sidebar_avatar` güncellenir). CLAUDE.md'deki Algolia cümlesini "Algolia kullanılmıyor; temada kalan Algolia şablonları ölü" olarak düzelt. Tema kaldırılmadan önce yapılırsa sadece yorum değil, tema şablonlarının bu anahtarlara `default`'suz eriştiği yer var mı diye bakmaya gerek yok: o şablonlar zaten çalışmıyor.
- **Tradeoffs / Risks:** Yok.
- **Expected impact estimate:** `hugo.toml` ~250 → ~150 satır.
- **Removal Safety:** Safe (`grep -rn 'Params\.<anahtar>' layouts` boş dönüyor; tema şablonları render edilmiyor)
- **Reuse Scope:** config

### O7. (KISMEN) Küçük şablon tekrarları
- **Category:** Maintainability / Reuse Opportunity
- **Severity:** Low
- **Impact:** Drift riski
- **Evidence:**
  - `layouts/_default/page.html` ile `layouts/_default/single.html` gövdeleri birebir aynı. `page.html` şu an gerekli: silinirse `layout: page` kullanan Hakkımda/Projeler sayfaları temanın `_default/page.html`'ine düşer. Tema kaldırılınca `page.html` silinebilir ve Hugo `single.html`'e düşer.
  - Avatar dönüşümü iki yerde aynı: `resources.Get site.Params.sidebar_avatar` + `.Fill "96x96 webp Center q85"` (`partials/site/header.html`, `post/single.html` author-note).
  - `post/single.html` önceki/sonraki yazıyı bulmak için bölümdeki tüm yazılarda elle döngü kuruyor (yazı başına O(n), toplam O(n²); n şu an 2).
- **Recommended fix:** Avatarı `partials/site/avatar.html` (ya da `return` eden bir partial ile `partialCached`) olarak çıkar. Önceki/sonraki için `{{ $pages := (where site.RegularPages "Section" .Section).ByDate }}` sonrasında `$pages.Prev .` / `$pages.Next .`. **Dikkat:** Hugo'nun `Pages.Next/Prev` yönü dizin sırasının tersidir; çıktıyı mevcut sürümle diff'le. `page.html`'i tema kaldırıldığı commit'te sil.
- **Tradeoffs / Risks:** Saf refactor; önce/sonra `public/` diff'i boş olmalı.
- **Expected impact estimate:** Performansa etkisi ihmal edilebilir; ~25 satır tekrar gider.
- **Removal Safety:** Needs Verification (çıktı diff'i)
- **Reuse Scope:** module (layouts)

### O8. Gereksiz feed ve sitemap girdileri
- **Category:** Build / Cost
- **Severity:** Low
- **Impact:** Çıktı dosya sayısı, arama motoru tarama bütçesi
- **Evidence:** Build 24 `index.xml` üretiyor; bunlardan `/search/index.xml` ve `/tr/search/index.xml` boş feed'ler. `/search/` ve `/tr/search/` sitemap'te (`public/en/sitemap.xml`, `public/tr/sitemap.xml`); içeriği JS ile dolan, `?q=` olmadan boş bir sayfa.
- **Recommended fix:** `content/search/_index.md` ve `_index.tr.md` front matter'ına:
  ```yaml
  outputs: ["HTML"]
  sitemap:
    disable: true
  ```
  İsteğe bağlı: etiket feed'leri gerekmiyorsa `[outputs] term = ["HTML"]` ve `taxonomy = ["HTML"]`.
- **Expected impact estimate:** 2-16 dosya daha az; sitemap'te ince sayfa yok.
- **Removal Safety:** Safe
- **Reuse Scope:** content front matter / config

### O9. Header/footer partial'ları her sayfada yeniden çalışıyor
- **Category:** Build / Caching
- **Severity:** Low
- **Impact:** Build süresi (şu an 203 ms, sorun değil)
- **Evidence:** `--templateMetricsHints`: `site/footer.html` 34 çağrı, **cache potential %98**; `site/header.html` %68; `site/icon.html` 380 çağrı (her çağrıda 19 SVG string'li iki `dict` kuruluyor).
- **Recommended fix:** Footer'ı `{{ partialCached "site/footer.html" . site.Language.Lang }}` yap (içeriği sayfaya değil dile bağlı; `now.Year` build zamanında zaten sabit). İkon için string argümanlı çağrılarda `partialCached "site/icon.html" "search" "search"`. Header sayfaya bağlı (`aria-current`, çeviri linki) olduğu için olduğu gibi kalsın.
- **Tradeoffs / Risks:** Footer'a ileride sayfaya özel bir şey eklenirse cache anahtarı yanlış olur; partial'ın başına not düş.
- **Expected impact estimate:** Wall-clock'ta birkaç ms. İçerik 10 kat büyüse bile önemsiz kalır. **Sadece hijyen; yapmasan da olur.**
- **Removal Safety:** Safe
- **Reuse Scope:** module (layouts)

### O10. og:image 1920x1440 WebP
- **Category:** Reliability / Network
- **Severity:** Low
- **Impact:** LinkedIn/WhatsApp link önizlemesi
- **Evidence:** Her sayfada `og:image` = `head_image1_hu_*.webp` (47 KB, 1920x1440, 4:3). Önizleme kartları 1.91:1 (1200x630) kırpıyor. LinkedIn'in WebP og:image desteği belgelerde tutarsız; site LinkedIn odaklı bir danışmanlık portföyü.
- **Recommended fix:** og:image için ayrı, sabit bir türev üret: `.Fill "1200x630 jpg Center q80"` (~60-90 KB JPEG). LinkedIn Post Inspector ile önce/sonra kontrol et.
- **Tradeoffs / Risks:** Biraz daha büyük dosya, ama sadece crawler'lar indiriyor.
- **Expected impact estimate:** Performans etkisi yok; önizleme güvenilirliği.
- **Removal Safety:** Needs Verification (LinkedIn Post Inspector)
- **Reuse Scope:** local (`site/head.html`)

### O11. `/search/` sayfası her tuşta listeyi boşaltıyor
- **Category:** Frontend
- **Severity:** Low
- **Impact:** Yazarken titreme ve düzen kayması
- **Evidence:** `assets/js/search.js` `pageUpdate()`: `pList.replaceChildren()` ve `more.hidden = true` sorgu beklenmeden **önce** çalışıyor; `debouncedSearch` 150 ms sonra döndüğü için her tuşta liste boşalıp yeniden doluyor. `history.replaceState` de her tuşta çağrılıyor. Üstteki açılır panel (`update()`) bunu doğru yapıyor: eski sonuçlar yenisi gelene kadar duruyor.
- **Recommended fix:** Listeyi temizleme ve durum metnini yazma işini `res` geldikten ve sorgunun hâlâ güncel olduğu doğrulandıktan sonraya taşı. `replaceState`'i de aynı yere al.
- **Expected impact estimate:** Görsel kararlılık; ölçülebilir hız etkisi yok.
- **Removal Safety:** Safe
- **Reuse Scope:** local file

### O12. CI her çalışmada Hugo `.deb` ve Pagefind'i sıfırdan indiriyor
- **Category:** Build / Network
- **Severity:** Low
- **Impact:** Deploy süresi (birkaç saniye)
- **Evidence:** `.github/workflows/hugo.yaml`: `wget` ile ~20 MB `.deb`, `npx --yes pagefind@1.5.2`. Checkout, build'e girmeyen tema `exampleSite/` + `images/` (~5 MB) dahil ~13 MB çekiyor.
- **Recommended fix:** Önce O1/O3 (tema) ile checkout küçülür. Önbellek isteğe bağlı: SHA ile pinli `actions/cache` ile `~/.npm`; SHA256 doğrulaması önbellekten sonra da çalışmalı.
- **Tradeoffs / Risks:** Bakımı yapılacak bir action daha. Bu boyutta site için **düşük öncelik**.
- **Expected impact estimate:** Run başına ~5-10 sn.
- **Removal Safety:** Safe
- **Reuse Scope:** CI

---

## 3) Quick Wins (Do First)

| # | İş | Süre | Kazanç | Onay gerekir mi |
|---|---|---|---|---|
| 1 | O2: `passthrough` uzantısını kapat | 1 dk | Bir sınıf build hatası gider | Hayır |
| 2 | O3: `webp-image.html`'i `layouts/partials/`'a kopyala | 1 dk | Tema kaldırmanın önü açılır | Hayır |
| 3 | O1.1: `theme =` yerine sadece-layout mount'u (ya da tema kaldırma) | 5 dk | Çıktı −3.08 MB | Mount: hayır. Kaldırma: **evet** |
| 4 | O4: favicon'u 16+32 px ICO olarak yeniden üret | 5 dk | İlk ziyarette −67 KB | Hayır (yerinde değişim) |
| 5 | O1.2: 10 ölü görsel + `custom.css` sil | 2 dk | Çıktı −1.27 MB | **Evet** (silme) |
| 6 | O5: render-image'e width/height, ilk görsel eager | 5 dk | Hakkımda'da CLS ~0 | Hayır |
| 7 | O8: arama sayfası için `outputs`/`sitemap` front matter | 2 dk | Boş feed ve ince sitemap girdisi gider | Hayır |
| 8 | O6: CLAUDE.md'deki `algolia_search` cümlesini düzelt | 1 dk | Doğru bağlam | Hayır |

## 4) Deeper Optimizations (Do Next)

1. **Temayı tamamen kaldırmak** (O1 + O2 + O3 + O7'nin `page.html` kısmı + O6'nın tema parametreleri). Sıra: webp-image kopyası → `theme =` satırı → build + çıktı diff'i → `themes/` klasörünü silmek (**açık "evet"**) → CLAUDE.md'deki tema maddelerini güncellemek. Sonuç: ~10 MB daha küçük repo ağacı, ~0.7 MB'lık deploy, gizli fallback katmanı yok.
2. **O6 config temizliği**, tema kaldırıldıktan sonra tek commit'te (`[mediaTypes]`, tema parametreleri, `sidebar_avatar` → `avatar`).
3. **`static -> assets` mount'unu kaldırmak.** Kaynak görseller (`head_image1.jpg`, `profil-buyuk.png`) `assets/img/`'e taşınırsa bu mount'a ihtiyaç kalmaz; CLAUDE.md'deki `useEmbedded = "never"` notunun kök nedeni de (mount edilmiş `/kart/` klasörünü kaynak sanma) ortadan kalkar. Ama `useEmbedded`'i geri açmak ayrı bir test ister, kendiliğinden yapma. Taşıma için **açık "evet"**.
4. **Önbellek başlıkları.** GitHub Pages fingerprint'li dosyalar dahil her şeye `Cache-Control: max-age=600` veriyor; `immutable` ayarlanamıyor. Tekrar ziyaretlerde 10 dakikada bir koşullu istek (304) gider. Çözüm sadece önüne bir CDN (ör. Cloudflare) koymak; bu boyutta site için gerekmez, kayıt için yazıldı.

**Bilerek önerilmeyenler:**
- `theme-init.js`'i inline etmek (160 B'lık render-blocking istek gider ama CSP'ye hash eklemek gerekir; CLAUDE.md inline script'i yasaklıyor, kazanç ~1 RTT).
- `syntax.css`'i sadece kod bloğu olan sayfalara ayırmak (gzip'le birkaç KB, tek CSS isteği bozulur).
- `/kart/` avatarını WebP'ye çevirmek (102 KB → ~40 KB olur ama `kart.css` derlenmiş ve Tailwind kaynağı yok; önce `tools/kart/` kurulmalı).

## 5) Validation Plan

**Ölçüm (önce/sonra):**
- `hugo --gc --minify --cleanDestinationDir` uyarısız bitmeli. Referans: **146 dosya, 5,158,364 byte, 203 ms**. `du -sb public; find public -type f | wc -l`.
- Ölü dosya kontrolü (O1 sonrası 0'a yakın olmalı):
  ```bash
  find public -type f \( -path 'public/css/*' -o -path 'public/js/*' -o -path 'public/webfonts/*' -o -path 'public/img/*' \) \
    ! -name 'site.min.*' ! -name 'theme-init.min.*' ! -name 'favicon.ico' ! -name '*_hu_*' -printf '%s\n' \
    | awk '{s+=$1;n++} END{print n" dosya, "s" byte"}'
  ```
- Kırık link kontrolü (her silme/taşımadan sonra): üretilen HTML'deki her yerel `src`/`href`'in `public/` altında var olduğunu doğrula:
  ```bash
  grep -rhoE '(src|href)=("[^"]*"|[^ >]+)' public --include='*.html' | sed -E 's/^(src|href)=//; s/"//g' \
    | grep '^/' | grep -v '^//' | sed 's/[?#].*//' | sort -u \
    | while read p; do f="public$p"; [ -e "$f" ] || [ -e "${f%/}/index.html" ] || echo "EKSİK: $p"; done
  ```
- Lighthouse mobil: `/about/` (CLS, LCP, "lazily loaded LCP image" uyarısı), `/post/flx-case-study/` (toplam transfer).
- `hugo --templateMetrics --templateMetricsHints`: `site/footer.html` cache yüzdesi ~%97'ye çıkmalı (O9).

**Doğruluk testleri:**
- O2: Geçici bir test yazısına kod span'ı dışında `\(x\)` ve bir ` ```mermaid ` bloğu koy (throwaway kopya, `~/snap/hugo/common/` altında); passthrough kapalıyken build geçmeli ve metin olduğu gibi görünmeli.
- O3/O1 tema değişikliği: `cp -r public /home/yemliha/snap/hugo/common/public.before` → değişiklik → build → `diff -r` sadece silinen static dosyaları göstermeli, hiçbir `.html` farkı olmamalı.
- O5: Hakkımda sayfasında görselin oranı ve köşe yuvarlaması aynı; `width`/`height` attribute'ları var.
- O7: Önceki/sonraki linkleri iki dilde de aynı yönü gösteriyor.
- O8: `/search/?q=n8n` CI'daki Pagefind ile hâlâ çalışıyor; sitemap'te `search` yok.
- O10: LinkedIn Post Inspector'da kart görseli görünüyor.
- Her değişiklikten sonra tarayıcı konsolunda CSP ihlali yok.

## 6) Optimized Code / Patch (öneri, uygulanmadı)

**O2: `hugo.toml`** (matematik kullanılmıyor)
```diff
-    [markup.goldmark.extensions]
-      [markup.goldmark.extensions.passthrough]
-        enable = true
-        [markup.goldmark.extensions.passthrough.delimiters]
-          block = [['\[', '\]'], ['$$', '$$']]
-          inline = [['\(', '\)']]
```

**O1 adım 1: `hugo.toml`** (tema dosyaları silinmeden static'i kesmek)
```diff
-theme = "hugo-theme-cleanwhite"
 ...
 [module]
+  # Temadan sadece layout'lar (webp-image partial'ı ve shortcode'lar) alınıyor;
+  # temanın static/ klasörü (Bootstrap, jQuery, FA fontları) artık yayına girmiyor.
+  [[module.imports]]
+    path = "hugo-theme-cleanwhite"
+    [[module.imports.mounts]]
+      source = "layouts"
+      target = "layouts"
   [[module.mounts]]
```

**O3: kopya (site seviyesi override)**
```bash
cp themes/hugo-theme-cleanwhite/layouts/partials/webp-image.html layouts/partials/webp-image.html
```

**O4: favicon (aynı dosya adı)**
```bash
cp static/img/favicon.ico ~/Pictures/favicon.orig.ico
convert ~/Pictures/favicon.orig.ico[0] -resize 32x32 -define icon:auto-resize=32,16 static/img/favicon.ico
```

**O5: `layouts/_default/_markup/render-image.html`**
```diff
 {{- $dest := .Destination -}}
 {{- $src := $dest -}}
+{{- $img := false -}}
 ...
       {{- with .Process "webp" -}}
         {{- $src = .RelPermalink -}}
+        {{- $img = . -}}
       {{- end -}}
 ...
+{{- /* Sayfanın ilk görseli genelde ekranın üstünde: lazy yüklenirse LCP gecikir. */ -}}
+{{- $loading := cond (eq .Ordinal 0) "eager" "lazy" -}}
 {{ if .Title }}
   <figure>
-    <img src="{{ $src }}" alt="{{ .Text }}" loading="lazy">
+    <img src="{{ $src }}" alt="{{ .Text }}"{{ with $img }} width="{{ .Width }}" height="{{ .Height }}"{{ end }} loading="{{ $loading }}" decoding="async">
     <figcaption>{{ .Title }}</figcaption>
   </figure>
 {{ else }}
-  <img src="{{ $src }}" alt="{{ .Text }}" loading="lazy">
+  <img src="{{ $src }}" alt="{{ .Text }}"{{ with $img }} width="{{ .Width }}" height="{{ .Height }}"{{ end }} loading="{{ $loading }}" decoding="async">
 {{ end }}
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

**O9: `layouts/_default/baseof.html`**
```diff
-  {{ partial "site/footer.html" . }}
+  {{- /* Footer sayfaya değil dile bağlı: dil başına bir kez render edilir. */}}
+  {{ partialCached "site/footer.html" . site.Language.Lang }}
```

**O11: `assets/js/search.js` `pageUpdate()`**
```diff
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
+    if (!q) { reset(); pStatus.textContent = ""; syncUrl(q); return; }
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
(`reset()` = `pList.replaceChildren(); more.hidden = true; current = []; shown = 0;`, `syncUrl(q)` = mevcut `URL` + `replaceState` satırları.)

**O1 adım 2: silinecek dosyalar (sadece açık "evet" ile)**
```bash
git rm static/img/{post.png,home-bg-jeep.jpg,contact-bg.jpg,404-bg.jpg,post-bg-coffee.jpeg,post-bg-unix-linux.jpg,tag-bg.jpg,disqus.png,favicon.png,search.png} static/css/custom.css
```

---

## Önceki denetimin (2026-10-09) durumu

| Eski bulgu | Durum |
|---|---|
| B1. `/kart/` avatarı 1.7 MB | **Çözüldü** (102 KB, 540x486, EXIF yok) |
| B2. `static/img/` referanssız 9 dosya | **Kısmen**: `manzara1.JPG` gitti; 8'i kaldı, redesign ile `404-bg.jpg` ve `favicon.png` da ölü oldu → O1 |
| B3. `<head>`'de render-blocking jQuery/Bootstrap, ölü lazysizes/zanshang | **Redesign ile çözüldü**: tema `head.html` artık render edilmiyor; sayfada tek defer'lı JS bundle var |
| B4. 11 ikon için Font Awesome | **Çözüldü** (`partials/site/icon.html` inline SVG) |
| B5. CI `fetch-depth: 0` | **Çözüldü** (sığ klon) |
| B6. İki `single.html` kopyası | **Geçersiz** (yeniden yazıldı); yeni küçük tekrar → O7 |
| B7. Tema static'inden 27 ölü dosya | **Açık ve büyüdü**: artık temanın static'inin tamamı (61 dosya, 3.08 MB) ölü → O1 |
| B8. `webp-image` 70 kez çalışıyor | **Çözüldü** (`partialCached`, %94 cache isabeti) |
| B9. Sidebar çift `where` | **Geçersiz** (sidebar kaldırıldı) |
| B10. `hugo.toml` hayalet ayarlar | **Açık ve büyüdü** → O6 |
| B11. `favicon.ico` 72 KB, `profil-buyuk.png` aslında JPEG q100 | Favicon **açık** → O4. Profil görseli artık sadece WebP türevleriyle (1.9 / 5.4 KB) veriliyor, sorun değil |
| B12. CLAUDE.md'de olmayan Algolia script'i | **Çözüldü**; yerine yeni küçük sapma (`algolia_search` satırı) → O6 |
| B13. CI indirme önbelleği | **Açık**, düşük öncelik → O12 |
