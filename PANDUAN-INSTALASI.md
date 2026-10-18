# 📋 Panduan Instalasi — Qasir v1.3.3

Qasir terdiri dari dua bagian:

| Bagian | Isi | Dipasang di |
|---|---|---|
| **Backend** | `Kode.gs` + `appsscript.json` | Google Apps Script (akun Google Anda) |
| **Frontend** | Isi ZIP `qasir.zip` (`index.html`, `css/`, `js/`, `icons/`, `sw.js`, …) | GitHub Pages (gratis) |

Urutan wajib: **Backend dulu → dapat URL `/exec` → isi ke frontend → upload frontend ke GitHub Pages.**

Waktu yang dibutuhkan: ± 30–45 menit untuk pertama kali.

> **Sudah memasang versi sebelumnya?** Langsung ke [Bagian G — Cara update versi](#bagian-g--cara-update-versi).

---

## BAGIAN A — Backend (Google Apps Script)

### A1. Buat proyek Apps Script
1. Buka **https://script.google.com** → login dengan akun Google pemilik toko (akun ini yang akan menyimpan data & mengirim email laporan).
2. Klik **Proyek baru**. Ganti nama proyek (kiri atas) menjadi `Qasir API`.
3. Di panel kiri, klik file **Code.gs** → ganti nama menjadi **`Kode`**.
4. Hapus semua isinya, lalu **tempel seluruh isi `Kode.gs`**. Tekan **Ctrl+S**.

### A2. Pasang `appsscript.json` (zona waktu & pengaturan web app)
1. Klik ⚙️ **Project Settings** (ikon gerigi di kiri) → centang **"Show "appsscript.json" manifest file in editor"**.
2. Kembali ke **Editor** (ikon `< >`) → klik file **appsscript.json** → ganti seluruh isinya dengan isi `appsscript.json` yang diberikan → **Ctrl+S**.

> Zona waktu diset **Asia/Makassar (WITA)**. Kalau toko Anda di WIB, ganti menjadi `Asia/Jakarta`; WIT → `Asia/Jayapura`.

### A3. Jalankan setup — **HANYA SEKALI**
1. Di toolbar atas, pilih fungsi **`setupAppEnvironment`** pada dropdown → klik **▶ Jalankan (Run)**.
2. Muncul **"Authorization required"** → **Review permissions** → pilih akun Anda → klik **Advanced / Lanjutan** → **Go to Qasir API (unsafe)** → **Allow / Izinkan**.
   *(Peringatan "unsafe" muncul karena skrip ini buatan Anda sendiri, bukan dari Google. Aman.)*
3. Buka **Execution log** di bawah. Tunggu sampai muncul:
   ```
   ✅ SETUP SELESAI
      Spreadsheet : https://docs.google.com/...
      Folder Drive: https://drive.google.com/...
      Akun owner  : owner / 123456
      Akun kasir  : kasir1 / 111111
   ```
4. Cek Google Drive Anda — harus ada folder **📁 Qasir - Kedai Rasa Nusantara** berisi spreadsheet **🗃️ Qasir DB** dan folder `Logo`, `Foto Produk`, `Bukti Bayar`, `Laporan`.

> ⚠️ **Jangan jalankan `setupAppEnvironment` dua kali.** Kalau tidak sengaja, skrip akan menolak dan hanya menampilkan link spreadsheet yang sudah ada.
>
> Opsional: jalankan fungsi **`testIzin`** untuk mengecek email akun & sisa kuota email harian (akun Gmail biasa: 100 email/hari — lebih dari cukup).

### A4. Deploy sebagai Web App
1. Klik tombol biru **Deploy** (kanan atas) → **New deployment**.
2. Klik ikon ⚙️ di samping "Select type" → pilih **Web app**.
3. Isi:
   - **Description:** `Qasir v1`
   - **Execute as:** **Me** (akun Anda)
   - **Who has access:** **Anyone**
4. Klik **Deploy** → **salin URL Web app** yang berakhiran **`/exec`**. Simpan di Notepad.

> Tes cepat: tempel URL `/exec` itu di tab browser baru. Harus tampil teks seperti
> `{"ok":true,"data":{"app":"Qasir","version":"1.0.0","ready":true,...}}`.
> Kalau `"ready":false`, ulangi langkah A3.

---

## BAGIAN B — Siapkan Frontend

1. **Ekstrak `qasir.zip`.** Hasilnya satu folder bernama **`qasir`**. Isinya harus langsung terlihat seperti ini (tanpa folder pembungkus lain):
   ```
   qasir/
   ├── index.html          ← harus ada di sini
   ├── manifest.webmanifest
   ├── sw.js
   ├── README.md
   ├── PANDUAN-INSTALASI.md
   ├── css/
   │   └── style.css
   ├── icons/
   └── js/
       ├── config.js       ← satu-satunya file yang perlu diubah
       ├── core.js, app.js, p-kasir.js, p-ops.js, p-owner.js, p-promo.js, …
   ```
2. Buka **`js/config.js`** dengan Notepad / VS Code. Ganti:
   ```js
   GAS_URL: 'https://script.google.com/macros/s/GANTI_DENGAN_ID_DEPLOYMENT/exec',
   ```
   dengan URL `/exec` dari langkah A4 (tetap di dalam tanda kutip). Simpan.

---

## BAGIAN C — Upload Frontend ke GitHub Pages (lewat terminal)

> ❗ **Jangan pakai tombol "Upload files" di web GitHub** — struktur folder `css/` dan `js/` akan rusak dan aplikasi tampil polos/404. Selalu lewat terminal seperti di bawah.

### C1. Install Git (sekali saja)
- **Windows:** unduh dari https://git-scm.com/download/win → install dengan pilihan default. Setelah itu buka **PowerShell**.
- **Mac:** buka Terminal, ketik `git --version` (macOS menawarkan instalasi otomatis).

Cek:
```bash
git --version
```

### C2. Atur identitas Git (sekali seumur komputer)
```bash
git config --global user.name "Nama Anda"
git config --global user.email "email-akun-github@anda.com"
```

### C3. Buat repository di GitHub
1. Daftar/login di https://github.com.
2. Klik **+** (kanan atas) → **New repository**.
3. **Repository name:** misalnya `qasir` · pilih **Public** · **JANGAN** centang *Add a README*, *.gitignore*, atau *license*.
4. Klik **Create repository**. Biarkan halaman itu terbuka.

### C4. Masuk ke folder yang BENAR — folder `qasir` hasil ekstrak
**Folder yang di-`git init` adalah folder `qasir` yang langsung berisi `index.html`.** Bukan folder di atasnya, bukan folder di dalamnya.

Cara cepat di Windows: buka folder `qasir` di File Explorer → klik address bar → ketik `powershell` → Enter.

Atau ketik manual (sesuaikan lokasinya):
```powershell
cd "C:\Users\NamaAnda\Downloads\qasir"
```

Verifikasi **sebelum** lanjut:
```powershell
dir
```
✅ Harus terlihat `index.html`, `css`, `js`, `icons`, `sw.js` di daftar.
❌ Kalau yang terlihat justru folder `qasir` lagi, ketik `cd qasir` dulu lalu `dir` lagi.
❌ Pastikan **tidak ada** `Kode.gs` di folder ini (backend tidak boleh ikut di-upload).

### C5. Kirim ke GitHub — jalankan satu per satu
```bash
git init
git add .
git commit -m "Upload pertama Qasir"
git branch -M main
git remote add origin https://github.com/USERNAME/qasir.git
git push -u origin main
```
- Ada **titik** di akhir `git add .` — jangan sampai lupa.
- Ganti `USERNAME` dengan username GitHub Anda.
- Saat `git push` meminta **Password**, yang dimasukkan adalah **Personal Access Token**, bukan password akun (lihat C6). Saat menempel token, **layar memang terlihat kosong** — itu normal, tekan Enter saja.

Tanda berhasil: muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

### C6. Membuat Personal Access Token (kalau diminta)
1. Buka https://github.com/settings/tokens → **Generate new token (classic)**.
2. **Note:** `qasir-push` · **Expiration:** 90 days · centang scope **repo**.
3. **Generate token** → salin token `ghp_…` (hanya tampil sekali, simpan di Notepad).
4. Jalankan lagi `git push -u origin main` dan tempel token sebagai password.

> Kesulitan dengan terminal? Alternatif visual: **GitHub Desktop** (https://desktop.github.com) → *Add Local Repository* → pilih folder `qasir` → *Publish repository* (hilangkan centang *Keep this code private*).

### C7. Aktifkan GitHub Pages
1. Di repo GitHub: **Settings** → **Pages** (menu kiri).
2. **Source:** Deploy from a branch · **Branch:** `main` · folder **/ (root)** → **Save**.
3. Centang **Enforce HTTPS** (wajib — kamera, scan barcode, printer Bluetooth & mode offline hanya jalan di HTTPS).
4. Tunggu 1–2 menit, refresh. Muncul: **"Your site is live at https://USERNAME.github.io/qasir/"**.

---

## BAGIAN D — Pemakaian Pertama

1. Buka `https://USERNAME.github.io/qasir/` di HP atau laptop.
2. Login **owner / 123456**.
3. **Segera ganti PIN bawaan:** menu **Lainnya → Karyawan** → ikon 🔒 pada akun Pemilik dan akun Rina (kasir1) → isi PIN baru 6 digit.
4. **Lainnya → Pengaturan Toko:** isi nama brand, alamat, No. WA, email penerima laporan, unggah logo, pilih warna tema → **Simpan Pengaturan**. Warna & logo langsung berlaku di semua perangkat.
5. **Hapus/ubah data contoh:** menu **Produk**, **Bahan & Biaya**, **Promo** sudah berisi contoh menu (makanan, minuman, kue & snack). Ubah sesuai menu toko Anda — HPP & rekomendasi harga otomatis menyesuaikan.
6. **Buka Toko** dari Dashboard (isi modal kas). Kasir hanya bisa menyimpan transaksi saat toko berstatus **buka**.
7. Di akhir hari: Dashboard → **Tutup Toko** → isi kas aktual → laporan + PDF terkirim ke email dan tersimpan di folder Drive `Laporan`.

### Pasang di HP seperti aplikasi
- **Android (Chrome):** menu ⋮ → **Tambahkan ke layar utama / Install app**.
- **iPhone (Safari):** tombol Bagikan → **Add to Home Screen**.

### Printer struk Bluetooth
- Didukung di **Chrome Android** dan **Chrome/Edge laptop** (Windows/Mac). Menu **Akun → Printer → Hubungkan**, pilih printer thermal 58/80 mm.
- **iPhone/Safari tidak mendukung Bluetooth web** — gunakan tombol **Simpan Gambar** atau **Kirim WA** di layar sukses.

### Mode offline (1–8 jam)
- Login pertama di setiap perangkat **wajib online**. Setelah itu kasir bisa login & bertransaksi tanpa internet.
- Transaksi, stok masuk, pembatalan, pembayaran utang, dan foto bukti tersimpan di perangkat lalu **terkirim otomatis** saat internet kembali (indikator di kanan atas: *"3 menunggu sinkron"*).
- **Jangan hapus data browser / jangan logout** saat masih ada data menunggu — aplikasi akan memperingatkan.
- Mengubah data master (produk, harga, pengaturan, buka/tutup toko) membutuhkan internet.

---

## BAGIAN E — Cara Update

### Mengubah backend (`Kode.gs`)
1. Tempel kode baru → Ctrl+S.
2. **Deploy → Manage deployments** → ikon ✏️ pada deployment yang ada → **Version: New version** → **Deploy**.
   *(Dengan cara ini URL `/exec` tetap sama — frontend tidak perlu diubah. Jangan pilih "New deployment" karena akan menghasilkan URL baru.)*

### Mengubah frontend
1. Edit file di folder `qasir`.
2. Buka `sw.js`, naikkan versinya, misal `const VERSION = 'qasir-v1.0.1';` — supaya HP pengguna mengambil file baru.
3. Dari folder `qasir`:
   ```bash
   git add .
   git commit -m "Update tampilan"
   git push
   ```
4. Tunggu 1–2 menit. Di perangkat, tutup lalu buka lagi aplikasinya (atau **Ctrl+Shift+R** di laptop).

---

## BAGIAN F — Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Login: *"URL server belum diatur"* | `js/config.js` belum diisi | Isi `GAS_URL`, lalu `git add . && git commit -m "config" && git push` |
| Login: *"Server membalas HTTP … bukan JSON"* | URL salah / akses deploy bukan *Anyone* | Cek URL berakhiran `/exec`; Deploy → Manage → *Who has access: Anyone* |
| *"Server belum di-setup"* | `setupAppEnvironment` belum dijalankan | Jalankan langkah A3 |
| Halaman 404 di GitHub Pages | `index.html` tidak di root repo | Lihat repo di browser; kalau terlihat folder `qasir/` di dalamnya, push ulang dari folder yang benar (`git push -u origin main --force` dari folder berisi `index.html`) |
| Tampilan polos tanpa warna | Folder `css/`/`js/` rusak (upload via web) | Upload ulang lewat terminal (Bagian C) |
| Kasir: *"Toko belum dibuka"* | Owner belum Buka Toko | Owner → Dashboard → Buka Toko |
| Data tidak muncul di dashboard | Ada data offline belum sinkron | Lihat indikator sinkron; sambungkan internet |
| Email laporan tidak masuk | Email owner kosong / masuk spam | Isi di Pengaturan; cek folder Spam; jalankan `testIzin` |
| Tampil versi lama setelah update | Cache | Naikkan `VERSION` di `sw.js`, tutup-buka aplikasi |
| *"Sesi berakhir"* | Token 8 jam habis | Masukkan PIN di dialog yang muncul; data offline tetap aman |
| Kamera laptop tidak terbuka / *"Izin kamera ditolak"* | Browser memblokir kamera | Klik ikon 🔒 di address bar → Kamera: **Izinkan** → coba lagi. Tutup Zoom/Meet yang sedang memakai webcam |
| Toko online: "Toko sedang tutup" | Toko belum dibuka di aplikasi | Pemilik → Dashboard → Buka Toko, atau aktifkan *Terima pesanan saat toko tutup* |
| Pesanan online tidak berbunyi | Aplikasi kasir belum disentuh sejak dibuka / volume mati | Ketuk layar sekali setelah membuka aplikasi; naikkan volume. Badge & daftar pesanan tetap diperbarui |
| Toko online: "Toko online sedang tidak aktif" | Saklar Jual Online mati / belum disimpan | Lainnya → Jual Online → nyalakan → Simpan |
| Barcode cetakan sulit discan | Dicetak dengan skala "Sesuaikan halaman" / tinta tipis | Cetak ulang dengan Skala 100%, kualitas Normal/Tinggi; dekatkan kamera ±10–15 cm, nyalakan senter bila redup |
| Tidak ada bunyi saat scan | Volume HP/laptop mati atau mode senyap | Naikkan volume media. Getar & animasi hijau tetap muncul sebagai tanda |
| Tombol **Salin** gambar poster gagal | Browser lama / bukan Chrome | Pakai Chrome atau Edge terbaru, atau tekan tombol ⬇ Unduh di sebelahnya |
| Gambar/PDF gagal dibuat saat offline | Modul ekspor belum pernah dimuat | Simpan gambar/PDF sekali saat online; setelah itu bisa dipakai offline |

---

## Akun Bawaan (ganti segera!)

| Peran | Username | PIN |
|---|---|---|
| Pemilik (Owner) | `owner` | `123456` |
| Kasir | `kasir1` | `111111` |

---

## BAGIAN G — Cara update versi

Data Anda (produk, transaksi, pengaturan) **tidak berubah** — cukup ganti kodenya.

**1. Backend:**
1. Buka proyek Apps Script → file **Kode** → hapus semua isinya → tempel **`Kode.gs` versi terbaru** → **Ctrl+S**.
2. **Deploy → Manage deployments** → ✏️ → **Version: New version** → **Deploy**. URL `/exec` tetap sama.
3. ⚠️ **Jangan** menjalankan `setupAppEnvironment` lagi.

**2. Frontend:**
1. Ekstrak `qasir.zip` versi terbaru ke folder baru.
2. **Salin `js/config.js` lama Anda** (yang sudah berisi URL `/exec`) dan timpa `js/config.js` di folder baru — atau isi ulang `GAS_URL`.
3. Salin **seluruh isi** folder baru ke folder `qasir` lama Anda (timpa semua file). Pastikan folder `.git` di folder lama tidak ikut terhapus.
4. Dari folder `qasir`:
   ```bash
   git add .
   git commit -m "Update Qasir v1.3.3"
   git push
   ```
5. Tunggu 1–2 menit. Di HP/laptop kasir, tutup aplikasi lalu buka lagi — versi baru otomatis terpasang (versi sudah dinaikkan ke `qasir-v1.3.3` di `sw.js`).

> ⚠️ **Update ke v1.3 wajib mengganti `Kode.gs` juga** (ada fitur server baru untuk Jual Online). Setelah *New version* di-deploy, permintaan pertama otomatis menambah sheet **PesananOnline**, kolom **kanal** di sheet Promo, dan folder Drive **Toko Online** — data lama tidak berubah. Jangan jalankan `setupAppEnvironment` lagi.

> 🔁 **Sudah memasang v1.3? Update ke v1.3.1:** ganti isi folder repo dengan isi ZIP baru (tetap pakai `js/config.js` lama), lalu `git add . && git commit -m "Update Qasir v1.3.3" && git push`. Ganti juga `Kode.gs` → *Deploy → Manage deployments → ✏️ → Version: New version → Deploy* agar pengecekan status toko lebih hemat kuota (tanpa ini pun tetap berjalan, hanya lebih boros).

**Yang baru di v1.3.3:**
- Perbaikan scan barcode kamera: di perangkat yang pemindai bawaannya tidak mendukung barcode toko, Qasir otomatis memakai pemindai cadangan sehingga barcode tetap bisa dibaca.

**Yang baru di v1.3.2:**
- Branding umum untuk **UMKM makanan & minuman** (warung makan, kedai kopi & minuman, toko kue, jajanan & snack, katering) — teks deskripsi aplikasi & contoh isian diperbarui.
- Contoh menu bawaan untuk pemasangan **baru**: Nasi Ayam Geprek, Nasi Goreng Spesial, Pisang Goreng Keju, Puding Coklat, Kopi Susu Aren, Americano, Es Teh Tarik, Es Coklat, Cireng (toko contoh: *Kedai Rasa Nusantara*). Toko yang sudah terpasang **tidak berubah** — data Anda tetap.
- Update cukup frontend (ZIP). `Kode.gs` hanya berisi perubahan contoh menu untuk pemasangan baru, jadi boleh tidak diganti.

**Yang baru di v1.3.1:**
- Saklar **Jual Online** langsung tersimpan — toko online seketika **terbuka/tertutup** tanpa menekan Simpan. Tab toko di perangkat yang sama berubah saat itu juga; HP pelanggan berubah otomatis ±10 detik tanpa muat ulang. Begitu juga saat **Buka/Tutup Toko**.
- **QR Meja**: atur mulai nomor & jumlah QR, pilih ukuran (1/2/4/6/9 per A4), lihat **pratinjau**, lalu **Unduh PDF**, **Unduh PNG**, atau **Cetak**.
- **Urutan menu & produk** dan **banner** diatur dengan **drag & drop** (tahan ikon ⋮⋮ lalu geser; di laptop juga bisa pakai tombol panah ↑↓).

**Yang baru di v1.3 — Jual Online:**
- Toko online untuk pelanggan di alamat `https://USERNAME.github.io/qasir/toko.html` (tanpa login, satu situs dengan aplikasi kasir).
- Pelanggan bisa **Ambil di toko**, **Diantar** (ongkir gratis / tarif tetap / konfirmasi WA), atau **Makan di tempat** lewat **QR meja**.
- Bayar **di kasir/saat diterima** atau **Transfer/QRIS + unggah bukti**.
- Pesanan masuk ke menu **Pesanan Online** di Qasir dengan bunyi "ting-tung", badge jumlah, lalu kasir **Terima → Selesai & Dibayar** (atau Tolak/Batalkan). Stok berkurang saat **Terima**; batal → stok kembali.
- Admin mengatur tampilan: banner, pengumuman, urutan kategori & produk, sembunyikan produk, Best Seller, label "Baru"/info varian baru, dan promo khusus online.
- Detail lengkap: [Bagian H — Jual Online](#bagian-h--jual-online).

**Yang baru di v1.2:**
- **Barcode cetak A4/thermal lebih mudah discan:** lebar garis dipatok pas dengan titik printer (tidak lagi ditarik memenuhi label), kode lebih pendek ±15–30% (angka dipadatkan), ruang kosong kiri-kanan cukup, garis lebih tinggi bila nama/harga disembunyikan. Pemindai kamera memakai resolusi lebih tinggi, fokus otomatis, dan tombol senter (jika HP mendukung).
- **Bunyi scan satu kali "beep"** seperti scanner minimarket; gagal = satu dengung rendah.
- **Prompt Menu AI** (menu Lainnya → Prompt Menu AI, atau tombol *Prompt AI* di Daftar Menu): prompt desain daftar menu lengkap dengan kategori & harga, foto produk bernomor (Foto 1, 2, 3…) yang bisa disalin/diunduh, 5 gaya, 2 tata letak, 6 ukuran, ID/EN.
- **Penjelasan Estimasi Penjualan bisa disembunyikan** (diingat di perangkat).
- Tulisan aplikasi kini cukup **"Qasir"**.
- **Tampilan kasir Ringkas (tanpa gambar) jadi bawaan** — tombol 🖼 di samping Scan untuk menampilkan foto; pilihan diingat per perangkat.

> **Tips cetak label barcode:** di jendela cetak pilih **Skala 100% / Ukuran sebenarnya** (jangan "Sesuaikan halaman"/"Fit to page"), Margin **Tidak ada**, kualitas **Normal/Tinggi**. Barcode lama yang sudah tercetak tetap terbaca — isinya sama, hanya bentuk garisnya yang diperbaiki.

**Yang baru di v1.1:**
- Scan barcode berbunyi "bip" + getar + animasi hijau (berhasil) / merah (tidak terdaftar), plus keterangan produk & isi keranjang. Alat scan USB/Bluetooth juga didukung lewat kolom cari.
- Logo otomatis 1:1 dengan pilihan **Penuhi kotak** atau **Logo utuh**.
- Transaksi yang dibatalkan bisa **dihapus permanen** oleh pemilik (perbaikan galat "transaksi tidak ditemukan").
- Struk, Daftar Menu & Laporan → **Gambar/PDF langsung tersimpan** ke folder Unduhan, sama persis dengan tampilan aplikasi (termasuk logo & foto).
- Kalkulator HPP: opsi **Harga manual** dengan margin & laba langsung terlihat.
- Prompt Poster: **Salin** logo & foto produk langsung (tempel di Gemini/ChatGPT), ukuran **Landscape 16:9** & **A4 Landscape**.
- Form produk: margin berubah langsung saat harga diketik.
- Estimasi Penjualan: penjelasan lengkap, mode isi **per hari**, hitungan langsung, dan **Isi dari penjualan nyata**.
- Kamera di laptop membuka **webcam** (bukan file manager); di HP tetap kamera HP.

---

## BAGIAN H — Jual Online

### H1. Mengaktifkan toko online
1. Login sebagai **Pemilik** → **Lainnya → Jual Online** (atau menu samping *Promosi → Jual Online*).
2. Nyalakan saklar **Jual Online** — langsung tersimpan, toko online seketika terbuka (matikan saklar = toko online seketika tertutup). Lalu atur bagian-bagian berikut (ketuk judul untuk membuka):
   - **Banner & pengumuman** — unggah gambar banner (otomatis dipotong 2:1), judul, keterangan, dan bisa ditautkan ke produk. Pengumuman tampil di bagian atas (mis. *"Varian baru Matcha Latte sudah tersedia!"*).
   - **Urutan menu & produk tampil** — tahan ikon titik-titik ⋮⋮ lalu **geser** kategori ke atas/bawah. Ketuk nama kategori untuk membuka produknya, lalu geser produk dengan cara yang sama. Saklar di tiap produk = tampil/sembunyi di toko online saja. Banner juga bisa digeser untuk mengatur urutannya.
   - **Best seller & label baru** — pilih produk unggulan (atau *Isi dari 5 terlaris 30 hari*), dan beri label **Baru / Varian baru: …** pada produk tertentu.
   - **Diskon & promo online** — kelola di menu **Promo**; di form promo pilih **Berlaku di: Kasir & Online / Kasir saja / Online saja**. Diskon tampil otomatis sebagai harga coret & label di toko online.
   - **Cara pesan & ongkir** — Ambil di toko, Diantar (ongkir), Makan di tempat (QR meja), minimal pesanan, jam buka, dan opsi *Terima pesanan saat toko tutup* (pre-order).
   - **Pembayaran** — Bayar di tempat dan/atau Transfer/QRIS (unggah gambar QRIS & tulis info rekening).
3. Tekan **Simpan Perubahan** (tombol bawah bertanda titik kuning bila ada perubahan belum disimpan; berubah jadi *Tersimpan* setelah berhasil). Tombol **Lihat Toko** membuka tampilan pelanggan — bila ada perubahan belum disimpan, otomatis disimpan dulu.
4. Tambahkan **deskripsi singkat** di form Produk agar tampil di toko online (opsional).

### H2. Membagikan ke pelanggan
- **Salin link** atau **Bagikan** ke WhatsApp/status/Instagram.
- **QR Toko** → unduh PNG untuk ditempel di etalase/kasir/brosur.
- **QR Meja** → muncul jendela pengaturan:
  1. **Mulai dari meja no.** (mis. 1, atau 11 bila mencetak tambahan) dan **Jumlah QR dicetak** (tombol − / + atau pilihan cepat 5/10/15/20/30 meja, maks. 100).
  2. **Ukuran QR per kertas A4**: 1 (stand meja), 2 besar, 4, 6, atau 9 kecil. **Teks di bawah nomor meja** bisa diubah.
  3. Periksa **pratinjau** halaman, lalu pilih **PDF** (semua halaman dalam satu file), **PNG** (gambar per halaman, 200 dpi), atau **Cetak**.
  Saat discan, nomor meja otomatis terisi dan pelanggan langsung memesan *makan di tempat*. Pastikan *Makan di tempat (QR meja)* sudah aktif di bagian *Cara pesan*.

### H3. Alur pesanan di kasir
1. Pesanan baru muncul di tab **Pesanan** (bunyi "ting-tung" + badge merah). Toko harus **dibuka** agar pesanan bisa diterima.
2. **Terima** → transaksi otomatis tercatat (nomor nota = kode pesanan, contoh `ON-1018-001`) dan **stok berkurang**. Atau **Tolak** dengan alasan (pelanggan langsung melihat alasannya).
3. Siapkan pesanan → **Selesai & Dibayar** → pilih metode yang benar-benar dipakai (Tunai/QRIS/Transfer) agar laporan kas & tutup toko akurat.
4. **Batal** (setelah diterima) → transaksi dibatalkan & stok dikembalikan.
5. **Cetak** struk, **Chat** pelanggan via WhatsApp, dan **Lihat bukti bayar** untuk pesanan transfer.

Pelanggan melihat status pesanannya otomatis (Menunggu konfirmasi → Diterima → Selesai / Ditolak) dan bisa membuka lagi lewat ikon 🧾 *Pesanan saya*.

> **Catatan:** pesanan online butuh internet (di sisi pelanggan dan kasir). Notifikasi pesanan baru dicek ±15 detik sekali selama aplikasi kasir terbuka. Halaman toko pelanggan memeriksa status toko ±10 detik sekali selama dibuka (±45 detik bila tidak disentuh 10 menit) dan langsung memeriksa saat halaman dibuka kembali. Penjualan online masuk ke laporan, dashboard, dan laporan tutup toko seperti transaksi biasa (sumber: ONLINE). Ongkos kirim tercatat sebagai baris "Ongkos kirim".
