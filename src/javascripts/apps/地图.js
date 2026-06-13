// 地图 —— 基于 Leaflet + OpenStreetMap 的原生 JS 地图应用
// 通过 create('./assets/apps/地图.html','地图') 打开;脚本注入后自执行。
(() => {
  const win = document.getElementById("地图");
  if (!win) return;

  const canvas = win.querySelector("#maps-canvas");
  // 防重入:同一窗口已初始化则跳过(脚本可能被多次注入)
  if (!canvas || canvas._mapsInited) return;
  canvas._mapsInited = true;

  const input = win.querySelector(".search-input");
  const tip = win.querySelector(".map-tip");
  const placeBtns = win.querySelectorAll(".place-btn");

  // 默认视图:上海
  const DEFAULT = { lat: 31.2304, lng: 121.4737, zoom: 12 };

  const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

  let map = null;
  let marker = null;

  function showTip(msg, persist) {
    if (!tip) return;
    tip.textContent = msg;
    tip.classList.add("show");
    if (tip._timer) clearTimeout(tip._timer);
    if (!persist) {
      tip._timer = setTimeout(() => tip.classList.remove("show"), 3500);
    }
  }

  // 动态注入 Leaflet 的 CSS(全局只注入一次)
  function ensureCss() {
    if (document.querySelector('link[data-leaflet="1"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    link.setAttribute("data-leaflet", "1");
    link.crossOrigin = "";
    document.head.appendChild(link);
  }

  // 动态注入 Leaflet 的 JS;若已加载或加载中则复用同一 Promise。
  // 兼容某些环境(含 headless)script.onload 偶发不触发的情况:
  // 用 onload + 轮询 window.L 双保险,并设 ~10s 超时,避免永久 pending。
  function ensureLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (window._leafletLoading) return window._leafletLoading;
    ensureCss();
    window._leafletLoading = new Promise((resolve, reject) => {
      let done = false;
      const finish = () => { if (!done && window.L) { done = true; clearInterval(poll); resolve(window.L); } };
      const fail = (msg) => { if (!done) { done = true; clearInterval(poll); reject(new Error(msg)); } };
      const s = document.createElement("script");
      s.src = LEAFLET_JS;
      s.onload = finish;
      s.onerror = () => fail("Leaflet 加载失败");
      document.head.appendChild(s);
      // 轮询兜底:window.L 一旦就绪即 resolve;~10s 仍无则超时拒绝
      let n = 0;
      const poll = setInterval(() => {
        if (window.L) finish();
        else if (++n > 40) fail("Leaflet 加载超时");
      }, 250);
    });
    return window._leafletLoading;
  }

  function flyTo(lat, lng, zoom) {
    if (!map) return;
    map.flyTo([lat, lng], zoom != null ? zoom : map.getZoom(), {
      duration: 0.8,
    });
  }

  function setMarker(lat, lng, label) {
    if (!map || !window.L) return;
    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      marker = window.L.marker([lat, lng]).addTo(map);
    }
    if (label) marker.bindPopup(label).openPopup();
  }

  async function search(q) {
    const query = (q || "").trim();
    if (!query) return;
    showTip("正在搜索…", true);
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
        encodeURIComponent(query);
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        showTip('未找到 "' + query + '" 相关地点');
        return;
      }
      const hit = data[0];
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);
      flyTo(lat, lng, 13);
      setMarker(lat, lng, hit.display_name || query);
      if (tip) tip.classList.remove("show");
    } catch (err) {
      showTip("搜索失败,请检查网络连接后重试");
    }
  }

  function initMap(L) {
    // 窗口可能在加载完成前已被关闭/重开:再次确认 DOM 仍在
    if (!document.body.contains(canvas)) return;

    // 复用同一容器:若残留实例先销毁(重开/热重载时的稳健处理)
    if (canvas._leafletMap) {
      try {
        canvas._leafletMap.remove();
      } catch (e) {}
      canvas._leafletMap = null;
    }

    map = L.map(canvas, {
      center: [DEFAULT.lat, DEFAULT.lng],
      zoom: DEFAULT.zoom,
      zoomControl: true,
      attributionControl: true,
    });
    canvas._leafletMap = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    // 容器尺寸在窗口动画/布局后才稳定,延迟刷新避免灰块
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 200);

    // 预设地点按钮
    placeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        const zoom = parseInt(btn.dataset.zoom, 10) || 12;
        flyTo(lat, lng, zoom);
        setMarker(lat, lng, btn.textContent.trim());
      });
    });

    // 搜索:回车触发 Nominatim
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          search(input.value);
        }
      });
    }
  }

  ensureLeaflet()
    .then((L) => initMap(L))
    .catch(() => {
      showTip("无法加载地图组件,请确认已联网后重新打开「地图」", true);
    });
})();
