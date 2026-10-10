---
title: "flx: temiz bir ilan akışı ve yapay zeka teklif ajanı"
subtitle: "Gürültülü Freelancer.com aramalarından tek çalışmada elenen 84 ilana"
description: "Freelancer.com API'si için salt okunur bir Python komut satırı aracını ve üzerinde ilanları eleyip teklif taslağı yazan bir Claude Code ajanını nasıl kurdum. Kendi aracım, müşteri işi değil."
date: 2026-10-08
categories: ["case-study"]
ai_use: draft
tags: ["python", "ai-agents", "claude-code", "automation"]
---

*Bu benim kendi aracım, bir müşteri projesi değil. Tam yazı ve kod:
[github.com/Melwis880/freelancer-cli](https://github.com/Melwis880/freelancer-cli).*

## Sorun

Freelancer.com'daki yapay zeka ve otomasyon ilanları gürültünün içinde kayboluyor. n8n ya da
LangChain araması logo tasarımı, çeviri ve veri girişi ilanları da getiriyor. Teklif vermeye
değer birkaç ilanı bulmak için aynı aramaları elle yapıp daha önce gördüğüm ilanları yeniden
okumam gerekiyordu.

Bir sonraki adım olan teklif taslağı yazan ajan için bir tarayıcı sekmesi yetmezdi. Ajanın
güvenebileceği temiz, yapılandırılmış ve tekrarsız bir veri lazımdı.

<!--more-->

## Nasıl çalışıyor

**1. Bölüm: `flx`, veri katmanı.** Sadece Python standart kütüphanesiyle yazılmış küçük bir komut
satırı aracı. Resmi Freelancer REST API'sinden ilan verisini okuyor ve başka hiçbir şey yapmıyor.

- **Yapısı gereği salt okunur.** HTTP istemcisi GET dışındaki her isteği reddediyor, yani teklif
  veremiyor, mesaj atamıyor.
- **API'ye karşı nazik.** İstekler arasında en az 1 saniye var, hız sınırına takılınca bekleyip
  sınırlı sayıda yeniden deniyor.
- **Tüm rutin tek komutta.** `flx scan --only-new` her anahtar kelime ve beceri aramasını
  çalıştırıyor, sonuçları birleştirip tekrarları ayıklıyor ve sadece daha önce gösterilmemiş
  ilanları gösteriyor.
- **Makineler için katı JSON.** Sabit alanlı ve sürümlü bir şema var, ajan buna güvenebiliyor.

**2. Bölüm: üstteki ajan.** Düz Markdown ile tanımlanmış bir Claude Code ajanı. İki becerisi var:
"ilanları ele" ve "teklif yaz".

1. Tek bir ilanı okumadan önce ham taramayı dosyaya kaydediyor, böylece her karar izlenebiliyor.
2. İlan metnini güvenilmeyen veri olarak ele alıyor: gizli Unicode karakterleri ya da yapay zekaya
   hitap eden satırlar çalışmayı durduruyor.
3. Her ilana tek satırlık gerekçesiyle bir karar veriyor: teklif ver, bana sor ya da geç.
4. Sadece eleği geçen ilanlara teklif taslağı yazıyor ve sadece herkese açık kanıtlara atıf
   yapıyor.
5. Hiçbir şey göndermiyor. Teklif vermek bende kalıyor.

## Sonuç

- Ajanın ilk çalışmasında 11 aramadan gelen **84 ilan** elendi, başarısız arama olmadı.
- **8 teklif, 34 bana sor, 42 geç.** 34 "bana sor" ilanı 9 soruya gruplanmış olarak geldi, böylece
  tek tek değil grup grup karar verebildim.
- Aynı gün **5 teklif taslağı** çıktı.
- Arama ayarı ölçülerek yapıldı: gevşek eşleşen çok kelimeli aramalar yerine birebir eşleşen
  beceri aramalarına geçilince, yaklaşık yarısı alakasız olan akışta 83 ilanın yaklaşık 56'sı
  açıkça hedefe uygun hâle geldi.
- **123 test**, CI, MIT lisansı.

Henüz kanıtlamadığı şeyler: bir zaman karşılaştırması yok (bu hacimde ilanı hiç elle elemedim)
ve henüz teklif sonucu yok. İkisi de ancak ölçüldüğünde eklenecek.

## Çıkarım

Ajana temiz, güvenilir veri ve dar bir görev ver; riskli adımı (göndermeyi) insanda bırak.
Ajanı çalıştırmayı güvenli yapan şey bu ayrım.
