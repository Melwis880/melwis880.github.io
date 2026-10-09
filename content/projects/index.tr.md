---
title: "Projeler"
description: "M. Meriç Ordu'nun açık projeleri: testleri, CI'ı ve yazılı vaka analizi olan yapay zeka otomasyon araçları."
url: "/tr/projeler/"
layout: page
---

Buradaki her proje açık, test edilmiş ve belgelenmiş. Hepsi kendi araçlarım, müşteri işi değil.
Her biri üç soruya cevap verir: hangi sorunu çözüyor, nasıl çalışıyor ve ölçülen sonuç ne.

---

### flx: Freelancer.com iş akışı + yapay zeka teklif ajanı

**Sorun:** Freelancer.com'daki yapay zeka ve otomasyon ilanları gürültünün içinde kayboluyor.
Teklif vermeye değer birkaç ilanı bulmak için aynı aramaları elle tekrar tekrar yapmak gerekiyordu.

**Nasıl çalışıyor:** Salt okunur bir Python komut satırı aracı (sadece standart kütüphane) resmi
API'den ilanları çekiyor, tekrarları ayıklıyor ve sadece yenileri gösteriyor. Üzerinde çalışan bir
Claude Code ajanı her ilanı eliyor (teklif ver, bana sor ya da geç) ve teklif taslağı yazıyor.
Teklifi göndermek elle yapılıyor.

**Sonuç:** Ajanın ilk çalışmasında 84 ilan elendi: 8 teklif, 34 bana sor, 42 geç ve 5 teklif
taslağı. 123 test, CI, MIT lisansı.

[Vaka analizini oku](/tr/post/flx-case-study/) · [GitHub](https://github.com/Melwis880/freelancer-cli)

---

### n8n-organizer: 2.000 iş akışlık bir n8n kütüphanesini bilgi tabanına dönüştürmek

**Sorun:** Açık bir n8n iş akışı kütüphanesi ancak içinde arama yapabilirsen işe yarar. Ham n8n
JSON'u ise uzun, gürültülü ve tekrarlarla dolu.

**Nasıl çalışıyor:** Kural tabanlı bir Python komut satırı aracı koleksiyonu tarıyor, her iş
akışını gerekçesini yazarak üç kategoriden birine puanlıyor, tekrarları ayıklıyor ve NotebookLM'e
hazır üç temiz Markdown dosyası yazıyor. LLM yok, ağ bağlantısı yok.

**Sonuç:** 2.047 iş akışı incelendi, 1.973 benzersiz iş akışı yazıldı, 0 hata, çalışma başına
yaklaşık 7 saniye. Bağımsız ve elle kontrol edilen bir örneklemde 24'te 24 doğru. 123 test,
Python 3.10-3.13 üzerinde CI.

[Vaka analizini oku](/tr/post/n8n-organizer-case-study/) · [GitHub](https://github.com/Melwis880/n8n-organizer)
