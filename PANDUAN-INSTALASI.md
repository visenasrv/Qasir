# 📋 Panduan Instalasi — Qasir (Aplikasi Kasir UMKM)

Qasir terdiri dari dua bagian:

| Bagian | Isi | Dipasang di |
|---|---|---|
| **Backend** | `Kode.gs` + `appsscript.json` | Google Apps Script (akun Google Anda) |
| **Frontend** | Isi ZIP `qasir.zip` (`index.html`, `css/`, `js/`, `icons/`, `sw.js`, …) | GitHub Pages (gratis) |

Urutan wajib: **Backend dulu → dapat URL `/exec` → isi ke frontend → upload frontend ke GitHub Pages.**

Waktu yang dibutuhkan: ± 30–45 menit untuk pertama kali.

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
4. Cek Google Drive Anda — harus ada folder **📁 Qasir - Toko Roti Visena** berisi spreadsheet **🗃️ Qasir DB** dan folder `Logo`, `Foto Produk`, `Bukti Bayar`, `Laporan`.

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
5. **Hapus/ubah data contoh:** menu **Produk**, **Bahan & Biaya**, **Promo** sudah berisi contoh (roti, donat, kopi). Ubah sesuai menu toko Anda — HPP & rekomendasi harga otomatis menyesuaikan.
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

---

## Akun Bawaan (ganti segera!)

| Peran | Username | PIN |
|---|---|---|
| Pemilik (Owner) | `owner` | `123456` |
| Kasir | `kasir1` | `111111` |
