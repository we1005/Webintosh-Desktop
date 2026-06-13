// 壁纸 App —— 网格展示可选桌面壁纸，点击实时切换并持久化。
// 桌面背景钩子：index.html 中的 <div class="wallpaper">（body > div.wallpaper）。
// 持久化 key：webintosh.wallpaper（存 JSON：{ type, value, name }）。

const STORAGE_KEY = "webintosh.wallpaper";

// 已存在于 assets/images/ 的真实壁纸图。
const IMAGE_WALLPAPERS = [
    { name: "Sequoia", value: "./assets/images/Wallpaper.png" },
    { name: "红杉日出", value: "./assets/images/sequoia.shape.day.jpg" },
    { name: "红杉夜色", value: "./assets/images/sequoia.shape.night.jpg" },
];

// 纯 CSS 渐变 / 纯色（不下载外网大图）。value 为合法 background 值。
const GRADIENT_WALLPAPERS = [
    { name: "晨曦", value: "linear-gradient(135deg, #ff9a9e 0%, #fad0c4 50%, #fbc2eb 100%)" },
    { name: "深海", value: "linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" },
    { name: "极光", value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
    { name: "暮色", value: "linear-gradient(160deg, #654ea3 0%, #eaafc8 100%)" },
    { name: "薄荷", value: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
    { name: "石墨", value: "linear-gradient(160deg, #232526 0%, #414345 100%)" },
    { name: "蓝", value: "./assets/images/backgrounds/bg.blue.svg" },
    { name: "石板", value: "./assets/images/backgrounds/bg.gray.dark.svg" },
];

function isImageRef(value) {
    return /^\.?\//.test(value) || /\.(png|jpe?g|webp|svg|gif)$/i.test(value);
}

// 把一个 wallpaper 描述转成 CSS background-image 的值。
function toBackgroundImage(item) {
    if (item.type === "image" || isImageRef(item.value)) {
        return `url("${item.value}")`;
    }
    return item.value; // 渐变直接作为 background-image
}

// 实时把桌面背景换掉，带平滑过渡。
export function applyWallpaper(item, { persist = true } = {}) {
    const el = document.querySelector("body > div.wallpaper");
    if (!el) return;

    // 不修改 main.css：在元素上就地补一条过渡，首帧不闪。
    if (!el.style.transition) {
        el.style.transition = "opacity 0.45s ease, background-image 0.45s ease";
    }
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.style.backgroundRepeat = "no-repeat";

    // 淡出 -> 换图 -> 淡入，渐变/图片都适用。
    el.style.opacity = "0";
    window.setTimeout(() => {
        el.style.backgroundImage = toBackgroundImage(item);
        el.style.opacity = "1";
    }, 200);

    if (persist) {
        const payload = {
            type: item.type || (isImageRef(item.value) ? "image" : "gradient"),
            value: item.value,
            name: item.name || "",
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {
            /* localStorage 不可用时静默降级 */
        }
    }

    updatePreview(item);
}

// 开机/打开时读取已保存壁纸并应用。可被外部（如开机脚本）调用。
export function applySavedWallpaper() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
        saved = null;
    }
    if (!saved || !saved.value) return false;
    applyWallpaper(saved, { persist: false });
    return true;
}

function getSavedValue() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        return saved && saved.value;
    } catch (e) {
        return null;
    }
}

function updatePreview(item) {
    const preview = document.getElementById("wallpaper-preview");
    const nameEl = document.getElementById("wallpaper-name");
    if (preview) {
        preview.style.backgroundImage = toBackgroundImage(item);
    }
    if (nameEl) {
        nameEl.textContent = item.name || "自定壁纸";
    }
}

function makeTile(item, type, savedValue) {
    const tile = document.createElement("div");
    tile.className = "tile";
    if (item.value === savedValue) tile.classList.add("active");

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.style.backgroundImage = toBackgroundImage(item);

    const label = document.createElement("p");
    label.className = "label";
    label.textContent = item.name;

    tile.appendChild(thumb);
    tile.appendChild(label);

    tile.addEventListener("click", () => {
        const win = tile.closest(".wallpaperapp");
        if (win) {
            win.querySelectorAll(".tile.active").forEach((t) => t.classList.remove("active"));
        }
        tile.classList.add("active");
        applyWallpaper({ ...item, type });
    });

    return tile;
}

function render() {
    const imagesGrid = document.getElementById("wallpaper-grid-images");
    const gradientsGrid = document.getElementById("wallpaper-grid-gradients");
    if (!imagesGrid || !gradientsGrid) return;

    // 重新打开窗口时清空旧节点，避免重复。
    imagesGrid.innerHTML = "";
    gradientsGrid.innerHTML = "";

    const savedValue = getSavedValue();

    IMAGE_WALLPAPERS.forEach((item) => {
        imagesGrid.appendChild(makeTile(item, "image", savedValue));
    });
    GRADIENT_WALLPAPERS.forEach((item) => {
        gradientsGrid.appendChild(makeTile(item, "gradient", savedValue));
    });

    // 预览区显示当前壁纸。
    const current =
        IMAGE_WALLPAPERS.concat(GRADIENT_WALLPAPERS).find((i) => i.value === savedValue) ||
        IMAGE_WALLPAPERS[0];
    updatePreview(current);
}

render();
