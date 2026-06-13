/* GitHub —— 通用模板版个人主页，纯前端 mock，参考 thanas-os GitHubApp */
(() => {
    const win = document.getElementById("GitHub") || document.querySelector(".githubapp.window");
    if (!win || win.dataset.bound === "1") return;
    win.dataset.bound = "1";

    /* ---------- 生命周期：窗口移除时停止监听 ---------- */
    const ac = new AbortController();
    const mo = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            ac.abort();
            mo.disconnect();
        }
    });
    mo.observe(document.body, { childList: true });
    const on = (el, ev, fn) => el && el.addEventListener(ev, fn, { signal: ac.signal });

    /* ---------- 工具 ---------- */
    function escapeHTML(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    /* ---------- 示例数据（不冒充任何真实人物 / 真实仓库）---------- */
    const LANG_COLORS = {
        JavaScript: "#f1e05a",
        TypeScript: "#3178c6",
        Python: "#3572a5",
        CSS: "#563d7c",
        Go: "#00add8",
        Rust: "#dea584"
    };

    const PINNED = [
        { name: "webintosh-desktop", desc: "A web-based desktop environment inspired by macOS. 网页桌面操作系统体验。", lang: "JavaScript", stars: 156 },
        { name: "pixel-notes", desc: "Tiny markdown notebook that lives in your browser. 浏览器内的轻量笔记本。", lang: "TypeScript", stars: 64 },
        { name: "heatmap-kit", desc: "Generate contribution-style heatmaps with zero dependencies.", lang: "CSS", stars: 41 },
        { name: "async-toolbox", desc: "Helpers for promises, queues and rate limiting in plain JS.", lang: "JavaScript", stars: 88 },
        { name: "tiny-router", desc: "A 1KB hash router for single page demos and prototypes.", lang: "Python", stars: 23 },
        { name: "glyph-icons", desc: "Hand-drawn inline SVG icon set for small side projects.", lang: "Go", stars: 37 }
    ];

    const REPOS = [
        { name: "webintosh-desktop", desc: "A web-based desktop environment inspired by macOS.", lang: "JavaScript", stars: 156, updated: "Updated 2 days ago" },
        { name: "async-toolbox", desc: "Helpers for promises, queues and rate limiting in plain JS.", lang: "JavaScript", stars: 88, updated: "Updated last week" },
        { name: "pixel-notes", desc: "Tiny markdown notebook that lives in your browser.", lang: "TypeScript", stars: 64, updated: "Updated last week" },
        { name: "heatmap-kit", desc: "Generate contribution-style heatmaps with zero dependencies.", lang: "CSS", stars: 41, updated: "Updated 3 weeks ago" },
        { name: "glyph-icons", desc: "Hand-drawn inline SVG icon set for small side projects.", lang: "Go", stars: 37, updated: "Updated last month" },
        { name: "tiny-router", desc: "A 1KB hash router for single page demos and prototypes.", lang: "Python", stars: 23, updated: "Updated 2 months ago" }
    ];

    function langColor(lang) {
        return LANG_COLORS[lang] || "#959da5";
    }

    function starSvg() {
        return '<svg class="gh-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
            '<path fill="currentColor" d="M8 .25a.75.75 0 0 1 .67.42l1.94 3.93 4.34.63a.75.75 0 0 1 .42 1.28l-3.14 3.06.74 4.32a.75.75 0 0 1-1.09.79L8 12.85l-3.88 2.04a.75.75 0 0 1-1.09-.79l.74-4.32L.63 6.51a.75.75 0 0 1 .42-1.28l4.34-.63L7.33.67A.75.75 0 0 1 8 .25Z"/>' +
            '</svg>';
    }

    function repoSvg() {
        return '<svg class="gh-icon gh-repo-icon" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">' +
            '<path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75H4.5a1 1 0 0 0 0 2h9a.75.75 0 0 1 0 1.5h-9A2.5 2.5 0 0 1 2 14.5Zm2.5-1a1 1 0 0 0-1 1v9.05A2.5 2.5 0 0 1 4.5 11.5h8v-10Z"/>' +
            '</svg>';
    }

    /* ---------- 渲染：Pinned 卡片 ---------- */
    const pinnedEl = win.querySelector(".gh-pinned");
    if (pinnedEl) {
        pinnedEl.innerHTML = PINNED.map((r) =>
            '<article class="gh-card">' +
                '<div class="gh-card-head">' + repoSvg() +
                    '<span class="gh-card-name">' + escapeHTML(r.name) + '</span>' +
                    '<span class="gh-card-badge">Public</span>' +
                '</div>' +
                '<p class="gh-card-desc">' + escapeHTML(r.desc) + '</p>' +
                '<div class="gh-card-meta">' +
                    '<span class="gh-lang">' +
                        '<span class="gh-lang-dot" style="background:' + langColor(r.lang) + '"></span>' +
                        escapeHTML(r.lang) +
                    '</span>' +
                    '<span class="gh-card-stars">' + starSvg() + escapeHTML(String(r.stars)) + '</span>' +
                '</div>' +
            '</article>'
        ).join("");
    }

    /* ---------- 渲染：Repositories 列表 ---------- */
    const repoListEl = win.querySelector(".gh-repolist");
    if (repoListEl) {
        repoListEl.innerHTML = REPOS.map((r) =>
            '<article class="gh-repo-row">' +
                '<div class="gh-repo-top">' +
                    '<span class="gh-repo-name">' + escapeHTML(r.name) + '</span>' +
                    '<span class="gh-card-badge">Public</span>' +
                '</div>' +
                '<p class="gh-repo-desc">' + escapeHTML(r.desc) + '</p>' +
                '<div class="gh-repo-meta">' +
                    '<span class="gh-lang">' +
                        '<span class="gh-lang-dot" style="background:' + langColor(r.lang) + '"></span>' +
                        escapeHTML(r.lang) +
                    '</span>' +
                    '<span class="gh-repo-stars">' + starSvg() + escapeHTML(String(r.stars)) + '</span>' +
                    '<span class="gh-repo-updated">' + escapeHTML(r.updated) + '</span>' +
                '</div>' +
            '</article>'
        ).join("");
    }

    /* ---------- 渲染：贡献热力图（7 行 × 20 列 mock）---------- */
    const heatGrid = win.querySelector(".gh-heatmap-grid");
    if (heatGrid) {
        const COLS = 20;
        const ROWS = 7;
        // 稳定的伪随机，保证每次渲染图样一致
        let seed = 1337;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        const total = COLS * ROWS;
        const frag = document.createDocumentFragment();
        for (let i = 0; i < total; i++) {
            const r = rand();
            let level = 0;
            if (r > 0.92) level = 4;
            else if (r > 0.78) level = 3;
            else if (r > 0.55) level = 2;
            else if (r > 0.30) level = 1;
            const cell = document.createElement("span");
            cell.className = "gh-cell l" + level;
            frag.appendChild(cell);
        }
        heatGrid.appendChild(frag);
    }

    /* ---------- 交互：Tab 纯视觉切换 ---------- */
    const tabs = win.querySelectorAll(".gh-tab");
    const panels = win.querySelectorAll(".gh-panel");
    tabs.forEach((tab) => {
        on(tab, "click", () => {
            const target = tab.dataset.tab;
            tabs.forEach((t) => t.classList.toggle("active", t === tab));
            panels.forEach((p) => {
                p.hidden = p.dataset.panel !== target;
            });
        });
    });
})();
