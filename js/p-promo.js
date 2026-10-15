/* ============================================================================
   QASIR — p-promo.js · Daftar Menu, Prompt Poster Promo, Cetak Label Barcode
   ========================================================================== */
'use strict';

function menuProducts() {
  const cats = (App.boot.categories || []).slice().sort((a, b) => toNum(a.urutan) - toNum(b.urutan));
  const prods = (App.boot.products || []).filter((p) => p.tampil_di_menu !== false && p.status_aktif !== false);
  const groups = cats.map((c) => ({ cat: c, items: prods.filter((p) => p.kategori_id === c.kategori_id) })).filter((g) => g.items.length);
  const orphan = prods.filter((p) => !cats.some((c) => c.kategori_id === p.kategori_id));
  if (orphan.length) groups.push({ cat: { nama: 'Lainnya' }, items: orphan });
  return groups;
}
function varSummary(pid) {
  const v = (App.boot.variants || []).filter((x) => x.produk_id === pid);
  if (!v.length) return '';
  const g = {}; v.forEach((x) => { (g[x.grup] = g[x.grup] || []).push(x.nama + (toNum(x.tambahan_harga) ? ' +' + Math.round(toNum(x.tambahan_harga) / 1000) + 'k' : '')); });
  return Object.keys(g).map((k) => g[k].join('/')).join(' · ');
}

/* ============================================================ DAFTAR MENU */
page('menu', {
  role: 'OWNER', backTo: 'lainnya',
  st: { mode: 'img', cols: 2, title: 'MENU KAMI', showVar: true, showFoot: true },
  template() {
    return topbar({ back: true, title: 'Daftar Menu', sub: 'Untuk cetak, WhatsApp & media sosial' }) +
      '<div class="wrap" style="padding-top:14px;max-width:1100px"><div class="desk-2" style="grid-template-columns:minmax(0,360px) minmax(0,1fr)"><div class="stack js-opts"></div><div><div class="js-preview"></div><div class="grid-3" style="margin-top:12px"><button class="btn primary" data-act="png" type="button">' + icon('image', 'sm') + 'Gambar</button><button class="btn outline" data-act="pdf" type="button">' + icon('printer', 'sm') + 'PDF</button><button class="btn outline" data-act="wa" type="button" style="color:var(--ok)">' + icon('whatsapp', 'sm') + 'Teks WA</button></div>' +
      '<div class="help">' + icon('info', 'xs') + 'Gambar & PDF langsung tersimpan ke folder Unduhan, sama persis dengan pratinjau. Hanya produk yang dicentang "Tampilkan di Daftar Menu".</div></div></div></div>';
  },
  init(el) { on('boot', () => { if (App.current === 'menu') this.renderPreview(el); }); },
  show(el) { this.renderOpts(el); this.renderPreview(el); ImgCache.prefetch([App.settings.logo_url].concat((App.boot.products || []).filter((p) => p.tampil_di_menu !== false).map((p) => p.foto_url))); },
  renderOpts(el) {
    const s = this.st;
    $('.js-opts', el).innerHTML = '<div class="card pad"><span class="sec-title"><span class="bullet"></span>Tampilan</span>' +
      '<div class="field"><span class="lbl">Model</span><div class="seg light"><button data-act="mode" data-v="img" type="button" class="' + (s.mode === 'img' ? 'on' : '') + '">' + icon('grid', 'xs') + 'Dengan foto</button><button data-act="mode" data-v="text" type="button" class="' + (s.mode === 'text' ? 'on' : '') + '">' + icon('rows', 'xs') + 'Teks saja</button></div></div>' +
      (s.mode === 'img' ? '<div class="field"><span class="lbl">Kolom</span><div class="seg light">' + [2, 3].map((c) => '<button data-act="cols" data-v="' + c + '" type="button" class="' + (s.cols === c ? 'on' : '') + '">' + c + ' kolom</button>').join('') + '</div></div>' : '') +
      '<label class="field"><span class="lbl">Judul</span><input class="input" data-k="title" value="' + esc(s.title) + '"></label>' +
      '<div class="row between" style="margin-top:14px"><span style="font-weight:600;font-size:14px">Tampilkan varian</span><label class="toggle"><input type="checkbox" data-k="showVar"' + (s.showVar ? ' checked' : '') + '></label></div>' +
      '<div class="row between" style="margin-top:10px"><span style="font-weight:600;font-size:14px">Alamat & WA di bawah</span><label class="toggle"><input type="checkbox" data-k="showFoot"' + (s.showFoot ? ' checked' : '') + '></label></div></div>' +
      '<a class="card pad row" href="#/produk"><span class="ico-box">' + icon('package', 'sm') + '</span><div class="grow"><b>Atur produk di menu</b><div class="muted" style="font-size:12.5px">Ubah foto, harga, atau sembunyikan produk</div></div>' + icon('chevron-right', 'sm faint') + '</a>';
    $$('[data-k]', el).forEach((i) => i.addEventListener(i.type === 'checkbox' ? 'change' : 'input', () => { this.st[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value; this.renderPreview(el); }));
  },
  paperHtml() {
    const s = this.st, st = App.settings, groups = menuProducts();
    if (!groups.length) return emptyState('utensils', 'Menu masih kosong', 'Tambahkan produk & centang "Tampilkan di Daftar Menu".');
    return '<div class="menu-paper js-paper"><div class="mh">' + (st.logo_url ? '<div class="logo lg" style="margin:0 auto"><img src="' + esc(st.logo_url) + '" alt=""></div>' : '') +
      '<div class="mt">' + esc(s.title || 'MENU') + '</div><div style="font-weight:700;margin-top:2px">' + esc(st.nama_toko || '') + '</div>' + (st.tagline ? '<div class="tg">' + esc(st.tagline) + '</div>' : '') + '</div>' +
      groups.map((g) => '<div class="cat"><b>' + esc(String(g.cat.nama).toUpperCase()) + '</b></div>' +
        (s.mode === 'img' ? '<div style="display:grid;grid-template-columns:repeat(' + s.cols + ',minmax(0,1fr));gap:10px">' + g.items.map((p) => { const src = p._fotoLocal || p.foto_url; return '<div class="mi"><div class="im">' + (src ? '<img src="' + esc(src) + '" alt="">' : '<div class="ph" style="width:100%;height:100%;display:grid;place-items:center;font-weight:800;color:var(--p-dark)">' + esc(initials(p.nama)) + '</div>') + '</div><div class="n">' + esc(p.nama) + '</div><div class="p">' + rp(p.harga_jual) + '</div>' + (s.showVar && varSummary(p.produk_id) ? '<div class="v">' + esc(varSummary(p.produk_id)) + '</div>' : '') + '</div>'; }).join('') + '</div>'
          : g.items.map((p) => '<div class="mi text"><div><div class="n">' + esc(p.nama) + '</div>' + (s.showVar && varSummary(p.produk_id) ? '<div class="v">' + esc(varSummary(p.produk_id)) + '</div>' : '') + '</div><div class="p">' + rp(p.harga_jual) + '</div></div>').join(''))).join('') +
      (s.showFoot && (st.alamat || st.no_wa) ? '<div class="mf">' + (st.alamat ? esc(st.alamat) + '<br>' : '') + (st.no_wa ? 'Pesan via WhatsApp: <b>' + esc(st.no_wa) + '</b>' : '') + '</div>' : '') + '</div>';
  },
  renderPreview(el) { $('.js-preview', el).innerHTML = this.paperHtml(); },
  actions: {
    mode(a, e, el) { this.st.mode = a.dataset.v; this.renderOpts(el); this.renderPreview(el); },
    cols(a, e, el) { this.st.cols = Number(a.dataset.v); this.renderOpts(el); this.renderPreview(el); },
    png(a, e, el) {
      const paper = $('.js-paper', el); if (!paper) return;
      runExport(a, () => Exporter.png(paper, 'Menu-' + (App.settings.nama_toko || 'Qasir').replace(/\W+/g, '-') + '.png', { width: 760, pixelRatio: 2, bg: '#FFF8EE' }));
    },
    pdf(a, e, el) {
      const paper = $('.js-paper', el); if (!paper) return;
      runExport(a, () => Exporter.pdf(paper, 'Menu-' + (App.settings.nama_toko || 'Qasir').replace(/\W+/g, '-') + '.pdf', { width: 760, pixelRatio: 2, bg: '#FFF8EE', page: 'a4', breakSel: '.cat, .mi, .mf', keepSel: '.cat' }));
    },
    wa() {
      const st = App.settings, groups = menuProducts();
      const txt = '*' + (this.st.title || 'MENU') + ' — ' + (st.nama_toko || '') + '*\n' + (st.tagline ? '_' + st.tagline + '_\n' : '') +
        groups.map((g) => '\n*' + String(g.cat.nama).toUpperCase() + '*\n' + g.items.map((p) => '• ' + p.nama + ' — ' + rp(p.harga_jual) + (this.st.showVar && varSummary(p.produk_id) ? '\n   _' + varSummary(p.produk_id) + '_' : '')).join('\n')).join('\n') +
        (st.alamat ? '\n\n📍 ' + st.alamat : '') + (st.no_wa ? '\n📱 Pesan: ' + st.no_wa : '');
      sheet({ title: 'Teks menu untuk WhatsApp', body: '<div class="prompt-box" style="font-family:var(--font)">' + esc(txt) + '</div>', foot: '<div class="grid-2"><button class="btn outline" id="waCopy" type="button">' + icon('copy', 'sm') + 'Salin</button><a class="btn primary" style="background:#16A34A" target="_blank" href="https://wa.me/?text=' + encodeURIComponent(txt) + '">' + icon('whatsapp', 'sm') + 'Kirim WA</a></div>',
        onOpen: (sh) => { $('#waCopy', sh).onclick = () => copyText(txt); } });
    }
  }
});
function imgChip(url, name, file, isLogo) {
  return '<div class="img-chip"><div class="thumb"><img src="' + esc(url) + '" data-src="' + esc(url) + '" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.style.visibility=\'hidden\'"></div><div class="nm grow">' + esc(name) + '</div>' +
    '<button class="btn sm primary" data-act="cpimg" data-u="' + esc(url) + '" type="button">' + icon('copy', 'sm') + 'Salin</button>' +
    '<button class="icon-btn ghost-border" data-act="dl" data-u="' + esc(url) + '" data-n="' + esc(file) + '" type="button" aria-label="Unduh">' + icon('download', 'sm') + '</button></div>';
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Disalin ke clipboard', 'ok', 1500); }
  catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Disalin', 'ok', 1500); } catch (x) { toast('Gagal menyalin', 'bad'); } ta.remove(); }
}

/* ========================================================== PROMPT POSTER */
const POSTER_STYLES = {
  hangat: { nama: 'Hangat & homey', id: 'nuansa hangat dan homey, cahaya pagi keemasan yang lembut, meja kayu, taplak linen, uap tipis dari minuman', en: 'warm and homey mood, soft golden morning light, wooden table, linen cloth, gentle steam rising from the drinks' },
  modern: { nama: 'Modern minimalis', id: 'gaya modern minimalis, latar polos warna lembut, banyak ruang kosong, bayangan halus, komposisi rapi', en: 'modern minimalist style, clean solid pastel background, generous negative space, soft shadows, tidy composition' },
  ceria: { nama: 'Ceria & colorful', id: 'gaya ceria dan penuh warna, elemen grafis playful, confetti, warna cerah kontras, energik', en: 'cheerful and colorful style, playful graphic elements, confetti, bright contrasting colors, energetic' },
  premium: { nama: 'Premium elegan', id: 'gaya premium dan elegan, latar gelap dramatis, pencahayaan studio low-key, aksen emas, tekstur marmer', en: 'premium elegant style, dramatic dark background, low-key studio lighting, gold accents, marble texture' }
};
const POSTER_SIZES = { '1:1': ['Feed IG', '1:1', 'square 1:1 (1080×1080 px)', 'persegi 1:1 (1080×1080 px)', [22, 22]], '4:5': ['Feed 4:5', '4:5', 'portrait 4:5 (1080×1350 px)', 'potret 4:5 (1080×1350 px)', [20, 25]], '9:16': ['Story', '9:16', 'vertical 9:16 (1080×1920 px) for Instagram/WhatsApp story', 'vertikal 9:16 (1080×1920 px) untuk story IG/WhatsApp', [16, 28]], A4: ['Cetak A4', 'A4', 'A4 portrait print poster (2480×3508 px, 300 dpi)', 'poster cetak A4 potret (2480×3508 px, 300 dpi)', [20, 28]],
  '16:9': ['Landscape', '16:9', 'landscape 16:9 (1920×1080 px) for banner, YouTube thumbnail, website or TV menu display', 'landscape 16:9 (1920×1080 px) untuk banner, thumbnail YouTube, website, atau layar TV menu', [30, 17]],
  A4L: ['A4 Landscape', 'A4 ↔', 'A4 landscape print poster (3508×2480 px, 300 dpi)', 'poster cetak A4 landscape (3508×2480 px, 300 dpi)', [28, 20]] };
const POSTER_LANDSCAPE = { '16:9': 1, A4L: 1 };
page('poster', {
  role: 'OWNER', backTo: 'lainnya',
  st: { picks: [], style: 'hangat', size: '4:5', headline: '', promo: '', cta: 'Pesan sekarang!', lang: 'id', out: null },
  template() {
    return topbar({ back: true, title: 'Prompt Poster Promo', sub: 'Buat prompt untuk AI gambar (Gemini, ChatGPT, dll.)', right: '<button class="icon-btn ghost-border" data-act="history" type="button" aria-label="Riwayat">' + icon('history', 'sm') + '</button>' }) +
      '<div class="wrap js-body" style="padding-top:14px;max-width:1000px"></div>';
  },
  init(el) {
    el.addEventListener('input', (e) => { const k = e.target.dataset.pk; if (k) { this.st[k] = e.target.value; this.st.out = null; this.paintOut(el); } });
  },
  show(el) {
    const prods = (App.boot.products || []).filter((p) => p.status_aktif !== false);
    this.st.picks = this.st.picks.filter((id) => Local.product(id));
    if (!this.st.picks.length && prods.length) this.st.picks = [prods[0].produk_id];
    if (!this.st.headline) this.st.headline = App.settings.tagline || 'Teman Ngopi Paling Pas';
    const promo = (App.boot.promos || []).find((p) => p.status_aktif);
    if (!this.st.promo && promo) this.st.promo = promo.nama;
    this.render(el);
  },
  render(el) {
    const s = this.st, prods = (App.boot.products || []).filter((p) => p.status_aktif !== false);
    $('.js-body', el).innerHTML = '<div class="desk-2"><div class="stack">' +
      '<div class="card pad"><div class="step-h"><span class="n">1</span><span class="t">Pilih produk</span><span class="grow"></span><span class="muted" style="font-size:12.5px">maks. 4</span></div><div class="row" style="overflow-x:auto;gap:10px;padding-bottom:4px">' +
      prods.map((p) => '<button class="pick-card' + (s.picks.indexOf(p.produk_id) > -1 ? ' is-on' : '') + '" data-act="pick" data-id="' + esc(p.produk_id) + '" type="button"><div class="thumb" style="width:100%;height:auto;aspect-ratio:1;border-radius:10px">' + productImg(p) + '</div><span class="ck">' + icon('check', 'xs') + '</span><div class="nm">' + esc(p.nama) + '</div><div class="pr">' + rp(p.harga_jual) + '</div></button>').join('') + '</div></div>' +
      '<div class="card pad"><div class="step-h"><span class="n">2</span><span class="t">Gaya & teks</span></div><div class="chips wrap">' + Object.keys(POSTER_STYLES).map((k) => '<button class="chip' + (s.style === k ? ' on' : '') + '" data-act="style" data-k="' + k + '" type="button">' + POSTER_STYLES[k].nama + '</button>').join('') + '</div>' +
      '<label class="field"><span class="lbl">Judul besar</span><input class="input" data-pk="headline" value="' + esc(s.headline) + '"></label>' +
      '<label class="field"><span class="lbl">Teks promo (opsional)</span><input class="input" data-pk="promo" value="' + esc(s.promo) + '" placeholder="contoh: Diskon 10% setiap Jumat"></label>' +
      '<label class="field"><span class="lbl">Ajakan (CTA)</span><input class="input" data-pk="cta" value="' + esc(s.cta) + '"></label></div>' +
      '<div class="card pad"><div class="step-h"><span class="n">3</span><span class="t">Ukuran</span></div><div class="size-grid">' + Object.keys(POSTER_SIZES).map((k) => { const z = POSTER_SIZES[k]; return '<button class="size-tile' + (s.size === k ? ' is-on' : '') + '" data-act="size" data-k="' + k + '" type="button"><span class="ar" style="width:' + z[4][0] + 'px;height:' + z[4][1] + 'px"></span>' + z[0] + '<span class="muted" style="font-size:11px">' + z[1] + '</span></button>'; }).join('') + '</div></div>' +
      '</div><div class="stack"><div class="card pad"><div class="step-h"><span class="n">4</span><span class="t">Prompt siap pakai</span><span class="grow"></span><div class="seg light" style="width:auto"><button data-act="lang" data-v="id" type="button" class="' + (s.lang === 'id' ? 'on' : '') + '">ID</button><button data-act="lang" data-v="en" type="button" class="' + (s.lang === 'en' ? 'on' : '') + '">EN</button></div></div><div class="js-out"></div></div>' +
      '<div class="card pad"><div class="card-h"><span class="sec-title"><span class="bullet"></span>Gambar untuk dilampirkan ke AI</span></div><div class="stack" style="gap:8px">' +
      (App.settings.logo_url ? imgChip(App.settings.logo_url, 'Logo ' + (App.settings.nama_toko || ''), 'logo.png', true) : '<a class="btn sm outline" href="#/pengaturan">' + icon('upload', 'xs') + 'Unggah logo dulu di Pengaturan</a>') +
      s.picks.map((id) => { const p = Local.product(id); const u = p && (p._fotoLocal || p.foto_url); return u ? imgChip(u, p.nama, p.nama.replace(/\W+/g, '-') + '.jpg') : (p ? '<div class="img-chip"><div class="thumb">' + productImg(p) + '</div><div class="nm grow">' + esc(p.nama) + '</div><span class="muted" style="font-size:12px">belum ada foto</span></div>' : ''); }).join('') +
      '</div><div class="help">' + icon('info', 'xs') + '<span><b>Salin</b> → buka Gemini/ChatGPT → <b>tempel</b> (Ctrl+V, atau tekan lama → Tempel di HP). Salin satu per satu: prompt, logo, lalu foto produk.</span></div></div></div></div>';
    // pakai salinan gambar di perangkat (lebih cepat & tetap tampil saat offline)
    const chips = $$('.img-chip img[data-src]', el);
    ImgCache.get(chips.map((i) => i.dataset.src)).then((m) => chips.forEach((i) => { if (m[i.dataset.src]) { i.style.visibility = ''; i.src = m[i.dataset.src]; } })).catch(() => {});
    this.paintOut(el);
  },
  build() {
    const s = this.st, st = App.settings, sty = POSTER_STYLES[s.style], z = POSTER_SIZES[s.size];
    const items = s.picks.map((id) => Local.product(id)).filter(Boolean);
    const list = (lang) => items.map((p) => p.nama + ' (' + rp(p.harga_jual) + ')').join(lang === 'id' ? ', ' : ', ');
    const color = st.warna_primer || '#F26B1D';
    const id = 'Buatkan poster promosi ' + z[3] + ' untuk usaha kuliner "' + (st.nama_toko || '') + '".\n\n' +
      'PRODUK UTAMA: ' + list('id') + '. Gunakan foto produk yang saya lampirkan sebagai acuan utama — pertahankan bentuk, warna, dan tampilan asli produk, tampilkan menggugah selera dan menjadi fokus utama poster.\n\n' +
      (POSTER_LANDSCAPE[s.size] ? 'KOMPOSISI: format melebar — produk berjajar di satu sisi (kanan), blok teks judul/promo/harga di sisi lain (kiri), banyak ruang lega, tetap seimbang.\n\n' : '') +
      'GAYA VISUAL: ' + sty.id + '. Warna utama brand ' + color + ' dipadukan warna netral yang serasi. Fotografi makanan profesional, tajam, detail tekstur jelas.\n\n' +
      'TEKS DI POSTER (bahasa Indonesia, ejaan persis):\n- Judul besar: "' + s.headline + '"\n' + (s.promo ? '- Label promo mencolok: "' + s.promo + '"\n' : '') + items.map((p) => '- "' + p.nama + ' ' + rp(p.harga_jual) + '"\n').join('') + '- Ajakan: "' + s.cta + '"\n' + (st.no_wa ? '- Kontak: "WA ' + st.no_wa + '"\n' : '') + (st.alamat ? '- Alamat kecil: "' + st.alamat + '"\n' : '') +
      '\nLOGO: letakkan logo yang saya lampirkan di bagian atas/pojok, ukuran proporsional, jangan diubah.\n\nTIPOGRAFI: judul tebal dan mudah dibaca dari jauh, hierarki jelas, harga menonjol. Hindari teks tambahan selain yang disebutkan, tanpa watermark.';
    const en = 'Create a ' + z[2] + ' promotional poster for the food business "' + (st.nama_toko || '') + '".\n\n' +
      'HERO PRODUCTS: ' + list('en') + '. Use the attached product photos as the main reference — keep the real shape, color and look of each product, make them appetizing and the focal point.\n\n' +
      (POSTER_LANDSCAPE[s.size] ? 'COMPOSITION: wide layout — products lined up on one side (right), headline/promo/price text block on the other side (left), generous breathing room, well balanced.\n\n' : '') +
      'VISUAL STYLE: ' + sty.en + '. Brand primary color ' + color + ' combined with harmonious neutrals. Professional food photography, sharp focus, rich texture detail.\n\n' +
      'TEXT ON POSTER (keep exactly as written, in Indonesian):\n- Headline: "' + s.headline + '"\n' + (s.promo ? '- Eye-catching promo badge: "' + s.promo + '"\n' : '') + items.map((p) => '- "' + p.nama + ' ' + rp(p.harga_jual) + '"\n').join('') + '- Call to action: "' + s.cta + '"\n' + (st.no_wa ? '- Contact: "WA ' + st.no_wa + '"\n' : '') + (st.alamat ? '- Small address line: "' + st.alamat + '"\n' : '') +
      '\nLOGO: place the attached logo at the top/corner, proportional size, do not alter it.\n\nTYPOGRAPHY: bold, highly legible headline, clear hierarchy, prominent prices. No extra text beyond the above, no watermark.';
    return { id, en, judul: (s.promo || s.headline) + ' · ' + items.map((p) => p.nama).join(', ') };
  },
  paintOut(el) {
    const box = $('.js-out', el); if (!box) return;
    if (!this.st.picks.length) { box.innerHTML = '<div class="muted">Pilih minimal 1 produk.</div>'; return; }
    const o = this.st.out = this.build(), t = this.st.lang === 'id' ? o.id : o.en;
    box.innerHTML = '<div class="prompt-box">' + esc(t) + '</div><div class="grid-2" style="margin-top:10px"><button class="btn primary" data-act="copy" type="button">' + icon('copy', 'sm') + 'Salin Prompt</button><button class="btn outline" data-act="save" type="button">' + icon('check', 'sm') + 'Simpan ke Riwayat</button></div>';
  },
  actions: {
    pick(a, e, el) {
      const id = a.dataset.id, i = this.st.picks.indexOf(id);
      if (i > -1) this.st.picks.splice(i, 1); else if (this.st.picks.length >= 4) { toast('Maksimal 4 produk', 'warn'); return; } else this.st.picks.push(id);
      this.render(el);
    },
    style(a, e, el) { this.st.style = a.dataset.k; this.render(el); },
    size(a, e, el) { this.st.size = a.dataset.k; this.render(el); },
    lang(a, e, el) { this.st.lang = a.dataset.v; this.render(el); },
    copy() { const o = this.st.out; if (o) copyText(this.st.lang === 'id' ? o.id : o.en); },
    async dl(a) { busy(a, true); try { const d = await ImgCache.one(a.dataset.u); if (!d) throw new Error('Gambar belum bisa dimuat'); await Exporter.saveBlob(await (await fetch(d)).blob(), a.dataset.n); } catch (e) { toast(e.message, 'bad'); } busy(a, false); },
    async cpimg(a) {
      busy(a, true);
      try { await copyImage(a.dataset.u); toast('Gambar disalin — tinggal tempel (Ctrl+V) di Gemini/ChatGPT', 'ok', 3000); a.innerHTML = icon('check', 'sm') + 'Tersalin'; setTimeout(() => { a.innerHTML = icon('copy', 'sm') + 'Salin'; }, 2500); }
      catch (e) { toast(e.message || 'Gagal menyalin gambar', 'bad', 4500); }
      busy(a, false);
    },
    async save(a) {
      const o = this.st.out; if (!o) return;
      if (!navigator.onLine) { toast('Menyimpan riwayat butuh internet', 'warn'); return; }
      busy(a, true); const r = await api('savePrompt', { prompt_id: shortId('PR'), judul: o.judul, teks_id: o.id, teks_en: o.en }); busy(a, false);
      if (r.ok) { Store.del(userKey('prompts')); toast('Tersimpan di riwayat', 'ok'); } else toast(r.error, 'bad');
    },
    history() {
      const s = sheet({ title: 'Riwayat Prompt', body: skeletonList(3, 70) });
      swr('prompts', 'getPromptHistory', {}, (d) => {
        if (!s.el.isConnected) return;
        $('.sh-body', s.el).innerHTML = (d.list || []).length ? d.list.map((p, i) => '<div class="list-item"><div class="grow"><div class="t">' + esc(p.judul || 'Prompt') + '</div><div class="s">' + fmtDT(p.waktu) + '</div></div><button class="btn xs outline" data-cp="' + i + '" data-l="id" type="button">ID</button><button class="btn xs outline" data-cp="' + i + '" data-l="en" type="button">EN</button></div>').join('') : emptyState('history', 'Belum ada riwayat', 'Prompt yang disimpan muncul di sini.');
        $$('[data-cp]', s.el).forEach((b) => b.onclick = () => { const p = d.list[b.dataset.cp]; copyText(b.dataset.l === 'id' ? p.teks_id : p.teks_en); });
      }, { fresh: 30000, onError: (e) => { if (s.el.isConnected) $('.sh-body', s.el).innerHTML = retryBox(e.error, 'noop'); } });
    }
  }
});

/* ======================================================= CETAK LABEL BARCODE */
const LABEL_FORMATS = {
  a4: { nama: 'A4 · 3×8 (24 label)', cols: 3, w: 63.5, h: 33.9, page: 'A4', mt: 13, ml: 7.2, gx: 2.5, gy: 0 },
  t40: { nama: 'Thermal 40×30 mm', cols: 1, w: 40, h: 30, page: '40mm 30mm', mt: 0, ml: 0, gx: 0, gy: 0 },
  t50: { nama: 'Thermal 50×25 mm', cols: 1, w: 50, h: 25, page: '50mm 25mm', mt: 0, ml: 0, gx: 0, gy: 0 }
};
page('label', {
  role: 'OWNER', backTo: 'lainnya',
  st: { qty: {}, fmt: 'a4', showName: true, showPrice: true, q: '' },
  template() {
    return topbar({ back: true, title: 'Cetak Label Barcode', sub: 'Tempel di produk & kemasan', right: '<button class="btn primary sm" data-act="print" type="button">' + icon('printer', 'sm') + 'Cetak</button>' }) +
      '<div class="wrap" style="padding-top:14px;max-width:1100px"><div class="desk-2"><div class="stack"><div class="card pad"><span class="sec-title"><span class="bullet"></span>Format kertas</span><div class="chips wrap js-fmt" style="margin-top:10px"></div>' +
      '<div class="row between" style="margin-top:14px"><span style="font-weight:600;font-size:14px">Nama produk</span><label class="toggle"><input type="checkbox" data-k="showName" checked></label></div><div class="row between" style="margin-top:10px"><span style="font-weight:600;font-size:14px">Harga</span><label class="toggle"><input type="checkbox" data-k="showPrice" checked></label></div></div>' +
      '<div class="card pad"><div class="row between"><span class="sec-title"><span class="bullet"></span>Produk & jumlah</span><span class="pill brand sm js-total"></span></div><div class="input-wrap" style="margin-top:10px">' + icon('search', 'sm') + '<input class="input js-q" type="search" placeholder="Cari produk"></div><div class="js-list" style="margin-top:6px"></div></div></div>' +
      '<div><div class="row between" style="margin-bottom:8px"><span class="sec-title">Pratinjau</span><span class="muted js-pages" style="font-size:12.5px"></span></div><div class="js-prev" style="background:#E5E7EB;border-radius:14px;padding:12px"></div></div></div></div>';
  },
  init(el) {
    $('.js-q', el).addEventListener('input', debounce((e) => { this.st.q = e.target.value.trim().toLowerCase(); this.renderList(el); }, 100));
    $$('[data-k]', el).forEach((i) => i.addEventListener('change', () => { this.st[i.dataset.k] = i.checked; this.renderPrev(el); }));
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]'); if (!b) return;
      const id = b.dataset.id, q = this.st.qty; q[id] = Math.max(0, Math.min(500, (q[id] || 0) + Number(b.dataset.step)));
      if (!q[id]) delete q[id];
      this.renderList(el); this.renderPrev(el);
    });
    el.addEventListener('change', (e) => { const i = e.target.closest('[data-qty]'); if (!i) return; const n = Math.max(0, Math.min(500, toNum(i.value))); if (n) this.st.qty[i.dataset.qty] = n; else delete this.st.qty[i.dataset.qty]; this.renderList(el); this.renderPrev(el); });
  },
  show(el, pid) {
    if (pid && Local.product(pid)) { this.st.qty = {}; this.st.qty[pid] = this.st.fmt === 'a4' ? 24 : 10; }
    this.renderFmt(el); this.renderList(el); this.renderPrev(el);
  },
  renderFmt(el) { $('.js-fmt', el).innerHTML = Object.keys(LABEL_FORMATS).map((k) => '<button class="chip' + (this.st.fmt === k ? ' on' : '') + '" data-act="fmt" data-k="' + k + '" type="button">' + LABEL_FORMATS[k].nama + '</button>').join(''); },
  renderList(el) {
    const q = this.st.q, prods = (App.boot.products || []).filter((p) => p.status_aktif !== false && (!q || p.nama.toLowerCase().indexOf(q) > -1));
    $('.js-list', el).innerHTML = prods.map((p) => { const n = this.st.qty[p.produk_id] || 0; return '<div class="list-item"><div class="thumb">' + productImg(p) + '</div><div class="grow"><div class="t ellipsis">' + esc(p.nama) + '</div><div class="s mono">' + esc(p.kode_barcode || '-') + '</div></div>' +
      '<div class="stepper"><button type="button" data-step="-1" data-id="' + esc(p.produk_id) + '" aria-label="Kurangi"' + (n ? '' : ' disabled') + '>' + icon('minus', 'sm') + '</button><input data-qty="' + esc(p.produk_id) + '" value="' + n + '" inputmode="numeric" style="width:44px;text-align:center;border:0;font:inherit;font-weight:800;background:none"><button type="button" data-step="1" data-id="' + esc(p.produk_id) + '" aria-label="Tambah">' + icon('plus', 'sm') + '</button></div></div>'; }).join('') || '<div class="muted">Tidak ada produk.</div>';
    const total = Object.values(this.st.qty).reduce((s, v) => s + v, 0);
    $('.js-total', el).textContent = total + ' label';
  },
  labels() { const out = []; Object.keys(this.st.qty).forEach((id) => { const p = Local.product(id); if (p && p.kode_barcode) for (let i = 0; i < this.st.qty[id]; i++) out.push(p); }); return out; },
  cellHtml(p) { return '<div class="lbl-cell">' + (this.st.showName ? '<div class="n">' + esc(p.nama) + '</div>' : '') + Code128.svg(String(p.kode_barcode), { height: 40, quiet: 6 }) + '<div class="c">' + esc(p.kode_barcode) + '</div>' + (this.st.showPrice ? '<div class="p">' + rp(p.harga_jual) + '</div>' : '') + '</div>'; },
  renderPrev(el) {
    const L = this.labels(), f = LABEL_FORMATS[this.st.fmt];
    const noCode = Object.keys(this.st.qty).filter((id) => { const p = Local.product(id); return p && !p.kode_barcode; }).length;
    $('.js-pages', el).textContent = L.length ? (this.st.fmt === 'a4' ? Math.ceil(L.length / 24) + ' lembar A4' : L.length + ' label') : '';
    $('.js-prev', el).innerHTML = (noCode ? '<div class="banner warn" style="margin-bottom:8px">' + icon('alert', 'sm') + '<div>' + noCode + ' produk belum punya barcode. Buka produk lalu simpan agar kode dibuat otomatis.</div></div>' : '') +
      (L.length ? '<div class="label-sheet' + (f.cols === 1 ? ' thermal' : '') + '">' + L.slice(0, 48).map((p) => this.cellHtml(p)).join('') + '</div>' + (L.length > 48 ? '<div class="muted" style="text-align:center;margin-top:8px;font-size:12.5px">+' + (L.length - 48) + ' label lainnya</div>' : '') : emptyState('barcode', 'Pilih produk', 'Atur jumlah label di daftar produk.'));
  },
  actions: {
    fmt(a, e, el) { this.st.fmt = a.dataset.k; this.renderFmt(el); this.renderPrev(el); },
    print() {
      const L = this.labels(); if (!L.length) { toast('Pilih produk & jumlah label dulu', 'warn'); return; }
      const f = LABEL_FORMATS[this.st.fmt];
      const w = window.open('', '_blank'); if (!w) { toast('Izinkan pop-up untuk mencetak', 'warn'); return; }
      const cell = (p) => '<div class="c">' + (this.st.showName ? '<div class="n">' + esc(p.nama) + '</div>' : '') + Code128.svg(String(p.kode_barcode), { height: 40, quiet: 6 }) + '<div class="k">' + esc(p.kode_barcode) + '</div>' + (this.st.showPrice ? '<div class="p">' + rp(p.harga_jual) + '</div>' : '') + '</div>';
      const css = '@page{size:' + f.page + ';margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact}' +
        '.sheet{display:grid;grid-template-columns:repeat(' + f.cols + ',' + f.w + 'mm);grid-auto-rows:' + f.h + 'mm;column-gap:' + f.gx + 'mm;row-gap:' + f.gy + 'mm;padding:' + f.mt + 'mm 0 0 ' + f.ml + 'mm}' +
        (f.cols > 1 ? '.sheet{page-break-after:always;height:297mm}' : '') +
        '.c{width:' + f.w + 'mm;height:' + f.h + 'mm;padding:1.5mm 2mm;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;text-align:center' + (f.cols === 1 ? ';page-break-after:always' : '') + '}' +
        '.c svg{width:100%;height:' + (f.h * 0.42) + 'mm}.n{font-size:8pt;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.k{font-family:monospace;font-size:7pt;letter-spacing:.5px}.p{font-size:8pt;font-weight:bold}';
      let body = '';
      if (f.cols > 1) for (let i = 0; i < L.length; i += 24) body += '<div class="sheet">' + L.slice(i, i + 24).map(cell).join('') + '</div>';
      else body = '<div class="sheet">' + L.map(cell).join('') + '</div>';
      w.document.write('<html><head><title>Label Barcode</title><style>' + css + '</style></head><body>' + body + '<script>window.onload=function(){setTimeout(function(){print()},300)}<\/script></body></html>');
      w.document.close();
    }
  }
});
