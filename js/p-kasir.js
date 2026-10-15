/* ============================================================================
   QASIR — p-kasir.js · Login, Keranjang, Kasir, Varian, Pembayaran, Sukses
   Prinsip kecepatan: semua aksi kasir lokal (0 ms), simpan → antrean → server
   ========================================================================== */
'use strict';

/* ================================================================= LOGIN */
Pages.login = {
  mount() {
    const brand = Store.get('brand', {});
    applyTheme({ warna_primer: brand.warna_primer || '#F26B1D' });
    const last = Store.get('lastUser', '');
    const online = navigator.onLine;
    $('#app').innerHTML = '<div class="login"><div class="box">' +
      '<div class="row" style="justify-content:flex-end">' + (online ? '<span class="pill ok"><span class="dot"></span>Online</span>' : '<span class="pill warn"><span class="dot"></span>Offline</span>') + '</div>' +
      '<div class="brand">' + (brand.logo_url ? '<div class="logo lg" style="margin:0 auto"><img src="' + esc(brand.logo_url) + '" alt="" onerror="this.remove()"></div>' : '<div class="logo lg" style="margin:0 auto">' + esc((brand.nama_toko || 'Q').charAt(0)) + '</div>') +
      '<h2>' + esc(brand.nama_toko || 'Qasir') + '</h2><div class="muted">Aplikasi Kasir Qasir</div></div>' +
      '<form class="card pad" id="loginForm" autocomplete="off">' +
      '<label class="field"><span class="lbl">USERNAME</span><div class="input-wrap">' + icon('user', 'sm') + '<input class="input" id="lgUser" placeholder="contoh: kasir1" autocapitalize="none" autocomplete="username" value="' + esc(last) + '"></div></label>' +
      '<div class="field"><span class="lbl">PIN <button type="button" class="icon-btn" id="lgEye" style="width:32px;height:32px" aria-label="Lihat PIN">' + icon('eye', 'sm') + '</button></span>' +
      '<div class="pin-boxes" id="pinBoxes"><span></span><span></span><span></span><span></span><span></span><span></span><input id="lgPin" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" aria-label="PIN 6 digit"></div></div>' +
      '<label class="check" style="margin-top:14px"><input type="checkbox" id="lgKeep" checked>Tetap masuk selama 8 jam</label>' +
      '<div class="err" id="lgErr" hidden></div>' +
      '<button class="btn primary block lg" id="lgBtn" type="submit" style="margin-top:16px">Masuk ' + icon('arrow-right', 'sm') + '</button>' +
      '<div class="muted" style="text-align:center;font-size:13.5px;margin-top:14px">Lupa PIN? Hubungi pemilik toko</div></form>' +
      '<div class="banner warn" style="margin-top:16px">' + icon('wifi-off', 'sm') + '<div>Bisa login tanpa internet jika perangkat ini pernah dipakai login.</div></div>' +
      '<div class="faint" style="text-align:center;font-size:12px;margin-top:18px">Qasir v' + esc(CFG.APP_VERSION || '1.0') + '</div></div></div>';
    const pin = $('#lgPin'), boxes = $$('#pinBoxes span');
    let show = false;
    const paint = () => {
      const v = pin.value.replace(/\D/g, '').slice(0, 6); pin.value = v;
      boxes.forEach((b, i) => { b.className = (i < v.length ? 'fill' : '') + (show && i < v.length ? ' show' : '') + (i === Math.min(v.length, 5) && document.activeElement === pin ? ' cur' : ''); b.textContent = show && i < v.length ? v[i] : ''; });
      if (v.length === 6 && $('#lgUser').value.trim()) $('#loginForm').requestSubmit();
    };
    pin.addEventListener('input', paint); pin.addEventListener('focus', paint); pin.addEventListener('blur', paint);
    $('#lgEye').onclick = () => { show = !show; $('#lgEye').innerHTML = icon(show ? 'eye-off' : 'eye', 'sm'); paint(); };
    (last ? pin : $('#lgUser')).focus();
    let busyLogin = false;
    $('#loginForm').onsubmit = async (e) => {
      e.preventDefault();
      if (busyLogin) return;
      const u = $('#lgUser').value.trim().toLowerCase(), p = pin.value, keep = $('#lgKeep').checked;
      const err = $('#lgErr');
      if (!u || p.length !== 6) { err.hidden = false; err.textContent = 'Isi username dan PIN 6 digit.'; return; }
      busyLogin = true; busy($('#lgBtn'), true); err.hidden = true;
      let r;
      if (navigator.onLine) {
        r = await Auth.loginOnline(u, p, keep);
        if (!r.ok && r.network) { const off = await Auth.loginOffline(u, p, keep); if (off.ok) r = off; }
      } else r = await Auth.loginOffline(u, p, keep);
      busyLogin = false; busy($('#lgBtn'), false);
      if (!r.ok) { err.hidden = false; err.textContent = r.error || 'Gagal masuk.'; pin.value = ''; paint(); pin.focus(); return; }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      if (r.offline) toast('Masuk mode offline. Data akan disinkron saat online.', 'warn', 4000);
      Shell.start();
    };
  }
};

/* ============================================================== KERANJANG */
const Cart = {
  lines: [], manual: null,
  load() { const c = Store.get(userKey('cart'), null); this.lines = (c && c.lines) || []; this.manual = (c && c.manual) || null; },
  save() { Store.set(userKey('cart'), { lines: this.lines, manual: this.manual }); emit('cart'); },
  key(pid, vids, note) { return pid + '|' + (vids || []).slice().sort().join(',') + '|' + (note || '').trim().toLowerCase(); },
  add(p, variants, qty, note) {
    variants = variants || []; qty = qty || 1;
    const vids = variants.map((v) => v.varian_id);
    const k = this.key(p.produk_id, vids, note);
    const ex = this.lines.find((l) => l.key === k);
    if (p.tipe_stok === 'STOK_JADI') {
      const inCart = this.qtyOf(p.produk_id);
      if (inCart + qty > toNum(p.stok)) { toast('Stok ' + p.nama + ' tinggal ' + fmtNum(Math.max(0, p.stok)), 'warn'); if (inCart >= toNum(p.stok)) return false; qty = toNum(p.stok) - inCart; }
    }
    if (ex) ex.qty += qty;
    else this.lines.push({ key: k, produk_id: p.produk_id, nama: p.nama, kategori_id: p.kategori_id, harga_dasar: toNum(p.harga_jual), varian: variants.map((v) => ({ varian_id: v.varian_id, nama: v.nama, grup: v.grup, tambahan_harga: toNum(v.tambahan_harga) })), qty, catatan: (note || '').trim() });
    this.save(); return true;
  },
  setQty(k, q) {
    const l = this.lines.find((x) => x.key === k); if (!l) return;
    if (q > l.qty) { const p = Local.product(l.produk_id); if (p && p.tipe_stok === 'STOK_JADI' && this.qtyOf(l.produk_id) + (q - l.qty) > toNum(p.stok)) { toast('Stok tidak cukup', 'warn'); return; } }
    if (q <= 0) this.lines = this.lines.filter((x) => x.key !== k); else l.qty = q;
    this.save();
  },
  qtyOf(pid) { return this.lines.filter((l) => l.produk_id === pid).reduce((s, l) => s + l.qty, 0); },
  count() { return this.lines.reduce((s, l) => s + l.qty, 0); },
  clear(silent) { this.lines = []; this.manual = null; if (!silent) this.save(); else Store.del(userKey('cart')); },
  price(l) { return l.harga_dasar + l.varian.reduce((s, v) => s + v.tambahan_harga, 0); },
  varText(l) { return l.varian.map((v) => v.nama).join(', '); },
  /** Hitung subtotal, promo otomatis, diskon manual, total — real-time. */
  totals() {
    const boot = App.boot || {}, st = App.settings, now = Date.now();
    const promos = (boot.promos || []).filter((p) => p.status_aktif && (!p.mulai || new Date(p.mulai).getTime() <= now) && (!p.selesai || endOfDay(p.selesai).getTime() >= now));
    const subtotal = this.lines.reduce((s, l) => s + this.price(l) * l.qty, 0);
    const names = new Set();
    let itemDisc = 0;
    const lineDisc = {};
    this.lines.forEach((l) => {
      const gross = this.price(l) * l.qty;
      let best = 0, bestName = '';
      promos.forEach((p) => {
        if (subtotal < toNum(p.min_belanja)) return;
        const hit = (p.berlaku_untuk === 'PRODUK' && p.target_id === l.produk_id) || (p.berlaku_untuk === 'KATEGORI' && p.target_id === l.kategori_id);
        if (!hit) return;
        const d = p.tipe === 'PERSEN' ? Math.round(gross * toNum(p.nilai) / 100) : Math.min(gross, toNum(p.nilai) * l.qty);
        if (d > best) { best = d; bestName = p.nama; }
      });
      lineDisc[l.key] = best; itemDisc += best; if (best) names.add(bestName);
    });
    let notaDisc = 0, notaName = '';
    const base = subtotal - itemDisc;
    promos.filter((p) => p.berlaku_untuk === 'SEMUA' && subtotal >= toNum(p.min_belanja)).forEach((p) => {
      const d = p.tipe === 'PERSEN' ? Math.round(base * toNum(p.nilai) / 100) : Math.min(base, toNum(p.nilai));
      if (d > notaDisc) { notaDisc = d; notaName = p.nama; }
    });
    if (notaName) names.add(notaName);
    let manual = 0, capped = false;
    if (this.manual && this.manual.value > 0) {
      const b2 = Math.max(0, base - notaDisc);
      manual = this.manual.type === 'PERSEN' ? Math.round(b2 * Math.min(100, this.manual.value) / 100) : Math.min(b2, this.manual.value);
      if (!App.isOwner) { const cap = Math.round(subtotal * (toNum(st.batas_diskon_kasir) || 0) / 100); if (manual > cap) { manual = cap; capped = true; } }
      if (manual) names.add('Diskon manual' + (this.manual.type === 'PERSEN' ? ' ' + this.manual.value + '%' : ''));
    }
    const diskon = itemDisc + notaDisc + manual;
    return { subtotal, itemDisc, notaDisc, notaName, manual, capped, lineDisc, diskon, total: Math.max(0, subtotal - diskon), ket: Array.from(names).join(' + '), names: Array.from(names) };
  }
};

function productHasOptions(pid) { return (App.boot.variants || []).some((v) => v.produk_id === pid); }
function isHabis(p) { return p.tipe_stok === 'STOK_JADI' && toNum(p.stok) <= 0; }

/* ============================================================= HALAMAN KASIR */
page('kasir', {
  keepScroll: true,
  state: { cat: 'all', q: '' },
  template() {
    return '<header class="topbar"><div class="in">' + '<span class="js-logo">' + logoHtml() + '</span>' +
      '<div class="grow"><h1 class="ellipsis js-store-name"></h1><div class="sub ellipsis">' + icon('user', 'xs') + ' ' + (App.isOwner ? 'Owner' : 'Kasir') + ': <b>' + esc(App.user.nama) + '</b></div></div>' + syncPill() + '</div></header>' +
      '<div class="js-store-banner"></div>' +
      '<div class="kasir-layout"><div class="kasir-main">' +
      '<div class="searchbar"><div class="input-wrap">' + icon('search', 'sm') + '<input class="input js-q" type="search" placeholder="Cari produk..." autocomplete="off"></div>' +
      '<button class="scan-btn" data-act="scan" type="button">' + icon('scan-barcode', 'sm') + 'Scan</button></div>' +
      '<div class="cat-row"><div class="chips js-cats"></div></div>' +
      '<div class="pgrid js-grid"></div></div>' +
      '<aside class="cart-panel js-cart-panel"></aside></div>' +
      '<div class="cartbar js-cartbar" hidden></div>';
  },
  init(el) {
    const q = $('.js-q', el);
    q.addEventListener('input', debounce(() => { this.state.q = q.value.trim().toLowerCase(); this.renderGrid(el); }, 90));
    // Alat scan barcode USB/Bluetooth (mengetik kode + Enter) → langsung masuk keranjang dengan bunyi bip
    q.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const p = findByBarcode(q.value); if (!p) return;
      e.preventDefault();
      const r = addProductFlow(p, true);
      if (r === 'added') { Scanner.tone(true); flashCard(el, p.produk_id); toast(p.nama + ' ditambahkan', 'ok', 1100); }
      else if (r !== 'variant') { Scanner.tone(false); toast(p.nama + (r === 'habis' ? ' habis' : ' — stok tidak cukup'), 'warn'); }
      q.value = ''; this.state.q = ''; this.renderGrid(el);
    });
    let buf = '', lastKey = 0;
    document.addEventListener('keydown', (e) => {
      if (App.current !== 'kasir' || _sheets.length || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
      const now = Date.now();
      if (e.key === 'Enter') { if (buf.length >= 4 && now - lastKey < 80) { q.value = buf; q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); } buf = ''; return; }
      if (e.key.length === 1) { buf = now - lastKey > 80 ? e.key : buf + e.key; lastKey = now; }
    });
    on('cart', () => { if (App.current === 'kasir') { this.refreshCards(el); this.renderCart(el); } });
    on('boot', () => { if (App.current === 'kasir') this.show(el); });
    on('store', () => this.renderBanner(el));
  },
  show(el) {
    $('.js-store-name', el).textContent = App.settings.nama_toko || 'Qasir';
    $('.js-logo', el).innerHTML = logoHtml();
    this.renderBanner(el); this.renderCats(el); this.renderGrid(el); this.renderCart(el);
  },
  renderBanner(el) {
    const b = $('.js-store-banner', el); if (!b) return;
    if (App.store) { b.innerHTML = ''; return; }
    b.innerHTML = '<div class="store-banner">' + icon('lock', 'sm') + '<div class="grow"><b>Toko belum dibuka.</b> ' + (App.isOwner ? 'Buka toko untuk mulai mencatat penjualan.' : 'Minta pemilik membuka toko dulu agar transaksi bisa disimpan.') + '</div>' +
      (App.isOwner ? '<button class="btn primary sm" data-act="open-store" type="button">Buka Toko</button>' : '') + '</div>';
  },
  renderCats(el) {
    const cats = (App.boot.categories || []);
    $('.js-cats', el).innerHTML = '<button class="chip ' + (this.state.cat === 'all' ? 'on' : '') + '" data-act="cat" data-id="all" type="button">Semua</button>' +
      cats.map((c) => '<button class="chip ' + (this.state.cat === c.kategori_id ? 'on' : '') + '" data-act="cat" data-id="' + esc(c.kategori_id) + '" type="button">' + esc(c.nama) + '</button>').join('');
  },
  list() {
    const q = this.state.q, cat = this.state.cat;
    return (App.boot.products || []).filter((p) => (cat === 'all' || p.kategori_id === cat) && (!q || p.nama.toLowerCase().indexOf(q) > -1 || String(p.kode_barcode).toLowerCase() === q));
  },
  cardFoot(p) {
    const qty = Cart.qtyOf(p.produk_id), opt = productHasOptions(p.produk_id);
    const stockTxt = p.tipe_stok === 'STOK_JADI' ? 'Stok ' + fmtNum(p.stok) : '';
    if (isHabis(p)) return '<span class="st">' + stockTxt + '</span><span class="pill bad sm">Habis</span>';
    if (opt) return '<span class="st">' + stockTxt + '</span><button class="btn outline-brand xs" data-act="tap" data-pid="' + esc(p.produk_id) + '" type="button">Pilih</button>';
    if (qty) return '<span class="st">' + stockTxt + '</span><div class="stepper"><button data-act="dec" data-pid="' + esc(p.produk_id) + '" type="button" aria-label="Kurangi">' + icon('minus', 'sm') + '</button><span class="v">' + qty + '</span><button class="plus" data-act="tap" data-pid="' + esc(p.produk_id) + '" type="button" aria-label="Tambah">' + icon('plus', 'sm') + '</button></div>';
    return '<span class="st">' + stockTxt + '</span><button class="add-btn" data-act="tap" data-pid="' + esc(p.produk_id) + '" type="button" aria-label="Tambah">' + icon('plus', 'sm') + '</button>';
  },
  renderGrid(el) {
    const list = this.list();
    const grid = $('.js-grid', el);
    if (!list.length) { grid.innerHTML = '<div style="grid-column:1/-1">' + emptyState('package', 'Produk tidak ditemukan', this.state.q ? 'Coba kata kunci lain.' : (App.isOwner ? 'Tambahkan produk di menu Produk.' : 'Belum ada produk.'), App.isOwner ? '<a class="btn primary sm" href="#/produk-form/baru">' + icon('plus', 'sm') + 'Tambah Produk</a>' : '') + '</div>'; return; }
    grid.innerHTML = list.map((p) => {
      const qty = Cart.qtyOf(p.produk_id), habis = isHabis(p), opt = productHasOptions(p.produk_id);
      return '<div class="pcard' + (qty ? ' in-cart' : '') + (habis ? ' habis' : '') + '" data-act="tap" data-pid="' + esc(p.produk_id) + '" role="button" tabindex="0">' +
        (qty ? '<span class="qbadge">' + qty + '</span>' : '<span class="qbadge" hidden></span>') +
        '<div class="pimg">' + productImg(p) + (opt ? '<span class="tag pill brand sm">Varian</span>' : '') + '</div>' +
        '<div class="nm">' + esc(p.nama) + '</div><div class="pr">' + rp(p.harga_jual) + '</div>' +
        '<div class="ft">' + this.cardFoot(p) + '</div></div>';
    }).join('');
  },
  refreshCards(el) {
    $$('.pcard', el).forEach((card) => {
      const p = Local.product(card.dataset.pid); if (!p) return;
      const qty = Cart.qtyOf(p.produk_id);
      card.classList.toggle('in-cart', !!qty); card.classList.toggle('habis', isHabis(p));
      const b = $('.qbadge', card); b.hidden = !qty; b.textContent = qty;
      $('.ft', card).innerHTML = this.cardFoot(p);
    });
  },
  renderCart(el) {
    const n = Cart.count(), t = Cart.totals();
    const bar = $('.js-cartbar', el);
    bar.hidden = !n;
    if (n) bar.innerHTML = '<span style="position:relative">' + icon('bag', '') + '</span><div><div class="cnt">' + n + ' item</div><div class="tot">' + rp(t.total) + '</div></div><button class="btn primary" data-act="cart-open" type="button">Bayar ' + icon('arrow-right', 'sm') + '</button>';
    $('.js-cart-panel', el).innerHTML = cartPanelHtml(t, n);
  },
  actions: {
    cat(a, e, el) { this.state.cat = a.dataset.id; this.renderCats(el); this.renderGrid(el); },
    tap(a) { const p = Local.product(a.dataset.pid); if (!p) return; addProductFlow(p); },
    dec(a) { const l = Cart.lines.find((x) => x.produk_id === a.dataset.pid && !x.varian.length && !x.catatan) || Cart.lines.filter((x) => x.produk_id === a.dataset.pid).pop(); if (l) Cart.setQty(l.key, l.qty - 1); },
    scan(a, e, el) {
      Scanner.open((code) => {
        const p = findByBarcode(code);
        if (!p) return { error: 'Barcode tidak terdaftar' };
        const r = addProductFlow(p, true);
        if (r === 'habis') return { error: p.nama + ' — stok habis' };
        if (r === 'fail') return { error: p.nama + ' — stok tidak cukup' };
        if (r === 'variant') return { label: p.nama, sub: 'Pilih varian…', close: true };
        flashCard(el, p.produk_id);
        return { label: p.nama + ' ditambahkan', sub: 'Di keranjang: ' + Cart.qtyOf(p.produk_id) + ' · Total ' + rp(Cart.totals().total) };
      });
    },
    'cart-open'() { if (window.matchMedia('(min-width:1024px)').matches) go('bayar'); else openCartSheet(); },
    bayar() { go('bayar'); },
    disc() { openDiscountSheet(); },
    clear: clearCartConfirm,
    'line-inc'(a) { const l = Cart.lines.find((x) => x.key === a.dataset.key); if (l) Cart.setQty(l.key, l.qty + 1); },
    'line-dec'(a) { const l = Cart.lines.find((x) => x.key === a.dataset.key); if (l) Cart.setQty(l.key, l.qty - 1); },
    'line-note'(a) { editLineNote(a.dataset.key); },
    'open-store'() { openStoreSheet(); }
  }
});

function addProductFlow(p, fromScan) {
  if (isHabis(p)) { if (!fromScan) toast(p.nama + ' habis', 'warn'); return 'habis'; }
  if (productHasOptions(p.produk_id)) { openVariantSheet(p); return 'variant'; }
  return Cart.add(p, [], 1, '') ? 'added' : 'fail';
}
function findByBarcode(code) { code = String(code || '').trim().toLowerCase(); return code ? (App.boot.products || []).find((x) => String(x.kode_barcode).toLowerCase() === code) : null; }
/** Sorot kartu produk & keranjang setelah scan — kasir langsung tahu barang masuk. */
function flashCard(el, pid) {
  const pg = el || $('.page[data-page="kasir"]'); if (!pg) return;
  const card = $('.pcard[data-pid="' + pid + '"]', pg);
  if (card) { card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash'); }
  ['.js-cartbar', '.js-cart-panel'].forEach((sel) => { const b = $(sel, pg); if (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } });
}
async function clearCartConfirm() { if (await confirmDlg({ title: 'Kosongkan keranjang?', okText: 'Kosongkan', danger: true })) { Cart.clear(); closeAllSheets(); } }

function cartLinesHtml(t) {
  return Cart.lines.map((l) => '<div class="cart-line"><div class="info"><div class="nm">' + esc(l.nama) + '</div>' +
    (l.varian.length ? '<div class="mod">' + esc(Cart.varText(l)) + '</div>' : '') +
    (l.catatan ? '<div class="note">*' + esc(l.catatan) + '</div>' : '') +
    '<div class="row" style="margin-top:8px;gap:8px"><div class="stepper"><button data-act="line-dec" data-key="' + esc(l.key) + '" type="button">' + icon('minus', 'sm') + '</button><span class="v">' + l.qty + '</span><button class="plus" data-act="line-inc" data-key="' + esc(l.key) + '" type="button">' + icon('plus', 'sm') + '</button></div>' +
    '<button class="btn xs outline" data-act="line-note" data-key="' + esc(l.key) + '" type="button">' + icon('pencil', 'xs') + 'Catatan</button></div></div>' +
    '<div style="text-align:right"><div class="pr">' + rp(Cart.price(l) * l.qty) + '</div>' + (t.lineDisc[l.key] ? '<div style="font-size:12px;color:var(--ok);font-weight:700">-' + rp(t.lineDisc[l.key]) + '</div>' : '') +
    (l.qty > 1 ? '<div class="muted" style="font-size:12px">@' + rp(Cart.price(l)) + '</div>' : '') + '</div></div>').join('');
}
function summaryRows(t) {
  return '<div class="sum-row"><span class="muted">Subtotal</span><span class="v">' + rp(t.subtotal) + '</span></div>' +
    (t.itemDisc ? '<div class="sum-row disc"><span>' + icon('tag', 'xs') + ' Promo produk</span><span class="v">-' + rp(t.itemDisc) + '</span></div>' : '') +
    (t.notaDisc ? '<div class="sum-row disc"><span>' + icon('tag', 'xs') + ' ' + esc(t.notaName) + '</span><span class="v">-' + rp(t.notaDisc) + '</span></div>' : '') +
    (t.manual ? '<div class="sum-row disc"><span>' + icon('percent', 'xs') + ' Diskon manual' + (t.capped ? ' (maks)' : '') + '</span><span class="v">-' + rp(t.manual) + '</span></div>' : '');
}
function cartPanelHtml(t, n) {
  if (!n) return '<div class="cp-head"><h3 style="margin:0;font-size:17px">Keranjang</h3></div><div class="cp-body">' + emptyState('cart', 'Keranjang kosong', 'Ketuk produk untuk menambahkan.') + '</div>';
  return '<div class="cp-head"><h3 style="margin:0;font-size:17px">Keranjang · ' + n + ' item</h3><button class="link-btn" data-act="clear" type="button" style="color:var(--bad)">Kosongkan</button></div>' +
    '<div class="cp-body">' + cartLinesHtml(t) + '</div><div class="cp-foot">' + summaryRows(t) +
    '<button class="btn xs outline-brand" data-act="disc" type="button" style="margin:6px 0 10px">' + icon('plus', 'xs') + (Cart.manual ? 'Ubah Diskon' : 'Tambah Diskon') + '</button>' +
    '<div class="sum-row" style="font-size:18px"><b>Total</b><b class="v" style="color:var(--p);font-size:24px">' + rp(t.total) + '</b></div>' +
    '<button class="btn primary block lg" data-act="bayar" type="button" style="margin-top:10px">Bayar ' + rp(t.total) + ' ' + icon('arrow-right', 'sm') + '</button></div>';
}
function openCartSheet() {
  const render = (s) => {
    const t = Cart.totals(), n = Cart.count();
    if (!n) { s.close(); return; }
    $('.sh-head h3', s.el).textContent = 'Keranjang · ' + n + ' item';
    $('.sh-body', s.el).innerHTML = cartLinesHtml(t) + '<div class="divider"></div>' + summaryRows(t) +
      '<div class="row between" style="margin-top:8px"><button class="btn xs outline-brand" data-act="disc" type="button">' + icon('plus', 'xs') + (Cart.manual ? 'Ubah Diskon' : 'Tambah Diskon') + '</button><button class="link-btn" data-act="clear" type="button" style="color:var(--bad)">Kosongkan</button></div>';
    $('.sh-foot', s.el).innerHTML = '<button class="btn primary block lg" data-act="bayar" type="button">Bayar ' + rp(t.total) + ' ' + icon('arrow-right', 'sm') + '</button>';
  };
  let off = null;
  const s = sheet({ title: 'Keranjang', body: '', foot: ' ', onClose() { if (off) Bus.removeEventListener('cart', off); } });
  off = () => render(s); Bus.addEventListener('cart', off);
  s.el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    const k = Pages.kasir.actions[a.dataset.act];
    if (a.dataset.act === 'bayar') { s.close(); go('bayar'); return; }
    if (k) k.call(Pages.kasir, a, e);
  });
  render(s);
}
async function editLineNote(key) {
  const l = Cart.lines.find((x) => x.key === key); if (!l) return;
  const v = await promptDlg({ title: 'Catatan ' + l.nama, placeholder: 'contoh: less sugar, tanpa es', value: l.catatan, required: false, chips: ['Less sugar', 'Less ice', 'Tanpa es', 'Dibungkus'] });
  if (v === null) return;
  const nk = Cart.key(l.produk_id, l.varian.map((x) => x.varian_id), v);
  const other = Cart.lines.find((x) => x.key === nk && x !== l);
  if (other) { other.qty += l.qty; Cart.lines = Cart.lines.filter((x) => x !== l); } else { l.catatan = v; l.key = nk; }
  Cart.save();
}
function openDiscountSheet() {
  const st = App.settings, max = toNum(st.batas_diskon_kasir);
  let type = (Cart.manual && Cart.manual.type) || 'PERSEN';
  const s = sheet({
    title: 'Diskon Manual',
    body: '<div class="seg light" id="dType"><button type="button" data-t="PERSEN">' + icon('percent', 'sm') + 'Persen</button><button type="button" data-t="NOMINAL">' + icon('banknote', 'sm') + 'Nominal</button></div>' +
      '<div class="field" style="margin-top:14px"><span class="lbl">Nilai diskon</span><input class="input big" id="dVal" inputmode="numeric" autocomplete="off"></div>' +
      '<div class="chips wrap" id="dQuick" style="margin-top:10px"></div>' +
      (!App.isOwner ? '<div class="help">' + icon('info', 'xs') + 'Batas diskon kasir: maksimal ' + max + '% dari subtotal.</div>' : ''),
    foot: '<div class="row">' + (Cart.manual ? '<button class="btn danger" id="dDel" type="button">Hapus</button>' : '') + '<button class="btn primary grow" id="dOk" type="button">Terapkan</button></div>'
  });
  const val = $('#dVal', s.el);
  const paint = () => {
    $$('#dType button', s.el).forEach((b) => b.classList.toggle('on', b.dataset.t === type));
    val.classList.toggle('money', type === 'NOMINAL');
    val.placeholder = type === 'PERSEN' ? 'contoh: 10' : 'contoh: 5.000';
    $('#dQuick', s.el).innerHTML = (type === 'PERSEN' ? [5, 10, 15, 20, 25, 50] : [1000, 2000, 5000, 10000, 20000]).map((v) => '<button class="chip" type="button" data-v="' + v + '">' + (type === 'PERSEN' ? v + '%' : rp(v)) + '</button>').join('');
  };
  if (Cart.manual) val.value = type === 'NOMINAL' ? NF.format(Cart.manual.value) : Cart.manual.value;
  paint();
  $('#dType', s.el).onclick = (e) => { const b = e.target.closest('button'); if (b) { type = b.dataset.t; val.value = ''; paint(); } };
  $('#dQuick', s.el).onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) val.value = type === 'NOMINAL' ? NF.format(b.dataset.v) : b.dataset.v; };
  $('#dOk', s.el).onclick = () => { const v = type === 'PERSEN' ? Math.min(100, toNum(val.value.replace(',', '.'))) : parseMoney(val.value); Cart.manual = v > 0 ? { type, value: v } : null; Cart.save(); s.close(); };
  const del = $('#dDel', s.el); if (del) del.onclick = () => { Cart.manual = null; Cart.save(); s.close(); };
  setTimeout(() => val.focus(), 60);
}

/* ============================================================ SHEET VARIAN */
function openVariantSheet(p) {
  const vars = (App.boot.variants || []).filter((v) => v.produk_id === p.produk_id);
  const groups = [];
  vars.forEach((v) => { let g = groups.find((x) => x.nama === v.grup); if (!g) { g = { nama: v.grup, wajib: false, items: [] }; groups.push(g); } g.items.push(v); if (v.wajib_pilih) g.wajib = true; });
  const sel = {}; groups.forEach((g) => { sel[g.nama] = g.wajib ? [g.items[0].varian_id] : []; });
  let qty = 1, note = '';
  const grpIcon = (g, v) => g.nama.toLowerCase() === 'suhu' ? (/hot|panas/i.test(v.nama) ? icon('flame', 'sm') : /ice|dingin|es/i.test(v.nama) ? icon('snowflake', 'sm') : '') : '';
  const body = groups.map((g) => '<div class="label-row" style="margin-top:' + (g === groups[0] ? '0' : '20px') + '"><span class="sec-title">' + esc(g.nama) + '</span><span class="pill neutral sm">' + (g.wajib ? 'Wajib pilih 1' : 'Opsional, boleh lebih dari 1') + '</span></div>' +
    '<div class="' + (g.wajib && g.items.length <= 3 ? 'grid-' + Math.max(2, g.items.length) : 'stack') + '" style="' + (g.wajib && g.items.length <= 3 ? '' : 'display:grid;gap:10px') + '">' +
    g.items.map((v) => '<button type="button" class="opt" data-g="' + esc(g.nama) + '" data-v="' + esc(v.varian_id) + '">' +
      (g.wajib ? '<span class="radio-dot"></span>' : '<span class="check"><input type="checkbox" tabindex="-1"></span>') +
      grpIcon(g, v) + '<div class="grow"><div class="t">' + esc(v.nama) + '</div>' + (g.wajib && toNum(v.tambahan_harga) ? '<div class="s">+' + rp(v.tambahan_harga) + '</div>' : g.wajib && g.items.some((x) => toNum(x.tambahan_harga)) ? '<div class="s">+Rp0</div>' : '') + '</div>' +
      (!g.wajib ? '<span class="num" style="font-weight:700">+' + rp(v.tambahan_harga) + '</span>' : '') + '</button>').join('') + '</div>').join('') +
    '<div class="label-row"><span class="sec-title">Catatan pesanan</span><span class="faint" style="font-size:12.5px">Opsional</span></div>' +
    '<input class="input" id="vNote" placeholder="contoh: less sugar, tanpa es" autocomplete="off">' +
    '<div class="chips wrap" style="margin-top:10px">' + ['Less sugar', 'Less ice', 'Tanpa es', 'Dibungkus'].map((c) => '<button class="chip" type="button" data-note="' + c + '">' + icon('plus', 'xs') + c + '</button>').join('') + '</div>' +
    '<div class="row" style="justify-content:center;margin-top:20px"><div class="stepper lg"><button type="button" data-q="-1">' + icon('minus') + '</button><span class="v" id="vQty">1</span><button type="button" class="plus" data-q="1">' + icon('plus') + '</button></div></div>';
  const s = sheet({
    headHtml: '<div class="thumb" style="width:56px;height:56px">' + productImg(p) + '</div><div class="grow"><h3 class="ellipsis">' + esc(p.nama) + '</h3><div style="color:var(--p);font-weight:800" class="num">' + rp(p.harga_jual) + '</div></div>',
    body, foot: '<button class="btn primary block lg" id="vAdd" type="button"></button>'
  });
  const paint = () => {
    $$('.opt', s.el).forEach((b) => {
      const on = (sel[b.dataset.g] || []).indexOf(b.dataset.v) > -1;
      b.classList.toggle('is-on', on); const cb = $('input', b); if (cb) cb.checked = on;
    });
    const extra = Object.values(sel).flat().reduce((sum, id) => sum + toNum((vars.find((v) => v.varian_id === id) || {}).tambahan_harga), 0);
    $('#vQty', s.el).textContent = qty;
    $('#vAdd', s.el).textContent = 'Tambah ke Keranjang · ' + rp((toNum(p.harga_jual) + extra) * qty);
  };
  s.el.addEventListener('click', (e) => {
    const o = e.target.closest('.opt');
    if (o) { const g = groups.find((x) => x.nama === o.dataset.g); if (g.wajib) sel[g.nama] = [o.dataset.v]; else { const a = sel[g.nama]; const i = a.indexOf(o.dataset.v); if (i > -1) a.splice(i, 1); else a.push(o.dataset.v); } paint(); return; }
    const q = e.target.closest('[data-q]'); if (q) { qty = Math.max(1, qty + Number(q.dataset.q)); paint(); return; }
    const n = e.target.closest('[data-note]'); if (n) { const inp = $('#vNote', s.el); const cur = inp.value.trim(); inp.value = cur ? (cur.toLowerCase().indexOf(n.dataset.note.toLowerCase()) > -1 ? cur : cur + ', ' + n.dataset.note.toLowerCase()) : n.dataset.note.toLowerCase(); }
  });
  $('#vAdd', s.el).onclick = () => {
    note = $('#vNote', s.el).value.trim();
    const chosen = groups.flatMap((g) => sel[g.nama].map((id) => vars.find((v) => v.varian_id === id)));
    if (Cart.add(p, chosen, qty, note)) { s.close(); toast(p.nama + ' ditambahkan', 'ok', 1100); }
  };
  paint();
}

/* =========================================================== PEMBAYARAN */
const PAY_METHODS = [
  { id: 'TUNAI', label: 'Tunai', sub: 'Input nominal', ic: 'banknote', cls: 'warn' },
  { id: 'QRIS', label: 'QRIS', sub: 'Foto bukti', ic: 'qr-code', cls: 'info' },
  { id: 'TRANSFER', label: 'Transfer', sub: 'Foto bukti', ic: 'landmark', cls: 'violet' },
  { id: 'UTANG', label: 'Utang', sub: 'Pilih pelanggan', ic: 'notebook', cls: 'warn' }
];
page('bayar', {
  nav: false, foot: true,
  st: { method: 'TUNAI', cash: 0, proof: null, cust: null, open: true },
  template() {
    return topbar({ back: true, title: 'Pembayaran', right: syncPill() }) +
      '<div class="wrap" style="max-width:760px;padding-top:16px"><div class="js-banner"></div><div class="card pad js-sum"></div>' +
      '<div class="label-row"><span class="sec-title">Metode bayar</span><span class="link-btn" style="font-size:12.5px">Pilih salah satu</span></div>' +
      '<div class="pay-grid js-methods"></div><div class="js-panel" style="margin-top:14px"></div></div>' +
      '<div class="sticky-foot"><div class="in"><button class="link-btn js-save-plain" data-act="save" data-print="0" type="button" style="display:block;margin:0 auto 8px;color:var(--muted)">Simpan tanpa cetak</button>' +
      '<button class="btn primary block lg js-save" data-act="save" data-print="1" type="button"></button></div></div>';
  },
  init(el) { on('cart', () => { if (App.current === 'bayar') this.renderSum(el); }); on('store', () => { if (App.current === 'bayar') this.renderBanner(el); }); },
  show(el) {
    if (!Cart.count()) { replaceRoute('kasir'); return; }
    this.st = { method: this.st.method || 'TUNAI', cash: 0, proof: null, cust: null, open: this.st.open };
    $('.js-save', el).innerHTML = icon('printer', 'sm') + (Printer.supported() ? 'Simpan & Cetak Struk' : 'Simpan Transaksi');
    $('.js-save-plain', el).hidden = !Printer.supported();
    this.renderBanner(el); this.renderSum(el); this.renderMethods(el); this.renderPanel(el);
  },
  renderBanner(el) {
    $('.js-banner', el).innerHTML = App.store ? '' : '<div class="banner warn" style="margin-bottom:12px">' + icon('lock', 'sm') + '<div><b>Toko belum dibuka.</b> Transaksi baru bisa disimpan setelah pemilik membuka toko.</div></div>';
  },
  renderSum(el) {
    const t = Cart.totals(), n = Cart.count();
    $('.js-sum', el).innerHTML = '<button class="row between" data-act="toggle-sum" type="button" style="width:100%"><span class="row" style="gap:8px">' + icon('receipt', 'sm') + '<b>Ringkasan Pesanan · ' + n + ' item</b></span>' + icon(this.st.open ? 'chevron-up' : 'chevron-down', 'sm') + '</button>' +
      (this.st.open ? '<div class="divider"></div>' + Cart.lines.map((l) => '<div class="sum-row" style="align-items:flex-start"><div><div>' + l.qty + '× ' + esc(l.nama) + '</div>' +
        '<div class="muted" style="font-size:12.5px">' + esc([Cart.varText(l), l.catatan].filter(Boolean).join(' · ') || '@' + rp(Cart.price(l))) + '</div></div><span class="v">' + rp(Cart.price(l) * l.qty) + '</span></div>').join('') + '<div class="divider dashed"></div>' : '<div style="height:8px"></div>') +
      summaryRows(t) +
      '<button class="btn xs outline-brand" data-act="disc" type="button" style="margin-top:6px">' + icon('plus', 'xs') + (Cart.manual ? 'Ubah Diskon' : 'Tambah Diskon') + '</button>' +
      '<div class="total-band"><div><div class="k">TOTAL TAGIHAN</div><div class="muted" style="font-size:12.5px">' + n + ' item</div></div><div class="v">' + rp(t.total) + '</div></div>';
    if (this.st.method === 'TUNAI') this.renderChange(el);
  },
  renderMethods(el) {
    $('.js-methods', el).innerHTML = PAY_METHODS.map((m) => '<button class="pay-tile' + (this.st.method === m.id ? ' is-on' : '') + '" data-act="method" data-m="' + m.id + '" type="button"><span class="chk">' + icon('check', 'xs') + '</span>' +
      '<span class="ico ico-box ' + m.cls + '" style="width:48px;height:48px;border-radius:50%">' + icon(m.ic) + '</span><span class="t">' + m.label + '</span><span class="s">' + m.sub + '</span></button>').join('');
  },
  quickCash(total) {
    const out = [], den = [5000, 10000, 20000, 50000, 100000, 150000, 200000, 500000];
    den.forEach((d) => { const v = Math.ceil(total / d) * d; if (v > total && out.indexOf(v) < 0 && out.length < 3) out.push(v); });
    return out.sort((a, b) => a - b).slice(0, 3);
  },
  renderPanel(el) {
    const m = this.st.method, t = Cart.totals(), box = $('.js-panel', el);
    if (m === 'TUNAI') {
      box.innerHTML = '<div class="card pad"><div class="field"><span class="lbl">Uang diterima</span>' + moneyInput('id="cashIn" class="input big money"', this.st.cash) + '</div>' +
        '<div class="chips wrap js-quick" style="margin-top:10px"><button class="chip" data-act="cash" data-v="' + t.total + '" type="button">Uang Pas</button>' +
        this.quickCash(t.total).map((v) => '<button class="chip" data-act="cash" data-v="' + v + '" type="button">' + rp(v) + '</button>').join('') + '</div><div class="js-change"></div></div>';
      const inp = $('#cashIn', el); inp.className = 'input big money';
      inp.addEventListener('input', () => { this.st.cash = parseMoney(inp.value); this.renderChange(el); });
      this.renderChange(el);
    } else if (m === 'QRIS' || m === 'TRANSFER') {
      box.innerHTML = '<div class="card pad"><div class="row" style="gap:8px">' + icon('camera', 'sm') + '<b>Foto bukti ' + (m === 'QRIS' ? 'QRIS' : 'transfer') + '</b><span class="faint" style="font-size:12.5px">· disarankan</span></div>' +
        '<div class="proof-box">' + (this.st.proof ? '<img src="' + this.st.proof + '" alt="Bukti bayar"><div class="pill ok sm" style="margin-bottom:10px">' + icon('check', 'xs') + 'Dikompres ' + dataUrlKB(this.st.proof) + ' KB</div>' : '<div class="muted" style="font-size:13.5px;margin-bottom:10px">Belum ada foto. Otomatis dikompres ≤250 KB.</div>') +
        '<div class="grid-2"><button class="btn outline" data-act="proof" data-cap="1" type="button">' + icon('camera', 'sm') + 'Kamera</button><button class="btn outline" data-act="proof" data-cap="0" type="button">' + icon('image', 'sm') + 'Galeri</button></div></div></div>';
    } else {
      const c = this.st.cust;
      box.innerHTML = '<div class="card pad"><div class="row between"><b>Pelanggan</b><button class="link-btn" data-act="cust" type="button">' + (c ? 'Ganti' : 'Pilih') + '</button></div>' +
        (c ? '<div class="list-item"><div class="thumb">' + esc(initials(c.nama)) + '</div><div class="grow"><div class="t">' + esc(c.nama) + '</div><div class="s">' + esc(c.no_hp || '-') + (toNum(c.sisa_utang) ? ' · utang ' + rp(c.sisa_utang) : '') + '</div></div></div>'
          : '<button class="btn outline block" data-act="cust" type="button" style="margin-top:12px">' + icon('user', 'sm') + 'Pilih atau tambah pelanggan</button>') +
        '<div class="help">' + icon('info', 'xs') + 'Transaksi tercatat sebagai utang dan muncul di menu Utang.</div></div>';
    }
  },
  renderChange(el) {
    const box = $('.js-change', el); if (!box) return;
    const t = Cart.totals(), cash = this.st.cash;
    if (!cash) { box.innerHTML = ''; return; }
    const ch = cash - t.total;
    box.innerHTML = '<div class="change-box' + (ch < 0 ? ' minus' : '') + '"><span>' + (ch < 0 ? 'Kurang' : 'Kembalian') + '</span><span class="v">' + rp(Math.abs(ch)) + '</span></div>';
  },
  actions: {
    'toggle-sum'(a, e, el) { this.st.open = !this.st.open; this.renderSum(el); },
    disc() { openDiscountSheet(); },
    method(a, e, el) { this.st.method = a.dataset.m; this.renderMethods(el); this.renderPanel(el); },
    cash(a, e, el) { this.st.cash = Number(a.dataset.v); $('#cashIn', el).value = NF.format(this.st.cash); this.renderChange(el); },
    async proof(a, e, el) {
      const f = await pickImage(a.dataset.cap === '1'); if (!f) return;
      try { this.st.proof = await compressImage(f, { maxDim: 1280 }); this.renderPanel(el); } catch (err) { toast(err.message, 'bad'); }
    },
    cust(a, e, el) { pickCustomer((c) => { this.st.cust = c; this.renderPanel(el); }); },
    async save(a, e, el) { await saveTransaction(this, el, a.dataset.print === '1'); }
  }
});

async function saveTransaction(pg, el, doPrint) {
  const st = pg.st, t = Cart.totals();
  if (!Cart.count()) return;
  if (!App.store) { toast('Toko belum dibuka. Transaksi tidak bisa disimpan.', 'bad'); return; }
  if (st.method === 'TUNAI' && st.cash < t.total) {
    if (st.cash === 0) { st.cash = t.total; } else { toast('Uang diterima kurang ' + rp(t.total - st.cash), 'bad'); return; }
  }
  if (st.method === 'UTANG' && !st.cust) { toast('Pilih pelanggan untuk transaksi utang', 'bad'); pickCustomer((c) => { st.cust = c; pg.renderPanel(el); }); return; }
  const btns = $$('[data-act="save"]', el); btns.forEach((b) => busy(b, true));
  const id = uuid();
  const items = Cart.lines.map((l) => ({
    produk_id: l.produk_id, nama_produk: l.nama, varian_ids: l.varian.map((v) => v.varian_id), varian_ringkas: Cart.varText(l),
    qty: l.qty, harga_satuan: Cart.price(l), diskon_item: t.lineDisc[l.key] || 0, subtotal: Cart.price(l) * l.qty - (t.lineDisc[l.key] || 0), catatan_item: l.catatan
  }));
  const payload = {
    transaksi_id: id, no_nota: Seq.next(), waktu: new Date().toISOString(), sesi_toko_id: App.store.sesi_id, sumber: navigator.onLine ? 'ONLINE' : 'OFFLINE',
    items, subtotal: t.subtotal, diskon: t.diskon, diskon_ket: t.ket, total: t.total, metode_bayar: st.method,
    uang_diterima: st.method === 'TUNAI' ? st.cash : st.method === 'UTANG' ? 0 : t.total, kembalian: st.method === 'TUNAI' ? st.cash - t.total : 0,
    pelanggan_id: st.cust ? st.cust.pelanggan_id : '', pelanggan_nama: st.cust ? st.cust.nama : '', catatan: ''
  };
  const local = Object.assign({}, payload, { kasir_id: App.user.user_id, kasir_nama: App.user.nama, perangkat_id: App.session.device.perangkat_id, status: 'SELESAI', status_bayar: st.method === 'UTANG' ? 'UTANG' : 'LUNAS', _local: true, _sync: 'PENDING', _hasProof: !!st.proof });
  try {
    await Sync.enqueue('tx', payload, { id: 'tx_' + id, tx: local, proof: st.proof ? { ref_id: id, ref_type: 'tx', dataUrl: st.proof, at: Date.now() } : null });
  } catch (err) { btns.forEach((b) => busy(b, false)); toast('Gagal menyimpan di perangkat: ' + err.message, 'bad'); return; }
  Cart.clear();
  btns.forEach((b) => busy(b, false));
  go('sukses/' + id);
  if (doPrint && Printer.supported()) Printer.printTx(local, { silent: Printer.status() === 'none' });
}

function pickCustomer(cb) {
  const list = () => (App.boot.customers || []).slice().sort((a, b) => a.nama.localeCompare(b.nama));
  const s = sheet({
    title: 'Pilih Pelanggan',
    body: '<div class="input-wrap">' + icon('search', 'sm') + '<input class="input" id="cQ" placeholder="Cari nama / no. HP" autocomplete="off"></div><div id="cList" style="margin-top:8px"></div>' +
      '<div class="card pad" style="margin-top:14px;background:var(--bg)"><b>Pelanggan baru</b><div class="field" style="margin-top:10px"><span class="lbl">Nama <span class="req">*</span></span><input class="input" id="cNama" placeholder="Nama pelanggan"></div>' +
      '<div class="field"><span class="lbl">No. HP / WhatsApp</span><input class="input" id="cHp" inputmode="tel" placeholder="08xxxxxxxxxx"></div><button class="btn secondary block" id="cAdd" type="button" style="margin-top:12px">' + icon('plus', 'sm') + 'Tambah & Pilih</button></div>'
  });
  const paint = () => {
    const q = $('#cQ', s.el).value.trim().toLowerCase();
    const l = list().filter((c) => !q || c.nama.toLowerCase().indexOf(q) > -1 || String(c.no_hp).indexOf(q) > -1);
    $('#cList', s.el).innerHTML = l.length ? l.map((c) => '<button class="list-item" data-id="' + esc(c.pelanggan_id) + '" type="button"><div class="thumb">' + esc(initials(c.nama)) + '</div><div class="grow"><div class="t">' + esc(c.nama) + '</div><div class="s">' + esc(c.no_hp || '-') + '</div></div>' + (toNum(c.sisa_utang) ? '<span class="pill warn sm">' + rp(c.sisa_utang) + '</span>' : '') + '</button>').join('') : '<div class="muted" style="padding:12px 0">Belum ada pelanggan.</div>';
  };
  $('#cQ', s.el).addEventListener('input', paint);
  $('#cList', s.el).onclick = (e) => { const b = e.target.closest('[data-id]'); if (!b) return; cb(list().find((c) => c.pelanggan_id === b.dataset.id)); s.close(); };
  $('#cAdd', s.el).onclick = async () => {
    const nama = $('#cNama', s.el).value.trim(), hp = $('#cHp', s.el).value.trim();
    if (!nama) { toast('Nama pelanggan wajib diisi', 'bad'); return; }
    const c = { pelanggan_id: shortId('PL'), nama, no_hp: hp };
    await Sync.enqueue('customer', c, { id: 'cs_' + c.pelanggan_id });
    cb(Object.assign({ sisa_utang: 0 }, c)); s.close();
  };
  paint();
}

/* ============================================================= SUKSES */
async function getTx(id) {
  let t = await DB.get('tx', id);
  if (t) return t;
  const keys = Object.keys(localStorage).filter((k) => k.indexOf(LS_PREFIX + userKey('tx:')) === 0);
  for (const k of keys) { try { const c = JSON.parse(localStorage.getItem(k)); const f = c && c.data && (c.data.list || []).find((x) => x.transaksi_id === id); if (f) return normalizeTx(f); } catch (e) {} }
  return null;
}
function normalizeTx(t) {
  t = Object.assign({}, t);
  t.items = (t.items || []).map((x) => Object.assign({}, x, { varian_ids: Array.isArray(x.varian_ids) ? x.varian_ids : String(x.varian_ids || '').split(',').filter(Boolean) }));
  return t;
}
page('sukses', {
  nav: false,
  template() { return '<div class="wrap" style="max-width:520px"><div class="js-body"></div></div>'; },
  init(el) { on('synced', () => { if (App.current === 'sukses' && this.tx) this.show(el, this.tx.transaksi_id); }); on('printer', () => { if (App.current === 'sukses' && this.tx) this.renderPrinter(el); }); },
  async show(el, id) {
    const tx = await getTx(id);
    if (!tx) { $('.js-body', el).innerHTML = emptyState('receipt', 'Transaksi tidak ditemukan', '', '<a class="btn primary" href="#/kasir">Kembali ke Kasir</a>'); return; }
    this.tx = tx;
    const synced = tx._sync === 'OK' || !tx._local;
    $('.js-body', el).innerHTML = '<div class="success-head"><div class="success-ic">' + icon('check', 'lg') + '</div><h2 style="margin:0;font-size:24px">Transaksi Berhasil</h2>' +
      '<div class="mono muted" style="margin-top:4px">No. Nota ' + esc(tx.no_nota) + '</div>' +
      '<div style="margin-top:10px">' + (tx._sync === 'REJECT' ? '<span class="pill bad">' + icon('alert', 'xs') + 'Ditolak server: ' + esc(tx._msg || '') + '</span>' : synced ? '<span class="pill ok">' + icon('check', 'xs') + 'Tersinkron ke server</span>' : '<span class="pill warn"><span class="dot"></span>Tersimpan di HP · disinkron saat online</span>') + '</div></div>' +
      '<div style="margin:18px 0 26px">' + Receipt.html(tx) + '</div>' +
      '<div class="js-printer"></div>' +
      '<div class="stack" style="margin-top:12px">' +
      '<button class="btn primary block lg" data-act="print" type="button">' + icon('printer', 'sm') + 'Cetak Struk</button>' +
      '<div class="grid-3" style="gap:8px"><button class="btn outline" data-act="wa" type="button">' + icon('whatsapp', 'sm') + 'WA</button><button class="btn outline" data-act="img" type="button">' + icon('image', 'sm') + 'Gambar</button><button class="btn outline" data-act="pdf" type="button">' + icon('file', 'sm') + 'PDF</button></div>' +
      '<button class="btn outline block lg" data-act="new" type="button" style="border:1.5px solid var(--text)">' + icon('plus', 'sm') + 'Transaksi Baru</button></div><div style="height:24px"></div>';
    this.renderPrinter(el);
  },
  renderPrinter(el) {
    const box = $('.js-printer', el); if (!box) return;
    if (!Printer.supported()) { box.innerHTML = '<div class="banner info">' + icon('info', 'sm') + '<div>Browser ini tidak mendukung printer Bluetooth (mis. iPhone). Gunakan tombol <b>Gambar</b>, <b>PDF</b> atau <b>WA</b>.</div></div>'; return; }
    const sv = Printer.saved(), stt = Printer.status();
    box.innerHTML = '<div class="card pad row"><span class="ico-box info">' + icon('bluetooth', 'sm') + '</span><div class="grow"><div class="t" style="font-weight:700">' + esc(sv ? sv.name : 'Belum ada printer') + ' <span class="pill ' + (stt === 'connected' ? 'ok' : 'neutral') + ' sm">' + (stt === 'connected' ? 'Terhubung' : sv ? 'Tersimpan' : 'Belum') + '</span></div><div class="muted" style="font-size:12.5px">Thermal Bluetooth ESC/POS · ' + (App.settings.ukuran_kertas || '58') + 'mm</div></div><button class="link-btn" data-act="printer" type="button">' + (sv ? 'Ganti' : 'Hubungkan') + '</button></div>';
  },
  actions: {
    print() { Printer.printTx(this.tx); },
    wa() { Receipt.sendWA(this.tx, this.tx.pelanggan_id ? ((App.boot.customers || []).find((c) => c.pelanggan_id === this.tx.pelanggan_id) || {}).no_hp : ''); },
    img(a) { runExport(a, () => Receipt.saveImage(this.tx)); },
    pdf(a) { runExport(a, () => Receipt.savePdf(this.tx)); },
    new() { replaceRoute('kasir'); },
    async printer() { try { const n = await Printer.connect(true); toast('Terhubung ke ' + n, 'ok'); } catch (e) { if (e.name !== 'NotFoundError') toast(e.message, 'bad'); } }
  }
});
