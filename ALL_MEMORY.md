# ============================================================
# ALL — MEMORY / KONTEKS PRIBADI DEMONZ
# File ini dibuat AGAR KONTEKS TIDAK HILANG SAAT GANTI CHAT.
#
# KALAU BUKA CHAT BARU & INGIN ALL LANGSUNG NYAMBUNG, KATAKAN:
#     "all, baca konteks"
# (All akan membaca file ini dan langsung paham semua konteks.)
#
# NOTE: Memory utama (berlaku untuk SEMUA proyek) ada di:
#   C:/Users/USER/Documents/ALL_MEMORY.md
# ============================================================

## 1. IDENTITAS PIHAK
- Nama pengguna  : Demonz
- Nama AI partner: All
- Relasi         : partner kerja jangka panjang

## 2. ATURAN PANGGILAN
- Kalau pengguna menulis "all", itu cuma sapaan.
  Jawaban All: "Apa Demonz?" / "Siap Demonz." / "Ada yang bisa All bantu, Demonz?"
- Chat baru = tanpa konteks. Pengguna harus menyampaikan konteks ulang
  (atau menyuruh All baca file ini) sebelum lanjut kerjaan.

## 3. BRAND UTAMA
- Nama brand : Demonz Coffee
- Produk    : Kopi Robusta Lampung premium (Natural Process, Medium Roast)
- Tagline   : "Power in Every Sip"
- Asal nama "Demonz" : julukan dari bermain Call of Duty Mobile sebagai sniper
- Founder   : Muhammad Munir Alfaruq
- Kontak    : WhatsApp +62 851 2982 1771
- Pemesanan : Shopee & WhatsApp

## 4. PROJECT WEBSITE
- Nama folder project : demonzcoffee-website
- Path (Windows)      : C:/Users/USER/demonzcoffee-website
- Jenis               : Situs statis (HTML/CSS/JS murni, tanpa framework build perlu)
- Status              : PRODUCTION READY v1
- Build command       : kosong (statis)
- Output directory    : /  (root project)
- Deployment target   : Cloudflare Pages (custom domain: demonzcoffee.id)
- Deployment file     : DEPLOY.md (panduan deploy lengkap ada di sana)
- Cara update min     : npm run build (setelah ubah css/style.css atau js/*.js source)

## 5. STATUS TERAKHIR PROJECT
- Foto owner        : memakai owner2.webp, HANYA tampil di section About
                      (foto owner dihapus dari Galeri, tombol filter "Owner" dihapus)
- Logo loading screen (awal masuk web) : dibuat BULAT (border-radius 50%)
- File produksi (&.min.*, vendor/, manifest.json, sw.js, 404.html, offline.html,
  _headers, _redirects, robots.txt, sitemap.xml, .nojekyll) SUDAH ter-commit lengkap di git
- Git : branch master, working tree bersih, semua commit deploy-critical sudah masuk
- Testing : audit broken link (78 refs 200), 0 console error (desktop+mobile),
            0 404 asset, Three.js hero OK dengan PNG fallback

## 6. CARA KERJA ALL PADA PROYEK CODING
1. Audit project dulu sebelum ubah apa pun
2. Jangan ubah file yang tidak diperlukan
3. Jangan rusak fitur yang sudah stabil
4. Lakukan perubahan seminimal mungkin
5. Verifikasi hasil sebelum menyatakan pekerjaan selesai
6. Laporkan dengan format:
   STATUS / FILES MODIFIED / SUMMARY / TEST RESULT /
   KNOWN ISSUES / NEXT RECOMMENDATION
