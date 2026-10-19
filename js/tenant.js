/* ============================================================================
   QASIR — tenant.js · Kode Toko: satu situs untuk banyak toko (klien)
   Kode Toko → toko.json (terenkripsi) → alamat server Apps Script + paket.
   Dimuat SEBELUM core.js / toko.js. Bagian sinkron memakai salinan di perangkat
   (0 jaringan) sehingga aplikasi tetap terbuka instan, termasuk saat offline.

   Format toko.json:
     { "format": 1, "toko": { "<id>": "<data terenkripsi>" , ... } }
   id   = PBKDF2(Kode Toko) bagian 1 (tidak bisa dibalik ke kode)
   data = AES-GCM(JSON {u: url /exec, p: 'kasir'|'online', a: 1|0, n: nama, m: pesan})
   Entri dibuat & diubah lewat kelola.html — jangan diketik manual.
   ========================================================================== */
'use strict';
(function () {
  const CFG = window.QASIR_CONFIG = window.QASIR_CONFIG || {};
  const SALT = 'qasir.kodetoko.v1', ITER = 20000;
  const REG_URL = CFG.REGISTRY || 'toko.json';
  const K_CUR = 'qasir:tenant', K_NS = 'qasir:tns', K_SHOP = 'qasir:tshop:';
  const GAS_RE = /^https:\/\/script\.google\.com\/(?:a\/macros\/[\w.-]+|macros)\/s\/[\w-]{20,}\/exec$/;   // termasuk akun Google Workspace
  const te = new TextEncoder(), td = new TextDecoder();
  const rawUrl = CFG.GAS_URL && CFG.GAS_URL.indexOf('GANTI_DENGAN') < 0 ? CFG.GAS_URL : '';
  const legacyUrl = rawUrl && GAS_RE.test(rawUrl) ? rawUrl : '';          // alamat toko lama (sebelum Kode Toko)
  const multi = CFG.KODE_TOKO !== false;                       // false = mode lama (1 situs 1 toko, pakai GAS_URL)
  const me = document.currentScript, PAGE = (me && me.dataset.page) || 'app';

  const ls = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  /** Kode Toko: huruf besar, angka & tanda "-" (3–32). "kedai budi" → "KEDAI-BUDI". */
  const norm = (k) => String(k || '').trim().toUpperCase().replace(/[\s_.]+/g, '-').replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
  const b64u = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  /** Namespace data lokal per server → data tiap toko di satu HP tidak tercampur. */
  function nsOf(url) { let h = 2166136261; for (let i = 0; i < url.length; i++) { h ^= url.charCodeAt(i); h = Math.imul(h, 16777619); } return 't' + (h >>> 0).toString(36) + ':'; }

  /* ---------------------------------------------------------- Kriptografi */
  const _dk = {};
  async function derive(kode) {
    kode = norm(kode);
    if (_dk[kode]) return _dk[kode];
    if (!(window.crypto && crypto.subtle)) throw new Error('Browser ini belum mendukung Kode Toko. Buka lewat alamat https:// dengan Chrome/Safari terbaru.');
    const base = await crypto.subtle.importKey('raw', te.encode(kode), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode(SALT), iterations: ITER }, base, 384));
    const key = await crypto.subtle.importKey('raw', bits.slice(16, 48), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    return (_dk[kode] = { id: hex(bits.slice(0, 16)), key });
  }
  async function seal(kode, info) {
    const d = await derive(kode), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(d.id) }, d.key, te.encode(JSON.stringify(info))));
    const all = new Uint8Array(12 + ct.length); all.set(iv); all.set(ct, 12);
    return { id: d.id, blob: b64u(all) };
  }
  async function unseal(kode, blob) {
    const d = await derive(kode), all = unb64u(blob);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12), additionalData: te.encode(d.id) }, d.key, all.slice(12));
    return JSON.parse(td.decode(pt));
  }

  /* ------------------------------------------------------------ Registry */
  let _reg = null;
  async function registry(fresh) {
    if (_reg && !fresh) return _reg;
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(REG_URL + (REG_URL.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (!j || typeof j.toko !== 'object' || !j.toko) throw new Error('Format toko.json tidak dikenal');
      return (_reg = j);
    } finally { clearTimeout(t); }
  }
  function toTenant(info, kode, id) {
    const url = String((info && info.u) || '').trim();
    if (!GAS_RE.test(url)) return null;
    return {
      kode: norm(kode), id, url,
      paket: info.p === 'kasir' ? 'kasir' : 'online',
      aktif: !(info.a === 0 || info.a === false),
      nama: String(info.n || '').slice(0, 60), pesan: String(info.m || '').slice(0, 200), at: Date.now()
    };
  }
  /** Cari Kode Toko → { ok:true, t } | { ok:false, code, error } */
  async function resolve(kode) {
    kode = norm(kode);
    if (kode.length < 3) return { ok: false, code: 'FORMAT', error: 'Kode Toko minimal 3 huruf/angka.' };
    let reg;
    try { reg = await registry(true); } catch (e) {
      return { ok: false, code: 'NET', error: navigator.onLine === false ? 'Perangkat sedang offline. Sambungkan internet untuk memeriksa Kode Toko.' : 'Daftar toko tidak bisa dimuat (' + e.message + '). Coba lagi sebentar.' };
    }
    let d; try { d = await derive(kode); } catch (e) { return { ok: false, code: 'CRYPTO', error: e.message }; }
    const blob = reg.toko[d.id];
    if (!blob) return { ok: false, code: 'NOTFOUND', error: 'Kode Toko "' + kode + '" tidak ditemukan. Periksa ejaannya, atau hubungi admin Qasir.' };
    let info; try { info = await unseal(kode, blob); } catch (e) { return { ok: false, code: 'BROKEN', error: 'Data Kode Toko ini rusak. Hubungi admin Qasir.' }; }
    const t = toTenant(info, kode, d.id);
    if (!t) return { ok: false, code: 'BROKEN', error: 'Alamat server toko ini tidak valid. Hubungi admin Qasir.' };
    return { ok: true, t };
  }

  /* ----------------------------------------------- Toko aktif (aplikasi kasir) */
  const params = new URLSearchParams(location.search);
  const qk = norm(params.get('k') || params.get('kode') || '');
  let cur = multi ? ls.get(K_CUR) : null;
  if (cur && !(cur.url && GAS_RE.test(cur.url) && cur.kode)) cur = null;

  function nsFor(url, keep) {
    const map = ls.get(K_NS) || {};
    let ns = map[url];
    if (ns === undefined) ns = keep !== undefined ? keep : (legacyUrl && url === legacyUrl ? '' : nsOf(url));   // data sebelum Kode Toko tetap terbaca
    map[url] = ns; ls.set(K_NS, map);
    return ns;
  }
  function stripK() {
    if (!params.has('k') && !params.has('kode')) return;
    params.delete('k'); params.delete('kode');
    const q = params.toString();
    try { history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
  }

  const T = {
    multi, page: PAGE, norm, resolve, registry, seal, unseal, derive, GAS_RE,
    current: cur, wantKode: '', need: false, blocked: false, legacy: !multi,
    /** Fitur paket: 'online' hanya untuk Paket Kasir + Jual Online. */
    has(f) {
      if (!multi) return true;
      const t = PAGE === 'toko' ? T.shopTenant : T.current;
      if (!t) return false;
      if (t.legacy) return true;
      return f !== 'online' || t.paket === 'online';
    },
    get paketLabel() { const t = T.current; return !multi || !t ? '' : t.paket === 'online' ? 'Kasir + Jual Online' : 'Kasir'; },
    /** Simpan toko pilihan lalu muat ulang aplikasi (tanpa ?k & #hash). */
    choose(t) {
      t.ns = nsFor(t.url);
      ls.set(K_CUR, t);
      location.replace(location.pathname);
    },
    forget() { ls.del(K_CUR); location.replace(location.pathname); },
    stay() { stripK(); location.replace(location.pathname); },
    /** Cek ulang di latar: paket/status/alamat berubah → { reload:true }. Gagal / tidak ketemu → tetap pakai salinan. */
    async refresh() {
      const c = T.current; if (!multi || !c) return null;
      const r = await resolve(c.kode);
      if (!r.ok) return r;
      const n = r.t;
      const big = n.url !== c.url || n.paket !== c.paket || n.aktif !== c.aktif;
      if (big || n.nama !== c.nama || n.pesan !== c.pesan) {
        n.ns = c.url === n.url ? c.ns : nsFor(n.url, c.ns);
        ls.set(K_CUR, n); T.current = n;
      }
      return { ok: true, reload: big, t: n };
    },
    /** Tautan untuk toko ini (dipakai QR toko, QR meja, "Lihat Toko"). */
    withKode(url) {
      const c = PAGE === 'toko' ? T.shopTenant : T.current;
      if (!multi || !c || c.legacy) return url;
      const u = new URL(url, location.href); u.searchParams.set('k', c.kode); return u.href;
    },

    /* ------------------------------------------- Toko online (pelanggan) */
    shopTenant: null,
    /** Tentukan server untuk toko.html. Salinan di perangkat → instan; cek ulang di latar via onChange. */
    async shop(onChange) {
      const legacy = (url) => ({ ok: true, t: (T.shopTenant = { url, ns: '', paket: 'online', aktif: true, legacy: true }) });
      if (!multi) return rawUrl ? legacy(rawUrl) : { ok: false, code: 'NOURL', error: 'Alamat server belum diatur.' };
      if (!qk) return legacyUrl ? legacy(legacyUrl) : { ok: false, code: 'NOKODE', error: 'Tautan toko ini tidak lengkap (Kode Toko tidak ada). Minta tautan atau QR terbaru dari toko.' };
      const key = K_SHOP + qk, cached = ls.get(key);
      const fresh = resolve(qk).then((r) => {
        if (!r.ok) return r;
        r.t.ns = cached && cached.url === r.t.url ? cached.ns : nsOf(r.t.url);
        ls.set(key, r.t);
        return r;
      });
      if (cached && GAS_RE.test(cached.url)) {
        T.shopTenant = cached;
        fresh.then((r) => {
          if (!r.ok) return;
          const n = r.t; T.shopTenant = n;
          if (onChange && (n.url !== cached.url || n.paket !== cached.paket || n.aktif !== cached.aktif)) onChange(n, cached);
        }).catch(() => {});
        return { ok: true, t: cached };
      }
      const r = await fresh;
      if (r.ok) T.shopTenant = r.t;
      return r;
    }
  };

  if (PAGE === 'app') {
    if (!multi) { window.QASIR_NS = ''; }
    else if (cur && (!qk || qk === cur.kode)) {
      CFG.GAS_URL = cur.url; window.QASIR_NS = cur.ns || '';
      T.blocked = !cur.aktif;
      if (qk) stripK();
    } else {
      T.need = true; T.wantKode = qk;
      CFG.GAS_URL = ''; window.QASIR_NS = '__gate__:';         // belum ada toko → tidak menyentuh data mana pun
    }
  }
  window.QasirTenant = T;
})();
