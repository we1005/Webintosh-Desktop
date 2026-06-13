/* ========================================================================
   控制中心 (Control Center) — macOS Sequoia 毛玻璃面板
   自包含模块,零外部接线。被加载后即可使用:
     window.__toggleControlCenter(anchorEl)  切换显隐(首次注入 DOM)
     window.__closeControlCenter()           关闭面板
   CSS 由本文件动态 <link> 注入;面板 HTML 由本文件 fetch 注入 body。
   亮度遮罩元素 id = "cc-brightness-dim"。
   音量写入 window.__systemVolume (0..1)。
   ======================================================================== */

const CSS_HREF = "./assets/stylesheets/控制中心/index.css";
const HTML_SRC = "./assets/apps/控制中心.html";

let panelEl = null;       // #cc-panel
let dimEl = null;         // #cc-brightness-dim
let lastAnchor = null;
let outsideHandler = null;
let injecting = false;

// 默认全局音量
if (typeof window.__systemVolume !== "number") {
    window.__systemVolume = 0.7;
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
        // 材质完全由 控制中心/index.css 的 backdrop-filter: blur()+saturate() 提供,
        // 干净磨砂玻璃、无任何色散折射边(与真实 macOS 控制中心一致)。
        // 故此处不再对 #cc-panel 应用 liquid-glass(避免彩虹边与双层材质冲突)。
    } finally {
        injecting = false;
    }
    return panelEl;
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
    // 连接性药丸切换 (Wi-Fi / 蓝牙 / 隔空投送)
    root.querySelectorAll('.cc-row[data-cc]').forEach((row) => {
        const sub = row.querySelector('.cc-sub');
        const key = row.getAttribute('data-cc');
        row.addEventListener('click', () => {
            const on = row.classList.toggle('cc-on');
            if (sub) {
                if (key === 'wifi') sub.textContent = on ? 'Home' : '关';
                else sub.textContent = on ? '开' : '关';
            }
        });
    });

    // Focus 大药丸
    const focus = root.querySelector('.cc-focus[data-cc="focus"]');
    if (focus) {
        const fsub = focus.querySelector('.cc-sub');
        const toggleFocus = () => {
            const on = focus.classList.toggle('cc-on');
            if (fsub) fsub.textContent = on ? '开' : '关';
        };
        focus.addEventListener('click', toggleFocus);
        focus.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFocus(); }
        });
    }

    // 舞台调度 / 屏幕镜像 大圆钮
    root.querySelectorAll('.cc-bigbtn[data-cc]').forEach((btn) => {
        btn.addEventListener('click', () => btn.classList.toggle('cc-on'));
    });

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

    // 底部快捷圆钮:视觉切换
    root.querySelectorAll('.cc-quickbtn[data-cc]').forEach((btn) => {
        btn.addEventListener('click', () => btn.classList.toggle('cc-on'));
    });

    // 滑块
    wireSlider(root.querySelector('.cc-slider[data-cc="brightness"]'), onBrightness);
    wireSlider(root.querySelector('.cc-slider[data-cc="volume"]'), onVolume);
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
    if (fill) fill.style.width = ((isNaN(init) ? 1 : init) * 100) + '%';
    onChange(isNaN(init) ? 1 : init);

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
    window.__systemVolume = v;
}

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
