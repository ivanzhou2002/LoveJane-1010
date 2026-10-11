/* 解析 xlsx richData 链路：sheet1 vm → metadata → rv 索引 → richValueRel → media 文件 */
const fs = require("fs");
const path = require("path");
const base = path.join(__dirname, "..", "_xlsx", "unzipped", "xl");

const read = f => fs.readFileSync(path.join(base, f), "utf8");

/* 1. metadata.xml: valueMetadata bk N → rc v (=rvb i = rv 索引) */
const meta = read("metadata.xml");
const vmSec = meta.slice(meta.indexOf("<valueMetadata"));
const vmMap = {}; // vm值(1-based bk index) → rv索引
const bkRe = /<bk><rc t="1" v="(\d+)"\/><\/bk>/g;
{
  let m, idx = 0;
  while ((m = bkRe.exec(vmSec))) vmMap[++idx] = +m[1]; // bk 出现顺序即 vm 序号 1..61
}

/* 2. richValueRel.xml: 第 N 个 rel → rId（rv 索引 N-1 → rId） */
const rel = read(path.join("richData", "richValueRel.xml"));
const rIds = [...rel.matchAll(/r:id="(rId\d+)"/g)].map(m => m[1]);

/* 3. richValueRel.xml.rels: rId → media 文件名 */
const rels = read(path.join("richData", "_rels", "richValueRel.xml.rels"));
const rid2file = {};
for (const m of rels.matchAll(/Id="(rId\d+)"[^>]*Target="\.\.\/media\/([^"]+)"/g)) rid2file[m[1]] = m[2];

/* 4. sheet1.xml: 找带 vm= 的单元格 → 行号 */
const sheet = read(path.join("worksheets", "sheet1.xml"));
const rows = [...sheet.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)];
const out = [];
for (const [, rnum, cells] of rows) {
  for (const c of cells.matchAll(/<c r="([A-Z]+)\d+"[^>]*?vm="(\d+)"[^>]*?\/?>(?:<\/c>)?/g)) {
    const vm = +c[2];
    const rvIdx = vmMap[vm];
    const rid = rIds[rvIdx];
    const file = rid2file[rid];
    out.push({ row: +rnum, col: c[1], vm, rvIdx, rid, file });
  }
}

/* 5. 对照 rows.json（导入时按行号猜的 image 字段） */
const guessed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "_xlsx", "rows.json"), "utf8"));
const guessByRow = {};
for (const g of guessed) guessByRow[g.row] = g;

console.log("行 | 鸟名(原表C列) | 真实图片 | 之前猜的 | 是否一致");
let mismatches = 0;
for (const o of out) {
  const g = guessByRow[o.row] || {};
  const ok = g.image === o.file;
  if (!ok) mismatches++;
  console.log(`${o.row} | ${g.bird || "?"} | ${o.file} | ${g.image || "-"} | ${ok ? "OK" : "✗错位"}`);
}
console.log(`\n共 ${out.length} 张图，错位 ${mismatches} 张`);

/* 输出修正映射 JSON */
const fix = {};
for (const o of out) {
  const g = guessByRow[o.row];
  if (g && g.image !== o.file) fix[g.image] = o.file;
}
fs.writeFileSync(path.join(__dirname, "..", "_xlsx", "photo-fix-map.json"), JSON.stringify(fix, null, 2));
console.log("修正映射已写入 _xlsx/photo-fix-map.json（旧文件名 → 正确文件名）");
