/* 备忘录 —— macOS Notes 风格，纯前端 localStorage 持久化 */
import { bringToFront } from "../window.js";

(() => {
    const win = document.getElementById("备忘录") || document.querySelector(".notesapp.window");
    if (!win || win.dataset.bound === "1") return;
    win.dataset.bound = "1";

    const STORE_KEY = "webintosh.notes";

    const listEl = win.querySelector(".note-list");
    const editor = win.querySelector(".editor");
    const metaDate = win.querySelector(".meta-date");
    const newBtn = win.querySelector(".new-btn");
    const deleteBtn = win.querySelector(".delete-btn");

    /* ---------- 生命周期：窗口被移除时解绑/落盘 ---------- */
    const mo = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            flush();
            mo.disconnect();
        }
    });
    mo.observe(document.body, { childList: true });

    /* ---------- 状态 ---------- */
    let notes = load();
    let activeId = null;
    let saveTimer = null;

    function load() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function persist() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(notes));
        } catch (e) {
            console.warn("[备忘录] 保存失败:", e);
        }
    }

    function uid() {
        return "n_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function fmtTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        if (sameDay) {
            return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        }
        const yest = new Date(now);
        yest.setDate(now.getDate() - 1);
        if (d.toDateString() === yest.toDateString()) return "昨天";
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    }

    function fmtFullDate(ts) {
        const d = new Date(ts);
        return d.toLocaleString("zh-CN", {
            year: "numeric", month: "long", day: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    }

    function titleOf(note) {
        const first = (note.text || "").split("\n")[0].trim();
        return first || "新建备忘录";
    }

    function previewOf(note) {
        const lines = (note.text || "").split("\n");
        const rest = lines.slice(1).join(" ").trim();
        return rest || "没有其他文本";
    }

    function active() {
        return notes.find(n => n.id === activeId) || null;
    }

    /* ---------- 渲染 ---------- */
    function renderList() {
        notes.sort((a, b) => b.updatedAt - a.updatedAt);
        listEl.innerHTML = "";
        for (const note of notes) {
            const item = document.createElement("div");
            item.className = "note-item" + (note.id === activeId ? " active" : "");
            item.dataset.id = note.id;

            const t = document.createElement("div");
            t.className = "note-title";
            t.textContent = titleOf(note);

            const sub = document.createElement("div");
            sub.className = "note-sub";
            const time = document.createElement("span");
            time.className = "note-time";
            time.textContent = fmtTime(note.updatedAt);
            const prev = document.createElement("span");
            prev.className = "note-preview";
            prev.textContent = previewOf(note);
            sub.appendChild(time);
            sub.appendChild(prev);

            item.appendChild(t);
            item.appendChild(sub);
            listEl.appendChild(item);
        }
    }

    function renderEditor() {
        const note = active();
        if (note) {
            win.classList.add("has-active");
            if (editor.textContent !== note.text) editor.textContent = note.text;
            metaDate.textContent = fmtFullDate(note.updatedAt);
        } else {
            win.classList.remove("has-active");
            editor.textContent = "";
            metaDate.textContent = "";
        }
    }

    function selectNote(id) {
        flush();
        activeId = id;
        renderList();
        renderEditor();
        if (active()) {
            editor.focus();
            placeCaretEnd();
        }
    }

    function placeCaretEnd() {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    /* ---------- 操作 ---------- */
    function createNote() {
        flush();
        const note = { id: uid(), text: "", createdAt: Date.now(), updatedAt: Date.now() };
        notes.unshift(note);
        activeId = note.id;
        persist();
        renderList();
        renderEditor();
        editor.focus();
    }

    function deleteNote() {
        const note = active();
        if (!note) return;
        notes = notes.filter(n => n.id !== note.id);
        activeId = notes.length ? notes[0].id : null;
        persist();
        renderList();
        renderEditor();
    }

    // 把编辑区内容写回当前笔记并落盘（用于失焦/关闭）
    function flush() {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        const note = active();
        if (!note) return;
        const text = editor.innerText.replace(/ /g, " ");
        if (text !== note.text) {
            note.text = text;
            note.updatedAt = Date.now();
            persist();
        }
    }

    function onInput() {
        const note = active();
        if (!note) return;
        note.text = editor.innerText.replace(/ /g, " ");
        note.updatedAt = Date.now();
        // 实时更新列表标题/预览，但防抖落盘避免高频写入
        renderList();
        metaDate.textContent = fmtFullDate(note.updatedAt);
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(persist, 400);
    }

    /* ---------- 事件接线 ---------- */
    // 阻止主体交互触发窗口拖拽，并置顶
    [listEl, editor, newBtn, deleteBtn].forEach(el => {
        el.addEventListener("mousedown", e => {
            e.stopPropagation();
            bringToFront(win, "备忘录");
        });
    });

    listEl.addEventListener("click", e => {
        const item = e.target.closest(".note-item");
        if (!item) return;
        if (item.dataset.id !== activeId) selectNote(item.dataset.id);
    });

    editor.addEventListener("input", onInput);
    editor.addEventListener("blur", flush);
    newBtn.addEventListener("click", createNote);
    deleteBtn.addEventListener("click", deleteNote);

    /* ---------- 启动 ---------- */
    if (notes.length) {
        activeId = notes.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
    }
    renderList();
    renderEditor();
})();
