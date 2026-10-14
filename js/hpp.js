/* QASIR — hpp.js · Perhitungan HPP & rekomendasi harga (sama dengan logika server) */
'use strict';
const HPP = {
  unitPrice(m, override) {
    const harga = override !== undefined && override !== null && override !== '' ? toNum(override) : toNum(m.harga_beli);
    return toNum(m.isi_per_kemasan) > 0 ? harga / toNum(m.isi_per_kemasan) : 0;
  },
  opsPerUnit(boot, ov) {
    const total = ov && ov.totalCost !== undefined ? ov.totalCost : (boot.costs || []).reduce((s, c) => s + toNum(c.nominal_per_bulan), 0);
    const prod = (boot.production || []).reduce((s, p) => s + toNum(p.estimasi_terjual_per_bulan), 0);
    return { perUnit: prod > 0 ? total / prod : 0, total, prod };
  },
  /** Rincian HPP satu produk (+ varian terpilih). ov = { mat: {bahan_id: harga_beli}, totalCost } untuk simulasi. */
  calc(boot, produkId, varIds, ov) {
    ov = ov || {};
    const mats = {}; (boot.materials || []).forEach((m) => { mats[m.bahan_id] = m; });
    varIds = (varIds || []).filter(Boolean);
    const rows = [];
    (boot.recipes || []).forEach((r) => {
      if (r.produk_id !== produkId) return;
      if (r.varian_id && varIds.indexOf(r.varian_id) < 0) return;
      const m = mats[r.bahan_id]; if (!m) return;
      const unit = this.unitPrice(m, ov.mat ? ov.mat[m.bahan_id] : undefined);
      rows.push({ resep_id: r.resep_id, bahan_id: m.bahan_id, nama: m.nama, jenis: m.jenis || 'BAHAN', takaran: toNum(r.takaran), satuan: m.satuan_pakai, unit, cost: toNum(r.takaran) * unit, varian_id: r.varian_id || '' });
    });
    const varManual = (boot.variants || []).filter((v) => varIds.indexOf(v.varian_id) > -1).reduce((s, v) => s + toNum(v.tambahan_hpp), 0);
    const bahan = rows.filter((r) => r.jenis !== 'KEMASAN').reduce((s, r) => s + r.cost, 0);
    const kemasan = rows.filter((r) => r.jenis === 'KEMASAN').reduce((s, r) => s + r.cost, 0);
    const o = this.opsPerUnit(boot, ov);
    const total = Math.round(bahan) + Math.round(kemasan) + Math.round(o.perUnit) + Math.round(varManual);
    return { rows, bahan: Math.round(bahan), kemasan: Math.round(kemasan), ops: Math.round(o.perUnit), opsTotal: o.total, opsProd: o.prod, varManual: Math.round(varManual), total };
  },
  recommend(hpp, margin, round) {
    if (!(hpp > 0)) return 0;
    round = toNum(round) || 1000;
    return Math.ceil(hpp / (1 - toNum(margin) / 100) / round) * round;
  },
  foodCost(hpp, price) { return price > 0 ? (hpp / price) * 100 : 0; },
  fcClass(fc) { return fc <= 35 ? 'ok' : fc <= 45 ? 'warn' : 'bad'; }
};
