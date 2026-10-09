/* ============================================================
 * 应用主逻辑：路由 / 情报流 / 回填流 / 图鉴 / 记录 / 设置
 * ============================================================ */

const App = {

  state: { sightings: [], records: [], settings: {} },
  filters: { intel: "all", bird: "all", birdClass: "all" },
  hotMonth: new Date().getMonth() + 1,   // 情报页热点月份（1-12，可切换）
  birdQuery: "",
  pendingCoord: null,     // 发布情报时暂存的选点

  /* ---------- 启动 ---------- */
  init() {
    this.migrate();
    this.importXhs();
    this.state.sightings = db.getSightings();
    this.state.records = db.getRecords();
    this.state.settings = db.getSettings();

    this.fillBirdList();
    this.fillSpotSelect();
    this.bindEvents();

    MapView.init();
    MapView.render(this.state.sightings);
    this.go("map");
    this.updateAll();
  },

  /* 一次性迁移：v2 清除旧版错标数据；v3 旧昵称升级 + 默认纪念日 */
  migrate() {
    const v = localStorage.getItem("bjDataV");
    if (v !== "3") {
      if (v !== "2") {
        db.getSightings().forEach(s => {
          const oldXhs = /^xhs-\d+$/.test(s.id);              // 旧格式导入 ID（xhs-001…）
          const demoSeed = s.source === "https://www.xiaohongshu.com/";  // 演示种子
          const badCoord = s.lat == null || s.lat > 30.7 || s.lat < 29.9; // 慈溪全域约 30.0~30.5
          if (oldXhs || demoSeed || badCoord) db.deleteSighting(s.id);
        });
      }
      localStorage.setItem("xhsDeleted", "[]");              // 旧墓碑一并作废
      /* v3：旧默认昵称「我/她」→ Ivan/Jane，空纪念日 → 2026-08-23 */
      const s = db.getSettings();
      const patch = {};
      if (!s.a || s.a === "我") patch.a = "Ivan";
      if (!s.b || s.b === "她") patch.b = "Jane";
      if (!s.anniversary) patch.anniversary = "2026-08-23";
      if (Object.keys(patch).length) db.saveSettings(patch);
      localStorage.setItem("bjDataV", "3");
    }
  },

  /* 导入 xlsx 整理的小红书鸟讯（幂等：稳定 id 去重 + 删除墓碑 + 字段刷新） */
  importXhs() {
    if (typeof IMPORTED_SIGHTINGS === "undefined") return;
    const existing = new Map(db.getSightings().map(s => [s.id, s]));
    const dead = new Set(JSON.parse(localStorage.getItem("xhsDeleted") || "[]"));
    IMPORTED_SIGHTINGS.forEach(s => {
      if (dead.has(s.id)) return;
      if (existing.has(s.id)) {
        // 已导入：只刷新生成字段，保留用户改动过的 status（如已证实）
        const { status, ...fields } = s;
        if (existing.get(s.id).status === "active") db.updateSighting(s.id, fields);
        return;
      }
      db.addSighting({ ...s, createdAt: Date.parse(s.date) || Date.now() });
    });
  },

  /* ---------- 视图刷新 ---------- */
  updateAll() {
    this.renderStats();
    this.renderLatest();
    this.renderIntelList();
    this.renderBirds();
    this.renderRecords();
    this.updateFinderChips();
    MapView.render(this.state.sightings);
  },

  updateFinderChips() {
    const chips = document.querySelectorAll("#cf-finder .chip");
    if (chips.length >= 2) {
      chips[0].textContent = this.state.settings.a || "Ivan";
      chips[1].textContent = this.state.settings.b || "Jane";
    }
  },

  renderStats() {
    const { records, sightings } = this.state;
    const active = sightings.filter(s => MapView.statusOf(s) === "active").length;
    $("#stat-records").textContent = records.length;   // 加新次数
    $("#stat-intel").textContent = active;             // 待加新
  },

  /* ---------- 情报渲染 ---------- */
  statusTag(st) {
    const label = { active: "待寻找", confirmed: "已加新" }[st];
    return `<span class="status-tag ${st}"><i class="mk mk-${st}"></i>${label}</span>`;
  },

  /* ---------- 本月热点：按 eBird 历史清单 × 图鉴珍稀/保护等级统计各点位 ---------- */
  hotspotsOfMonth(month) {
    const book = new Map(BIRDS.map(b => [b.name, b]));
    return (typeof EBIRD_SPOTS !== "undefined" ? EBIRD_SPOTS : [])
      .map(sp => {
        const stars = new Map();   // 本月记录过的珍稀/保护鸟种（清单按日期倒序，首个即最近记录）
        (sp.birds || []).forEach(([name, , , d]) => {
          if (Number(d.slice(5, 7)) !== month || stars.has(name)) return;
          const b = book.get(name);
          if (b && (b.prot || b.rare === 2)) stars.set(name, b);
        });
        const list = [...stars.values()]
          .sort((a, b) => (b.prot || 0) - (a.prot || 0) || b.rare - a.rare);
        /* 权重：一级 4 分、二级 2 分、珍稀 1 分 */
        const score = list.reduce((t, b) => t + (b.prot === 1 ? 4 : b.prot === 2 ? 2 : 1), 0);
        return { sp, stars: list, score };
      })
      .filter(x => x.stars.length)
      .sort((a, b) => b.score - a.score || b.stars.length - a.stars.length);
  },

  hotspotHTML(x, rank) {
    const CAP = 8;
    const chips = x.stars.slice(0, CAP).map(b =>
      `<span class="hot-sp">${esc(b.name)}`
      + (b.prot === 1 ? `<i class="tag tag-invert">一级</i>`
        : b.prot === 2 ? `<i class="tag tag-prot2">二级</i>`
        : `<i class="tag">珍稀</i>`)
      + `</span>`).join("");
    return `
      <article class="intel-item hot-item" data-spot="${esc(x.sp.id)}">
        <span class="hot-rank mono">${String(rank).padStart(2, "0")}</span>
        <div>
          <div class="intel-bird">${esc(x.sp.name)}</div>
          <div class="intel-spot">本月历史记录 ${x.stars.length} 种珍稀 / 保护鸟种 · 最佳时节 ${esc(x.sp.best)}</div>
          <div class="hot-species">${chips}${x.stars.length > CAP ? `<span class="hot-more mono">…等 ${x.stars.length} 种</span>` : ""}</div>
        </div>
        <div class="intel-meta"><span>热点值 ${x.score}</span><span>去地图 →</span></div>
      </article>`;
  },

  renderLatest() {
    const list = this.hotspotsOfMonth(new Date().getMonth() + 1).slice(0, 4);
    $("#latest-list").innerHTML = list.length
      ? list.map((x, i) => this.hotspotHTML(x, i + 1)).join("")
      : `<p class="birds-empty">本月暂无珍稀鸟种记录——去地图上转转。</p>`;
  },

  switchHotMonth(delta) {
    this.hotMonth = ((this.hotMonth - 1 + delta + 12) % 12) + 1;
    this.renderIntelList();
  },

  renderIntelList() {
    const f = this.filters.intel;   // all / prot1 / prot2 / rare
    const month = this.hotMonth;
    const label = $("#hot-month");
    if (label) label.textContent = `${month} 月`;
    const list = this.hotspotsOfMonth(month)
      .filter(x => f === "all" || x.stars.some(b =>
        f === "prot1" ? b.prot === 1 : f === "prot2" ? b.prot === 2 : !b.prot && b.rare === 2));
    $("#intel-list").innerHTML = list.length
      ? list.map((x, i) => this.hotspotHTML(x, i + 1)).join("")
      : `<p class="birds-empty">${month} 月暂无匹配的珍稀鸟种记录——换个筛选或月份试试。</p>`;
  },

  /* ---------- 鸟种三段式档案：何时何地 / 识别 / 细节 ---------- */
  /* 月份列表压缩成区间文本：[1,2,3,11,12] → "1-3、11-12" */
  monthRanges(months) {
    const out = [];
    let s = null, p = null;
    months.forEach(m => {
      if (s === null) { s = p = m; return; }
      if (m === p + 1) { p = m; return; }
      out.push(s === p ? `${s}` : `${s}-${p}`);
      s = p = m;
    });
    if (s !== null) out.push(s === p ? `${s}` : `${s}-${p}`);
    return out.join("、");
  },

  /* 从 eBird 点位清单统计某鸟种的本地记录：出现月份 / 点位 / 最大数量 / 最近日期 */
  birdSchedule(name) {
    const spots = [], months = new Set();
    let max = 0, latest = "";
    (typeof EBIRD_SPOTS !== "undefined" ? EBIRD_SPOTS : []).forEach(sp =>
      (sp.birds || []).forEach(([n, , c, d]) => {
        if (n !== name) return;
        if (!spots.includes(sp.name)) spots.push(sp.name);
        months.add(Number(d.slice(5, 7)));
        if ((c || 0) > max) max = c;
        if (d > latest) latest = d;
      }));
    return spots.length ? { spots, months: [...months].sort((a, b) => a - b), max, latest } : null;
  },

  /* 三段式档案 HTML：何时何地（eBird 自动统计）+ 识别 + 细节（note 里【辨】【记】标记） */
  birdFieldHTML(bird) {
    const seg = {};
    (bird.note || "").split(/【(辨|记|找)】/).forEach((p, i, a) => { if (i % 2 === 1) seg[p] = (a[i + 1] || "").trim(); });
    const look = seg.辨 || bird.note || "";
    const sc = this.birdSchedule(bird.name);
    const when = sc
      ? `${this.monthRanges(sc.months)} 月见于${sc.spots.join("、")}`
        + `${sc.max > 1 ? `，历史最大 ×${sc.max}` : ""}（最近记录 ${sc.latest}）`
      : (seg.找 || `${bird.live}，暂无本地 eBird 记录`);
    return `
      <div class="bird-fields">
        <div class="bird-field"><span class="bf-k mono">何时何地</span><p class="detail-note">${esc(when)}</p></div>
        ${look ? `<div class="bird-field"><span class="bf-k mono">识别</span><p class="detail-note">${esc(look)}</p></div>` : ""}
        ${seg.记 ? `<div class="bird-field"><span class="bf-k mono">细节</span><p class="detail-note">${esc(seg.记)}</p></div>` : ""}
      </div>`;
  },

  /* 鸟种实拍照片：加新记录优先，其次情报实拍 */
  photoMapOf(name) {
    const rec = [...this.state.records].reverse().find(r => r.bird === name && r.photos?.length);
    if (rec) return rec.photos[0];
    const s = this.state.sightings.find(x => x.bird === name && x.photos?.length);
    return s ? s.photos[0] : "";
  },

  /* 图鉴卡片 → 鸟种详情弹窗 */
  openBirdDetail(name) {
    const b = BIRDS.find(x => x.name === name);
    if (!b) return;
    const got = this.state.records
      .filter(r => r.bird === name)
      .sort((x, y) => (x.date < y.date ? -1 : 1))[0];
    const tags = [
      b.prot === 1 ? `<span class="tag tag-invert">国家一级</span>` : b.prot === 2 ? `<span class="tag tag-prot2">国家二级</span>` : "",
      b.rare === 2 ? `<span class="tag tag-invert">珍稀</span>` : (b.rare === 1 ? `<span class="tag">少见</span>` : ""),
    ].filter(Boolean).join("");
    $("#bird-detail").innerHTML = `
      <div class="detail-hero detail-wiki" data-bird="${esc(b.name)}"></div>
      <h3 class="detail-bird">${esc(b.name)}</h3>
      <p class="detail-latin">${esc(b.latin)}</p>
      <div class="bird-tags">${tags}<span class="tag">${esc(b.live)}</span></div>
      <div class="detail-grid" style="margin-top:18px">
        <div class="detail-cell"><span class="detail-k">居留型</span><span class="detail-v">${esc(b.live)}</span></div>
        <div class="detail-cell"><span class="detail-k">稀有度</span><span class="detail-v">${b.rare === 2 ? "珍稀" : b.rare === 1 ? "少见" : "常见"}</span></div>
        <div class="detail-cell"><span class="detail-k">保护级别</span><span class="detail-v">${b.prot === 1 ? "国家一级" : b.prot === 2 ? "国家二级" : "—"}</span></div>
        <div class="detail-cell"><span class="detail-k">初遇</span><span class="detail-v">${got ? `${fmtCN(got.date)} · ${esc(got.spotName || "")}` : "尚未相遇"}</span></div>
      </div>
      ${this.birdFieldHTML(b)}`;
    this.openModal("modal-bird");

    /* 头图：本地图优先，无则异步补维基网图 */
    const hero = $("#bird-detail .detail-wiki");
    const local = this.photoMapOf(b.name);   /* photos/ 实拍映射 */
    if (local) hero.outerHTML = `<img class="detail-hero" src="${esc(local)}" alt="${esc(b.name)}">`;
    else birdPhoto(b.name, b.latin).then(url => {
      if (url && hero.isConnected) hero.innerHTML = `<img src="${esc(url)}" alt="${esc(b.name)}" loading="lazy" onerror="birdPhotoFail(this)">`;
    });
  },

  /* ---------- 情报详情 / 回填 ---------- */
  openIntelDetail(id) {
    const s = this.state.sightings.find(x => x.id === id);
    if (!s) return;
    const bird = BIRDS.find(b => b.name === s.bird);
    const st = MapView.statusOf(s);
    $("#intel-detail").innerHTML = `
      ${s.photos?.length
        ? `<img class="detail-hero" src="${esc(s.photos[0])}" alt="${esc(s.bird)}" loading="lazy">`
        : `<div class="detail-hero detail-wiki" data-bird="${esc(s.bird)}"></div>`}
      <h3 class="detail-bird">${esc(s.bird)}</h3>
      <p class="detail-latin">${bird ? esc(bird.latin) : "未收录种"}</p>
      ${this.statusTag(st)}
      <div class="detail-grid" style="margin-top:18px">
        <div class="detail-cell"><span class="detail-k">情报地点</span><span class="detail-v">${esc(s.spotName)}</span></div>
        <div class="detail-cell"><span class="detail-k">鸟种</span><span class="detail-v">${bird ? esc(bird.live) : "未收录种"}</span></div>
        <div class="detail-cell"><span class="detail-k">最近观测</span><span class="detail-v">${fmtCN(s.date)}</span></div>
        <div class="detail-cell"><span class="detail-k">情报来源</span><span class="detail-v">${s.source ? `<a href="${esc(s.source)}" target="_blank" rel="noopener">${/xiaohongshu\.com/.test(s.source) ? "小红书原帖 ↗" : "来源链接 ↗"}</a>` : "—"}</span></div>
        <div class="detail-cell"><span class="detail-k">位置坐标</span><span class="detail-v mono" style="font-size:.75rem">${s.lat?.toFixed(5)}, ${s.lng?.toFixed(5)}</span></div>
        <div class="detail-cell"><span class="detail-k">加新状态</span><span class="detail-v">${st === "confirmed" ? (() => { const r = this.state.records.find(x => x.sightingId === s.id); return r ? fmtCN(r.date) + " 加新" : "已加新"; })() : "未加新"}</span></div>
      </div>
      ${s.note ? `<p class="detail-note">${esc(s.note)}</p>` : ""}
      ${s.photos?.length > 1 ? `
      <div class="detail-photos">
        ${s.photos.slice(1).map(p => `<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="${esc(s.bird)}" loading="lazy"></a>`).join("")}
      </div>` : ""}
      ${bird ? `<p class="detail-note">${esc(bird.note)}</p>` : ""}
      <div class="detail-actions">
        ${st === "active" ? `<button type="button" class="btn btn-primary" id="btn-confirm">加新 ✓</button>` : ""}
        <button type="button" class="btn btn-outline" id="btn-focus">在地图上查看</button>
      </div>`;
    this.openModal("modal-intel");

    /* 无实拍图：异步补维基网图 */
    const wiki = $("#intel-detail .detail-wiki");
    if (wiki) {
      birdPhoto(wiki.dataset.bird).then(url => {
        if (url) wiki.innerHTML = `<img src="${esc(url)}" alt="${esc(wiki.dataset.bird)}" loading="lazy" onerror="birdPhotoFail(this)">`;
      });
    }

    $("#btn-focus")?.addEventListener("click", () => {
      this.closeModal("modal-intel");
      this.go("map");
      MapView.focus(s.id);
    });
    $("#btn-confirm")?.addEventListener("click", () => this.openConfirmForm(s));
  },

  openConfirmForm(s) {
    $("#cf-bird").textContent = `—— ${s.bird}`;
    $("#cf-date").value = todayStr();
    $("#cf-spot").value = s.spotName || "";
    $("#cf-spot-list").innerHTML =
      this.presetSpots().map(p => `<option value="${esc(p.name)}">`).join("");
    $("#cf-photos").value = "";
    this._pendingPhotos = [];
    this.renderPhotoPreviews();
    this.setChipGroup("#cf-finder", "a");
    this._confirming = s;
    this.closeModal("modal-intel");
    this.openModal("modal-confirm");
    $("#cf-date").focus();
  },

  /* 选择现场照片 → 压缩 → 暂存并预览（仅存本机） */
  async handlePhotoPick(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    for (const f of files) {
      try { this._pendingPhotos.push(await compressImage(f)); }
      catch { this.toast("有图片读取失败，已跳过"); }
    }
    e.target.value = "";
    this.renderPhotoPreviews();
  },

  renderPhotoPreviews() {
    const box = $("#cf-previews");
    if (!box) return;
    const list = this._pendingPhotos || [];
    box.innerHTML = list.map((src, i) => `
      <div class="cf-thumb">
        <img src="${src}" alt="">
        <button type="button" class="cf-del mono" data-del-photo="${i}">✕</button>
      </div>`).join("");
    box.querySelectorAll("[data-del-photo]").forEach(btn =>
      btn.addEventListener("click", () => {
        this._pendingPhotos.splice(Number(btn.dataset.delPhoto), 1);
        this.renderPhotoPreviews();
      }));
  },

  submitConfirm(e) {
    e.preventDefault();
    const s = this._confirming;
    if (!s) return;
    const rec = {
      id: uid(),
      bird: s.bird,
      spotName: $("#cf-spot").value.trim() || s.spotName,
      lat: s.lat, lng: s.lng,
      date: $("#cf-date").value || todayStr(),
      finder: this.chipValue("#cf-finder"),
      photos: this._pendingPhotos || [],
      sightingId: s.id,
      createdAt: Date.now(),
    };
    db.addRecord(rec);
    db.updateSighting(s.id, { status: "confirmed" });
    this.state.records = db.getRecords();
    this.state.sightings = db.getSightings();
    this.closeModal("modal-confirm");
    this._confirming = null;
    this._pendingPhotos = [];
    this.updateAll();
    this.toast(`已收入图鉴：${s.bird}`);
  },

  /* ---------- 发布情报 ---------- */
  openIntelForm() {
    $("#intel-form").reset();
    $("#if-date").value = todayStr();
    this.setChipGroup("#if-confidence", "high");
    this.pendingCoord = null;
    this.syncSpotCoords();
    this.openModal("modal-form");
    $("#if-bird").focus();
  },

  /* 预设点位 = 导入的 7 个实拍点位 + 手册观鸟点 */
  presetSpots() {
    return (window.IMPORTED_SPOTS || []).concat(SPOTS);
  },

  fillSpotSelect() {
    const sel = $("#if-spot");
    sel.innerHTML =
      this.presetSpots().map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("") +
      `<option value="custom">自定义（点选地图）</option>`;
  },

  syncSpotCoords() {
    const v = $("#if-spot").value;
    const p = v === "custom" ? null : this.presetSpots().find(x => x.id === v);
    if (p) {
      this.pendingCoord = { lat: p.lat, lng: p.lng };
      $("#if-coord").textContent = `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}（预设）`;
      $("#if-pick").textContent = "改选精确位置";
    } else {
      this.pendingCoord = null;
      $("#if-coord").textContent = "未选择";
      $("#if-pick").textContent = "在地图上点选";
    }
  },

  startPickOnMap() {
    this.closeModal("modal-form");
    this.go("map");
    MapView.startPick((lat, lng) => {
      this.pendingCoord = { lat, lng };
      $("#if-coord").textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      $("#if-pick").textContent = "重新点选";
      $("#if-spot").value = "custom";
      this.openModal("modal-form");
    });
  },

  submitIntel(e) {
    e.preventDefault();
    const bird = $("#if-bird").value.trim();
    const spotV = $("#if-spot").value;
    if (!bird) { this.toast("请填写鸟种"); return; }
    if (!this.pendingCoord) { this.toast("请选择预设地点或在地图上点选"); return; }
    const preset = spotV === "custom" ? null : this.presetSpots().find(x => x.id === spotV);
    const spotName = preset?.name || "自定义位置";
    db.addSighting({
      id: uid(),
      bird,
      spotId: spotV,
      spotKey: preset && String(preset.id).startsWith("xhs-") ? preset.id : null,
      spotName,
      lat: this.pendingCoord.lat,
      lng: this.pendingCoord.lng,
      date: $("#if-date").value || todayStr(),
      confidence: this.chipValue("#if-confidence"),
      source: $("#if-source").value.trim(),
      note: $("#if-note").value.trim(),
      status: "active",
      createdAt: Date.now(),
    });
    this.state.sightings = db.getSightings();
    this.closeModal("modal-form");
    this.updateAll();
    this.toast(`情报已发布：${bird}`);
  },

  deleteSighting(id) {
    db.deleteSighting(id);
    if (id.startsWith("xhs-")) {   // 导入的情报：记墓碑，防止下次启动复活
      const dead = JSON.parse(localStorage.getItem("xhsDeleted") || "[]");
      dead.push(id);
      localStorage.setItem("xhsDeleted", JSON.stringify(dead));
    }
    this.state.sightings = db.getSightings();
    this.updateAll();
    this.toast("情报已删除");
  },

  /* ---------- 图鉴 ---------- */
  renderBirds() {
    const collectedMap = {};
    this.state.records.forEach(r => {
      if (!collectedMap[r.bird] || r.date < collectedMap[r.bird].date) collectedMap[r.bird] = r;
    });
    const targetSet = new Set(
      this.state.sightings.filter(s => MapView.statusOf(s) === "active").map(s => s.bird)
    );
    /* 照片来源：加新记录的实拍优先，其次情报实拍；都没有则异步补维基网图 */
    const photoMap = {};
    this.state.sightings.forEach(s => { if (s.photos?.length && !photoMap[s.bird]) photoMap[s.bird] = s.photos[0]; });
    this.state.records.forEach(r => { if (r.photos?.length) photoMap[r.bird] = r.photos[0]; });
    const q = this.birdQuery.trim().toLowerCase();
    const f = this.filters.bird;

    const list = BIRDS.filter(b => {
      if (q && !(b.name.toLowerCase().includes(q) || b.latin.toLowerCase().includes(q))) return false;
      /* 两套筛选可组合：加新状态 × 鸟种等级 */
      if (f === "collected" && !collectedMap[b.name]) return false;
      if (f === "target" && !targetSet.has(b.name)) return false;
      const c = this.filters.birdClass;
      if (c === "common" && b.rare !== 0) return false;
      if (c === "uncommon" && b.rare !== 1) return false;
      if (c === "rare" && b.rare !== 2) return false;
      if (c === "prot1" && b.prot !== 1) return false;
      if (c === "prot2" && b.prot !== 2) return false;
      return true;
    });

    $("#birds-count").textContent = `${Object.keys(collectedMap).length} / ${BIRDS.length}`;
    $("#birds-grid").innerHTML = list.length ? list.map(b => {
      const got = collectedMap[b.name];
      const cls = got ? " is-collected" : "";
      /* 未加新 → 黑白照片；已加新 → 彩色 */
      const bw = got ? "" : " is-bw";
      const photo = photoMap[b.name]
        ? `<img class="bird-photo${bw}" src="${esc(photoMap[b.name])}" alt="${esc(b.name)}" loading="lazy">`
        : `<span class="bird-photo bird-noimg${bw}" data-bird="${esc(b.name)}" data-latin="${esc(b.latin)}">${esc(b.name.slice(0, 1))}</span>`;
      const tags = [
        b.prot === 1 ? `<span class="tag tag-invert">国家一级</span>` : b.prot === 2 ? `<span class="tag tag-prot2">国家二级</span>` : "",
        b.rare === 2 ? `<span class="tag tag-invert">珍稀</span>` : (b.rare === 1 ? `<span class="tag">少见</span>` : ""),
        targetSet.has(b.name) && !got ? `<span class="tag">待寻找</span>` : "",
      ].filter(Boolean).join("");
      return `
        <div class="bird-card${cls}">
          <div class="bird-info">
            <div>
              <h3 class="bird-name">${esc(b.name)}</h3>
              <div class="bird-latin">${esc(b.latin)}</div>
            </div>
            <div class="bird-tags">${tags}<span class="tag">${b.live}</span></div>
            <div class="bird-meta">${got ? `初遇 ${fmtCN(got.date)} · ${esc(got.spotName || "")}` : "尚未相遇"}</div>
          </div>
          ${photo}
        </div>`;
    }).join("") : `<p class="birds-empty">没有符合条件的鸟种。</p>`;
    /* 图鉴页可见时才拉网图（避免启动时全量请求） */
    if ($("#page-birds").classList.contains("is-active")) this.fillBirdWikiPhotos();
  },

  /* 图鉴无实拍图的鸟种 → 异步补维基网图（黑白/彩色跟随后台记录状态）；分批限流防维基 429 */
  fillBirdWikiPhotos() {
    const els = [...document.querySelectorAll("#birds-grid .bird-noimg[data-bird]")];
    const CONC = 5;
    let i = 0;
    (async () => {
      while (i < els.length) {
        const batch = els.slice(i, i + CONC); i += CONC;
        await Promise.all(batch.map(el => {
          const name = el.dataset.bird;
          const latin = el.dataset.latin || "";
          const bw = el.classList.contains("is-bw") ? " is-bw" : "";
          delete el.dataset.bird;
          return birdPhoto(name, latin).then(url => {
            if (url) el.outerHTML = `<img class="bird-photo${bw}" src="${esc(url)}" alt="${esc(name)}" loading="lazy" onerror="birdPhotoFail(this)" data-revert="bird-photo bird-noimg${bw}">`;
          });
        }));
      }
    })();
  },

  fillBirdList() {
    $("#bird-list").innerHTML = BIRDS.map(b => `<option value="${esc(b.name)}">`).join("");
  },

  /* ---------- 记录 ---------- */
  renderRecords() {
    const finderName = v => {
      const { a, b } = this.state.settings;
      return { a: a || "Ivan", b: b || "Jane", both: "一起发现" }[v] || v;
    };
    const list = [...this.state.records].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    $("#records-list").innerHTML = list.length ? list.map(r => `
      <article class="record-item">
        <div class="record-date">${r.date} · ${fmtCN(r.date)}</div>
        <div class="record-birds">${esc(r.bird)}</div>
        <div class="record-meta">
          <span>${esc(r.spotName || "—")}</span>
          <span>${esc(finderName(r.finder))}</span>
        </div>
        ${r.photos?.length ? `
        <div class="record-photos">
          ${r.photos.map(p => `<a href="${p}" target="_blank" rel="noopener"><img src="${p}" alt="${esc(r.bird)}" loading="lazy"></a>`).join("")}
        </div>` : ""}
        <button type="button" class="del" data-del-rec="${r.id}">删除</button>
      </article>`).join("")
      : `<p class="birds-empty">还没有记录——在地图上点开情报，点「加新」。</p>`;
  },

  deleteRecord(id) {
    db.deleteRecord(id);
    this.state.records = db.getRecords();
    this.updateAll();
    this.toast("记录已删除");
  },

  /* ---------- 设置 ---------- */
  fillSettings() {
    const s = this.state.settings;
    $("#set-a").value = s.a || "";
    $("#set-b").value = s.b || "";
    $("#set-anniversary").value = s.anniversary || "";
  },

  submitSettings(e) {
    e.preventDefault();
    db.saveSettings({
      a: $("#set-a").value.trim() || "Ivan",
      b: $("#set-b").value.trim() || "Jane",
      anniversary: $("#set-anniversary").value,
    });
    this.state.settings = db.getSettings();
    this.updateAll();
    this.toast("已保存");
  },

  /* ---------- 导出（备份 / 地图点位） ---------- */
  downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  exportData() {
    this.downloadText(`birdjournal-${todayStr()}.json`, db.exportAll(), "application/json");
  },

  /** 导出 KML（坐标转 WGS-84）：可导入 Google My Maps / Google Earth */
  exportKml() {
    const spots = Object.values(MapView.spots);
    if (!spots.length) { this.toast("地图上还没有点位"); return; }
    const pm = spots.map(sp => {
      const species = [...new Set(sp.items.map(s => s.bird))];
      const w = gcj02ToWgs84(sp.lat, sp.lng);
      return `    <Placemark>
      <name>${esc(sp.name)}</name>
      <description>${species.length} 种鸟：${esc(species.join("、"))}</description>
      <Point><coordinates>${w.lng.toFixed(6)},${w.lat.toFixed(6)},0</coordinates></Point>
    </Placemark>`;
    }).join("\n");
    this.downloadText(`观鸟点位-谷歌-${todayStr()}.kml`,
`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>观鸟点位 · 慈溪</name>
${pm}
  </Document>
</kml>`, "application/vnd.google-earth.kml+xml");
    this.toast("KML 已导出，可导入 Google My Maps");
  },

  /** 导出高德链接页（GCJ-02 原始坐标）：手机打开后逐点点开跳转高德 */
  exportAmapPage() {
    const spots = Object.values(MapView.spots);
    if (!spots.length) { this.toast("地图上还没有点位"); return; }
    const rows = spots.map(sp => {
      const species = [...new Set(sp.items.map(s => s.bird))];
      const url = `https://uri.amap.com/marker?position=${sp.lng.toFixed(6)},${sp.lat.toFixed(6)}&name=${encodeURIComponent(sp.name)}&coordinate=gaode&callnative=1`;
      return `<tr>
        <td class="nm">${esc(sp.name)}</td>
        <td>${species.length} 种鸟</td>
        <td class="mono">${sp.lat.toFixed(5)}, ${sp.lng.toFixed(5)}</td>
        <td><a href="${url}" target="_blank" rel="noopener">在高德地图打开 ↗</a></td>
      </tr>`;
    }).join("\n");
    this.downloadText(`观鸟点位-高德-${todayStr()}.html`,
`<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>观鸟点位 · 慈溪 — 高德链接页</title>
<style>
  body { font-family: "Noto Serif SC", serif; margin: 0; background: #fff; color: #000; }
  header { border-bottom: 3px solid #000; padding: 28px 20px 16px; }
  h1 { margin: 0; font-size: 1.6rem; }
  p { margin: 6px 0 0; font-size: .8rem; color: #666; }
  table { border-collapse: collapse; width: 100%; max-width: 60rem; margin: 20px auto; }
  td { border-bottom: 1px solid #ddd; padding: 14px 12px; font-size: .9rem; }
  td.nm { font-weight: 700; white-space: nowrap; }
  .mono { font-family: monospace; font-size: .75rem; color: #666; white-space: nowrap; }
  a { color: #000; font-weight: 700; white-space: nowrap; }
  @media (max-width: 640px) { .mono { display: none; } td { padding: 14px 8px; } }
</style></head><body>
<header>
  <h1>观鸟点位 · 慈溪</h1>
  <p>共 ${spots.length} 个点位 · 手机上点「在高德地图打开」即可跳转 App 定位</p>
</header>
<table>${rows}</table>
</body></html>`, "text/html");
    this.toast("链接页已导出，手机打开后逐点点开");
  },

  importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        db.importAll(reader.result);
        this.state.sightings = db.getSightings();
        this.state.records = db.getRecords();
        this.state.settings = db.getSettings();
        this.updateAll();
        this.toast("导入成功");
      } catch { this.toast("导入失败：文件格式错误"); }
    };
    reader.readAsText(file);
  },

  /* ---------- 弹窗 / 路由 / 小组件 ---------- */
  openModal(id) {
    const m = $("#" + id);
    m.hidden = false;
    m.classList.add("is-open");
  },
  closeModal(id) {
    const m = $("#" + id);
    m.hidden = true;
    m.classList.remove("is-open");
  },

  go(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("is-active"));
    $("#page-" + page).classList.add("is-active");
    document.querySelectorAll("[data-go]").forEach(el =>
      el.classList.toggle("is-active", el.dataset.go === page));
    if (page === "map") setTimeout(() => MapView.map.invalidateSize(), 50);
    window.scrollTo(0, 0);
    if (page === "birds") setTimeout(() => this.fillBirdWikiPhotos(), 0);
    if (page === "settings") this.fillSettings();
  },

  chipValue(sel) {
    return document.querySelector(`${sel} .chip.is-active`)?.dataset.v || "";
  },
  setChipGroup(sel, v) {
    document.querySelectorAll(`${sel} .chip`).forEach(c =>
      c.classList.toggle("is-active", c.dataset.v === v));
  },

  toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  },

  /* ---------- 事件绑定 ---------- */
  bindEvents() {
    const $ = s => document.querySelector(s);
    this.$$ = $;

    document.querySelectorAll("[data-go]").forEach(el =>
      el.addEventListener("click", e => { e.preventDefault(); this.go(el.dataset.go); }));

    // 地图页工具
    $("#btn-reset-view").addEventListener("click", () => MapView.resetView());
    $("#btn-locate").addEventListener("click", () => MapView.locate());
    $("#btn-satellite").addEventListener("click", e => {
      const sat = MapView.toggleSatellite();
      e.currentTarget.textContent = sat ? "矢量图" : "卫星图";
    });
    $("#btn-cancel-pick").addEventListener("click", () => MapView.cancelPick());

    // 一键导出点位（谷歌 KML / 高德链接页）
    const exportMenu = $("#export-menu");
    $("#btn-export-spots").addEventListener("click", e => {
      e.stopPropagation();
      exportMenu.hidden = !exportMenu.hidden;
    });
    document.addEventListener("click", e => {
      if (!e.target.closest(".export-wrap")) exportMenu.hidden = true;
    });
    $("#exp-kml").addEventListener("click", () => { exportMenu.hidden = true; this.exportKml(); });
    $("#exp-amap").addEventListener("click", () => { exportMenu.hidden = true; this.exportAmapPage(); });

    // 情报表单
    $("#intel-form").addEventListener("submit", e => this.submitIntel(e));
    $("#if-spot").addEventListener("change", () => this.syncSpotCoords());
    $("#if-pick").addEventListener("click", () => this.startPickOnMap());
    document.querySelectorAll("#if-confidence .chip").forEach(c =>
      c.addEventListener("click", () => this.setChipGroup("#if-confidence", c.dataset.v)));

    // 回填表单
    $("#confirm-form").addEventListener("submit", e => this.submitConfirm(e));
    $("#cf-photos").addEventListener("change", e => this.handlePhotoPick(e));
    document.querySelectorAll("#cf-finder .chip").forEach(c =>
      c.addEventListener("click", () => this.setChipGroup("#cf-finder", c.dataset.v)));

    // 弹窗关闭
    document.querySelectorAll(".modal [data-close]").forEach(el =>
      el.addEventListener("click", () => {
        this.closeModal(el.closest(".modal").id);
      }));
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        MapView.cancelPick();
        document.querySelectorAll(".modal").forEach(m => this.closeModal(m.id));
      }
      /* N 键 → 直达标点模式：跳地图点选，选完自动弹情报表单 */
      if ((e.key === "n" || e.key === "N") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
        e.preventDefault();
        this.startPickOnMap();
      }
    });

    // 列表点击（事件委托：详情 + 删除）
    document.body.addEventListener("click", e => {
      const del = e.target.closest("[data-del]");
      if (del) { e.stopPropagation(); this.deleteSighting(del.dataset.del); return; }
      const delRec = e.target.closest("[data-del-rec]");
      if (delRec) { this.deleteRecord(delRec.dataset.delRec); return; }
      const item = e.target.closest(".intel-item");
      if (item) {
        /* 热点地点 → 飞到地图弹开清单；旧情报 → 详情弹窗 */
        if (item.dataset.spot) { this.go("map"); MapView.focusEbird(item.dataset.spot); }
        else this.openIntelDetail(item.dataset.id);
      }
    });

    // 情报筛选 + 热点月份切换
    document.querySelectorAll("#intel-filter .chip").forEach(c =>
      c.addEventListener("click", () => {
        this.filters.intel = c.dataset.f;
        document.querySelectorAll("#intel-filter .chip").forEach(x =>
          x.classList.toggle("is-active", x === c));
        this.renderIntelList();
      }));
    $("#hot-prev").addEventListener("click", () => this.switchHotMonth(-1));
    $("#hot-next").addEventListener("click", () => this.switchHotMonth(1));

    // 图鉴筛选（加新状态 / 鸟种等级两组，各自单选、互相组合）+ 搜索
    const chipGroup = (id, key, rerender) => {
      document.querySelectorAll(`${id} .chip`).forEach(c =>
        c.addEventListener("click", () => {
          this.filters[key] = c.dataset.f;
          document.querySelectorAll(`${id} .chip`).forEach(x =>
            x.classList.toggle("is-active", x === c));
          rerender();
        }));
    };
    chipGroup("#bird-filter", "bird", () => this.renderBirds());

    /* 图鉴卡片 → 鸟种档案弹窗（事件委托，重渲染后依然有效） */
    $("#birds-grid").addEventListener("click", e => {
      const card = e.target.closest(".bird-card");
      if (card?.dataset.name) this.openBirdDetail(card.dataset.name);
    });
    chipGroup("#bird-class-filter", "birdClass", () => this.renderBirds());
    $("#bird-search").addEventListener("input", e => {
      this.birdQuery = e.target.value;
      this.renderBirds();
    });

    // 设置
    $("#settings-form").addEventListener("submit", e => this.submitSettings(e));
    $("#btn-export").addEventListener("click", () => this.exportData());
    $("#btn-import").addEventListener("click", () => $("#import-file").click());
    $("#import-file").addEventListener("change", e => {
      if (e.target.files[0]) this.importData(e.target.files[0]);
      e.target.value = "";
    });
  },
};

/* 简写 */
function $(s) { return document.querySelector(s); }

document.addEventListener("DOMContentLoaded", () => App.init());
