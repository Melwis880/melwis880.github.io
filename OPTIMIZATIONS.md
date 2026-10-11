# OPTIMIZATIONS.md

> Kapsam: `small-fixes` dalı (75dca59). 3. aşamadan sonraki durum: notlar bölümü, yazıya özel paylaşım kartları, archetype'lar, `tools/kart/` Tailwind kaynakları. Önceki denetim (2026-10-10, a105172) O1-O16'yı kapsıyordu; açık kalanlar burada yeniden ölçüldü, yeni bulgular O17'den başlıyor.
> Yöntem: `hugo --gc --minify --cleanDestinationDir --templateMetrics --templateMetricsHints` ile gerçek build; `public/` dosya listesi ve gzip boyutları; `main.css`'teki 125 sınıfın şablon/JS/içerik/çıktıda kullanımı; i18n anahtarları ve simge adlarının çağrıları; JS dosyaları satır satır okundu. Önerilen her şablon/config değişikliği `~/snap/hugo/common/opt-test/` altındaki atılabilir bir kopyada denendi ve çıktı `diff -rq` ile karşılaştırıldı (gerekince kopyaya geçici yazılar eklenip yine diff alındı). Süreler 7-9 çalıştırmanın medyanı. Rakamlar aksi yazılmadıkça ölçülmüştür.
> Tarih: 2026-10-11. **Hiçbir proje dosyası değiştirilmedi** (bu dosya dışında). Test kopyası `~/snap/hugo/common/opt-test/` hâlâ duruyor; silinmesi onay bekliyor.

> **Güncelleme 2026-10-11 (`search-kart-fixes` dalı):** O17 + O11 ve O20 uygulandı. O17'ye iki ek: arama hata verirse eski liste temizlenir, "Daha fazla" düğmesini sadece geçerli sorgu yeniden açar. Doğrulama: HTML çıktısında JS adı ve SRI dışında fark yok, sitemap'ler birebir aynı; `/kart/` kontrolü adresler aynıyken sessiz, e-posta ya da LinkedIn değişince iki dosya için `WARN`; yerel Pagefind indeksi + Chrome (parça dosyaları 0.8 sn geciktirildi) ile yarış testi yeni kodda 3/3 geçti, canlıdaki eski kodda hata tekrarlandı (9 satır, karışık ve tekrarlı sonuç, durum satırı "4"). Konsol hatası ve CSP ihlali yok. Açık kalanlar: O18, O19, O21, O22, O8, O7.
>
> **Ek (aynı gün, security-audit sonrası, 4 düzeltme):** (1) `/kart/` kontrolü fazlasını da yakalıyor: `params.social.email` dışındaki her e-posta, `params.social.linkedin` ile birebir aynı olmayan her `linkedin.com/in/...` adresi (handle `/ ? #` ya da tırnağa kadar alınır, `mericordu.x` kesilip geçemez) ve `tel;`/`tel:`/`wa.me`/`whatsapp` için `WARN`. Uyarıda sadece dosya adı geçer, bulunan adres yazılmaz (CI logları herkese açık). `\b`, JS dizesindeki `"\r\nTEL;"` satırını kaçırdığı için desene `\\[nr]` eklendi. (2) `email` ya da `linkedin` boşsa `errorf`, build durur. (3) `showMore()` parça hatasını yakalıyor; sorgu hâlâ geçerliyse "Daha fazla" düğmesi açık ve görünür kalır. (4) `fill()` değiştirmeyi fonksiyonla yapıyor, sorgudaki `$&` aynen görünür.
> Doğrulama: gerçek dosyalarla build uyarısız. Geçici kopyada (`~/snap/hugo/common/kart-test/`) negatif testlerin hepsi doğru sonucu verdi: ikinci e-posta, `TEL;` satırı, `"\r\nTEL:"`, `wa.me` linki, `mericordu-x`, `mericordu.x` için `WARN`; boş e-posta (`HUGO_PARAMS_SOCIAL_EMAIL=` ve hugo.toml) ve boş LinkedIn için `ERROR`, çıkış kodu 1. Arama: yerel Pagefind 1.5.2 indeksi, sistem Chrome + Playwright, parçalar sunucu tarafında 0.8 sn geciktirildi. Yeni kod 3/3 geçti: yarış (n8n sonra flx: 4 sonuç, 4 satır, `?q=flx`), parça hatası (yakalanmamış hata yok, düğme açık ve görünür), sonuçsuz `zzqx$&` araması (sayfada ve açılır panelde metin aynen), konsol hatası ve CSP ihlali yok. Aynı testler HEAD'deki kodla yarışta (4 sonuç, 9 satır), parça hatasında (`Failed to fetch` yakalanmadı, düğme gizlendi) ve `$&`'de (`zzqx%s` göründü) kaldı.
> Bilinen sınır: Pagefind 1.5.2 başarısız parçanın promise'ini önbellekte tutuyor (`loaded_fragments[hash]`), bu yüzden aynı sayfada "Daha fazla" ile yeniden deneme yine hata verir (sessizce, yakalanmamış hata olmadan); sayfa yenilenince düzelir. Açılır paneldeki `update()` hâlâ `r.data()` hatasını yakalamıyor (aynı tür sorun, bu işin kapsamı dışında bırakıldı).

---

## 1) Optimization Summary

Site hız açısından iyi durumda ve bir önceki denetimden beri kötüleşmedi. Bir yazı sayfasının ilk ziyareti toplam **~21 KB gzip**: HTML 5.6 KB, CSS 5.9 KB, JS 2.5 KB, tema-init 0.2 KB, avatar 1.9 KB, favicon 5.2 KB. Çıktı **80 dosya / 893,332 byte** (artışın neredeyse tamamı 4 paylaşım kartı JPG'si, ~55 KB/adet; bunları sadece link önizleme botları indirir). Build ılık önbellekle **~115 ms**, soğuk (CI'daki durum) **1.2 sn**, uyarı yok. `main.css`'te kullanılmayan sınıf yok (bilerek tutulan 3 sınıf hariç), bütün i18n anahtarları kullanılıyor.

Kalan sorunlar hız değil **doğruluk ve bakım** sorunları.

**En yüksek etkili 3 iyileştirme:**
1. **O17: `/search/` sayfasında yarış durumu.** Hızlı yazarken eski sorgunun sonuçları yeni sorgunun listesine ekleniyor ve yeni sorgunun ilk 10 sonucu atlanıyor. "Daha fazla" düğmesine çift tıklamak sonuçları iki kez basıyor. Bir sayaçla kapanıyor (O11'in titreme düzeltmesiyle aynı yamada).
2. **O20: İletişim bilgisi 3 dosyada 7 kez elle yazılı.** `hugo.toml`, `static/kart/index.html` (4 kez) ve `static/kart/kart.js` (2 kez). CLAUDE.md'nin en sıkı kuralı "sitede tek e-posta" ve bu kural bugün sadece dikkatle korunuyor. Build sırasında çalışan tek satırlık bir kontrol, adres değişince `/kart/`'ın geride kalmasını uyarıya çevirir.
3. **O18 + O19: 3. aşamadan kalan tekrar ve eski bağlam.** Yazı bölümleri listesi (`post`, `notes`) 5 şablonda ayrı ayrı yazılı. 4 yorum artık var olmayan ya da taşınmış dosyaları gösteriyor; bunlardan biri `hugo.toml`'daki `unsafe = false` güvenlik notu (markdownify kullanan şablonların listesi eksik ve yanlış). Hepsi diff ile doğrulandı: çıktı birebir aynı kalıyor.

**Hiçbir şey değişmezse en büyük risk:** İletişim e-postası ya da LinkedIn adresi değişirse ana site güncellenir, `/kart/` (QR kodla dağıtılan, telefonda açılan sayfa) eski adresi göstermeye ve vCard'a eski adresi yazmaya devam eder, build bunu fark etmez.

---

## 2) Findings (Prioritized)

### O17. (UYGULANDI 2026-10-11) `/search/` sayfası: "Daha fazla" ile yeni sorgu arasında yarış durumu
- **Category:** Reliability / Frontend
- **Severity:** Medium
- **Impact:** Arama sayfasında doğru sonuç listesi
- **Evidence:** `assets/js/search.js:195-224`. `showMore()` önce `await Promise.all(batch.map(r => r.data()))` ile parça dosyalarını indiriyor, **sonra** `pList.appendChild(...)` ve `shown += batch.length` yapıyor. Bu arada hangi sorgu için çalıştığını kontrol etmiyor. Sıra:
  1. "n8n" yazıldı → `pageUpdate` A → sonuç geldi → `showMore` A parçaları indiriyor (ağa bağlı, yavaş bağlantıda yüzlerce ms).
  2. Kullanıcı yazmaya devam etti → `pageUpdate` B listeyi boşalttı, `shown = 0`.
  3. `showMore` A bitti → A'nın 10 sonucunu B'nin boş listesine **ekledi**, `shown = 10` yaptı.
  4. B'nin sonucu geldi → `showMore` B `current.slice(10, 20)` aldı: **B'nin ilk 10 sonucu hiç gösterilmedi**. B'nin 10'dan az sonucu varsa durum satırı "N sonuç" der ama listede sadece A'nın sonuçları durur.

  Ayrıca "Daha fazla" düğmesine ikinci tıklama ilki bitmeden gelirse ikisi de aynı `shown` değerinden dilim alıyor: aynı 10 sonuç iki kez basılıyor.
- **Why it's inefficient:** Yanlış sonuç gösteren bir arama, hiç sonuç göstermemekten kötü. Üstteki açılır panel (`update()`, satır 135-137) aynı kontrolü iki kez yapıyor (`input.value.trim() !== q`), sayfa tarafında `showMore` bu kontrolü atlıyor.
- **Recommended fix:** Bir "nesil" sayacı: her `pageUpdate` sayacı artırır, `showMore` başladığı nesli hatırlar ve `await`'ten sonra nesil değiştiyse hiçbir şey yazmadan çıkar. Aynı anda tek `showMore` çalışsın diye düğme beklerken `disabled`. O11'in düzeltmesiyle (temizlemeyi sonuç gelene kadar ertelemek) aynı yamada (Bölüm 6).
- **Tradeoffs / Risks:** Yok. Davranış sadece yarış anında değişiyor.
- **Expected impact estimate:** Bir sınıf "yanlış/eksik sonuç" hatası kapanır. Ölçülebilir hız etkisi yok.
- **Removal Safety:** Safe
- **Reuse Scope:** local file (`assets/js/search.js`)

### O20. (UYGULANDI 2026-10-11) İletişim bilgisi `/kart/`'ta elle tekrar ediliyor; build kontrol etmiyor
- **Category:** Reliability / Reuse Opportunity
- **Severity:** Medium-Low
- **Impact:** Kişisel veri kuralının (CLAUDE.md: tek e-posta) korunması, drift riski
- **Evidence:** Aynı e-posta ve LinkedIn adresi:
  - `hugo.toml:23,25` (`params.social`, ana sitenin tek kaynağı)
  - `static/kart/index.html:84,92,107,115` (görünen metin + `mailto:` + link)
  - `static/kart/kart.js:9,11` (vCard)

  `/kart/` Hugo'dan geçmeyen statik bir sayfa olduğu için `params.social`'ı okuyamıyor. LinkedIn adresi zaten iki biçimde yazılı (`hugo.toml`'da sonda `/` yok, `/kart/`'ta var; ikisi de çalışıyor).
- **Why it's inefficient:** Adres değişikliği 3 dosyada 7 düzenleme demek, birini unutmak build'i bozmaz. `/kart/` QR kodla telefonda açılan sayfa: eskimiş bir adres en çok orada zarar verir.
- **Recommended fix:** Sayfayı Hugo şablonuna çevirmek yerine (kendi CSP'si ve Tailwind'i olan bağımsız bir sayfa; taşımak büyük iş) **build sırasında bir kontrol**: `layouts/sitemap.xml`'in başına (dil başına bir kez çalışan bir şablon) `readFile` ile iki statik dosyayı okuyup `params.social.email` ve `linkedin` adreslerini içermiyorlarsa `warnf`. CLAUDE.md'nin "build uyarısız olmalı" kuralı bunu yakalar (Bölüm 6). Adres eski haliyle kalan dosyayı bulmaz ama "yeni adres burada yok" der; ikisi pratikte aynı şey.
- **Tradeoffs / Risks:** `sitemap.xml` bu iş için ilgisiz bir yer; alternatif `layouts/404.html` (tek kez render edilir, TR'de kapalı). Yorumla neden orada olduğu yazılmalı.
- **Expected impact estimate:** Sessiz drift → build uyarısı. Hız etkisi yok.
- **Removal Safety:** Safe (denendi: diff boş, adres değişince uyarı geliyor)
- **Reuse Scope:** site-wide (layouts + static/kart)

### O18. (YENİ) Yazı bölümleri listesi 5 yerde tekrar ediyor
- **Category:** Maintainability / Reuse Opportunity
- **Severity:** Low
- **Impact:** Drift riski (yeni bir bölüm eklenince ana sayfa, Yazılar listesi, RSS ve paylaşım kartı ayrı ayrı güncellenmeli)
- **Evidence:** `slice "post" "notes"`:
  - `layouts/index.html:23`
  - `layouts/home.rss.xml:3`
  - `layouts/partials/site/writing-list.html:7`
  - `layouts/partials/site/head.html:37` (paylaşım kartı kimin için çizilir)

  ve yorumlarda "ana sayfa ve RSS ile aynı süzgeç" diye elle senkron tutulduğu yazılı. Hugo'nun bunun için yerleşik bir ayarı var: `params.mainSections` → `site.MainSections`.
- **Recommended fix:** `hugo.toml`'da `[params] mainSections = ["post", "notes"]`, dört şablonda `site.MainSections`. **Denendi:** çıktı birebir aynı, build uyarısız. Yorumlardaki "aynı süzgeç" notları `hugo.toml`'u gösterecek şekilde kısalır.
- **Tradeoffs / Risks:** `mainSections` verilmezse Hugo onu en kalabalık bölümden tahmin eder; açıkça yazmak bunu da önler.
- **Expected impact estimate:** 4 elle senkron liste → 1 ayar. Hız etkisi yok.
- **Removal Safety:** Safe (diff boş)
- **Reuse Scope:** site-wide (config + 4 şablon)

### O19. (YENİ) 3. aşamadan kalan eski yorumlar, kullanılmayan parçalar
- **Category:** Maintainability / Dead Code
- **Severity:** Low (ilk madde güvenlik notu olduğu için Low-Medium)
- **Impact:** Doğru bağlam (insan ya da ajan için), daha az kod
- **Evidence:**
  1. **`hugo.toml:99-102`**, `unsafe = false`'ın neden kapalı kalması gerektiğini anlatan not: markdownify kullanan yerler olarak `layouts/index.html` ve `layouts/post/single.html (updates[].note | markdownify)` sayıyor. `updates` artık `partials/site/article.html:61`'de. Listede olmayanlar: `_default/about.html:23` (`greeting | markdownify`), `_default/projects.html:23,30` (`RenderString`, `data/projects.yaml`'dan), `shortcodes/callout.html:11`. Notun amacı "unsafe açılırsa neler etkilenir" sorusunu cevaplamak; eksik liste bu amaca hizmet etmiyor.
  2. `layouts/post/list.html:1`: "(bkz. `_default/post.html` notu)". Dosya O15'te silindi.
  3. `layouts/_default/section.html:1`: "(ör. ileride notes/)". Notların artık kendi `notes/list.html`'i var.
  4. `layouts/partials/site/type-filter.html`: üç çağıran da `(dict "page" . "current" ...)` geçiyor, şablon `.page`'i hiç okumuyor. Girdi sadece `current` olabilir.
  5. `layouts/partials/site/icon.html`: `arrow-right` ve `arrow-left` simgelerini hiçbir şablon çağırmıyor (oklar metin olarak `→`/`←` yazılıyor). `(dict "name" ... "class" ...)` biçimi (satır 8-9) de hiçbir yerde kullanılmıyor; 21 çağrının hepsi düz isim geçiyor.
  6. `.github/workflows/hugo.yaml:48`: `HUGO_ENV: production`. Hugo'nun eski adı; `HUGO_ENVIRONMENT` yanında gereksiz.
  7. `layouts/index.html:24-25`: başlangıç listesinde olmayan yazıları bulan elle döngü, `complement $start $posts` ile tek ifade. **Denendi:** çıktı birebir aynı, sıra korunuyor (kopyaya 3 geçici yazı eklenip doğrulandı).
- **Recommended fix:** 1-3: yorumları düzelt (Bölüm 6). 4: `type-filter.html` girdisini düz string yap ya da `page`'i bırakıp yorumda "ileride" diye belirt (ilki daha temiz). 5: iki simgeyi ve map dalını sil; ileride gerekirse git geçmişinde. 6: satırı sil. 7: `complement`.
- **Tradeoffs / Risks:** Yok. 5'teki map dalı "ileride büyük simge" için düşünülmüş olabilir; sahibine sor.
- **Expected impact estimate:** ~15 satır eksilir, güvenlik notu doğru olur. Hız etkisi yok.
- **Removal Safety:** 1-3, 6, 7: Safe. 4: Safe (diff ile doğrulanmalı). 5: Likely Safe (çağıran yok; sahibine sor)
- **Reuse Scope:** module (layouts, config, CI)

### O21. (YENİ) vCard: blob adresi tıklamadan hemen sonra iptal ediliyor
- **Category:** Reliability
- **Severity:** Low
- **Impact:** `/kart/`'taki "Rehbere ekle" düğmesinin telefonda çalışması
- **Evidence:** `static/kart/kart.js:22-24`: `link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);` hepsi aynı anda. `click()` indirmeyi başlatır ama dosyanın okunmasını beklemez. Masaüstü Chrome/Firefox'ta sorun yok; iOS Safari'de `.vcf`'yi açma işi asenkron ve adres o sırada iptal edilmiş olabiliyor (bilinen bir sorun sınıfı, bu sayfada **ölçülmedi**).
- **Recommended fix:** `setTimeout(function () { URL.revokeObjectURL(url); }, 1000);`. Gerçek bir iPhone'da önce/sonra dene.
- **Tradeoffs / Risks:** Blob 1 saniye daha bellekte kalır (~300 byte).
- **Expected impact estimate:** Olası bir "düğme bir şey yapmıyor" hatası kapanır. Kartın ana işlevi bu düğme.
- **Removal Safety:** Needs Verification (iOS Safari'de test)
- **Reuse Scope:** local file

### O22. (YENİ) TODO koruması meşru "TODO:" metnini de yakalıyor
- **Category:** Reliability / Build
- **Severity:** Low
- **Impact:** Yanlış build uyarısı
- **Evidence:** `partials/site/article.html:12`: `strings.Contains .RawContent "TODO:"`. Bir yazıda kod bloğunda ya da metin içinde "TODO:" geçerse (ör. kod yorumu, "TODO: listesi" anlatan bir not) build uyarı verir. Uyarısız build kuralı yüzünden yazar ya metni değiştirir ya da uyarıyı görmezden gelmeyi öğrenir; ikincisi korumayı işe yaramaz yapar.
- **Recommended fix:** Archetype'taki bütün `TODO:` satırları satır başında başlıyor (`archetypes/post.md:16,20,26,30...`). Kontrolü buna daralt: `findRE `(?m)^TODO:` .RawContent 1`. Kod blokları içinde satır başında "TODO:" yine yakalanır ama bu çok daha nadir.
- **Tradeoffs / Risks:** Archetype'a ileride satır ortasında bir "TODO:" eklenirse yakalanmaz. Archetype'ın başına bir satırlık not yeter.
- **Removal Safety:** Safe
- **Reuse Scope:** local file

### O11. (UYGULANDI 2026-10-11, O17 ile) `/search/` sayfası her tuşta listeyi boşaltıyor
- **Category:** Frontend
- **Severity:** Low
- **Evidence:** `assets/js/search.js:203-212`: `pList.replaceChildren()` ve `history.replaceState`, sonuç beklenmeden önce çalışıyor; 150 ms debounce yüzünden liste her tuşta boşalıp doluyor. Açılır panel (`update()`) bunu doğru yapıyor.
- **Recommended fix:** O17 ile aynı yama (Bölüm 6).
- **Removal Safety:** Safe
- **Reuse Scope:** local file

### O8. (AÇIK, yeniden denendi) Arama sayfası feed'i ve sitemap girdisi
- **Category:** Build / Cost
- **Severity:** Low
- **Evidence:** 27 XML dosyası üretiliyor: 22 bölüm/etiket/kategori RSS'i, 2 ana RSS, 3 sitemap. `/search/index.xml` ve `/tr/search/index.xml` her zaman boş. `/search/` ve `/tr/search/` sitemap'te (JS ile dolan, `?q=` olmadan boş sayfa).
- **Recommended fix:** `content/search/_index.md` ve `_index.tr.md` front matter'ına `outputs: ["HTML"]` ve `sitemap: {disable: true}`. **Denendi:** iki boş feed gidiyor, iki sitemap'ten `search` çıkıyor, başka fark yok. İsteğe bağlı: `/search/` için `<meta name="robots" content="noindex">` (header'daki link yüzünden yine taranır; `head.html`'deki notlar sayfası koşuluna benzer bir satır). Etiket/kategori RSS'leri (16 dosya) kalsın: zararsız ve konu bazlı abonelik isteyen olabilir.
- **Removal Safety:** Safe (diff ile doğrulandı)
- **Reuse Scope:** content front matter

### O7. (AÇIK, yeniden denendi) Avatar üç yerde, önceki/sonraki yazı elle döngüyle
- **Category:** Maintainability / Reuse Opportunity / Algorithm
- **Severity:** Low
- **Evidence:**
  - `resources.Get site.Params.avatar` + `.Fill`: `partials/site/header.html:5-8` ve `partials/site/article.html:66-68` (ikisi de `"96x96 webp Center q85"`), `_default/about.html:19-22` (`"240x240 webp Center q85"`).
  - `partials/site/article.html:79-84`: önceki/sonraki yazı bölümdeki bütün yazılar üzerinde elle döngüyle bulunuyor (yazı başına O(n), toplam O(n²); n bugün dil başına 2).
- **Recommended fix:**
  - Önceki/sonraki: `{{ $pages := (where site.RegularPages "Section" .Section).ByDate }}{{ $older := $pages.Next . }}{{ $newer := $pages.Prev . }}`. **Denendi:** çıktı birebir aynı. Yön, kopyaya geçici üçüncü bir yazı eklenerek üç konumda da (ilk, orta, son) doğrulandı. Hugo'nun `Next`/`Prev` adları liste sırasının tersidir; yorumda yazılmalı.
  - Avatar: `partials/site/avatar.html` (boyutu argüman alır, kaynağı `return` eder). İki 96x96 çağrı aynı ayarı paylaşır.
- **Expected impact estimate:** 6 satır döngü → 2 satır; ~yüzlerce yazıya kadar ölçülebilir hız etkisi yok.
- **Removal Safety:** Önceki/sonraki: Safe (diff boş). Avatar: Safe (diff ile doğrulanmalı)
- **Reuse Scope:** module (layouts)

### O12. (AÇIK, düşük öncelik) CI her çalışmada Hugo ve Pagefind'i indiriyor, görselleri sıfırdan işliyor
- **Category:** Build / Network
- **Severity:** Low
- **Evidence:** `.github/workflows/hugo.yaml`: `wget` + SHA256 ile `.deb`, `npx --yes pagefind@1.5.2`. `resources/` gitignore'da, yani CI her seferinde soğuk build yapıyor. **Ölçüldü (yerel):** soğuk build 1.2 sn, ılık 0.45 sn; fark 16 işlenmiş görsel (4 paylaşım kartı dahil).
- **Recommended fix:** Şimdilik yok. Her yazı çifti 2 paylaşım kartı ekliyor; ~50 yazıda soğuk build birkaç saniyeyi geçerse SHA ile pinli `actions/cache` ile `resources/_gen/images` önbelleğe alınabilir (anahtar: `assets/img/**`, `assets/fonts/**`, `layouts/partials/site/share-image.html` hash'i).
- **Expected impact estimate:** Bugün <1 sn. Kayıt için.
- **Removal Safety:** Safe
- **Reuse Scope:** CI

### O9. (KAPANDI: yeniden ölçüldü, değmez) Footer'ı `partialCached` yapmak
- **Evidence:** `--templateMetricsHints` footer için hâlâ %98 cache potansiyeli gösteriyor. **Ölçüldü:** çıktı birebir aynı, ama 7-9 çalıştırmalık medyanlarda fark gürültü içinde kaldı (aynı ayarla 112-154 ms arası oynuyor). Simgeler (`icon.html`, 408 çağrı) için de aynı deneme yapıldı: 112 ms vs 116 ms. Mutlak süre zaten ~0.1 sn. **Önerilmiyor**; ileride footer'a sayfaya bağlı bir şey eklenirse yanlış önbellek riski kazançtan büyük.

---

## 3) Quick Wins (Do First)

| # | İş | Süre | Kazanç | Onay gerekir mi |
|---|---|---|---|---|
| 1 | O17 + O11: `search.js` nesil sayacı + gecikmeli temizleme | 10 dk | Arama sayfası doğru ve titremesiz | Hayır |
| 2 | O19.1-3: 3 eski yorum + `unsafe` notunun listesi | 5 dk | Doğru güvenlik notu, doğru bağlam | Hayır |
| 3 | O20: `/kart/` iletişim kontrolü (`warnf`) | 5 dk | Adres drift'i build uyarısına dönüşür | Hayır |
| 4 | O18: `mainSections` | 5 dk | 4 elle senkron liste → 1 ayar (diff boş) | Hayır |
| 5 | O8: arama sayfası `outputs` + `sitemap` | 2 dk | −2 boş feed, sitemap'te ince sayfa yok (diff ile doğrulandı) | Hayır |
| 6 | O7: `Pages.Next/Prev` | 2 dk | 6 satır → 2 (diff boş) | Hayır |
| 7 | O19.6-7: `HUGO_ENV` satırı, `complement` | 2 dk | Daha az kod | Hayır |
| 8 | O21: `revokeObjectURL` gecikmesi | 1 dk + iPhone testi | Olası iOS hatası kapanır | Hayır |
| 9 | O19.4-5: `type-filter` girdisi, kullanılmayan simgeler | 5 dk | Ölü kod gider | **Evet** (simge silme kararı) |

## 4) Deeper Optimizations (Do Next)

1. **O7 avatar partial'ı.** Tek commit, önce/sonra `public/` diff'i boş olmalı.
2. **`/kart/`'ı ileride Hugo'dan üretmek.** O20'nin kalıcı çözümü: `layouts/kart/` altında ayrı bir şablon, `params.social`'dan okur, kendi sıkı CSP'si ve `kart.css`'i aynen kalır. Kart tasarımı değişmedikçe gerekmez; O20'deki uyarı yeterli.
3. **CI görsel önbelleği** (O12), ancak yazı sayısı artıp soğuk build fark edilir hale gelirse.
4. **Önbellek başlıkları.** GitHub Pages her şeye `max-age=600` veriyor, fingerprint'li dosyalar için `immutable` ayarlanamıyor. Tek yol önüne bir CDN koymak; bu boyutta site için gerekmez.

**Bilerek önerilmeyenler (ölçüldü):**
- **Footer ve simgeleri önbelleğe almak** (O9): fark gürültü içinde.
- **`syntax.css`'i ayırmak:** küçültülüp gzip'lenince ~1 KB; bugün hiçbir sayfada kod bloğu yok, ama ayırmak tek CSS isteğini ikiye böler.
- **Paylaşım kartlarını küçültmek:** ~55 KB/adet `q85` JPG. Sadece önizleme botları indiriyor; `q85` metnin keskinliği için.
- **`theme-init.js`'i satır içine almak:** CSP'ye hash gerekir, CLAUDE.md satır içi script'i yasaklıyor; dosya 160 byte.
- **`/kart/business_foto1.jpg`:** önceki denetimde ölçüldü (WebP ile −%14), değmez.

## 5) Validation Plan

**Referans (75dca59):** 80 dosya, 893,332 byte, uyarı yok; ılık build ~115 ms, soğuk 1.2 sn.

**Ölçüm (önce/sonra):**
- `hugo --gc --minify --cleanDestinationDir` uyarısız bitmeli. `du -sb public; find public -type f | wc -l`.
- Her şablon/config değişikliğinden önce `cp -r public ~/snap/hugo/common/public.before`, sonra build ve `diff -rq ~/snap/hugo/common/public.before public`. Beklenen farklar:
  - O18, O19 (yorumlar, `complement`, `type-filter`, simgeler), O7: **fark yok**
  - O8: `search/index.xml` ve `tr/search/index.xml` gider, `en/sitemap.xml` ve `tr/sitemap.xml` değişir
  - O20, O22: **fark yok** (sadece uyarı davranışı)
  - O17, O11, O21: CSS/JS parmak izi değişir, HTML'de sadece SRI/dosya adı

**Doğruluk testleri:**
- **O17/O11** (Pagefind dizini gerekir: geçici bir venv'de `pip install 'pagefind[bin]==1.5.2'`, `python -m pagefind --site public`, `hugo server` değil `python -m http.server -d public`):
  - DevTools → Network → "Slow 3G". `/search/`'te "n8n" yaz, sonuçlar gelmeden hızla "n8n workflow"'a çevir. Listede sadece son sorgunun sonuçları olmalı, durum satırındaki sayı listedekiyle eşleşmeli.
  - 10'dan fazla sonuç veren bir sorguda "Daha fazla"ya hızlı çift tıkla: tekrar eden sonuç olmamalı.
  - Hızlı yazarken liste boşalmamalı; URL'deki `?q=` gösterilen sonuçla eşleşmeli.
- **O20:** test kopyasında `hugo.toml`'daki e-postayı değiştir → build `WARN` vermeli. Geri al → uyarı yok.
- **O21:** gerçek bir iPhone'da (Safari) `/kart/` → "Rehbere ekle": kişi kartı açılmalı. Değişiklikten önce de dene ki sorun gerçekten var mıydı bilinsin.
- **O22:** test kopyasında taslak olmayan bir yazının ortasına "TODO: listesi" yaz → uyarı yok. Satır başına `TODO: bir şey` yaz → uyarı var.
- **O7:** önceki/sonraki linkleri iki dilde de aynı yönü göstermeli (diff zaten bunu kapsıyor; yeni yazılar geldikçe göz kontrolü).
- **O8:** `/search/?q=n8n` CI'daki Pagefind ile hâlâ çalışmalı.
- Her değişiklikten sonra tarayıcı konsolunda CSP ihlali olmamalı (ana site ve `/kart/`).

## 6) Optimized Code / Patch (öneri; hiçbiri uygulanmadı)

**O17 + O11: `assets/js/search.js`, `/search/` sayfası bölümü (satır 192-228)**
```diff
   var current = [];
   var shown = 0;
+  // Her yeni sorgu nesli artırır; await'ten dönen eski bir iş hiçbir şey yazmaz.
+  var gen = 0;
+
+  function reset() { pList.replaceChildren(); more.hidden = true; current = []; shown = 0; }
+  function syncUrl(q) {
+    var url = new URL(window.location.href);
+    if (q) url.searchParams.set("q", q); else url.searchParams.delete("q");
+    history.replaceState(null, "", url);
+  }

   async function showMore() {
+    var mine = gen;
     var batch = current.slice(shown, shown + 10);
+    more.disabled = true;
     var data = await Promise.all(batch.map(function (r) { return r.data(); }));
+    more.disabled = false;
+    if (mine !== gen) return;
     data.forEach(function (d) { pList.appendChild(hit(d, "li")); });
     shown += batch.length;
     more.hidden = shown >= current.length;
   }

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
+    var mine = ++gen;
+    if (!q) { reset(); syncUrl(q); pStatus.textContent = ""; return; }
     var res;
     try {
       res = await search(q);
     } catch (e) {
       pStatus.textContent = S.unavailable;
       return;
     }
-    if (res === null || pInput.value.trim() !== q) return;
+    if (res === null || mine !== gen) return;
+    // Eski sonuçlar yenisi gelene kadar ekranda kalır: yazarken liste titremez.
+    reset();
+    syncUrl(q);
     current = res.results;
     pStatus.textContent = current.length ? countText(current.length) : fill(S.none, q);
     if (current.length) await showMore();
   }
```
(`reset()` ile `showMore` arasında `gen` değişmediği için ilk `showMore` yazabilir; sonradan gelen bir sorgu `gen`'i artırıp onu iptal eder.)

**O19.1-3: yorumlar**
```diff
 hugo.toml
-      # yazıları değil, ön bilgi alanlarını markdownify ile basan şablonları da etkiler:
-      # layouts/index.html (headline | markdownify) ve layouts/post/single.html
-      # (updates[].note | markdownify) ham HTML'e açılır.
+      # yazıları değil, ön bilgi ve data alanlarını Markdown olarak basan şablonları da etkiler:
+      # layouts/index.html (headline), layouts/_default/about.html (greeting),
+      # layouts/partials/site/article.html (updates[].note), layouts/_default/projects.html
+      # (data/projects.yaml, RenderString) ve shortcodes/callout.html. Hepsi ham HTML'e açılır.

 layouts/post/list.html
-{{- /* Yazılar sayfası. Gövde: partials/site/writing-list.html (bkz. _default/post.html notu). */ -}}
+{{- /* Yazılar sayfası. Gövde: partials/site/writing-list.html. */ -}}

 layouts/_default/section.html
-{{- /* Kendi şablonu olmayan bölümler için genel liste (ör. ileride notes/). */ -}}
+{{- /* Kendi şablonu olmayan bölümler için genel liste (bugün kullanılmıyor; yeni bir bölüm WARN vermesin diye). */ -}}
```

**O18: `mainSections`** (denendi, diff boş)
```diff
 hugo.toml
 [params]
+  # Yazı sayılan bölümler: ana sayfa, Yazılar listesi, RSS ve paylaşım kartı bunu kullanır.
+  mainSections = ["post", "notes"]

 layouts/index.html, layouts/home.rss.xml, layouts/partials/site/writing-list.html
-where site.RegularPages "Section" "in" (slice "post" "notes")
+where site.RegularPages "Section" "in" site.MainSections

 layouts/partials/site/head.html
-    {{- if and .IsPage (in (slice "post" "notes") .Section) }}
+    {{- if and .IsPage (in site.MainSections .Section) }}
```

**O19.7: `layouts/index.html`** (denendi, diff boş, sıra korunuyor)
```diff
   {{- $posts := where site.RegularPages "Section" "in" site.MainSections }}
-  {{- $recent := slice }}
-  {{- range $posts }}{{ if not (in $start .) }}{{ $recent = $recent | append . }}{{ end }}{{ end }}
+  {{- $recent := complement $start $posts }}
```

**O7: `layouts/partials/site/article.html:78-84`** (denendi, diff boş; 3 yazıyla yön doğrulandı)
```diff
       {{- /* Önceki = daha eski, sonraki = daha yeni yazı (aynı bölümde, tarihe göre). */}}
-      {{- $older := false }}{{ $newer := false }}{{ $found := false }}
-      {{- range (where site.RegularPages "Section" .Section).ByDate }}
-        {{- if $found }}{{ if not $newer }}{{ $newer = . }}{{ end }}
-        {{- else if eq . $ }}{{ $found = true }}
-        {{- else }}{{ $older = . }}{{ end }}
-      {{- end }}
+      {{- /* Hugo'da Next/Prev liste sırasının tersidir: eskiden yeniye sıralı listede Next = daha eski. */}}
+      {{- $pages := (where site.RegularPages "Section" .Section).ByDate }}
+      {{- $older := $pages.Next . }}{{ $newer := $pages.Prev . }}
```

**O20: `/kart/` iletişim kontrolü, `layouts/sitemap.xml`'in başına** (dil başına bir kez çalışır)
```go-html-template
{{- /* /kart/ Hugo'dan geçmiyor ve iletişim bilgisini elle yazıyor. params.social değişip kart
     geride kalırsa build uyarı versin (CLAUDE.md: build uyarısız olmalı). */ -}}
{{- if eq site.Language.Lang hugo.Sites.Default.Language.Lang }}
  {{- $s := site.Params.social }}
  {{- range slice "static/kart/index.html" "static/kart/kart.js" }}
    {{- $f := readFile . }}
    {{- if not (strings.Contains $f $s.email) }}{{ warnf "%s: email differs from params.social.email" . }}{{ end }}
    {{- if not (strings.Contains $f (strings.TrimSuffix "/" $s.linkedin)) }}{{ warnf "%s: LinkedIn differs from params.social.linkedin" . }}{{ end }}
  {{- end }}
{{- end }}
```
(**Denendi:** adresler aynıyken çıktı birebir aynı ve uyarı yok; `hugo.toml`'daki e-posta değiştirilince iki dosya için de `WARN` geldi. `site.Sites` değil `hugo.Sites`: ilki Hugo 0.156'dan beri deprecated ve kendisi bir `WARN deprecated` üretiyor.)

**O8: `content/search/_index.md` ve `_index.tr.md`** (denendi)
```diff
 ---
 title: "Search"
 description: "Search the site."
+outputs: ["HTML"]
+sitemap:
+  disable: true
 ---
```

**O21: `static/kart/kart.js`**
```diff
   link.click();
   document.body.removeChild(link);
-  URL.revokeObjectURL(url);
+  // iOS Safari dosyayı asenkron açıyor; adres hemen iptal edilirse kişi kartı açılmayabilir.
+  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
```

**O22: `layouts/partials/site/article.html:12`**
```diff
-{{- if and (not .Draft) (strings.Contains .RawContent "TODO:") }}{{ warnf "%s: TODO: line left from the archetype" .File.Path }}{{ end }}
+{{- if and (not .Draft) (findRE `(?m)^TODO:` .RawContent 1) }}{{ warnf "%s: TODO: line left from the archetype" .File.Path }}{{ end }}
```

**O19.6: `.github/workflows/hugo.yaml`**
```diff
         env:
           HUGO_ENVIRONMENT: production
-          HUGO_ENV: production
```

---

## Önceki denetimlerin durumu

| Bulgu | Durum |
|---|---|
| O1-O6 | **Uygulandı** (2026-10-09/10) |
| O7. Avatar tekrarı, önceki/sonraki döngüsü | **Açık**; önceki/sonraki yaması bu denetimde diff ile doğrulandı → yukarıda |
| O8. Arama sayfası feed/sitemap | **Açık**; yaması diff ile doğrulandı → yukarıda |
| O9. Footer cache | **Kapandı**: yeniden ölçüldü, kazanç gürültü içinde |
| O10. og:image | **Uygulandı** (3. aşama, paylaşım kartları) |
| O11. Arama sayfası titremesi | **Açık**; O17 ile aynı yama |
| O12. CI indirme/önbellek | **Açık**, düşük öncelik; soğuk/ılık build ölçüldü |
| O13. RSS'te yazı olmayan sayfalar, /now tarihi | **Uygulandı** (8ae7298, fed00b0) |
| O14. `/tr/404.html` | **Uygulandı** (8ae7298) |
| O15. Ölü `_default/post.html`, i18n, yorumlar | **Uygulandı** (8ae7298); 3. aşamada yeni eski yorumlar çıktı → O19 |
| O16. `notes` dalları | **Kapandı** (notlar bölümü 3. aşamada kuruldu) |
| 2026-10-09 denetimi (B1-B13) | Hepsi kapandı ya da O-bulgularına taşındı |
