/* 文本编辑 —— 基于 VFS 的纯文本编辑器（macOS TextEdit 风格） */
import vfs, { basename, dirname, normPath } from "../../../os/vfs.js";
import { bringToFront } from "../window.js";

(() => {
    const win = document.getElementById("文本编辑") || document.querySelector(".textedit.window");
    if (!win || win.dataset.vfsBound === "1") return;
    win.dataset.vfsBound = "1";

    const titleEl = win.querySelector(".doc-title");
    const pathSelect = win.querySelector(".path-select");
    const saveBtn = win.querySelector(".save-btn");
    const saveState = win.querySelector(".save-state");
    const editor = win.querySelector(".editor");

    /* ---------- 生命周期：窗口被移除时解绑全局监听 ---------- */
    const ac = new AbortController();
    const mo = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            ac.abort();
            mo.disconnect();
        }
    });
    mo.observe(document.body, { childList: true });

    /* ---------- 状态 ---------- */
    let currentPath = "/Documents/未命名.txt";
    let dirty = false;

    function renderTitle() {
        const name = basename(currentPath);
        titleEl.textContent = dirty ? `${name} — 已编辑` : name;
        saveState.textContent = dirty ? "未保存" : "";
    }

    function renderPathSelect() {
        pathSelect.innerHTML = "";
        const fileOpt = document.createElement("option");
        fileOpt.textContent = currentPath;
        fileOpt.selected = true;
        pathSelect.appendChild(fileOpt);
        // 祖先目录（仅展示，macOS 标题栏路径菜单风格）
        let p = dirname(currentPath);
        while (true) {
            const opt = document.createElement("option");
            opt.disabled = true;
            opt.textContent = p === "/" ? "/ (Macintosh HD)" : p;
            pathSelect.appendChild(opt);
            if (p === "/") break;
            p = dirname(p);
        }
    }

    function setDirty(v) {
        if (dirty === v) return;
        dirty = v;
        renderTitle();
    }

    async function uniqueUntitled() {
        let entries = [];
        try { entries = await vfs.list("/Documents"); } catch (e) { /* 目录缺失时由写入自动创建 */ }
        const names = new Set(entries.map(e => e.name));
        let name = "未命名.txt";
        for (let i = 2; names.has(name); i++) name = `未命名 ${i}.txt`;
        return "/Documents/" + name;
    }

    async function loadFile(path) {
        currentPath = normPath(path);
        let text = "";
        try {
            if ((await vfs.exists(currentPath)) === "file") {
                text = await vfs.readText(currentPath);
            }
        } catch (err) {
            console.warn("[文本编辑] 读取失败:", err);
        }
        editor.value = text;
        dirty = false;
        renderTitle();
        renderPathSelect();
        editor.focus();
    }

    async function save() {
        try {
            await vfs.writeText(currentPath, editor.value);
            setDirty(false);
            saveState.textContent = "已保存";
            setTimeout(() => { if (!dirty) saveState.textContent = ""; }, 1500);
        } catch (err) {
            alert("保存失败: " + err.message);
        }
    }

    /* ---------- 交互 ---------- */
    // 阻止编辑区/工具栏的 mousedown 触发窗口拖拽
    [editor, pathSelect, saveBtn].forEach(el => {
        el.addEventListener("mousedown", e => {
            e.stopPropagation();
            bringToFront(win, "文本编辑");
        });
    });

    editor.addEventListener("input", () => setDirty(true));
    saveBtn.addEventListener("click", save);

    win.addEventListener("keydown", e => {
        if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
            e.preventDefault();
            e.stopPropagation();
            save();
        }
    });

    // 其他模块请求打开文件
    document.addEventListener("textedit-open", e => {
        const path = e.detail;
        if (typeof path !== "string" || !path) return;
        if (normPath(path) === currentPath && !dirty) return;
        if (dirty && !confirm("当前文档有未保存的修改，确定放弃修改并打开新文件吗？")) return;
        loadFile(path);
    }, { signal: ac.signal });

    /* ---------- 启动 ---------- */
    (async () => {
        const requested = (typeof window.__openFile === "string" && window.__openFile) || null;
        window.__openFile = null;
        if (requested) {
            await loadFile(requested);
        } else {
            await loadFile(await uniqueUntitled());
        }
    })();
})();
