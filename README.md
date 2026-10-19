# Qasir v1.4.0

Aplikasi kasir (POS) untuk UMKM makanan & minuman — warung makan, kedai kopi & minuman, toko kue, jajanan & snack, katering. Frontend statis (GitHub Pages) + backend Google Apps Script sebagai REST API, data di Google Sheets & Google Drive.

**Panduan pemasangan lengkap:** lihat [`PANDUAN-INSTALASI.md`](PANDUAN-INSTALASI.md).

## Fitur
- **Kasir** cepat: grid produk + kategori, cari, scan barcode (bunyi bip + animasi, jumlah per scan; alat scan USB/Bluetooth, pengali `3*`), varian & topping, catatan item, diskon/promo otomatis, keranjang tersimpan.
- **Pembayaran** Tunai (kembalian otomatis), QRIS & Transfer (foto bukti dikompres ≤250 KB), Utang (pelanggan + daftar utang + pelunasan & tagih WA).
- **Struk** printer thermal Bluetooth 58/80 mm, simpan Gambar/PDF langsung ke perangkat, kirim WhatsApp.
- **Offline 1–8 jam**: transaksi, stok masuk, pembatalan & pelunasan tersimpan di perangkat lalu tersinkron otomatis; nomor nota unik per perangkat.
- **Dashboard** omzet, laba, terlaris, grafik penjualan, metode bayar, status perangkat, stok menipis, utang jatuh tempo, audit pembatalan.
- **Laporan** laba rugi, per produk/kategori/kasir/metode/hari, ekspor Excel & PDF.
- **Kalkulator HPP** dari resep + kemasan + alokasi biaya operasional, 3 rekomendasi harga, food cost, mode simulasi.
- **Produk, Bahan & Biaya, Promo, Karyawan & Perangkat, Pengaturan brand** (logo, warna tema, struk, aturan bisnis).
- **Daftar Menu** (gambar/PDF/teks WA), **Prompt Menu AI** (menu dengan foto produk), **Prompt Poster Promo** (ID/EN untuk AI gambar), **Cetak Label Barcode** (A4 3×8 / thermal).
- **Jual Online** (`toko.html`): toko online pelanggan via link & QR meja — ambil/antar/makan di tempat, bayar di tempat atau transfer/QRIS + bukti; banner, pengumuman, urutan menu, best seller, label baru, promo khusus online; pesanan masuk ke **Pesanan Online** (bunyi + badge), stok berkurang saat diterima. Saklar buka/tutup toko online berlaku seketika, QR meja dengan pratinjau + unduh PDF/PNG/cetak, urutan menu & banner dengan drag & drop.
- **Tutup Toko** → laporan email + PDF otomatis ke pemilik.
- **Kode Toko** (v1.4.0): satu situs untuk banyak klien. Tiap klien punya server & Google Sheet sendiri, paket **Kasir** atau **Kasir + Jual Online**, dikelola lewat `kelola.html` + `toko.json`.

## Struktur
```
index.html            Kerangka aplikasi kasir (SPA)
toko.html             Toko online untuk pelanggan (publik)
kelola.html           Alat penjual: buat/ubah Kode Toko (hasil ditempel ke toko.json)
toko.json             Daftar Kode Toko (terenkripsi) — ubah lewat kelola.html
sw.js                 Service worker: buka instan & offline
manifest.webmanifest  Pasang sebagai aplikasi di HP
css/style.css         Desain "Warm Artisanal POS"
js/config.js          Nomor WA admin, repo GitHub, alamat toko lama (opsional)
js/tenant.js          Kode Toko → alamat server + paket (dimuat sebelum core.js)
js/core.js            API, sesi, IndexedDB, antrean sinkron, router, komponen UI
js/export.js          Simpan gambar/PDF, cache gambar, salin gambar, kamera webcam
js/app.js             Shell, navigasi, start-up
js/p-kasir.js         Login, kasir, varian, pembayaran, sukses
js/p-ops.js           Riwayat, stok, utang, akun, menu lainnya
js/p-owner.js         Dashboard, laporan, produk, HPP, bahan, promo, karyawan, pengaturan
js/p-promo.js         Daftar menu, prompt poster, label barcode
js/p-online.js        Jual Online: pengaturan toko online & Pesanan Online
js/toko.js            Toko online pelanggan (+ css/toko.css)
js/hpp.js barcode.js printer.js icons.js
```

## Kenapa terasa instan
- Semua halaman tetap hidup di memori → pindah menu ± 20–40 ms, tanpa memuat ulang.
- Data toko disimpan di perangkat dan tampil seketika, lalu diperbarui diam-diam di latar (stale-while-revalidate).
- Simpan transaksi = tulis ke perangkat (instan), kirim ke server di latar dengan pengaman anti-dobel.
- Perubahan data master tampil langsung (optimistic) dan otomatis dibatalkan bila server menolak.

## Update
Naikkan `VERSION` di `sw.js` setiap kali mengubah file frontend, lalu `git add . && git commit -m "update" && git push`.
