/* ============================================================
 * Webintosh OS — 桌面文件持久化（desktop-sync）
 *
 * 把 VFS 中 /Desktop 目录的内容渲染为桌面图标，并监听 vfs
 * 'change' 事件自动重渲染。由 index.html 挂载：
 *   import { initDesktopFiles } from "./os/desktop-sync.js";
 *   initDesktopFiles();
 * ============================================================ */

import vfs, { joinPath } from "./vfs.js";

const DESKTOP_DIR = "/Desktop";
const TEXT_EXT = ["txt", "md", "js", "mjs", "json", "css", "html", "htm", "xml", "yml", "yaml", "csv", "log", "sh", "py", "ts"];
const isTextFile = name => TEXT_EXT.includes((name.split(".").pop() || "").toLowerCase());

function openFinderAt(path) {
    if (document.getElementById("访达")) {
        document.dispatchEvent(new CustomEvent("finder-open", { detail: path }));
        if (window.moduleItems) window.moduleItems.create("./assets/apps/访达.html", "访达"); // 已打开时仅置顶
    } else {
        window.__finderPath = path;
        if (window.moduleItems) window.moduleItems.create("./assets/apps/访达.html", "访达");
    }
}

function openTextEdit(path) {
    // .md 路由到 Markdown 编辑器(Typora 风即时渲染),其余文本走文本编辑
    if (/\.md$/i.test(path)) {
        if (document.getElementById("Markdown")) {
            document.dispatchEvent(new CustomEvent("markdown-open", { detail: path }));
            if (window.moduleItems) window.moduleItems.create("./assets/apps/Markdown.html", "Markdown");
        } else {
            window.__openFile = path;
            if (window.moduleItems) window.moduleItems.create("./assets/apps/Markdown.html", "Markdown");
        }
        return;
    }
    if (document.getElementById("文本编辑")) {
        document.dispatchEvent(new CustomEvent("textedit-open", { detail: path }));
        if (window.moduleItems) window.moduleItems.create("./assets/apps/文本编辑.html", "文本编辑");
    } else {
        window.__openFile = path;
        if (window.moduleItems) window.moduleItems.create("./assets/apps/文本编辑.html", "文本编辑");
    }
}

export async function initDesktopFiles() {
    if (window.__desktopSyncInited) return;
    window.__desktopSyncInited = true;

    const container = document.querySelector(".desktop .container");
    if (!container) {
        console.warn("[desktop-sync] 找不到 .desktop .container，跳过桌面文件渲染");
        return;
    }

    let renderSeq = 0;
    async function render() {
        const seq = ++renderSeq;
        let entries = [];
        try {
            entries = await vfs.list(DESKTOP_DIR);
        } catch (err) {
            console.warn("[desktop-sync] 读取 /Desktop 失败:", err);
            return;
        }
        if (seq !== renderSeq) return; // 已有更新的渲染请求

        entries.sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
            return a.name.localeCompare(b.name, "zh-Hans-CN");
        });

        // 只管理本模块渲染的图标（带 data-vfs-path 标记）
        container.querySelectorAll("[data-vfs-path]").forEach(el => el.remove());

        for (const entry of entries) {
            const path = joinPath(DESKTOP_DIR, entry.name);
            const item = document.createElement("div");
            item.className = "item";
            item.dataset.vfsPath = path;

            const icon = document.createElement("img");
            icon.src = entry.kind === "dir"
                ? "./assets/images/Folder.png"
                : /\.md$/i.test(entry.name)
                    ? "./assets/icons/markdown文件.svg" // Markdown 文件专用图标
                    : /\.txt$/i.test(entry.name)
                        ? "./assets/icons/文本文件.svg" // 文本文件专用图标
                        : "./assets/images/GenericDocumentIcon.png";
            icon.draggable = false;

            const label = document.createElement("p");
            label.textContent = entry.name;

            item.appendChild(icon);
            item.appendChild(label);

            item.addEventListener("mousedown", e => {
                e.stopPropagation();
                document.querySelectorAll(".desktop .item.selected")
                    .forEach(el => el.classList.remove("selected"));
                item.classList.add("selected");
            });
            item.addEventListener("dblclick", e => {
                e.stopPropagation();
                if (entry.kind === "dir") openFinderAt(path);
                else if (isTextFile(entry.name)) openTextEdit(path);
            });

            container.appendChild(item);
        }
    }

    vfs.addEventListener("change", e => {
        const p = e.detail && e.detail.path;
        if (p === "/" || p === DESKTOP_DIR || (p && p.startsWith(DESKTOP_DIR + "/"))) {
            render();
        }
    });

    await render();
}

export default initDesktopFiles;
