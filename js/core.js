/* ============================================================================
   QASIR — core.js
   Fondasi: utilitas, penyimpanan lokal (IndexedDB + localStorage), API PRO
   (timeout, retry, idempotensi), antrean offline + sinkron, router SPA,
   tema warna, dan komponen UI (toast, sheet, dialog).
   ========================================================================== */
'use strict';

const CFG = window.QASIR_CONFIG || {};
const APP_VER = '1.4.0';
const GAS_URL = CFG.GAS_URL || '';                       // diisi tenant.js dari Kode Toko
const NS = window.QASIR_NS || '';                         // namespace data lokal per toko ('' = data lama)
const LS_PREFIX = 'qasir:v1:' + NS;
const Tenant = window.QasirTenant || { multi: false, has: () => true, withKode: (u) => u, paketLabel: '' };

/* ---------------------------------------------------------------- Utilitas */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF = new Intl.NumberFormat('id-ID');
const rp = (n) => { n = Math.round(Number(n) || 0); return (n < 0 ? '-' : '') + 'Rp' + NF.format(Math.abs(n)); };
const fmtNum = (n) => NF.format(Math.round((Number(n) || 0) * 100) / 100);
const parseMoney = (v) => Number(String(v === undefined || v === null ? '' : v).replace(/[^\d]/g, '')) || 0;
const toNum = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const debounce = (fn, ms) => { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; };
const pad = (n, l) => String(n).padStart(l || 2, '0');
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
}
const shortId = (p) => (p || '') + uuid().replace(/-/g, '').slice(0, 14);
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const D = (v) => (v instanceof Date ? v : new Date(v));
const fmtTime = (v) => { const d = D(v); return isNaN(d) ? '-' : pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fmtDate = (v) => { const d = D(v); return isNaN(d) ? '-' : pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
const fmtDT = (v) => fmtDate(v) + ' ' + fmtTime(v);
const fmtDateLong = (v) => { const d = D(v); return isNaN(d) ? '-' : d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); };
const ymd = (v) => { const d = D(v); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const startOfDay = (v) => { const d = new Date(D(v)); d.setHours(0, 0, 0, 0); return d; };
const endOfDay = (v) => { const d = new Date(D(v)); d.setHours(23, 59, 59, 999); return d; };
const daysAgo = (n) => { const d = startOfDay(new Date()); d.setDate(d.getDate() - n); return d; };
const initials = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const waNumber = (hp) => { let n = String(hp || '').replace(/\D/g, ''); if (n.startsWith('0')) n = '62' + n.slice(1); return n; };
async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const _scripts = {};
function loadScript(src) {
  if (_scripts[src]) return _scripts[src];
  _scripts[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = res; s.onerror = () => { delete _scripts[src]; rej(new Error('Gagal memuat pustaka (cek internet).')); };
    document.head.appendChild(s);
  });
  return _scripts[src];
}

/* --------------------------------------------------- Penyimpanan kecil (LS) */
const Store = {
  get(k, d) { try { const v = localStorage.getItem(LS_PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch (e) { /* penuh → abaikan */ } },
  del(k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (e) {} },
  ses: {
    get(k, d) { try { const v = sessionStorage.getItem(LS_PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { sessionStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(LS_PREFIX + k); } catch (e) {} }
  }
};
const userKey = (k) => 'u:' + ((App.session && App.session.user && App.session.user.user_id) || 'anon') + ':' + k;
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; }

/* ------------------------------------------------ IndexedDB (data offline) */
const DB = {
  _p: null,
  open() {
    if (this._p) return this._p;
    this._p = new Promise((res, rej) => {
      const r = indexedDB.open('qasir' + (NS ? '-' + NS.replace(/[^\w]/g, '') : ''), 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        db.createObjectStore('kv');
        db.createObjectStore('outbox', { keyPath: 'id' });
        db.createObjectStore('tx', { keyPath: 'transaksi_id' }).createIndex('waktu', 'waktu');
        db.createObjectStore('proofs', { keyPath: 'ref_id' });
        db.createObjectStore('rejected', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this._p;
  },
  async tx(stores, mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction(stores, mode);
      let out;
      const r = fn(t);
      if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Transaksi DB dibatalkan'));
    });
  },
  get(s, k) { return this.tx([s], 'readonly', (t) => t.objectStore(s).get(k)); },
  put(s, v, k) { return this.tx([s], 'readwrite', (t) => (k === undefined ? t.objectStore(s).put(v) : t.objectStore(s).put(v, k))); },
  del(s, k) { return this.tx([s], 'readwrite', (t) => t.objectStore(s).delete(k)); },
  all(s) { return this.tx([s], 'readonly', (t) => t.objectStore(s).getAll()); },
  count(s) { return this.tx([s], 'readonly', (t) => t.objectStore(s).count()); },
  clear(s) { return this.tx([s], 'readwrite', (t) => t.objectStore(s).clear()); }
};

/* ------------------------------------------------------------- Pengukur */
const Perf = {
  rows: [],
  add(action, total, server) { this.rows.push({ action, total, server: server === undefined ? null : server, net: server !== undefined && server !== null ? total - server : null, at: new Date().toLocaleTimeString() }); if (this.rows.length > 200) this.rows.shift(); },
  table() { console.table(this.rows.slice(-30)); }
};
window.Perf = Perf;

/* ------------------------------------------------------------ State app */
const App = {
  session: null, boot: null, ver: '', current: '',
  sync: { state: 'idle', pending: 0, lastAt: 0, error: '', oldest: '' },
  get user() { return this.session ? this.session.user : null; },
  get role() { return this.session ? this.session.user.role : ''; },
  get isOwner() { return this.role === 'OWNER'; },
  get settings() { return (this.boot && this.boot.settings) || {}; },
  get store() { return this.boot ? this.boot.store : null; }
};
const Bus = new EventTarget();
const emit = (name, detail) => Bus.dispatchEvent(new CustomEvent(name, { detail }));
const on = (name, fn) => Bus.addEventListener(name, (e) => fn(e.detail));

/* ------------------------------------------------------------- API PRO */
const READ_ACTIONS = /^(ping|bootstrap|heartbeat|getTransactions|getProof|getDebts|getDashboard|getReport|getMutations|getSyncStatus|getActivityLog|getReview|getCloseSummary|getPromptHistory|getImages)$/;
async function apiOnce(action, data, timeout, reqId) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },               // hindari CORS preflight
      body: JSON.stringify({ action, token: (App.session && App.session.token) || '', reqId, data: data || {} })
    });
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      Perf.add(action, Math.round(performance.now() - t0), j.ms);
      return j;
    } catch (e) {
      return { ok: false, network: true, retryable: res.status >= 500 || res.status === 429, error: 'Server membalas HTTP ' + res.status + ' (bukan JSON). Periksa URL /exec & izin deploy.' };
    }
  } catch (err) {
    return { ok: false, network: true, retryable: true, error: err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi internet terputus.' };
  } finally { clearTimeout(timer); }
}
function waitOnline(ms) {
  return new Promise((r) => {
    if (navigator.onLine !== false) return r();
    const done = () => { clearTimeout(t); removeEventListener('online', done); r(); };
    const t = setTimeout(done, ms); addEventListener('online', done);
  });
}
async function api(action, data, opt) {
  opt = opt || {};
  if (!GAS_URL || GAS_URL.indexOf('GANTI_DENGAN') > -1) return { ok: false, error: Tenant.multi ? 'Toko belum dipilih. Masukkan Kode Toko.' : 'URL server belum diatur. Isi GAS_URL di js/config.js.' };
  const isRead = READ_ACTIONS.test(action);
  const reqId = isRead ? '' : (opt.reqId || uuid());
  const tries = opt.tries || (isRead ? 3 : 2);
  let res;
  for (let i = 0; i < tries; i++) {
    if (i) { await sleep(1200 * i); if (navigator.onLine === false) await waitOnline(15000); }
    res = await apiOnce(action, data, isRead ? (i ? 40000 : 25000) : 90000, reqId);
    if (res.ok || !res.retryable) break;
  }
  if (!res.ok && res.code === 'AUTH' && App.session) Auth.onTokenExpired();
  if (res.ok && SHOP_ACTIONS.test(action)) shopPing();
  return res;
}
/** Beri tahu tab toko online (toko.html) di perangkat ini agar langsung memuat data terbaru. */
const SHOP_ACTIONS = /^(saveOnlineConfig|openStore|closeStore|saveProduct|deleteProduct|saveCategory|deleteCategory|savePromo|deletePromo|saveSettings|saveVariants?)$/;
function shopPing() {
  try { localStorage.setItem('qshop:stale', '1'); localStorage.setItem('qshop:ping', String(Date.now())); } catch (e) {}
  try { if ('BroadcastChannel' in window) { const b = new BroadcastChannel('qasir-shop'); b.postMessage(Date.now()); b.close(); } } catch (e) {}
}
function warmUpServer() { if (GAS_URL && GAS_URL.indexOf('GANTI_DENGAN') < 0) fetch(GAS_URL + '?ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); }

/* -------------------------------------------------------- Sesi & login */
const Auth = {
  load() {
    const s = Store.get('session') || Store.ses.get('session');
    if (!s || !s.user) return null;
    if (s.uiExp && s.uiExp < Date.now()) return { expired: true, last: s };
    return s;
  },
  save(s) {
    App.session = s;
    if (s.persist) { Store.set('session', s); Store.ses.del('session'); } else { Store.ses.set('session', s); Store.del('session'); }
  },
  deviceId() { let id = Store.get('deviceId'); if (!id) { id = 'D' + uuid().replace(/-/g, '').slice(0, 16); Store.set('deviceId', id); } return id; },
  deviceName() { const ua = navigator.userAgent; const m = ua.match(/\(([^)]+)\)/); return (m ? m[1].split(';').slice(0, 2).join(' ').trim() : 'Browser').slice(0, 50); },
  /** Login online → simpan hash PIN lokal agar bisa login offline di perangkat ini. */
  async loginOnline(username, pin, persist) {
    const res = await api('login', { username, pin, deviceId: this.deviceId(), deviceName: this.deviceName() }, { tries: 2 });
    if (!res.ok) return res;
    const d = res.data;
    const salt = uuid().slice(0, 8);
    const offline = Store.get('offlineUsers', {});
    offline[username.toLowerCase()] = { salt, hash: await sha256Hex(salt + ':' + pin), user: d.user, device: d.device, token: d.token, tokenExp: d.exp };
    Store.set('offlineUsers', offline);
    Store.set('lastUser', username.toLowerCase());
    const sess = { token: d.token, tokenExp: d.exp, uiExp: Date.now() + 8 * 3600e3, user: d.user, device: d.device, persist: !!persist, offline: false };
    this.save(sess);
    Seq.syncFromServer(d.seq);
    await Boot.save(d.boot.ver, d.boot.data);
    return { ok: true };
  },
  async loginOffline(username, pin, persist) {
    const rec = Store.get('offlineUsers', {})[username.toLowerCase()];
    if (!rec) return { ok: false, error: 'Perangkat ini belum pernah login dengan akun tersebut. Login pertama wajib online.' };
    if ((await sha256Hex(rec.salt + ':' + pin)) !== rec.hash) return { ok: false, error: 'PIN salah.' };
    const sess = { token: rec.token, tokenExp: rec.tokenExp, uiExp: Date.now() + 8 * 3600e3, user: rec.user, device: rec.device, persist: !!persist, offline: true };
    this.save(sess);
    return { ok: true, offline: true };
  },
  tokenValid() { return App.session && App.session.tokenExp > Date.now() + 60000; },
  onTokenExpired() {
    if (!App.session) return;
    App.session.tokenExp = 0; this.save(App.session);
    Sync.setState('auth');
    if (navigator.onLine) this.reauth();
  },
  _reauthOpen: false,
  async reauth() {
    if (this._reauthOpen || !App.session) return;
    this._reauthOpen = true;
    const u = App.session.user;
    const pin = await promptDlg({ title: 'Sesi berakhir', msg: 'Masukkan PIN ' + u.nama + ' untuk melanjutkan sinkronisasi. Data di perangkat ini aman.', type: 'password', inputmode: 'numeric', maxlength: 6, placeholder: 'PIN 6 digit', okText: 'Lanjutkan' });
    this._reauthOpen = false;
    if (!pin) return;
    const r = await this.loginOnline(u.username, pin, App.session.persist);
    if (r.ok) { toast('Sesi diperbarui', 'ok'); Sync.setState('idle'); Sync.soon(200); emit('boot'); }
    else { toast(r.error || 'Gagal login', 'bad'); }
  },
  async logout(force) {
    const pending = await DB.count('outbox');
    if (pending && !force) {
      const ok = await confirmDlg({ title: 'Masih ada ' + pending + ' data belum tersinkron', msg: 'Data tetap tersimpan aman di perangkat ini dan akan dikirim saat akun ini login lagi. Tetap keluar?', okText: 'Tetap keluar', danger: true });
      if (!ok) return;
    }
    Store.del('session'); Store.ses.del('session');
    App.session = null; Cart.clear(true);
    location.hash = '#/login';
    location.reload();
  }
};

/* --------------------------------------- Nomor nota per perangkat per hari */
const Seq = {
  todayKey() { const d = new Date(); return String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()); },
  syncFromServer(n) { const k = this.todayKey(), cur = Store.get('seq', {}); if (cur.d !== k || (n || 0) > cur.n) Store.set('seq', { d: k, n: Math.max(n || 0, cur.d === k ? cur.n : 0) }); },
  next() {
    const k = this.todayKey(); const cur = Store.get('seq', {});
    const n = (cur.d === k ? cur.n : 0) + 1; Store.set('seq', { d: k, n });
    return 'QSR-' + k + '-' + ((App.session.device && App.session.device.kode) || 'K0') + '-' + pad(n, 4);
  }
};

/* -------------------------------------------------- Data bootstrap (SWR) */
const Boot = {
  async loadLocal() {
    const b = await DB.get('kv', 'boot');
    if (b && App.session && b.role === App.session.user.role) { App.boot = b.data; App.ver = b.ver; applyTheme(App.settings); return true; }
    return false;
  },
  async save(ver, data) {
    App.boot = data; App.ver = ver;
    await this.applyPending();
    await DB.put('kv', { ver, data, role: App.session.user.role, at: Date.now() }, 'boot');
    applyTheme(App.settings);
  },
  _p: null,
  refresh(force) {
    if (!navigator.onLine || !App.session || !Auth.tokenValid()) return Promise.resolve(null);
    if (this._p) return this._p;
    this._p = (async () => {
      const res = await api('bootstrap', { ver: force ? '' : App.ver });
      if (res.ok && !res.data.same) { await this.save(res.data.ver, res.data.data); emit('boot'); }
      this._p = null; return res;
    })();
    return this._p;
  },
  /** Terapkan efek data yang masih di antrean (stok, utang, pelanggan baru) ke salinan lokal. */
  async applyPending() {
    if (!App.boot) return;
    const items = (await DB.all('outbox')).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    items.forEach((it) => Local.applyEffect(it.type, it.payload, App.boot));
  },
  async persist() { if (App.boot) await DB.put('kv', { ver: App.ver, data: App.boot, role: App.session.user.role, at: Date.now() }, 'boot'); }
};

/** Efek lokal sebuah aksi (dipakai saat aksi dibuat & saat bootstrap baru diterima). */
const Local = {
  product(id) { return (App.boot.products || []).find((p) => p.produk_id === id); },
  applyEffect(type, p, boot) {
    boot = boot || App.boot; if (!boot) return;
    const prod = (id) => (boot.products || []).find((x) => x.produk_id === id);
    const mat = (id) => (boot.materials || []).find((x) => x.bahan_id === id);
    const cust = (id) => (boot.customers || []).find((x) => x.pelanggan_id === id);
    if (type === 'tx') {
      (p.items || []).forEach((it) => { const pr = prod(it.produk_id); if (pr && pr.tipe_stok === 'STOK_JADI') pr.stok = toNum(pr.stok) - toNum(it.qty); });
      if (p.metode_bayar === 'UTANG') { const c = cust(p.pelanggan_id); if (c) { c.sisa_utang = toNum(c.sisa_utang) + toNum(p.total); c.nota_utang = toNum(c.nota_utang) + 1; if (!c.utang_sejak) c.utang_sejak = p.waktu; } }
    } else if (type === 'stockIn') {
      if (p.objek === 'BAHAN') { const m = mat(p.objek_id); if (m) m.stok = Math.round((toNum(m.stok) + toNum(p.qty)) * 100) / 100; }
      else { const pr = prod(p.objek_id); if (pr) pr.stok = toNum(pr.stok) + toNum(p.qty); }
    } else if (type === 'payDebt') {
      const c = cust(p.pelanggan_id); if (c) { c.sisa_utang = Math.max(0, toNum(c.sisa_utang) - toNum(p.nominal)); if (!c.sisa_utang) { c.nota_utang = 0; c.utang_sejak = ''; } }
    } else if (type === 'customer') {
      if (!cust(p.pelanggan_id)) (boot.customers = boot.customers || []).push({ pelanggan_id: p.pelanggan_id, nama: p.nama, no_hp: p.no_hp, sisa_utang: 0, nota_utang: 0, utang_sejak: '', _local: true });
    } else if (type === 'cancel' && p._items) {
      p._items.forEach((it) => { const pr = prod(it.produk_id); if (pr && pr.tipe_stok === 'STOK_JADI') pr.stok = toNum(pr.stok) + toNum(it.qty); });
    }
  }
};

/* --------------------------------------------- Antrean offline & sinkron */
const Sync = {
  running: false, t: null,
  setState(s, err) { App.sync.state = s; App.sync.error = err || ''; updateSyncUI(); },
  async refreshCount() {
    const items = await DB.all('outbox');
    App.sync.pending = items.length;
    App.sync.oldest = items.reduce((m, i) => (!m || i.createdAt < m ? i.createdAt : m), '');
    updateSyncUI();
  },
  /** Simpan aksi ke antrean (dan efeknya ke data lokal). Selalu instan — tidak menunggu server. */
  async enqueue(type, payload, opt) {
    opt = opt || {};
    const item = { id: opt.id || shortId('Q'), type, payload, createdAt: new Date().toISOString() };
    const stores = ['outbox'].concat(opt.tx ? ['tx'] : []).concat(opt.proof ? ['proofs'] : []);
    await DB.tx(stores, 'readwrite', (t) => {
      t.objectStore('outbox').put(item);
      if (opt.tx) t.objectStore('tx').put(opt.tx);
      if (opt.proof) t.objectStore('proofs').put(opt.proof);
    });
    Local.applyEffect(type, payload);
    Boot.persist();
    await this.refreshCount();
    this.soon(150);
    return item;
  },
  soon(ms) { clearTimeout(this.t); this.t = setTimeout(() => this.run(), ms || 300); },
  async run() {
    if (this.running || !App.session) return;
    if (!navigator.onLine) { this.setState('offline'); return; }
    if (!Auth.tokenValid()) { this.setState('auth'); return; }
    let items = (await DB.all('outbox')).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const proofs = await DB.all('proofs');
    if (!items.length && !proofs.length) { this.setState('idle'); return; }
    this.running = true; this.setState('syncing');
    let failed = false;
    try {
      while (items.length) {
        const batch = items.slice(0, 20);
        const res = await api('syncBatch', { items: batch.map((i) => ({ id: i.id, type: i.type, payload: stripLocal(i.payload), createdAt: i.createdAt })) }, { reqId: 'sb_' + batch[0].id + '_' + batch[batch.length - 1].id + '_' + batch.length });
        if (!res.ok) { failed = true; if (res.code !== 'AUTH') this.setState('error', res.error); break; }
        for (const r of res.data.results) {
          const it = batch.find((b) => b.id === r.id); if (!it) continue;
          if (r.status === 'OK' || r.status === 'DUP') {
            await DB.del('outbox', r.id);
            if (it.type === 'tx') await Local.markTx(it.payload.transaksi_id, { _sync: 'OK', _msg: r.message || '' });
            if (it.type === 'cancel') await Local.markTx(it.payload.transaksi_id, { _cancelSync: 'OK' });
          } else {
            await DB.put('rejected', Object.assign({}, it, { message: r.message, at: new Date().toISOString() }));
            await DB.del('outbox', r.id);
            if (it.type === 'tx') await Local.markTx(it.payload.transaksi_id, { _sync: 'REJECT', _msg: r.message });
            toast('Satu data ditolak server: ' + r.message, 'bad', 6000);
          }
        }
        if (res.data.ver && res.data.ver !== App.ver) this.bootSoon();
        items = (await DB.all('outbox')).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      }
      if (!failed) {
        const queuedRefs = new Set(items.map((i) => i.payload.transaksi_id || i.id));
        for (const p of await DB.all('proofs')) {
          if (queuedRefs.has(p.ref_id)) continue;
          const r = await api('uploadProof', { ref_type: p.ref_type, ref_id: p.ref_id, dataUrl: p.dataUrl }, { reqId: 'pf_' + p.ref_id });
          if (r.ok) { await DB.del('proofs', p.ref_id); if (p.ref_type === 'tx') await Local.markTx(p.ref_id, { bukti_file_id: r.data.file_id }); }
          else if (r.code !== 'NOT_YET') { failed = true; this.setState('error', r.error); break; }
        }
      }
      if (!failed) { App.sync.lastAt = Date.now(); Store.set(userKey('lastSync'), App.sync.lastAt); this.setState('idle'); }
    } finally {
      this.running = false;
      await this.refreshCount();
      emit('synced');
      this.heartbeat();
    }
  },
  bootSoon: debounce(() => Boot.refresh(), 2500),
  _hb: 0,
  async heartbeat(force) {
    if (!navigator.onLine || !App.session || !Auth.tokenValid()) return;
    const gap = typeof onlineOn === 'function' && onlineOn() ? 14000 : 45000;   // toko online aktif → cek pesanan lebih sering
    if (!force && Date.now() - this._hb < gap) return;
    this._hb = Date.now();
    const r = await api('heartbeat', { pending: App.sync.pending, oldest: App.sync.oldest }, { tries: 1 });
    if (r.ok) {
      const storeNow = r.data.store; const was = App.store;
      if (App.boot && JSON.stringify(storeNow || null) !== JSON.stringify(was || null)) { App.boot.store = storeNow; Boot.persist(); emit('store'); }
      if (r.data.ver && r.data.ver !== App.ver) Boot.refresh();
      if (window.Orders) Orders.onBeat(r.data);
    }
  },
  start() {
    addEventListener('online', () => { this.setState('idle'); warmUpServer(); this.soon(800); });
    addEventListener('offline', () => this.setState('offline'));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { this.soon(500); this.heartbeat(); } });
    setInterval(() => { if (App.sync.pending) this.run(); else this.heartbeat(); }, 10000);
    setInterval(checkWarnings, 60000);
    this.refreshCount().then(() => this.soon(1200));
  }
};
function stripLocal(p) { const o = {}; Object.keys(p || {}).forEach((k) => { if (k[0] !== '_') o[k] = p[k]; }); return o; }
Local.markTx = async function (id, changes) {
  const t = await DB.get('tx', id); if (!t) return;
  Object.assign(t, changes); await DB.put('tx', t);
};
function checkWarnings() {
  if (!App.session) return;
  if (App.session.uiExp && App.session.uiExp < Date.now()) { toast('Sesi 8 jam berakhir. Silakan login ulang.', 'warn', 5000); Auth.logout(true); return; }
  if (App.sync.pending && App.sync.oldest && Date.now() - new Date(App.sync.oldest).getTime() > 8 * 3600e3) toast('Ada data belum tersinkron lebih dari 8 jam. Segera cari koneksi internet.', 'warn', 8000);
  if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then((e) => { if (e.quota && e.usage / e.quota > 0.9) toast('Penyimpanan perangkat hampir penuh.', 'warn', 6000); });
}

/* ------------------------------------------------------- Indikator sinkron */
function syncPill() { return '<button class="pill js-sync" data-act="sync-pill" type="button"></button>'; }
function updateSyncUI() {
  const s = App.sync, online = navigator.onLine;
  let cls = 'ok', txt = 'Online', ic = '';
  if (!online) { cls = 'warn'; txt = s.pending ? 'Offline · ' + s.pending + ' menunggu' : 'Offline'; }
  else if (s.state === 'syncing') { cls = 'info syncing'; txt = 'Menyinkronkan…'; }
  else if (s.state === 'auth') { cls = 'warn'; txt = 'Login ulang untuk sinkron'; }
  else if (s.state === 'error') { cls = 'bad'; txt = 'Sinkron gagal · ketuk'; }
  else if (s.pending) { cls = 'warn'; txt = s.pending + ' menunggu sinkron'; }
  else ic = icon('check', 'xs');
  $$('.js-sync').forEach((el) => { el.className = 'pill js-sync ' + cls; el.innerHTML = (ic || '<span class="dot"></span>') + '<span>' + esc(txt) + '</span>'; });
  $$('.js-pending-count').forEach((el) => { el.textContent = s.pending; el.hidden = !s.pending; });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act="sync-pill"]'); if (!b) return;
  if (App.sync.state === 'auth') Auth.reauth();
  else if (!navigator.onLine) toast(App.sync.pending ? App.sync.pending + ' data tersimpan aman di perangkat dan akan dikirim saat online.' : 'Sedang offline. Transaksi tetap bisa dilakukan.', 'warn');
  else { if (App.sync.error) toast(App.sync.error, 'bad'); Sync.run(); }
});

/* ---------------------------------------------------------------- Tema */
function hexToRgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return isNaN(n) ? [242, 107, 29] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
const rgbHex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
function applyTheme(st) {
  const p = hexToRgb(st.warna_primer || '#F26B1D');
  const r = document.documentElement.style;
  r.setProperty('--p', rgbHex(p));
  r.setProperty('--p-dark', rgbHex(mix(p, [0, 0, 0], 0.22)));
  r.setProperty('--p-soft', rgbHex(mix(p, [255, 255, 255], 0.9)));
  r.setProperty('--p-ring', 'rgba(' + p.join(',') + ',.18)');
  r.setProperty('--p-shadow', 'rgba(' + p.join(',') + ',.28)');
  if (st.warna_aksen) r.setProperty('--accent', st.warna_aksen);
  const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', rgbHex(p));
  document.title = (st.nama_toko ? st.nama_toko + ' · ' : '') + 'Qasir';
  if (st.nama_toko) Store.set('brand', { nama_toko: st.nama_toko, logo_url: st.logo_url || '', warna_primer: st.warna_primer || '#F26B1D' });
}
function logoHtml(cls) {
  const st = App.settings;
  if (st.logo_url) return '<div class="logo ' + (cls || '') + '"><img src="' + esc(st.logo_url) + '" alt="" onerror="this.remove()"></div>';
  return '<div class="logo ' + (cls || '') + '">' + esc((st.nama_toko || 'Q').trim().charAt(0).toUpperCase()) + '</div>';
}
function productImg(p, cls) {
  if (p && p.foto_url) return '<img loading="lazy" src="' + esc(p._fotoLocal || p.foto_url) + '" alt="" onerror="this.outerHTML=\'<div class=ph>' + esc(initials(p.nama)) + '</div>\'">';
  if (p && p._fotoLocal) return '<img src="' + p._fotoLocal + '" alt="">';
  return '<div class="ph ' + (cls || '') + '">' + esc(initials(p ? p.nama : '?')) + '</div>';
}

/* ------------------------------------------------------- Komponen UI */
function toast(msg, type, ms) {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.innerHTML = icon(type === 'ok' ? 'check' : type === 'bad' ? 'alert' : type === 'warn' ? 'alert' : 'info', 'sm') + '<span>' + esc(msg) + '</span>';
  box.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .2s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, ms || 2600);
}
const _sheets = [];
/** Bottom sheet (mobile) / modal (desktop). */
function sheet(o) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"' + (o.maxWidth ? ' style="max-width:' + o.maxWidth + 'px"' : '') + '><div class="grab"></div>' +
    (o.head !== false ? '<div class="sh-head">' + (o.headHtml || '<h3>' + esc(o.title || '') + '</h3>') + '<button class="close-x" data-x type="button" aria-label="Tutup">' + icon('x', 'sm') + '</button></div>' : '') +
    '<div class="sh-body">' + (o.body || '') + '</div>' + (o.foot ? '<div class="sh-foot">' + o.foot + '</div>' : '') + '</div>';
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  const api_ = {
    el: ov.querySelector('.sheet'), ov,
    close(v) {
      if (!ov.isConnected) return;
      ov.remove(); const i = _sheets.indexOf(api_); if (i > -1) _sheets.splice(i, 1);
      if (!_sheets.length) document.body.style.overflow = '';
      o.onClose && o.onClose(v);
    }
  };
  _sheets.push(api_);
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-x]')) api_.close(); });
  o.onOpen && o.onOpen(api_.el, api_);
  return api_;
}
function closeAllSheets() { _sheets.slice().forEach((s) => s.close()); }
function dialog(html, onOpen) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'overlay center';
    ov.innerHTML = '<div class="dialog" role="alertdialog">' + html + '</div>';
    document.body.appendChild(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    ov.addEventListener('click', (e) => { if (e.target === ov) done(null); });
    onOpen(ov.querySelector('.dialog'), done);
  });
}
function confirmDlg(o) {
  return dialog('<h3>' + esc(o.title) + '</h3>' + (o.msg ? '<p>' + esc(o.msg) + '</p>' : '') +
    '<div class="row" style="justify-content:flex-end"><button class="btn outline" data-no type="button">' + esc(o.cancelText || 'Batal') + '</button><button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-yes type="button">' + esc(o.okText || 'Ya') + '</button></div>',
  (el, done) => { el.querySelector('[data-no]').onclick = () => done(false); el.querySelector('[data-yes]').onclick = () => done(true); el.querySelector('[data-yes]').focus(); }).then((v) => !!v);
}
function promptDlg(o) {
  const tag = o.multiline ? 'textarea class="textarea"' : 'input class="input" type="' + (o.type || 'text') + '"';
  return dialog('<h3>' + esc(o.title) + '</h3>' + (o.msg ? '<p>' + esc(o.msg) + '</p>' : '') +
    '<' + tag + ' data-in placeholder="' + esc(o.placeholder || '') + '"' + (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') + (o.maxlength ? ' maxlength="' + o.maxlength + '"' : '') + '>' + (o.multiline ? esc(o.value || '') + '</textarea>' : '') +
    (o.chips ? '<div class="chips wrap" style="margin-top:10px">' + o.chips.map((c) => '<button type="button" class="chip" data-chip="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' : '') +
    '<div class="err" data-err hidden></div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn outline" data-no type="button">Batal</button><button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-yes type="button">' + esc(o.okText || 'Simpan') + '</button></div>',
  (el, done) => {
    const inp = el.querySelector('[data-in]'); if (!o.multiline && o.value) inp.value = o.value;
    setTimeout(() => inp.focus(), 50);
    el.querySelectorAll('[data-chip]').forEach((c) => (c.onclick = () => { inp.value = c.dataset.chip; inp.focus(); }));
    const submit = () => { const v = inp.value.trim(); if (o.required !== false && !v) { const e = el.querySelector('[data-err]'); e.hidden = false; e.textContent = 'Wajib diisi.'; return; } done(v); };
    el.querySelector('[data-no]').onclick = () => done(null);
    el.querySelector('[data-yes]').onclick = submit;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !o.multiline) submit(); });
  });
}
function busy(btn, on) { if (!btn) return; btn.classList.toggle('is-loading', !!on); btn.disabled = !!on; }
function emptyState(ic, title, sub, action) {
  return '<div class="empty"><div class="ico-box">' + icon(ic, 'lg') + '</div><div class="t">' + esc(title) + '</div><div>' + esc(sub || '') + '</div>' + (action ? '<div style="margin-top:14px">' + action + '</div>' : '') + '</div>';
}
function skeletonList(n, h) { let s = ''; for (let i = 0; i < (n || 4); i++) s += '<div class="skel" style="height:' + (h || 76) + 'px;margin-bottom:10px"></div>'; return s; }
function retryBox(msg, act) { return '<div class="empty"><div class="ico-box bad">' + icon('wifi-off', 'lg') + '</div><div class="t">Gagal memuat data</div><div>' + esc(msg || '') + '</div><div style="margin-top:14px"><button class="btn outline sm" data-act="' + (act || 'retry') + '" type="button">' + icon('refresh', 'sm') + 'Coba lagi</button></div></div>'; }
function topbar(o) {
  return '<header class="topbar"><div class="in">' + (o.back ? '<button class="icon-btn" data-act="back" type="button" aria-label="Kembali">' + icon('arrow-left') + '</button>' : (o.logo ? logoHtml() : '')) +
    '<div class="grow"><h1 class="ellipsis">' + esc(o.title) + '</h1>' + (o.sub ? '<div class="sub ellipsis">' + o.sub + '</div>' : '') + '</div>' + (o.right || '') + '</div></header>';
}
function moneyInput(attrs, val) { return '<input class="input money" inputmode="numeric" autocomplete="off" ' + attrs + ' value="' + (val ? NF.format(val) : '') + '">'; }
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.classList || !el.classList.contains('money')) return;
  const n = parseMoney(el.value);
  const pos = el.value.length - el.selectionStart;
  el.value = n ? NF.format(n) : '';
  try { const p = Math.max(0, el.value.length - pos); el.setSelectionRange(p, p); } catch (x) {}
});

/* --------------------------------------------------------- Kompres foto */
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Gambar tidak bisa dibaca.')); i.src = src; }); }
async function compressImage(file, o) {
  o = Object.assign({ maxDim: 1280, maxBytes: 250 * 1024, square: false, type: 'image/jpeg' }, o || {});
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (o.square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
    // fit: jadikan persegi 1:1 tanpa memotong (sisi pendek diberi latar)
    const side = Math.max(sw, sh);
    let scale = Math.min(1, o.maxDim / (o.fit ? side : Math.max(sw, sh))), q = 0.85, out = '';
    for (let i = 0; i < 10; i++) {
      const c = document.createElement('canvas');
      if (o.fit) { c.width = c.height = Math.max(1, Math.round(side * scale)); }
      else { c.width = Math.max(1, Math.round(sw * scale)); c.height = Math.max(1, Math.round(sh * scale)); }
      const ctx = c.getContext('2d');
      if (o.type === 'image/jpeg' || o.bg) { ctx.fillStyle = o.bg || '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.imageSmoothingQuality = 'high';
      if (o.fit) { const dw = sw * scale, dh = sh * scale; ctx.drawImage(img, sx, sy, sw, sh, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh); }
      else ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      out = c.toDataURL(o.type, q);
      const bytes = Math.ceil((out.length - out.indexOf(',') - 1) * 3 / 4);
      if (bytes <= o.maxBytes) return out;
      if (o.type === 'image/png') { o.type = 'image/jpeg'; continue; }
      if (q > 0.55) q -= 0.1; else scale *= 0.82;
    }
    return out;
  } finally { URL.revokeObjectURL(url); }
}
const dataUrlKB = (u) => Math.round(Math.ceil((u.length - u.indexOf(',') - 1) * 3 / 4) / 1024);
function pickFile(capture) {
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    if (capture) inp.setAttribute('capture', 'environment');
    inp.onchange = () => res(inp.files && inp.files[0] ? inp.files[0] : null);
    inp.addEventListener('cancel', () => res(null));
    inp.click();
  });
}
/** Kamera: di HP → kamera bawaan HP; di laptop/PC → webcam (bukan file manager). Galeri → pemilih file. */
function pickImage(capture) {
  if (capture && typeof Camera !== 'undefined' && !Camera.isTouch() && Camera.usable()) return Camera.open();
  return pickFile(capture);
}

/* ----------------------------------------------------------- Router SPA */
const Pages = {};
function page(name, def) { Pages[name] = Object.assign({ role: null, nav: true }, def); }
function go(path) { const h = '#/' + path; if (location.hash === h) route(); else location.hash = h; }
function homePage() { return App.isOwner ? 'dashboard' : 'kasir'; }
const _stack = [location.hash];
let _replacing = false;
function replaceRoute(path) { _replacing = true; location.replace('#/' + path); }
function back(fallback) { if (_stack.length > 1) history.back(); else replaceRoute(fallback || homePage()); }
function route() {
  closeAllSheets();
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const name = parts[0] || '';
  const param = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('/')) : '';
  if (!App.session) { if (name !== 'login') { replaceRoute('login'); return; } Pages.login.mount(); return; }
  const def = Pages[name];
  if (!def || name === 'login' || (def.role && def.role !== App.role)) { replaceRoute(homePage()); return; }
  if (def.paket && !Tenant.has(def.paket)) { replaceRoute('paket'); return; }   // fitur di luar paket toko ini
  const main = $('#main'); if (!main) return;
  const prev = $('.page[data-page="' + App.current + '"]'); if (prev) prev._scroll = window.scrollY;
  let el = $('.page[data-page="' + name + '"]', main);
  if (!el) {
    el = document.createElement('section');
    el.className = 'page' + (def.nav ? '' : ' no-nav') + (def.foot ? ' has-foot' : '');
    el.dataset.page = name;
    el.innerHTML = def.template();
    main.appendChild(el);
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]'); if (!a || !el.contains(a)) return;
      const act = a.dataset.act;
      if (act === 'back') { e.preventDefault(); back(def.backTo); return; }
      if (act === 'sync-pill') return;
      if (def.actions && def.actions[act]) { e.preventDefault(); def.actions[act].call(def, a, e, el); }
    });
    def.init && def.init(el);
  }
  $$('.page', main).forEach((p) => { p.hidden = p !== el; });
  App.current = name;
  Nav.update(name);
  updateSyncUI();
  window.scrollTo(0, def.keepScroll ? el._scroll || 0 : 0);
  try { def.show && def.show(el, param); } catch (err) { console.error(err); toast('Terjadi kesalahan: ' + err.message, 'bad'); }
}
addEventListener('hashchange', () => {
  const h = location.hash;
  if (_replacing) { _stack[_stack.length - 1] = h; _replacing = false; }
  else if (_stack.length > 1 && _stack[_stack.length - 2] === h) _stack.pop();
  else _stack.push(h);
  route();
});

/* -------------------------------------------- Cache baca halaman (SWR) */
async function swr(key, action, payload, render, opt) {
  opt = opt || {};
  const fresh = opt.fresh === undefined ? 60000 : opt.fresh;
  const c = Store.get(userKey(key), null);
  if (c) render(c.data, true);
  if (c && !opt.force && Date.now() - c.t < fresh) return { ok: true, data: c.data, cached: true };
  if (!navigator.onLine) { if (!c && opt.onError) opt.onError({ error: 'Sedang offline dan data belum pernah dimuat.' }); return { ok: false, offline: true }; }
  const res = await api(action, payload);
  if (res.ok) {
    const h = hashStr(JSON.stringify(res.data));
    Store.set(userKey(key), { t: Date.now(), h, data: res.data });
    if (!c || c.h !== h) render(res.data, false);
  } else if (!c && opt.onError) opt.onError(res);
  else if (c && opt.onError && opt.toastOnError !== false) toast(res.error || 'Gagal memperbarui data', 'warn');
  return res;
}
