/* ============================================================
   KONFIGURASI QASIR
   Sejak v1.4.0 alamat server tiap toko diambil dari KODE TOKO
   (file toko.json, diatur lewat kelola.html). Berkas ini jarang
   perlu diubah.
   ============================================================ */
window.QASIR_CONFIG = {
  // Opsional: alamat /exec toko LAMA (sebelum ada Kode Toko).
  // Biarkan terisi bila HP Anda sudah memakai Qasir sebelum v1.4.0,
  // agar data lama di HP tetap terbaca & tautan toko lama tetap jalan.
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwL3iniF6yaeTK7rpAKqYyCd-818VLVbHRK4gYfnTM5BUVvTBYZ_CR-mpC9-a83buOp/exec',

  // Nomor WhatsApp admin/penjual Qasir (tombol "Hubungi admin" & "Upgrade").
  SELLER_WA: '082213712168',

  // Repositori GitHub tempat toko.json berada (dipakai tombol di kelola.html).
  REPO: 'visenasrv/Qasir',

  // true = satu situs untuk banyak toko (Kode Toko). false = mode lama 1 situs 1 toko.
  KODE_TOKO: true
};
