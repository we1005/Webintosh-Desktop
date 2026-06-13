/* 访达 —— 对接 VFS 的真实文件管理器 */
import vfs, { joinPath, dirname, basename, normPath } from "../../../os/vfs.js";
import { createContextMenu } from "../ui/contextMenu.js";
import { startInlineRename } from "../ui/inlineRename.js";
import { bringToFront } from "../window.js";

(() => {
    const win = document.getElementById("访达") || document.querySelector(".finder.window");
    if (!win || win.dataset.vfsBound === "1") return;
    win.dataset.vfsBound = "1";

    const content = win.querySelector(".main-content");
    const titleEl = win.querySelector(".toolbar .title");
    const breadcrumbEl = win.querySelector(".toolbar .breadcrumb");
    const backBtn = win.querySelector(".nav-back");
    const forwardBtn = win.querySelector(".nav-forward");
    const statusEl = win.querySelector(".statusbar .status-text");
    const sidebarItems = win.querySelectorAll(".sidebar-list .item[data-path]");

    const TEXT_EXT = ["txt", "md", "js", "mjs", "json", "css", "html", "htm", "xml", "yml", "yaml", "csv", "log", "sh", "py", "ts"];
    const isTextFile = name => TEXT_EXT.includes((name.split(".").pop() || "").toLowerCase());

    const SIDEBAR_NAMES = {
        "/Desktop": "桌面", "/Documents": "文稿", "/Downloads": "下载",
        "/Music": "音乐", "/Pictures": "图片", "/Applications": "应用程序",
    };

    /* ---------- 生命周期：窗口被移除时解绑全局监听 ---------- */
    const ac = new AbortController();
    const mo = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            ac.abort();
            mo.disconnect();
        }
    });
    mo.observe(document.body, { childList: true });

    /* ---------- 导航状态 ---------- */
    let history = [];
    let historyIndex = -1;
    let currentPath = "/Desktop";

    function updateNavButtons() {
        backBtn.disabled = historyIndex <= 0;
        forwardBtn.disabled = historyIndex >= history.length - 1;
    }

    function navigate(path, { pushHistory = true } = {}) {
        path = normPath(path);
        if (pushHistory) {
            history = history.slice(0, historyIndex + 1);
            history.push(path);
            historyIndex = history.length - 1;
        }
        currentPath = path;
        updateNavButtons();
        renderSidebarActive();
        renderBreadcrumb();
        refresh();
    }

    backBtn.addEventListener("click", () => {
        if (historyIndex > 0) {
            historyIndex -= 1;
            navigate(history[historyIndex], { pushHistory: false });
        }
    });
    forwardBtn.addEventListener("click", () => {
        if (historyIndex < history.length - 1) {
            historyIndex += 1;
            navigate(history[historyIndex], { pushHistory: false });
        }
    });

    /* ---------- 侧边栏 ---------- */
    function renderSidebarActive() {
        sidebarItems.forEach(it => {
            it.classList.toggle("active", it.dataset.path === currentPath);
        });
    }
    sidebarItems.forEach(it => {
        it.addEventListener("mousedown", e => {
            e.stopPropagation();
            bringToFront(win, "访达");
        });
        it.addEventListener("click", () => navigate(it.dataset.path));
    });

    /* ---------- 面包屑 ---------- */
    function renderBreadcrumb() {
        titleEl.textContent = currentPath === "/"
            ? "Macintosh HD"
            : (SIDEBAR_NAMES[currentPath] || basename(currentPath));

        breadcrumbEl.innerHTML = "";
        const segs = currentPath.split("/").filter(Boolean);
        const addCrumb = (label, path, isCurrent) => {
            const c = document.createElement("span");
            c.className = "crumb" + (isCurrent ? " current" : "");
            c.textContent = label;
            if (!isCurrent) c.addEventListener("click", () => navigate(path));
            breadcrumbEl.appendChild(c);
        };
        addCrumb("Macintosh HD", "/", segs.length === 0);
        let acc = "";
        segs.forEach((seg, i) => {
            const sep = document.createElement("span");
            sep.className = "crumb-sep";
            sep.textContent = "›";
            breadcrumbEl.appendChild(sep);
            acc += "/" + seg;
            addCrumb(seg, acc, i === segs.length - 1);
        });
    }

    /* ---------- 打开文件 ---------- */
    function openInTextEdit(path) {
        if (document.getElementById("文本编辑")) {
            document.dispatchEvent(new CustomEvent("textedit-open", { detail: path }));
            window.moduleItems.create("./assets/apps/文本编辑.html", "文本编辑"); // 已存在时仅置顶
        } else {
            window.__openFile = path;
            window.moduleItems.create("./assets/apps/文本编辑.html", "文本编辑");
        }
    }
    // .md 用 Typora(Vditor 即时渲染)打开
    function openInMarkdown(path) {
        if (document.getElementById("Typora")) {
            document.dispatchEvent(new CustomEvent("markdown-open", { detail: path }));
            window.moduleItems.create("./assets/apps/Typora.html", "Typora");
        } else {
            window.__openFile = path;
            window.moduleItems.create("./assets/apps/Typora.html", "Typora");
        }
    }
    function openEntry(entry, path) {
        if (entry.kind === "dir") navigate(path);
        else if (/\.md$/i.test(entry.name)) openInMarkdown(path);
        else if (isTextFile(entry.name)) openInTextEdit(path);
    }

    /* ---------- 主区渲染 ---------- */
    function clearSelection() {
        content.querySelectorAll(".file-item.selected").forEach(el => el.classList.remove("selected"));
    }

    async function uniqueName(base, ext = "") {
        const entries = await vfs.list(currentPath);
        const names = new Set(entries.map(e => e.name));
        let name = base + ext;
        for (let i = 2; names.has(name); i++) name = `${base} ${i}${ext}`;
        return name;
    }

    function itemMenu(e, entry, path, fileItem) {
        e.preventDefault();
        e.stopPropagation();
        clearSelection();
        fileItem.classList.add("selected");
        createContextMenu(e.clientX, e.clientY, [
            { label: "打开", action: () => openEntry(entry, path) },
            { type: "separator" },
            {
                label: "重命名", action: () => {
                    const labelEl = fileItem.querySelector("span");
                    startInlineRename(labelEl, {
                        initial: entry.name,
                        isDir: entry.kind === "dir",
                        onCommit: async (newName) => {
                            try { await vfs.rename(path, newName); }
                            catch (err) { alert("重命名失败: " + err.message); }
                        },
                    });
                }
            },
            { type: "separator" },
            {
                label: "移到废纸篓", action: async () => {
                    try { await vfs.rm(path); }
                    catch (err) { alert("删除失败: " + err.message); }
                }
            },
        ]);
    }

    let refreshSeq = 0;
    async function refresh() {
        const seq = ++refreshSeq;
        let entries;
        try {
            entries = await vfs.list(currentPath);
        } catch (err) {
            // 目录可能已被删除，回退到父目录
            if (currentPath !== "/") { navigate(dirname(currentPath)); return; }
            entries = [];
        }
        if (seq !== refreshSeq || !document.body.contains(win)) return;

        entries.sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
            return a.name.localeCompare(b.name, "zh-Hans-CN");
        });

        content.innerHTML = "";
        if (entries.length === 0) {
            const tip = document.createElement("div");
            tip.className = "empty-tip";
            tip.textContent = "此文件夹为空";
            content.appendChild(tip);
        }
        for (const entry of entries) {
            const path = joinPath(currentPath, entry.name);
            const fileItem = document.createElement("div");
            fileItem.className = "file-item";

            const icon = document.createElement("img");
            icon.src = entry.kind === "dir"
                ? "./assets/images/Folder.png"
                : /\.md$/i.test(entry.name)
                    ? "./assets/icons/markdown文件.svg"  // Markdown 文件专用图标
                    : /\.txt$/i.test(entry.name)
                        ? "./assets/icons/文本文件.svg"
                        : "./assets/images/GenericDocumentIcon.png";
            icon.draggable = false;

            const label = document.createElement("span");
            label.textContent = entry.name;

            fileItem.appendChild(icon);
            fileItem.appendChild(label);

            fileItem.addEventListener("mousedown", e => {
                e.stopPropagation();
                bringToFront(win, "访达");
                clearSelection();
                fileItem.classList.add("selected");
            });
            fileItem.addEventListener("dblclick", e => {
                e.stopPropagation();
                openEntry(entry, path);
            });
            fileItem.addEventListener("contextmenu", e => itemMenu(e, entry, path, fileItem));

            content.appendChild(fileItem);
        }
        statusEl.textContent = `${entries.length} 个项目, 后端: ${vfs.backendName}`;
    }

    /* ---------- 空白处交互 ---------- */
    content.addEventListener("mousedown", e => {
        if (e.target === content || e.target.classList.contains("empty-tip")) {
            e.stopPropagation();
            clearSelection();
        }
    });
    content.addEventListener("contextmenu", e => {
        if (e.target !== content && !e.target.classList.contains("empty-tip")) return;
        e.preventDefault();
        e.stopPropagation();
        createContextMenu(e.clientX, e.clientY, [
            {
                label: "新建文件夹", action: async () => {
                    try { await vfs.mkdir(joinPath(currentPath, await uniqueName("未命名文件夹"))); }
                    catch (err) { alert("新建文件夹失败: " + err.message); }
                }
            },
            {
                label: "新建文本文件", action: async () => {
                    try { await vfs.writeText(joinPath(currentPath, await uniqueName("未命名", ".txt")), ""); }
                    catch (err) { alert("新建文件失败: " + err.message); }
                }
            },
            {
                label: "新建 Markdown 文档", action: async () => {
                    try { await vfs.writeText(joinPath(currentPath, await uniqueName("未命名", ".md")), ""); }
                    catch (err) { alert("新建文件失败: " + err.message); }
                }
            },
            { type: "separator" },
            { label: "显示简介", disabled: true },
        ]);
    });

    /* ---------- 全局事件（窗口移除时自动解绑） ---------- */
    vfs.addEventListener("change", e => {
        const p = e.detail && e.detail.path;
        if (p === "/" || p === currentPath || currentPath.startsWith(p + "/") || (p && p.startsWith(currentPath + "/"))) {
            refresh();
        }
    }, { signal: ac.signal });

    // 桌面/其他模块请求访达定位到某目录
    document.addEventListener("finder-open", e => {
        if (typeof e.detail === "string") navigate(e.detail);
    }, { signal: ac.signal });

    /* ---------- 启动 ---------- */
    const startPath = (typeof window.__finderPath === "string" && window.__finderPath) || "/Desktop";
    window.__finderPath = null;
    navigate(startPath);
})();
