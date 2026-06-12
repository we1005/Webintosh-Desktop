import { updateMenu } from "./finderbar.js";
import { create, bringToFront } from "./window.js";
const tip = document.querySelector("body > div.tip");
const defaultApps = [
    "访达", "启动台", "Safari浏览器", "信息", "邮件", "地图", "照片", "FaceTime通话",
    "日历", "提醒事项", "备忘录", "音乐", "Spotify", "终端", "虚拟机", "系统设置",
    "hr", "下载_Folder", "废纸篓"
];
let noAnimation = ["启动台", "访达"];
let noMenuChanging = ["启动台"];
let doClose = ["启动台"];
let appStatus = { "访达": false };
window.appStatus = appStatus;
export const dock = document.getElementById("dock");
const dockcontainer = document.querySelector(".dockcontainer");
let imgs = dock.querySelectorAll(".container img");
let autoHide = localStorage.getItem("dock-autohide") === "on" || false;
let dockZoom = localStorage.getItem("dock-zoom") === "off" ? false : true;
let hideTimer = null;
const DOCK_TRANSITION = "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)";
let dock_zoom = false;
let currentImg = null;

function bindClickEvent(img, light, app) {
    img.addEventListener("mouseup", () => {
        if (appStatus[img.alt] == true) {
            if (!doClose.includes(img.alt)) {
                const win = document.getElementById(img.alt);
                if (win && win.isMinimized && win._restoreWindow) {
                    win._restoreWindow();   // 最小化的窗口：点 Dock 恢复
                } else if (win) {
                    bringToFront(win, img.alt);
                }
            } else {
                window.specialCloses[img.alt]();
                light.classList.remove("on");
            }
        } else {
            if (!noAnimation.includes(img.alt)) {
                img.classList.add("opening");
                setTimeout(() => {
                    img.classList.remove("opening");
                    light.classList.add("on");
                    create("./assets/apps/" + app + ".html", img.alt, light, app === "计算器");
                    appStatus[img.alt] = true;
                    if (!noMenuChanging.includes(img.alt))
                        updateMenu(app);
                }, 2980);
            } else {
                create("./assets/apps/" + app + ".html", img.alt, light, app === "计算器");
                appStatus[img.alt] = true;
                if (!noMenuChanging.includes(img.alt))
                    updateMenu(app);
            }
        }
    });
}

function updateTipPosition() {
    if (currentImg && tip && !dock.classList.contains("hidden")) {
        const rect = currentImg.getBoundingClientRect();
        const tipWidth = tip.offsetWidth;
        tip.style.left = rect.left + rect.width / 2 - tipWidth / 2 + 'px';
        tip.style.top = rect.top - 40 + 'px';
        requestAnimationFrame(updateTipPosition);
    }
};

function bindTipEvent(img) {
    img.addEventListener("mouseover", () => {
        if (tip && !dock.classList.contains("hidden")) {
            currentImg = img;
            tip.textContent = img.alt;
            tip.style.display = "block";
            tip.style.visibility = "hidden";
            requestAnimationFrame(() => {
                tip.style.visibility = "visible";
                updateTipPosition();
            });

            const rect = img.getBoundingClientRect();

            if (!dock_zoom) {
                tip.style.left = rect.left + rect.width / 2 - tip.offsetWidth / 2 + 'px';
                tip.style.top = "616px";
            } else {
                tip.style.left = rect.left + rect.width / 2 - tip.offsetWidth / 2 + 'px';
                tip.style.top = "580px";
            }
        }
    });

    img.addEventListener("mouseout", () => {
        currentImg = null;
        if (tip) {
            tip.style.display = "none";
            tip.style.visibility = "visible";
        }
    });
}

export function addToDock(app) {
    if (document.querySelector(`#dock img[alt="${app}"]`)) return;

    let container = document.createElement("div");
    container.classList.add("container");
    // 非常驻：从启动台临时加入 Dock，应用关闭后会被移除
    container.dataset.transient = "1";

    let img = document.createElement("img");
    img.src = `./assets/icons/${app}.svg`;
    img.alt = app;
    container.appendChild(img);

    let light = document.createElement("div");
    light.classList.add("light");
    container.appendChild(light);

    bindClickEvent(img, light, app);
    bindTipEvent(img);

    // 插在分隔线之前（归入主应用组），不额外添加分隔线
    const hr = dock.querySelector(".container hr");
    if (hr) {
        dock.insertBefore(container, hr.parentElement);
    } else {
        dock.appendChild(container);
    }

    // Update imgs list for animation
    imgs = dock.querySelectorAll(".container img");
}

// 移除非常驻应用的 Dock 图标（仅移除 addToDock 临时加入的，常驻应用不动）
export function removeFromDock(app) {
    const img = document.querySelector(`#dock img[alt="${app}"]`);
    if (!img) return;
    const container = img.closest(".container");
    if (container && container.dataset.transient === "1") {
        container.remove();
        imgs = dock.querySelectorAll(".container img");
    }
}

function init() {
    defaultApps.forEach((app, index) => {
        let container = document.createElement("div");
        container.classList.add("container");
        if (app != "hr") {
            let img = document.createElement("img");
            img.src = `./assets/icons/${app}.svg`;
            img.alt = app;
            if (app.endsWith("Folder")) {
                img.src = "./assets/icons/folder.svg";
                img.alt = app.split("_")[0];
            }
            container.appendChild(img);
            let light = document.createElement("div");
            light.classList.add("light");
            if (index == 0) {
                light.classList.add("on");
            }
            container.appendChild(light);
            bindClickEvent(img, light, app);
        } else {
            let hr = document.createElement("hr");
            container.appendChild(hr);
        }
        dock.appendChild(container);
    });
    imgs = dock.querySelectorAll(".container img");
    dock.addEventListener("animationend", () => {
        dock.style.animation = "none";
        dock.style.transition = DOCK_TRANSITION;
        if (autoHide) {
            dock.classList.add("autohide");
        }
    }, { once: true });
    window.addEventListener("dock-autohide-change", (e) => {
        console.log("Dock received autohide change:", e.detail);
        autoHide = e.detail === "on";
        if (!autoHide) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        updateDockVisibility();
    });
    dock.addEventListener("animationend", () => {
        if (dockZoom) {
            dock.classList.add("zoom");
        }
    }, { once: true });
    window.addEventListener("dock-zoom-change", (e) => {
        console.log("Dock received zoom change:", e.detail);
        dockZoom = e.detail === "on";
    });
    if (!autoHide) {
        setTimeout(() => {
            dock.style.transition = DOCK_TRANSITION;
        }, 1000);
    }

}
function DockAutoHide() {
    document.addEventListener("mousemove", (e) => {
        if (!autoHide) return;
        const isAtBottom = window.innerHeight - e.clientY < 30;
        if (isAtBottom) {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            if (dock.classList.contains("hidden")) {
                dock.classList.remove("hidden");
                dock.classList.add("show");
                dock.style.transform = "translateY(0)";
            } else if (!dock.classList.contains("show")) {
                dock.classList.add("show");
            }
        } else {
            if (dock.classList.contains("show") && !dock.classList.contains("hidden") && !hideTimer) {
                hideTimer = setTimeout(() => {
                    dock.classList.remove("show");
                    dock.classList.add("hidden");
                    dock.style.transform = "translateY(150%)";
                    hideTimer = null;
                }, 600);
            }
        }
    });
}

function updateDockVisibility() {
    dock.style.transition = DOCK_TRANSITION;
    dock.style.animation = "none";
    if (autoHide) {
        dock.classList.add("autohide");
        dock.classList.add("hidden");
        dock.classList.remove("show");
        dock.style.transform = "translateY(150%)";
    } else {
        dock.classList.remove("autohide");
        dock.classList.remove("hidden");
        dock.classList.remove("show");
        dock.style.transform = "translateY(0)";
    }
}

function tipSetup() {
    imgs.forEach(img => {
        bindTipEvent(img);
    });
}

/* ------------------------------------------------------------
 * Dock 放大 —— GPU 合成器路径：
 * 旧实现逐帧改 width/height（每帧整条 Dock 重排）。
 * 新实现：图标只做 transform: scale，容器做 translate3d 推挤，
 * 玻璃背景用 --dock-stretch 驱动 ::before 的 scaleX 跟随展宽，
 * 全程零布局计算；缩放值带 lerp 平滑，保留原手感。
 * ------------------------------------------------------------ */
function DockAnimation() {
    const baseWidth = 50;
    const mouseRange = 200;
    const maxScale = 1.8;
    const lerpSpeed = 0.3;
    let mouseX = null;

    dockcontainer.addEventListener("mousemove", (e) => { mouseX = e.clientX; });
    dock.addEventListener("mouseleave", () => { mouseX = null; });
    dockcontainer.addEventListener("mouseleave", () => { mouseX = null; });

    function animation() {
        const containers = dock.querySelectorAll(".container");
        let needLayout = false;

        containers.forEach((c) => {
            if (typeof c._scale === "undefined") { c._scale = 1; c._offset = 0; }
            const img = c.querySelector("img");
            let target = 1;
            if (img && dockZoom && mouseX !== null) {
                const rect = c.getBoundingClientRect();
                // 减去当前位移得到静态槽位中心，避免推挤反馈震荡
                const centerX = rect.left + rect.width / 2 - c._offset;
                const distance = Math.abs(mouseX - centerX);
                if (distance < mouseRange) {
                    target = 1 + (maxScale - 1) * Math.sin((1 - distance / mouseRange) * Math.PI / 2);
                }
            }
            const diff = target - c._scale;
            if (Math.abs(diff) > 0.002) {
                c._scale += diff * lerpSpeed;
                needLayout = true;
            } else if (c._scale !== target) {
                c._scale = target;
                needLayout = true;
            }
        });

        if (needLayout) {
            // 推挤偏移：放大图标把邻居推开，整体保持居中
            const extras = [...containers].map(c => (c._scale - 1) * baseWidth);
            const totalExtra = extras.reduce((a, b) => a + b, 0);
            let acc = 0;
            containers.forEach((c, i) => {
                const off = acc + extras[i] / 2 - totalExtra / 2;
                acc += extras[i];
                c._offset = off;
                c.style.transform = `translate3d(${off.toFixed(2)}px, 0, 0)`;
                const img = c.querySelector("img");
                if (img) img.style.transform = `scale(${c._scale.toFixed(4)})`;
            });
            dock.style.setProperty("--dock-stretch",
                (1 + totalExtra / Math.max(1, dock.offsetWidth)).toFixed(4));
        }
        requestAnimationFrame(animation);
    }
    animation();
}

init();
DockAutoHide();
DockAnimation();
window.dispatchEvent(new CustomEvent("dock-autohide-change", { detail: "off" }));
window.dispatchEvent(new CustomEvent("dock-zoom-change", { detail: "on" }));
setTimeout(tipSetup, 500);