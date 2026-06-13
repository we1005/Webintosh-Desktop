/* 行内重命名 —— 仿 macOS 蓝色可编辑标签
 *
 * 用 <input> 原地替换文件名标签:
 *   - 预填全名,默认仅选中「基名」,保留扩展名不选(macOS Finder 行为)
 *   - Enter / 失焦 提交,Escape 取消
 *   - 提交统一交给 onCommit(写回 VFS),保证桌面与访达一致
 *
 * labelEl       : 当前显示文件名的元素(桌面 <p> / 访达 <span>)
 * opts.initial  : 初始全名(含扩展名)
 * opts.isDir    : 是否文件夹(文件夹不保留扩展名,全选)
 * opts.onCommit : async (newName) => {}   提交新名(失败请自行提示)
 * opts.onCancel : () => {}                取消/未改动
 */
export function startInlineRename(labelEl, { initial, isDir = false, onCommit, onCancel } = {}) {
    if (!labelEl || labelEl.dataset.renaming === "1") return;
    labelEl.dataset.renaming = "1";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "inline-rename";
    input.value = initial;
    input.spellcheck = false;
    input.autocomplete = "off";

    labelEl.style.display = "none";
    labelEl.insertAdjacentElement("afterend", input);
    input.focus();

    // 仅选中基名,保留扩展名不选;文件夹或无扩展名则全选
    const dot = initial.lastIndexOf(".");
    if (!isDir && dot > 0) input.setSelectionRange(0, dot);
    else input.select();

    let settled = false;
    const cleanup = () => {
        input.remove();
        labelEl.style.display = "";
        delete labelEl.dataset.renaming;
    };
    const commit = async () => {
        if (settled) return;
        settled = true;
        const v = input.value.trim();
        cleanup();
        if (!v || v === initial) { onCancel && onCancel(); return; }
        if (onCommit) await onCommit(v);
    };
    const cancel = () => {
        if (settled) return;
        settled = true;
        cleanup();
        onCancel && onCancel();
    };

    input.addEventListener("keydown", e => {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
    // 阻止冒泡:避免触发桌面/窗口的 mousedown 取消选中或拖拽
    ["mousedown", "click", "dblclick"].forEach(ev =>
        input.addEventListener(ev, e => e.stopPropagation()));
    input.addEventListener("blur", commit);
}

export default startInlineRename;
