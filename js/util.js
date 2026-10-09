/* ============================================================
 * 工具：坐标转换 / 日期 / 转义
 * ============================================================ */

/** WGS-84（手机 GPS）→ GCJ-02（高德坐标），火星坐标偏转算法 */
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
  return { lat: lat + dLat, lng: lng + dLng };
}

/** GCJ-02（高德坐标）→ WGS-84（谷歌地球/国际 GPS），迭代反算，误差约 1 米 */
function gcj02ToWgs84(lat, lng) {
  let wLat = lat, wLng = lng;
  for (let i = 0; i < 3; i++) {
    const g = wgs84ToGcj02(wLat, wLng);
    wLat += lat - g.lat;
    wLng += lng - g.lng;
  }
  return { lat: wLat, lng: wLng };
}

/** 今天 YYYY-MM-DD（本地时区） */
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 日期偏移：返回 n 天前/后的 YYYY-MM-DD */
function dateOffsetStr(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 两个 YYYY-MM-DD 相差天数（b - a） */
function daysBetween(a, b) {
  const ta = new Date(a + "T00:00:00").getTime();
  const tb = new Date(b + "T00:00:00").getTime();
  return Math.round((tb - ta) / 86400000);
}

/** YYYY-MM-DD → M月D日 */
function fmtCN(dateStr) {
  if (!dateStr) return "—";
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

/** HTML 转义 */
function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

/** 简易 uuid */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 无实拍图的鸟种 → 网图：拉丁学名查英文维基（鸟类学名条目几乎全有配图），
 *  失败回退中文维基条目名。注意：只有「确认无图」才缓存空值——
 *  网络失败不写缓存，避免一次抽风把鸟种永久判成无图 */
async function birdPhoto(name, latin) {
  /* 优先用本地化的维基图（tools/download-wiki-photos.js 下载到 photos/wiki/） */
  if (typeof WIKI_PHOTOS !== "undefined") {
    const local = WIKI_PHOTOS[latin] || WIKI_PHOTOS[name];
    if (local) return local;
  }
  const KEY = "birdImg3:" + (latin || name);
  const cached = localStorage.getItem(KEY);
  if (cached !== null) return cached || null;
  /* 沿用旧缓存里已成功的结果（旧空值可能是网络失败误存的，不迁移） */
  const prev = localStorage.getItem("birdImg2:" + (latin || name))
            || localStorage.getItem("birdImg:" + name);
  if (prev) { localStorage.setItem(KEY, prev); return prev; }

  let url = "", apiAlive = false;
  const grab = async (host, title) => {
    const r = await fetch(`https://${host}/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`);
    if (!r.ok) return "";
    const j = await r.json();
    apiAlive = true;   /* API 有响应 = 网络通，此时查不到才算真没图 */
    return j.thumbnail?.source || j.originalimage?.source || "";
  };
  try {
    if (latin) url = await grab("en.wikipedia.org", latin);
    if (!url) url = await grab("zh.wikipedia.org", name);
  } catch { /* 网络异常：直接放弃本次，不缓存，下次再试 */ }
  if (url) { localStorage.setItem(KEY, url); return url; }
  if (apiAlive) localStorage.setItem(KEY, "");   /* 确认无图才记空值 */
  return null;
}

/** thumb.wikimedia.org 在国内连接不稳，同一张图时好时坏。
 *  五级回退（带退避延时）：重试 ×2 → 直连原图 → wsrv.nl 图片代理 → 首字占位。
 *  生成的 <img> 需带 onerror="birdPhotoFail(this)"，可选 data-revert（放弃时还原的占位 class） */
function birdPhotoFail(img) {
  const n = Number(img.dataset.retry || 0);
  const src = (img.getAttribute("src") || "").split("?")[0];
  const toOriginal = u => u.includes("/thumb/")
    ? u.replace("thumb.wikimedia.org", "upload.wikimedia.org")
       .replace("/thumb/", "/")
       .replace(/\/(?:lossy-page\d+-)?\d+px-[^/]+$/, "")
    : u;
  /* 逐次拉大间隔，给网络喘息时间；页面重渲染后元素失效则直接放弃 */
  setTimeout(() => {
    if (!img.isConnected) return;
    if (n <= 1) {                          /* 前 2 次：换条连接重试缩略图 */
      img.dataset.retry = String(n + 1);
      img.src = src + "?r=" + Date.now();
    } else if (n === 2) {                  /* 绕开缩略图服务直连原图 */
      img.dataset.retry = "3";
      img.src = toOriginal(src);
    } else if (n === 3) {                  /* 走 wsrv.nl 图片代理中转（含转压 480px） */
      img.dataset.retry = "4";
      img.src = "https://wsrv.nl/?url=" + encodeURIComponent(toOriginal(src)) + "&w=480";
    } else if (img.dataset.revert) {       /* 放弃：还原为首字占位（不带 data-*，避免重新触发拉图） */
      img.outerHTML = `<span class="${esc(img.dataset.revert)}">${esc((img.alt || "?").slice(0, 1))}</span>`;
    } else {
      img.remove();
    }
  }, [0, 500, 1200, 2000][Math.min(n, 3)]);
}

/** 手机拍照压缩为 dataURL（最长边 1280px / JPEG 0.82），只存本机不上传服务器 */
function compressImage(file, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}
