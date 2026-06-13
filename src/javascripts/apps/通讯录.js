/* 通讯录 —— macOS Contacts 风格，纯前端，localStorage 持久化 */
(() => {
    const win = document.getElementById("通讯录") || document.querySelector(".contactsapp.window");
    if (!win || win.dataset.contactsBound === "1") return;
    win.dataset.contactsBound = "1";

    const STORAGE_KEY = "webintosh.contacts";

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

    /* ---------- 示例数据 ---------- */
    const SEED = [
        { id: "c1", name: "陈思远", phone: "138 1234 5678", email: "siyuan.chen@example.com", note: "大学同学", group: "个人" },
        { id: "c2", name: "李梦琪", phone: "139 8765 4321", email: "mengqi.li@example.com", note: "瑜伽课认识", group: "个人" },
        { id: "c3", name: "王浩然", phone: "137 2233 4455", email: "haoran.wang@example.com", note: "产品经理", group: "工作" },
        { id: "c4", name: "张雅婷", phone: "136 6677 8899", email: "yating.zhang@example.com", note: "设计部", group: "工作" },
        { id: "c5", name: "赵子轩", phone: "135 1122 3344", email: "zixuan.zhao@example.com", note: "前端工程师", group: "工作" },
        { id: "c6", name: "刘欣怡", phone: "188 5566 7788", email: "xinyi.liu@example.com", note: "高中好友", group: "个人" },
        { id: "c7", name: "孙宇辰", phone: "182 9988 7766", email: "yuchen.sun@example.com", note: "客户对接", group: "工作" },
        { id: "c8", name: "周静雯", phone: "159 3344 5566", email: "jingwen.zhou@example.com", note: "邻居", group: "个人" }
    ];

    /* ---------- 持久化 ---------- */
    let contacts = [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) contacts = parsed;
        }
    } catch (e) { /* 忽略损坏数据 */ }
    if (!contacts.length) {
        contacts = SEED.slice();
        persist();
    }

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
        } catch (e) { /* 私有模式等：仅当前会话生效 */ }
    }

    /* ---------- 元素 ---------- */
    const listEl = win.querySelector(".contact-list");
    const searchInput = win.querySelector(".search-input");
    const groupItems = win.querySelectorAll(".group-item");
    const emptyEl = win.querySelector(".detail-empty");
    const cardEl = win.querySelector(".detail-card");
    const detailAvatar = win.querySelector(".detail-avatar");
    const detailName = win.querySelector(".detail-name");
    const detailFields = win.querySelector(".detail-fields");
    const deleteBtn = win.querySelector(".delete-btn");
    const addBtn = win.querySelector(".add-btn");
    const overlay = win.querySelector(".add-overlay");
    const addForm = win.querySelector(".add-form");
    const cancelBtn = win.querySelector(".add-cancel");

    /* ---------- 状态 ---------- */
    let activeGroup = "全部";
    let query = "";
    let selectedId = null;

    /* ---------- 工具 ---------- */
    function initial(name) {
        return (name || "").trim().charAt(0) || "?";
    }
    // 头像颜色按姓名稳定取色（macOS 风格柔和色板）
    const PALETTE = ["#ff9500", "#34c759", "#007aff", "#af52de", "#ff2d55", "#5ac8fa", "#ffcc00", "#5856d6"];
    function avatarColor(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
        return PALETTE[h % PALETTE.length];
    }
    function escapeHTML(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function visibleContacts() {
        const q = query.trim().toLowerCase();
        return contacts
            .filter((c) => activeGroup === "全部" || c.group === activeGroup)
            .filter((c) => !q || c.name.toLowerCase().includes(q))
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    }

    /* ---------- 渲染列表 ---------- */
    function renderList() {
        const items = visibleContacts();
        listEl.innerHTML = "";
        if (!items.length) {
            const e = document.createElement("div");
            e.className = "list-empty";
            e.textContent = query.trim() ? "无匹配联系人" : "暂无联系人";
            listEl.appendChild(e);
            return;
        }
        let lastBucket = null;
        items.forEach((c) => {
            const bucket = c.name.trim().charAt(0) || "#";
            if (bucket !== lastBucket) {
                lastBucket = bucket;
                const h = document.createElement("div");
                h.className = "group-header";
                h.textContent = bucket;
                listEl.appendChild(h);
            }
            const row = document.createElement("div");
            row.className = "contact-item" + (c.id === selectedId ? " active" : "");
            row.dataset.id = c.id;
            const av = document.createElement("div");
            av.className = "contact-avatar";
            av.textContent = initial(c.name);
            av.style.background = avatarColor(c.name);
            const nm = document.createElement("div");
            nm.className = "contact-name";
            nm.textContent = c.name;
            row.appendChild(av);
            row.appendChild(nm);
            listEl.appendChild(row);
        });
    }

    /* ---------- 渲染详情 ---------- */
    function renderDetail() {
        const c = contacts.find((x) => x.id === selectedId);
        if (!c) {
            emptyEl.hidden = false;
            cardEl.hidden = true;
            return;
        }
        emptyEl.hidden = true;
        cardEl.hidden = false;
        detailAvatar.textContent = initial(c.name);
        detailAvatar.style.background = avatarColor(c.name);
        detailName.textContent = c.name;
        const rows = [
            ["电话", c.phone, false],
            ["邮箱", c.email, false],
            ["分组", c.group, false],
            ["备注", c.note, true]
        ];
        detailFields.innerHTML = rows
            .filter(([, v]) => v && String(v).trim())
            .map(([label, v, isNote]) =>
                `<div class="detail-row"><div class="detail-label">${escapeHTML(label)}</div>` +
                `<div class="detail-value${isNote ? " note-value" : ""}">${escapeHTML(v)}</div></div>`
            ).join("");
    }

    function selectContact(id) {
        selectedId = id;
        renderList();
        renderDetail();
    }

    function renderAll() {
        renderList();
        renderDetail();
    }

    /* ---------- 交互：搜索 ---------- */
    // 选中联系人:用事件委托 + mousedown(而非每行 click)。
    // 原因:点击会触发列表重渲染,行元素在 mousedown 与 mouseup 之间被替换,
    // 导致 click 的 target 回退到 body、永不命中行上的 click 监听。
    // mousedown 一定先命中行,委托在稳定的 .contact-list 容器上,重渲染后依旧有效。
    on(listEl, "mousedown", (e) => {
        const row = e.target.closest(".contact-item");
        if (row && row.dataset.id) selectContact(row.dataset.id);
    });

    on(searchInput, "input", () => {
        query = searchInput.value;
        const vis = visibleContacts();
        if (!vis.some((c) => c.id === selectedId)) selectedId = null;
        renderAll();
    });

    /* ---------- 交互：分组切换 ---------- */
    groupItems.forEach((g) => {
        on(g, "click", () => {
            groupItems.forEach((x) => x.classList.remove("active"));
            g.classList.add("active");
            activeGroup = g.dataset.group;
            const vis = visibleContacts();
            if (!vis.some((c) => c.id === selectedId)) selectedId = null;
            renderAll();
        });
    });

    /* ---------- 交互：新建 ---------- */
    on(addBtn, "click", () => {
        addForm.reset();
        overlay.hidden = false;
        const f = addForm.querySelector('[name="name"]');
        if (f) f.focus();
    });
    on(cancelBtn, "click", () => { overlay.hidden = true; });
    on(overlay, "click", (e) => { if (e.target === overlay) overlay.hidden = true; });

    on(addForm, "submit", (e) => {
        e.preventDefault();
        const data = new FormData(addForm);
        const name = String(data.get("name") || "").trim();
        if (!name) return;
        const c = {
            id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name,
            phone: String(data.get("phone") || "").trim(),
            email: String(data.get("email") || "").trim(),
            note: String(data.get("note") || "").trim(),
            group: String(data.get("group") || "个人")
        };
        contacts.push(c);
        persist();
        overlay.hidden = true;
        // 切到能看到新建项的分组，并选中
        if (activeGroup !== "全部" && activeGroup !== c.group) {
            groupItems.forEach((x) => x.classList.toggle("active", x.dataset.group === "全部"));
            activeGroup = "全部";
        }
        query = "";
        searchInput.value = "";
        selectedId = c.id;
        renderAll();
    });

    /* ---------- 交互：删除 ---------- */
    on(deleteBtn, "click", () => {
        if (!selectedId) return;
        contacts = contacts.filter((c) => c.id !== selectedId);
        persist();
        selectedId = null;
        renderAll();
    });

    /* ---------- 启动 ---------- */
    renderAll();
})();
