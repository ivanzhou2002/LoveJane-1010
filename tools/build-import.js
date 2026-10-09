// 由 观鸟.xlsx 生成 js/imported-data.js
// 前置：node tools/parse-xlsx.js 已生成 _xlsx/rows.json
// 注意：rows.json 的字段名是按表头猜的，实际列序为 A=地点 / B=日期 / C=鸟名
//
// 坐标来源（WGS-84，脚本内转 GCJ-02）：
//   湿地公园   earthol(Google 中国) POI 30.31457,121.16318（GCJ-02，已反算）
//   十一塘/十塘 OSM 十一塘江/十塘江水道 30.362~30.366N / 30.33~30.345N
//   兴慈七路   OSM 道路 121.259E
//   半掘浦     OSM 水道北端(入海口) 30.294,121.437
//   十二塘     前湾新区北界 30.454 往南推算塘线
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const rows = JSON.parse(fs.readFileSync(path.join(root, "_xlsx", "rows.json"), "utf8"));

/* ---------- WGS-84 → GC-02（与 js/util.js 同一算法） ---------- */
function wgs84ToGcj02(lat, lng) {
  const a = 6378245.0;
  const ee = 0.00669342162296594323;
  function transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }
  function transformLng(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
    return ret;
  }
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
  return { lat: +(lat + dLat).toFixed(6), lng: +(lng + dLng).toFixed(6) };
}

/* ---------- 观鸟点位（全部 GCJ-02 真实坐标，无推算） ----------
 * 来源：用户 2026-10 在高德卫星图上实测标点（标点取坐标工具）
 * 注意：各笔记的"塘"分处不同地理段——十塘/十一塘观测点在慈溪东部（新浦/附海以北），
 *       十二塘/交界在前湾新区东部围垦区，紫园在新区东南部农田区
 */
const LOCATIONS = {
  gongyuan:  { name: "杭州湾国家湿地公园",              glat: 30.314570, glng: 121.163180 },  // earthol 实测（GCJ-02）
  ziyuan:    { name: "宁波紫园农业周边农田",            glat: 30.322588, glng: 121.366117 },  // 用户实测 #6
  shitang:   { name: "十塘路海塘（附海段）",            glat: 30.243984, glng: 121.488791 },  // 用户实测 #5
  shiyitang: { name: "十一塘海塘（附海段）",            glat: 30.276171, glng: 121.463728 },  // 用户实测 #4
  jiaojie:   { name: "十一塘·十二塘交界",               glat: 30.364600, glng: 121.288161 },  // 用户实测 #2
  shiertang: { name: "十二塘海塘（围垦区）",            glat: 30.375259, glng: 121.319575 },  // 用户实测 #1
  banjuepu:  { name: "前湾滩涂管理2号岗亭",                glat: 30.341851, glng: 121.364465 },  // 用户实测
};
Object.values(LOCATIONS).forEach(l => {
  if (l.glat != null) { l.lat = l.glat; l.lng = l.glng; }
  else Object.assign(l, wgs84ToGcj02(l.wlat, l.wlng));
});

/* 表格地点文字 → 点位（含糊表述"两地都去/两地之一"→ 两个点都收录） */
const PLACE_RULES = [
  { match: p => p.includes("十一塘") && p.includes("十塘路"), keys: ["shiyitang", "shitang"] },  // 沿线海塘
  { match: p => p.includes("交界"),                              keys: ["jiaojie", "ziyuan"] },     // 农田 + 交界处
  { match: p => p.includes("十一塘路") && p.includes("湿地公园"), keys: ["shiyitang", "gongyuan"] }, // "或"
  { match: p => p.includes("湿地公园"),                          keys: ["gongyuan"] },
  { match: p => p.includes("紫园"),                              keys: ["ziyuan"] },
  { match: p => p.includes("十二塘"),                            keys: ["shiertang"] },
  { match: p => p.includes("十一塘"),                            keys: ["shiyitang"] },
  { match: p => p.includes("十塘"),                              keys: ["shitang"] },
  { match: p => p.includes("岗亭") || p.includes("滩涂"),        keys: ["banjuepu"] },
];
const keysOf = p => {
  const r = PLACE_RULES.find(r => r.match(p));
  return r ? [...new Set(r.keys)] : null;
};

/* ---------- 小红书笔记：标题/URL -> 笔记 ID -> 年份 ---------- */
const NOTE_MAP = [
  { match: r => r.link.includes("6a8bafbe") || r.link.includes("慈溪鸻鹬爽看之行"), id: "6a8bafbe", year: 2026 },
  { match: r => r.link.includes("黑翅鸢") || r.link.includes("慈溪杭州湾猛禽"),   id: "6a81b3f6", year: 2026 },
  { match: r => r.link.includes("杭州湾特种兵观鸟"), id: "6a93f4c6", year: 2026 },
  { match: r => r.link.includes("又是拍鸟的一天"),   id: "6abfb241", year: 2025 },
  { match: r => r.link.includes("国庆半掘浦海滨观鸟"), id: "6ac0f1e6", year: 2025 },
  { match: r => r.link.includes("691b4676"), id: "691b4676", year: 2025 },
  { match: r => r.link.includes("68a7eed6"), id: "68a7eed6", year: 2025 },
  { match: r => r.link.includes("6a97de65"), id: "6a97de65", year: 2026 },
];
const noteOf = r => NOTE_MAP.find(n => n.match(r));

/* ---------- 鸟名规范（错别字 / 简称 → 图鉴名） ---------- */
const NAME_FIX = {
  "白腰勺鹬": "白腰杓鹬", "青嘴鹬": "青脚鹬", "铁嘴沙鹬": "铁嘴沙鸻",
  "䴙䴘": "小䴙䴘", "白头鹤（路过候鸟）": "白头鹤", "鸻鹬": "鸻鹬类", "柳莺": "柳莺类",
};

/* ---------- 逐行解析：一条记录 → 每个点位一条情报 ---------- */
const groups = new Map();   // key: note|bird|loc
for (const r of rows) {
  if (r.row === 1) continue; // 表头
  const note = noteOf(r);
  if (!note) { console.error("未识别链接:", r.row, r.link.slice(0, 40)); continue; }
  const rawBird = (r.place || "").trim();           // C 列是鸟名
  const bird = NAME_FIX[rawBird] || rawBird;
  const placeRaw = (r.date || "").trim();           // A 列是地点
  const keys = keysOf(placeRaw);
  if (!keys) { console.error("未识别地点:", r.row, placeRaw); continue; }
  const dateCN = (r.bird || "").trim();             // B 列是日期
  const m = dateCN.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m) { console.error("未识别日期:", r.row, dateCN); continue; }
  const date = `${note.year}-${String(+m[1]).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`;

  for (const k of keys) {
    const loc = LOCATIONS[k];
    const key = `${note.id}|${bird}|${k}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: `xhs-${note.id}-${k}-${bird}`,          // 内容寻址：重跑稳定，便于幂等刷新
        bird, spotKey: `xhs-${k}`, spotName: loc.name,
        lat: loc.lat, lng: loc.lng,
        date,
        note: [r.note, bird === "白头鹤" ? "记录为路过候鸟" : ""].filter(Boolean).join("；"),
        source: `https://www.xiaohongshu.com/explore/${note.id}`,
        photos: [],
        confidence: "high", status: "active",
      });
    }
    const g = groups.get(key);
    if (r.image && !g.photos.includes(`photos/${r.image}`)) g.photos.push(`photos/${r.image}`);
    if (r.note && !g.note.includes(r.note)) g.note = [g.note, r.note].filter(Boolean).join("；");
  }
}

const sightings = [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));

const out = `/* 由 tools/build-import.js 生成 —— 来源：观鸟.xlsx（小红书鸟讯整理）
 * 坐标 GCJ-02（WGS-84 实测锚点换算），含糊地点已拆分为多个点位分别收录 */
window.IMPORTED_SIGHTINGS = ${JSON.stringify(sightings, null, 1)};
window.IMPORTED_SPOTS = ${JSON.stringify(Object.entries(LOCATIONS).map(([k, l]) =>
  ({ id: `xhs-${k}`, name: l.name, lat: l.lat, lng: l.lng })
), null, 1)};
`;
fs.writeFileSync(path.join(root, "js", "imported-data.js"), out, "utf8");

const bySpot = {};
sightings.forEach(s => { (bySpot[s.spotName] = bySpot[s.spotName] || new Set()).add(s.bird); });
console.log(`OK: ${sightings.length} 条情报，${Object.keys(bySpot).length} 个点位`);
Object.entries(bySpot).forEach(([n, set]) => console.log(`  ${n}: ${set.size} 种`));
