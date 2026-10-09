/* ============================================================
 * 我们的观鸟日记 · 核心逻辑
 * 数据全部存于 localStorage，无需服务器
 * ============================================================ */

"use strict";

/* ---------- 存取 ---------- */
const LS = {
  get(key, fallback) {
    try { const v = localStorage.getItem("birding." + key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem("birding." + key, JSON.stringify(val)); return true; }
    catch (e) {
      toast("存储空间不足，照片太多啦，请删掉一些记录或照片 ⚠️");
      return false;
    }
  }
};

let records    = LS.get("records", []);
let settings   = LS.get("settings", { a: "", b: "", anniversary: "" });
let customSpots  = LS.get("customSpots", []);
let customBirds  = LS.get("customBirds", []);

const saveRecords = () => LS.set("records", records);

/* ---------- 工具 ---------- */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* 用户输入进内联 onclick 字符串时的转义（防引号破坏语法） */
const attrJs = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "\\'");

const allSpots = () => [...SPOTS.map(s => ({ ...s, custom: false })), ...customSpots.map(s => ({ ...s, emoji: "📍", custom: true }))];
const allBirds = () => [...BIRDS, ...customBirds.map(b => ({ ...b, cat: "custom" }))];
const catOf = (id) => CATS.find(c => c.id === id) || CATS[CATS.length - 1];
const RARE_TEXT = ["常见", "少见", "珍稀"];
const RARE_CLS  = ["r0", "r1", "r2"];

/* 收集情况：name -> { count, firstDate, firstSpot } */
function collectedMap() {
  const m = new Map();
  [...records].sort((x, y) => x.date.localeCompare(y.date)).forEach(r => {
    (r.species || []).forEach(name => {
      const cur = m.get(name) || { count: 0, firstDate: r.date, firstSpot: r.spot };
      cur.count++;
      if (!m.has(name)) { cur.firstDate = r.date; cur.firstSpot = r.spot; }
      m.set(name, cur);
    });
  });
  return m;
}

function weatherOf(id) { return WEATHERS.find(w => w.id === id) || { emoji: "🌤️", name: "" }; }

/* ---------- 导航 ---------- */
function go(page) {
  $$(".page").forEach(p => p.classList.remove("active"));
  $("#page-" + page).classList.add("active");
  $$(".tab,.navlink").forEach(t => t.classList.toggle("active", t.dataset.page === page));
  window.scrollTo({ top: 0 });
  if (page === "home") renderHome();
  if (page === "records") renderRecords();
  if (page === "birds") renderBirds();
  if (page === "map") renderMap();
  if (page === "memories") renderMemories();
}

/* ---------- 首页 ---------- */
function renderHome() {
  const col = collectedMap();
  const spotsVisited = new Set(records.map(r => r.spot)).size;
  const days = togetherDays();
  $("#heroTitle").textContent = settings.a && settings.b ? `${settings.a} & ${settings.b} 的观鸟日记` : "我们的观鸟日记";
  $("#heroSub").textContent = records.length
    ? `已一起收集 ${col.size} 种鸟 · ${records.length} 次出发 · 足迹 ${spotsVisited} 处`
    : "把每一次抬头看见的翅膀，都写进我们的故事";

  $("#statsRow").innerHTML = [
    { n: col.size, label: "收集鸟种", sub: `图鉴共 ${allBirds().length} 种`, emoji: "🪶", cls: "st-green" },
    { n: records.length, label: "观鸟次数", sub: "每一次都算数", emoji: "📖", cls: "st-blue" },
    { n: spotsVisited, label: "观鸟足迹", sub: `共 ${allSpots().length} 个点位`, emoji: "🗺️", cls: "st-gold" },
    { n: days > 0 ? days : "—", label: "在一起", sub: days > 0 ? "第 N 天，还在增加" : "去设置里填纪念日", emoji: "💞", cls: "st-pink" },
  ].map(s => `
    <div class="stat-card ${s.cls}">
      <span class="st-emoji">${s.emoji}</span>
      <b class="st-num">${s.n}</b>
      <span class="st-label">${s.label}</span>
      <span class="st-sub">${s.sub}</span>
    </div>`).join("");

  $("#welcomeCard").style.display = records.length ? "none" : "block";

  renderLuckyBird(col);
  renderRecent();
}

function togetherDays() {
  let base = settings.anniversary;
  if (!base && records.length) base = [...records].sort((a, b) => a.date.localeCompare(b.date))[0].date;
  if (!base) return 0;
  const d = new Date(base + "T00:00:00");
  return Math.max(1, Math.floor((Date.now() - d.getTime()) / 86400000) + 1);
}

/* 今日鸟运：按日期固定的伪随机 */
function renderLuckyBird(col) {
  const ymd = todayStr();
  $("#luckyDate").textContent = ymd.slice(5).replace("-", "月") + "日";
  const pool = allBirds().filter(b => !col.has(b.name));
  const list = pool.length ? pool : allBirds();
  let h = 0;
  for (const c of ymd + (col.size < 3 ? "x" : "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bird = list[h % list.length];
  $("#luckyBird").innerHTML = pool.length ? `
    <div class="lucky-inner" onclick="showBirdDetail('${bird.id}')">
      <span class="lucky-emoji">${bird.emoji}</span>
      <div class="lucky-text">
        <b>${esc(bird.name)}</b>
        <p>${bird.rare === 2 ? "珍稀鸟种！" : ""}今天出门，记得留意它哦 ✨</p>
      </div>
      <span class="link-btn">详情 →</span>
    </div>` : `
    <div class="lucky-inner">
      <span class="lucky-emoji">👑</span>
      <div class="lucky-text"><b>图鉴全收集！</b><p>你们已经是慈溪观鸟王者啦，去创造新的回忆吧 💞</p></div>
    </div>`;
}

function renderRecent() {
  const list = [...records].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 3);
  $("#recentRecords").innerHTML = list.length ? list.map(r => {
    const w = weatherOf(r.weather);
    return `
    <div class="recent-item" onclick="editRecord('${r.id}')">
      <div class="recent-date">${r.date.slice(5).replace("-", "/")} ${w.emoji}</div>
      <div class="recent-main">
        <b>${esc(r.spot)}</b>
        <span>${(r.species || []).slice(0, 4).map(esc).join("、")}${(r.species || []).length > 4 ? "…" : ""}</span>
      </div>
      <span class="recent-count">${(r.species || []).length} 种</span>
    </div>`;
  }).join("") : `<p class="muted empty-tip">还没有记录，点右下角 ＋ 开始吧 🐣</p>`;
}

/* ---------- 记录列表 ---------- */
function renderRecords() {
  const list = [...records].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  if (!list.length) {
    $("#recordsList").innerHTML = `<div class="card empty-card"><p>📒 还没有观鸟记录</p><p class="muted">第一次一起看鸟是什么时候？点右上角记下来吧</p></div>`;
    return;
  }
  let html = "", lastMonth = "";
  list.forEach(r => {
    const month = r.date.slice(0, 7);
    if (month !== lastMonth) {
      lastMonth = month;
      html += `<h3 class="month-h">${month.replace("-", " 年 ")} 月</h3>`;
    }
    const w = weatherOf(r.weather);
    const finder = finderText(r.finder);
    html += `
    <div class="card record-card">
      <div class="record-top">
        <span class="record-date">📅 ${r.date} ${w.emoji}${w.name ? " " + w.name : ""}</span>
        <span class="badge">${finder}</span>
      </div>
      <div class="record-spot">📍 ${esc(r.spot)}</div>
      <div class="species-chips">
        ${(r.species || []).map(s => `<span class="schip" onclick="jumpSpecies('${attrJs(s)}')">${esc(s)}</span>`).join("")}
      </div>
      ${r.note ? `<p class="record-note">💭 ${esc(r.note)}</p>` : ""}
      ${r.photos && r.photos.length ? `<div class="record-photos">${r.photos.map((p, i) => `<img loading="lazy" src="${p}" onclick="showPhoto(this.src,event)" alt="照片">`).join("")}</div>` : ""}
      <div class="record-actions">
        <button class="link-btn" onclick="editRecord('${r.id}')">编辑 ✏️</button>
        <button class="link-btn danger" onclick="removeRecord('${r.id}')">删除 🗑️</button>
      </div>
    </div>`;
  });
  $("#recordsList").innerHTML = html;
}

function finderText(f) {
  if (f === "a") return `${settings.a || "我"} 先发现`;
  if (f === "b") return `${settings.b || "TA"} 先发现`;
  return "一起发现 💞";
}

function jumpSpecies(name) {
  go("birds");
  $("#birdSearch").value = name;
  renderBirds();
}

function removeRecord(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`确定删除 ${r.date} 在「${r.spot}」的记录吗？`)) return;
  records = records.filter(x => x.id !== id);
  saveRecords();
  toast("已删除");
  renderRecords();
}

/* ---------- 记录表单 ---------- */
let pickedSpecies = [];
let pendingPhotos = [];

function openRecordForm(rec) {
  pickedSpecies = rec ? [...rec.species] : [];
  pendingPhotos = rec ? [...(rec.photos || [])] : [];
  $("#recId").value = rec ? rec.id : "";
  $("#recordModalTitle").textContent = rec ? "✏️ 编辑观鸟记录" : "＋ 新的观鸟记录";
  $("#recDeleteBtn").style.display = rec ? "" : "none";
  $("#recDate").value = rec ? rec.date : todayStr();
  $("#recNote").value = rec ? rec.note || "" : "";

  const sel = $("#recSpot");
  sel.innerHTML = allSpots().map(s => `<option value="${esc(s.name)}">${s.emoji} ${esc(s.name)}</option>`).join("")
    + `<option value="__custom">✏️ 自定义地点…</option>`;
  const isPreset = rec && allSpots().some(s => s.name === rec.spot);
  sel.value = isPreset ? rec.spot : "__custom";
  $("#recSpotCustom").style.display = sel.value === "__custom" ? "" : "none";
  if (rec && !isPreset) $("#recSpotCustom").value = rec.spot;

  $("#finderChips").innerHTML = [
    { v: "a", t: `${settings.a || "我"} 🙋` },
    { v: "b", t: `${settings.b || "TA"} 🙋‍♀️` },
    { v: "both", t: "一起 💞" },
  ].map(f => `<button class="chip ${((rec ? rec.finder : "both") === f.v) ? "on" : ""}" data-v="${f.v}" onclick="pickChip('finderChips',this)">${f.t}</button>`).join("");

  $("#weatherChips").innerHTML = WEATHERS.map(w =>
    `<button class="chip ${((rec ? rec.weather : "sunny") === w.id) ? "on" : ""}" data-v="${w.id}" onclick="pickChip('weatherChips',this)">${w.emoji} ${w.name}</button>`).join("");

  $("#recPhotos").value = "";
  renderPickedSpecies();
  renderPhotoPreview();
  openModal("recordModal");
}

function pickChip(containerId, el) {
  $$("#" + containerId + " .chip").forEach(c => c.classList.remove("on"));
  el.classList.add("on");
}

function onSpotSelectChange() {
  $("#recSpotCustom").style.display = $("#recSpot").value === "__custom" ? "" : "none";
}

function renderPickedSpecies() {
  $("#pickedSpecies").innerHTML = pickedSpecies.map(s =>
    `<span class="schip removable" onclick="unpickSpecies('${attrJs(s)}')">${esc(s)} ✕</span>`).join("")
    || `<span class="muted">还没有选，点上方按钮挑选 👆</span>`;
}

function unpickSpecies(name) {
  pickedSpecies = pickedSpecies.filter(s => s !== name);
  renderPickedSpecies();
  renderSpeciesPicker();
}

function saveRecord() {
  const date = $("#recDate").value;
  let spot = $("#recSpot").value;
  if (spot === "__custom") spot = $("#recSpotCustom").value.trim();
  const finder = ($("#finderChips .chip.on") || {}).dataset?.v || "both";
  const weather = ($("#weatherChips .chip.on") || {}).dataset?.v || "sunny";

  if (!date) return toast("请选择日期");
  if (!spot) return toast("请填写地点");
  if (!pickedSpecies.length) return toast("至少选一种看到的鸟哦");

  const id = $("#recId").value;
  const data = { id: id || uid(), date, spot, species: [...pickedSpecies], finder, weather, note: $("#recNote").value.trim(), photos: [...pendingPhotos], createdAt: id ? (records.find(r => r.id === id) || {}).createdAt || "" : String(Date.now()) };

  if (id) records = records.map(r => (r.id === id ? data : r));
  else records.push(data);
  if (saveRecords()) {
    closeModal("recordModal");
    toast(id ? "已更新 ✅" : "记录成功，图鉴 +1 🎉");
    go("records");
  }
}

function deleteCurrentRecord() {
  const id = $("#recId").value;
  if (id && confirm("确定删除这条记录吗？")) {
    records = records.filter(r => r.id !== id);
    saveRecords();
    closeModal("recordModal");
    toast("已删除");
    go("records");
  }
}

function editRecord(id) {
  const r = records.find(x => x.id === id);
  if (r) openRecordForm(r);
}

/* ---------- 照片 ---------- */
function onPhotosPicked(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  let done = 0;
  files.forEach(f => {
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      pendingPhotos.push(cv.toDataURL("image/jpeg", 0.72));
      if (++done === files.length) { renderPhotoPreview(); toast(`已添加 ${files.length} 张照片 📸`); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); if (++done === files.length) renderPhotoPreview(); };
    img.src = url;
  });
}

function renderPhotoPreview() {
  $("#photoPreview").innerHTML = pendingPhotos.map((p, i) =>
    `<div class="pp-item"><img src="${p}" alt="预览"><button onclick="removePhoto(${i})">✕</button></div>`).join("");
}

function removePhoto(i) {
  pendingPhotos.splice(i, 1);
  renderPhotoPreview();
}

function showPhoto(src, e) {
  if (e) e.stopPropagation();
  $("#lightboxImg").src = src;
  $("#lightbox").classList.add("show");
}

/* ---------- 选鸟种 ---------- */
let speciesCat = "all";
function openSpeciesPicker() { speciesCat = "all"; $("#speciesSearch").value = ""; renderSpeciesCatChips(); renderSpeciesPicker(); openModal("speciesModal"); }

function renderSpeciesCatChips() {
  $("#speciesCatChips").innerHTML =
    `<button class="chip ${speciesCat === "all" ? "on" : ""}" onclick="speciesCat='all';renderSpeciesCatChips();renderSpeciesPicker()">全部</button>` +
    CATS.filter(c => c.id !== "custom" || customBirds.length).map(c =>
      `<button class="chip ${speciesCat === c.id ? "on" : ""}" onclick="speciesCat='${c.id}';renderSpeciesCatChips();renderSpeciesPicker()">${c.emoji} ${c.name}</button>`).join("");
}

function renderSpeciesPicker() {
  const q = ($("#speciesSearch").value || "").trim().toLowerCase();
  const birds = allBirds().filter(b =>
    (speciesCat === "all" || b.cat === speciesCat) &&
    (!q || b.name.toLowerCase().includes(q) || (b.latin || "").toLowerCase().includes(q)));
  $("#speciesGrid").innerHTML = birds.map(b => {
    const on = pickedSpecies.includes(b.name);
    return `<button class="sp-chip ${on ? "on" : ""}" onclick="toggleSpecies('${attrJs(b.name)}')">${b.emoji} ${esc(b.name)}${on ? " ✓" : ""}</button>`;
  }).join("") || `<p class="muted">没有找到，试试下面的自定义添加 👇</p>`;
}

function toggleSpecies(name) {
  if (pickedSpecies.includes(name)) pickedSpecies = pickedSpecies.filter(s => s !== name);
  else pickedSpecies.push(name);
  renderPickedSpecies();
  renderSpeciesPicker();
}

function addCustomSpeciesFromInput() {
  const name = $("#customSpeciesInput").value.trim();
  if (!name) return toast("先输入鸟的名字");
  if (allBirds().some(b => b.name === name)) return toast("图鉴里已经有它啦");
  customBirds.push({ id: uid(), name, latin: "", rare: 0, live: "", note: "我们亲手加进图鉴的鸟 💌", emoji: "💫" });
  LS.set("customBirds", customBirds);
  pickedSpecies.push(name);
  $("#customSpeciesInput").value = "";
  renderPickedSpecies();
  renderSpeciesCatChips();
  renderSpeciesPicker();
  toast(`已加入图鉴：${name} 💫`);
}

/* ---------- 图鉴 ---------- */
let birdCat = "all";
function renderBirds() {
  const col = collectedMap();
  const total = allBirds().length;
  $("#collectProgress").textContent = `已收集 ${col.size} / ${total}`;

  const chips = $("#birdCatChips");
  if (!chips.dataset.init) {
    chips.dataset.init = "1";
    chips.innerHTML = `<button class="chip on" data-cat="all" onclick="birdCatPick(this)">全部</button>` +
      CATS.filter(c => c.id !== "custom" || customBirds.length).map(c =>
        `<button class="chip" data-cat="${c.id}" onclick="birdCatPick(this)">${c.emoji} ${c.name}</button>`).join("");
  }

  const q = ($("#birdSearch").value || "").trim().toLowerCase();
  const birds = allBirds().filter(b =>
    (birdCat === "all" || b.cat === birdCat) &&
    (!q || b.name.toLowerCase().includes(q) || (b.latin || "").toLowerCase().includes(q)));

  $("#birdGrid").innerHTML = birds.map(b => {
    const c = col.get(b.name);
    const cat = catOf(b.cat);
    return `
    <div class="bird-card ${c ? "unlocked" : "locked"}" onclick="showBirdDetail('${b.id}')">
      <div class="bird-emoji" style="background:${cat.color}22;border-color:${cat.color}55">${b.emoji}</div>
      <div class="bird-name">${esc(b.name)}${c ? "" : " 🔒"}</div>
      <div class="bird-meta">
        <span class="mini-badge ${RARE_CLS[b.rare]}">${RARE_TEXT[b.rare]}</span>
        ${c ? `<span class="first-date">${c.firstDate.slice(5)}</span>` : ""}
      </div>
    </div>`;
  }).join("") || `<p class="muted empty-tip">没有找到匹配的鸟种</p>`;
}

function birdCatPick(el) {
  $$("#birdCatChips .chip").forEach(c => c.classList.remove("on"));
  el.classList.add("on");
  birdCat = el.dataset.cat;
  renderBirds();
}

function showBirdDetail(id) {
  const b = allBirds().find(x => x.id === id);
  if (!b) return;
  const col = collectedMap().get(b.name);
  const cat = catOf(b.cat);
  $("#birdDetail").innerHTML = `
    <div class="bd-head" style="background:linear-gradient(135deg,${cat.color}33,#fff)">
      <span class="bd-emoji">${b.emoji}</span>
      <div>
        <h2>${esc(b.name)}</h2>
        <p class="latin">${esc(b.latin || "我们的收藏鸟种")}</p>
        <div class="bd-tags">
          <span class="mini-badge ${RARE_CLS[b.rare]}">${RARE_TEXT[b.rare]}</span>
          <span class="mini-badge cat" style="background:${cat.color}22;color:${cat.color}">${cat.emoji} ${cat.name}</span>
          ${b.live ? `<span class="mini-badge">🗓️ ${b.live}</span>` : ""}
        </div>
      </div>
    </div>
    <p class="bd-note">${esc(b.note || "")}</p>
    <div class="bd-status ${col ? "met" : ""}">
      ${col
        ? `💞 你们已相遇 ${col.count} 次<br><small>初遇：${col.firstDate} · ${esc(col.firstSpot || "")}</small>`
        : "🔒 还没有相遇过，去湿地找它吧"}
    </div>`;
  openModal("birdModal");
}

/* ---------- 地图 ---------- */
function renderMap() {
  const visitCount = {};
  records.forEach(r => { visitCount[r.spot] = (visitCount[r.spot] || 0) + 1; });

  $("#mapMarkers").innerHTML = SPOTS.map(s => `
    <g class="marker" transform="translate(${s.x},${s.y})" onclick="openSpotDetail('${s.id}')">
      <circle r="3.4" fill="#fff" stroke="#3d8b6f" stroke-width="0.8"/>
      <text y="1.2" text-anchor="middle" font-size="3">${s.emoji}</text>
      <text class="marker-label" y="-4.6" text-anchor="middle" font-size="2.6" fill="#4a5a52">${esc(s.name.length > 6 ? s.name.slice(0, 6) + "…" : s.name)}</text>
      ${visitCount[s.name] ? `<circle cx="2.6" cy="-2.6" r="1.7" fill="#e88b94"/><text x="2.6" y="-1.8" text-anchor="middle" font-size="2" fill="#fff">${visitCount[s.name]}</text>` : ""}
    </g>`).join("");

  $("#spotList").innerHTML = allSpots().map(s => {
    const n = visitCount[s.name] || 0;
    return `
    <div class="card spot-card" onclick="${s.custom ? `editCustomSpot('${s.id}')` : `openSpotDetail('${s.id}')`}">
      <div class="spot-head">
        <span class="spot-emoji">${s.emoji}</span>
        <b>${esc(s.name)}</b>
        ${n ? `<span class="visit-badge">去过 ${n} 次</span>` : `<span class="visit-badge none">未打卡</span>`}
      </div>
      <p class="spot-desc">${esc(s.desc || s.note || "")}</p>
      ${!s.custom && s.targets ? `<div class="spot-targets">${s.targets.map(t => `<span class="schip">${esc(t)}</span>`).join("")}</div>` : ""}
      ${!s.custom && s.best ? `<p class="spot-best">🗓️ 最佳时节：${esc(s.best)}</p>` : ""}
      ${s.custom ? `<div class="record-actions"><span class="link-btn">编辑 ✏️</span><button class="link-btn danger" onclick="event.stopPropagation();removeCustomSpot('${s.id}')">删除 🗑️</button></div>` : ""}
    </div>`;
  }).join("");
}

function openSpotDetail(id) {
  const s = SPOTS.find(x => x.id === id);
  if (!s) return;
  const n = records.filter(r => r.spot === s.name).length;
  $("#spotDetail").innerHTML = `
    <div class="spot-modal-head">
      <span class="bd-emoji">${s.emoji}</span>
      <div><h2>${esc(s.name)}</h2>
      <p class="latin">${n ? `你们去过 ${n} 次 💞` : "还没一起去过，安排！"} · 最佳时节：${esc(s.best)}</p></div>
    </div>
    <p class="bd-note">${esc(s.desc)}</p>
    <div class="bd-tags">
      ${s.targets.map(t => `<span class="mini-badge">🎯 ${esc(t)}</span>`).join("")}
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="closeModal('spotModal');openRecordFormWithSpot('${attrJs(s.name)}')">＋ 在这里记一笔</button>`;
  openModal("spotModal");
}

function openRecordFormWithSpot(name) {
  openRecordForm();
  const sel = $("#recSpot");
  if (Array.from(sel.options).some(o => o.value === name)) sel.value = name;
  else { sel.value = "__custom"; $("#recSpotCustom").value = name; $("#recSpotCustom").style.display = ""; }
}

function openSpotForm() { $("#customSpotId").value = ""; $("#customSpotName").value = ""; $("#customSpotNote").value = ""; openModal("spotFormModal"); }
function editCustomSpot(id) {
  const s = customSpots.find(x => x.id === id);
  if (!s) return;
  $("#customSpotId").value = id; $("#customSpotName").value = s.name; $("#customSpotNote").value = s.note || "";
  openModal("spotFormModal");
}
function saveCustomSpot() {
  const name = $("#customSpotName").value.trim();
  if (!name) return toast("给据点起个名字吧");
  const id = $("#customSpotId").value;
  if (id) customSpots = customSpots.map(s => (s.id === id ? { ...s, name, note: $("#customSpotNote").value.trim() } : s));
  else customSpots.push({ id: uid(), name, note: $("#customSpotNote").value.trim() });
  LS.set("customSpots", customSpots);
  closeModal("spotFormModal");
  toast("秘密据点已收藏 📍");
  renderMap();
}
function removeCustomSpot(id) {
  if (!confirm("删除这个据点？")) return;
  customSpots = customSpots.filter(s => s.id !== id);
  LS.set("customSpots", customSpots);
  renderMap();
}

/* ---------- 回忆 ---------- */
function renderMemories() {
  const col = collectedMap();
  $("#memSub").textContent = records.length
    ? `在一起的第 ${togetherDays()} 天 · 已收集 ${col.size} 种鸟 · ${records.length} 次出发`
    : "每一次相遇，都值得被记住";

  /* 里程碑 */
  const collectedRare = allBirds().filter(b => b.rare === 2 && col.has(b.name)).length;
  const photoTotal = records.reduce((n, r) => n + (r.photos ? r.photos.length : 0), 0);
  const spotsVisited = new Set(records.map(r => r.spot)).size;
  const unlocked = {
    m01: records.length >= 1, m02: col.size >= 10, m03: col.size >= 25, m04: col.size >= 50, m05: col.size >= 75, m06: col.size >= 100,
    m07: records.length >= 15, m08: records.length >= 30, m09: spotsVisited >= 5,
    m10: collectedRare >= 1, m11: collectedRare >= 3, m12: photoTotal >= 20,
  };
  $("#milestones").innerHTML = MILESTONES.map(m => `
    <div class="milestone ${unlocked[m.id] ? "on" : ""}">
      <span class="ms-emoji">${m.emoji}</span>
      <b>${m.name}</b>
      <small>${m.desc}</small>
      <span class="ms-state">${unlocked[m.id] ? "已达成 🎉" : "未解锁"}</span>
    </div>`).join("");

  /* 月度柱状图 */
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${d.getMonth() + 1}月` });
  }
  const counts = months.map(m => records.filter(r => r.date.startsWith(m.key)).length);
  const maxC = Math.max(1, ...counts);
  $("#monthChart").innerHTML = `<div class="bars">${counts.map((c, i) =>
    `<div class="bar-col" title="${months[i].key}：${c} 次"><span class="bar-num">${c || ""}</span><div class="bar" style="height:${Math.max(4, c / maxC * 100)}%"></div><span class="bar-label">${months[i].label}</span></div>`).join("")}</div>`;

  /* 分类收藏 */
  const catCount = CATS.map(c => ({ ...c, n: allBirds().filter(b => b.cat === c.id && col.has(b.name)).length }));
  const maxCat = Math.max(1, ...catCount.map(c => c.n));
  $("#catChart").innerHTML = catCount.map(c => `
    <div class="cat-row">
      <span class="cat-name">${c.emoji} ${c.name}</span>
      <div class="cat-bar-bg"><div class="cat-bar" style="width:${c.n / maxCat * 100}%;background:${c.color}"></div></div>
      <span class="cat-num">${c.n}</span>
    </div>`).join("");

  /* 照片墙 */
  const photos = [];
  records.forEach(r => (r.photos || []).forEach(p => photos.push({ p, date: r.date, spot: r.spot })));
  $("#photoCount").textContent = photos.length ? `${photos.length} 张` : "";
  $("#photoWall").innerHTML = photos.length
    ? photos.map(x => `<img loading="lazy" src="${x.p}" title="${x.date} · ${esc(x.spot)}" onclick="showPhoto(this.src,event)" alt="${x.date}">`).join("")
    : `<p class="muted empty-tip">还没有照片，下次观鸟记得多拍几张 📷</p>`;
}

/* ---------- 设置 ---------- */
function openSettings() {
  $("#setNameA").value = settings.a; $("#setNameB").value = settings.b; $("#setAnniversary").value = settings.anniversary || "";
  openModal("settingsModal");
}
function saveSettings() {
  settings = { a: $("#setNameA").value.trim(), b: $("#setNameB").value.trim(), anniversary: $("#setAnniversary").value };
  LS.set("settings", settings);
  closeModal("settingsModal");
  toast("已保存 ⚙️");
  renderHome();
}

/* ---------- 导入导出 ---------- */
function exportData() {
  const data = { app: "birding-diary", version: 1, date: todayStr(), records, settings, customSpots, customBirds };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `观鸟日记备份-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("备份已下载 ⬇️");
}

function importData(input) {
  const f = input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!d || !Array.isArray(d.records)) throw 0;
      if (!confirm(`导入 ${d.date || ""} 的备份（${d.records.length} 条记录）？将覆盖当前数据。`)) return;
      records = d.records; settings = d.settings || settings;
      customSpots = d.customSpots || []; customBirds = d.customBirds || [];
      LS.set("records", records); LS.set("settings", settings);
      LS.set("customSpots", customSpots); LS.set("customBirds", customBirds);
      toast("导入成功 ✅");
      go("home");
    } catch (e) { toast("文件格式不对哦 ⚠️"); }
    input.value = "";
  };
  reader.readAsText(f);
}

/* ---------- 弹层 / 提示 ---------- */
function openModal(id) { $("#" + id).classList.add("show"); document.body.style.overflow = "hidden"; }
function closeModal(id) { $("#" + id).classList.remove("show"); document.body.style.overflow = ""; }

let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- 启动 ---------- */
go("home");
