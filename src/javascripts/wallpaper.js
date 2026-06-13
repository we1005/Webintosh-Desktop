// 开机即执行：读取并应用已保存的桌面壁纸。
// 复用 壁纸 App 模块的 applySavedWallpaper()，避免逻辑重复。
// 集成方式（由维护者接线）：在 index.html 的 <script type="module"> 中加一行
//   import "./src/javascripts/wallpaper.js";
// 即可在开机时套用上次选择的壁纸；本文件不修改任何共享文件。

import { applySavedWallpaper } from "./apps/壁纸.js";

function boot() {
    applySavedWallpaper();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
    boot();
}
