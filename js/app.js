/* ============================================================================
   QASIR — app.js · Shell (sidebar desktop + bottom nav HP), navigasi, start-up
   Start-up instan: data terakhir dari IndexedDB langsung tampil (0 jaringan),
   lalu disegarkan di latar (SWR) — pengguna tidak pernah menunggu server.
   ========================================================================== */
'use strict';

const NAV_KASIR = [['kasir', 'Kasir', 'cart'], ['transaksi', 'Riwayat', 'receipt'], ['stok', 'Stok', 'package'], ['utang', 'Utang', 'notebook'], ['akun', 'Akun', 'user', true]];
const NAV_OWNER = [['kasir', 'Kasir', 'cart'], ['transaksi', 'Riwayat', 'receipt'], ['dashboard', 'Dashboard', 'dashboard'], ['stok', 'Stok', 'package'], ['lainnya', 'Lainnya', 'grid', true]];
const SIDE_OWNER = [
  ['OPERASIONAL', [['kasir', 'Kasir', 'cart'], ['transaksi', 'Riwayat Transaksi', 'receipt'], ['stok', 'Stok', 'package'], ['utang', 'Utang Pelanggan', 'notebook']]],
  ['BISNIS', [['dashboard', 'Dashboard', 'dashboard'], ['laporan', 'Laporan', 'file'], ['produk', 'Produk', 'layers'], ['hpp', 'Kalkulator HPP', 'calculator'], ['bahan', 'Bahan & Biaya', 'coffee'], ['promo', 'Promo & Diskon', 'tag']]],
  ['PROMOSI', [['menu', 'Daftar Menu', 'utensils'], ['poster', 'Prompt Poster', 'sparkles'], ['label', 'Cetak Barcode', 'barcode']]],
  ['PENGATURAN', [['karyawan', 'Karyawan', 'users'], ['pengaturan', 'Pengaturan Toko', 'settings'], ['tinjau', 'Perlu Ditinjau', 'inbox']]]
];
/** Halaman turunan → tab induk di bottom nav. */
const NAV_PARENT = { bayar: 'kasir', sukses: 'kasir', 'produk-form': 'produk', hpp: 'produk' };
const OWNER_SUB = ['produk', 'hpp', 'bahan', 'promo', 'laporan', 'menu', 'poster', 'label', 'karyawan', 'pengaturan', 'tinjau', 'utang', 'akun', 'produk-form'];

const Nav = {
  update(name) {
    const def = Pages[name] || {};
    const bn = $('#bnav'); if (bn) bn.hidden = def.nav === false;
    let tab = NAV_PARENT[name] || name;
    if (App.isOwner && OWNER_SUB.indexOf(name) > -1 && name !== 'utang') tab = 'lainnya';
    if (App.isOwner && name === 'utang') tab = 'lainnya';
    $$('#bnav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    const sideTab = NAV_PARENT[name] || name;
    $$('#side a[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === sideTab));
  }
};

const Shell = {
  started: false,
  mountFrame() {
    $('#app').innerHTML = '<div class="shell"><aside class="side" id="side" aria-label="Menu utama"></aside><main class="main" id="main"></main></div><nav class="bnav" id="bnav" aria-label="Navigasi"></nav>';
  },
  renderNav() {
    const side = $('#side'), bn = $('#bnav'); if (!side || !bn || !App.session) return;
    const st = App.settings, u = App.user, owner = App.isOwner;
    const badge = '<span class="badge-count js-pending-count" hidden></span>';
    bn.innerHTML = (owner ? NAV_OWNER : NAV_KASIR).map((n) => '<a href="#/' + n[0] + '" data-tab="' + n[0] + '">' + icon(n[2]) + '<span>' + n[1] + '</span>' + (n[3] ? badge : '') + '</a>').join('');
    const link = (n) => '<a href="#/' + n[0] + '" data-tab="' + n[0] + '">' + icon(n[2], 'sm') + n[1] + '</a>';
    side.innerHTML = '<div class="brand">' + logoHtml() + '<div class="grow" style="min-width:0"><div class="t ellipsis">' + esc(st.nama_toko || 'Qasir') + '</div><div class="s">' + (owner ? 'Pemilik' : 'Kasir') + (App.session.device && App.session.device.kode ? ' · ' + esc(App.session.device.kode) : '') + '</div></div></div>' +
      (owner ? SIDE_OWNER.map((g) => '<div class="grp">' + g[0] + '</div>' + g[1].map(link).join('')).join('') : NAV_KASIR.slice(0, 4).map(link).join('')) +
      '<div class="foot"><a href="#/akun" data-tab="akun"><span class="thumb" style="width:32px;height:32px;border-radius:10px;font-size:12px">' + esc(initials(u.nama)) + '</span><span class="grow ellipsis" style="min-width:0">' + esc(u.nama) + '</span>' + badge + '</a><div style="padding:8px 4px 0">' + syncPill() + '</div></div>';
    if (App.current) Nav.update(App.current);
    updateSyncUI();
  },
  loading(msg) { $('#main').innerHTML = '<div class="empty" style="min-height:70dvh;justify-content:center"><div class="spinner"></div><div class="t">' + esc(msg) + '</div></div>'; },
  async start() {
    this.mountFrame();
    Cart.load();
    let has = App.boot && App.boot.settings ? true : await Boot.loadLocal();
    warmUpServer();
    if (!has) {
      this.loading('Menyiapkan data toko…');
      const r = await Boot.refresh(true);
      has = !!App.boot;
      if (!has) {
        $('#main').innerHTML = '<div class="wrap" style="padding-top:20vh">' + retryBox((r && r.error) || 'Data toko belum tersedia di perangkat ini. Sambungkan internet lalu coba lagi.', 'boot-retry') + '<div style="text-align:center"><button class="link-btn" data-act="boot-logout" type="button">Keluar</button></div></div>';
        $('#main').onclick = (e) => { const a = e.target.closest('[data-act]'); if (!a) return; if (a.dataset.act === 'boot-retry') this.start(); else Auth.logout(true); };
        return;
      }
      $('#main').innerHTML = ''; $('#main').onclick = null;
    }
    applyTheme(App.settings);
    this.renderNav();
    if (!this.started) {
      this.started = true;
      Sync.start();
      on('boot', () => { this.renderNav(); });
    }
    const h = location.hash.replace(/^#\/?/, '');
    if (!h || h === 'login' || !Pages[h.split('/')[0]]) replaceRoute(homePage()); else route();
    // Segarkan data & status toko di latar — UI sudah tampil.
    setTimeout(() => { Boot.refresh(); Sync.heartbeat(true); }, 250);
    checkWarnings();
    prewarmPages();
  }
};

/* ------------------------------------------------------------ Start-up */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (_sheets.length) { _sheets[_sheets.length - 1].close(); return; }
  const ov = $('.overlay.center'); if (ov) ov.click();
});
// Prefetch template halaman utama saat idle → perpindahan menu pertama tetap instan.
function prewarmPages() {
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 600));
  const names = App.isOwner ? ['transaksi', 'stok', 'dashboard', 'lainnya', 'kasir'] : ['transaksi', 'stok', 'utang', 'akun', 'kasir'];
  idle(() => {
    const main = $('#main'); if (!main) return;
    names.forEach((n) => {
      const def = Pages[n]; if (!def || $('.page[data-page="' + n + '"]', main) || (def.role && def.role !== App.role)) return;
      const el = document.createElement('section');
      el.className = 'page' + (def.nav ? '' : ' no-nav') + (def.foot ? ' has-foot' : ''); el.dataset.page = n; el.hidden = true;
      el.innerHTML = def.template(); main.appendChild(el);
      el.addEventListener('click', (e) => {
        const a = e.target.closest('[data-act]'); if (!a || !el.contains(a)) return;
        const act = a.dataset.act;
        if (act === 'back') { e.preventDefault(); back(def.backTo); return; }
        if (act === 'sync-pill') return;
        if (def.actions && def.actions[act]) { e.preventDefault(); def.actions[act].call(def, a, e, el); }
      });
      def.init && def.init(el);
    });
  });
}

function init() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  const brand = Store.get('brand', null); if (brand) applyTheme(brand);
  const s = Auth.load();
  if (s && !s.expired) {
    App.session = s;
    Shell.start();
    return;
  }
  if (s && s.expired) {
    Store.del('session'); Store.ses.del('session');
    setTimeout(() => toast('Sesi 8 jam berakhir. Silakan masuk lagi.', 'warn', 4000), 300);
  }
  if (location.hash !== '#/login') replaceRoute('login'); else route();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
