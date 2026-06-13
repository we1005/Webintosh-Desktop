/* Desktop glass widget cards (top-left), self-contained ES module.
 *
 * Builds a vertical stack of frosted-glass widget cards in the top-left
 * corner of the desktop (just below the menu bar):
 *   1. Clock      - live HH:MM:SS, weekday + date below. Ticks every 1s.
 *   2. Calendar   - red month abbreviation, big day-of-month number, weekday.
 *   3. Weather    - city, big temperature, inline SVG icon, hi/lo (mock data).
 *   4. Stats      - CPU / Memory / Network / Battery bars (mock + light jitter,
 *                   real Battery API and performance.memory when available).
 *
 * Self-contained: injects its own <link> to
 *   assets/stylesheets/main/desktop-widgets.css
 * (resolved relative to this module via import.meta.url) and builds all DOM.
 *
 * Idempotent: calling initDesktopWidgets() more than once is a no-op once the
 * container (#desktop-widgets) already exists.
 *
 * The desktop surface (.desktop) uses direction: rtl; the container and the
 * cards force direction: ltr (also enforced inline as a safety net).
 */

const WIDGETS_ID = "desktop-widgets";
const STYLE_ID = "desktop-widgets-style";

/* ---------- helpers ---------- */

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function injectStylesheet() {
    if (document.getElementById(STYLE_ID)) return;
    let href;
    try {
        href = new URL("../../assets/stylesheets/main/desktop-widgets.css", import.meta.url).href;
    } catch (e) {
        href = "./assets/stylesheets/main/desktop-widgets.css";
    }
    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
}

/* Pick the best host for the widgets without touching desktop icons.
 * Preference: .desktop -> #desktop -> document.body. */
function resolveHost() {
    return (
        document.querySelector(".desktop") ||
        document.getElementById("desktop") ||
        document.body
    );
}

/* ---------- inline SVG weather icon ---------- */

function sunSVG() {
    return (
        '<svg class="dw-weather-icon" viewBox="0 0 24 24" fill="none" ' +
        'stroke="#ffd60a" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="4.2" fill="#ffd60a" stroke="#ffd60a"></circle>' +
        '<line x1="12" y1="2" x2="12" y2="4.5"></line>' +
        '<line x1="12" y1="19.5" x2="12" y2="22"></line>' +
        '<line x1="2" y1="12" x2="4.5" y2="12"></line>' +
        '<line x1="19.5" y1="12" x2="22" y2="12"></line>' +
        '<line x1="4.9" y1="4.9" x2="6.7" y2="6.7"></line>' +
        '<line x1="17.3" y1="17.3" x2="19.1" y2="19.1"></line>' +
        '<line x1="4.9" y1="19.1" x2="6.7" y2="17.3"></line>' +
        '<line x1="17.3" y1="6.7" x2="19.1" y2="4.9"></line>' +
        "</svg>"
    );
}

/* ---------- card builders ---------- */

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function buildClockCard() {
    const card = el("div", "dw-card dw-clock");
    const time = el("div", "dw-clock-time");
    const sub = el("div", "dw-clock-sub");
    card.appendChild(time);
    card.appendChild(sub);

    function render() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        time.innerHTML = hh + ":" + mm + '<span class="dw-sec">:' + ss + "</span>";
        sub.textContent = WEEKDAYS[now.getDay()] + " " + (now.getMonth() + 1) + "月" + now.getDate() + "日";
    }

    render();
    setInterval(render, 1000);
    return card;
}

function buildCalendarCard() {
    const card = el("div", "dw-card dw-cal");
    const now = new Date();
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    card.appendChild(el("div", "dw-cal-month", months[now.getMonth()]));
    card.appendChild(el("div", "dw-cal-day", String(now.getDate())));
    card.appendChild(el("div", "dw-cal-week", WEEKDAYS[now.getDay()]));
    return card;
}

function buildWeatherCard() {
    const card = el("div", "dw-card dw-weather");
    const top = el("div", "dw-weather-top");
    top.appendChild(el("div", "dw-weather-city", "上海"));
    const iconWrap = document.createElement("div");
    iconWrap.innerHTML = sunSVG();
    top.appendChild(iconWrap.firstChild);
    card.appendChild(top);

    card.appendChild(el("div", "dw-weather-temp", "24°"));

    const meta = el("div", "dw-weather-meta");
    meta.appendChild(el("span", null, "晴"));
    meta.appendChild(el("span", null, "高 27°"));
    meta.appendChild(el("span", null, "低 18°"));
    card.appendChild(meta);
    return card;
}

function buildStatsCard() {
    const card = el("div", "dw-card dw-stats");
    card.appendChild(el("div", "dw-stats-title", "系统状态"));

    const rows = {};
    const defs = [
        { key: "cpu", label: "CPU" },
        { key: "mem", label: "内存" },
        { key: "net", label: "网络" },
        { key: "bat", label: "电池" },
    ];

    defs.forEach((d) => {
        const row = el("div", "dw-stat-row");
        row.dataset.key = d.key;
        row.appendChild(el("span", "dw-stat-label", d.label));
        const bar = el("div", "dw-bar");
        const fill = el("div", "dw-bar-fill");
        bar.appendChild(fill);
        row.appendChild(bar);
        const val = el("span", "dw-stat-val", "0%");
        row.appendChild(val);
        card.appendChild(row);
        rows[d.key] = { fill: fill, val: val };
    });

    function setRow(key, pct) {
        const p = Math.max(0, Math.min(100, Math.round(pct)));
        rows[key].fill.style.width = p + "%";
        rows[key].val.textContent = p + "%";
    }

    const state = { cpu: 18, mem: 42, net: 30, bat: 80 };
    let batteryReal = false;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    function jitter() {
        state.cpu = clamp(state.cpu + (Math.random() - 0.5) * 14, 4, 92);
        state.net = clamp(state.net + (Math.random() - 0.5) * 22, 2, 96);
        const perf = window.performance;
        if (perf && perf.memory && perf.memory.jsHeapSizeLimit) {
            state.mem = (perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100;
        } else {
            state.mem = clamp(state.mem + (Math.random() - 0.5) * 8, 20, 88);
        }
        if (!batteryReal) {
            state.bat = clamp(state.bat + (Math.random() - 0.5) * 3, 35, 100);
        }
        setRow("cpu", state.cpu);
        setRow("mem", state.mem);
        setRow("net", state.net);
        setRow("bat", state.bat);
    }

    if (typeof navigator !== "undefined" && navigator.getBattery) {
        try {
            navigator.getBattery().then((b) => {
                batteryReal = true;
                const apply = () => { state.bat = (b.level || 0) * 100; setRow("bat", state.bat); };
                apply();
                b.addEventListener("levelchange", apply);
            }).catch(() => { /* keep mock */ });
        } catch (e) { /* keep mock */ }
    }

    jitter();
    setInterval(jitter, 2500);
    return card;
}

/* ---------- entry point ---------- */

export function initDesktopWidgets() {
    if (typeof document === "undefined") return null;
    let container = document.getElementById(WIDGETS_ID);
    if (container) return container; // idempotent

    injectStylesheet();

    container = document.createElement("div");
    container.id = WIDGETS_ID;
    container.style.direction = "ltr"; /* safety net over .desktop rtl */

    container.appendChild(buildClockCard());
    container.appendChild(buildCalendarCard());
    container.appendChild(buildWeatherCard());
    container.appendChild(buildStatsCard());

    resolveHost().appendChild(container);
    return container;
}

export default initDesktopWidgets;
