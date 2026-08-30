# OPTIMIZATIONS.md

> Kapsam: statik Hugo sitesi (`hugo-theme-cleanwhite` teması). Denetim, gerçek `hugo --minify` build çalıştırılarak ve üretilen `public/` çıktısı incelenerek yapıldı — aşağıdaki bulguların büyük kısmı ölçülmüş/doğrulanmış olgulardır, tahmin değildir. Hiçbir kaynak dosya değiştirilmedi.

---

## 1) Optimization Summary

Site küçük (4 içerik sayfası, 31 üretilmiş sayfa, `hugo` build süresi ~630ms) olduğu için **çalışma zamanı performansı şu an kritik değil**. Asıl risk, birikmiş **ölü ağırlık (dead weight)**: kullanılmayan görseller, artık `public/` build çıktısı ve optimize edilmemiş sayfa-genel header görseli. Bunlar hem sayfa yükleme hızını (LCP) hem de repo/deploy boyutunu doğrudan etkiliyor ve içerik sayısı arttıkça sorun katlanarak büyüyecek.

**En yüksek etkili 3 iyileştirme:**
1. `public/` klasöründe **199 MB** kullanılmayan/artık dosya birikmiş (`.eps` vektör kaynakları, yarım kalmış `.fdmdownload` indirmeleri, yinelenen zip'ler) — `deploy.sh` hiçbir zaman `--cleanDestinationDir` kullanmadığı için her build eskiyi silmeden üstüne yazıyor.
2. Site genelinde her sayfada (`header_image`) **2.4 MB'lık işlenmemiş JPEG** CSS arka planı olarak render ediliyor; ne Hugo image processing (`Resize`/`Fill`) ne de lazy-load var — bu doğrudan LCP'yi kötüleştiriyor.
3. `static/img/` içinde referans verilmeyen **~33 MB** görsel/artefakt (`manzara2.JPG`, `home-kedi.JPG`, `head_image2-7`, bir `.zip`, stok-görsel lisans metinleri) her build'de `public/`e kopyalanıyor.

**Hiçbir şey değişmezse en büyük risk:** `public/` deploy reposu (ayrı bir git checkout, `origin/main`) sınırsız büyümeye devam eder; bir noktada bu "artık" ikili dosyalar (bazıları stok-görsel `.eps` kaynakları — lisans şartlarına tabi olabilir) yanlışlıkla commit'lenip canlıya push'lanabilir, çünkü `public/.gitignore` içindeki tek satırlık `public/` kuralı bunları rastgele/yan etki olarak ignore ediyor — kalıcı bir koruma değil.

---

## 2) Findings (Prioritized)

### Bulgu 1 — `public/` build çıktısında 199 MB artık/ölü dosya
- **Category:** Build / Cost / Reliability
- **Severity:** Critical
- **Impact:** Disk kullanımı, deploy repo boyutu, gelecekteki `git add`/push riski
- **Evidence:** `du -sh public/img` → 199M. İçinde `static/img/`'de karşılığı olmayan şu dosyalar var: `rm218batch7-aum-27.eps` (35M), `700.eps` (19M), `head_image2.zip` + `head_image2.zip.fdmdownload` (16M×2), `abstract-vector-violet-mesh-background...zip(.fdmdownload)` (11M×2), `header_image2.zip(.fdmdownload)` (5.8M×2), ve `head_image2.jpg`/`head.image2.jpg`/`head.image2.png` gibi yazım varyasyonlu yinelenen dosyalar. `.fdmdownload` uzantısı "Free Download Manager"ın **yarım kalmış indirme** dosyalarına ait. `content/`, `layouts/` veya `hugo.toml` içinde bu dosyalardan hiçbirine referans yok.
- **Why it's inefficient:** `deploy.sh` sadece `hugo` çalıştırıyor (`--cleanDestinationDir` yok). Hugo, `publishDir`'i temizlemeden üstüne yazar; bir zamanlar `static/img/`'e elle indirilip sonra kaynaktan silinen stok-görsel adayları (`.eps` orijinalleri dahil), build çıktısında sonsuza dek birikmeye devam ediyor.
- **Recommended fix:** `deploy.sh`'te `hugo --minify --cleanDestinationDir` kullan (bkz. Bölüm 6); mevcut `public/` klasörünü bir kere temiz build ile yeniden üret.
- **Tradeoffs / Risks:** `--cleanDestinationDir`, `publishDir`'de olup kaynağı olmayan her şeyi siler — eğer `public/` içine elle/manuel eklenen (Hugo dışı) bir dosya varsa o da silinir. Bu depoda böyle bir şey tespit edilmedi.
- **Expected impact estimate:** Build çıktısı ~206M → tahmini ~7M (gerçek `static/` + üretilmiş HTML).
- **Removal Safety:** Safe (dosyalar hiçbir yerde referans edilmiyor, `git ls-files` ile de doğrulandı: `public/` reposunda bu dosyalar **hiç commit edilmemiş**, sadece yerel diskte duruyor).
- **Reuse Scope:** service-wide (deploy pipeline).

### Bulgu 2 — Site-genel header görseli optimize edilmemiş, lazy-load'suz, her sayfada
- **Category:** Frontend / Network
- **Severity:** High
- **Impact:** LCP (Largest Contentful Paint), toplam sayfa ağırlığı, mobil veri kullanımı
- **Evidence:** `hugo.toml:29` → `header_image = "img/head_image1.jpg"` (2.4 MB, orijinal boyutunda JPEG). Bu değer, `layouts/_default/single.html:2` ve `layouts/post/single.html:4`'te doğrudan inline `style="background-image: url(...)"` olarak basılıyor. Repo genelinde `Resize`, `Fill`, `imageConfig`, `resources.Get` gibi Hugo image-processing çağrısı **hiç yok** (grep ile doğrulandı).
- **Why it's inefficient:** CSS arka plan görseli tarayıcı tarafından render-blocking'e yakın şekilde, ilk boyamada indirilir; `lazysizes.min.js` sitede yüklü olmasına rağmen (`head.html:95`) bu sadece `<img data-src>` desenine hizmet eder, CSS background'lar için işlemez — yani lazy-loading altyapısı var ama bu en büyük görsel ondan faydalanamıyor.
- **Recommended fix:** Görseli `assets/` altına taşı, Hugo Pipes ile `.Resize "1600x webp q80"` üret, `<img loading="lazy">` ya da responsive `srcset` ile sun; ya da en azından JPEG'i sıkıştırıp (~150-300KB'a) mevcut `static/`de tut.
- **Tradeoffs / Risks:** `static/` → `assets/` taşıması, ilgili 2 şablon dosyasının (`layouts/_default/single.html`, `layouts/post/single.html`) güncellenmesini gerektirir; görsel kalitesinde gözle görülür fark olmaması için `q80` civarı test edilmeli.
- **Expected impact estimate:** İlk sayfa ağırlığında ~2 MB azalma (~90%+ küçülme bu görsel için), LCP'de gözle görülür iyileşme (bağlantı hızına göre yüzlerce ms - birkaç saniye).
- **Removal Safety:** Needs Verification (görsel kalitesi görsel olarak kontrol edilmeli).
- **Reuse Scope:** site-wide (her sayfada kullanılıyor).

### Bulgu 3 — `static/img/`'de ~33 MB referanssız (dead) görsel/dosya
- **Category:** Cost / Build / Frontend
- **Severity:** High
- **Impact:** Her `hugo` build'inde `public/`e kopyalanan gereksiz ağırlık; deploy edilirse CDN/hosting depolama ve bant genişliği maliyeti
- **Evidence:** `content/`, `layouts/`, `hugo.toml` genelinde grep ile hiçbir yerde referans edilmediği doğrulanan dosyalar: `manzara2.JPG` (5.1M), `manzara3.JPG` (3.2M), `home-kedi.JPG` (4.5M), `head_image2.png`…`head_image7.jpg` (toplam ~16M, sadece `head_image1.jpg` kullanılıyor), `low-poly-abstract-design.zip` (2.9M — bir ZIP dosyası, static asset olarak anlamsız), `License premium.txt` / `License free.txt` (stok görsel lisans metinleri — bir web sitesinde yayınlanacak dosyalar değil), `fullscreenshot.png`, `sitesearch.png`, `tn.png`.
- **Why it's inefficient:** Hugo `static/` altındaki her şeyi referans edilip edilmediğine bakmaksızın `public/`e kopyalar; bu dosyalar hiçbir sayfadan linklenmiyor ama yine de her build'de taşınıyor ve (deploy edilirse) sunucuda yer kaplıyor / herkese açık URL'lerden erişilebilir kalıyor.
- **Recommended fix:** Kullanılmayan dosyaları `static/img/`'den kaldır (veya ileride kullanılacaksa `content/`'e post-bundle resource olarak taşı). `.zip` ve `.txt` dosyalarını hiç `static/`e koyma.
- **Tradeoffs / Risks:** `head_image2-7` gelecekte header görseli değiştirmek için "aday" olarak elde tutuluyor olabilir — silmeden önce kullanıcıyla teyit edilmeli.
- **Expected impact estimate:** Build çıktısında ~33 MB azalma.
- **Removal Safety:** Likely Safe (License/zip dosyaları için Safe; head_image2-7 ve manzara2-3/home-kedi için Needs Verification — kullanıcı niyeti bilinmiyor).
- **Reuse Scope:** local file (static/img klasörü).

### Bulgu 4 — Post içi görseller de işlenmemiş/orijinal çözünürlükte
- **Category:** Frontend
- **Severity:** Medium
- **Impact:** Sayfa ağırlığı, mobil LCP
- **Evidence:** `content/post/test-yazisi.md:6` → `image: "img/manzara1.JPG"` (3.3 MB, muhtemelen doğrudan telefon/kamera çıktısı — büyük harfli `.JPG` uzantısı buna işaret ediyor). Tema genelinde image-processing pipeline yok (bkz. Bulgu 2).
- **Why it's inefficient:** Her yeni yazı görseli, sıkıştırma/yeniden boyutlandırma olmadan doğrudan yayınlanıyor.
- **Recommended fix:** Yazı görsellerini yayınlamadan önce elle sıkıştır (ör. `cwebp`/`squoosh`) veya Bulgu 2'deki Hugo Pipes çözümünü post-image front-matter alanına da uygula.
- **Tradeoffs / Risks:** Yok, kalite kontrolü dışında.
- **Expected impact estimate:** Yazı başına ~2-3 MB azalma.
- **Removal Safety:** Safe (dosya kalıyor, sadece yeniden kodlanıyor).
- **Reuse Scope:** module (içerik iş akışı — yeni her post için tekrarlayacak).

### Bulgu 5 — Sidebar'da her sayfada çalışan çift `where` taraması
- **Category:** Algorithm / Build
- **Severity:** Medium (şu an düşük etkili, ölçeklenmiyor)
- **Impact:** Build süresi (sayfa sayısı arttıkça)
- **Evidence:** `layouts/partials/sidebar.html` (site-level override), "LAST POSTS" bloğu:
  ```
  {{ range ((where (where .Site.Pages "Type" "post") "IsPage" true).Limit (.Site.Params.last_posts_count | default 5 | int)) }}
  ```
  `sidebar.html` **her sayfada** render ediliyor (ana sayfa, her post, her taxonomy sayfası) ve her render'da `.Site.Pages` (sitedeki *tüm* sayfalar: post, hakkimda, taxonomy vs.) üzerinde iki ayrı `where` filtresi çalıştırıyor.
- **Why it's inefficient:** `.Site.Pages` ham/filtrelenmemiş koleksiyondur; doğru araç zaten sadece "gerçek içerik sayfaları"na indirgenmiş `.Site.RegularPages`'dir. İki zincirlenmiş `where` çağrısı yerine tek geçişte filtrelenebilir bir işlem, sayfa sayısı büyüdükçe (N sayfa × sidebar'ın render edildiği N sayfa) O(N²) davranışına yol açar — Hugo topluluğunda bilinen bir şablon anti-pattern'i.
- **Recommended fix:** `{{ range ((where .Site.RegularPages "Section" "post").Limit ...) }}` (bkz. Bölüm 6).
- **Tradeoffs / Risks:** `.Site.RegularPages`, taslak/gelecek tarihli sayfaları zaten `hugo.toml`/build bayraklarına göre otomatik dışlar — mevcut `IsPage true` filtresiyle davranışsal fark yaratmaz, sadece daha idiomatik ve tek geçişlidir.
- **Expected impact estimate:** 4 içerikte ölçülemeyecek kadar küçük; 500+ sayfalık bir sitede build süresine gözle görülür katkı olur.
- **Removal Safety:** Safe.
- **Reuse Scope:** site-wide (sidebar her sayfada).

### Bulgu 6 — `_default/single.html` ve `post/single.html` neredeyse birebir kopya + breadcrumb'ın iki farklı yerde tanımlı olması
- **Category:** Maintainability / Reuse
- **Severity:** Medium
- **Impact:** Bakım maliyeti, "drift" riski (iki kopyanın birbirinden habersiz sapması)
- **Evidence:** `diff layouts/_default/single.html layouts/post/single.html` → header/arka-plan-görseli/post-heading bloğu satır satır aynı mantığı taşıyor. `_default/single.html` ayrıca `{{ partial "breadcrumb.html" . }}` çağırıyor, ama `post/single.html` aynı breadcrumb HTML'ini (nav/ol/li yapısı, inline stiller dahil) **elle kopyalayıp tekrar yazmış**, partial'ı hiç kullanmıyor.
- **Why it's inefficient:** `partials/breadcrumb.html` artık iki gerçek kaynağa sahip: partial dosyasının kendisi ve `post/single.html` içine gömülü kopyası. Biri güncellenip diğeri unutulursa (ki bu tam olarak şu an olmuş durumda — inline stiller sadece post/single.html'de var) görsel tutarsızlık ortaya çıkar.
- **Recommended fix:** `post/single.html`'deki inline breadcrumb bloğunu `{{ partial "breadcrumb.html" . }}` çağrısıyla değiştir; iki dosya arasındaki ortak header/post-heading bloğunu da `partials/post-header.html` gibi paylaşılan bir partial'a çıkar.
- **Tradeoffs / Risks:** Yeni partial'ın her iki bağlamda da (taxonomy dışı `_default` sayfalar ve `post` bölümü) aynı parametrelerle çalıştığından emin olunmalı.
- **Expected impact estimate:** Kod tekrarında ~%60 azalma (iki dosya, ortak ~90 satır).
- **Removal Safety:** Needs Verification (görsel regresyon testi önerilir).
- **Reuse Scope:** module (layouts/).

### Bulgu 7 — `deploy.sh`'te minify ve destination-clean yok
- **Category:** Build / Cost
- **Severity:** Medium
- **Impact:** Yayınlanan HTML/CSS boyutu, Bulgu 1'in kök nedeni
- **Evidence:** `deploy.sh:6` → sadece `hugo`. `hugo.toml`'de `[minify]` bloğu yok.
- **Why it's inefficient:** Vendor dosyaları (`*.min.css`, `*.min.js`) zaten önceden minify edilmiş halde teslim ediliyor, ama Hugo'nun kendi ürettiği HTML sayfaları minify edilmiden yayınlanıyor; ayrıca temiz olmayan `publishDir` Bulgu 1'e yol açıyor.
- **Recommended fix:** `hugo --gc --minify --cleanDestinationDir` (bkz. Bölüm 6).
- **Tradeoffs / Risks:** Yok — standart, geri dönüşü kolay bir bayrak değişikliği.
- **Expected impact estimate:** Üretilen HTML/CSS'te ~%10-20 küçülme; artı Bulgu 1'in ~199 MB kazancı.
- **Removal Safety:** Safe.
- **Reuse Scope:** service-wide (deploy script).

### Bulgu 8 — Temada kullanılmayan yinelenen CSS/JS vendor dosyaları
- **Category:** Cost / Build
- **Severity:** Low-Medium
- **Impact:** Her build'de kopyalanan gereksiz ağırlık (~500KB+)
- **Evidence:** `themes/hugo-theme-cleanwhite/layouts/partials/head.html` yalnızca `.min.*` varyantlarını (`bootstrap.min.css`, `jquery.min.js`, `bootstrap.min.js`, `hugo-theme-cleanwhite.min.css`, ...) linkliyor. Ancak repo genelinde hiçbir şablondan referans edilmeyen şu dosyalar da statik olarak taşınıyor: `themes/.../static/css/bootstrap.css` (144K), `style.css` (60K), `hugo-theme-cleanwhite.css` (24K), `custom.css` (60K — ayrıca site-level `static/css/custom.css` tarafından zaten gölgeleniyor/override ediliyor), `themes/.../static/js/jquery.js` (244K).
- **Why it's inefficient:** Hugo `static/` dizinlerini (tema + site) referans kontrolü yapmadan birleştirip kopyalar; bu "non-min" kopyalar hiçbir `<link>`/`<script>` tarafından çağrılmıyor, salt build çıktısını şişiriyor.
- **Recommended fix:** Bu dosyaları tema fork'unda/vendored kopyada temizle (upstream tema PR'ı değil, yerel `themes/hugo-theme-cleanwhite` zaten elle patch'lenmiş durumda — bkz. AGENTS.md).
- **Tradeoffs / Risks:** Tema zaten upstream'den ayrışmış (bkz. AGENTS.md must-follow bulgusu); bu silme işlemi o ayrışmayı büyütür, ileride upstream ile diff almayı zorlaştırır.
- **Expected impact estimate:** ~530 KB / build.
- **Removal Safety:** Likely Safe (grep ile referanssız olduğu doğrulandı) ama tema-vendoring kararına bağlı, Needs Verification.
- **Reuse Scope:** module (tema statikleri).

### Bulgu 9 — Her sayfada koşulsuz, işlevsiz üçüncü parti script isteği (FastClick)
- **Category:** Network / Reliability
- **Severity:** Low
- **Impact:** Her sayfa yüklemesinde 1 ekstra harici CDN isteği (jsDelivr)
- **Evidence:** `themes/hugo-theme-cleanwhite/layouts/partials/footer.html:274-280` — hiçbir `{{ if }}` koşulu olmadan her sayfada `loadAsync("https://cdn.jsdelivr.net/npm/fastclick@1.0.6/...")` çalıştırılıyor.
- **Why it's inefficient:** FastClick, eski mobil tarayıcılardaki ~300ms dokunma gecikmesini kaldırmak için yazılmış 2013 dönemi bir kütüphane; modern tarayıcılar bu gecikmeyi yıllar önce native olarak kaldırdı. Kütüphane artık pratikte hiçbir şey yapmıyor ama yine de her ziyarette indiriliyor.
- **Recommended fix:** `footer.html`'den bu script bloğunu kaldır.
- **Tradeoffs / Risks:** Çok eski bir cihaz/tarayıcı hedefleniyorsa (olası değil) dokunma tepkisinde teorik gecikme.
- **Expected impact estimate:** Sayfa başına 1 harici istek + ~14KB azalır; ayrıca jsDelivr'e erişilemediği durumlarda (ör. bazı ağlarda engelli) sessiz hata riski ortadan kalkar.
- **Removal Safety:** Likely Safe.
- **Reuse Scope:** site-wide (footer her sayfada).

### Bulgu 10 — `hugo.toml`'de devre dışı özelliklere ait "hayalet" örnek veri
- **Category:** Maintainability / Dead Code
- **Severity:** Low
- **Impact:** Konfigürasyon netliği, yanlışlıkla canlıya sızma riski
- **Evidence:** `friends = false` iken `[[params.friend_link]]` hâlâ tema yazarının "Linda的博客" girdisini içeriyor; `bookmarks = false` iken `[[params.bookmark_link]]` "Martin Fowler / ServiceMesher / Pxhere / unsplash" örnek verilerini içeriyor.
- **Why it's inefficient:** Şu an render edilmiyor (doğru şekilde `if` ile korunuyor), ama biri ileride `bookmarks = true` yaparsa siteye ait olmayan linkler sessizce canlıya çıkar.
- **Recommended fix:** Kullanılmayacaksa bu blokları sil; kullanılacaksa gerçek verilerle değiştir.
- **Tradeoffs / Risks:** Yok.
- **Expected impact estimate:** Sadece config netliği, ölçülebilir performans etkisi yok.
- **Removal Safety:** Safe.
- **Reuse Scope:** local file (hugo.toml).

### Bulgu 11 — `languageCode` deprecated config anahtarı
- **Category:** Reliability / Build hygiene
- **Severity:** Low
- **Impact:** Şu an sadece build uyarısı; gelecekteki bir Hugo majör sürümünde kırılabilir
- **Evidence:** `hugo --minify` çalıştırıldığında: `WARN deprecated: project config key languageCode was deprecated in Hugo v0.158.0 ... Use locale instead.`
- **Why it's inefficient:** Aktif olarak yanlış davranmıyor, ama silinmesi planlanan bir anahtara bağımlılık var.
- **Recommended fix:** `languageCode = "tr-TR"` yerine `[languages.tr-TR]` bloğu altında `languageCode`/`locale` kullanımına geçiş (Hugo'nun güncel çoklu-dil config şemasına göre).
- **Tradeoffs / Risks:** Config şeması değişikliği; dikkatli test edilmeli.
- **Expected impact estimate:** Ölçülemez (hijyen).
- **Removal Safety:** Needs Verification.
- **Reuse Scope:** local file (hugo.toml).

---

## 3) Quick Wins (Do First)

Uygulama süresi düşük, etki yüksek — öncelik sırasıyla:

1. **`deploy.sh`'e `--minify --cleanDestinationDir` ekle** (Bulgu 1 + 7) — tek satır değişiklik, ~199 MB'lık artık dosyaları bir sonraki deploy'da otomatik temizler.
2. **`static/img/`'deki referanssız 33 MB'ı sil** (Bulgu 3) — özellikle `low-poly-abstract-design.zip` ve `License *.txt` dosyaları, bir web sitesinde bulunmaması gereken dosya türleri.
3. **`footer.html`'den koşulsuz FastClick yüklemesini kaldır** (Bulgu 9) — tek blok silme, sıfır risk.
4. **Sidebar'daki çift `where`'i `.Site.RegularPages`'e çevir** (Bulgu 5) — tek satır, davranış değişmiyor.
5. **`hugo.toml`'deki kullanılmayan `friend_link`/`bookmark_link` örnek verisini temizle** (Bulgu 10) — config hijyeni.

## 4) Deeper Optimizations (Do Next)

Daha fazla planlama/test gerektiren, yapısal değişiklikler:

- **Header ve post görselleri için Hugo image-processing pipeline'ına geçiş** (Bulgu 2 + 4): görselleri `static/`'ten `assets/`'e taşı, `resources.Get` + `.Resize`/`.Fill` ile WebP + responsive `srcset` üret, `_default/single.html` ve `post/single.html`'i buna göre güncelle. En yüksek kullanıcı-deneyimi etkisine sahip iyileştirme ama en fazla test gerektiren.
- **`_default/single.html` / `post/single.html` birleştirme + breadcrumb tekilleştirme** (Bulgu 6): ortak bir `partials/post-header.html` çıkar, görsel regresyon testiyle doğrula.
- **Tema vendor CSS/JS temizliği** (Bulgu 8): tema zaten upstream'den ayrışmış olduğundan (bkz. `AGENTS.md`), bu temizliği o ayrışmanın bir parçası olarak, upstream güncellemesi planlanmadan önce yap.
- **`languageCode` → `locale`/`[languages]` migrasyonu** (Bulgu 11): Hugo'nun güncel i18n şemasına geçiş, düşük öncelik ama borç birikmeden yapılmalı.

## 5) Validation Plan

- **Build çıktısı boyutu:** `du -sh public` — önce/sonra karşılaştır. Hedef: 206M → ~7-10M.
- **Build süresi:** `time hugo --minify --cleanDestinationDir` — regresyon olmadığını doğrula (zaten <1sn, büyük fark beklenmez, sadece artmadığını gör).
- **Sayfa ağırlığı / LCP:** Chrome DevTools → Network + Lighthouse, header görseli optimizasyonundan önce/sonra ana sayfa ve bir post sayfası için "Largest Contentful Paint" ve toplam transfer boyutu ölç.
- **Görsel regresyon:** Header optimizasyonu ve breadcrumb birleştirmesi sonrası, `hugo server` ile ana sayfa, bir post sayfası, `/hakkimda/`, bir taxonomy sayfası ve `/search/` sayfasını tarayıcıda gözle kontrol et (sidebar "SON YAZILAR" listesinin hâlâ doğru 5 postu gösterdiğini doğrula).
- **Dead-asset silme güvenliği:** Silmeden önce `grep -rn "<dosya-adı>" content layouts hugo.toml` ile sıfır sonuç aldığını doğrula (bu denetimde zaten yapıldı, ama gelecekte tekrarlanabilir bir kontrol).
- **Link/route testi:** `hugo --minify` sonrası `public/categories/` ve `public/tags/` altındaki üretilen path'lerin `hugo.toml`'deki menü linkleriyle eşleştiğini kontrol et (bu, AGENTS.md'de ayrıca belgelenen ayrı bir kategori-slug bug'ı ile ilgili, optimizasyon kapsamı dışı ama aynı build çıktısı üzerinden doğrulanabilir).

## 6) Optimized Code / Patch (öneri — uygulanmadı)

### `deploy.sh`
```diff
-hugo # if using a theme, replace with `hugo -t <YOURTHEME>`
+hugo --gc --minify --cleanDestinationDir
```
Ne değişti: `--minify` üretilen HTML/CSS/JS/SVG/JSON'ı küçültür; `--cleanDestinationDir` her build öncesi `public/`de kaynağı olmayan dosyaları siler (Bulgu 1'in kök nedenini ortadan kaldırır); `--gc` kullanılmayan (artık referans edilmeyen) resource cache girdilerini temizler.

### `layouts/partials/sidebar.html` — "LAST POSTS" bloğu
```diff
-{{ range ((where (where .Site.Pages "Type" "post") "IsPage" true).Limit (.Site.Params.last_posts_count | default 5 | int)) }}
+{{ range ((where .Site.RegularPages "Section" "post").Limit (.Site.Params.last_posts_count | default 5 | int)) }}
```
Ne değişti: iki zincirlenmiş `where` üzerinden ham `.Site.Pages` taraması yerine, zaten "gerçek içerik sayfası" olacak şekilde önceden filtrelenmiş `.Site.RegularPages` üzerinde tek bir `where` çağrısı. Aynı sonucu üretir, tek geçişte.

### `themes/hugo-theme-cleanwhite/layouts/partials/footer.html` — FastClick bloğu
```diff
-<!--fastClick.js -->
-<script>
-    loadAsync("https://cdn.jsdelivr.net/npm/fastclick@1.0.6/lib/fastclick.min.js", function(){
-        var $nav = document.querySelector("nav");
-        if($nav) FastClick.attach($nav);
-    })
-</script>
-
```
Ne değişti: modern tarayıcılarda işlevsiz hale gelmiş, koşulsuz üçüncü parti script çağrısı tamamen kaldırıldı.

### `static/img/` temizlik listesi (öneri, uygulanmadı)
```
rm "static/img/manzara2.JPG" "static/img/manzara3.JPG" "static/img/home-kedi.JPG" \
   "static/img/head_image2.png" "static/img/head_image3.png" "static/img/head_image4.jpg" \
   "static/img/head_image5.jpg" "static/img/head_image6.jpg" "static/img/head_image7.jpg" \
   "static/img/low-poly-abstract-design.zip" "static/img/License premium.txt" \
   "static/img/License free.txt" "static/img/fullscreenshot.png" "static/img/sitesearch.png" \
   "static/img/tn.png"
```
Çalıştırmadan önce: bu dosyaların ileride kullanılması planlanmıyorsa uygula (kullanıcı onayı gerekir — bu denetim hiçbir dosyayı silmedi).
