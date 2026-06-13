/* 壁纸 App —— 移植自 gianlucajahn/macOS-react 的 WallpaperMenu(MIT)。
 * 「Dynamic Wallpapers」暗色网格:左侧当前大预览 + 右侧缩略图网格,
 * 点击即把桌面背景(body > div.wallpaper)换成真实 macOS 壁纸,localStorage 持久化。
 * 壁纸图片来自 macOS-react(assets/images/wallpapers/),致谢见 README。
 */

const STORAGE_KEY = "webintosh.wallpaper";
const DIR = "./assets/images/wallpapers/";

// 数据与顺序照搬 macOS-react: src/utils/helpers/wallpapers.ts
const WALLPAPERS = [
    // 项目自带的原始壁纸(桌面默认就是 Sequoia / Wallpaper.png)——之前漏了,补回
    { surname: "sequoia", name: "Sequoia", file: "./assets/images/Wallpaper.png", thumb: "./assets/images/Wallpaper.png" },
    { surname: "sequoia-day", name: "Sequoia 日出", file: "./assets/images/sequoia.shape.day.jpg", thumb: "./assets/images/sequoia.shape.day.jpg" },
    { surname: "sequoia-night", name: "Sequoia 夜晚", file: "./assets/images/sequoia.shape.night.jpg", thumb: "./assets/images/sequoia.shape.night.jpg" },
    { surname: "ventura", name: "Ventura" },
    { surname: "monterey", name: "Monterey" },
    { surname: "bigsurgraphic", name: "Big Sur Graphic" },
    { surname: "bigsur", name: "Big sur" },
    { surname: "catalina", name: "Catalina" },
    { surname: "mojave", name: "Mojave" },
    { surname: "thedesert", name: "The Desert" },
    { surname: "dome", name: "Dome" },
    { surname: "peak", name: "Peak" },
    { surname: "iridescence", name: "Iridescence" },
    { surname: "lake", name: "Lake" },
    { surname: "solargrad", name: "Solar Grad" },
];

// 支持 file/thumb 覆盖(用于项目自带的原始壁纸,如 Sequoia 默认壁纸)
const fullSrc = w => w.file || (DIR + w.surname + ".jpg");
const previewSrc = w => w.thumb || (DIR + "preview_" + w.surname + ".jpg");
// 原版:Catalina 的大预览用 catalina_day.jpg
const heroSrc = w => w.file || (w.surname === "catalina" ? DIR + "catalina_day.jpg" : fullSrc(w));

/* 实时把桌面背景换掉(平滑淡入),并持久化 */
export function applyWallpaper(item, { persist = true } = {}) {
    const el = document.querySelector("body > div.wallpaper");
    if (el) {
        if (!el.style.transition) el.style.transition = "opacity 0.45s ease";
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
        el.style.backgroundRepeat = "no-repeat";
        el.style.opacity = "0";
        window.setTimeout(() => {
            el.style.backgroundImage = `url("${item.src}")`;
            el.style.opacity = "1";
        }, 180);
    }
    if (persist) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ type: "image", value: item.src, name: item.name, surname: item.surname }));
        } catch (e) { /* 忽略 */ }
    }
    markSelected(item.surname);
    updateHero(item);
}

/* 开机/打开时读取已存壁纸并应用 */
export function applySavedWallpaper() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (e) { saved = null; }
    if (!saved || !saved.value) return false;
    applyWallpaper({ src: saved.value, name: saved.name || "", surname: saved.surname || "" }, { persist: false });
    return true;
}

function savedSurname() {
    try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); return s && s.surname; }
    catch (e) { return null; }
}

function updateHero(item) {
    const win = document.getElementById("壁纸");
    if (!win) return;
    const img = win.querySelector(".wp-current");
    const name = win.querySelector(".wp-current-name");
    if (img && item.surname) { const w = WALLPAPERS.find(x => x.surname === item.surname); img.src = w ? heroSrc(w) : (item.src || img.src); }
    if (name) name.textContent = item.name || "";
}

function markSelected(surname) {
    const win = document.getElementById("壁纸");
    if (!win) return;
    win.querySelectorAll(".wp-item.selected").forEach(el => el.classList.remove("selected"));
    const it = win.querySelector(`.wp-item[data-surname="${surname}"]`);
    if (it) it.classList.add("selected");
}

function render() {
    const win = document.getElementById("壁纸");
    if (!win || win.dataset.bound === "1") return;
    const grid = win.querySelector(".wp-grid");
    if (!grid) return;
    win.dataset.bound = "1";

    grid.innerHTML = "";
    const sel = savedSurname() || "sequoia";
    WALLPAPERS.forEach(w => {
        const cell = document.createElement("div");
        cell.className = "wp-item" + (w.surname === sel ? " selected" : "");
        cell.dataset.surname = w.surname;

        const img = document.createElement("img");
        img.className = "wp-thumb";
        img.alt = w.name;
        img.draggable = false;
        img.src = previewSrc(w);
        // preview 缺失时回退到主图
        img.addEventListener("error", () => { if (img.src.indexOf("preview_") !== -1) img.src = fullSrc(w); }, { once: true });

        const label = document.createElement("p");
        label.className = "wp-name";
        label.textContent = w.name;

        cell.appendChild(img);
        cell.appendChild(label);
        cell.addEventListener("click", () => applyWallpaper({ src: fullSrc(w), name: w.name, surname: w.surname }));
        grid.appendChild(cell);
    });

    // 初始化左侧大预览为当前选中
    const cur = WALLPAPERS.find(w => w.surname === sel) || WALLPAPERS[0];
    updateHero(cur);
}

render();
export default applyWallpaper;
