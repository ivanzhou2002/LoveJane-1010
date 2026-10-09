/* ============================================================
 * 数据层：统一接口 + 双驱动
 *   LocalAdapter     localStorage（本地调试，当前启用）
 *   SupabaseAdapter  云端共享（部署前实现，接口一致）
 * ============================================================ */

const DB_KEY = "birdjournal.v2";

/* ---------- 本地驱动 ---------- */
const LocalAdapter = {
  name: "local",

  _load() {
    try {
      return JSON.parse(localStorage.getItem(DB_KEY)) || {};
    } catch { return {}; }
  },
  _save(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  },

  getSightings() {
    return this._load().sightings || [];
  },
  addSighting(s) {
    const d = this._load();
    d.sightings = [s, ...(d.sightings || [])];
    this._save(d);
  },
  deleteSighting(id) {
    const d = this._load();
    d.sightings = (d.sightings || []).filter(x => x.id !== id);
    this._save(d);
  },
  updateSighting(id, patch) {
    const d = this._load();
    d.sightings = (d.sightings || []).map(x => x.id === id ? { ...x, ...patch } : x);
    this._save(d);
  },

  getRecords() {
    return this._load().records || [];
  },
  addRecord(r) {
    const d = this._load();
    d.records = [r, ...(d.records || [])];
    this._save(d);
  },
  deleteRecord(id) {
    const d = this._load();
    d.records = (d.records || []).filter(x => x.id !== id);
    this._save(d);
  },

  getSettings() {
    return this._load().settings || { a: "Ivan", b: "Jane", anniversary: "2026-08-23" };
  },
  saveSettings(s) {
    const d = this._load();
    d.settings = { ...this.getSettings(), ...s };
    this._save(d);
  },

  exportAll() {
    return JSON.stringify(this._load(), null, 2);
  },
  importAll(json) {
    const data = JSON.parse(json);
    if (!data || typeof data !== "object") throw new Error("格式错误");
    this._save({ ...this._load(), ...data });
  },
};

/* ---------- 云端驱动（占位：部署前实现） ---------- */
const SupabaseAdapter = {
  name: "cloud",
  /* 接口与 LocalAdapter 一致；上云时以 supabase-js 实现，
     暗号作为 couple_code 参与行级过滤。 */
};

/* 当前启用的驱动 */
const db = LocalAdapter;
