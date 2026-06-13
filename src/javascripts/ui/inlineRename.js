/* 行内重命名 —— 仿 macOS 蓝色可编辑标签
 *
 * 关键设计:只编辑「基名」,扩展名作为固定后缀显示在右侧、不可被打字干扰。
 * 这样彻底避免「基名选中 + 用户键入完整名」导致的后缀重复/错位
 * (例:输入 1.md 不再变成 1.md.md / md.1)。
 *
 *   [  基名(可编辑,默认全选)  ].md(固定灰色后缀)
 *
 * labelEl       : 当前显示文件名的元素(桌面 <p> / 访达 <span>)
 * opts.initial  : 初始全名(含扩展名)
 * opts.isDir    : 是否文件夹(文件夹不拆扩展名,整体可编辑)
 * opts.onCommit : async (newName) => {}   提交新全名(失败请自行提示)
 * opts.onCancel : () => {}                取消/未改动
 */
export function startInlineRename(labelEl, { initial, isDir = false, onCommit, onCancel } = {}) {
    if (!labelEl || labelEl.dataset.renaming === "1") return;
    labelEl.dataset.renaming = "1";

    // 拆分基名 / 扩展名;文件夹或前导点(隐藏文件如 .md)不拆,整体当基名
    const dot = initial.lastIndexOf(".");
    const hasExt = !isDir && dot > 0;
    const base = hasExt ? initial.slice(0, dot) : initial;
    const ext = hasExt ? initial.slice(dot) : ""; // 含点,如 ".md"

    const wrap = document.createElement("span");
    wrap.className = "inline-rename";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "inline-rename-base";
    input.value = base;
    input.spellcheck = false;
    input.autocomplete = "off";
    const autosize = () => { input.size = Math.max(1, input.value.length); };
    autosize();
    input.addEventListener("input", autosize);
    wrap.appendChild(input);

    if (ext) {
        const extEl = document.createElement("span");
        extEl.className = "inline-rename-ext";
        extEl.textContent = ext;
        // 点击后缀不抢焦点,避免误触发提交
        extEl.addEventListener("mousedown", e => e.preventDefault());
        wrap.appendChild(extEl);
    }

    labelEl.style.display = "none";
    labelEl.insertAdjacentElement("afterend", wrap);
    input.focus();
    input.select(); // 默认全选基名(扩展名不在可编辑区)

    // 组合最终全名:基名 + 扩展名;若用户已自带该扩展名则不重复
    const finalName = () => {
        const b = input.value.trim();
        if (!b) return null; // 基名为空 → 视为取消,避免产生「.md」这类空基名文件
        if (ext && b.toLowerCase().endsWith(ext.toLowerCase())) return b;
        return b + ext;
    };

    let settled = false;
    const cleanup = () => {
        wrap.remove();
        labelEl.style.display = "";
        delete labelEl.dataset.renaming;
    };
    const commit = async () => {
        if (settled) return;
        settled = true;
        const name = finalName();
        cleanup();
        if (!name || name === initial) { onCancel && onCancel(); return; }
        if (onCommit) await onCommit(name);
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
        wrap.addEventListener(ev, e => e.stopPropagation()));
    input.addEventListener("blur", commit);
}

export default startInlineRename;
