# /kart/ stilleri

`static/kart/kart.css` bu klasördeki iki dosyadan derlenir. Kaynaklar 2026-10-11'de yeniden kuruldu:
derlenen çıktı, mevcut `kart.css` ile tek bir satır sonu dışında birebir aynıydı (lisans yorumundan
önceki `\n`).

- `tailwind.config.js`: sadece `static/kart/index.html` taranır.
- `input.css`: Tailwind katmanları + sayfaya özel dört kural (zemin, ayırıcı, fotoğraf, kart gölgesi).

`index.html`'e yeni bir Tailwind sınıfı eklendiğinde ya da `input.css` değiştiğinde yeniden derle.
Derlemeden yeni sınıf çalışmaz. Repo kökünden:

```bash
# Tailwind v3.4.17 standalone CLI, repo dışına indir ve doğrula (Node gerekmez)
curl -sSLo ~/tailwindcss https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-linux-x64
echo "7d24f7fa191d2193b78cd5f5a42a6093e14409521908529f42d80b11fde1f1d4  $HOME/tailwindcss" | sha256sum -c -
chmod +x ~/tailwindcss

~/tailwindcss -c tools/kart/tailwind.config.js -i tools/kart/input.css -o static/kart/kart.css --minify
```

`/kart/` sıkı bir CSP altında çalışır (`static/kart/index.html`): satır içi stil ya da script yok, dış
kaynak yok. Stil değişiklikleri sadece bu dosyalardan yapılır.
