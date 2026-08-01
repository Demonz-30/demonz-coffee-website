# DEMONZ COFFEE — Premium Website

Website resmi Demonz Coffee — brand kopi premium Robusta Lampung.

Desain premium kelas internasional (Apple / Tesla / Starbucks Reserve grade): dark luxury,
black & gold, glassmorphism, cinematic, interactive 3D, dan fully responsive.

## ✨ Fitur

- **6 Landing Page**: Home, About, Produk, Galeri, Testimoni, Kontak (+ CTA & Footer)
- **Three.js Hero** — produk kopi dapat diputar **360°** (drag / sentuh), dengan tombol
  *Putar Otomatis, Zoom, Reset Posisi*, asap bergerak, biji kopi melayang, partikel debu,
  dan pencahayaan cinematic gold/orange.
- **Premium Animasi** (60 FPS): GSAP + ScrollTrigger, Lenis Smooth Scroll, AOS,
  Swiper slider, Vanilla Tilt, Typed.js, cursor custom, magnetic button, ripple effect,
  loading screen, page transition, glass reflection, hover glow.
- **SEO dioptimalkan**: Meta Title, Meta Description, Open Graph, Twitter Card, Schema.org
  (CoffeeShop + Person), sitemap.xml, robots.txt, lazy loading, image compression (WebP),
  semantic markup, responsive.
- **Galeri Masonry** dengan filter kategori + lightbox + glass & light animation.
- **Kontak**: Google Maps, WhatsApp, Instagram, TikTok, Shopee, form, dan CTA kopi panas
  dengan asap bergerak.

## 🎨 Palet

| Warna | Hex |
|-------|-----|
| Background | `#050505` |
| Secondary | `#111111` |
| Card | `#181818` |
| Gold | `#F5B041` |
| Orange | `#FF8C00` |
| White | `#FFFFFF` |

Fonts: **Playfair Display** (display), **Poppins** (body), **Montserrat** (heading/UI).

## 📁 Struktur

```
demonzcoffee-website/
├── index.html          # Single-page 6 sections + footer + modals
├── css/style.css       # Semua styling (palette, glass, animasi, responsive)
├── js/
│   ├── app.js          # Typed.js + hero mouse parallax
│   ├── main.js         # Loader, GSAP, Lenis, cursor, Swiper, filter, galeri, modals
│   └── three-hero.js   # Three.js 360° produk, asap, partikel, pencahayaan
├── assets/…/web/*.webp # Gambar teroptimasi (produk, logo, owner)
├── robots.txt
└── sitemap.xml
```

## 🚀 Deploy

### GitHub Pages
1. Buat repo baru (nama: `demonzcoffee` atau username.github.io).
2. Push semua isi folder ini ke branch `main`.
3. Repo → **Settings → Pages** → Source: `Deploy from a branch` → `main` / `/ (root)` → **Save**.
4. Website live di `https://username.github.io/`.

### Cloudflare Pages
1. Login Cloudflare → **Workers & Pages → Create → Pages**.
2. Hubungkan repo Git (atau upload folder).
3. Build: `None` (static). Output dir: `/`.
4. **Save & Deploy**. (Centang enable Web3 untuk menarik.)
5. Domain custom: gabungkan di tab *Custom domains*.

### Testing lokal
```bash
cd demonzcoffee-website
python -m http.server 8080
# buka http://localhost:8080
```

## ✍️ Kustomisasi cepat

- **Link Shopee/WA** ada di `index.html` (CTA, modal, section Kontak) & footer.
- **Konten galeri** di `js/main.js` → array `galleryItems`.
- **Data produk** di section `#produk`.
- **Palet warna** di `css/style.css` → `:root`.

© 2026 Demonz Coffee — Power in Every Sip.
