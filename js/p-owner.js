/* ============================================================================
   QASIR — p-owner.js · Dashboard, Buka/Tutup Toko, Laporan, Produk, HPP,
   Bahan & Biaya, Promo, Karyawan, Pengaturan, Perlu Ditinjau
   Penulisan data master: optimistic UI (layar langsung berubah) + rollback.
   ========================================================================== */
'use strict';

/** Tulis data master: terapkan lokal dulu (instan), kirim di latar, batalkan bila gagal. */
async function ownerWrite(action, data, o) {
  o = o || {};
  if (!navigator.onLine) { toast('Mengubah data ini butuh koneksi internet.', 'warn'); return null; }
  if (!Auth.tokenValid()) { Auth.reauth(); return null; }
  const undo = o.apply ? o.apply() : null;
  if (o.apply) { Boot.persist(); emit('boot'); }
  if (o.instant !== false && o.msg) toast(o.msg, 'ok', 1500);
  const r = await api(action, data);
  if (!r.ok) {
    if (typeof undo === 'function') { undo(); Boot.persist(); emit('boot'); }
    toast('Gagal menyimpan: ' + (r.error || 'coba lagi'), 'bad', 5000);
    return null;
  }
  if (o.onOk) { o.onOk(r.data); Boot.persist(); emit('boot'); }
  Sync.bootSoon();
  return r;
}
const replaceIn = (arr, key, obj) => { const i = arr.findIndex((x) => x[key] === obj[key]); const prev = i > -1 ? arr[i] : null; if (i > -1) arr[i] = obj; else arr.push(obj); return () => { const j = arr.findIndex((x) => x[key] === obj[key]); if (prev) arr[j] = prev; else if (j > -1) arr.splice(j, 1); }; };
const removeIn = (arr, key, id) => { const i = arr.findIndex((x) => x[key] === id); const prev = i > -1 ? arr[i] : null; if (i > -1) arr.splice(i, 1); return () => { if (prev) arr.splice(i, 0, prev); }; };

/* ============================================================== GRAFIK SVG */
function lineChart(series, o) {
  o = o || {}; const W = 340, H = 150, PL = 8, PR = 8, PT = 16, PB = 26;
  if (!series.length) return '';
  const max = Math.max(1, ...series.map((s) => s.omzet));
  const x = (i) => PL + (series.length === 1 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (series.length - 1));
  const y = (v) => PT + (1 - v / max) * (H - PT - PB);
  const pts = series.map((s, i) => [x(i), y(s.omzet)]);
  let d = 'M' + pts[0][0] + ',' + pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const cy = (v) => Math.max(PT, Math.min(H - PB, v));   // cegah kurva turun di bawah garis nol
    d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6) + ',' + cy(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6) + ',' + cy(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + p2[0] + ',' + p2[1];
  }
  const area = d + ' L' + pts[pts.length - 1][0] + ',' + (H - PB) + ' L' + pts[0][0] + ',' + (H - PB) + ' Z';
  const step = Math.ceil(series.length / 8);
  const labels = series.map((s, i) => (i % step === 0 || i === series.length - 1) ? '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="' + (i === series.length - 1 ? '#1F2937' : '#9CA3AF') + '" font-weight="' + (i === series.length - 1 ? 700 : 500) + '">' + esc(series.length <= 8 ? HARI[new Date(s.tanggal + 'T00:00').getDay()] : s.tanggal.slice(8) + '/' + s.tanggal.slice(5, 7)) + '</text>' : '').join('');
  const short = (v) => v >= 1e6 ? (v / 1e6).toFixed(1).replace('.0', '') + 'jt' : v >= 1e3 ? Math.round(v / 1e3) + 'rb' : v;
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafik penjualan"><defs><linearGradient id="lg1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--p)" stop-opacity=".28"/><stop offset="1" stop-color="var(--p)" stop-opacity="0"/></linearGradient></defs>' +
    '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + (H - PB) + '" y2="' + (H - PB) + '" stroke="#E5E7EB"/><line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + y(max / 2) + '" y2="' + y(max / 2) + '" stroke="#F0F1F4" stroke-dasharray="3 4"/>' +
    (series.some((x) => x.omzet > 0) ? '<text x="' + PL + '" y="11" font-size="10" fill="#9CA3AF">Rp' + short(max) + '</text>' : '<text x="' + W / 2 + '" y="' + (H / 2 - 4) + '" text-anchor="middle" font-size="12" fill="#9CA3AF">Belum ada penjualan</text>') +
    '<path d="' + area + '" fill="url(#lg1)"/><path d="' + d + '" fill="none" stroke="var(--p)" stroke-width="2.5" stroke-linecap="round"/>' +
    pts.map((p, i) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === pts.length - 1 ? 4.5 : 3) + '" fill="' + (i === pts.length - 1 ? 'var(--p)' : '#fff') + '" stroke="var(--p)" stroke-width="2"><title>' + esc(series[i].tanggal) + ': ' + rp(series[i].omzet) + '</title></circle>').join('') + labels + '</svg>';
}
function donut(parts, center) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1, R = 42, C = 2 * Math.PI * R;
  let off = 0;
  return '<svg viewBox="0 0 120 120" width="128" height="128" role="img" aria-label="Komposisi metode bayar"><circle cx="60" cy="60" r="' + R + '" fill="none" stroke="#F0F1F4" stroke-width="16"/>' +
    parts.filter((p) => p.v > 0).map((p) => { const len = (p.v / total) * C; const s = '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="' + p.c + '" stroke-width="16" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + -off + '" transform="rotate(-90 60 60)"/>'; off += len; return s; }).join('') +
    '<text x="60" y="58" text-anchor="middle" font-size="10" fill="#6B7280" font-weight="700">TOTAL</text><text x="60" y="74" text-anchor="middle" font-size="14" font-weight="800" fill="#1F2937">' + esc(center) + '</text></svg>';
}

/* ============================================================= DASHBOARD */
function periodRange(p, custom) {
  const now = new Date();
  if (p === '7d') return { from: daysAgo(6), to: endOfDay(now), prevFrom: daysAgo(13), prevTo: endOfDay(daysAgo(7)), label: '7 hari terakhir' };
  if (p === '30d') return { from: daysAgo(29), to: endOfDay(now), prevFrom: daysAgo(59), prevTo: endOfDay(daysAgo(30)), label: '30 hari terakhir' };
  if (p === 'month') { const f = new Date(now.getFullYear(), now.getMonth(), 1); const pf = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { from: f, to: endOfDay(now), prevFrom: pf, prevTo: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)), label: 'bulan ini' }; }
  if (p === 'custom' && custom) { const f = startOfDay(custom.from), t = endOfDay(custom.to), span = t - f; return { from: f, to: t, prevFrom: new Date(f - span - 1), prevTo: new Date(f - 1), label: fmtDate(f) + ' – ' + fmtDate(t) }; }
  return { from: startOfDay(now), to: endOfDay(now), prevFrom: daysAgo(1), prevTo: endOfDay(daysAgo(1)), label: 'hari ini' };
}
page('dashboard', {
  role: 'OWNER', keepScroll: true,
  st: { p: 'today', custom: null },
  template() {
    return '<header class="topbar"><div class="in"><span class="js-logo">' + logoHtml() + '</span><div class="grow"><h1 class="ellipsis js-name"></h1><div class="sub">Halo, ' + esc(App.user.nama) + ' 👋</div></div><span class="js-store-pill"></span>' + syncPill() + '</div></header>' +
      '<div class="wrap" style="padding-top:14px"><div class="row"><div class="seg light grow js-period"></div></div><div class="js-body" style="margin-top:14px">' + skeletonList(4, 110) + '</div></div>';
  },
  init(el) { on('store', () => { if (App.current === 'dashboard') { this.renderStore(el); if (this.data) this.render(el, this.data); } }); on('synced', () => { if (App.current === 'dashboard') this.load(el); }); },
  show(el) { $('.js-name', el).textContent = App.settings.nama_toko || 'Qasir'; $('.js-logo', el).innerHTML = logoHtml(); this.renderStore(el); this.renderPeriod(el); this.load(el); },
  renderStore(el) {
    const s = App.store;
    $('.js-store-pill', el).innerHTML = s ? '<button class="btn xs outline" data-act="close-store" type="button" style="color:var(--bad);border-color:#FECACA">' + icon('power', 'xs') + '<span class="hide-sm">Tutup Toko</span></button>' : '<button class="btn xs primary" data-act="open-store" type="button">' + icon('store', 'xs') + '<span class="hide-sm">Buka Toko</span></button>';
  },
  renderPeriod(el) {
    $('.js-period', el).innerHTML = [['today', 'Hari ini'], ['7d', '7 Hari'], ['30d', '30 Hari'], ['month', 'Bulan ini']].map((x) => '<button class="' + (this.st.p === x[0] ? 'on' : '') + '" data-act="period" data-p="' + x[0] + '" type="button">' + x[1] + '</button>').join('') +
      '<button class="' + (this.st.p === 'custom' ? 'on' : '') + '" data-act="custom" type="button" style="flex:0 0 46px" aria-label="Pilih tanggal">' + icon('calendar', 'sm') + '</button>';
  },
  load(el) {
    const r = periodRange(this.st.p, this.st.custom);
    this.range = r;
    swr('dash:' + this.st.p + ':' + ymd(r.from) + ':' + ymd(r.to), 'getDashboard', { from: r.from.toISOString(), to: r.to.toISOString(), prevFrom: r.prevFrom.toISOString(), prevTo: r.prevTo.toISOString() },
      (d) => { this.data = d; this.render(el, d); }, { fresh: 25000, onError: (e) => { $('.js-body', el).innerHTML = retryBox(e.error); } });
  },
  render(el, d) {
    const st = App.settings, r = this.range;
    const chg = d.prevOmzet > 0 ? Math.round(((d.omzet - d.prevOmzet) / d.prevOmzet) * 100) : null;
    const margin = d.omzet > 0 ? Math.round((d.laba / d.omzet) * 1000) / 10 : 0;
    const top = d.top[0];
    const mColors = { TUNAI: '#16A34A', QRIS: '#2563EB', TRANSFER: '#7C3AED', UTANG: '#D97706' };
    const mTotal = Object.values(d.methods).reduce((s, v) => s + v, 0) || 1;
    const store = App.store;
    const devs = (d.devices || []).filter((x) => x.status_aktif);
    const seriesTotal = d.series.reduce((s, x) => s + x.omzet, 0);
    $('.js-body', el).innerHTML =
      (!store ? '<div class="banner warn" style="margin-bottom:12px">' + icon('lock', 'sm') + '<div class="grow"><b>Toko sedang tutup.</b> Buka toko agar kasir bisa menyimpan transaksi.</div><button class="btn primary sm" data-act="open-store" type="button">Buka</button></div>'
        : '<div class="banner ok" style="margin-bottom:12px">' + icon('store', 'sm') + '<div class="grow"><b>Toko buka</b> sejak ' + fmtTime(store.dibuka_pada) + ' · modal ' + rp(store.modal_awal) + '</div></div>') +
      (App.sync.pending ? '<div class="banner info" style="margin-bottom:12px">' + icon('clock', 'sm') + '<div>' + App.sync.pending + ' data di perangkat ini belum tersinkron, sehingga belum masuk angka di bawah.</div></div>' : '') +
      '<div class="desk-2"><div class="stack">' +
      '<div class="hero"><div class="k">OMZET ' + esc(r.label.toUpperCase()) + '</div><div class="v">' + rp(d.omzet) + '</div>' + (chg !== null ? '<span class="chg">' + (chg >= 0 ? '↑ ' : '↓ ') + Math.abs(chg) + '% vs periode lalu</span>' : '') + '</div>' +
      '<div class="grid-3"><div class="mini"><span class="ico-box info">' + icon('receipt', 'sm') + '</span><div class="k">Transaksi</div><div class="v">' + d.trx + '</div><div class="s">' + d.batal.length + ' dibatalkan</div></div>' +
      '<div class="mini"><span class="ico-box ok">' + icon('trending-up', 'sm') + '</span><div class="k">Laba kotor</div><div class="v" style="color:var(--ok)">' + rp(d.laba) + '</div><div class="s">Margin ' + margin + '%</div></div>' +
      '<div class="mini"><span class="ico-box warn">' + icon('crown', 'sm') + '</span><div class="k">Terlaris</div><div class="v" style="font-size:14px">' + esc(top ? top.nama : '-') + '</div><div class="s" style="color:var(--warn);font-weight:700">' + (top ? fmtNum(top.qty) + ' terjual' : '') + '</div></div></div>' +
      '<div class="card pad"><div class="card-h"><div><div style="font-weight:700">Penjualan ' + (d.series.length <= 8 ? '7 hari terakhir' : esc(r.label)) + '</div><div class="muted" style="font-size:12.5px">Total omzet periode grafik</div></div><span class="pill brand">' + rp(seriesTotal) + '</span></div>' + lineChart(d.series) + '</div>' +
      '<div class="card pad"><div style="font-weight:700;margin-bottom:12px">Metode bayar</div><div class="row" style="gap:18px">' + donut(Object.keys(mColors).map((k) => ({ v: d.methods[k] || 0, c: mColors[k] })), d.trx + ' trx') +
      '<div class="legend grow">' + Object.keys(mColors).map((k) => '<div class="li"><span class="sw" style="background:' + mColors[k] + '"></span>' + METODE_LABEL[k] + '<span class="v">' + Math.round(((d.methods[k] || 0) / mTotal) * 100) + '%</span></div>').join('') + '</div></div></div>' +
      '</div><div class="stack">' +
      '<div class="card pad"><div class="card-h"><span class="sec-title">' + icon('smartphone', 'sm') + 'Perangkat kasir</span><span class="muted" style="font-size:12.5px">' + devs.length + ' aktif</span></div>' +
      (devs.length ? devs.map((v, i) => '<div class="list-item"><span class="dev-code" style="background:' + ['var(--p-soft)', 'var(--info-soft)', 'var(--warn-soft)', 'var(--ok-soft)'][i % 4] + ';color:' + ['var(--p-dark)', 'var(--info)', 'var(--warn)', 'var(--ok)'][i % 4] + '">' + esc(v.kode) + '</span><div class="grow"><div class="t">' + esc(v.kode + ' · ' + (v.user || '-')) + '</div><div class="s">' + (v.sinkron_terakhir ? 'Sinkron ' + fmtDT(v.sinkron_terakhir) : 'Belum pernah sinkron') + '</div></div>' + (v.pending ? '<span class="pill warn sm"><span class="dot"></span>' + v.pending + ' menunggu</span>' : '<span class="pill ok sm"><span class="dot"></span>Tersinkron</span>') + '</div>').join('') : '<div class="muted">Belum ada perangkat.</div>') + '</div>' +
      (d.minus ? '<a class="banner bad" href="#/transaksi">' + icon('alert', 'sm') + '<div><b>' + d.minus + ' transaksi stok minus</b> — perlu dicek (transaksi offline dari beberapa kasir).</div></a>' : '') +
      '<div class="card pad alert-card"><div class="card-h"><span class="sec-title" style="color:var(--text)">' + icon('alert', 'sm') + 'Stok menipis (' + d.lowStock.length + ')</span><a class="link-btn" href="#/stok">Lihat Stok →</a></div>' +
      (d.lowStock.length ? d.lowStock.slice(0, 6).map((s) => '<div class="list-item"><div class="grow"><div class="t">' + esc(s.nama) + '</div><div class="s">' + (s.jenis === 'BAHAN' ? 'Bahan baku' : 'Produk') + ' · min ' + fmtNum(s.min) + '</div></div><span class="pill ' + (s.stok <= 0 ? 'bad' : 'warn') + ' sm">' + (s.stok <= 0 ? 'habis' : 'sisa ' + fmtNum(s.stok) + ' ' + esc(s.satuan || '')) + '</span></div>').join('') : '<div class="muted">Semua stok aman 👍</div>') + '</div>' +
      '<div class="card pad alert-card"><div class="card-h"><span class="sec-title" style="color:var(--text)">' + icon('notebook', 'sm') + 'Utang jatuh tempo (' + d.debtsDue.length + ')</span><span class="muted" style="font-size:12.5px">≥ ' + esc(st.jatuh_tempo_hari || 7) + ' hari</span></div>' +
      (d.debtsDue.length ? d.debtsDue.slice(0, 5).map((u) => '<div class="list-item"><div class="grow"><div class="t">' + esc(u.nama) + '</div><div class="s num">' + rp(u.sisa) + ' · ' + u.umur + ' hari</div></div>' + (u.no_hp ? '<a class="btn xs outline" style="color:var(--ok);border-color:#BBF7D0" target="_blank" href="https://wa.me/' + waNumber(u.no_hp) + '?text=' + encodeURIComponent(debtWaText({ nama: u.nama, sisa_utang: u.sisa })) + '">' + icon('whatsapp', 'xs') + 'Tagih WA</a>' : '') + '</div>').join('') : '<div class="muted">Tidak ada utang jatuh tempo.</div>') + '</div>' +
      '<div class="card pad alert-card bad"><div class="card-h"><span class="sec-title" style="color:var(--text)">' + icon('alert', 'sm') + 'Dibatalkan (' + d.batal.length + ')</span><span class="pill bad sm">AUDIT</span></div>' +
      (d.batal.length ? d.batal.slice(0, 5).map((b) => '<div class="list-item"><div class="grow"><div class="t mono" style="font-size:13px;text-decoration:line-through;color:var(--bad)">' + esc(b.no_nota) + ' · ' + rp(b.total) + '</div><div class="s">Alasan: "' + esc(b.alasan || '-') + '" · ' + esc(b.oleh || '-') + '</div></div></div>').join('') : '<div class="muted">Tidak ada pembatalan.</div>') + '</div>' +
      '</div></div><div style="height:12px"></div>';
  },
  actions: {
    period(a, e, el) { this.st.p = a.dataset.p; this.renderPeriod(el); this.load(el); },
    async custom(a, e, el) {
      const r = await dateRangeDialog(this.st.custom);
      if (r) { this.st.custom = r; this.st.p = 'custom'; this.renderPeriod(el); this.load(el); }
    },
    'open-store'() { openStoreSheet(); },
    'close-store'() { closeStoreSheet(); },
    retry(a, e, el) { this.load(el); }
  }
});
function dateRangeDialog(cur) {
  const f = cur ? ymd(cur.from) : ymd(daysAgo(6)), t = cur ? ymd(cur.to) : ymd(new Date());
  return dialog('<h3>Pilih rentang tanggal</h3><div class="grid-2" style="margin:12px 0"><label class="field"><span class="lbl">Dari</span><input class="input" type="date" data-f value="' + f + '"></label><label class="field" style="margin-top:0"><span class="lbl">Sampai</span><input class="input" type="date" data-t value="' + t + '"></label></div>' +
    '<div class="row" style="justify-content:flex-end"><button class="btn outline" data-no type="button">Batal</button><button class="btn primary" data-yes type="button">Terapkan</button></div>',
  (el, done) => { el.querySelector('[data-no]').onclick = () => done(null); el.querySelector('[data-yes]').onclick = () => { const a = el.querySelector('[data-f]').value, b = el.querySelector('[data-t]').value; if (!a || !b) return; done({ from: new Date(a + 'T00:00'), to: new Date(b + 'T00:00') }); }; });
}

/* ======================================================= BUKA / TUTUP TOKO */
function openStoreSheet() {
  if (!navigator.onLine) { toast('Membuka toko butuh internet', 'warn'); return; }
  const s = sheet({
    title: 'Buka Toko',
    body: '<div class="banner info">' + icon('info', 'sm') + '<div>Masukkan uang modal di laci kas untuk kembalian. Selisih kas dihitung saat tutup toko.</div></div>' +
      '<label class="field" style="margin-top:14px"><span class="lbl">Modal awal kas</span>' + moneyInput('id="moV" class="input big money"', '') + '</label>' +
      '<div class="chips wrap" style="margin-top:10px">' + [0, 100000, 200000, 300000, 500000].map((v) => '<button class="chip" type="button" data-v="' + v + '">' + (v ? rp(v) : 'Tanpa modal') + '</button>').join('') + '</div>',
    foot: '<button class="btn primary block lg" id="moOk" type="button">' + icon('store', 'sm') + 'Buka Toko Sekarang</button>'
  });
  const inp = $('#moV', s.el); inp.className = 'input big money';
  s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) inp.value = b.dataset.v === '0' ? '' : NF.format(b.dataset.v); });
  $('#moOk', s.el).onclick = async (e) => {
    busy(e.currentTarget, true);
    const r = await api('openStore', { modal_awal: parseMoney(inp.value) });
    busy(e.currentTarget, false);
    if (!r.ok) { toast(r.error, 'bad'); if (/sudah/.test(r.error)) Boot.refresh(true); return; }
    App.boot.store = r.data.store; Boot.persist(); emit('store'); emit('boot'); s.close();
    toast('Toko dibuka. Selamat berjualan!', 'ok');
  };
}
async function closeStoreSheet() {
  if (!navigator.onLine) { toast('Tutup toko butuh internet (untuk kirim laporan email).', 'warn'); return; }
  const s = sheet({ title: 'Tutup Toko', body: skeletonList(3, 70), foot: '<button class="btn danger block lg" id="clOk" type="button" disabled>' + icon('power', 'sm') + 'Tutup Toko & Kirim Laporan</button>' });
  if (App.sync.pending) await Sync.run();
  const r = await api('getCloseSummary', {});
  if (!s.el.isConnected) return;
  if (!r.ok) { $('.sh-body', s.el).innerHTML = retryBox(r.error); return; }
  const sm = r.data.summary, pend = (r.data.devices || []).filter((d) => d.pending > 0 && d.status_aktif);
  $('.sh-body', s.el).innerHTML = (pend.length ? '<div class="banner warn" style="margin-bottom:12px">' + icon('alert', 'sm') + '<div><b>Ada perangkat yang belum tersinkron:</b><br>' + pend.map((d) => esc(d.kode + ' · ' + (d.user || '-') + ' (' + d.pending + ' data)')).join('<br>') + '<br>Sebaiknya tunggu sinkron. Jika tetap ditutup, transaksi yang menyusul masuk ke laporan revisi.</div></div>' : '') +
    '<div class="hero" style="padding:16px"><div class="k">OMZET SESI INI</div><div class="v">' + rp(sm.total_penjualan) + '</div><div style="font-size:12.5px;opacity:.9">' + sm.jumlah_trx + ' transaksi · dibuka ' + fmtDT(sm.dibuka_pada) + '</div></div>' +
    '<div class="card pad" style="margin-top:12px">' +
    [['Tunai', sm.total_tunai], ['QRIS', sm.total_qris], ['Transfer', sm.total_transfer], ['Utang', sm.total_utang], ['Pelunasan utang (tunai)', sm.pelunasan_tunai], ['Modal awal', sm.modal_awal]].map((x) => '<div class="sum-row"><span class="muted">' + x[0] + '</span><span class="v">' + rp(x[1]) + '</span></div>').join('') +
    '<div class="sum-row"><span class="muted">Transaksi dibatalkan</span><span class="v" style="color:var(--bad)">' + sm.jumlah_batal + '</span></div><div class="divider"></div>' +
    '<div class="sum-row"><b>Kas seharusnya di laci</b><b class="v" style="font-size:18px">' + rp(sm.kas_seharusnya) + '</b></div></div>' +
    '<label class="field" style="margin-top:14px"><span class="lbl">Kas aktual (hitung uang di laci)</span>' + moneyInput('id="clKas" class="input big money"', sm.kas_seharusnya) + '</label><div class="js-diff"></div>' +
    '<div class="help">' + icon('info', 'xs') + 'Laporan (ringkasan + PDF) dikirim ke ' + esc(App.settings.email_owner || 'email pemilik') + ' dan disimpan di Google Drive.</div>';
  const kas = $('#clKas', s.el); kas.className = 'input big money';
  const diff = () => { const d = parseMoney(kas.value) - sm.kas_seharusnya; $('.js-diff', s.el).innerHTML = '<div class="change-box' + (d < 0 ? ' minus' : '') + '"><span>Selisih kas</span><span class="v">' + (d > 0 ? '+' : '') + rp(d) + '</span></div>'; };
  kas.addEventListener('input', diff); diff();
  const ok = $('#clOk', s.el); ok.disabled = false;
  ok.onclick = async () => {
    if (!(await confirmDlg({ title: 'Tutup toko sekarang?', msg: 'Kasir tidak bisa menyimpan transaksi baru sampai toko dibuka lagi.', okText: 'Tutup Toko', danger: true }))) return;
    busy(ok, true);
    const res = await api('closeStore', { kas_aktual: parseMoney(kas.value) });
    busy(ok, false);
    if (!res.ok) { toast(res.error, 'bad'); return; }
    App.boot.store = null; Boot.persist(); emit('store'); emit('boot'); s.close();
    toast('Toko ditutup. Laporan dikirim ke email.', 'ok', 4000);
    if (App.current === 'dashboard') Pages.dashboard.load($('.page[data-page="dashboard"]'));
  };
}

/* =============================================================== LAPORAN */
page('laporan', {
  role: 'OWNER', keepScroll: true,
  st: { p: 'today', custom: null, tab: 'produk' },
  template() {
    return topbar({ back: true, title: 'Laporan', sub: '<span class="js-range"></span>', right: '<button class="icon-btn ghost-border" data-act="xlsx" type="button" aria-label="Unduh Excel">' + icon('download', 'sm') + '</button>' }) +
      '<div class="wrap" style="padding-top:14px"><div class="chips js-chips"></div><div class="js-body" style="margin-top:14px">' + skeletonList(3, 120) + '</div></div>';
  },
  ranges() {
    const now = new Date();
    return {
      today: ['Hari ini', startOfDay(now), endOfDay(now)], yesterday: ['Kemarin', daysAgo(1), endOfDay(daysAgo(1))], '7d': ['7 Hari', daysAgo(6), endOfDay(now)],
      month: ['Bulan ini', new Date(now.getFullYear(), now.getMonth(), 1), endOfDay(now)],
      prev: ['Bulan lalu', new Date(now.getFullYear(), now.getMonth() - 1, 1), endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))]
    };
  },
  cur() { if (this.st.p === 'custom' && this.st.custom) return ['Rentang', startOfDay(this.st.custom.from), endOfDay(this.st.custom.to)]; return this.ranges()[this.st.p]; },
  show(el) { this.renderChips(el); this.load(el); },
  renderChips(el) {
    const R = this.ranges();
    $('.js-chips', el).innerHTML = Object.keys(R).map((k) => '<button class="chip' + (this.st.p === k ? ' on' : '') + '" data-act="p" data-p="' + k + '" type="button">' + R[k][0] + '</button>').join('') + '<button class="chip' + (this.st.p === 'custom' ? ' on' : '') + '" data-act="custom" type="button">' + icon('calendar', 'xs') + 'Pilih tanggal</button>';
    const c = this.cur(); $('.js-range', el).textContent = fmtDateLong(c[1]) + (ymd(c[1]) !== ymd(c[2]) ? ' – ' + fmtDateLong(c[2]) : '');
  },
  load(el) {
    const c = this.cur();
    swr('rep:' + ymd(c[1]) + ':' + ymd(c[2]), 'getReport', { from: c[1].toISOString(), to: c[2].toISOString() }, (d) => { this.data = d; this.render(el); }, { fresh: 60000, onError: (e) => { $('.js-body', el).innerHTML = retryBox(e.error); } });
  },
  render(el) {
    const d = this.data, L = d.labaRugi, tab = this.st.tab;
    const tbl = (head, rows, foot) => '<div class="table-wrap"><table class="table"><thead><tr>' + head.map((h, i) => '<th' + (i ? ' class="r"' : '') + '>' + h + '</th>').join('') + '</tr></thead><tbody>' + (rows.length ? rows.join('') : '<tr><td colspan="' + head.length + '" class="muted" style="text-align:center;padding:20px">Tidak ada data</td></tr>') + '</tbody>' + (foot || '') + '</table></div>';
    let body = '';
    if (tab === 'produk') body = tbl(['Produk', 'Qty', 'Omzet', 'Laba'], d.byProduct.map((p) => '<tr><td>' + esc(p.nama) + '<div class="muted" style="font-size:11.5px">' + esc(p.kategori) + '</div></td><td class="r num">' + fmtNum(p.qty) + '</td><td class="r num">' + rp(p.omzet) + '</td><td class="r num" style="color:var(--ok)">' + rp(p.omzet - p.hpp) + '</td></tr>'));
    else if (tab === 'kategori') body = tbl(['Kategori', 'Qty', 'Omzet'], d.byCategory.map((p) => '<tr><td>' + esc(p.kategori) + '</td><td class="r num">' + fmtNum(p.qty) + '</td><td class="r num">' + rp(p.omzet) + '</td></tr>'));
    else if (tab === 'kasir') body = tbl(['Kasir', 'Transaksi', 'Omzet'], d.byKasir.map((p) => '<tr><td>' + esc(p.nama) + '</td><td class="r num">' + p.trx + '</td><td class="r num">' + rp(p.omzet) + '</td></tr>'));
    else if (tab === 'metode') body = tbl(['Metode', 'Transaksi', 'Omzet'], d.byMethod.map((p) => '<tr><td>' + methodPill(p.metode) + '</td><td class="r num">' + p.trx + '</td><td class="r num">' + rp(p.omzet) + '</td></tr>'));
    else if (tab === 'harian') body = tbl(['Tanggal', 'Trx', 'Omzet', 'Laba'], d.byDay.map((p) => '<tr><td>' + fmtDate(p.tanggal + 'T00:00') + '</td><td class="r num">' + p.trx + '</td><td class="r num">' + rp(p.omzet) + '</td><td class="r num" style="color:var(--ok)">' + rp(p.laba) + '</td></tr>'));
    else body = tbl(['Nota', 'Total', 'Alasan'], d.batal.map((b) => '<tr style="color:var(--bad)"><td class="mono" style="font-size:12px">' + esc(b.no_nota) + '<div style="font-size:11px">' + fmtDT(b.waktu) + ' · ' + esc(b.kasir || '') + '</div></td><td class="r num">' + rp(b.total) + '</td><td class="r">' + esc(b.alasan || '-') + '<div style="font-size:11px">oleh ' + esc(b.oleh || '-') + '</div></td></tr>'));
    const lr = (k, v, o) => '<div class="sum-row' + (o && o.disc ? ' disc' : '') + '"' + (o && o.big ? ' style="font-size:16px"' : '') + '><span' + (o && o.big ? '' : ' class="muted"') + '>' + (o && o.big ? '<b>' + k + '</b>' : k) + '</span><span class="v"' + (o && o.color ? ' style="color:' + o.color + '"' : '') + '>' + v + '</span></div>';
    $('.js-body', el).innerHTML = '<div class="desk-2"><div class="stack">' +
      '<div class="card pad"><div class="card-h"><span class="sec-title"><span class="bullet"></span>Laba rugi sederhana</span><span class="pill neutral sm">' + L.trx + ' transaksi</span></div>' +
      lr('Penjualan kotor', rp(L.bruto)) + lr('Diskon', '-' + rp(L.diskon), { disc: true }) + lr('Penjualan bersih', rp(L.bersih), { big: true }) + lr('HPP (bahan + kemasan + alokasi)', '-' + rp(L.hpp)) +
      lr('Laba kotor', rp(L.labaKotor), { big: true, color: 'var(--ok)' }) + lr('Biaya operasional (prorata)', '-' + rp(L.biayaOps)) + '<div class="divider"></div>' +
      lr('Laba bersih estimasi', rp(L.labaBersih), { big: true, color: L.labaBersih >= 0 ? 'var(--ok)' : 'var(--bad)' }) + '</div>' +
      '<div class="grid-2"><button class="btn outline" data-act="xlsx" type="button">' + icon('download', 'sm') + 'Excel</button><button class="btn outline" data-act="pdf" type="button">' + icon('file', 'sm') + 'PDF</button></div></div>' +
      '<div class="stack"><div class="chips">' + [['produk', 'Per Produk'], ['kategori', 'Kategori'], ['kasir', 'Kasir'], ['metode', 'Metode'], ['harian', 'Harian'], ['batal', 'Dibatalkan (' + d.batal.length + ')']].map((t) => '<button class="chip' + (tab === t[0] ? ' on' : '') + '" data-act="tab" data-t="' + t[0] + '" type="button">' + t[1] + '</button>').join('') + '</div>' + body + '</div></div>';
  },
  actions: {
    p(a, e, el) { this.st.p = a.dataset.p; this.renderChips(el); this.load(el); },
    async custom(a, e, el) { const r = await dateRangeDialog(this.st.custom); if (r) { this.st.custom = r; this.st.p = 'custom'; this.renderChips(el); this.load(el); } },
    tab(a, e, el) { this.st.tab = a.dataset.t; this.render(el); },
    retry(a, e, el) { this.load(el); },
    async xlsx(a) {
      if (!this.data) return;
      busy(a, true);
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        const d = this.data, L = d.labaRugi, X = window.XLSX, wb = X.utils.book_new();
        const add = (name, rows) => X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Tidak ada data' }]), name);
        add('Ringkasan', [{ Toko: App.settings.nama_toko, Dari: fmtDate(d.from), Sampai: fmtDate(d.to), Transaksi: L.trx, 'Penjualan Kotor': L.bruto, Diskon: L.diskon, 'Penjualan Bersih': L.bersih, HPP: L.hpp, 'Laba Kotor': L.labaKotor, 'Biaya Operasional': L.biayaOps, 'Laba Bersih Estimasi': L.labaBersih }]);
        add('Transaksi', d.transactions.map((t) => ({ 'No Nota': t.no_nota, Waktu: fmtDT(t.waktu), Kasir: t.kasir, Metode: t.metode, Subtotal: t.subtotal, Diskon: t.diskon, Total: t.total, HPP: t.hpp, Laba: t.total - t.hpp, Status: t.status, 'Status Bayar': t.status_bayar, Pelanggan: t.pelanggan || '', 'Alasan Batal': t.alasan_batal || '' })));
        add('Per Produk', d.byProduct.map((p) => ({ Produk: p.nama, Kategori: p.kategori, Qty: p.qty, Omzet: p.omzet, HPP: p.hpp, Laba: p.omzet - p.hpp })));
        add('Per Kategori', d.byCategory.map((p) => ({ Kategori: p.kategori, Qty: p.qty, Omzet: p.omzet })));
        add('Per Kasir', d.byKasir.map((p) => ({ Kasir: p.nama, Transaksi: p.trx, Omzet: p.omzet })));
        add('Per Metode', d.byMethod.map((p) => ({ Metode: METODE_LABEL[p.metode] || p.metode, Transaksi: p.trx, Omzet: p.omzet })));
        add('Harian', d.byDay.map((p) => ({ Tanggal: p.tanggal, Transaksi: p.trx, Omzet: p.omzet, Laba: p.laba })));
        add('Dibatalkan', d.batal.map((b) => ({ 'No Nota': b.no_nota, Waktu: fmtDT(b.waktu), Total: b.total, Alasan: b.alasan, Oleh: b.oleh, Kasir: b.kasir })));
        X.writeFile(wb, 'Laporan-' + (App.settings.nama_toko || 'Qasir').replace(/\W+/g, '-') + '-' + ymd(d.from) + '_' + ymd(d.to) + '.xlsx');
      } catch (e) { toast(e.message, 'bad'); }
      busy(a, false);
    },
    pdf() {
      if (!this.data) return;
      const d = this.data, L = d.labaRugi, st = App.settings;
      const rows = (arr, cols) => arr.map((r) => '<tr>' + cols.map((c, i) => '<td' + (i ? ' style="text-align:right"' : '') + '>' + c(r) + '</td>').join('') + '</tr>').join('');
      const w = window.open('', '_blank');
      if (!w) { toast('Izinkan pop-up untuk mengunduh PDF', 'warn'); return; }
      w.document.write('<html><head><title>Laporan ' + esc(st.nama_toko) + '</title><style>body{font-family:Arial,sans-serif;color:#1F2937;padding:24px;font-size:12px}h1{color:' + esc(st.warna_primer || '#F26B1D') + ';margin:0}table{width:100%;border-collapse:collapse;margin:8px 0 18px}td,th{border-bottom:1px solid #E5E7EB;padding:6px;text-align:left}th{background:#F6F7F9;font-size:11px;text-transform:uppercase}.r{text-align:right}h3{margin:16px 0 4px}</style></head><body>' +
        '<h1>' + esc(st.nama_toko) + '</h1><div>Laporan penjualan ' + fmtDateLong(d.from) + ' – ' + fmtDateLong(d.to) + '</div>' +
        '<h3>Laba rugi</h3><table>' + [['Transaksi', L.trx], ['Penjualan kotor', rp(L.bruto)], ['Diskon', '-' + rp(L.diskon)], ['Penjualan bersih', rp(L.bersih)], ['HPP', '-' + rp(L.hpp)], ['Laba kotor', rp(L.labaKotor)], ['Biaya operasional (prorata)', '-' + rp(L.biayaOps)], ['Laba bersih estimasi', rp(L.labaBersih)]].map((x) => '<tr><td>' + x[0] + '</td><td class="r"><b>' + x[1] + '</b></td></tr>').join('') + '</table>' +
        '<h3>Per produk</h3><table><tr><th>Produk</th><th class="r">Qty</th><th class="r">Omzet</th><th class="r">Laba</th></tr>' + rows(d.byProduct, [(p) => esc(p.nama), (p) => fmtNum(p.qty), (p) => rp(p.omzet), (p) => rp(p.omzet - p.hpp)]) + '</table>' +
        '<h3>Per metode bayar</h3><table><tr><th>Metode</th><th class="r">Trx</th><th class="r">Omzet</th></tr>' + rows(d.byMethod, [(p) => METODE_LABEL[p.metode] || p.metode, (p) => p.trx, (p) => rp(p.omzet)]) + '</table>' +
        '<h3>Per kasir</h3><table><tr><th>Kasir</th><th class="r">Trx</th><th class="r">Omzet</th></tr>' + rows(d.byKasir, [(p) => esc(p.nama), (p) => p.trx, (p) => rp(p.omzet)]) + '</table>' +
        (d.batal.length ? '<h3 style="color:#DC2626">Transaksi dibatalkan</h3><table><tr><th>Nota</th><th class="r">Total</th><th class="r">Alasan</th></tr>' + rows(d.batal, [(b) => esc(b.no_nota), (b) => rp(b.total), (b) => esc(b.alasan || '-') + ' (' + esc(b.oleh || '-') + ')']) + '</table>' : '') +
        '<script>setTimeout(function(){print()},300)<\/script></body></html>');
      w.document.close();
    }
  }
});

/* ============================================================ PRODUK */
page('produk', {
  role: 'OWNER', keepScroll: true,
  st: { q: '', cat: 'all' },
  template() {
    return topbar({ back: true, title: 'Produk', sub: 'Kelola produk, harga, varian & foto', right: '<button class="btn primary sm" data-act="add" type="button">' + icon('plus', 'sm') + 'Produk</button>' }) +
      '<div class="wrap" style="padding-top:14px"><div class="row"><div class="input-wrap grow">' + icon('search', 'sm') + '<input class="input js-q" type="search" placeholder="Cari produk / barcode" autocomplete="off"></div><button class="btn outline" data-act="cats" type="button">' + icon('layers', 'sm') + 'Kategori</button></div>' +
      '<div class="chips js-cats" style="margin-top:10px"></div><div class="js-list" style="margin-top:12px"></div></div>';
  },
  init(el) { $('.js-q', el).addEventListener('input', debounce((e) => { this.st.q = e.target.value.trim().toLowerCase(); this.render(el); }, 100)); on('boot', () => { if (App.current === 'produk') this.render(el); }); },
  show(el) { this.render(el); },
  render(el) {
    const cats = App.boot.categories || [], hpp = App.boot.hpp || { base: {} };
    $('.js-cats', el).innerHTML = '<button class="chip' + (this.st.cat === 'all' ? ' on' : '') + '" data-act="cat" data-id="all" type="button">Semua</button>' + cats.map((c) => '<button class="chip' + (this.st.cat === c.kategori_id ? ' on' : '') + '" data-act="cat" data-id="' + esc(c.kategori_id) + '" type="button">' + esc(c.nama) + '</button>').join('');
    const q = this.st.q;
    const list = (App.boot.products || []).filter((p) => (this.st.cat === 'all' || p.kategori_id === this.st.cat) && (!q || p.nama.toLowerCase().indexOf(q) > -1 || String(p.kode_barcode).toLowerCase().indexOf(q) > -1));
    $('.js-list', el).innerHTML = list.length ? '<div class="card" style="padding:0 16px">' + list.map((p) => {
      const h = toNum(p.hpp_terhitung || (hpp.base[p.produk_id] || {}).total), fc = HPP.foodCost(h, p.harga_jual);
      return '<a class="list-item" href="#/produk-form/' + esc(p.produk_id) + '"><div class="thumb">' + productImg(p) + '</div><div class="grow"><div class="t ellipsis">' + esc(p.nama) + '</div><div class="s ellipsis">' + esc((cats.find((c) => c.kategori_id === p.kategori_id) || {}).nama || '-') + ' · ' + (p.tipe_stok === 'RACIK' ? 'Racik' : 'Stok ' + fmtNum(p.stok)) + (p.tampil_di_menu ? '' : ' · tidak di menu') + '</div></div>' +
        '<div style="text-align:right"><div class="num" style="font-weight:800">' + rp(p.harga_jual) + '</div>' + (h ? '<span class="pill ' + HPP.fcClass(fc) + ' sm">HPP ' + rp(h) + '</span>' : '<span class="pill neutral sm">HPP -</span>') + '</div>' + icon('chevron-right', 'sm faint') + '</a>';
    }).join('') + '</div>' : emptyState('package', 'Belum ada produk', 'Tambahkan produk pertama Anda.', '<button class="btn primary" data-act="add" type="button">' + icon('plus', 'sm') + 'Tambah Produk</button>');
  },
  actions: {
    add() { go('produk-form/baru'); },
    cat(a, e, el) { this.st.cat = a.dataset.id; this.render(el); },
    cats() { openCategoryManager(); }
  }
});
function openCategoryManager() {
  const s = sheet({ title: 'Kategori Produk', body: '<div id="catList"></div><div class="row" style="margin-top:14px"><input class="input" id="catNew" placeholder="Nama kategori baru"><button class="btn primary" id="catAdd" type="button">' + icon('plus', 'sm') + '</button></div>' });
  const paint = () => {
    const cats = (App.boot.categories || []).slice().sort((a, b) => toNum(a.urutan) - toNum(b.urutan));
    $('#catList', s.el).innerHTML = cats.length ? cats.map((c, i) => '<div class="list-item"><span class="dev-code" style="background:var(--p-soft);color:var(--p-dark)">' + (i + 1) + '</span><div class="grow t">' + esc(c.nama) + '</div>' +
      '<button class="icon-btn" data-up="' + esc(c.kategori_id) + '" type="button" aria-label="Naik"' + (i ? '' : ' disabled') + '>' + icon('chevron-up', 'sm') + '</button><button class="icon-btn" data-ren="' + esc(c.kategori_id) + '" type="button" aria-label="Ubah nama">' + icon('pencil', 'sm') + '</button><button class="icon-btn" data-del="' + esc(c.kategori_id) + '" type="button" aria-label="Hapus" style="color:var(--bad)">' + icon('trash', 'sm') + '</button></div>').join('') : '<div class="muted">Belum ada kategori.</div>';
  };
  const save = (c) => ownerWrite('saveCategory', c, { apply: () => replaceIn(App.boot.categories, 'kategori_id', c), msg: 'Kategori disimpan' }).then(paint);
  $('#catAdd', s.el).onclick = () => { const n = $('#catNew', s.el).value.trim(); if (!n) return; const c = { kategori_id: shortId('C'), nama: n, urutan: (App.boot.categories || []).length + 1, ikon: '' }; $('#catNew', s.el).value = ''; save(c); paint(); };
  s.el.addEventListener('click', async (e) => {
    const up = e.target.closest('[data-up]'), ren = e.target.closest('[data-ren]'), del = e.target.closest('[data-del]');
    const cats = (App.boot.categories || []).slice().sort((a, b) => toNum(a.urutan) - toNum(b.urutan));
    if (up) { const i = cats.findIndex((c) => c.kategori_id === up.dataset.up); if (i < 1) return; const a = cats[i], b = cats[i - 1]; const ua = toNum(a.urutan) || i + 1, ub = toNum(b.urutan) || i; a.urutan = ub; b.urutan = ua === ub ? ub + 1 : ua; paint(); await api('saveCategory', a); await api('saveCategory', b); Sync.bootSoon(); }
    if (ren) { const c = cats.find((x) => x.kategori_id === ren.dataset.ren); const n = await promptDlg({ title: 'Ubah nama kategori', value: c.nama }); if (n) save(Object.assign({}, c, { nama: n })); }
    if (del) { const c = cats.find((x) => x.kategori_id === del.dataset.del); if (await confirmDlg({ title: 'Hapus kategori ' + c.nama + '?', okText: 'Hapus', danger: true })) ownerWrite('deleteCategory', { kategori_id: c.kategori_id }, { apply: () => removeIn(App.boot.categories, 'kategori_id', c.kategori_id), msg: 'Kategori dihapus' }).then(paint); }
  });
  paint();
}

/* ======================================================= FORM PRODUK */
page('produk-form', {
  role: 'OWNER', nav: false, foot: true, backTo: 'produk',
  template() {
    return topbar({ back: true, title: 'Tambah Produk', right: '<button class="link-btn" data-act="save" type="button" style="font-size:15px">Simpan</button>' }) +
      '<div class="wrap js-body" style="padding-top:14px;max-width:760px"></div>' +
      '<div class="sticky-foot"><div class="in row"><button class="btn outline" data-act="back" type="button" style="flex:1">Batal</button><button class="btn primary" data-act="save" type="button" style="flex:2">' + icon('check', 'sm') + 'Simpan Produk</button></div></div>';
  },
  show(el, id) {
    const isNew = !id || id === 'baru';
    const p = isNew ? null : Local.product(id);
    if (!isNew && !p) { toast('Produk tidak ditemukan', 'bad'); replaceRoute('produk'); return; }
    $('.topbar h1', el).textContent = isNew ? 'Tambah Produk' : 'Ubah Produk';
    const groups = [];
    if (p) (App.boot.variants || []).filter((v) => v.produk_id === p.produk_id).forEach((v) => { let g = groups.find((x) => x.grup === v.grup); if (!g) { g = { grup: v.grup, wajib: !!v.wajib_pilih, items: [] }; groups.push(g); } g.items.push({ varian_id: v.varian_id, nama: v.nama, tambahan_harga: toNum(v.tambahan_harga), tambahan_hpp: toNum(v.tambahan_hpp) }); });
    this.f = { isNew, produk_id: p ? p.produk_id : shortId('P'), nama: p ? p.nama : '', kategori_id: p ? p.kategori_id : ((App.boot.categories || [])[0] || {}).kategori_id || '', tipe_stok: p ? p.tipe_stok : 'STOK_JADI', harga_jual: p ? toNum(p.harga_jual) : 0, stok: 0, stok_minimum: p ? toNum(p.stok_minimum) : 5, satuan: p ? p.satuan || 'pcs' : 'pcs', tampil_di_menu: p ? p.tampil_di_menu !== false : true, kode_barcode: p ? String(p.kode_barcode || '') : '', foto_url: p ? p.foto_url : '', foto: null, hapusFoto: false, groups };
    this.render(el);
  },
  render(el) {
    const f = this.f, cats = App.boot.categories || [];
    const hppVal = f.isNew ? 0 : toNum((App.boot.hpp && App.boot.hpp.base[f.produk_id] || {}).total);
    const margin = f.harga_jual > 0 && hppVal ? Math.round((1 - hppVal / f.harga_jual) * 100) : null;
    const recipe = (App.boot.recipes || []).filter((r) => r.produk_id === f.produk_id && !r.varian_id);
    const mats = {}; (App.boot.materials || []).forEach((m) => { mats[m.bahan_id] = m; });
    const img = f.foto || (!f.hapusFoto && f.foto_url);
    $('.js-body', el).innerHTML =
      '<div class="card pad"><div class="card-h"><span class="sec-title">Foto produk</span><span class="pill ok sm">Kompres aktif</span></div>' +
      '<div class="pimg" style="width:180px;margin:0 auto;border-radius:16px">' + (img ? '<img src="' + esc(img) + '" alt="">' : '<div class="ph">' + esc(initials(f.nama || 'Produk')) + '</div>') + '</div>' +
      '<div class="help" style="justify-content:center">Foto opsional · dipotong persegi & dikompres ≤250 KB</div>' +
      '<div class="grid-2" style="margin-top:10px"><button class="btn outline" data-act="photo" data-cap="1" type="button">' + icon('camera', 'sm') + 'Kamera</button><button class="btn outline" data-act="photo" data-cap="0" type="button">' + icon('image', 'sm') + 'Galeri</button></div>' +
      (img ? '<button class="link-btn" data-act="nophoto" type="button" style="display:block;margin:10px auto 0;color:var(--bad)">Hapus foto</button>' : '') + '</div>' +
      '<div class="card pad" style="margin-top:12px"><div class="card-h"><span class="sec-title">Info produk</span><span style="color:var(--bad);font-size:12.5px">* Wajib diisi</span></div>' +
      '<label class="field"><span class="lbl">Nama Produk <span class="req">*</span></span><input class="input" data-f="nama" value="' + esc(f.nama) + '" placeholder="contoh: Kopi Susu Aren"></label>' +
      '<label class="field"><span class="lbl">Kategori <span class="req">*</span></span><select class="select" data-f="kategori_id">' + cats.map((c) => '<option value="' + esc(c.kategori_id) + '"' + (c.kategori_id === f.kategori_id ? ' selected' : '') + '>' + esc(c.nama) + '</option>').join('') + '</select></label>' +
      '<div class="field"><span class="lbl">Tipe Stok <span class="req">*</span></span><div class="seg"><button type="button" data-act="tipe" data-v="STOK_JADI" class="' + (f.tipe_stok === 'STOK_JADI' ? 'on' : '') + '">Stok Jadi</button><button type="button" data-act="tipe" data-v="RACIK" class="' + (f.tipe_stok === 'RACIK' ? 'on' : '') + '">Racik dari Resep</button></div>' +
      '<div class="help">' + icon('info', 'xs') + (f.tipe_stok === 'RACIK' ? 'Stok bahan baku berkurang otomatis sesuai resep saat terjual.' : 'Stok produk jadi (roti, donat) berkurang saat terjual & bertambah lewat Stok Masuk.') + '</div></div>' +
      '<div class="field"><span class="lbl">Harga Jual <span class="req">*</span>' + (!f.isNew ? '<a class="link-btn" href="#/hpp/' + esc(f.produk_id) + '" style="font-size:13px">Lihat HPP' + (hppVal ? ' → ' + rp(hppVal) : '') + '</a>' : '') + '</span><div class="input-wrap">' + moneyInput('data-f="harga_jual" placeholder="0"', f.harga_jual) + (margin !== null ? '<span class="suffix pill ' + (margin >= 55 ? 'ok' : margin >= 45 ? 'warn' : 'bad') + ' sm">Margin ' + margin + '%</span>' : '') + '</div></div>' +
      (f.tipe_stok === 'STOK_JADI' ? '<div class="grid-2">' + (f.isNew ? '<label class="field"><span class="lbl">Stok awal</span><input class="input" data-f="stok" inputmode="numeric" value="' + (f.stok || '') + '" placeholder="0"></label>' : '') +
        '<label class="field"' + (f.isNew ? ' style="margin-top:14px"' : '') + '><span class="lbl">Stok minimum</span><input class="input" data-f="stok_minimum" inputmode="numeric" value="' + (f.stok_minimum || '') + '" placeholder="5"></label>' + (f.isNew ? '' : '<label class="field" style="margin-top:14px"><span class="lbl">Satuan</span><input class="input" data-f="satuan" value="' + esc(f.satuan) + '"></label>') + '</div>' : '') +
      '<div class="row between" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line-2)"><div><b style="font-size:14px">Tampilkan di Daftar Menu</b><div class="muted" style="font-size:12.5px">Masuk ke menu cetak & WA</div></div><label class="toggle"><input type="checkbox" data-f="tampil_di_menu"' + (f.tampil_di_menu ? ' checked' : '') + '></label></div></div>' +
      '<div class="card pad" style="margin-top:12px"><div class="card-h"><span class="sec-title">Barcode</span>' + (!f.isNew ? '<a class="link-btn" href="#/label/' + esc(f.produk_id) + '">Cetak Label</a>' : '') + '</div>' +
      '<div style="border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center;background:var(--bg)">' + (f.kode_barcode ? '<div style="height:56px;max-width:260px;margin:0 auto">' + Code128.svg(f.kode_barcode, { height: 50 }) + '</div><div class="mono" style="margin-top:6px;letter-spacing:.1em">' + esc(f.kode_barcode) + '</div>' : '<div class="muted" style="padding:14px 0">Kode dibuat otomatis saat disimpan</div>') + '</div>' +
      '<input class="input" data-f="kode_barcode" value="' + esc(f.kode_barcode) + '" placeholder="Kosongkan untuk otomatis" style="margin-top:10px">' +
      '<div class="grid-2" style="margin-top:10px"><button class="btn outline" data-act="autocode" type="button">' + icon('refresh', 'sm') + 'Buat Otomatis</button><button class="btn outline" data-act="scancode" type="button">' + icon('scan-barcode', 'sm') + 'Scan Kemasan</button></div></div>' +
      '<div class="card pad" style="margin-top:12px"><div class="card-h"><span class="sec-title">Varian & Topping</span><button class="btn xs outline-brand" data-act="addgroup" type="button">' + icon('plus', 'xs') + 'Tambah Grup</button></div>' +
      (f.groups.length ? f.groups.map((g, gi) => '<div style="background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:12px;margin-top:10px">' +
        '<div class="row"><input class="input" data-g="' + gi + '" data-gf="grup" value="' + esc(g.grup) + '" style="min-height:40px;font-weight:700"><label class="check" style="font-size:13px;white-space:nowrap"><input type="checkbox" data-g="' + gi + '" data-gf="wajib"' + (g.wajib ? ' checked' : '') + '>Wajib</label><button class="icon-btn" data-act="delgroup" data-g="' + gi + '" type="button" style="color:var(--bad)" aria-label="Hapus grup">' + icon('trash', 'sm') + '</button></div>' +
        g.items.map((it, ii) => '<div class="row" style="margin-top:8px;gap:6px"><input class="input" data-g="' + gi + '" data-i="' + ii + '" data-if="nama" value="' + esc(it.nama) + '" placeholder="Nama opsi" style="min-height:42px">' +
          '<div style="width:120px;flex:none">' + moneyInput('data-g="' + gi + '" data-i="' + ii + '" data-if="tambahan_harga" placeholder="+harga" style="min-height:42px"', it.tambahan_harga) + '</div>' +
          '<button class="icon-btn" data-act="delitem" data-g="' + gi + '" data-i="' + ii + '" type="button" aria-label="Hapus opsi">' + icon('x', 'sm') + '</button></div>').join('') +
        '<button class="btn xs outline" data-act="additem" data-g="' + gi + '" type="button" style="margin-top:8px">' + icon('plus', 'xs') + 'Opsi</button></div>').join('') : '<div class="muted" style="font-size:13.5px">Tanpa varian. Contoh: Ukuran (Regular/Large), Suhu (Hot/Ice), Topping.</div>') + '</div>' +
      (!f.isNew ? '<div class="card pad" style="margin-top:12px"><div class="card-h"><span class="sec-title">Resep</span><a class="link-btn" href="#/hpp/' + esc(f.produk_id) + '">Atur Resep →</a></div>' +
        (recipe.length ? recipe.map((r) => '<div class="sum-row"><span>' + esc((mats[r.bahan_id] || {}).nama || '?') + '</span><span class="v mono">' + fmtNum(r.takaran) + ' ' + esc((mats[r.bahan_id] || {}).satuan_pakai || '') + '</span></div>').join('') : '<div class="muted" style="font-size:13.5px">Belum ada resep. Atur resep agar HPP & stok bahan terhitung.</div>') + '</div>' +
        '<button class="btn outline block" data-act="deactivate" type="button" style="margin-top:14px;color:var(--bad)">' + icon('trash', 'sm') + 'Nonaktifkan Produk</button>' : '<div class="help" style="margin-top:12px">' + icon('info', 'xs') + 'Resep & HPP bisa diatur setelah produk disimpan.</div>') + '<div style="height:16px"></div>';
  },
  collect(el) {
    const f = this.f;
    $$('[data-f]', el).forEach((i) => { const k = i.dataset.f; if (i.type === 'checkbox') f[k] = i.checked; else if (k === 'harga_jual') f[k] = parseMoney(i.value); else if (k === 'stok' || k === 'stok_minimum') f[k] = toNum(i.value); else f[k] = i.value.trim(); });
    $$('[data-gf]', el).forEach((i) => { const g = f.groups[i.dataset.g]; if (i.dataset.gf === 'wajib') g.wajib = i.checked; else g.grup = i.value.trim(); });
    $$('[data-if]', el).forEach((i) => { const it = f.groups[i.dataset.g].items[i.dataset.i]; if (i.dataset.if === 'tambahan_harga') it.tambahan_harga = parseMoney(i.value); else it.nama = i.value.trim(); });
  },
  actions: {
    async photo(a, e, el) { this.collect(el); const file = await pickImage(a.dataset.cap === '1'); if (!file) return; try { this.f.foto = await compressImage(file, { square: true, maxDim: 800 }); this.f.hapusFoto = false; this.render(el); toast('Foto ' + dataUrlKB(this.f.foto) + ' KB', 'ok', 1200); } catch (err) { toast(err.message, 'bad'); } },
    nophoto(a, e, el) { this.collect(el); this.f.foto = null; this.f.hapusFoto = true; this.render(el); },
    tipe(a, e, el) { this.collect(el); this.f.tipe_stok = a.dataset.v; this.render(el); },
    autocode(a, e, el) { this.collect(el); let max = 100; (App.boot.products || []).forEach((p) => { const m = String(p.kode_barcode).match(/^QSR(\d+)$/); if (m) max = Math.max(max, Number(m[1])); }); this.f.kode_barcode = 'QSR' + String(max + 1).padStart(7, '0'); this.render(el); },
    scancode(a, e, el) { this.collect(el); Scanner.open((code) => { this.f.kode_barcode = code; this.render(el); }, 'Scan Barcode Kemasan'); },
    addgroup(a, e, el) {
      this.collect(el);
      const used = this.f.groups.map((g) => g.grup);
      const preset = [['Ukuran', true, ['Regular', 'Large']], ['Suhu', true, ['Hot', 'Ice']], ['Topping', false, ['Extra Shot']], ['Level Gula', true, ['Normal', 'Less sugar']]].find((p) => used.indexOf(p[0]) < 0) || ['Pilihan', false, ['Opsi 1']];
      this.f.groups.push({ grup: preset[0], wajib: preset[1], items: preset[2].map((n) => ({ varian_id: shortId('V'), nama: n, tambahan_harga: 0, tambahan_hpp: 0 })) });
      this.render(el);
    },
    delgroup(a, e, el) { this.collect(el); this.f.groups.splice(Number(a.dataset.g), 1); this.render(el); },
    additem(a, e, el) { this.collect(el); this.f.groups[a.dataset.g].items.push({ varian_id: shortId('V'), nama: '', tambahan_harga: 0, tambahan_hpp: 0 }); this.render(el); },
    delitem(a, e, el) { this.collect(el); const g = this.f.groups[a.dataset.g]; g.items.splice(Number(a.dataset.i), 1); if (!g.items.length) this.f.groups.splice(Number(a.dataset.g), 1); this.render(el); },
    async deactivate() {
      const f = this.f;
      if (!(await confirmDlg({ title: 'Nonaktifkan ' + f.nama + '?', msg: 'Produk tidak tampil di kasir & menu. Riwayat transaksi tetap aman.', okText: 'Nonaktifkan', danger: true }))) return;
      replaceRoute('produk');
      ownerWrite('deleteProduct', { produk_id: f.produk_id }, { apply: () => removeIn(App.boot.products, 'produk_id', f.produk_id), msg: 'Produk dinonaktifkan' });
    },
    async save(a, e, el) {
      this.collect(el);
      const f = this.f;
      if (!f.nama) { toast('Nama produk wajib diisi', 'bad'); return; }
      if (!f.kategori_id) { toast('Buat kategori dulu (tombol Kategori di halaman Produk)', 'bad'); return; }
      if (!f.harga_jual) { toast('Harga jual wajib diisi', 'bad'); return; }
      if (f.kode_barcode && (App.boot.products || []).some((p) => String(p.kode_barcode) === f.kode_barcode && p.produk_id !== f.produk_id)) { toast('Kode barcode sudah dipakai produk lain', 'bad'); return; }
      const varian = [];
      f.groups.forEach((g) => g.items.forEach((it) => { if (it.nama) varian.push({ varian_id: it.varian_id, grup: g.grup || 'Pilihan', nama: it.nama, tambahan_harga: it.tambahan_harga, tambahan_hpp: it.tambahan_hpp, wajib_pilih: g.wajib }); }));
      const prev = Local.product(f.produk_id);
      const prod = Object.assign({}, prev || {}, { produk_id: f.produk_id, nama: f.nama, kategori_id: f.kategori_id, tipe_stok: f.tipe_stok, harga_jual: f.harga_jual, stok_minimum: f.stok_minimum, satuan: f.satuan || 'pcs', tampil_di_menu: f.tampil_di_menu, kode_barcode: f.kode_barcode || (prev ? prev.kode_barcode : ''), status_aktif: true });
      if (!prev) prod.stok = f.tipe_stok === 'STOK_JADI' ? f.stok : 0;
      if (f.foto) prod._fotoLocal = f.foto; if (f.hapusFoto) { prod.foto_url = ''; prod._fotoLocal = ''; }
      const newVars = varian.map((v, i) => Object.assign({ produk_id: f.produk_id, urutan: i + 1 }, v));
      replaceRoute('produk');
      await ownerWrite('saveProduct', { produk: { produk_id: f.produk_id, kode_barcode: f.kode_barcode, nama: f.nama, kategori_id: f.kategori_id, tipe_stok: f.tipe_stok, harga_jual: f.harga_jual, stok: f.stok, stok_minimum: f.stok_minimum, satuan: f.satuan, tampil_di_menu: f.tampil_di_menu }, varian, fotoDataUrl: f.foto || '', hapusFoto: f.hapusFoto }, {
        msg: f.foto ? 'Produk disimpan · foto sedang diunggah…' : 'Produk disimpan',
        apply: () => {
          const u1 = replaceIn(App.boot.products, 'produk_id', prod);
          const oldVars = App.boot.variants.filter((v) => v.produk_id === f.produk_id);
          App.boot.variants = App.boot.variants.filter((v) => v.produk_id !== f.produk_id).concat(newVars);
          return () => { u1(); App.boot.variants = App.boot.variants.filter((v) => v.produk_id !== f.produk_id).concat(oldVars); };
        },
        onOk: (d) => { const p = Local.product(f.produk_id); if (p) { p.kode_barcode = d.kode_barcode; if (d.foto_url !== undefined && (f.foto || f.hapusFoto)) p.foto_url = d.foto_url; } }
      });
    }
  }
});

/* ======================================================= KALKULATOR HPP */
page('hpp', {
  role: 'OWNER', nav: false, foot: true, backTo: 'produk',
  st: { pid: '', vars: [], sim: false, ov: { mat: {} }, margins: null, pick: 'standar' },
  template() {
    return topbar({ back: true, title: 'Kalkulator HPP', sub: 'Analisis harga & margin', right: '<button class="icon-btn soft" data-act="help" type="button" aria-label="Bantuan">' + icon('info', 'sm') + '</button>' }) +
      '<div class="wrap js-body" style="padding-top:14px;max-width:960px"></div>' +
      '<div class="sticky-foot"><div class="in"><button class="btn primary block lg js-apply" data-act="apply" type="button"></button></div></div>';
  },
  init(el) { on('boot', () => { if (App.current === 'hpp') this.render(el); }); },
  show(el, pid) {
    const prods = App.boot.products || [];
    this.st.pid = pid && Local.product(pid) ? pid : (this.st.pid && Local.product(this.st.pid) ? this.st.pid : ((prods.find((p) => p.tipe_stok === 'RACIK') || prods[0] || {}).produk_id || ''));
    this.resetVars(); this.st.sim = false; this.st.ov = { mat: {} }; this.st.margins = null;
    this.render(el);
  },
  resetVars() {
    const vars = (App.boot.variants || []).filter((v) => v.produk_id === this.st.pid);
    const seen = {}; this.st.vars = [];
    vars.forEach((v) => { if (v.wajib_pilih && !seen[v.grup]) { seen[v.grup] = 1; this.st.vars.push(v.varian_id); } });
  },
  margins() { const s = App.settings; return this.st.margins || { hemat: toNum(s.margin_hemat) || 30, standar: toNum(s.margin_standar) || 40, premium: toNum(s.margin_premium) || 50 }; },
  render(el) {
    const b = App.boot, st = this.st, p = Local.product(st.pid);
    if (!p) { $('.js-body', el).innerHTML = emptyState('calculator', 'Belum ada produk', 'Tambahkan produk dulu.'); $('.js-apply', el).hidden = true; return; }
    const h = HPP.calc(b, p.produk_id, st.vars, st.sim ? st.ov : null);
    const vars = (b.variants || []).filter((v) => v.produk_id === p.produk_id);
    const price = toNum(p.harga_jual) + vars.filter((v) => st.vars.indexOf(v.varian_id) > -1).reduce((s, v) => s + toNum(v.tambahan_harga), 0);
    const round = toNum(App.settings.pembulatan) || 1000, M = this.margins();
    const recs = [['hemat', 'Hemat', M.hemat], ['standar', 'Standar', M.standar], ['premium', 'Premium', M.premium]].map((r) => ({ key: r[0], nama: r[1], m: r[2], harga: HPP.recommend(h.total, r[2], round) }));
    const pick = recs.find((r) => r.key === st.pick) || recs[1];
    const fc = HPP.foodCost(h.total, price), fcc = HPP.fcClass(fc);
    const mats = b.materials || [];
    $('.js-body', el).innerHTML = '<div class="desk-2"><div class="stack">' +
      '<div class="card pad"><div class="row"><div class="thumb" style="width:60px;height:60px">' + productImg(p) + '</div><div class="grow"><div class="sec-title" style="font-size:11px">' + (p.tipe_stok === 'RACIK' ? 'Produk menu racik' : 'Produk stok jadi') + '</div>' +
      '<select class="select" data-act-change="pid" style="margin-top:4px;font-weight:700">' + (b.products || []).map((x) => '<option value="' + esc(x.produk_id) + '"' + (x.produk_id === p.produk_id ? ' selected' : '') + '>' + esc(x.nama) + '</option>').join('') + '</select></div></div>' +
      (vars.length ? '<div class="divider"></div><div class="row wrapx" style="gap:8px"><span class="muted" style="font-size:13px">Varian:</span>' + vars.map((v) => '<button class="chip' + (st.vars.indexOf(v.varian_id) > -1 ? ' on' : '') + '" data-act="var" data-v="' + esc(v.varian_id) + '" type="button" style="min-height:34px">' + esc(v.nama) + '</button>').join('') + '</div>' : '') + '</div>' +
      '<div class="card pad"><div class="card-h"><span class="sec-title"><span class="bullet"></span>Rincian biaya bahan</span><button class="btn xs outline-brand" data-act="recipe" type="button">' + icon('pencil', 'xs') + 'Atur Resep</button></div>' +
      (h.rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Bahan</th><th class="r">Takaran</th><th class="r">' + (st.sim ? 'Harga beli' : 'Harga/sat') + '</th><th class="r">Biaya</th></tr></thead><tbody>' +
        h.rows.map((r) => { const m = mats.find((x) => x.bahan_id === r.bahan_id) || {}; return '<tr><td>' + esc(r.nama) + (r.varian_id ? ' <span class="pill brand sm">+' + esc((vars.find((v) => v.varian_id === r.varian_id) || {}).nama || 'varian') + '</span>' : '') + (r.jenis === 'KEMASAN' ? ' <span class="pill info sm">kemasan</span>' : '') + '</td><td class="r mono">' + fmtNum(r.takaran) + ' ' + esc(r.satuan) + '</td>' +
          '<td class="r mono">' + (st.sim ? '<input class="input money" data-mat="' + esc(r.bahan_id) + '" value="' + NF.format(st.ov.mat[r.bahan_id] !== undefined ? st.ov.mat[r.bahan_id] : toNum(m.harga_beli)) + '" style="min-height:36px;width:110px;text-align:right;padding:0 8px"><div class="faint" style="font-size:10.5px">/' + esc(m.satuan_beli || '') + ' ' + fmtNum(m.isi_per_kemasan) + esc(r.satuan) + '</div>' : 'Rp' + fmtNum(Math.round(r.unit * 100) / 100) + '/' + esc(r.satuan)) + '</td><td class="r num"><b>' + rp(r.cost) + '</b></td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td colspan="3">Total biaya bahan</td><td class="r num">' + rp(h.bahan) + '</td></tr></tfoot></table></div>' : emptyState('calculator', 'Resep belum diatur', 'Tambahkan bahan & takaran untuk menghitung HPP.', '<button class="btn primary sm" data-act="recipe" type="button">' + icon('plus', 'sm') + 'Atur Resep</button>')) + '</div>' +
      '<div class="card pad"><span class="sec-title"><span class="bullet" style="background:var(--muted)"></span>Biaya lain per porsi</span>' +
      '<div class="sum-row" style="margin-top:10px"><div><div>Kemasan</div><div class="muted" style="font-size:12.5px">Dari bahan berjenis kemasan di resep</div></div><span class="v">' + rp(h.kemasan) + '</span></div>' +
      (h.varManual ? '<div class="sum-row"><span>Tambahan HPP varian</span><span class="v">' + rp(h.varManual) + '</span></div>' : '') +
      '<div class="sum-row"><div><div>Alokasi operasional</div><div class="muted mono" style="font-size:12px">' + rp(h.opsTotal) + '/bln ÷ ' + fmtNum(h.opsProd) + ' porsi</div></div><span class="v">' + rp(h.ops) + '</span></div>' +
      (st.sim ? '<label class="field"><span class="lbl">Simulasi total biaya operasional / bulan</span>' + moneyInput('data-sim="ops"', st.ov.totalCost !== undefined ? st.ov.totalCost : h.opsTotal) + '</label>' : '<a class="link-btn" href="#/bahan/biaya" style="font-size:13px">Atur biaya & estimasi penjualan →</a>') + '</div>' +
      '</div><div class="stack">' +
      '<div class="hpp-box"><div class="row between"><span class="pill brand sm">HPP PER PORSI</span><span class="row" style="gap:4px;font-size:12.5px;color:var(--p-dark)">' + icon('shield', 'xs') + (st.sim ? 'Mode simulasi' : 'Otomatis terkalkulasi') + '</span></div><div class="v" style="margin-top:6px">' + rp(h.total) + '</div>' +
      '<div class="muted" style="font-size:12.5px">Bahan ' + rp(h.bahan) + ' + Kemasan ' + rp(h.kemasan) + ' + Operasional ' + rp(h.ops) + (h.varManual ? ' + Varian ' + rp(h.varManual) : '') + '</div></div>' +
      '<div><div class="label-row" style="margin-top:6px"><span class="sec-title">Rekomendasi harga jual</span><span class="muted" style="font-size:12.5px">Pilih 1 strategi</span></div>' +
      '<div class="rec-grid">' + recs.map((r) => '<button class="rec' + (r.key === pick.key ? ' is-on' : '') + '" data-act="pick" data-k="' + r.key + '" type="button">' + (r.key === 'standar' ? '<span class="rib">DISARANKAN</span>' : '') + '<div class="n">' + r.nama + '</div>' +
        (st.sim ? '<div class="m">Margin <input data-margin="' + r.key + '" value="' + r.m + '" inputmode="numeric" style="width:34px;border:1px solid var(--line);border-radius:6px;text-align:center;font:inherit">%</div>' : '<div class="m">Margin ' + r.m + '%</div>') +
        '<div class="p">' + rp(r.harga) + '</div><div class="divider" style="margin:6px 8px"></div><div class="l">Laba ' + rp(r.harga - h.total) + '</div></button>').join('') + '</div>' +
      '<div class="help">Dibulatkan ke atas ' + rp(round) + ' · margin default bisa diubah di Pengaturan</div></div>' +
      '<div class="card pad"><div class="row between"><span>Harga jual saat ini</span><b class="num">' + rp(price) + '</b></div><div class="row between" style="margin:10px 0 8px"><span>Food cost ' + Math.round(fc) + '%</span><span class="pill ' + fcc + ' sm">' + (fcc === 'ok' ? '≤ 35% sehat' : fcc === 'warn' ? '35–45% waspada' : icon('alert', 'xs') + 'Di atas 45%') + '</span></div>' +
      '<div class="fc-bar"><span class="mk" style="left:' + Math.min(100, fc) + '%"></span></div>' + (price < h.total ? '<div class="banner bad" style="margin-top:12px">' + icon('alert', 'sm') + '<div>Harga jual di bawah HPP — setiap penjualan rugi ' + rp(h.total - price) + '.</div></div>' : '') + '</div>' +
      '<div class="card pad row" style="border-style:dashed"><span class="ico-box">' + icon('sliders', 'sm') + '</span><div class="grow"><b>Mode Simulasi</b><div class="muted" style="font-size:12.5px">Coba ubah harga bahan atau margin tanpa menyimpan</div></div><label class="toggle"><input type="checkbox" data-act-change="sim"' + (st.sim ? ' checked' : '') + '></label></div>' +
      '</div></div><div style="height:12px"></div>';
    const ap = $('.js-apply', el); ap.hidden = false;
    ap.innerHTML = icon('check', 'sm') + 'Terapkan Harga ' + rp(pick.harga);
    ap.disabled = !pick.harga || pick.harga === toNum(p.harga_jual);
    this.pickHarga = pick.harga;
    $$('[data-act-change]', el).forEach((i) => i.addEventListener('change', () => {
      if (i.dataset.actChange === 'pid') { this.st.pid = i.value; this.resetVars(); this.st.ov = { mat: {} }; replaceRoute('hpp/' + i.value); return; }
      if (i.dataset.actChange === 'sim') { this.st.sim = i.checked; if (!i.checked) { this.st.ov = { mat: {} }; this.st.margins = null; } this.render(el); }
    }));
    const recalc = debounce(() => this.render(el), 450);
    $$('[data-mat]', el).forEach((i) => i.addEventListener('input', () => { this.st.ov.mat[i.dataset.mat] = parseMoney(i.value); recalc(); }));
    $$('[data-sim="ops"]', el).forEach((i) => i.addEventListener('input', () => { this.st.ov.totalCost = parseMoney(i.value); recalc(); }));
    $$('[data-margin]', el).forEach((i) => { i.addEventListener('click', (e) => e.stopPropagation()); i.addEventListener('input', () => { const m = Object.assign({}, this.margins()); m[i.dataset.margin] = Math.min(95, toNum(i.value)); this.st.margins = m; recalc(); }); });
  },
  actions: {
    var(a, e, el) {
      const v = (App.boot.variants || []).find((x) => x.varian_id === a.dataset.v); if (!v) return;
      const i = this.st.vars.indexOf(v.varian_id);
      if (v.wajib_pilih) { const same = (App.boot.variants || []).filter((x) => x.produk_id === v.produk_id && x.grup === v.grup).map((x) => x.varian_id); this.st.vars = this.st.vars.filter((x) => same.indexOf(x) < 0).concat([v.varian_id]); }
      else if (i > -1) this.st.vars.splice(i, 1); else this.st.vars.push(v.varian_id);
      this.render(el);
    },
    pick(a, e, el) { this.st.pick = a.dataset.k; this.render(el); },
    recipe(a, e, el) { openRecipeEditor(this.st.pid, () => this.render(el)); },
    help() { sheet({ title: 'Cara menghitung HPP', body: '<div class="stack" style="font-size:14.5px"><p><b>1. Harga per satuan</b> = harga beli ÷ isi kemasan. Contoh: tepung 1 kg Rp14.000 → Rp14/gram.</p><p><b>2. Biaya bahan</b> = takaran resep × harga per satuan.</p><p><b>3. Alokasi operasional</b> = total biaya bulanan (gas, listrik, sewa, gaji) ÷ total estimasi porsi terjual per bulan.</p><p><b>4. HPP</b> = bahan + kemasan + alokasi operasional.</p><p><b>5. Harga rekomendasi</b> = HPP ÷ (1 − margin), dibulatkan ke atas.</p><p><b>Food cost</b> = HPP ÷ harga jual. Ideal ≤35%.</p></div>' }); },
    async apply(a) {
      const p = Local.product(this.st.pid), harga = this.pickHarga; if (!p || !harga) return;
      if (!(await confirmDlg({ title: 'Ubah harga ' + p.nama + '?', msg: rp(p.harga_jual) + ' → ' + rp(harga) + '. Harga baru langsung berlaku di semua kasir.', okText: 'Terapkan' }))) return;
      const old = p.harga_jual;
      ownerWrite('applyPrice', { produk_id: p.produk_id, harga }, { apply: () => { p.harga_jual = harga; return () => { p.harga_jual = old; }; }, msg: 'Harga diperbarui' });
    }
  }
});
function openRecipeEditor(pid, done) {
  const p = Local.product(pid); if (!p) return;
  const mats = App.boot.materials || [], vars = (App.boot.variants || []).filter((v) => v.produk_id === pid);
  let rows = (App.boot.recipes || []).filter((r) => r.produk_id === pid).map((r) => Object.assign({}, r));
  const s = sheet({ title: 'Resep · ' + p.nama, maxWidth: 720, body: '<div id="rcRows"></div><button class="btn outline block" id="rcAdd" type="button" style="margin-top:10px">' + icon('plus', 'sm') + 'Tambah Bahan</button>' + (mats.length ? '' : '<div class="banner warn" style="margin-top:12px">' + icon('alert', 'sm') + '<div>Belum ada bahan baku. Tambahkan di menu <a href="#/bahan">Bahan & Biaya</a>.</div></div>') + '<div class="help">' + icon('info', 'xs') + 'Pilih "Dasar" untuk bahan yang selalu dipakai. Pilih varian (mis. Large / Extra Shot) untuk bahan tambahan varian itu saja.</div>', foot: '<button class="btn primary block lg" id="rcSave" type="button">' + icon('check', 'sm') + 'Simpan Resep</button>' });
  const paint = () => {
    $('#rcRows', s.el).innerHTML = rows.length ? rows.map((r, i) => { const m = mats.find((x) => x.bahan_id === r.bahan_id) || {}; return '<div class="card pad" style="margin-bottom:8px;padding:12px"><div class="row"><select class="select" data-i="' + i + '" data-k="bahan_id">' + mats.map((x) => '<option value="' + esc(x.bahan_id) + '"' + (x.bahan_id === r.bahan_id ? ' selected' : '') + '>' + esc(x.nama) + '</option>').join('') + '</select><button class="icon-btn" data-del="' + i + '" type="button" style="color:var(--bad)" aria-label="Hapus">' + icon('trash', 'sm') + '</button></div>' +
      '<div class="grid-2" style="margin-top:8px"><div class="input-wrap"><input class="input" data-i="' + i + '" data-k="takaran" inputmode="decimal" value="' + esc(r.takaran) + '" placeholder="Takaran"><span class="suffix muted" style="font-size:13px">' + esc(m.satuan_pakai || '') + '</span></div>' +
      '<select class="select" data-i="' + i + '" data-k="varian_id"><option value="">Dasar (selalu)</option>' + vars.map((v) => '<option value="' + esc(v.varian_id) + '"' + (v.varian_id === r.varian_id ? ' selected' : '') + '>+ ' + esc(v.grup + ': ' + v.nama) + '</option>').join('') + '</select></div></div>'; }).join('') : '<div class="muted">Belum ada bahan di resep ini.</div>';
  };
  s.el.addEventListener('input', (e) => { const i = e.target.dataset.i; if (i === undefined) return; rows[i][e.target.dataset.k] = e.target.dataset.k === 'takaran' ? toNum(e.target.value.replace(',', '.')) : e.target.value; if (e.target.dataset.k === 'bahan_id') paint(); });
  s.el.addEventListener('change', (e) => { const i = e.target.dataset.i; if (i === undefined) return; rows[i][e.target.dataset.k] = e.target.dataset.k === 'takaran' ? toNum(e.target.value.replace(',', '.')) : e.target.value; if (e.target.dataset.k === 'bahan_id') paint(); });
  s.el.addEventListener('click', (e) => { const d = e.target.closest('[data-del]'); if (d) { rows.splice(Number(d.dataset.del), 1); paint(); } });
  $('#rcAdd', s.el).onclick = () => { if (!mats.length) return; rows.push({ resep_id: shortId('R'), produk_id: pid, varian_id: '', bahan_id: mats[0].bahan_id, takaran: 0 }); paint(); };
  $('#rcSave', s.el).onclick = async () => {
    const clean = rows.filter((r) => r.bahan_id && toNum(r.takaran) > 0);
    s.close();
    await ownerWrite('saveRecipe', { produk_id: pid, rows: clean }, { apply: () => { const old = App.boot.recipes; App.boot.recipes = old.filter((r) => r.produk_id !== pid).concat(clean); return () => { App.boot.recipes = old; }; }, msg: 'Resep disimpan' });
    done && done();
  };
  paint();
}

/* ========================================================= BAHAN & BIAYA */
page('bahan', {
  role: 'OWNER', keepScroll: true, backTo: 'lainnya',
  st: { tab: 'bahan' },
  template() { return topbar({ back: true, title: 'Bahan & Biaya', sub: 'Dasar perhitungan HPP' }) + '<div class="wrap" style="padding-top:14px"><div class="seg light js-tabs"></div><div class="js-body" style="margin-top:14px"></div></div>'; },
  init(el) { on('boot', () => { if (App.current === 'bahan') this.render(el); }); },
  show(el, tab) { if (tab) this.st.tab = tab; this.render(el); },
  render(el) {
    const b = App.boot, tab = this.st.tab;
    $('.js-tabs', el).innerHTML = [['bahan', 'Bahan Baku'], ['biaya', 'Biaya Operasional'], ['estimasi', 'Estimasi Penjualan']].map((t) => '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="tab" data-t="' + t[0] + '" type="button">' + t[1] + '</button>').join('');
    const body = $('.js-body', el);
    if (tab === 'bahan') {
      body.innerHTML = '<button class="btn primary" data-act="mat" type="button" style="margin-bottom:12px">' + icon('plus', 'sm') + 'Tambah Bahan</button>' +
        ((b.materials || []).length ? '<div class="card" style="padding:0 16px">' + b.materials.map((m) => '<button class="list-item" data-act="mat" data-id="' + esc(m.bahan_id) + '" type="button"><span class="ico-box ' + (m.jenis === 'KEMASAN' ? 'info' : '') + '">' + icon(m.jenis === 'KEMASAN' ? 'package' : 'coffee', 'sm') + '</span><div class="grow"><div class="t ellipsis">' + esc(m.nama) + '</div><div class="s">' + rp(m.harga_beli) + ' / ' + esc(m.satuan_beli) + ' (' + fmtNum(m.isi_per_kemasan) + ' ' + esc(m.satuan_pakai) + ')</div></div><div style="text-align:right"><div class="num" style="font-weight:800">Rp' + fmtNum(Math.round(HPP.unitPrice(m) * 100) / 100) + '</div><div class="muted" style="font-size:12px">per ' + esc(m.satuan_pakai) + '</div></div>' + icon('chevron-right', 'sm faint') + '</button>').join('') + '</div>' : emptyState('coffee', 'Belum ada bahan', 'Contoh: tepung, susu, kopi, cup.'));
    } else if (tab === 'biaya') {
      const total = (b.costs || []).reduce((s, c) => s + toNum(c.nominal_per_bulan), 0);
      body.innerHTML = '<div class="mini" style="margin-bottom:12px"><span class="ico-box">' + icon('wallet', 'sm') + '</span><div class="k">Total biaya / bulan</div><div class="v">' + rp(total) + '</div></div>' +
        '<button class="btn primary" data-act="cost" type="button" style="margin-bottom:12px">' + icon('plus', 'sm') + 'Tambah Biaya</button>' +
        ((b.costs || []).length ? '<div class="card" style="padding:0 16px">' + b.costs.map((c) => '<button class="list-item" data-act="cost" data-id="' + esc(c.biaya_id) + '" type="button"><div class="grow t">' + esc(c.nama) + '</div><b class="num">' + rp(c.nominal_per_bulan) + '</b>' + icon('chevron-right', 'sm faint') + '</button>').join('') + '</div>' : emptyState('wallet', 'Belum ada biaya', 'Contoh: gas & listrik, sewa, gaji.'));
    } else {
      const est = {}; (b.production || []).forEach((p) => { est[p.produk_id] = toNum(p.estimasi_terjual_per_bulan); });
      const o = HPP.opsPerUnit(b);
      body.innerHTML = '<div class="banner info" style="margin-bottom:12px">' + icon('info', 'sm') + '<div>Estimasi porsi terjual per bulan dipakai untuk membagi biaya operasional ke setiap porsi. Saat ini: <b>' + rp(o.perUnit) + '/porsi</b> (' + rp(o.total) + ' ÷ ' + fmtNum(o.prod) + ').</div></div>' +
        '<div class="card" style="padding:0 16px">' + (b.products || []).map((p) => '<div class="list-item"><div class="thumb">' + productImg(p) + '</div><div class="grow t ellipsis">' + esc(p.nama) + '</div><input class="input" data-est="' + esc(p.produk_id) + '" inputmode="numeric" value="' + (est[p.produk_id] || '') + '" placeholder="0" style="width:110px;text-align:right"><span class="muted" style="font-size:12px">/bln</span></div>').join('') + '</div>' +
        '<button class="btn primary block lg" data-act="saveest" type="button" style="margin-top:14px">' + icon('check', 'sm') + 'Simpan Estimasi</button>';
    }
  },
  actions: {
    tab(a, e, el) { this.st.tab = a.dataset.t; this.render(el); },
    mat(a, e, el) { openMaterialForm(a.dataset.id); },
    cost(a, e, el) { openCostForm(a.dataset.id); },
    saveest(a, e, el) {
      const rows = $$('[data-est]', el).map((i) => ({ produk_id: i.dataset.est, estimasi_terjual_per_bulan: toNum(i.value) })).filter((r) => r.estimasi_terjual_per_bulan > 0);
      ownerWrite('saveProduction', { rows }, { apply: () => { const old = App.boot.production; App.boot.production = rows; return () => { App.boot.production = old; }; }, msg: 'Estimasi disimpan' });
    }
  }
});
function openMaterialForm(id) {
  const m = id ? (App.boot.materials || []).find((x) => x.bahan_id === id) : null;
  let jenis = m ? m.jenis || 'BAHAN' : 'BAHAN';
  const units = ['g', 'ml', 'pcs', 'butir', 'lembar', 'sdm'];
  const s = sheet({
    title: m ? 'Ubah Bahan' : 'Tambah Bahan',
    body: '<label class="field"><span class="lbl">Nama bahan <span class="req">*</span></span><input class="input" id="mN" value="' + esc(m ? m.nama : '') + '" placeholder="contoh: Susu UHT"></label>' +
      '<div class="field"><span class="lbl">Jenis</span><div class="seg light" id="mJ"><button data-j="BAHAN" type="button">Bahan</button><button data-j="KEMASAN" type="button">Kemasan</button></div></div>' +
      '<div class="grid-2"><label class="field"><span class="lbl">Satuan beli</span><input class="input" id="mSB" value="' + esc(m ? m.satuan_beli : 'pack') + '" placeholder="pack / karton / kg"></label><label class="field" style="margin-top:14px"><span class="lbl">Harga beli</span>' + moneyInput('id="mH"', m ? m.harga_beli : '') + '</label></div>' +
      '<div class="grid-2"><label class="field"><span class="lbl">Isi per kemasan <span class="req">*</span></span><input class="input" id="mI" inputmode="decimal" value="' + esc(m ? m.isi_per_kemasan : '') + '" placeholder="1000"></label><label class="field" style="margin-top:14px"><span class="lbl">Satuan pakai</span><select class="select" id="mSP">' + units.map((u) => '<option' + ((m ? m.satuan_pakai : 'g') === u ? ' selected' : '') + '>' + u + '</option>').join('') + '</select></label></div>' +
      '<div class="grid-2">' + (m ? '' : '<label class="field"><span class="lbl">Stok awal (satuan pakai)</span><input class="input" id="mS" inputmode="decimal" placeholder="0"></label>') + '<label class="field"' + (m ? '' : ' style="margin-top:14px"') + '><span class="lbl">Stok minimum</span><input class="input" id="mMin" inputmode="decimal" value="' + esc(m ? m.stok_minimum : '') + '" placeholder="0"></label></div>' +
      '<div class="help" id="mInfo"></div>',
    foot: '<div class="row">' + (m ? '<button class="btn danger" id="mDel" type="button">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn primary grow" id="mSave" type="button">Simpan</button></div>'
  });
  const info = () => { const h = parseMoney($('#mH', s.el).value), i = toNum($('#mI', s.el).value); $('#mInfo', s.el).innerHTML = icon('info', 'xs') + (i ? 'Harga per ' + $('#mSP', s.el).value + ': <b>Rp' + fmtNum(Math.round(h / i * 100) / 100) + '</b>' : 'Isi per kemasan contoh: susu 1 liter = 1000 ml.'); };
  const paintJ = () => $$('#mJ button', s.el).forEach((b) => b.classList.toggle('on', b.dataset.j === jenis));
  $('#mJ', s.el).onclick = (e) => { const b = e.target.closest('button'); if (b) { jenis = b.dataset.j; paintJ(); } };
  s.el.addEventListener('input', info); s.el.addEventListener('change', info); paintJ(); info();
  $('#mSave', s.el).onclick = () => {
    const d = { bahan_id: m ? m.bahan_id : shortId('B'), nama: $('#mN', s.el).value.trim(), jenis, satuan_beli: $('#mSB', s.el).value.trim() || 'pack', harga_beli: parseMoney($('#mH', s.el).value), isi_per_kemasan: toNum($('#mI', s.el).value.replace(',', '.')), satuan_pakai: $('#mSP', s.el).value, stok_minimum: toNum(($('#mMin', s.el).value || '0').replace(',', '.')) };
    if (!d.nama || !(d.isi_per_kemasan > 0)) { toast('Nama dan isi per kemasan wajib diisi', 'bad'); return; }
    const obj = Object.assign({}, m || {}, d, { stok: m ? m.stok : toNum((($('#mS', s.el) || {}).value || '0').replace(',', '.')) });
    if (!m) d.stok = obj.stok;
    s.close();
    ownerWrite('saveMaterial', d, { apply: () => replaceIn(App.boot.materials, 'bahan_id', obj), msg: 'Bahan disimpan' });
  };
  const del = $('#mDel', s.el);
  if (del) del.onclick = async () => { if (!(await confirmDlg({ title: 'Hapus ' + m.nama + '?', msg: 'Bahan ini juga dihapus dari semua resep.', okText: 'Hapus', danger: true }))) return; s.close(); ownerWrite('deleteMaterial', { bahan_id: m.bahan_id }, { apply: () => { const u = removeIn(App.boot.materials, 'bahan_id', m.bahan_id); const old = App.boot.recipes; App.boot.recipes = old.filter((r) => r.bahan_id !== m.bahan_id); return () => { u(); App.boot.recipes = old; }; }, msg: 'Bahan dihapus' }); };
}
function openCostForm(id) {
  const c = id ? (App.boot.costs || []).find((x) => x.biaya_id === id) : null;
  const s = sheet({
    title: c ? 'Ubah Biaya' : 'Tambah Biaya Operasional',
    body: '<label class="field"><span class="lbl">Nama biaya <span class="req">*</span></span><input class="input" id="cN" value="' + esc(c ? c.nama : '') + '" placeholder="contoh: Gas & listrik"></label><div class="chips wrap" style="margin-top:8px">' + ['Gas & listrik', 'Sewa tempat', 'Gaji karyawan', 'Internet', 'Air'].map((x) => '<button class="chip" data-n="' + x + '" type="button">' + x + '</button>').join('') + '</div>' +
      '<label class="field"><span class="lbl">Nominal per bulan <span class="req">*</span></span>' + moneyInput('id="cV" class="input big money"', c ? c.nominal_per_bulan : '') + '</label>',
    foot: '<div class="row">' + (c ? '<button class="btn danger" id="cDel" type="button">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn primary grow" id="cSave" type="button">Simpan</button></div>'
  });
  $('#cV', s.el).className = 'input big money';
  s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (b) $('#cN', s.el).value = b.dataset.n; });
  $('#cSave', s.el).onclick = () => { const d = { biaya_id: c ? c.biaya_id : shortId('O'), nama: $('#cN', s.el).value.trim(), nominal_per_bulan: parseMoney($('#cV', s.el).value) }; if (!d.nama) { toast('Nama biaya wajib diisi', 'bad'); return; } s.close(); ownerWrite('saveCost', d, { apply: () => replaceIn(App.boot.costs, 'biaya_id', d), msg: 'Biaya disimpan' }); };
  const del = $('#cDel', s.el); if (del) del.onclick = () => { s.close(); ownerWrite('deleteCost', { biaya_id: c.biaya_id }, { apply: () => removeIn(App.boot.costs, 'biaya_id', c.biaya_id), msg: 'Biaya dihapus' }); };
}

/* ================================================================= PROMO */
page('promo', {
  role: 'OWNER', backTo: 'lainnya',
  template() { return topbar({ back: true, title: 'Promo & Diskon', sub: 'Diterapkan otomatis di kasir', right: '<button class="btn primary sm" data-act="form" type="button">' + icon('plus', 'sm') + 'Promo</button>' }) + '<div class="wrap js-body" style="padding-top:14px"></div>'; },
  init(el) { on('boot', () => { if (App.current === 'promo') this.show(el); }); },
  show(el) {
    const list = App.boot.promos || [], now = Date.now();
    $('.js-body', el).innerHTML = list.length ? list.map((p) => {
      const active = p.status_aktif && (!p.mulai || new Date(p.mulai) <= now) && (!p.selesai || endOfDay(p.selesai) >= now);
      const target = p.berlaku_untuk === 'PRODUK' ? ((Local.product(p.target_id) || {}).nama || 'produk') : p.berlaku_untuk === 'KATEGORI' ? ((App.boot.categories.find((c) => c.kategori_id === p.target_id) || {}).nama || 'kategori') : 'Semua belanja';
      return '<div class="card pad" style="margin-bottom:10px"><div class="row"><span class="ico-box ' + (active ? 'ok' : '') + '">' + icon('tag', 'sm') + '</span><div class="grow"><b>' + esc(p.nama) + '</b><div class="muted" style="font-size:13px">' + (p.tipe === 'PERSEN' ? toNum(p.nilai) + '%' : rp(p.nilai)) + ' · ' + esc(target) + (toNum(p.min_belanja) ? ' · min ' + rp(p.min_belanja) : '') + '</div>' +
        '<div class="muted" style="font-size:12.5px">' + (p.mulai || p.selesai ? (p.mulai ? fmtDate(p.mulai) : '…') + ' – ' + (p.selesai ? fmtDate(p.selesai) : '…') : 'Tanpa batas waktu') + '</div></div><label class="toggle"><input type="checkbox" data-tog="' + esc(p.promo_id) + '"' + (p.status_aktif ? ' checked' : '') + '></label></div>' +
        '<div class="row" style="margin-top:10px"><span class="pill ' + (active ? 'ok' : 'neutral') + ' sm">' + (active ? 'Aktif sekarang' : p.status_aktif ? 'Terjadwal / berakhir' : 'Nonaktif') + '</span><span class="grow"></span><button class="btn xs outline" data-act="form" data-id="' + esc(p.promo_id) + '" type="button">' + icon('pencil', 'xs') + 'Ubah</button></div></div>';
    }).join('') : emptyState('tag', 'Belum ada promo', 'Contoh: diskon 10% min. belanja Rp40.000.', '<button class="btn primary" data-act="form" type="button">' + icon('plus', 'sm') + 'Buat Promo</button>');
    $$('[data-tog]', el).forEach((t) => t.addEventListener('change', () => { const p = list.find((x) => x.promo_id === t.dataset.tog); const nv = Object.assign({}, p, { status_aktif: t.checked }); ownerWrite('savePromo', nv, { apply: () => replaceIn(App.boot.promos, 'promo_id', nv), msg: t.checked ? 'Promo diaktifkan' : 'Promo dinonaktifkan' }); }));
  },
  actions: { form(a) { openPromoForm(a.dataset.id); } }
});
function openPromoForm(id) {
  const p = id ? App.boot.promos.find((x) => x.promo_id === id) : null;
  let tipe = p ? p.tipe : 'PERSEN', untuk = p ? p.berlaku_untuk : 'SEMUA';
  const s = sheet({
    title: p ? 'Ubah Promo' : 'Promo Baru',
    body: '<label class="field"><span class="lbl">Nama promo <span class="req">*</span></span><input class="input" id="pN" value="' + esc(p ? p.nama : '') + '" placeholder="contoh: Promo Jumat Hemat 10%"></label>' +
      '<div class="field"><span class="lbl">Jenis potongan</span><div class="seg light" id="pT"><button data-t="PERSEN" type="button">Persen (%)</button><button data-t="NOMINAL" type="button">Nominal (Rp)</button></div></div>' +
      '<label class="field"><span class="lbl">Nilai <span class="req">*</span></span><input class="input big" id="pV" inputmode="numeric" value="' + esc(p ? p.nilai : '') + '"></label>' +
      '<div class="field"><span class="lbl">Berlaku untuk</span><div class="seg light" id="pU"><button data-u="SEMUA" type="button">Semua</button><button data-u="PRODUK" type="button">Produk</button><button data-u="KATEGORI" type="button">Kategori</button></div><select class="select" id="pTarget" style="margin-top:8px"></select></div>' +
      '<label class="field"><span class="lbl">Minimal belanja</span>' + moneyInput('id="pMin" placeholder="0 = tanpa minimal"', p ? p.min_belanja : '') + '</label>' +
      '<div class="grid-2"><label class="field"><span class="lbl">Mulai</span><input class="input" type="date" id="pS" value="' + (p && p.mulai ? ymd(p.mulai) : '') + '"></label><label class="field" style="margin-top:14px"><span class="lbl">Selesai</span><input class="input" type="date" id="pE" value="' + (p && p.selesai ? ymd(p.selesai) : '') + '"></label></div>' +
      '<div class="help">' + icon('info', 'xs') + 'Promo nominal pada produk/kategori dihitung per item. Jika beberapa promo cocok, kasir otomatis memakai potongan terbesar.</div>',
    foot: '<div class="row">' + (p ? '<button class="btn danger" id="pDel" type="button">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn primary grow" id="pSave" type="button">Simpan Promo</button></div>'
  });
  const paint = () => {
    $$('#pT button', s.el).forEach((b) => b.classList.toggle('on', b.dataset.t === tipe));
    $$('#pU button', s.el).forEach((b) => b.classList.toggle('on', b.dataset.u === untuk));
    const sel = $('#pTarget', s.el); sel.hidden = untuk === 'SEMUA';
    const opts = untuk === 'PRODUK' ? (App.boot.products || []).map((x) => [x.produk_id, x.nama]) : (App.boot.categories || []).map((x) => [x.kategori_id, x.nama]);
    sel.innerHTML = opts.map((o) => '<option value="' + esc(o[0]) + '"' + (p && p.target_id === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('');
    $('#pV', s.el).classList.toggle('money', tipe === 'NOMINAL');
  };
  $('#pT', s.el).onclick = (e) => { const b = e.target.closest('button'); if (b) { tipe = b.dataset.t; $('#pV', s.el).value = ''; paint(); } };
  $('#pU', s.el).onclick = (e) => { const b = e.target.closest('button'); if (b) { untuk = b.dataset.u; paint(); } };
  paint();
  if (p && tipe === 'NOMINAL') $('#pV', s.el).value = NF.format(p.nilai);
  $('#pSave', s.el).onclick = () => {
    const d = { promo_id: p ? p.promo_id : shortId('PM'), nama: $('#pN', s.el).value.trim(), tipe, nilai: tipe === 'PERSEN' ? Math.min(100, toNum($('#pV', s.el).value)) : parseMoney($('#pV', s.el).value), berlaku_untuk: untuk, target_id: untuk === 'SEMUA' ? '' : $('#pTarget', s.el).value, min_belanja: parseMoney($('#pMin', s.el).value), mulai: $('#pS', s.el).value ? new Date($('#pS', s.el).value + 'T00:00').toISOString() : '', selesai: $('#pE', s.el).value ? new Date($('#pE', s.el).value + 'T00:00').toISOString() : '', status_aktif: p ? p.status_aktif : true };
    if (!d.nama || !(d.nilai > 0)) { toast('Nama dan nilai promo wajib diisi', 'bad'); return; }
    s.close(); ownerWrite('savePromo', d, { apply: () => replaceIn(App.boot.promos, 'promo_id', d), msg: 'Promo disimpan' });
  };
  const del = $('#pDel', s.el); if (del) del.onclick = () => { s.close(); ownerWrite('deletePromo', { promo_id: p.promo_id }, { apply: () => removeIn(App.boot.promos, 'promo_id', p.promo_id), msg: 'Promo dihapus' }); };
}

/* ======================================================= KARYAWAN & PERANGKAT */
page('karyawan', {
  role: 'OWNER', backTo: 'lainnya',
  st: { tab: 'user' },
  template() { return topbar({ back: true, title: 'Karyawan & Perangkat', right: '<button class="btn primary sm js-add" data-act="user" type="button">' + icon('plus', 'sm') + 'Akun</button>' }) + '<div class="wrap" style="padding-top:14px"><div class="seg light js-tabs"></div><div class="js-body" style="margin-top:14px"></div></div>'; },
  init(el) { on('boot', () => { if (App.current === 'karyawan' && this.st.tab === 'user') this.render(el); }); },
  show(el) { this.render(el); },
  render(el) {
    const tab = this.st.tab;
    $('.js-tabs', el).innerHTML = [['user', 'Pengguna'], ['device', 'Perangkat'], ['log', 'Log Aktivitas']].map((t) => '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="tab" data-t="' + t[0] + '" type="button">' + t[1] + '</button>').join('');
    $('.js-add', el).hidden = tab !== 'user';
    const body = $('.js-body', el);
    if (tab === 'user') {
      body.innerHTML = '<div class="card" style="padding:0 16px">' + (App.boot.users || []).map((u) => '<div class="list-item"><div class="thumb">' + esc(initials(u.nama)) + '</div><div class="grow"><div class="t">' + esc(u.nama) + (u.user_id === App.user.user_id ? ' <span class="pill brand sm">Anda</span>' : '') + '</div><div class="s">@' + esc(u.username) + ' · ' + (u.role === 'OWNER' ? 'Pemilik' : 'Kasir') + '</div></div>' +
        '<button class="icon-btn" data-act="user" data-id="' + esc(u.user_id) + '" type="button" aria-label="Ubah">' + icon('pencil', 'sm') + '</button><button class="icon-btn" data-act="pin" data-id="' + esc(u.user_id) + '" type="button" aria-label="Reset PIN">' + icon('lock', 'sm') + '</button>' +
        (u.user_id !== App.user.user_id ? '<label class="toggle"><input type="checkbox" data-uact="' + esc(u.user_id) + '"' + (u.status_aktif ? ' checked' : '') + '></label>' : '') + '</div>').join('') + '</div>';
      $$('[data-uact]', body).forEach((t) => t.addEventListener('change', () => { const u = App.boot.users.find((x) => x.user_id === t.dataset.uact); const old = u.status_aktif; ownerWrite('setUserActive', { user_id: u.user_id, aktif: t.checked }, { apply: () => { u.status_aktif = t.checked; return () => { u.status_aktif = old; }; }, msg: t.checked ? 'Akun diaktifkan' : 'Akun dinonaktifkan & dikeluarkan dari semua perangkat' }); }));
    } else if (tab === 'device') {
      body.innerHTML = skeletonList(3, 64);
      swr('devstat', 'getSyncStatus', {}, (d) => {
        body.innerHTML = (d.devices || []).length ? '<div class="card" style="padding:0 16px">' + d.devices.map((v) => '<div class="list-item"><span class="dev-code" style="background:var(--p-soft);color:var(--p-dark)">' + esc(v.kode) + '</span><div class="grow"><div class="t ellipsis">' + esc(v.nama) + '</div><div class="s">' + esc(v.user || '-') + ' · ' + (v.sinkron_terakhir ? 'sinkron ' + fmtDT(v.sinkron_terakhir) : 'belum sinkron') + '</div>' + (v.pending ? '<span class="pill warn sm">' + v.pending + ' menunggu</span>' : '') + '</div><label class="toggle"><input type="checkbox" data-dact="' + esc(v.perangkat_id) + '"' + (v.status_aktif ? ' checked' : '') + '></label></div>').join('') + '</div><div class="help">' + icon('info', 'xs') + 'Menonaktifkan perangkat mencegah login dari perangkat itu (mis. HP hilang).</div>' : emptyState('smartphone', 'Belum ada perangkat', '');
        $$('[data-dact]', body).forEach((t) => t.addEventListener('change', () => ownerWrite('setDeviceActive', { perangkat_id: t.dataset.dact, aktif: t.checked }, { msg: t.checked ? 'Perangkat diaktifkan' : 'Perangkat dinonaktifkan' })));
      }, { fresh: 15000, onError: (e) => { body.innerHTML = retryBox(e.error); } });
    } else {
      body.innerHTML = skeletonList(5, 56);
      swr('actlog', 'getActivityLog', { limit: 200 }, (d) => {
        body.innerHTML = (d.list || []).length ? '<div class="card" style="padding:0 16px">' + d.list.map((l) => '<div class="list-item"><div class="grow"><div class="t" style="font-size:14px">' + esc(String(l.aksi).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())) + (l.objek ? ' · ' + esc(l.objek) : '') + '</div><div class="s">' + fmtDT(l.waktu) + ' · ' + esc(l.user_nama || '-') + (l.detail && l.detail !== '""' ? ' · ' + esc(l.detail) : '') + '</div></div></div>').join('') + '</div>' : emptyState('history', 'Belum ada aktivitas', '');
      }, { fresh: 15000, onError: (e) => { body.innerHTML = retryBox(e.error); } });
    }
  },
  actions: {
    tab(a, e, el) { this.st.tab = a.dataset.t; this.render(el); },
    user(a) {
      const u = a.dataset.id ? App.boot.users.find((x) => x.user_id === a.dataset.id) : null;
      let role = u ? u.role : 'KASIR';
      const s = sheet({ title: u ? 'Ubah Akun' : 'Tambah Akun', body: '<label class="field"><span class="lbl">Nama <span class="req">*</span></span><input class="input" id="uN" value="' + esc(u ? u.nama : '') + '" placeholder="Nama karyawan"></label>' +
        '<label class="field"><span class="lbl">Username <span class="req">*</span></span><input class="input" id="uU" value="' + esc(u ? u.username : '') + '" autocapitalize="none" placeholder="contoh: kasir2"></label>' +
        '<div class="field"><span class="lbl">Peran</span><div class="seg light" id="uR"><button data-r="KASIR" type="button">Kasir</button><button data-r="OWNER" type="button">Pemilik</button></div></div>' +
        (u ? '' : '<label class="field"><span class="lbl">PIN awal (6 digit) <span class="req">*</span></span><input class="input" id="uP" inputmode="numeric" maxlength="6" placeholder="******"></label>'),
      foot: '<button class="btn primary block lg" id="uSave" type="button">Simpan</button>' });
      const paint = () => $$('#uR button', s.el).forEach((b) => b.classList.toggle('on', b.dataset.r === role));
      $('#uR', s.el).onclick = (e) => { const b = e.target.closest('button'); if (b) { role = b.dataset.r; paint(); } }; paint();
      $('#uSave', s.el).onclick = () => {
        const d = { user_id: u ? u.user_id : shortId('U'), nama: $('#uN', s.el).value.trim(), username: $('#uU', s.el).value.trim().toLowerCase(), role, pin: u ? '' : ($('#uP', s.el) || {}).value };
        if (!d.nama || !/^[a-z0-9._]{3,20}$/.test(d.username)) { toast('Nama wajib & username 3–20 huruf kecil/angka', 'bad'); return; }
        if (!u && !/^\d{6}$/.test(d.pin)) { toast('PIN harus 6 digit angka', 'bad'); return; }
        s.close();
        const obj = { user_id: d.user_id, nama: d.nama, username: d.username, role, status_aktif: u ? u.status_aktif : true };
        ownerWrite('saveUser', d, { apply: () => replaceIn(App.boot.users, 'user_id', obj), msg: 'Akun disimpan' });
      };
    },
    async pin(a) {
      const u = App.boot.users.find((x) => x.user_id === a.dataset.id);
      const p = await promptDlg({ title: 'Reset PIN ' + u.nama, msg: 'PIN baru 6 digit. Akun akan keluar dari semua perangkat.', type: 'password', inputmode: 'numeric', maxlength: 6, okText: 'Reset PIN' });
      if (!p) return; if (!/^\d{6}$/.test(p)) { toast('PIN harus 6 digit angka', 'bad'); return; }
      ownerWrite('resetPin', { user_id: u.user_id, pin: p }, { msg: 'PIN direset' });
    }
  }
});

/* ============================================================ PENGATURAN */
const COLOR_PRESETS = ['#F26B1D', '#E11D48', '#D97706', '#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#92400E', '#1F2937'];
page('pengaturan', {
  role: 'OWNER', nav: false, foot: true, backTo: 'lainnya',
  template() { return topbar({ back: true, title: 'Pengaturan Toko', right: '<button class="link-btn" data-act="save" type="button">Simpan</button>' }) + '<div class="wrap js-body" style="padding-top:14px;max-width:960px"></div><div class="sticky-foot"><div class="in"><button class="btn primary block lg" data-act="save" type="button">' + icon('check', 'sm') + 'Simpan Pengaturan</button></div></div>'; },
  show(el) { this.s = Object.assign({}, App.settings); this.logo = null; this.hapusLogo = false; this.render(el); },
  render(el) {
    const s = this.s;
    const f = (k, label, ph, type) => '<label class="field"><span class="lbl">' + label + '</span><input class="input" data-k="' + k + '" value="' + esc(s[k] || '') + '" placeholder="' + esc(ph || '') + '"' + (type ? ' type="' + type + '"' : '') + '></label>';
    const n = (k, label, suf) => '<label class="field"><span class="lbl">' + label + '</span><div class="input-wrap"><input class="input" data-k="' + k + '" inputmode="numeric" value="' + esc(s[k] || '') + '"><span class="suffix muted" style="font-size:13px">' + (suf || '') + '</span></div></label>';
    const logo = this.logo || (!this.hapusLogo && s.logo_url);
    $('.js-body', el).innerHTML = '<div class="desk-2"><div class="stack">' +
      '<div class="card pad"><span class="sec-title"><span class="bullet"></span>Identitas toko</span>' + f('nama_toko', 'Nama brand / toko', 'Toko Roti Visena') + f('tagline', 'Tagline (untuk menu & poster)', 'Fresh from the oven setiap hari') + f('alamat', 'Alamat', 'Jl. …') + f('no_wa', 'No. WhatsApp toko', '08xxxxxxxxxx', 'tel') + f('email_owner', 'Email penerima laporan', 'nama@gmail.com', 'email') + '</div>' +
      '<div class="card pad"><span class="sec-title"><span class="bullet"></span>Logo</span><div class="row" style="margin-top:12px"><div class="logo md">' + (logo ? '<img src="' + esc(logo) + '" alt="">' : esc((s.nama_toko || 'Q').charAt(0))) + '</div><div class="grow muted" style="font-size:13px">PNG/JPG, otomatis dikompres. Tampil di aplikasi, struk, menu & poster.</div></div>' +
      '<div class="grid-2" style="margin-top:12px"><button class="btn outline" data-act="logo" type="button">' + icon('upload', 'sm') + 'Unggah Logo</button><button class="btn outline" data-act="nologo" type="button"' + (logo ? '' : ' disabled') + '>' + icon('trash', 'sm') + 'Hapus</button></div></div>' +
      '<div class="card pad"><span class="sec-title"><span class="bullet"></span>Warna tema aplikasi</span><div class="field"><span class="lbl">Warna utama</span><div class="row wrapx" style="gap:10px">' + COLOR_PRESETS.map((c) => '<button class="swatch' + (String(s.warna_primer).toUpperCase() === c ? ' on' : '') + '" style="background:' + c + '" data-act="color" data-c="' + c + '" type="button" aria-label="' + c + '"></button>').join('') + '<label class="swatch" style="background:conic-gradient(red,yellow,lime,aqua,blue,magenta,red);position:relative" title="Pilih warna lain"><input type="color" data-k="warna_primer" value="' + esc(s.warna_primer || '#F26B1D') + '" style="opacity:0;position:absolute;inset:0;width:100%;height:100%"></label></div></div>' +
      '<div class="field"><span class="lbl">Warna aksen</span><input type="color" data-k="warna_aksen" value="' + esc(s.warna_aksen || '#16A34A') + '" style="width:64px;height:40px;border:1px solid var(--line);border-radius:10px;background:#fff"></div>' +
      '<div class="help">' + icon('info', 'xs') + 'Warna langsung berlaku di semua perangkat setelah disimpan.</div><div class="row" style="margin-top:10px;gap:8px"><span class="btn primary sm">Contoh tombol</span><span class="chip on">Chip aktif</span></div></div>' +
      '</div><div class="stack">' +
      '<div class="card pad"><span class="sec-title"><span class="bullet"></span>Struk</span><div class="field"><span class="lbl">Ukuran kertas</span><div class="seg light" id="paper"><button data-v="58" type="button" class="' + (s.ukuran_kertas !== '80' ? 'on' : '') + '">58 mm</button><button data-v="80" type="button" class="' + (s.ukuran_kertas === '80' ? 'on' : '') + '">80 mm</button></div></div>' + f('footer_struk', 'Teks penutup struk', 'Terima kasih, sampai jumpa lagi!') +
      '<div class="row between" style="margin-top:14px"><b style="font-size:14px">Tampilkan logo di pratinjau struk</b><label class="toggle"><input type="checkbox" data-k="tampil_logo_struk"' + (s.tampil_logo_struk !== 'FALSE' ? ' checked' : '') + '></label></div></div>' +
      '<div class="card pad"><span class="sec-title"><span class="bullet"></span>Aturan bisnis</span><div class="grid-3" style="gap:8px">' + n('margin_hemat', 'Margin hemat', '%') + n('margin_standar', 'Standar', '%') + n('margin_premium', 'Premium', '%') + '</div>' +
      '<label class="field"><span class="lbl">Pembulatan harga rekomendasi</span><select class="select" data-k="pembulatan">' + ['100', '500', '1000'].map((v) => '<option value="' + v + '"' + (String(s.pembulatan) === v ? ' selected' : '') + '>Ke atas ' + rp(v) + '</option>').join('') + '</select></label>' +
      '<div class="grid-2">' + n('batas_stok_menipis', 'Batas stok menipis', 'pcs') + n('batas_diskon_kasir', 'Maks. diskon kasir', '%') + '</div>' + n('jatuh_tempo_hari', 'Utang jatuh tempo setelah', 'hari') + '</div>' +
      '</div></div><div style="height:16px"></div>';
    $$('#paper button', el).forEach((b) => b.addEventListener('click', () => { this.collect(el); this.s.ukuran_kertas = b.dataset.v; this.render(el); }));
    $$('input[type=color][data-k="warna_primer"]', el).forEach((i) => i.addEventListener('input', () => { this.s.warna_primer = i.value; applyTheme(this.s); }));
  },
  collect(el) { $$('[data-k]', el).forEach((i) => { this.s[i.dataset.k] = i.type === 'checkbox' ? (i.checked ? 'TRUE' : 'FALSE') : i.value.trim(); }); },
  actions: {
    color(a, e, el) { this.collect(el); this.s.warna_primer = a.dataset.c; applyTheme(this.s); this.render(el); },
    async logo(a, e, el) { this.collect(el); const f = await pickImage(false); if (!f) return; this.logo = await compressImage(f, { maxDim: 512, maxBytes: 200 * 1024, type: 'image/png', square: false }); this.hapusLogo = false; this.render(el); },
    nologo(a, e, el) { this.collect(el); this.logo = null; this.hapusLogo = true; this.render(el); },
    async save(a, e, el) {
      this.collect(el);
      const s = this.s, keys = Object.keys(App.settings).concat(['nama_toko', 'tagline', 'alamat', 'no_wa', 'email_owner', 'warna_primer', 'warna_aksen', 'footer_struk', 'ukuran_kertas', 'tampil_logo_struk', 'margin_hemat', 'margin_standar', 'margin_premium', 'pembulatan', 'batas_stok_menipis', 'batas_diskon_kasir', 'jatuh_tempo_hari']);
      const out = {}; keys.forEach((k) => { if (k !== 'logo_url' && k !== 'logo_file_id' && s[k] !== undefined) out[k] = s[k]; });
      if (!out.nama_toko) { toast('Nama toko wajib diisi', 'bad'); return; }
      const old = App.boot.settings, logo = this.logo, hapus = this.hapusLogo;
      await ownerWrite('saveSettings', { settings: out, logoDataUrl: logo || '', hapusLogo: hapus }, {
        msg: 'Pengaturan disimpan',
        apply: () => { App.boot.settings = Object.assign({}, old, out, logo ? { logo_url: logo } : hapus ? { logo_url: '' } : {}); applyTheme(App.boot.settings); return () => { App.boot.settings = old; applyTheme(old); }; },
        onOk: (d) => { if (d.logo_url !== undefined && (logo || hapus)) App.boot.settings.logo_url = d.logo_url || ''; applyTheme(App.boot.settings); Shell.renderNav(); }
      });
      this.logo = null; this.hapusLogo = false; Shell.renderNav();
    }
  }
});

/* ======================================================= PERLU DITINJAU */
page('tinjau', {
  role: 'OWNER', backTo: 'lainnya',
  template() { return topbar({ back: true, title: 'Perlu Ditinjau', sub: 'Data sinkron yang ditolak server' }) + '<div class="wrap js-body" style="padding-top:14px"></div>'; },
  show(el) {
    const body = $('.js-body', el); body.innerHTML = skeletonList(3, 90);
    swr('review', 'getReview', {}, (d) => {
      const names = { tx: 'Transaksi', cancel: 'Pembatalan', stockIn: 'Stok masuk', payDebt: 'Pembayaran utang', customer: 'Pelanggan baru' };
      body.innerHTML = (d.list || []).length ? d.list.map((r) => { let p = {}; try { p = JSON.parse(r.payload || '{}'); } catch (e) {} return '<div class="card pad" style="margin-bottom:10px;border-left:4px solid var(--bad)"><div class="row between"><b>' + esc(names[r.jenis] || r.jenis) + '</b><span class="muted" style="font-size:12.5px">' + fmtDT(r.waktu) + '</span></div>' +
        '<div class="mono" style="font-size:12.5px;margin-top:4px">' + esc(p.no_nota || p.nama || r.sync_id) + (p.total ? ' · ' + rp(p.total) : '') + '</div><div class="err">' + esc(r.pesan) + '</div>' +
        '<div class="row" style="margin-top:10px"><button class="btn outline sm" data-act="resolve" data-id="' + esc(r.sync_id) + '" type="button">' + icon('check', 'sm') + 'Tandai sudah ditinjau</button></div></div>'; }).join('') : emptyState('shield', 'Semua aman', 'Tidak ada data sinkron yang ditolak dalam 90 hari terakhir.');
    }, { fresh: 10000, onError: (e) => { body.innerHTML = retryBox(e.error); } });
  },
  actions: {
    async resolve(a, e, el) { busy(a, true); const r = await api('resolveReview', { sync_id: a.dataset.id }); if (r.ok) { Store.del(userKey('review')); this.show(el); toast('Ditandai', 'ok'); } else { busy(a, false); toast(r.error, 'bad'); } },
    retry(a, e, el) { this.show(el); }
  }
});
