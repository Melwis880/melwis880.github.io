# OPTIMIZATIONS.md

> Kapsam: iki dilli (EN `/`, TR `/tr/`) Hugo sitesi, vendored + elle yamalı `hugo-theme-cleanwhite` teması, `/kart/` statik kartvizit sayfası ve GitHub Actions deploy hattı.
> Yöntem: `hugo --gc --minify --cleanDestinationDir --templateMetrics` ile gerçek build alındı, üretilen `public/` çıktısı tarandı, git paket boyutu ve EXIF verisi ölçüldü. Rakamlar aksi belirtilmedikçe ölçülmüş değerlerdir.
> Tarih: 2026-10-09. Kaynak dosyalara dokunulmadı (bu dosya hariç). 2025-08-21 tarihli önceki denetimin yerini alır; eski bulguların durumu en altta.

> **Uygulandı (2026-10-09, commit edilmedi):** B1 (avatar 540x486, EXIF yok, 1.7 MB → 102 KB; yaprak dokusu yüzünden tahmin edilen 30-50 KB'tan büyük), B3.1, B5, B8 (`baseof.html` ve `_default/post.html` dahil; `webp-image` çağrılarının %94'ü cache'ten geliyor), B9, B12, B2'den sadece `manzara1.JPG`. Build çıktısı 11 MB → 5.6 MB, build uyarısız. Diğer 8 görsel ve B3.2, B4, B6, B7, B10, B11, B13 açık.

---

## 1) Optimization Summary

Site küçük: 61 sayfa (31 EN + 30 TR), build süresi **286 ms**, build uyarısız, çıktı **11 MB / 160 dosya**. Ağustos denetimindeki büyük sorunlar (199 MB'lık `public/` birikintisi, 2.4 MB header görseli, FastClick, `deploy.sh`) çözülmüş. Build süresi bir sorun değil. Kalan sorunlar **ziyaretçiye giden gereksiz byte'lar**, **deploy'a giren ölü dosyalar** ve **CI'ın her seferinde çektiği 42.8 MB'lık git geçmişi**.

**En yüksek etkili 3 iyileştirme:**
1. `/kart/` sayfasındaki 160 px'lik avatar için **1.7 MB, 2533x2281 piksel JPEG** iniyor (telefon EXIF'iyle birlikte). Kartvizit QR'dan, yani mobil veriyle açılan sayfa. ~480 px'e küçültünce ~%97 tasarruf.
2. `static/img/` içinde **hiçbir yerden referans edilmeyen 9 dosya (~4.7 MB)** var. Bunlardan `manzara1.JPG` (3.4 MB, Canon EXIF + GPS bloğu) `https://melwis880.github.io/img/manzara1.JPG` adresinden herkese açık yayında.
3. Her sayfanın `<head>` kısmında **4 adet senkron (render-blocking) script** (~129 KB ham / ~43 KB gzip) ve **5 CSS** (~197 KB ham / ~39 KB gzip) var. Bunlardan `lazysizes.min.js` ve `zanshang.min.css` sitede hiç kullanılmıyor.

**Hiçbir şey değişmezse en büyük risk:** Mobil ziyaretçilerde (özellikle `/kart/` QR akışında) yavaş ilk açılış, ve CLAUDE.md'deki "`static/img/` sadece referans edilen görselleri içerir" kuralının sessizce çiğnenmeye devam etmesi. Yayındaki fazla dosyalar, fotoğraf meta verisini de (kamera/telefon modeli, çekim tarihi) dışarı sızdırıyor.

---

## 2) Findings (Prioritized)

### B1. `/kart/` avatarı 1.7 MB, ekranda 160 px
- **Category:** Frontend / Network
- **Severity:** High
- **Impact:** `/kart/` LCP süresi, mobil veri kullanımı
- **Evidence:** `static/kart/business_foto1.jpg`: 1,740,942 byte, 2533x2281, baseline JPEG. EXIF içinde `Make=HONOR`, `Model=DNY-NX9`, `DateTimeOriginal=2026:05:29 18:10:47` var. Kullanıldığı yer `static/kart/kart.css` içindeki `.avatar-photo{background-image:url(business_foto1.jpg);background-size:145%}`. Element boyutu `w-36 h-36 sm:w-40 sm:h-40` (`static/kart/index.html:38`), yani en fazla 160 px. %145 bg-size ile ~232 px genişlik, 2x ekranda ~464 px yeterli.
- **Why it's inefficient:** Gereken piksel sayısının ~27 katı indiriliyor. Sayfadaki diğer her şey (HTML 6 KB, CSS 10 KB, JS 1 KB, QR 6 KB) toplamda ~23 KB. Yani sayfa ağırlığının ~%99'u bu tek görsel.
- **Recommended fix:** Görseli ~480x480'e kırp/küçült, EXIF'i sil, kaliteyi ~80 yap. **Dosya adını aynı tut** ki önceden derlenmiş `kart.css` değişmesin (Tailwind kaynağı yok, bkz. CLAUDE.md). Örnek komutlar Bölüm 6'da.
- **Tradeoffs / Risks:** `background-position:center 22%` ve `background-size:145%` orijinal en/boy oranına göre ayarlanmış. Kırparken oranı (~1.11:1) koru ya da sadece ölçekle. Görsel olarak kontrol et.
- **Expected impact estimate:** 1.7 MB → ~30-50 KB (~%97 azalma). Sayfa toplamı ~1.76 MB → ~70 KB.
- **Removal Safety:** Safe (dosya yerinde değişir, referans aynı kalır). Orijinali repo dışında sakla.
- **Reuse Scope:** local file

### B2. `static/img/` içinde referanssız 9 dosya (~4.7 MB), biri GPS bloklu 3.4 MB fotoğraf
- **Category:** Cost / Build / Dead Code
- **Severity:** High
- **Impact:** Deploy boyutu, herkese açık gereksiz URL'ler, meta veri sızıntısı
- **Evidence:** `content/`, `layouts/`, `hugo.toml`, `static/css` ve tema layout'ları tam dosya adıyla tarandı (tema `exampleSite/` ve `README.md` hariç). Hiç referans edilmeyenler:

  | Dosya | Boyut | Not |
  |---|---|---|
  | `manzara1.JPG` | 3,426,818 | 5184x3456, Canon EOS 650D EXIF, `GPSVersionID` var (koordinat yok) |
  | `post.png` | 310,336 | sadece tema README'sinde geçiyor |
  | `home-bg-jeep.jpg` | 274,543 | sadece tema exampleSite'ta |
  | `contact-bg.jpg` | 226,472 | |
  | `post-bg-coffee.jpeg` | 113,000 | |
  | `post-bg-unix-linux.jpg` | 91,217 | |
  | `tag-bg.jpg` | 83,785 | |
  | `disqus.png` | 19,329 | sadece tema README'sinde |
  | `search.png` | 3,171 | sadece tema README'sinde |

  Ayrıca `favicon.png` sadece `reward.html` partial'ında kullanılıyor ve `reward = false`; Needs Verification.
- **Why it's inefficient:** Hugo `static/` altındaki her şeyi yayına kopyalıyor. CLAUDE.md bu klasörün sadece referans edilen görselleri içermesini açıkça istiyor.
- **Recommended fix:** Listeyi kaldır. **Silme işlemi global kural gereği açık "evet" ister**, bu denetim hiçbir şey silmedi. `manzara1.JPG` ileride kullanılacaksa küçültülmüş ve EXIF'i temizlenmiş bir kopyasını bir sayfa paketine (page bundle) koy.
- **Tradeoffs / Risks:** Tema bazı arka planları sayfa front matter'ındaki `image:` alanından alabilir; şu an hiçbir içerikte bu dosyalar kullanılmıyor. Silmeden önce son kez `grep -r <ad> content layouts themes/*/layouts` çalıştır.
- **Expected impact estimate:** Deploy çıktısı 11 MB → ~6.3 MB (~%43).
- **Removal Safety:** Likely Safe (`manzara1.JPG` için kullanıcı niyeti teyit edilmeli)
- **Reuse Scope:** local folder

### B3. `<head>` içinde render-blocking script/CSS, ikisi tamamen ölü
- **Category:** Frontend
- **Severity:** Medium
- **Impact:** FCP/LCP, ana thread süresi, istek sayısı
- **Evidence:** `themes/hugo-theme-cleanwhite/layouts/partials/head.html` her sayfada şunları `defer`/`async` olmadan `<head>` içine basıyor:

  | Dosya | Ham | gzip | Durum |
  |---|---|---|---|
  | `js/jquery.min.js` | 84,320 | 29,384 | footer'daki inline scriptler (`generateCatalog`, tagcloud) kullanıyor |
  | `js/bootstrap.min.js` | 35,452 | 9,400 | navbar collapse için |
  | `js/hux-blog.min.js` | 1,342 | 588 | navbar scroll davranışı |
  | `js/lazysizes.min.js` | 7,889 | 3,509 | **ölü**: çıktıda `lazyload` sınıfı 0 sayfada var. Tek kullanıcısı `post-image` shortcode'u, içerikte hiç kullanılmıyor. Görseller zaten native `loading="lazy"` ile geliyor (`layouts/_default/_markup/render-image.html`) |
  | `css/zanshang.min.css` | 3,154 | 995 | **ölü**: bağış (reward) CSS'i, `reward = false` |
  | `css/bootstrap.min.css` | 107,423 | 18,738 | tüm Bootstrap 3 |
  | `css/font-awesome.all.min.css` | 59,345 | 12,713 | bkz. B4 |
- **Why it's inefficient:** `<head>` içindeki senkron scriptler HTML ayrıştırmasını durduruyor. İlk boyama ~43 KB gzip JS'in inip çalışmasını bekliyor. Ölü iki dosya her sayfada 2 ekstra istek demek.
- **Recommended fix:**
  1. (Hızlı) `lazysizes` satırını kaldır ya da `{{ if .Page.Store.Get "hasLazyImage" }}` gibi bir koşula bağla. `zanshang.min.css` satırını `{{ if .Site.Params.reward }}` içine al.
  2. (Orta) Kalan 3 scripti `<head>`'den çıkarıp `footer.html` içinde, jQuery kullanan inline scriptlerden **önce** yükle. Ya da `defer` ekleyip footer'daki inline scriptleri `document.addEventListener('DOMContentLoaded', ...)` içine sar. Sadece `defer` eklemek inline scriptleri kırar, çünkü jQuery onlar çalışırken henüz yüklenmemiş olur.
- **Tradeoffs / Risks:** `head.html` zaten yamalı tema dosyası, değiştirmek serbest ama upstream ile farkı büyütür. Navbar açma/kapama ve içindekiler (catalog) davranışını mobilde test et.
- **Expected impact estimate:** Ölü dosyalar: sayfa başına 2 istek ve ~4.5 KB gzip daha az. Script taşıma: yavaş 3G'de FCP'de birkaç yüz ms iyileşme (Lighthouse ile ölç).
- **Removal Safety:** lazysizes/zanshang: Safe. Script taşıma: Needs Verification.
- **Reuse Scope:** site-wide

### B4. 11 ikon için Font Awesome'ın tamamı (~59 KB CSS + ~158 KB font)
- **Category:** Frontend / Network
- **Severity:** Medium
- **Impact:** İlk ziyarette sayfa ağırlığı, font yüklenene kadar boş ikon kutuları
- **Evidence:** Çıktıda kullanılan ikonlar: `fa-circle`, `fa-twitter`, `fa-linkedin`, `fa-github`, `fa-rss`, `fa-envelope`, `fa-search`, `fa-globe`, `fa-home` (+ `fa-stack` yardımcıları). Bunlar için `font-awesome.all.min.css` (59 KB) ile `fa-brands-400.woff2` (78 KB) ve `fa-solid-900.woff2` (80 KB) iniyor. CSS ayrıca repoda olmayan `fa-regular-400.*`, `.eot`, `.ttf`, `.svg` dosyalarına referans veriyor. Bunlar tarayıcı tarafından istenmiyor (woff2 önce seçiliyor, `far` ikonu yok) ama ölü kural.
- **Why it's inefficient:** ~1.5 bin ikonun glyph'i ve CSS kuralı, 9 ikon için indiriliyor.
- **Recommended fix:** 9 ikonu inline SVG'ye (ya da tek bir `static/img/icons.svg` sprite + `<use href>`) çevir. Kullanıldıkları yerler `footer.html`, `nav.html`, `sidebar.html`. Daha az iş isteyen ara çözüm: FA subsetter ile sadece bu glyph'leri içeren woff2 üret.
- **Tradeoffs / Risks:** Birden çok yamalı partial'a dokunur. `fa-stack` görünümü CSS ile yeniden kurulmalı.
- **Expected impact estimate:** İlk ziyarette ~45 KB gzip CSS+font yerine ~3-4 KB SVG (~%90 azalma). 2 font isteği ortadan kalkar.
- **Removal Safety:** Needs Verification (görsel regresyon kontrolü)
- **Reuse Scope:** site-wide

### B5. CI tüm git geçmişini çekiyor (`fetch-depth: 0`), kimse kullanmıyor
- **Category:** Build / Network / Cost
- **Severity:** Medium
- **Impact:** Her deploy'da checkout süresi ve indirilen veri
- **Evidence:** `.github/workflows/hugo.yaml` checkout adımında `fetch-depth: 0` var. `hugo.toml` ve tüm layout'larda `enableGitInfo`/`.GitInfo` yok, yani geçmiş hiçbir yerde okunmuyor. Yerel paket boyutu **42.80 MiB**. Bunun ~40 MB'ı artık ağaçta olmayan, geçmişte kalmış görseller: `manzara2.JPG` 5.3 MB, `home-kedi.JPG` 4.7 MB, `head_image4-7.jpg` ~14 MB, `low-poly-abstract-design.zip` 3.0 MB, vb.
- **Why it's inefficient:** Her push'ta, son commit ~8 MB iken ~43 MB'lık geçmiş indiriliyor.
- **Recommended fix:** `fetch-depth: 0` satırını sil (varsayılan değer 1, sığ klon). İleride `enableGitInfo = true` açılırsa geri ekle.
- **Tradeoffs / Risks:** Yok. Pagefind ve Hugo geçmişe ihtiyaç duymuyor.
- **Expected impact estimate:** Checkout verisi ~43 MB → ~8 MB. Checkout adımında birkaç saniye kazanç.
- **Removal Safety:** Safe
- **Reuse Scope:** CI

### B6. `_default/single.html` ile `post/single.html` neredeyse aynı (~130 satır x2)
- **Category:** Maintainability / Reuse Opportunity
- **Severity:** Medium
- **Impact:** Değişiklik yaparken iki dosya arasında sapma (drift) riski
- **Evidence:** `layouts/_default/single.html` (130 satır) ve `layouts/post/single.html` (136 satır) aynı iskeleti paylaşıyor. Header görsel ifadesi (`{{ if .Params.image }}{{ partial "webp-image.html" ... }}`) ikisinde birebir tekrarlanıyor. Farklar küçük: biri inline `style`, diğeri `<style>` bloğu; tag listesi; tarih formatı (`:date_long` / `:date_full`); breadcrumb partial'ı ile inline container.
- **Why it's inefficient:** İki dilli yapı ve i18n eklenirken iki dosya ayrı ayrı yamalandı. Bir sonraki değişiklikte biri unutulursa sayfalar tutarsızlaşır.
- **Recommended fix:** Header bloğunu `layouts/partials/page-header.html` olarak çıkar, farkları parametre ile ver (`dict "page" . "showTags" true "dateFormat" ":date_full"`). Ya da `post/single.html` dosyasını `_default/single.html` üzerine ince bir katman yap.
- **Tradeoffs / Risks:** Saf refactor. Davranış değişmemeli, çıktı HTML'ini önce/sonra diff'le.
- **Expected impact estimate:** ~100 satır tekrar gider. Performans etkisi yok.
- **Removal Safety:** Needs Verification (çıktı diff'i)
- **Reuse Scope:** module (layouts)

### B7. Temanın vendored `static/` klasöründen 27 kullanılmayan dosya (~1.96 MB) yayına giriyor
- **Category:** Build / Cost / Dead Code
- **Severity:** Low
- **Impact:** Deploy artifact boyutu (ziyaretçi bunları indirmiyor)
- **Evidence:** Çıktıdaki `css/`, `js/`, `webfonts/` dosyaları üretilen HTML/CSS/JS içinde dosya adıyla arandı. Hiç referans almayanlar: `css/fonts/fontawesome-webfont.*` + `FontAwesome.otf` (FA v4, ~903 KB), `js/jquery.js` (247 KB, minify'sız kopya), `css/bootstrap.css` (145 KB), `js/bootstrap.js` (67 KB), `js/iDisqus.js` / `iDisqus.min.js` / `css/iDisqus.min.css` (~225 KB, sadece `disqus_proxy` doluysa), `js/kityminder.core.min.js` + `js/kity.min.js` (~223 KB, mindmap shortcode), `js/eac.min.json` (78 KB), `css/hugo-theme-cleanwhite.css`, `js/production.min.js`, `js/jquerymigrate.js`, `js/load-photoswipe.js`, `js/reward.js`, `js/fitvids.js`, `css/hugo-easy-gallery.css`, `css/mindmap.css`, `js/mindmap*.js`, `css/zanshang.css`, `js/hux-blog.js`.
- **Why it's inefficient:** Hugo bunları her build'de kopyalıyor. Bazıları (mindmap, gallery, iDisqus) bir shortcode ya da özellik açılırsa gerekebilir. Minify'sız kopyalar hiçbir durumda yüklenmiyor.
- **Recommended fix:** Önce kesin ölü olanları kaldır: minify'sız ikizler (`jquery.js`, `bootstrap.js`, `bootstrap.css`, `hugo-theme-cleanwhite.css`, `zanshang.css`, `hux-blog.js`), FA v4 font klasörü, `production.min.js`, `jquerymigrate.js`, `fitvids.js`, `reward.js`, `.map` dosyaları. Disqus/mindmap/gallery dosyalarını o özellikleri hiç kullanmayacağına karar verirsen kaldır. Tema vendored olduğu için silmek gitlink riskini geri getirmez. **Silme için açık "evet" gerekir.**
- **Tradeoffs / Risks:** Upstream ile farkı büyütür (zaten yamalı). Bir şablon dosya adını dinamik kuruyorsa grep yakalamayabilir. Silmeden sonra tam build al ve tarayıcı ağ sekmesinde 404 kontrol et.
- **Expected impact estimate:** Artifact ~2 MB küçülür (B2 ile birlikte ~11 MB → ~4.3 MB).
- **Removal Safety:** Likely Safe (minify'sız ikizler ve FA v4: Safe; Disqus/mindmap/gallery: Needs Verification)
- **Reuse Scope:** theme

### B8. `webp-image` partial'ı build başına 70 kez çalışıyor, sonucu hep aynı
- **Category:** Build / Caching
- **Severity:** Low
- **Impact:** Build süresi (şu an önemsiz)
- **Evidence:** `--templateMetricsHints` çıktısı: `_partials/webp-image.html` 70 çağrı, **cache potential %97**. `head.html` (og:image için) ve iki `single.html` her sayfada `.Site.Params.header_image` için aynı dönüşümü çağırıyor. `head.html` için cache potential %43.
- **Why it's inefficient:** Hugo görsel dönüşümünü önbelleğe alıyor ama `resources.Get` + `.Process` zincirinin sorgusu yine her çağrıda tekrarlanıyor.
- **Recommended fix:** Site geneli varsayılan için `partialCached "webp-image.html" .Site.Params.header_image .Site.Params.header_image` kullan. Sayfaya özel `.Params.image` için `partial` kalsın.
- **Tradeoffs / Risks:** Yok denecek kadar az. Cache anahtarı görsel yolu olduğu için doğru kalır.
- **Expected impact estimate:** Toplam ~52 ms kümülatif partial süresinden çoğu gider. Wall-clock'ta ~10-20 ms. İçerik arttıkça doğrusal kazanç.
- **Removal Safety:** Safe
- **Reuse Scope:** module (layouts)

### B9. Sidebar "son yazılar": iç içe `where` + `.Site.Pages`
- **Category:** Algorithm / Readability
- **Severity:** Low
- **Impact:** Okunabilirlik. Sidebar'ın 22 render'ında küçük bir tarama maliyeti.
- **Evidence:** `layouts/partials/sidebar.html:274`: `where (where .Site.Pages "Type" "post") "IsPage" true`. Her sidebar render'ında tüm sayfalar (taksonomi ve liste sayfaları dahil) iki kez filtreleniyor.
- **Why it's inefficient:** `.Site.RegularPages` zaten sadece normal sayfaları içeriyor, dıştaki filtreye gerek yok.
- **Recommended fix:** `{{ range first (.Site.Params.last_posts_count | default 5 | int) (where .Site.RegularPages "Type" "post") }}` (Hugo 0.165'te `where` için `.Site.RegularPages "Section" "post"` de olur).
- **Tradeoffs / Risks:** Sıralama aynı kalır (varsayılan weight/date/title).
- **Expected impact estimate:** İhmal edilebilir hız, daha net kod.
- **Removal Safety:** Safe
- **Reuse Scope:** local file

### B10. `hugo.toml` içinde kapalı özelliklere ait "hayalet" ayarlar
- **Category:** Maintainability / Dead Code
- **Severity:** Low
- **Impact:** Config okunabilirliği, şablonlarda ölü dallar
- **Evidence:** Boş ya da `false` değerli ve hiçbir zaman açılmayacak görünen anahtarlar: `[services.disqus] shortname=""`, `[services.googleAnalytics] id=""`, `page_view_counter`/`leancloud_*`, `ba_track_id`, `disqus_proxy`/`disqus_site`, `twikoo_env_id`, `artalk_*`, `reward`, `friends`, `bookmarks`, yorum satırına alınmış `custom_css`/`custom_js` ve 15 satır yorumlu sosyal hesap şablonu.
- **Why it's inefficient:** Config'i okuyan kişi (ya da ajan) bunların aktif olduğunu sanabilir. Şablonlarda karşılık gelen dallar her render'da değerlendiriliyor (maliyeti önemsiz).
- **Recommended fix:** Tema varsayılanları zaten boş/false olanları sil. Şablon `if` kontrolleri olmayan anahtarda da `false`'a düşer. Kaldırmadan önce `grep -r '.Site.Params.<anahtar>' themes/*/layouts layouts` ile her birinin `default`'suz zorunlu kullanımı olmadığını doğrula.
- **Tradeoffs / Risks:** İleride Disqus vb. açmak istersen anahtarları tema README'sinden geri eklemen gerekir.
- **Expected impact estimate:** ~40 satır daha kısa config.
- **Removal Safety:** Likely Safe
- **Reuse Scope:** config

### B11. Küçük görsel israfları: `favicon.ico` 72 KB, `profil-buyuk.png` aslında JPEG q100
- **Category:** Frontend
- **Severity:** Low
- **Impact:** İlk ziyaret ağırlığı
- **Evidence:** `static/img/favicon.ico` 72,398 byte, tek ikon 132x132, 32 bpp. Her ilk ziyarette iniyor. `static/img/profil-buyuk.png`, `.png` uzantılı ama `file` çıktısına göre JPEG, `quality = 100`, 250x250. Sidebar'da WebP'ye dönüştürülüyor (5.4 KB), ama sidebar dışında doğrudan `/img/profil-buyuk.png` olarak da veriliyor (ana sayfa HTML'inde `src=/img/profil-buyuk.png`).
- **Recommended fix:** 16+32+48 px'lik çok boyutlu bir `.ico` (~5-15 KB) ve 180 px `apple-touch-icon` PNG üret. Profil görselinin uzantısını gerçek formatla eşleştir (`.jpg`) ve q85'e indir, ya da sidebar'daki gibi `webp-image` partial'ından geçir.
- **Expected impact estimate:** ~60 KB favicon tasarrufu. Profil için ~40 KB.
- **Removal Safety:** Safe (dosya adı değişirse `hugo.toml` ve iki `hakkimda` içeriği güncellenmeli)
- **Reuse Scope:** local file

### B12. Dokümantasyon sapması: CLAUDE.md olmayan bir script'ten bahsediyor
- **Category:** Maintainability / Dead Code
- **Severity:** Low
- **Impact:** Ajan/insan zaman kaybı
- **Evidence:** CLAUDE.md, `build_algolia_index.sh` dosyasının `npm run algolia` çağırdığını anlatıyor. **Bu dosya repoda yok.** Buna karşın temada `layouts/_default/list.algolia.json` ve Algolia partial'ları duruyor, `algolia_search = false` ve arama Pagefind ile yapılıyor. Ek olarak `content/post/siber-guvenlik/` boş bir klasör (git izlemiyor, eski konumlandırmadan kalma).
- **Recommended fix:** CLAUDE.md'deki Algolia maddesini "Algolia kaldırıldı, arama Pagefind" olarak güncelle. Algolia JSON çıktı formatı hiçbir `outputs` tanımında yoksa `list.algolia.json` ölü kod, ama yamalı dosyalar listesinde geçtiği için silmeden önce teyit et. Boş klasörü kaldır (açık "evet" ile).
- **Removal Safety:** Safe (doküman), Needs Verification (`list.algolia.json`)
- **Reuse Scope:** repo docs

### B13. CI her çalışmada Hugo `.deb` ve Pagefind binary'sini sıfırdan indiriyor
- **Category:** Build / Network
- **Severity:** Low
- **Impact:** Deploy süresi (birkaç saniye)
- **Evidence:** `wget` ile Hugo extended `.deb` (~20 MB) ve `npx --yes pagefind@1.5.2` (platform binary'si) her run'da indiriliyor. `resources/_gen` gitignore'da, yani 3 görsel dönüşümü her CI build'inde yeniden yapılıyor.
- **Recommended fix:** İsteğe bağlı: `actions/cache` (SHA ile pinli) ile `~/.npm` ve `resources/_gen`'i önbelleğe al. Hugo `.deb` zaten SHA256 ile doğrulanıyor. Önbelleğe almak tedarik zinciri doğrulamasını atlamamalı, doğrulama adımı yine çalışmalı.
- **Tradeoffs / Risks:** Ek bir action pinlenip bakımı yapılmalı. Bu boyuttaki site için kazanç küçük. **Düşük öncelik, yapmasan da olur.**
- **Expected impact estimate:** Run başına ~5-15 sn.
- **Removal Safety:** Safe
- **Reuse Scope:** CI

---

## 3) Quick Wins (Do First)

| # | İş | Süre | Kazanç |
|---|---|---|---|
| 1 | B1: `business_foto1.jpg`'yi 480 px'e küçült ve EXIF'i sil (aynı dosya adı) | 5 dk | `/kart/` 1.76 MB → ~70 KB |
| 2 | B5: workflow'dan `fetch-depth: 0` satırını sil | 1 dk | CI checkout ~43 MB → ~8 MB |
| 3 | B3.1: `lazysizes` satırını kaldır, `zanshang.min.css` satırını `reward` koşuluna bağla | 5 dk | Her sayfada 2 istek ve ~4.5 KB gzip daha az |
| 4 | B2: 9 referanssız görseli kaldır (açık onayla) | 5 dk | Deploy −4.7 MB, `manzara1.JPG` EXIF'i yayından kalkar |
| 5 | B8: header görseli için `partialCached` | 5 dk | Build'de küçük kazanç, iyi alışkanlık |
| 6 | B12: CLAUDE.md'deki Algolia maddesini düzelt | 2 dk | Doğru bağlam |

## 4) Deeper Optimizations (Do Next)

1. **B3.2 Script yüklemesini footer'a taşı / `defer` et.** En büyük gerçek FCP kazancı. Mobilde navbar ve içindekiler (catalog) testi gerektirir.
2. **B4 Font Awesome → inline SVG sprite.** ~45 KB gzip ve 2 font isteği gider.
3. **B6 single şablonlarını birleştir.** Bundan sonraki her layout değişikliğini ucuzlatır.
4. **B7 tema static temizliği.** Önce kesin ölüler, sonra özellik bazlı.
5. **Git geçmişinden ~40 MB görseli temizlemek** (`git filter-repo --strip-blobs-bigger-than 1M` ya da yol bazlı). Sadece B5'ten sonra hâlâ önemliyse düşün: force-push gerektirir, mevcut klonları bozar, 2026-10-09'daki geçmiş yeniden yazımı ve bekleyen GitHub destek talebiyle (#4840656) çakışabilir. **Talep kapanmadan yapma.** Yerel olarak `.git/objects/pack/` içinde 3 yarım kalmış `tmp_pack_*` (5.2 MB) var. `git gc --prune=now` bunları temizler (sadece yerel, onayla).
6. **Bootstrap 3 + jQuery bağımlılığını küçültmek.** Kullanılan Bootstrap bileşenleri az (grid, navbar collapse). Uzun vadede tema CSS'ini PurgeCSS benzeri bir adımla budamak ~18 KB gzip'i ~5 KB'a indirebilir. Elle yamalı tema yüzünden maliyeti yüksek, ROI'si orta.

## 5) Validation Plan

**Ölçüm (önce/sonra):**
- `hugo --gc --minify --cleanDestinationDir` uyarısız bitmeli (CLAUDE.md şartı). Çıktıyı karşılaştır: `du -sb public; find public -type f | wc -l`. Referans: **11 MB, 160 dosya, 286 ms**.
- Sayfa ağırlığı: `hugo server` + Chrome DevTools Network (cache kapalı, "Fast 3G") ile `/`, `/tr/`, `/post/flx-case-study/`, `/kart/`. Toplam transfer, istek sayısı, FCP/LCP değerlerini not al.
- Lighthouse mobil (CLI: `npx lighthouse http://localhost:1313/kart/ --preset=perf --form-factor=mobile`). Hedefler: `/kart/` LCP < 1.5 sn, ana sayfada "Eliminate render-blocking resources" uyarısında azalma.
- Build şablon maliyeti: `hugo --templateMetrics --templateMetricsHints` → `webp-image.html` çağrı sayısı 70'ten ~6'ya inmeli (B8).
- CI: Actions logunda "Checkout" adımının süresi ve indirilen boyutu (B5).

**Doğruluk testleri:**
- `/kart/`: avatar kırpımı/konumu görsel olarak aynı, vCard indirme (`kart.js`) çalışıyor, tarayıcı konsolunda CSP ihlali yok.
- Her iki dilde: dil değiştirici çeviriye gidiyor, mobil navbar açılıp kapanıyor, yazı sayfalarında içindekiler (side catalog) oluşuyor, tag cloud renkleniyor (jQuery bağımlılıkları).
- İkon değişikliği (B4) sonrası footer/sidebar sosyal ikonlarının ekran görüntüsünü önce/sonra karşılaştır.
- Şablon refactoru (B6) sonrası: `diff -r public.before public.after` sadece beklenen farkları göstermeli.
- Silmelerden sonra (B2, B7): `grep -rhoE '(src|href)=[^ >]+' public | sort -u` ile linklenen tüm yerel yolların `public/` altında var olduğunu kontrol et (404 yok).
- Pagefind: CI'daki `npx pagefind --site public` sonrası arama EN ve TR'de sonuç döndürüyor.

## 6) Optimized Code / Patch (öneri, uygulanmadı)

**B1: kart avatarı (dosya adı aynı, `kart.css` değişmez)**
```bash
# Orijinali repo dışına yedekle, sonra yerinde küçült + EXIF sil
cp static/kart/business_foto1.jpg ~/Pictures/business_foto1.orig.jpg
convert static/kart/business_foto1.jpg -auto-orient -resize 540x -strip \
        -interlace Plane -quality 80 static/kart/business_foto1.jpg
exiftool -all= -overwrite_original static/kart/business_foto1.jpg   # ikinci kontrol
```
`-resize 540x` en/boy oranını korur (~540x486), böylece `background-position`/`background-size` aynı davranır.

**B5: `.github/workflows/hugo.yaml`**
```diff
       - name: Checkout
         uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
-        with:
-          fetch-depth: 0
-          # NOT: hugo-theme-cleanwhite ... submodules: true gerekmiyor.
+        # Varsayılan sığ klon (fetch-depth: 1) yeterli: enableGitInfo kullanılmıyor.
+        # Tema vendored, submodules: true gerekmiyor.
```

**B3.1: `themes/hugo-theme-cleanwhite/layouts/partials/head.html`**
```diff
-    <!-- zangshang CSS -->
-    <link rel="stylesheet" href="{{ "css/zanshang.min.css" | relURL }}">
+    {{ if .Site.Params.reward }}
+    <link rel="stylesheet" href="{{ "css/zanshang.min.css" | relURL }}">
+    {{ end }}
 ...
-    <!-- lazy load image JavaScript -->
-    <script src="{{ "js/lazysizes.min.js" | relURL }}"></script>
+    {{/* lazysizes sadece post-image shortcode'u için gerekli; içerikte kullanılmıyor.
+         Görseller render-image hook'unda native loading="lazy" ile geliyor. */}}
```

**B8: `head.html` ve iki `single.html`**
```diff
-    {{ $ogImage := partial "webp-image.html" .Site.Params.header_image }}
+    {{ $ogImage := partialCached "webp-image.html" .Site.Params.header_image .Site.Params.header_image }}
```
```diff
-{{ else }}{{ partial "webp-image.html" .Site.Params.header_image | safeURL }}{{ end }}
+{{ else }}{{ partialCached "webp-image.html" .Site.Params.header_image .Site.Params.header_image | safeURL }}{{ end }}
```

**B9: `layouts/partials/sidebar.html:274`**
```diff
-        {{ range ((where (where .Site.Pages "Type" "post") "IsPage" true).Limit (.Site.Params.last_posts_count | default 5 | int)) }}
+        {{ range first (.Site.Params.last_posts_count | default 5 | int) (where .Site.RegularPages "Type" "post") }}
```

**B2: silinecek dosyalar (sadece açık "evet" ile)**
```bash
git rm static/img/{manzara1.JPG,post.png,home-bg-jeep.jpg,contact-bg.jpg,post-bg-coffee.jpeg,post-bg-unix-linux.jpg,tag-bg.jpg,disqus.png,search.png}
```

---

## Önceki denetimin (2025-08-21) durumu

| Eski bulgu | Durum |
|---|---|
| 1. `public/` içinde 199 MB artık dosya | **Çözüldü** (`--cleanDestinationDir`, CI build) |
| 2. 2.4 MB header görseli | **Çözüldü** (114 KB kaynak + 47 KB WebP, `webp-image` partial) |
| 3. `static/img/` içinde ~33 MB ölü dosya | **Kısmen**: büyük kısmı gitti, 9 dosya (~4.7 MB) kaldı → B2 |
| 4. Post içi görseller işlenmemiş | **Çözüldü** (`render-image.html` → WebP + `loading="lazy"`) |
| 5. Sidebar çift `where` | **Açık** → B9 |
| 6. single şablonları kopya | **Açık** → B6 |
| 7. `deploy.sh` minify/clean yok | **Geçersiz** (GitHub Actions'a geçildi) |
| 8. Tema vendor CSS/JS ikizleri | **Açık** → B7 |
| 9. FastClick üçüncü parti script | **Çözüldü** (footer'dan kaldırıldı) |
| 10. `hugo.toml` hayalet ayarlar | **Açık** → B10 |
| 11. `languageCode` deprecated | **Çözüldü** (`locale` kullanılıyor, build uyarısız) |
