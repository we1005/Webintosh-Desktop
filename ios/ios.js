/* ============================================================
   Webintosh · iOS 7 移动端模式（iPhone 5s）
   独立页面脚本：锁屏滑动解锁 / SpringBoard / 应用缩放动画
   ============================================================ */

// 重复注入守卫（本页为独立文档，此守卫仅作防御）
if (!window.__webintoshIOS) {
    window.__webintoshIOS = true;
    initIOS();
}

function initIOS() {
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const screenEl = $("#screen");
    const lockscreen = $("#lockscreen");
    const springboard = $("#springboard");
    const sbWallpaper = $("#sbWallpaper");
    const appView = $("#appView");
    const appFrame = $("#appFrame");
    const safariPage = $("#safariPage");
    const homePill = $("#homePill");
    const alertBackdrop = $("#alertBackdrop");
    const alertTitle = $("#alertTitle");
    const alertMsg = $("#alertMsg");
    const alertOk = $("#alertOk");
    const deviceHome = $("#deviceHome");

    /* ---------------- 时间 / 日期 ---------------- */

    const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

    function pad(n) {
        return n < 10 ? "0" + n : "" + n;
    }

    function updateClock() {
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();
        const s = now.getSeconds();
        const timeStr = h + ":" + pad(m);

        $$(".sb-time").forEach((el) => (el.textContent = timeStr));
        $("#lockTime").textContent = timeStr;
        $("#lockDate").textContent =
            (now.getMonth() + 1) + "月" + now.getDate() + "日 " + WEEKDAYS[now.getDay()];

        // 日历图标：真实日期
        $("#calWeek").textContent = WEEKDAYS[now.getDay()];
        $("#calDay").textContent = String(now.getDate());

        // 时钟图标：会走的表针
        const hDeg = ((h % 12) + m / 60) * 30;
        const mDeg = (m + s / 60) * 6;
        const sDeg = s * 6;
        $("#clkH").setAttribute("transform", "rotate(" + hDeg + " 30 30)");
        $("#clkM").setAttribute("transform", "rotate(" + mDeg + " 30 30)");
        $("#clkS").setAttribute("transform", "rotate(" + sDeg + " 30 30)");
    }

    updateClock();
    setInterval(updateClock, 1000);

    /* ---------------- 电池 ---------------- */

    function renderBattery(level, charging) {
        const pct = Math.round(level * 100);
        $$(".sb-batt-text").forEach((el) => (el.textContent = pct + "%"));
        $$(".sb-batt-level").forEach((el) => {
            el.style.width = Math.max(4, pct) + "%";
            el.classList.toggle("charging", !!charging);
        });
    }

    renderBattery(1, false);

    if (navigator.getBattery) {
        navigator
            .getBattery()
            .then((batt) => {
                const sync = () => renderBattery(batt.level, batt.charging);
                sync();
                batt.addEventListener("levelchange", sync);
                batt.addEventListener("chargingchange", sync);
            })
            .catch(() => {});
    }

    /* ---------------- 锁屏：滑动解锁 ---------------- */

    let unlocked = false;
    let dragging = false;
    let startX = 0;
    let lastDx = 0;

    function setDragProgress(dx) {
        const w = screenEl.clientWidth;
        const p = Math.min(1, dx / w);
        lockscreen.style.transform = "translateX(" + dx + "px)";
        lockscreen.style.opacity = String(1 - p * 0.35);
        // SpringBoard 随进度从 1.2x 缩放淡入
        springboard.style.opacity = String(p);
        springboard.style.transform = "scale(" + (1.2 - 0.2 * p) + ")";
    }

    function finishUnlock() {
        unlocked = true;
        const w = screenEl.clientWidth;
        lockscreen.style.transition = "transform 0.3s ease-out, opacity 0.3s ease-out";
        lockscreen.style.transform = "translateX(" + w + "px)";
        lockscreen.style.opacity = "0";

        springboard.style.transition =
            "transform 0.4s cubic-bezier(0.25, 0.9, 0.35, 1), opacity 0.4s ease-out";
        springboard.style.opacity = "1";
        springboard.style.transform = "scale(1)";

        setTimeout(() => {
            lockscreen.style.display = "none";
            springboard.classList.add("active");
            springboard.style.transition = "";
            springboard.style.opacity = "";
            springboard.style.transform = "";
        }, 420);
    }

    function resetLock() {
        lockscreen.style.transition = "transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.15), opacity 0.3s ease";
        lockscreen.style.transform = "translateX(0)";
        lockscreen.style.opacity = "1";
        springboard.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        springboard.style.opacity = "0";
        springboard.style.transform = "scale(1.2)";
        setTimeout(() => {
            lockscreen.style.transition = "";
        }, 320);
    }

    lockscreen.addEventListener("pointerdown", (e) => {
        if (unlocked) return;
        dragging = true;
        startX = e.clientX;
        lastDx = 0;
        lockscreen.style.transition = "none";
        springboard.style.transition = "none";
        try {
            lockscreen.setPointerCapture(e.pointerId);
        } catch (err) {
            /* 部分旧内核不支持，可忽略 */
        }
    });

    lockscreen.addEventListener("pointermove", (e) => {
        if (!dragging || unlocked) return;
        lastDx = Math.max(0, e.clientX - startX);
        setDragProgress(lastDx);
    });

    function endDrag() {
        if (!dragging || unlocked) return;
        dragging = false;
        if (lastDx > screenEl.clientWidth * 0.4) {
            finishUnlock();
        } else {
            resetLock();
        }
    }

    lockscreen.addEventListener("pointerup", endDrag);
    lockscreen.addEventListener("pointercancel", endDrag);

    /* ---------------- 壁纸视差 ---------------- */

    function parallax(nx, ny) {
        // nx / ny ∈ [-0.5, 0.5]，壁纸反向小幅平移
        const max = 10;
        sbWallpaper.style.transform =
            "translate(" + (-nx * max).toFixed(1) + "px, " + (-ny * max).toFixed(1) + "px)";
    }

    screenEl.addEventListener("mousemove", (e) => {
        const r = screenEl.getBoundingClientRect();
        parallax((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
    });

    window.addEventListener("deviceorientation", (e) => {
        if (e.gamma == null || e.beta == null) return;
        const nx = Math.max(-0.5, Math.min(0.5, e.gamma / 60));
        const ny = Math.max(-0.5, Math.min(0.5, (e.beta - 40) / 60));
        parallax(nx, ny);
    });

    /* ---------------- 应用打开 / 关闭 ---------------- */

    const APP_URLS = {
        music: "../apps/applemusic/index.html",
        spotify: "../apps/spotify/index.html",
    };

    let appOpen = false;
    let closing = false;

    function setAppOrigin(iconEl) {
        const r = iconEl.getBoundingClientRect();
        const s = screenEl.getBoundingClientRect();
        const ox = r.left + r.width / 2 - s.left;
        const oy = r.top + r.height / 2 - s.top;
        appView.style.transformOrigin = ox + "px " + oy + "px";
    }

    function openApp(kind, iconEl) {
        // 关闭动画进行中又点了应用：立即结束上一次关闭，避免 340ms 死区吞点击
        if (closing) finalizeClose();
        if (appOpen) return;
        appOpen = true;

        setAppOrigin(iconEl);

        if (kind === "safari") {
            appFrame.style.display = "none";
            appFrame.removeAttribute("src");
            safariPage.hidden = false;
        } else {
            safariPage.hidden = true;
            appFrame.style.display = "";
            appFrame.src = APP_URLS[kind];
        }

        appView.hidden = false;
        // 强制 reflow，确保 scale(0.2) 初始帧生效
        void appView.offsetWidth;
        appView.classList.add("open");
        springboard.classList.add("zoomed");
    }

    let closeTimer = null;

    // 真正复位关闭状态（动画结束或被打断时调用）
    function finalizeClose() {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        appView.classList.remove("closing");
        appView.hidden = true;
        appFrame.removeAttribute("src");
        safariPage.hidden = true;
        appOpen = false;
        closing = false;
    }

    function closeApp() {
        if (!appOpen || closing) return;
        closing = true;

        appView.classList.remove("open");
        appView.classList.add("closing");
        springboard.classList.remove("zoomed");

        closeTimer = setTimeout(finalizeClose, 340);
    }

    homePill.addEventListener("click", closeApp);
    if (deviceHome) {
        deviceHome.addEventListener("click", () => {
            if (appOpen) closeApp();
        });
    }

    /* ---------------- iOS 7 弹窗（未安装） ---------------- */

    function showAlert(name) {
        alertTitle.textContent = "“" + name + "”未安装";
        alertMsg.textContent = "此设备尚未安装该应用。";
        alertBackdrop.hidden = false;
        void alertBackdrop.offsetWidth;
        alertBackdrop.classList.add("show");
    }

    function hideAlert() {
        alertBackdrop.classList.remove("show");
        setTimeout(() => {
            alertBackdrop.hidden = true;
        }, 220);
    }

    alertOk.addEventListener("click", hideAlert);
    alertBackdrop.addEventListener("click", (e) => {
        if (e.target === alertBackdrop) hideAlert();
    });

    /* ---------------- 图标点击分发 ---------------- */

    $$(".app").forEach((btn) => {
        btn.addEventListener("click", () => {
            const kind = btn.dataset.app;
            const name = btn.dataset.name || "";
            const icon = btn.querySelector(".icon") || btn;
            if (kind === "music" || kind === "spotify" || kind === "safari") {
                openApp(kind, icon);
            } else {
                showAlert(name);
            }
        });
    });
}
