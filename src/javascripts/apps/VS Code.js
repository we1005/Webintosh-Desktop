// VS Code —— 全屏 iframe 内嵌 StackBlitz Web 编辑器（VS Code 同款 Monaco 内核 UI），
// 直接打开本项目仓库 we1005/Webintosh-Desktop（在 OS 里看 OS 自己的源码）。
// 说明：原先用的 github1s.com 已废弃（iframe 能加载但编辑器永远卡 loading），
// 改用 StackBlitz embed（实测无 X-Frame-Options，可嵌套且能真正打开/运行 GitHub 仓库）。
// 15s 内未触发 onLoad / 被 CSP/X-Frame 拦截时显示兜底 CTA（在新标签打开）。
(() => {
    const win = document.getElementById("VS Code") || document.querySelector(".vscodeapp.window");
    if (!win || win.dataset.bound === "1") return;
    win.dataset.bound = "1";

    const EDITOR_SRC = "https://stackblitz.com/github/we1005/Webintosh-Desktop?embed=1&view=editor&theme=dark&file=index.html";

    /* ---------- 生命周期：窗口移除时清理 ---------- */
    const ac = new AbortController();
    let timer = null;
    const mo = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            ac.abort();
            if (timer) clearTimeout(timer);
            mo.disconnect();
        }
    });
    mo.observe(document.body, { childList: true });
    const on = (el, ev, fn) => el && el.addEventListener(ev, fn, { signal: ac.signal });

    const frame = win.querySelector(".vscode-frame");
    const loadingEl = win.querySelector('[data-state="loading"]');
    const blockedEl = win.querySelector('[data-state="blocked"]');
    const openBtn = win.querySelector(".vscode-open-btn");

    let loading = true;
    let blocked = false;

    function syncView() {
        if (loadingEl) loadingEl.hidden = !(loading && !blocked);
        if (blockedEl) blockedEl.hidden = !blocked;
        if (frame) frame.style.visibility = blocked ? "hidden" : "visible";
    }

    // iframe 成功加载：关闭 loading 与 blocked
    on(frame, "load", () => {
        loading = false;
        blocked = false;
        syncView();
    });

    // 15s 内仍未加载完成 → 视为被宿主拦截，显示兜底（StackBlitz 克隆仓库较慢，留足时间）
    timer = setTimeout(() => {
        if (loading) {
            blocked = true;
            syncView();
        }
    }, 15000);

    // 兜底 CTA：在新标签打开同一 URL
    on(openBtn, "click", () => {
        window.open(EDITOR_SRC, "_blank", "noopener,noreferrer");
    });

    syncView();
})();
