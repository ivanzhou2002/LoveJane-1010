/* 批量下载图鉴维基网图到 photos/wiki/，并生成 js/wiki-photos.js 本地清单。
 * 之后 birdPhoto() 优先读本地文件，页面不再依赖 wikimedia 网络。
 *
 * 用法：node tools/download-wiki-photos.js [代理端口]
 *   - 不带参数时自动扫描常见本地代理端口（Clash 7897/7890、v2ray 10808 等），
 *     也能直连时自动走直连
 *   - 已下载的文件自动跳过，可反复运行补漏（比如以后新增 e4 鸟种后）
 */
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path"), vm = require("vm");

const ROOT = path.join(__dirname, "..");
const PROBE = "https://en.wikipedia.org/api/rest_v1/page/summary/Tarsiger_cyanurus";
const PORTS = [7897, 7890, 7891, 7892, 7893, 7894, 7895, 7896, 7898, 7899, 2080, 1080, 10808, 10809];

function curl(args) {
  return execFileSync("curl.exe", ["-s", "--max-time", "25", ...args], { maxBuffer: 64 * 1024 * 1024 });
}
function probeOK(extra) {
  try {
    const out = curl([...extra, "-o", "NUL", "-w", "%{http_code}", "-m", "10", PROBE]);
    return out.toString().trim() === "200";
  } catch { return false; }
}

/* 出口选择：命令行指定 > 代理端口扫描 > 直连 */
let P = [];
if (process.argv[2]) {
  P = ["-x", `http://127.0.0.1:${process.argv[2]}`];
} else {
  for (const p of PORTS) {
    if (probeOK(["-x", `http://127.0.0.1:${p}`])) { P = ["-x", `http://127.0.0.1:${p}`]; break; }
  }
  if (!P.length && probeOK([])) P = [];   /* 能直连就用直连 */
}
if (P.length === 0 && !probeOK(P)) {
  console.error("× 未找到可用出口：请先启动代理客户端（如 Clash，默认端口 7897）再运行。");
  process.exit(1);
}
console.log("√ 出口：" + (P.length ? P[1] : "直连"));

/* 读取图鉴鸟种清单 */
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8") + "\nthis.BIRDS=BIRDS;", ctx);
const BIRDS = ctx.BIRDS;
fs.mkdirSync(path.join(ROOT, "photos/wiki"), { recursive: true });

function apiImg(title, host) {
  const u = `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`;
  try {
    const j = JSON.parse(curl([...P, u]).toString("utf8"));
    return (j.thumbnail && j.thumbnail.source) || (j.originalimage && j.originalimage.source) || "";
  } catch { return ""; }
}

(async () => {
  const queue = BIRDS.slice();
  const manifest = {};
  const fail = [];
  let done = 0, ok = 0;
  const tick = () => console.log(`  进度 ${done}/${BIRDS.length}（成功 ${ok}）`);

  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const b = queue.shift();
      const file = "photos/wiki/" + (b.latin || b.name).replace(/[^\w.-]+/g, "_") + ".jpg";
      const abs = path.join(ROOT, file);
      if (fs.existsSync(abs) && fs.statSync(abs).size > 1000) {   /* 断点续传：已有文件跳过 */
        manifest[b.name] = file; if (b.latin) manifest[b.latin] = file; ok++; done++;
        continue;
      }
      let url = b.latin ? apiImg(b.latin, "en.wikipedia.org") : "";
      if (!url) url = apiImg(b.name, "zh.wikipedia.org");
      if (url) {
        try {
          curl([...P, "-o", abs, url]);
          if (fs.existsSync(abs) && fs.statSync(abs).size > 1000) {
            manifest[b.name] = file; if (b.latin) manifest[b.latin] = file; ok++;
          } else fail.push(b.name);
        } catch { fail.push(b.name); }
      } else fail.push(b.name);
      if (++done % 20 === 0) tick();
    }
  }));

  fs.writeFileSync(path.join(ROOT, "js/wiki-photos.js"),
    `/* 由 tools/download-wiki-photos.js 自动生成：中文名/拉丁名 → 本地图片路径 */\n`
    + `const WIKI_PHOTOS = ${JSON.stringify(manifest)};\n`);
  tick();
  console.log(`√ 完成：本地图片 ${ok}/${BIRDS.length} 种，清单写入 js/wiki-photos.js`);
  if (fail.length) console.log("× 未取到（可稍后重跑补漏）：" + fail.join("、"));
})();
