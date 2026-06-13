// VS Code —— 源级移植 thanas-os TechnologiesApp.tsx（原生 JS）
// 全屏 iframe 内嵌 github1s（VS Code 网页版）+ loading spinner +
// 6s 内未触发 onLoad / 被 CSP/X-Frame 拦截时显示兜底 CTA（在新标签打开）。
(() => {
    const win = document.getElementById("VS Code") || document.querySelector(".vscodeapp.window");
    if (!win || win.dataset.bound === "1") return;
    win.dataset.bound = "1";

    const EDITOR_SRC = "https://github1s.com/microsoft/vscode";

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

    // 6s 内仍未加载完成 → 视为被宿主拦截，显示兜底
    timer = setTimeout(() => {
        if (loading) {
            blocked = true;
            syncView();
        }
    }, 6000);

    // 兜底 CTA：在新标签打开同一 URL
    on(openBtn, "click", () => {
        window.open(EDITOR_SRC, "_blank", "noopener,noreferrer");
    });

    syncView();
})();
