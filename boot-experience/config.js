/* ============================================================
 * Webintosh 开机体验配置
 * 改这里即可调整开机主题，无需改其它代码。
 * ============================================================ */
window.BOOT_CONFIG = {
    // 开机主题：
    //   "black"  —— 黑色开机背景（Apple Silicon / 新机型风格，默认）
    //   "gray"   —— 浅灰开机背景（部分 Intel Mac 风格）
    //   "random" —— 每次随机二选一
    theme: "black",
};

/* 解析最终主题：URL 参数 ?theme= 可临时覆盖配置（如 ?theme=gray）。
   返回 "black" | "gray"。 */
window.resolveBootTheme = function () {
    const cfg = (window.BOOT_CONFIG && window.BOOT_CONFIG.theme) || "black";
    const override = new URLSearchParams(location.search).get("theme");
    let theme = override || cfg;
    if (theme === "random") theme = Math.random() <= 0.5 ? "gray" : "black";
    return theme === "gray" ? "gray" : "black";   // 兜底：未知值一律黑色
};
