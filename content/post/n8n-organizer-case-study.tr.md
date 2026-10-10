---
title: "2.047 n8n iş akışını aranabilir bir bilgi tabanına dönüştürmek"
subtitle: "Asıl sorunun verinin en yeni sürümü olduğu ortaya çıktı"
description: "Açık Zie619 n8n iş akışı koleksiyonunu NotebookLM'e hazır üç temiz dosyaya dönüştüren kural tabanlı bir Python komut satırı aracı: 1.973 benzersiz iş akışı, 0 hata, yaklaşık 7 saniye. Kendi aracım, müşteri işi değil."
date: 2026-10-09
categories: ["case-study"]
ai_use: draft
tags: ["n8n", "python", "automation", "knowledge-base"]
---

*Bu benim kendi aracım, bir müşteri projesi değil. İş akışları bana değil, açık
[Zie619/n8n-workflows](https://github.com/Zie619/n8n-workflows) koleksiyonuna ait. Tam yazı ve
kod: [github.com/Melwis880/n8n-organizer](https://github.com/Melwis880/n8n-organizer).*

## Sorun

Bir otomasyon projesini planlarken işe yarayan soru şu: "Bunun için daha önce ne kurulmuş?" Açık
bir n8n iş akışı kütüphanesi bu sorunun cevabını verir, ama ancak içinde arama yapabilirsen.
Koleksiyonda 187 klasörde 2.057 JSON dosyası var. Ham n8n JSON'u uzun, düğüm parametreleri ve
tuval konumlarıyla dolu, bazı dosyalar da başkalarının kopyası. Olduğu gibi NotebookLM gibi bir
araca yüklenirse yüzlerce kaynak ve bolca gürültü demek.

Hedef: her iş akışını aynı şekilde anlatan, güvenilir ve gerekçesi görülebilen bir kategoriye
sahip, az sayıda büyük ve temiz kaynak.

<!--more-->

## Nasıl çalışıyor

1. **Tara:** Klasörü tara, iş akışı olmayanları gerekçesini kaydederek atla.
2. **Ölç:** Her iş akışında çalışan düğümleri, gerçek bağlantıları, tetikleyicileri, dalları ve
   servisleri say.
3. **Puanla:** İş akışını üç kategoriden birine yerleştir (`Data_Integration`, `AI_Content`,
   `Orchestration_Reliability`). Her puan bir gerekçe satırı olarak yazılır.
4. **Tekrarları ayıkla:** Sadece kimlik, konum ya da düğüm sırası farklı olan kopyalar dahil.
5. **Yaz:** Her kategori için bir Markdown dosyası, ayrıca bir özet ve her kararın izi.

LLM yok, ağ bağlantısı yok. Düğüm parametreleri, kimlik bilgileri ve URL'ler çıktıya hiç ulaşmaz,
çünkü gerçek iş akışları parametrelerinde sıklıkla API anahtarı tutar.

## Bulgu: en yeni veri bozuktu

Herhangi bir sayıya güvenmeden önce koleksiyonun git geçmişindeki düğüm türlerini karşılaştırdım.
Sonraki iki commit koleksiyonu bozmuştu: biri binlerce bağlantısız hata düğümü eklemiş, diğeri
yapay zeka düğümlerini adlarını koruyarak boş `noOp` düğümlerine çevirmişti (hâlâ "OpenAI Chat
Model" adını taşıyan 320 düğüm). Düğüm türlerini okuyan bir sınıflandırıcı bu veride doğru olamaz.
Bu yüzden araç son temiz sürümde (`ae8cf6dc`) çalışıyor.

## Sonuç

| Ölçü | Değer |
|---|---|
| İncelenen iş akışı | 2.047 |
| Yazılan benzersiz iş akışı | 1.973 |
| Ayıklanan tekrar | 74 |
| Hata | 0 |
| Çalışma süresi | yaklaşık 7 saniye |
| Çıktı | 3 dosya, her biri NotebookLM kelime sınırının altında |

Bağımsız 24 iş akışlık örneklemlerde elle kontrol edilen doğruluk: ayardan önce 24'te 16, sonra
24'te 24 (puanlama sinyali olanlar). 24'lük örneklemler küçük; bunlar kıyaslama değil, kontrol.

Kalite çalışması: 57 yazılı senaryo üzerinde 123 test. Testleri sınamak için koda tek tek 167
kasıtlı hata yerleştirildi ve 153'ü yakalandı. Yayın öncesi üç güvenlik incelemesi, özel
hazırlanmış dosya adlarının çalışmayı durdurması ve iş akışı parametrelerindeki değerleri
sızdırabilen bir özet (hash) gibi sorunları giderdi.

## Çıkarımlar

- Modeli ayarlamadan önce veriye bak. Burada sorun en yeni veriydi.
- Dürüst bir "sinyal yok", kendinden emin bir varsayılandan iyidir.
- Doğruluk sayılarını dürüst yapan, ayar örnekleminden ayrı tutulan elle kontrol edilmiş
  örneklemlerdir.
