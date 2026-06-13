/* 日历 —— macOS Calendar 风格月视图（原生 JS） */
(() => {
    const win = document.getElementById("日历") || document.querySelector(".calendarapp.window");
    if (!win || win.dataset.calBound === "1") return;
    win.dataset.calBound = "1";

    const STORAGE_KEY = "webintosh.calendar.events";
    const WEEK_FIRST = 0; // 周日为每周第一天

    const titleEl = win.querySelector(".cal-title");
    const gridEl = win.querySelector(".grid");
    const prevBtn = win.querySelector(".prev-btn");
    const nextBtn = win.querySelector(".next-btn");
    const todayBtn = win.querySelector(".today-btn");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 当前显示的年/月（视图状态）
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth(); // 0-11

    /* ---------- 事件持久化 ---------- */
    function loadEvents() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            return data && typeof data === "object" ? data : {};
        } catch (e) {
            return {};
        }
    }
    function saveEvents(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            /* 存储不可用时静默降级 */
        }
    }
    // 以本地时区生成 YYYY-MM-DD（不能用 toISOString，会偏移成 UTC）
    function dateKey(y, m, d) {
        const mm = String(m + 1).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        return `${y}-${mm}-${dd}`;
    }

    /* ---------- 渲染 ---------- */
    function render() {
        titleEl.textContent = `${viewYear}年${viewMonth + 1}月`;

        const events = loadEvents();

        // 当月第一天是星期几（0=周日）
        const firstDow = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        // 前置补位数量
        const lead = (firstDow - WEEK_FIRST + 7) % 7;
        // 总格子数补到 7 的整数倍（保证整齐网格）
        const totalCells = Math.ceil((lead + daysInMonth) / 7) * 7;

        gridEl.innerHTML = "";

        // 起始日期 = 当月 1 号往前推 lead 天
        const start = new Date(viewYear, viewMonth, 1 - lead);

        for (let i = 0; i < totalCells; i++) {
            const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
            const y = cur.getFullYear();
            const m = cur.getMonth();
            const d = cur.getDate();

            const cell = document.createElement("div");
            cell.className = "cell";
            if (m !== viewMonth) cell.classList.add("other-month");

            const isToday =
                y === today.getFullYear() &&
                m === today.getMonth() &&
                d === today.getDate();
            if (isToday) cell.classList.add("today");

            const key = dateKey(y, m, d);
            cell.dataset.key = key;

            const num = document.createElement("span");
            num.className = "day-num";
            num.textContent = String(d);
            cell.appendChild(num);

            const dayEvents = Array.isArray(events[key]) ? events[key] : [];
            if (dayEvents.length) {
                const list = document.createElement("div");
                list.className = "event-list";
                // 最多直接展示 3 条，其余以小圆点提示
                dayEvents.slice(0, 3).forEach((title) => {
                    const item = document.createElement("div");
                    item.className = "event-item";
                    item.textContent = title;
                    item.title = title;
                    list.appendChild(item);
                });
                cell.appendChild(list);
                if (dayEvents.length > 3) {
                    const dot = document.createElement("span");
                    dot.className = "event-dot";
                    cell.appendChild(dot);
                }
            }

            cell.addEventListener("click", () => addEvent(key, dayEvents.length));
            gridEl.appendChild(cell);
        }
    }

    /* ---------- 加事件 ---------- */
    function addEvent(key, count) {
        const input = window.prompt(`为 ${key} 添加事件标题：`, "");
        if (input === null) return;
        const title = input.trim();
        if (!title) return;
        const events = loadEvents();
        if (!Array.isArray(events[key])) events[key] = [];
        events[key].push(title);
        saveEvents(events);
        render();
    }

    /* ---------- 导航 ---------- */
    function shiftMonth(delta) {
        viewMonth += delta;
        if (viewMonth < 0) {
            viewMonth = 11;
            viewYear--;
        } else if (viewMonth > 11) {
            viewMonth = 0;
            viewYear++;
        }
        render();
    }
    function goToday() {
        viewYear = today.getFullYear();
        viewMonth = today.getMonth();
        render();
    }

    prevBtn.addEventListener("click", () => shiftMonth(-1));
    nextBtn.addEventListener("click", () => shiftMonth(1));
    todayBtn.addEventListener("click", goToday);

    render();
})();
