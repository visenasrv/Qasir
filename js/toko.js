/* ============================================================================
   QASIR — toko.js · Toko online publik (pelanggan, tanpa login)
   Tampil instan dari salinan terakhir di perangkat, lalu diperbarui di latar.
   ========================================================================== */
'use strict';
(function () {
  const CFG = window.QASIR_CONFIG || {}, GAS_URL = CFG.GAS_URL || '';
  const NF = new Intl.NumberFormat('id-ID');
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rp = (n) => 'Rp' + NF.format(Math.round(Number(n) || 0));
  const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('qshop:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('qshop:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const params = new URLSearchParams(location.search);
  const MEJA = (params.get('meja') || '').replace(/[^\w-]/g, '').slice(0, 10);

  /* ------------------------------------------------------------- API */
  async function api(action, data, o) {
    o = o || {};
    if (!GAS_URL || GAS_URL.indexOf('GANTI_DENGAN') > -1) return { ok: false, error: 'Alamat server belum diatur.' };
    const tries = o.tries || 3;
    let last = { ok: false, error: 'Koneksi internet terputus.' };
    for (let i = 0; i < tries; i++) {
      if (i) await sleep(1200 * i);
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), o.timeout || 30000);
      try {
        const res = await fetch(GAS_URL, { method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, reqId: o.reqId || '', data: data || {} }) });
        const j = JSON.parse(await res.text());
        clearTimeout(t);
        return j;
      } catch (e) { clearTimeout(t); last = { ok: false, network: true, error: e.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi internet terputus.' }; }
    }
    return last;
  }

  /* ------------------------------------------------------------- UI kecil */
  function toast(msg, type, ms) {
    let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + (type || '');
    t.innerHTML = icon(type === 'ok' ? 'check' : type === 'bad' || type === 'warn' ? 'alert' : 'info', 'sm') + '<span>' + esc(msg) + '</span>';
    box.appendChild(t); setTimeout(() => { t.style.transition = 'opacity .2s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, ms || 2600);
  }
  const sheets = [];
  function sheet(o) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = '<div class="sheet' + (o.cls ? ' ' + o.cls : '') + '" role="dialog" aria-modal="true"><div class="grab"></div>' + (o.head === false ? '' : '<div class="sh-head">' + (o.headHtml || '<h3>' + esc(o.title || '') + '</h3>') + '<button class="close-x" data-x type="button" aria-label="Tutup">' + icon('x', 'sm') + '</button></div>') +
      '<div class="sh-body">' + (o.body || '') + '</div>' + (o.foot ? '<div class="sh-foot">' + o.foot + '</div>' : '') + '</div>';
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    const api_ = { el: ov.querySelector('.sheet'), close() { if (!ov.isConnected) return; ov.remove(); sheets.splice(sheets.indexOf(api_), 1); if (!sheets.length) document.body.style.overflow = ''; o.onClose && o.onClose(); } };
    sheets.push(api_);
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-x]')) api_.close(); });
    return api_;
  }
  function busy(b, on) { if (b) { b.classList.toggle('is-loading', !!on); b.disabled = !!on; } }
  function hexToRgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return isNaN(n) ? [242, 107, 29] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  function theme(col) {
    const p = hexToRgb(col || '#F26B1D'), r = document.documentElement.style;
    r.setProperty('--p', hex(p)); r.setProperty('--p-dark', hex(mix(p, [0, 0, 0], 0.22))); r.setProperty('--p-soft', hex(mix(p, [255, 255, 255], 0.9)));
    r.setProperty('--p-ring', 'rgba(' + p.join(',') + ',.18)'); r.setProperty('--p-shadow', 'rgba(' + p.join(',') + ',.28)');
    const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', hex(p));
  }
  const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const img = (p, cls) => p.foto_url ? '<img loading="lazy" src="' + esc(p.foto_url) + '" alt="" class="' + (cls || '') + '" onerror="this.outerHTML=\'<div class=ph>' + esc(initials(p.nama)) + '</div>\'">' : '<div class="ph">' + esc(initials(p.nama)) + '</div>';
  async function compress(file, maxDim, maxBytes) {
    const url = URL.createObjectURL(file);
    try {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Gambar tidak bisa dibaca.')); i.src = url; });
      let scale = Math.min(1, maxDim / Math.max(im.naturalWidth, im.naturalHeight)), q = 0.85, out = '';
      for (let k = 0; k < 10; k++) {
        const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * scale); c.height = Math.round(im.naturalHeight * scale);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (Math.ceil((out.length - out.indexOf(',') - 1) * 3 / 4) <= maxBytes) return out;
        if (q > 0.55) q -= 0.1; else scale *= 0.82;
      }
      return out;
    } finally { URL.revokeObjectURL(url); }
  }

  /* ------------------------------------------------------------- State */
  let S = null;                               // data toko dari server
  let cart = LS.get('cart', []);              // [{key, produk_id, varian_ids, qty, catatan}]
  const st = { q: '', tipe: '', metode: '', bukti: null, form: LS.get('form', { nama: '', no_hp: '', alamat: '' }) };
  const P = () => { const m = {}; (S.products || []).forEach((p) => { m[p.produk_id] = p; }); return m; };
  const V = () => { const m = {}; (S.variants || []).forEach((v) => { m[v.varian_id] = v; }); return m; };
  const varsOf = (pid) => (S.variants || []).filter((v) => v.produk_id === pid);
  const saveCart = () => { LS.set('cart', cart); renderCartBar(); refreshCards(); };

  /** Diskon promo — aturan sama persis dengan server (server tetap penentu akhir). */
  function totals() {
    const pm = P(), vm = V();
    const lines = cart.filter((l) => pm[l.produk_id]).map((l) => {
      const p = pm[l.produk_id], vs = (l.varian_ids || []).map((id) => vm[id]).filter(Boolean);
      return Object.assign({}, l, { p, vs, harga: p.harga_jual + vs.reduce((a, v) => a + v.tambahan_harga, 0) });
    });
    const subtotal = lines.reduce((a, l) => a + l.harga * l.qty, 0);
    let itemDisc = 0;
    lines.forEach((l) => {
      let best = 0;
      (S.promos || []).forEach((pr) => {
        if (subtotal < pr.min_belanja) return;
        const hit = (pr.berlaku_untuk === 'PRODUK' && pr.target_id === l.produk_id) || (pr.berlaku_untuk === 'KATEGORI' && pr.target_id === l.p.kategori_id);
        if (!hit) return;
        const g = l.harga * l.qty, d = pr.tipe === 'PERSEN' ? Math.round(g * pr.nilai / 100) : Math.min(g, pr.nilai * l.qty);
        if (d > best) best = d;
      });
      l.disc = best; itemDisc += best;
    });
    const base = subtotal - itemDisc;
    let notaDisc = 0, notaName = '';
    (S.promos || []).filter((pr) => pr.berlaku_untuk === 'SEMUA' && subtotal >= pr.min_belanja).forEach((pr) => { const d = pr.tipe === 'PERSEN' ? Math.round(base * pr.nilai / 100) : Math.min(base, pr.nilai); if (d > notaDisc) { notaDisc = d; notaName = pr.nama; } });
    const og = S.cfg.ongkir || {}, ongkir = st.tipe === 'ANTAR' && og.mode === 'tetap' ? num(og.nilai) : 0;
    const count = lines.reduce((a, l) => a + l.qty, 0);
    return { lines, subtotal, diskon: itemDisc + notaDisc, notaName, ongkir, total: Math.max(0, subtotal - itemDisc - notaDisc) + ongkir, count };
  }
  /** Promo produk (untuk harga coret di kartu). */
  function productPromo(p) {
    let best = null;
    (S.promos || []).forEach((pr) => {
      if (pr.min_belanja > 0) return;
      const hit = (pr.berlaku_untuk === 'PRODUK' && pr.target_id === p.produk_id) || (pr.berlaku_untuk === 'KATEGORI' && pr.target_id === p.kategori_id);
      if (!hit) return;
      const d = pr.tipe === 'PERSEN' ? Math.round(p.harga_jual * pr.nilai / 100) : Math.min(p.harga_jual, pr.nilai);
      if (!best || d > best.d) best = { d, pr };
    });
    return best;
  }
  function promoText(pr) {
    const v = pr.tipe === 'PERSEN' ? pr.nilai + '%' : rp(pr.nilai);
    const target = pr.berlaku_untuk === 'SEMUA' ? 'semua menu' : pr.berlaku_untuk === 'KATEGORI' ? ((S.categories.find((c) => c.kategori_id === pr.target_id) || {}).nama || 'kategori pilihan') : ((P()[pr.target_id] || {}).nama || 'produk pilihan');
    return 'Diskon ' + v + ' ' + target + (pr.min_belanja ? ' · min. ' + rp(pr.min_belanja) : '');
  }
  function sortedCats() {
    const order = (S.cfg.urutan && S.cfg.urutan.cats) || [];
    const cats = S.categories.slice().sort((a, b) => { const ia = order.indexOf(a.kategori_id), ib = order.indexOf(b.kategori_id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.urutan - b.urutan; });
    const prods = (S.cfg.urutan && S.cfg.urutan.prods) || {};
    return cats.map((c) => {
      const o = prods[c.kategori_id] || [];
      const items = S.products.filter((p) => p.kategori_id === c.kategori_id).sort((a, b) => { const ia = o.indexOf(a.produk_id), ib = o.indexOf(b.produk_id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
      return { c, items };
    }).filter((g) => g.items.length);
  }
  const qtyOf = (pid) => cart.filter((l) => l.produk_id === pid).reduce((a, l) => a + l.qty, 0);
  const isBest = (pid) => (S.cfg.best || []).indexOf(pid) > -1;
  const label = (pid) => (S.cfg.labels || {})[pid] || null;
  const canOrder = () => S.buka || S.cfg.pesan_saat_tutup;

  /* ------------------------------------------------------------- Render */
  function badges(p) {
    const out = [], pp = productPromo(p), lb = label(p.produk_id);
    if (p.habis) out.push('<span class="sbadge out">Habis</span>');
    if (isBest(p.produk_id)) out.push('<span class="sbadge best">' + icon('flame', 'xs') + 'Best Seller</span>');
    if (lb && lb.baru) out.push('<span class="sbadge new">' + icon('sparkles', 'xs') + esc(lb.teks || 'Baru') + '</span>');
    if (pp) out.push('<span class="sbadge disc">' + (pp.pr.tipe === 'PERSEN' ? '-' + pp.pr.nilai + '%' : 'Hemat ' + rp(pp.d)) + '</span>');
    if (p.sisa) out.push('<span class="sbadge low">Sisa ' + p.sisa + '</span>');
    return out.join('');
  }
  function priceHtml(p) {
    const pp = productPromo(p);
    return pp ? '<span class="pr">' + rp(p.harga_jual - pp.d) + '</span><s class="was">' + rp(p.harga_jual) + '</s>' : '<span class="pr">' + rp(p.harga_jual) + '</span>';
  }
  function ctrl(p) {
    if (p.habis) return '<span class="muted" style="font-size:12.5px">Habis</span>';
    const q = qtyOf(p.produk_id), opt = varsOf(p.produk_id).length;
    if (!q) return '<button class="sadd" data-add="' + esc(p.produk_id) + '" type="button" aria-label="Tambah ' + esc(p.nama) + '">' + icon('plus', 'sm') + '</button>';
    if (opt) return '<button class="sadd on" data-add="' + esc(p.produk_id) + '" type="button">' + q + ' ' + icon('plus', 'xs') + '</button>';
    return '<div class="stepper"><button type="button" data-dec="' + esc(p.produk_id) + '" aria-label="Kurangi">' + icon('minus', 'sm') + '</button><span class="v">' + q + '</span><button type="button" class="plus" data-add="' + esc(p.produk_id) + '" aria-label="Tambah">' + icon('plus', 'sm') + '</button></div>';
  }
  function itemRow(p) {
    return '<article class="sitem' + (p.habis ? ' habis' : '') + '" data-open="' + esc(p.produk_id) + '"><div class="simg">' + img(p) + '</div>' +
      '<div class="sinfo"><div class="sb">' + badges(p) + '</div><h4>' + esc(p.nama) + '</h4>' + (p.deskripsi ? '<p class="sd">' + esc(p.deskripsi) + '</p>' : (varsOf(p.produk_id).length ? '<p class="sd">' + esc(Array.from(new Set(varsOf(p.produk_id).map((v) => v.grup))).join(' · ')) + ' tersedia</p>' : '')) +
      '<div class="sfoot"><div class="sprice">' + priceHtml(p) + '</div><div class="js-ctrl" data-pid="' + esc(p.produk_id) + '">' + ctrl(p) + '</div></div></div></article>';
  }
  function render() {
    const t = S.toko, cfg = S.cfg;
    document.title = (t.nama || 'Toko') + ' · Pesan Online';
    theme(t.warna_primer);
    if (!S.aktif) {
      $('#shop').innerHTML = '<div class="shop-off"><div class="logo lg" style="margin:0 auto 16px">' + (t.logo_url ? '<img src="' + esc(t.logo_url) + '" alt="">' : esc((t.nama || 'Q').charAt(0))) + '</div><h2>' + esc(t.nama || '') + '</h2><p class="muted">Pemesanan online sedang tidak aktif.</p>' + (t.no_wa ? '<a class="btn primary" href="https://wa.me/' + waNum(t.no_wa) + '" target="_blank">' + icon('whatsapp', 'sm') + 'Hubungi Toko</a>' : '') + '</div>';
      return;
    }
    const groups = sortedCats();
    const best = (cfg.best || []).map((id) => P()[id]).filter(Boolean);
    const lay = cfg.layanan || {};
    $('#shop').innerHTML =
      '<header class="shead"><div class="in"><div class="logo">' + (t.logo_url ? '<img src="' + esc(t.logo_url) + '" alt="" onerror="this.remove()">' : esc((t.nama || 'Q').charAt(0))) + '</div>' +
      '<div class="grow" style="min-width:0"><h1 class="ellipsis">' + esc(t.nama) + '</h1><div class="sub ellipsis">' + (S.buka ? '<span class="dot ok"></span>Buka' : '<span class="dot bad"></span>Tutup') + (cfg.jam_buka ? ' · ' + esc(cfg.jam_buka) : '') + '</div></div>' +
      '<button class="icon-btn ghost-border" data-act="orders" type="button" aria-label="Pesanan saya">' + icon('receipt', 'sm') + '<span class="nb js-ord-count" hidden></span></button></div></header>' +
      (MEJA && lay.meja ? '<div class="smeja">' + icon('utensils', 'sm') + 'Anda memesan untuk <b>Meja ' + esc(MEJA) + '</b> · makan di tempat</div>' : '') +
      (cfg.pengumuman ? '<div class="sannounce">' + icon('megaphone', 'sm') + '<span>' + esc(cfg.pengumuman) + '</span></div>' : '') +
      (!S.buka ? '<div class="banner ' + (cfg.pesan_saat_tutup ? 'info' : 'warn') + '" style="margin:12px 16px 0">' + icon('clock', 'sm') + '<div>' + (cfg.pesan_saat_tutup ? 'Toko sedang tutup — pesanan Anda tetap bisa dikirim dan diproses saat toko buka.' : 'Toko sedang tutup. Lihat-lihat menu dulu, pemesanan dibuka saat toko buka.') + '</div></div>' : '') +
      ((cfg.banners || []).length ? '<section class="sbanners"><div class="track js-track">' + cfg.banners.map((b) => '<div class="slide"' + (b.produk_id ? ' data-open="' + esc(b.produk_id) + '"' : '') + '>' + (b.img_url ? '<img src="' + esc(b.img_url) + '" alt="' + esc(b.judul || '') + '">' : '<div class="ph"></div>') + (b.judul || b.sub ? '<div class="cap"><b>' + esc(b.judul || '') + '</b>' + (b.sub ? '<span>' + esc(b.sub) + '</span>' : '') + '</div>' : '') + '</div>').join('') + '</div>' +
        (cfg.banners.length > 1 ? '<div class="dots">' + cfg.banners.map((b, i) => '<i class="' + (i ? '' : 'on') + '"></i>').join('') + '</div>' : '') + '</section>' : '') +
      ((S.promos || []).length ? '<div class="spromos">' + S.promos.map((pr) => '<div class="spromo">' + icon('percent', 'sm') + '<div><b>' + esc(pr.nama) + '</b><span>' + esc(promoText(pr)) + (pr.selesai ? ' · s.d. ' + new Date(pr.selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '') + '</span></div></div>').join('') + '</div>' : '') +
      '<div class="ssearch"><div class="input-wrap">' + icon('search', 'sm') + '<input class="input js-q" type="search" placeholder="Cari menu…" autocomplete="off"></div></div>' +
      (best.length ? '<section class="sbest"><div class="sh2">' + icon('flame', 'sm') + 'Best Seller</div><div class="row-scroll">' + best.map((p) => '<div class="bcard" data-open="' + esc(p.produk_id) + '"><div class="bimg">' + img(p) + (p.habis ? '<span class="sbadge out">Habis</span>' : '') + '</div><div class="bn">' + esc(p.nama) + '</div><div class="bp sprice">' + priceHtml(p) + '</div></div>').join('') + '</div></section>' : '') +
      '<nav class="stabs js-tabs">' + groups.map((g, i) => '<button type="button" class="' + (i ? '' : 'on') + '" data-tab="' + esc(g.c.kategori_id) + '">' + esc(g.c.nama) + '</button>').join('') + '</nav>' +
      '<main class="slist js-list">' + groups.map((g) => '<section class="scat" id="cat-' + esc(g.c.kategori_id) + '" data-cat="' + esc(g.c.kategori_id) + '"><h3>' + esc(g.c.nama) + '</h3>' + g.items.map(itemRow).join('') + '</section>').join('') +
      '<div class="sempty js-empty" hidden>' + icon('search', 'lg') + '<div>Menu tidak ditemukan</div></div>' +
      '<footer class="sft">' + (t.alamat ? '<div>' + icon('pin', 'xs') + esc(t.alamat) + '</div>' : '') + (t.no_wa ? '<div>' + icon('phone', 'xs') + esc(t.no_wa) + '</div>' : '') + '<div class="faint" style="margin-top:6px">Ditenagai Qasir</div></footer></main>' +
      '<div class="scartbar js-cartbar" hidden></div>';
    bindPage(); renderCartBar(); paintOrderCount();
  }
  function refreshCards() { $$('.js-ctrl').forEach((c) => { const p = P()[c.dataset.pid]; if (p) c.innerHTML = ctrl(p); }); }
  function renderCartBar() {
    const bar = $('.js-cartbar'); if (!bar || !S || !S.aktif) return;
    const t = totals();
    bar.hidden = !t.count;
    if (t.count) bar.innerHTML = '<button class="in" data-act="cart" type="button"><span class="cnt">' + icon('bag', 'sm') + '<b>' + t.count + '</b></span><span class="grow" style="text-align:left"><span class="lbl">Lihat keranjang</span>' + (t.diskon ? '<span class="sv">Hemat ' + rp(t.diskon) + '</span>' : '') + '</span><b class="tot">' + rp(t.total - t.ongkir) + '</b>' + icon('chevron-right', 'sm') + '</button>';
  }
  function bindPage() {
    const root = $('#shop');
    root.onclick = (e) => {
      const add = e.target.closest('[data-add]'), dec = e.target.closest('[data-dec]'), op = e.target.closest('[data-open]'), act = e.target.closest('[data-act]'), tab = e.target.closest('[data-tab]');
      if (add) { e.stopPropagation(); quickAdd(add.dataset.add); return; }
      if (dec) { e.stopPropagation(); const l = cart.filter((x) => x.produk_id === dec.dataset.dec).pop(); if (l) { l.qty--; if (l.qty <= 0) cart.splice(cart.indexOf(l), 1); saveCart(); } return; }
      if (tab) { const sec = $('#cat-' + CSS.escape(tab.dataset.tab)); if (sec) window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' }); return; }
      if (act && act.dataset.act === 'cart') { openCart(); return; }
      if (act && act.dataset.act === 'orders') { openOrders(); return; }
      if (op) openProduct(op.dataset.open);
    };
    const q = $('.js-q');
    q.addEventListener('input', () => {
      const v = q.value.trim().toLowerCase(); let any = false;
      $$('.sitem').forEach((el) => { const p = P()[el.dataset.open]; const show = !v || p.nama.toLowerCase().indexOf(v) > -1 || String(p.deskripsi).toLowerCase().indexOf(v) > -1; el.hidden = !show; if (show) any = true; });
      $$('.scat').forEach((s) => { s.hidden = !$$('.sitem', s).some((x) => !x.hidden); });
      $('.js-empty').hidden = any;
    });
    // banner otomatis bergeser + titik indikator
    const tr = $('.js-track');
    if (tr && tr.children.length > 1) {
      let i = 0; const dots = $$('.sbanners .dots i');
      const paint = () => { const k = Math.round(tr.scrollLeft / tr.clientWidth); dots.forEach((d, j) => d.classList.toggle('on', j === k)); i = k; };
      tr.addEventListener('scroll', () => { clearTimeout(tr._t); tr._t = setTimeout(paint, 60); });
      clearInterval(window.__bn); window.__bn = setInterval(() => { if (document.hidden || sheets.length) return; i = (i + 1) % tr.children.length; tr.scrollTo({ left: i * tr.clientWidth, behavior: 'smooth' }); }, 4500);
    }
    // tab kategori mengikuti posisi gulir
    const tabs = $('.js-tabs'), secs = $$('.scat');
    if ('IntersectionObserver' in window && secs.length) {
      const io = new IntersectionObserver((ents) => {
        ents.forEach((en) => { if (!en.isIntersecting) return; const id = en.target.dataset.cat; $$('button', tabs).forEach((b) => { const on = b.dataset.tab === id; b.classList.toggle('on', on); if (on) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }); });
      }, { rootMargin: '-80px 0px -65% 0px' });
      secs.forEach((s) => io.observe(s));
    }
  }
  function quickAdd(pid) {
    const p = P()[pid]; if (!p || p.habis) return;
    if (varsOf(pid).length) { openProduct(pid); return; }
    if (p.sisa !== null && qtyOf(pid) + 1 > p.sisa) { toast('Stok ' + p.nama + ' tinggal ' + p.sisa, 'warn'); return; }
    const k = pid + '||', l = cart.find((x) => x.key === k);
    if (l) l.qty++; else cart.push({ key: k, produk_id: pid, varian_ids: [], qty: 1, catatan: '' });
    saveCart(); bump();
  }
  function bump() { const b = $('.js-cartbar .in'); if (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }

  /* ------------------------------------------------------------- Detail produk */
  function openProduct(pid) {
    const p = P()[pid]; if (!p) return;
    const vs = varsOf(pid), groups = [];
    vs.forEach((v) => { let g = groups.find((x) => x.nama === v.grup); if (!g) { g = { nama: v.grup, wajib: v.wajib_pilih, items: [] }; groups.push(g); } g.items.push(v); });
    const sel = {}; groups.forEach((g) => { sel[g.nama] = g.wajib ? [g.items[0].varian_id] : []; });
    let qty = 1;
    const lb = label(pid);
    const s = sheet({
      head: false, cls: 'pdetail',
      body: '<div class="pd-img">' + img(p) + '<button class="close-x" data-x type="button" aria-label="Tutup">' + icon('x', 'sm') + '</button></div>' +
        '<div class="pd-body"><div class="sb">' + badges(p) + '</div><h2>' + esc(p.nama) + '</h2><div class="sprice big">' + priceHtml(p) + '</div>' + (p.deskripsi ? '<p class="muted" style="margin:8px 0 0">' + esc(p.deskripsi) + '</p>' : '') +
        (lb && lb.baru && lb.teks ? '<div class="banner info" style="margin-top:12px">' + icon('sparkles', 'sm') + '<div><b>' + esc(lb.teks) + '</b></div></div>' : '') +
        groups.map((g) => '<div class="pd-g"><div class="row between"><b>' + esc(g.nama) + '</b><span class="pill ' + (g.wajib ? 'brand' : 'neutral') + ' sm">' + (g.wajib ? 'Pilih 1' : 'Opsional') + '</span></div>' +
          g.items.map((v) => '<button type="button" class="opt" data-g="' + esc(g.nama) + '" data-v="' + esc(v.varian_id) + '"><span class="' + (g.wajib ? 'radio' : 'cbx') + '"></span><span class="grow">' + esc(v.nama) + '</span>' + (v.tambahan_harga ? '<span class="muted">+' + rp(v.tambahan_harga) + '</span>' : '') + '</button>').join('') + '</div>').join('') +
        '<label class="field"><span class="lbl">Catatan (opsional)</span><input class="input" id="pdNote" maxlength="120" placeholder="contoh: less sugar, tanpa es"></label></div>',
      foot: p.habis ? '<button class="btn block lg" disabled type="button">Stok habis</button>' : '<div class="row"><div class="stepper lg"><button type="button" data-q="-1">' + icon('minus') + '</button><span class="v" id="pdQty">1</span><button type="button" class="plus" data-q="1">' + icon('plus') + '</button></div><button class="btn primary lg grow" id="pdAdd" type="button"></button></div>'
    });
    const paint = () => {
      $$('.opt', s.el).forEach((b) => b.classList.toggle('is-on', (sel[b.dataset.g] || []).indexOf(b.dataset.v) > -1));
      const extra = Object.values(sel).flat().reduce((a, id) => a + ((vs.find((v) => v.varian_id === id) || {}).tambahan_harga || 0), 0);
      const q = $('#pdQty', s.el); if (q) q.textContent = qty;
      const b = $('#pdAdd', s.el); if (b) b.textContent = 'Tambah · ' + rp((p.harga_jual + extra) * qty);
    };
    s.el.addEventListener('click', (e) => {
      const o = e.target.closest('.opt');
      if (o) { const g = groups.find((x) => x.nama === o.dataset.g); if (g.wajib) sel[g.nama] = [o.dataset.v]; else { const a = sel[g.nama], i = a.indexOf(o.dataset.v); if (i > -1) a.splice(i, 1); else a.push(o.dataset.v); } paint(); return; }
      const q = e.target.closest('[data-q]'); if (q) { qty = Math.max(1, Math.min(50, qty + Number(q.dataset.q))); paint(); }
    });
    const add = $('#pdAdd', s.el);
    if (add) add.onclick = () => {
      if (p.sisa !== null && qtyOf(pid) + qty > p.sisa) { toast('Stok ' + p.nama + ' tinggal ' + p.sisa, 'warn'); return; }
      const ids = groups.flatMap((g) => sel[g.nama]), note = $('#pdNote', s.el).value.trim();
      const k = pid + '|' + ids.slice().sort().join(',') + '|' + note.toLowerCase();
      const l = cart.find((x) => x.key === k);
      if (l) l.qty += qty; else cart.push({ key: k, produk_id: pid, varian_ids: ids, qty, catatan: note });
      saveCart(); s.close(); bump(); toast(p.nama + ' masuk keranjang', 'ok', 1300);
    };
    paint();
  }

  /* ------------------------------------------------------------- Keranjang & checkout */
  function openCart() {
    const lay = S.cfg.layanan || {}, bay = S.cfg.bayar || {};
    const types = [['AMBIL', 'Ambil di toko', 'bag', lay.ambil], ['ANTAR', 'Diantar', 'truck', lay.antar], ['MEJA', 'Makan di tempat', 'utensils', lay.meja]].filter((x) => x[3]);
    if (!st.tipe || !types.some((x) => x[0] === st.tipe)) st.tipe = MEJA && lay.meja ? 'MEJA' : (types[0] || [''])[0];
    const pays = [['DITEMPAT', 'Bayar di kasir / saat diterima', 'banknote', bay.ditempat], ['TRANSFER', 'Transfer / QRIS (unggah bukti)', 'qr-code', bay.transfer]].filter((x) => x[3]);
    if (!st.metode || !pays.some((x) => x[0] === st.metode)) st.metode = (pays[0] || [''])[0];
    const s = sheet({ title: 'Keranjang', cls: 'scheckout', body: '<div class="js-co"></div>', foot: '<div class="js-co-foot"></div>' });
    const f = st.form;
    const paint = () => {
      const t = totals();
      if (!t.count) { s.close(); return; }
      $('.js-co', s.el).innerHTML =
        '<div class="co-lines">' + t.lines.map((l) => '<div class="co-line"><div class="thumb">' + img(l.p) + '</div><div class="grow" style="min-width:0"><div class="t ellipsis">' + esc(l.p.nama) + '</div>' + (l.vs.length ? '<div class="s">' + esc(l.vs.map((v) => v.nama).join(', ')) + '</div>' : '') + (l.catatan ? '<div class="s" style="color:var(--p-dark)">*' + esc(l.catatan) + '</div>' : '') +
          '<div class="s"><b style="color:var(--text)">' + rp(l.harga * l.qty - l.disc) + '</b>' + (l.disc ? ' <s>' + rp(l.harga * l.qty) + '</s>' : '') + '</div></div><div class="stepper"><button type="button" data-ld="' + esc(l.key) + '" aria-label="Kurangi">' + icon(l.qty > 1 ? 'minus' : 'trash', 'sm') + '</button><span class="v">' + l.qty + '</span><button type="button" class="plus" data-li="' + esc(l.key) + '" aria-label="Tambah">' + icon('plus', 'sm') + '</button></div></div>').join('') + '</div>' +
        '<div class="co-sec"><div class="co-h">Cara pesan</div><div class="co-types">' + types.map((x) => '<button type="button" class="co-type' + (st.tipe === x[0] ? ' on' : '') + '" data-tipe="' + x[0] + '"' + (MEJA && lay.meja && x[0] !== 'MEJA' ? '' : '') + '>' + icon(x[2], 'sm') + '<span>' + x[1] + '</span></button>').join('') + '</div>' +
        (st.tipe === 'MEJA' ? '<label class="field"><span class="lbl">Nomor meja</span><input class="input" id="coMeja" value="' + esc(MEJA || f.meja || '') + '"' + (MEJA ? ' readonly' : '') + ' inputmode="numeric" placeholder="contoh: 5"></label>' : '') +
        (st.tipe === 'ANTAR' ? '<label class="field"><span class="lbl">Alamat lengkap</span><textarea class="textarea" id="coAlamat" rows="2" maxlength="300" placeholder="Jalan, nomor rumah, patokan">' + esc(f.alamat || '') + '</textarea></label>' +
          '<div class="help">' + icon('truck', 'xs') + ((S.cfg.ongkir || {}).mode === 'tetap' ? 'Ongkos kirim ' + rp(S.cfg.ongkir.nilai) : (S.cfg.ongkir || {}).mode === 'wa' ? 'Ongkos kirim dikonfirmasi toko lewat WhatsApp' : 'Gratis ongkir') + '</div>' : '') +
        (st.tipe === 'AMBIL' ? '<label class="field"><span class="lbl">Jam ambil (opsional)</span><select class="select" id="coJam"><option value="">Secepatnya</option>' + slots().map((x) => '<option' + (f.jam === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label>' : '') + '</div>' +
        '<div class="co-sec"><div class="co-h">Data pemesan</div><label class="field"><span class="lbl">Nama</span><input class="input" id="coNama" maxlength="60" autocomplete="name" value="' + esc(f.nama || '') + '" placeholder="Nama Anda"></label>' +
        '<label class="field"><span class="lbl">No. WhatsApp</span><input class="input" id="coHp" inputmode="tel" autocomplete="tel" maxlength="16" value="' + esc(f.no_hp || '') + '" placeholder="08xxxxxxxxxx"></label>' +
        '<label class="field"><span class="lbl">Catatan untuk toko (opsional)</span><input class="input" id="coCat" maxlength="200" placeholder="contoh: tolong dipisah plastiknya"></label>' +
        '<input id="coWeb" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0" aria-hidden="true"></div>' +
        '<div class="co-sec"><div class="co-h">Pembayaran</div>' + pays.map((x) => '<button type="button" class="opt' + (st.metode === x[0] ? ' is-on' : '') + '" data-pay="' + x[0] + '"><span class="radio"></span>' + icon(x[2], 'sm') + '<span class="grow">' + x[1] + '</span></button>').join('') +
        (st.metode === 'TRANSFER' ? '<div class="co-pay">' + (S.cfg.qris_url ? '<img src="' + esc(S.cfg.qris_url) + '" alt="QRIS" class="co-qris">' : '') + (S.cfg.rekening ? '<div class="co-rek">' + esc(S.cfg.rekening).replace(/\n/g, '<br>') + '</div>' : '') +
          '<div class="co-h" style="margin-top:12px">Bayar ' + rp(t.total) + ' lalu unggah bukti</div>' +
          (st.bukti ? '<img src="' + st.bukti + '" alt="Bukti" class="co-bukti">' : '') +
          '<div class="grid-2" style="margin-top:8px"><button class="btn outline" type="button" data-proof="1">' + icon('camera', 'sm') + 'Kamera</button><button class="btn outline" type="button" data-proof="0">' + icon('image', 'sm') + 'Galeri</button></div></div>' : '') + '</div>' +
        '<div class="co-sec co-sum"><div class="sum-row"><span class="muted">Subtotal</span><span class="v">' + rp(t.subtotal) + '</span></div>' +
        (t.diskon ? '<div class="sum-row disc"><span>Diskon' + (t.notaName ? ' · ' + esc(t.notaName) : '') + '</span><span class="v">-' + rp(t.diskon) + '</span></div>' : '') +
        (st.tipe === 'ANTAR' ? '<div class="sum-row"><span class="muted">Ongkos kirim</span><span class="v">' + ((S.cfg.ongkir || {}).mode === 'wa' ? 'dikonfirmasi' : t.ongkir ? rp(t.ongkir) : 'Gratis') + '</span></div>' : '') +
        '<div class="sum-row" style="font-size:17px"><b>Total</b><b class="v" style="color:var(--p)">' + rp(t.total) + '</b></div>' +
        (S.cfg.min_order && t.total - t.ongkir < S.cfg.min_order ? '<div class="banner warn" style="margin-top:8px">' + icon('alert', 'sm') + '<div>Minimal pemesanan ' + rp(S.cfg.min_order) + '.</div></div>' : '') + '</div>';
      $('.js-co-foot', s.el).innerHTML = canOrder() ? '<button class="btn primary block lg" id="coGo" type="button">' + icon('check', 'sm') + 'Pesan Sekarang · ' + rp(t.total) + '</button>' : '<button class="btn block lg" disabled type="button">Toko sedang tutup</button>';
      const go = $('#coGo', s.el); if (go) go.onclick = () => submit(s, go);
    };
    const keep = () => { const g = (id) => { const el = $(id, s.el); return el ? el.value.trim() : undefined; }; ['nama', 'no_hp', 'alamat', 'meja', 'jam'].forEach((k) => { const v = g({ nama: '#coNama', no_hp: '#coHp', alamat: '#coAlamat', meja: '#coMeja', jam: '#coJam' }[k]); if (v !== undefined) f[k] = v; }); LS.set('form', { nama: f.nama, no_hp: f.no_hp, alamat: f.alamat }); };
    s.el.addEventListener('input', keep);
    s.el.addEventListener('click', async (e) => {
      const li = e.target.closest('[data-li]'), ld = e.target.closest('[data-ld]'), tp = e.target.closest('[data-tipe]'), py = e.target.closest('[data-pay]'), pf = e.target.closest('[data-proof]');
      if (li || ld) { keep(); const l = cart.find((x) => x.key === (li || ld).dataset[li ? 'li' : 'ld']); if (!l) return; const p = P()[l.produk_id]; if (li && p.sisa !== null && qtyOf(p.produk_id) + 1 > p.sisa) { toast('Stok tinggal ' + p.sisa, 'warn'); return; } l.qty += li ? 1 : -1; if (l.qty <= 0) cart.splice(cart.indexOf(l), 1); saveCart(); paint(); return; }
      if (tp) { keep(); st.tipe = tp.dataset.tipe; paint(); return; }
      if (py) { keep(); st.metode = py.dataset.pay; paint(); return; }
      if (pf) {
        keep();
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; if (pf.dataset.proof === '1') inp.setAttribute('capture', 'environment');
        inp.onchange = async () => { const file = inp.files && inp.files[0]; if (!file) return; try { st.bukti = await compress(file, 1280, 250 * 1024); paint(); } catch (err) { toast(err.message, 'bad'); } };
        inp.click();
      }
    });
    paint();
  }
  function slots() {
    const out = [], d = new Date(); d.setMinutes(Math.ceil((d.getMinutes() + 20) / 15) * 15, 0, 0);
    for (let i = 0; i < 16; i++) { out.push(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')); d.setMinutes(d.getMinutes() + 15); if (d.getHours() >= 23) break; }
    return out;
  }
  const waNum = (hp) => { let n = String(hp || '').replace(/\D/g, ''); if (n.startsWith('0')) n = '62' + n.slice(1); return n; };
  let reqId = '';
  async function submit(s, btn) {
    const f = st.form, g = (id) => { const el = $(id, s.el); return el ? el.value.trim() : ''; };
    const data = { nama: g('#coNama'), no_hp: g('#coHp'), tipe: st.tipe, meja: g('#coMeja'), alamat: g('#coAlamat'), jam_ambil: g('#coJam'), catatan: g('#coCat'), metode: st.metode, website: g('#coWeb'),
      items: cart.map((l) => ({ produk_id: l.produk_id, varian_ids: l.varian_ids, qty: l.qty, catatan: l.catatan })), buktiDataUrl: st.metode === 'TRANSFER' ? st.bukti || '' : '' };
    if (data.nama.length < 2) { toast('Isi nama Anda', 'warn'); $('#coNama', s.el).focus(); return; }
    if (!/^\+?\d{9,15}$/.test(data.no_hp.replace(/[\s-]/g, ''))) { toast('Nomor WhatsApp belum benar', 'warn'); $('#coHp', s.el).focus(); return; }
    data.no_hp = data.no_hp.replace(/[\s-]/g, '');
    if (st.tipe === 'ANTAR' && data.alamat.length < 8) { toast('Isi alamat lengkap', 'warn'); return; }
    if (st.tipe === 'MEJA' && !data.meja) { toast('Isi nomor meja', 'warn'); return; }
    if (st.metode === 'TRANSFER' && !st.bukti) { toast('Unggah foto bukti pembayaran dulu', 'warn'); return; }
    if (!navigator.onLine) { toast('Tidak ada internet. Periksa koneksi lalu coba lagi.', 'bad'); return; }
    busy(btn, true);
    if (!reqId) reqId = uuid();                                  // dipakai ulang saat percobaan ulang → tidak dobel
    const r = await api('placeOrder', data, { reqId, tries: 3, timeout: 60000 });
    busy(btn, false);
    if (!r.ok) { toast(r.error || 'Gagal mengirim pesanan', 'bad', 5000); if (!r.network) reqId = ''; return; }
    reqId = '';
    const hist = LS.get('orders', []); hist.unshift({ pesanan_id: r.data.pesanan_id, token: r.data.token, kode: r.data.kode, waktu: new Date().toISOString(), total: r.data.total });
    LS.set('orders', hist.slice(0, 20));
    cart = []; st.bukti = null; saveCart(); s.close();
    openStatus(hist[0], true);
  }

  /* ------------------------------------------------------------- Status pesanan */
  const STATUS = { BARU: ['Menunggu konfirmasi', 'clock', 'warn'], DITERIMA: ['Diterima & sedang disiapkan', 'check', 'info'], SELESAI: ['Selesai', 'check', 'ok'], DITOLAK: ['Ditolak', 'x', 'bad'], DIBATALKAN: ['Dibatalkan', 'x', 'bad'] };
  function openStatus(o, fresh) {
    const s = sheet({ title: 'Pesanan ' + o.kode, body: '<div class="js-st"><div class="spinner" style="margin:30px auto"></div></div>', foot: '<button class="btn outline block lg" data-x type="button">Kembali ke menu</button>' });
    s.keep = true; let stop = false, last = '';
    s.el.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) stop = true; });
    const tick = async () => {
      if (stop || !s.el.isConnected) return;
      const r = await api('orderStatus', { pesanan_id: o.pesanan_id, token: o.token }, { tries: 1 });
      if (stop || !s.el.isConnected) return;
      if (r.ok) {
        const d = r.data, m = STATUS[d.status] || [d.status, 'info', 'neutral'];
        if (last && last !== d.status) { try { navigator.vibrate && navigator.vibrate(120); } catch (e) {} toast('Status pesanan: ' + m[0], d.status === 'DITOLAK' ? 'bad' : 'ok', 4000); }
        last = d.status;
        const steps = ['BARU', 'DITERIMA', 'SELESAI'], idx = steps.indexOf(d.status);
        $('.js-st', s.el).innerHTML = (fresh ? '<div class="st-ok"><div class="success-ic">' + icon('check', 'lg') + '</div><h3>Pesanan terkirim!</h3><p class="muted">Simpan kode ini. Halaman ini memperbarui status otomatis.</p></div>' : '') +
          '<div class="st-code">' + esc(d.kode) + '</div>' +
          '<div class="banner ' + m[2] + '" style="margin-top:12px">' + icon(m[1], 'sm') + '<div><b>' + m[0] + '</b>' + (d.alasan ? '<br>Alasan: ' + esc(d.alasan) : '') + '</div></div>' +
          (idx > -1 ? '<ol class="st-steps">' + ['Pesanan dikirim', 'Diterima toko', 'Selesai'].map((x, i) => '<li class="' + (i <= idx ? 'done' : '') + '">' + x + '</li>').join('') + '</ol>' : '') +
          '<div class="card pad" style="margin-top:12px">' + d.items.map((l) => '<div class="sum-row"><span>' + l.qty + '× ' + esc(l.nama_produk) + (l.varian_ringkas ? ' <span class="muted">(' + esc(l.varian_ringkas) + ')</span>' : '') + '</span><span class="v">' + rp(l.subtotal) + '</span></div>').join('') +
          (d.diskon ? '<div class="sum-row disc"><span>Diskon</span><span class="v">-' + rp(d.diskon) + '</span></div>' : '') + (d.ongkir ? '<div class="sum-row"><span class="muted">Ongkos kirim</span><span class="v">' + rp(d.ongkir) + '</span></div>' : '') + '<div class="divider"></div><div class="sum-row"><b>Total</b><b class="v">' + rp(d.total) + '</b></div><div class="muted" style="font-size:13px;margin-top:4px">' + ({ AMBIL: 'Ambil di toko', ANTAR: 'Diantar', MEJA: 'Meja ' + esc(d.meja) }[d.tipe] || '') + ' · ' + (d.metode === 'TRANSFER' ? 'Transfer/QRIS' : 'Bayar di tempat') + '</div></div>' +
          (S.toko.no_wa ? '<a class="btn outline block" style="margin-top:12px;color:#16A34A" target="_blank" href="https://wa.me/' + waNum(S.toko.no_wa) + '?text=' + encodeURIComponent('Halo, saya ingin menanyakan pesanan ' + d.kode) + '">' + icon('whatsapp', 'sm') + 'Tanya toko via WhatsApp</a>' : '');
        const h = LS.get('orders', []), it = h.find((x) => x.pesanan_id === o.pesanan_id); if (it) { it.status = d.status; LS.set('orders', h); paintOrderCount(); }
        if (d.status === 'SELESAI' || d.status === 'DITOLAK' || d.status === 'DIBATALKAN') return;
      } else if (!last) $('.js-st', s.el).innerHTML = '<div class="banner warn">' + icon('wifi-off', 'sm') + '<div>' + esc(r.error || 'Gagal memuat status') + '. Mencoba lagi…</div></div>';
      setTimeout(tick, document.hidden ? 20000 : 8000);
    };
    tick();
  }
  function paintOrderCount() {
    const n = LS.get('orders', []).filter((o) => !o.status || o.status === 'BARU' || o.status === 'DITERIMA').length, b = $('.js-ord-count');
    if (b) { b.hidden = !n; b.textContent = n; }
  }
  function openOrders() {
    const h = LS.get('orders', []);
    const s = sheet({ title: 'Pesanan saya', body: h.length ? h.map((o, i) => { const m = STATUS[o.status] || ['Ketuk untuk melihat status', 'clock', 'neutral']; return '<button class="list-item" type="button" data-i="' + i + '" style="width:100%;text-align:left"><div class="grow"><div class="t mono">' + esc(o.kode) + '</div><div class="s">' + new Date(o.waktu).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + rp(o.total) + '</div></div><span class="pill ' + m[2] + ' sm">' + m[0] + '</span></button>'; }).join('') : '<div class="empty"><div class="ico-box">' + icon('receipt', 'lg') + '</div><div class="t">Belum ada pesanan</div><div>Pesanan dari perangkat ini akan muncul di sini.</div></div>' });
    s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { s.close(); openStatus(h[Number(b.dataset.i)]); } });
  }

  /* ------------------------------------------------------------- Start & pembaruan langsung */
  // Status toko (aktif / buka / tutup) diperbarui otomatis tanpa muat ulang:
  //  • perangkat lain  → cek versi data ke server tiap 10 dtk (respons kecil bila tak berubah)
  //  • perangkat sama  → admin menyimpan → sinyal localStorage 'qshop:ping' → muat seketika
  let loading = null, lastAct = Date.now(), pollT = 0;
  function applyShop(d, cachedPrev) {
    const prev = cachedPrev || S;
    const changed = !prev || JSON.stringify(prev) !== JSON.stringify(d);
    S = d; LS.set('shop', S);
    if (changed) {
      if (prev && prev.aktif !== undefined) {
        if (prev.aktif && !d.aktif) { sheets.filter((x) => !x.keep).slice().forEach((x) => x.close()); toast('Pemesanan online baru saja ditutup oleh toko.', 'warn', 4000); }
        else if (!prev.aktif && d.aktif) toast('Toko online sudah dibuka — silakan pesan! 🎉', 'ok', 3500);
        else if (d.aktif && prev.buka !== d.buka) toast(d.buka ? 'Toko sekarang BUKA 🎉' : 'Toko baru saja tutup', d.buka ? 'ok' : 'warn', 3500);
      }
      const y = window.scrollY, q = $('.js-q') ? $('.js-q').value : '';
      render(); window.scrollTo(0, y);
      const qi = $('.js-q'); if (q && qi) { qi.value = q; qi.dispatchEvent(new Event('input')); }
    }
    const pm = P(); cart = cart.filter((l) => pm[l.produk_id]); LS.set('cart', cart); renderCartBar();
  }
  async function load(force) {
    if (loading) return loading;
    loading = (async () => {
      let stale = false; try { stale = !!localStorage.getItem('qshop:stale'); } catch (e) {}
      const cached = LS.get('shop', null);
      if (!S && cached && !stale) { S = cached; render(); }
      const quick = S && S.v && !force && !stale;
      const r = await api('shopInfo', quick ? { v: S.v } : {}, { tries: S ? 1 : 3, timeout: 20000 });
      if (r.ok) {
        try { localStorage.removeItem('qshop:stale'); } catch (e) {}
        if (r.data && r.data.same) return;           // tidak ada perubahan
        applyShop(r.data, S || cached);
      } else if (!S) {
        if (cached) { S = cached; render(); return; }
        $('#shop').innerHTML = '<div class="shop-off">' + icon('wifi-off', 'lg') + '<h2>Gagal memuat toko</h2><p class="muted">' + esc(r.error || '') + '</p><button class="btn primary" type="button" onclick="location.reload()">' + icon('refresh', 'sm') + 'Coba lagi</button></div>';
      }
    })();
    try { await loading; } finally { loading = null; }
  }
  function schedule() {
    clearTimeout(pollT);
    const idle = Date.now() - lastAct > 10 * 60000;            // 10 menit tanpa aktivitas → hemat kuota
    pollT = setTimeout(async () => { if (document.visibilityState === 'visible' && navigator.onLine !== false) await load(); schedule(); }, idle ? 45000 : 10000);
  }
  ['pointerdown', 'keydown', 'scroll'].forEach((ev) => addEventListener(ev, () => { const was = Date.now() - lastAct > 10 * 60000; lastAct = Date.now(); if (was) { load(); schedule(); } }, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S) { load(); schedule(); } });
  addEventListener('online', () => load());
  addEventListener('focus', () => { if (S) load(); });
  addEventListener('storage', (e) => { if (e.key === 'qshop:ping') load(true); });
  try { if ('BroadcastChannel' in window) new BroadcastChannel('qasir-shop').onmessage = () => load(true); } catch (e) {}
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheets.length) sheets[sheets.length - 1].close(); });
  const start = () => { load(); schedule(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
