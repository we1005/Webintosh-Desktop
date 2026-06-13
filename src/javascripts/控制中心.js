/* ========================================================================
   控制中心 (Control Center) — 源码级照搬 thanas-os ControlCenter 布局
   自包含模块,零外部接线。被加载后即可使用:
     window.__toggleControlCenter(anchorEl)  切换显隐(首次注入 DOM)
     window.__closeControlCenter()           关闭面板
   CSS 由本文件动态 <link> 注入;面板 HTML 由本文件 fetch 注入 body。
   亮度遮罩元素 id = "cc-brightness-dim"。

   全局音量总线(与 Music-Player 共享):
     window.__systemVolume 约定为 0..1。
     改变时:window.__systemVolume = v;
             document.dispatchEvent(new CustomEvent('webintosh-volume',{detail:v}));
     监听 'webintosh-volume' 在外部改变时同步自身 Sound 滑块。
   ======================================================================== */

import { applyLiquidGlass, removeLiquidGlass } from "./liquid-glass.js";

const CSS_HREF = "./assets/stylesheets/控制中心/index.css";
const HTML_SRC = "./assets/apps/控制中心.html";
const VOLUME_EVENT = "webintosh-volume";
const CC_STYLE_EVENT = "webintosh-cc-style";
const CC_STYLE_KEY = "webintosh.cc.style";

let panelEl = null;       // #cc-panel
let dimEl = null;         // #cc-brightness-dim
let lastAnchor = null;
let outsideHandler = null;
let injecting = false;

let volumeSliderEl = null;   // Sound 滑块(供事件总线回填)
let applyingExternalVol = false; // 防回环标志

// 默认全局音量
if (typeof window.__systemVolume !== "number") {
    window.__systemVolume = 0.65;
}

/* ---------------- 资源注入 ---------------- */

function ensureCss() {
    if (document.querySelector('link[data-cc-style="1"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CSS_HREF + "?v=" + Date.now();   // 防浏览器缓存旧 CSS
    link.setAttribute("data-cc-style", "1");
    document.head.appendChild(link);
}

function ensureDim() {
    if (dimEl && document.body.contains(dimEl)) return dimEl;
    dimEl = document.getElementById("cc-brightness-dim");
    if (!dimEl) {
        dimEl = document.createElement("div");
        dimEl.id = "cc-brightness-dim";
        document.body.appendChild(dimEl);
    }
    return dimEl;
}

async function ensurePanel() {
    if (panelEl && document.body.contains(panelEl)) return panelEl;
    if (injecting) return null;
    injecting = true;
    try {
        const res = await fetch(HTML_SRC);
        const html = await res.text();
        const tpl = document.createElement("template");
        tpl.innerHTML = html.trim();
        const node = tpl.content.querySelector("#cc-panel");
        document.body.appendChild(node);
        panelEl = node;
        wirePanel(panelEl);
        // 默认材质由 控制中心/index.css 的 backdrop-filter: blur()+saturate() 提供;
        // 液态玻璃风格则由 applyCCStyle('liquid') 叠加 SVG 折射滤镜。
        applyCCStyle(readCCStyle());
    } finally {
        injecting = false;
    }
    return panelEl;
}

/* ---------------- 控制中心 外观风格(磨砂 / 液态玻璃) ---------------- */

function readCCStyle() {
    const s = localStorage.getItem(CC_STYLE_KEY);
    return s === "liquid" ? "liquid" : "frosted";
}

// 克制的液态玻璃参数:色散收敛(几乎无彩虹边),折射强度适中,保留磨砂感。
const CC_LIQUID_OPTS = {
    // 对齐桌面卡片的强折射观感(liquid-glass 默认):明显光线扭曲 / 折射 / 放大镜 + 彩虹边
    scale: -180,           // 折射强度(负=向内折射,放大镜感)
    aberration: [0, 8, 16],// 逐通道色散,产生彩虹边
    blur: 11,
    displaceBlur: 0,
    saturation: 1.7,
    borderRadius: 24,      // 贴合控制中心面板圆角
    tint: "rgba(28,28,32,0.18)", // 偏深玻璃色但足够通透,让折射透出
};

function applyCCStyle(style) {
    if (!panelEl) return;
    const next = style === "liquid" ? "liquid" : "frosted";

    if (next === "liquid") {
        panelEl.setAttribute("data-cc-style", "liquid");
        applyLiquidGlass(panelEl, CC_LIQUID_OPTS);
    } else {
        removeLiquidGlass(panelEl);
        panelEl.setAttribute("data-cc-style", "frosted");
    }
}

/* ---------------- 定位 ---------------- */

function positionPanel(anchorEl) {
    if (!panelEl) return;
    // 默认贴菜单栏右侧;若提供 anchor,则相对其右对齐于下方
    let right = 8;
    let top = 30;
    if (anchorEl && typeof anchorEl.getBoundingClientRect === "function") {
        const r = anchorEl.getBoundingClientRect();
        right = Math.max(6, window.innerWidth - r.right);
        top = r.bottom + 6;
    }
    panelEl.style.right = right + "px";
    panelEl.style.top = top + "px";
}

/* ---------------- 显隐 ---------------- */

function showPanel() {
    panelEl.classList.add("cc-visible");
    // 延迟绑定外部点击,避免本次触发点击立即关闭
    requestAnimationFrame(() => {
        outsideHandler = (e) => {
            if (!panelEl.contains(e.target) &&
                !(lastAnchor && lastAnchor.contains && lastAnchor.contains(e.target))) {
                hidePanel();
            }
        };
        document.addEventListener("pointerdown", outsideHandler, true);
    });
}

function hidePanel() {
    if (!panelEl) return;
    panelEl.classList.remove("cc-visible");
    if (outsideHandler) {
        document.removeEventListener("pointerdown", outsideHandler, true);
        outsideHandler = null;
    }
}

function isVisible() {
    return panelEl && panelEl.classList.contains("cc-visible");
}

/* ---------------- 交互接线 ---------------- */

function wirePanel(root) {
    // 连接性行切换 (Wi-Fi / 蓝牙 / 隔空投送)
    root.querySelectorAll('.cc-row[data-cc]').forEach((row) => {
        const sub = row.querySelector('.cc-sub');
        const key = row.getAttribute('data-cc');
        row.addEventListener('click', () => {
            const on = row.classList.toggle('cc-on');
            if (sub) {
                if (key === 'wifi') sub.textContent = on ? 'Webintosh-Net' : '关';
                else if (key === 'airdrop') sub.textContent = on ? '所有人' : '仅限联系人';
                else sub.textContent = on ? '开' : '关';
            }
        });
    });

    // Focus 按钮
    const focus = root.querySelector('.cc-focus[data-cc="focus"]');
    if (focus) {
        const fsub = focus.querySelector('.cc-sub');
        focus.addEventListener('click', () => {
            const on = focus.classList.toggle('cc-on');
            if (fsub) fsub.textContent = on ? '开' : '关';
        });
    }

    // 两个方形按钮:舞台调度 / 主题(浅色 <-> 深色)切换
    root.querySelectorAll('.cc-tile[data-cc]').forEach((btn) => {
        const key = btn.getAttribute('data-cc');
        const label = btn.querySelector('[data-cc="theme-label"]');
        btn.addEventListener('click', () => {
            const on = btn.classList.toggle('cc-on');
            if (key === 'theme' && label) label.textContent = on ? '深色' : '浅色';
        });
    });

    // 声音卡 AirPlay 圆钮:视觉切换
    const airplay = root.querySelector('.cc-airplay[data-cc="sound-airplay"]');
    if (airplay) {
        airplay.addEventListener('click', () => airplay.classList.toggle('cc-on'));
    }

    // 正在播放 播放/暂停 图标切换
    const playBtn = root.querySelector('.cc-np-btn[data-cc="play"]');
    if (playBtn) {
        const icon = playBtn.querySelector('[data-cc="play-icon"]');
        let playing = false;
        const playPath = 'M7 4.5v15l13-7.5z';
        const pausePath = 'M7 4.5h4v15H7zM13 4.5h4v15h-4z';
        playBtn.addEventListener('click', () => {
            playing = !playing;
            if (icon) icon.innerHTML = `<path d="${playing ? pausePath : playPath}" />`;
        });
    }
    // 上一首/下一首 仅按下反馈,无逻辑

    // 滑块
    wireSlider(root.querySelector('.cc-slider[data-cc="brightness"]'), onBrightness);
    volumeSliderEl = root.querySelector('.cc-slider[data-cc="volume"]');
    wireSlider(volumeSliderEl, onVolume);

    // 初始化声音滑块为当前全局音量
    setSliderValue(volumeSliderEl, window.__systemVolume);
}

function setSliderValue(slider, v) {
    if (!slider) return;
    v = Math.min(1, Math.max(0, v));
    const fill = slider.querySelector('.cc-slider-fill');
    slider.setAttribute('data-value', String(v));
    if (fill) fill.style.width = (v * 100) + '%';
}

function wireSlider(slider, onChange) {
    if (!slider) return;
    const fill = slider.querySelector('.cc-slider-fill');
    let dragging = false;

    function setFromEvent(clientX) {
        const r = slider.getBoundingClientRect();
        let v = (clientX - r.left) / r.width;
        v = Math.min(1, Math.max(0, v));
        slider.setAttribute('data-value', String(v));
        if (fill) fill.style.width = (v * 100) + '%';
        onChange(v);
    }

    // 初始化填充
    const init = parseFloat(slider.getAttribute('data-value'));
    const iv = isNaN(init) ? 1 : init;
    if (fill) fill.style.width = (iv * 100) + '%';
    onChange(iv);

    slider.addEventListener('pointerdown', (e) => {
        dragging = true;
        try { slider.setPointerCapture(e.pointerId); } catch (_) {}
        setFromEvent(e.clientX);
        e.preventDefault();
    });
    slider.addEventListener('pointermove', (e) => {
        if (dragging) setFromEvent(e.clientX);
    });
    const end = (e) => {
        if (!dragging) return;
        dragging = false;
        try { slider.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    slider.addEventListener('pointerup', end);
    slider.addEventListener('pointercancel', end);
}

function onBrightness(v) {
    // 亮度 100% => opacity 0;最低 => opacity ~0.6
    const dim = ensureDim();
    dim.style.opacity = String((1 - v) * 0.6);
}

function onVolume(v) {
    // 拖动 Sound 滑块 -> 写总线 + 广播。
    // 防回环:若本次是外部事件回填触发的,则不再广播。
    window.__systemVolume = v;
    if (applyingExternalVol) return;
    document.dispatchEvent(new CustomEvent(VOLUME_EVENT, { detail: v }));
}

/* ---------------- 全局音量总线:监听外部(Music-Player)变更 ---------------- */
document.addEventListener(VOLUME_EVENT, (e) => {
    const v = typeof e.detail === "number" ? e.detail : window.__systemVolume;
    window.__systemVolume = Math.min(1, Math.max(0, v));
    if (!volumeSliderEl) return;
    // 用标志位防止回填又触发广播造成回环
    applyingExternalVol = true;
    setSliderValue(volumeSliderEl, window.__systemVolume);
    applyingExternalVol = false;
});

/* ---------------- 控制中心 外观风格事件:实时切换(面板已打开时立即变) ---------------- */
document.addEventListener(CC_STYLE_EVENT, (e) => {
    const style = e.detail === "liquid" ? "liquid" : "frosted";
    // 面板尚未注入时无需处理;下次注入会从 localStorage 读取并应用。
    if (panelEl && document.body.contains(panelEl)) {
        applyCCStyle(style);
    }
});

/* ---------------- 对外接口 ---------------- */

window.__toggleControlCenter = async function (anchorEl) {
    ensureCss();
    ensureDim();
    lastAnchor = anchorEl || lastAnchor;
    await ensurePanel();
    if (!panelEl) return;

    if (isVisible()) {
        hidePanel();
    } else {
        positionPanel(lastAnchor);
        showPanel();
    }
};

window.__closeControlCenter = function () {
    hidePanel();
};

// 窗口尺寸变化时,若面板可见则重新定位
window.addEventListener('resize', () => {
    if (isVisible()) positionPanel(lastAnchor);
});
