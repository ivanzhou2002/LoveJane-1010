/* ============================================================
 * 地图：Leaflet + 高德瓦片（彩色）
 * 标记按"点位"聚合：一个点位一个标记，弹窗列出该点观测过的全部鸟种
 * ============================================================ */

const MapView = {
  map: null,
  markers: {},          // spotKey -> L.Marker
  spots: {},            // spotKey -> { name, lat, lng, items[] }
  spotOf: {},           // sightingId -> spotKey
  tileVector: null,
  tileSatellite: null,
  pickHandler: null,    // 选点回调

  /* 高德瓦片（无需 key 的公开瓦片地址，仅本地/演示使用） */
  VECTOR_URL: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
  SATELLITE_URL: "https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}",

  init() {
    this.map = L.map("map", {
      center: [30.31, 121.30],
      zoom: 11,
      minZoom: 10,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: true,
    });
    /* 初始视野：慈溪北部观鸟区 + 东南角龙山海滨（eBird 热点）；不做硬锁定，由「回到慈溪」按钮复位 */
    this.map.fitBounds([[30.10, 121.08], [30.47, 121.62]]);
    this.tileVector = L.tileLayer(this.VECTOR_URL, {
      subdomains: "1234", maxZoom: 18, attribution: "© 高德地图",
    }).addTo(this.map);
    this.tileSatellite = L.tileLayer(this.SATELLITE_URL, {
      subdomains: "1234", maxZoom: 18, attribution: "© 高德地图",
    });
    // 点位弹窗内的鸟种行 → 打开情报详情
    this.map.on("popupopen", () => {
      document.querySelectorAll(".pop-bird").forEach(el =>
        el.addEventListener("click", () => App.openIntelDetail(el.dataset.id)));
    });
  },

  /** 回到慈溪：复位到初始视野 */
  resetView() {
    this.map.flyToBounds([[30.10, 121.08], [30.47, 121.62]]);
  },

  toggleSatellite() {
    const usingSat = this.map.hasLayer(this.tileSatellite);
    if (usingSat) {
      this.map.removeLayer(this.tileSatellite);
      this.tileVector.addTo(this.map);
    } else {
      this.map.removeLayer(this.tileVector);
      this.tileSatellite.addTo(this.map);
    }
    return !usingSat;
  },

  /** 情报状态：只有 待寻找 / 已加新 两种 */
  statusOf(s) {
    return s.status === "confirmed" ? "confirmed" : "active";
  },

  /** 全量重绘：按点位聚合标记 */
  render(sightings) {
    Object.values(this.markers).forEach(m => m.remove());
    this.markers = {};
    this.spots = {};
    this.spotOf = {};

    sightings.forEach(s => {
      if (s.lat == null || s.lng == null) return;
      const key = s.spotKey || `loc-${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
      if (!this.spots[key]) {
        this.spots[key] = { name: s.spotName || "未命名点位", lat: s.lat, lng: s.lng, items: [] };
      }
      this.spots[key].items.push(s);
      this.spotOf[s.id] = key;
    });

    Object.entries(this.spots).forEach(([key, spot]) => {
      const n = new Set(spot.items.map(s => s.bird)).size;
      /* 圆形标记：大小分档表示鸟种数（1 种最小且不写数字） */
      const size = n <= 1 ? 14 : n <= 5 ? 20 : n <= 14 ? 26 : 32;
      const icon = L.divIcon({
        className: "loc-wrap",
        html: `<div class="loc-pin" style="width:${size}px;height:${size}px">`
          + (n > 1 ? `<span class="loc-count">${n}</span>` : "")
          + `</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const m = L.marker([spot.lat, spot.lng], { icon, riseOnHover: true })
        .on("click", () => this.openSpotPopup(key));
      m.addTo(this.map);
      this.markers[key] = m;
    });

    this.renderEbird();
  },

  /** eBird 热点参考点（白底黑框，与小红书点位反色区分）：显示鸟种总数，点击看简介与特色鸟种 */
  renderEbird() {
    (typeof EBIRD_SPOTS !== "undefined" ? EBIRD_SPOTS : []).forEach(sp => {
      const key = "eb-" + sp.id;
      if (this.markers[key]) return;   // 已画过则跳过（render 全量重绘时已被清掉，这里防重复）
      const size = 26;
      const icon = L.divIcon({
        className: "loc-wrap",
        html: `<div class="loc-pin is-ebird" style="width:${size}px;height:${size}px">`
          + `<span class="loc-count">${sp.species}</span></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const m = L.marker([sp.lat, sp.lng], { icon, riseOnHover: true })
        .on("click", () => this.openEbirdPopup(sp));
      m.addTo(this.map);
      this.markers[key] = m;
    });
  },

  /** eBird 热点弹窗：有完整清单则逐种列出（维基图 + 数量 + 最近记录），否则显示简介与特色鸟种 */
  openEbirdPopup(sp) {
    const head = `
      <div class="pop-head">
        <strong>${esc(sp.name)}</strong>
        <span class="pop-sub">eBird 热点 · ${sp.species} 种鸟${sp.lists ? ` · ${sp.lists} 份清单` : ""}</span>
      </div>`;
    const body = sp.birds ? (() => {
      const rows = sp.birds.map(([name, latin, n, d]) => {
        const ok = typeof App !== "undefined" && App.state.records.some(r => r.bird === name);
        return `<div class="pop-bird${ok ? " is-confirmed" : ""}">`
          + `<span class="pop-noimg" data-bird="${esc(name)}" data-latin="${esc(latin)}">${esc(name.slice(0, 1))}</span>`
          + `<span class="pop-name">${esc(name)}</span>`
          + `<span class="pop-count">${n ? "×" + n : "—"}</span>`
          + `<span class="pop-date">${esc(d.slice(2).replace(/-/g, "."))}</span>`
          + `</div>`;
      }).join("");
      return `
        <div class="pop-list">${rows}</div>
        <div class="pop-foot">
          <p class="pop-desc">${esc(sp.desc)}</p>
          <p class="pop-desc mono">最佳时节：${esc(sp.best)} · 已收录 ${sp.birds.length}/${sp.species} 种最近记录</p>
          <a class="pop-link mono" href="${esc(sp.url)}" target="_blank" rel="noopener">在 eBird 查看完整清单 ↗</a>
        </div>`;
    })() : (() => {
      const stars = sp.targets.map(t => `<span class="pop-star">${esc(t)}</span>`).join("");
      return `
        <div class="pop-body">
          <p class="pop-desc">${esc(sp.desc)}</p>
          <p class="pop-desc mono">最佳时节：${esc(sp.best)}</p>
          <div class="pop-stars">${stars}</div>
          <a class="pop-link mono" href="${esc(sp.url)}" target="_blank" rel="noopener">在 eBird 查看完整清单 ↗</a>
        </div>`;
    })();
    this.openPopupInView(L.popup({ className: "loc-popup", maxWidth: 380, autoPanPadding: [16, 16] })
      .setLatLng([sp.lat, sp.lng])
      .setContent(head + body));
    /* 列表行的维基网图异步补齐 */
    if (sp.birds) setTimeout(() => this.fillWikiImages(), 0);
  },

  /** 点位弹窗：该点观测过的全部鸟种清单 */
  openSpotPopup(key) {
    const spot = this.spots[key];
    const m = this.markers[key];
    if (!spot || !m) return;
    const species = [...new Set(spot.items.map(s => s.bird))];
    const rows = [...spot.items]
      .sort((a, b) => b.date.localeCompare(a.date) || a.bird.localeCompare(b.bird, "zh"))
      .map(s => {
        const ok = this.statusOf(s) === "confirmed";
        const thumb = s.photos?.length
          ? `<img src="${esc(s.photos[0])}" alt="" loading="lazy">`
          : `<span class="pop-noimg" data-bird="${esc(s.bird)}">${esc(s.bird.slice(0, 1))}</span>`;
        return `<button type="button" class="pop-bird${ok ? " is-confirmed" : ""}" data-id="${esc(s.id)}">`
          + `${thumb}`
          + `<span class="pop-name">${esc(s.bird)}</span>`
          + `<span class="pop-date">${fmtCN(s.date)}</span>`
          + `${ok ? `<span class="pop-check" title="已加新">✓</span>` : ""}`
          + `</button>`;
      }).join("");
    this.openPopupInView(L.popup({ className: "loc-popup", maxWidth: 380, autoPanPadding: [16, 16] })
      .setLatLng(m.getLatLng())
      .setContent(`
        <div class="pop-head">
          <strong>${esc(spot.name)}</strong>
          <span class="pop-sub">${species.length} 种鸟 · ${spot.items.length} 条记录</span>
        </div>
        <div class="pop-list">${rows}</div>`));
    /* 无实拍图的鸟种异步补维基网图 */
    setTimeout(() => this.fillWikiImages(), 0);
  },

  /** 打开弹窗并保证完整可见：顶部/右侧越界时平移地图补位（小比例尺下 Leaflet 自带 autoPan 不可靠） */
  openPopupInView(popup) {
    popup.openOn(this.map);
    requestAnimationFrame(() => {
      const el = popup.getElement();
      const wrap = this.map.getContainer();
      if (!el || !wrap) return;
      const r = el.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      let dx = 0, dy = 0;
      const overTop = (w.top + 8) - r.top;          // 上越界 → 视野北移，弹窗随之下移
      if (overTop > 0) dy = -overTop;
      const overRight = r.right - (w.right - 8);    // 右越界 → 视野东移，弹窗随之左移
      if (overRight > 0) dx = overRight;
      if (dx || dy) this.map.panBy([dx, dy]);
    });
  },

  /** 把弹窗内的首字占位替换为网图（查不到则保留占位）；学名查英文维基命中率更高 */
  fillWikiImages() {
    document.querySelectorAll(".pop-noimg[data-bird]").forEach(el => {
      const name = el.dataset.bird;
      const b = typeof BIRDS !== "undefined" ? BIRDS.find(x => x.name === name) : null;
      const latin = el.dataset.latin || (b ? b.latin : "");
      delete el.dataset.bird;
      birdPhoto(name, latin).then(url => {
        if (url) el.outerHTML = `<img src="${esc(url)}" alt="${esc(name)}" loading="lazy" onerror="birdPhotoFail(this)" data-revert="pop-noimg">`;
      });
    });
  },

  /** 定位到某条情报所在的点位并弹开清单 */
  focus(id) {
    const key = this.spotOf[id];
    const m = this.markers[key];
    if (!m) return;
    this.map.setView(m.getLatLng(), 13, { animate: false });
    this.openSpotPopup(key);
  },

  /** 定位到 eBird 热点并弹开清单（情报页"本月热点"入口） */
  focusEbird(spotId) {
    const sp = (typeof EBIRD_SPOTS !== "undefined" ? EBIRD_SPOTS : []).find(x => x.id === spotId);
    if (!sp) return;
    this.map.setView([sp.lat, sp.lng], 13, { animate: false });
    this.openEbirdPopup(sp);
  },

  /** 进入"点选位置"模式；再次点击地图回调 (lat, lng) */
  startPick(cb) {
    this.cancelPick();
    document.getElementById("map-banner").hidden = false;
    this.pickHandler = e => {
      MapView.cancelPick();
      cb(e.latlng.lat, e.latlng.lng);
    };
    this.map.once("click", this.pickHandler);
  },
  cancelPick() {
    if (this.pickHandler) this.map.off("click", this.pickHandler);
    this.pickHandler = null;
    document.getElementById("map-banner").hidden = true;
  },

  /** 浏览器定位（GPS 为 WGS-84，需转 GCJ-02） */
  locate() {
    if (!navigator.geolocation) {
      App.toast("此设备不支持定位");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p = wgs84ToGcj02(pos.coords.latitude, pos.coords.longitude);
        this.map.setView([p.lat, p.lng], 15, { animate: false });
        if (this._locMarker) this._locMarker.remove();
        this._locMarker = L.circleMarker([p.lat, p.lng], {
          radius: 6, color: "#1e9e50", weight: 3, fillColor: "#fff", fillOpacity: 1,
        }).addTo(this.map).bindTooltip("你在这里");
      },
      () => App.toast("定位失败：需要 HTTPS 或授权"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  },
};
