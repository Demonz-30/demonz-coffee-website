# DEPLOY.md — Demonz Coffee Website

Panduan lengkap deployment Website **Demonz Coffee** ke **Cloudflare Pages**.

> **Tipe situs:** Static site (HTML/CSS/JS murni) — **tidak ada build step wajib**.
> Semua file produksi (`*.min.*`, `vendor/`, `assets/`) sudah di-serve langsung dari root.

---

## 📁 Struktur Project

```
demonzcoffee-website/
├── index.html               # Single-page: 6 section + footer + modals + load scripts
├── 404.html                 # Halaman error custom
├── offline.html             # Halaman fallback PWA saat offline
├── sw.js                    # Service Worker (PWA / offline cache)
├── manifest.json            # Web App Manifest (PWA installable)
├── robots.txt               # Aturan crawler search engine
├── sitemap.xml              # Sitemap (menunjuk https://demonzcoffee.id/)
├── _headers                 # Custom headers (security & caching) — dibaca oleh Cloudflare Pages
├── _redirects               # SPA fallback / rewrites — dibaca oleh Cloudflare Pages
├── netlify.toml             # (opsional) config Netlify — tidak dipakai Cloudflare
├── vercel.json              # (opsional) config Vercel — tidak dipakai Cloudflare
│
├── css/
│   ├── style.css            # Source CSS (manusia-baca, tidak dipakai di produksi)
│   ├── style.min.css        # PRODUKSI — CSS minified yang dimuat index.html
│   └── fonts.css            # @font-face font self-hosted
│
├── js/
│   ├── app.js               # Source (Type.js, parallax)
│   ├── main.js              # Source (loader, GSAP, modals, galeri, filter)
│   ├── three-hero.js        # Source (Three.js 360° hero)
│   ├── app.min.js           # PRODUKSI
│   ├── main.min.js          # PRODUKSI
│   └── three-hero.min.js    # PRODUKSI
│
├── build/
│   └── build.js             # Script build (npm run build) — regenerasi file *.min.*
│
├── vendor/
│   ├── css/swiper-bundle.min.css
│   └── js/  (gsap, ScrollTrigger, three, OrbitControls, GLTFLoader, lenis, swiper, typed, vanilla-tilt)
│
├── assets/
│   ├── icon/    (favicon, apple-touch-icon, icon-192/512/maskable)
│   ├── fonts/   (Montserrat, Poppins, Playfair Display — woff2 self-hosted)
│   ├── logo/web/ logo1-3.webp
│   ├── owner/web/ owner1-2.webp
│   ├── products/web/ products1-9.webp
│   └── gallery/ (gambar asli / cadangan)
│
└── package.json / package-lock.json   # Tooling lokal (http-server, terser)
```

### Konfigurasi penting untuk Cloudflare Pages

| Aspek            | Nilai                        |
|------------------|------------------------------|
| **Build command**| **Kosong** (statis)          |
| **Output dir**   | **`/`** (root project)       |
| **Framework**    | None                         |
| Fungsi `_headers`| Security headers + long-term cache untuk aset       |
| Fungsi `_redirects`| SPA fallback → `/index.html` (rewrite 200)       |

---

## 🚀 Cara Deploy ke Cloudflare Pages (UI Dashboard)

Cara termudah untuk upload site statis:

1. Login ke [dash.cloudflare.com](https://dash.cloudflare.com).
2. Sidebar kiri → **Workers & Pages** → **Create** → **Pages**.
3. Pilih **Upload assets** (atau **Connect to Git** — lihat bagian GitHub di bawah).
4. Seret & lepas **seluruh isi folder `demonzcoffee-website`** (bukan folder-nya, melainkan semua isinya: `index.html`, `css/`, `js/`, `vendor/`, `assets/`, `manifest.json`, `_headers`, `_redirects`, `sw.js`, `404.html`, dst.). **Jangan upload `node_modules/`.**
5. Atur:
   - **Project name:** `demonz-coffee` (atau sesuai keinginan).
   - **Production branch:** `main` / `master`.
   - **Build command:** *(kosongkan — jangan diisi)*
   - **Build output directory:** `/`
6. Klik **Save and Deploy**.
7. Situms live di `https://<project-name>.pages.dev` (contoh: `https://demonz-coffee.pages.dev`).

---

## 🚀 Cara Deploy via GitHub (Recommended)

Paling praktis untuk update berulang otomatis.

### 1. Push project ke GitHub

```bash
git init                                # jika belum
git add -A                              # stage semua file produksi
git commit -m "Milestone C2: production ready + Cloudflare Pages"
git branch -M main
git remote add origin https://github.com/<USERNAME>/demonz-coffee.git
git push -u origin main
```

> Pastikan file produksi sudah ter-stage. File yang **wajib** ikut commit:
> `index.html`, `css/style.min.css`, `css/fonts.css`, `js/*.min.js`, seluruh folder `vendor/`,
> seluruh folder `assets/`, `manifest.json`, `sw.js`, `404.html`, `offline.html`,
> `robots.txt`, `sitemap.xml`, `_headers`, `_redirects`, `.nojekyll`.
> (`node_modules/` dibuang otomatis oleh `.gitignore`.)

### 2. Hubungkan ke Cloudflare Pages

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pilih provider **GitHub** dan **authorize**.
3. Pilih repo `demonz-coffee`.
4. Konfigurasi build:
   - **Production branch:** `main`
   - **Framework preset:** *None*
   - **Build command:** *(kosong / kosongkan tanpa spasi)*
   - **Build output directory:** `/`
5. Klik **Save and Deploy**.

Cloudflare otomatis men-deploy setiap kali kamu `git push` ke branch `main`.

> ⚠️ Karena **build command kosong**, Cloudflare menyalin isi root project sebagai output.
> Seluruh file `.min.*` dan `vendor/` harus sudah ada di dalam repo (commit awal).
> Jika kamu melakukan perubahan pada `css/style.css` / `js/*.js`, jalankan `npm run build`
> **sebelum push** supaya file `.min.*` ikut diperbarui.

---

## 🔗 Menghubungkan Custom Domain

Misal domain utama: **`demonzcoffee.id`**

### Di Cloudflare (zone aktif di Cloudflare)

1. Pastikan domain `demonzcoffee.id` sudah memiliki **zone aktif** di Cloudflare
   (Nameserver sudah diarahkan ke Cloudflare).
2. Buka project Pages: **Workers & Pages** → **demonz-coffee** → tab **Custom domains**.
3. Klik **Set up a custom domain** → isi `demonzcoffee.id`.
4. Cloudflare otomatis menambahkan record `CNAME` `demonzcoffee.id → demonz-coffee.pages.dev`.
5. Centang **Activate domain**.
6. Tambahkan juga `www.demonzcoffee.id` jika mau → record `CNAME` `www → demonz-coffee.pages.dev`.
7. Tunggu propagasi DNS (beberapa menit), lalu kunjungi `https://demonzcoffee.id`.

### Jika domain berada di registrar lain (Nameserver bukan Cloudflare)

1. Tetap ikuti langkah di atas tapi biarkan domain "parked" di Cloudflare.
2. Lalu ke registrar tempat domain dibeli → set **CNAME**:
   - **Name:** `demonzcoffee.id` (atau `@`)
   - **Target:** `demonz-coffee.pages.dev`
   - **Proxy:** `Proxied` (jika zona aktif Cloudflare) / `DNS only`
3. Aktifkan di tab **Custom domains** Cloudflare Pages.

### Catatan setelah domain aktif

- Pastikan `robots.txt` & `sitemap.xml` sudah menunjuk `https://demonzcoffee.id/`.
- Optional: aktifkan **Always Use HTTPS** di tab domain Cloudflare.

---

## 🔄 Cara Update Website

### Auto (jika terhubung GitHub)

1. Ubah file di lokal.
2. Jika kamu mengubah `css/style.css` atau `js/*.js` **source**, regenerasi minified:
   ```bash
   npm run build
   ```
3. Commit & push:
   ```bash
   git add -A
   git commit -m "Update: <deskripsi perubahan>"
   git push origin main
   ```
4. Cloudflare Pages otomatis build & deploy. (Build kosong = isi langsung disalin.)

### Manual (upload via dashboard)

1. Regenerate minified dulu jika perlu: `npm run build`.
2. **Workers & Pages** → **demonz-coffee** → **Create deployment** → **Upload assets**.
3. Drag & drop isi folder project (tanpa `node_modules/`).
4. Deploy.

### Update Service Worker / PWA

- Ubah `sw.js` lalu tambahkan versi cache baru (ubah konstanta `VERSION`) supaya browser
  mendeteksi SW baru. Contoh: `demonz-coffee-v2` → `demonz-coffee-v3`.
- Push + deploy ulang. Buka situs 2× supaya SW baru ter-activate.

---

## ✔️ Checklist Sebelum Deploy

- [ ] Semua file `.min.*` updated (`npm run build` setelah ubah source).
- [ ] Seluruh folder `vendor/` ikut commit.
- [ ] `manifest.json`, `sw.js`, `404.html`, `offline.html`, `robots.txt`, `sitemap.xml`, `_headers`, `_redirects` ada di root & ter-commit.
- [ ] File `_headers` & `_redirects` ada di root (dibaca Cloudflare Pages).
- [ ] Build command dikosongkan, output directory `/`.
- [ ] Test `npm run serve` atau `python -m http.server` lokal sebelum push.

---

## 🧪 Testing Lokal

```bash
cd demonzcoffee-website
# opsi 1 — http-server (butuh npm install dulu)
npm run serve            # → http://localhost:8080

# opsi 2 — python
python -m http.server 8080
# buka http://localhost:8080
```

---

© 2026 Demonz Coffee — Power in Every Sip.
