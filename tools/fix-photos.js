/* 按 photo-fix-map.json 批量修正 imported-data.js 的图片引用（两阶段防链式） */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const map = JSON.parse(fs.readFileSync(path.join(root, "_xlsx", "photo-fix-map.json"), "utf8"));
let src = fs.readFileSync(path.join(root, "js", "imported-data.js"), "utf8");
const before = src;

/* 阶段1：photos/imageN → 占位符 */
const keys = Object.keys(map).filter(k => k).sort((a, b) => b.length - a.length);
for (const k of keys) src = src.split(`photos/${k}`).join(`\x00${k}\x00`);

/* 阶段2：占位符 → 正确文件 */
for (const k of keys) src = src.split(`\x00${k}\x00`).join(`photos/${map[k]}`);

/* 金眶鸻（行63，当时漏绑图）补上真实图 image61.jpeg */
const gxq = src.indexOf(`"bird": "金眶鸻"`);
if (gxq > -1 && src.slice(gxq, gxq + 900).includes(`"photos": []`)) {
  src = src.slice(0, gxq) +
    src.slice(gxq, gxq + 900).replace(`"photos": []`, `"photos": [\n   "photos/image61.jpeg"\n  ]`) +
    src.slice(gxq + 900);
}

fs.writeFileSync(path.join(root, "js", "imported-data.js"), src);
console.log("改动了", before !== src ? "是" : "否");

/* 校验：无乱码字符、无残留占位符 */
console.log("乱码字符:", src.includes("\uFFFD") ? "有!!" : "无");
console.log("残留占位符:", src.includes("\x00") ? "有!!" : "无");

/* 验证大白鹭 */
const eg = src.match(/"bird": "大白鹭"[\s\S]{0,400}?"photos": \[\n\s+"([^"]+)"/);
console.log("大白鹭现绑定:", eg ? eg[1] : "?（应为 photos/image37.jpeg）");

/* 统计引用分布 */
const refs = [...src.matchAll(/photos\/image\d+\.(jpeg|png)/g)].map(m => m[0]);
const uniq = [...new Set(refs)];
console.log(`图片引用 ${refs.length} 处，唯一文件 ${uniq.length} 个`);
