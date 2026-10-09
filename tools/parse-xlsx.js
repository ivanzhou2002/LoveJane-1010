// 解析 xlsx（已解压的 XML）为结构化观测数据
// 用法: node tools/parse-xlsx.js > _xlsx/rows.json
const fs = require("fs");
const path = require("path");
const base = path.join(__dirname, "..", "_xlsx", "unzipped");

const read = f => fs.readFileSync(path.join(base, f), "utf8");

// 1. sharedStrings
const sst = [];
{
  const xml = read("xl/sharedStrings.xml");
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) {
    const texts = [];
    const tre = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let t;
    while ((t = tre.exec(m[1]))) texts.push(t[1]);
    sst.push(texts.join("").trim());
  }
}

// 2. richValueRel: rel 序号 -> media 文件名
const relMedia = {};
{
  const xml = read("xl/richData/_rels/richValueRel.xml.rels");
  const re = /<Relationship Id="rId(\d+)"[^>]*Target="[^"]*media\/([^"]+)"/g;
  let m;
  while ((m = re.exec(xml))) relMedia[+m[1]] = m[2];
}

// 3. rdrichvalue: rv 序号 -> rel 序号
const rvToRel = [];
{
  const xml = read("xl/richData/rdrichvalue.xml");
  const re = /<rv s="\d+"><v>(\d+)<\/v><v>\d+<\/v><\/rv>/g;
  let m;
  while ((m = re.exec(xml))) rvToRel.push(+m[1]);
}

// 4. metadata: valueMetadata vm 序号 -> futureMetadata bk 序号 -> rv 序号
const vmToRv = [];
{
  const xml = read("xl/metadata.xml");
  // valueMetadata 部分: <bk><rc t="1" v="N"/></bk> 按序
  const vmPart = xml.split("<valueMetadata")[1] || "";
  const re = /<rc t="1" v="(\d+)"/g;
  let m;
  while ((m = re.exec(vmPart))) vmToRv.push(+m[1]);
}

// 5. sheet1 行列
const rows = {};
{
  const xml = read("xl/worksheets/sheet1.xml");
  const re = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const [, col, rowNum, attrs, inner] = m;
    const r = +rowNum;
    rows[r] = rows[r] || {};
    const cell = rows[r];
    if (attrs.includes('t="s"')) {
      const v = inner && inner.match(/<v>(\d+)<\/v>/);
      if (v) cell[col] = sst[+v[1]];
    } else if (attrs.includes('t="str"')) {
      const v = inner && inner.match(/<v>([\s\S]*?)<\/v>/);
      if (v) cell[col] = v[1];
    } else if (attrs.includes('t="inlineStr"')) {
      const v = inner && inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
      if (v) cell[col] = v[1];
    }
    const vm = attrs.match(/vm="(\d+)"/);
    if (vm) {
      const rvIdx = vmToRv[+vm[1]];
      const relIdx = rvToRel[rvIdx];
      const media = relMedia[relIdx + 1]; // rIdN
      if (media) cell.img = media;
    }
  }
}

const out = [];
for (const r of Object.keys(rows).map(Number).sort((a, b) => a - b)) {
  const c = rows[r];
  out.push({ row: r, date: c.A || "", bird: c.B || "", place: c.C || "", image: c.img || "", link: c.E || "", note: c.F || "" });
}
fs.writeFileSync(path.join(__dirname, "..", "_xlsx", "rows.json"), JSON.stringify(out, null, 2), "utf8");
console.log(JSON.stringify(out, null, 2));
