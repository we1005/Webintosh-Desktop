/* 关于我 —— 合并自「历程」(垂直时间线) 与「技术栈」(分类技术卡片)。
 * 顶部分段控件切换两个面板;由 window.create() 注入,每次打开重新执行,需防重入。 */
import { bringToFront } from "../window.js";

(() => {
    const win = document.getElementById("关于我") || document.querySelector(".aboutme.window");
    if (!win || win.dataset.bound === "1") return;
    win.dataset.bound = "1";

    /* ============================================================
     * 一、历程(时间线)
     * ============================================================ */
    const timeline = win.querySelector(".timeline");
    const scroller = win.querySelector(".timeline-scroll");

    const MILESTONES = [
        { year: "2018", title: "踏上旅途", desc: "怀着好奇心写下第一行代码，从此与构建数字世界结缘。" },
        { year: "2020", title: "开始学习编程", desc: "系统学习数据结构与算法，逐步搭建起扎实的工程基础。" },
        { year: "2021", title: "加入第一个团队", desc: "在协作中理解版本控制、代码评审与持续集成的真正价值。" },
        { year: "2022", title: "第一个项目上线", desc: "独立负责的功能模块顺利发布，收获了第一批真实用户的反馈。" },
        { year: "2023", title: "走向全栈", desc: "打通前后端链路，开始关注性能、可访问性与产品体验的平衡。" },
        { year: "2024", title: "开源与分享", desc: "把沉淀的工具与经验整理成开源项目，与更多开发者彼此照亮。" },
        { year: "2025", title: "带领小团队", desc: "从写好代码到帮助他人写好代码，把视野从功能扩展到架构与人。" },
        { year: "未来", title: "继续生长", desc: "保持好奇，持续学习，让每一段历程都成为下一段的起点。" }
    ];

    let io = null;
    const tlNodes = [];
    if (timeline) {
        const frag = document.createDocumentFragment();
        for (const m of MILESTONES) {
            const node = document.createElement("div");
            node.className = "tl-node";
            node.setAttribute("role", "listitem");
            const dot = document.createElement("span");
            dot.className = "tl-dot";
            const card = document.createElement("div");
            card.className = "tl-card";
            const year = document.createElement("span");
            year.className = "tl-year";
            year.textContent = m.year;
            const title = document.createElement("h3");
            title.className = "tl-title";
            title.textContent = m.title;
            const desc = document.createElement("p");
            desc.className = "tl-desc";
            desc.textContent = m.desc;
            card.appendChild(year);
            card.appendChild(title);
            card.appendChild(desc);
            node.appendChild(dot);
            node.appendChild(card);
            frag.appendChild(node);
            tlNodes.push(node);
        }
        timeline.appendChild(frag);

        const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduce && "IntersectionObserver" in window && scroller) {
            io = new IntersectionObserver((entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        e.target.classList.add("in-view");
                        io.unobserve(e.target);
                    }
                }
            }, { root: scroller, threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
            tlNodes.forEach(n => io.observe(n));
            requestAnimationFrame(() => {
                tlNodes.forEach(n => {
                    if (!n.classList.contains("in-view")) {
                        const r = n.getBoundingClientRect();
                        const sr = scroller.getBoundingClientRect();
                        if (r.top < sr.bottom && r.bottom > sr.top) {
                            n.classList.add("in-view");
                            io.unobserve(n);
                        }
                    }
                });
            });
        } else {
            tlNodes.forEach(n => n.classList.add("in-view"));
        }
    }

    /* ============================================================
     * 二、技术栈(分类技术卡片)
     * ============================================================ */
    const mount = win.querySelector("#am-tech-stack");

    const ICONS = {
        html: '<svg viewBox="0 0 24 24"><path fill="#e44d26" d="M4 2l1.6 18L12 22l6.4-2L20 2H4z"/><path fill="#f16529" d="M12 4v16l5.1-1.6L18.5 4H12z"/><path fill="#ebebeb" d="M12 7H7.3l.16 2H12V7zm0 4H7.6l.5 6 3.9 1.1V16l-2.1-.6-.13-1.4H12V11z"/><path fill="#fff" d="M12 7v2h4.6l-.2 2H12v2h4.2l-.3 3-3.9 1.1v2.1l5-1.4.7-8.9H12z"/></svg>',
        css: '<svg viewBox="0 0 24 24"><path fill="#1572b6" d="M4 2l1.6 18L12 22l6.4-2L20 2H4z"/><path fill="#33a9dc" d="M12 4v16l5.1-1.6L18.5 4H12z"/><path fill="#ebebeb" d="M12 9h4.3l.3-2H12V5H7.4l.5 6H12V9zm0 5l-2.1-.6-.13-1.6H7.7l.3 3.2L12 16v-2z"/><path fill="#fff" d="M12 9v2h2.1l-.2 2.4-1.9.6v2.1l3.8-1 .5-6.1H12z"/></svg>',
        js: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#f7df1e"/><path fill="#000" d="M7 18.4c.4.7 1 1.3 2.1 1.3 1 0 1.5-.4 1.5-1.6V12h1.8v6.1c0 2.1-1.2 3.1-3 3.1-1.6 0-2.6-.8-3.1-1.8L7 18.4zm6.4-.2c.5.9 1.1 1.5 2.3 1.5 1 0 1.5-.5 1.5-1.1 0-.8-.6-1-1.7-1.5l-.6-.2c-1.6-.7-2.7-1.5-2.7-3.3 0-1.6 1.2-2.9 3.2-2.9 1.4 0 2.4.5 3.1 1.8l-1.7 1.1c-.4-.7-.8-.9-1.4-.9-.6 0-1 .4-1 .9 0 .7.4.9 1.4 1.4l.6.2c1.9.8 3 1.6 3 3.4 0 1.9-1.5 3-3.6 3-2 0-3.3-1-3.9-2.2l1.5-1z"/></svg>',
        ts: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#3178c6"/><path fill="#fff" d="M13 12.5v-1.5H6v1.5h2.6v7h1.8v-7H13zm.6 6.4c.5.8 1.4 1.4 2.9 1.4 1.7 0 3-.9 3-2.6 0-1.6-.9-2.3-2.6-3l-.5-.2c-.8-.4-1.2-.6-1.2-1.1 0-.5.4-.8 1-.8.6 0 1 .2 1.3.9l1.5-.9c-.6-1.1-1.5-1.5-2.8-1.5-1.7 0-2.8 1.1-2.8 2.5 0 1.5.9 2.2 2.3 2.8l.5.2c.9.4 1.4.6 1.4 1.2 0 .5-.5.9-1.3.9-.9 0-1.4-.5-1.8-1.1l-1.4.9z"/></svg>',
        react: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2" fill="#61dafb"/><g fill="none" stroke="#61dafb" stroke-width="1"><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/></g></svg>',
        vue: '<svg viewBox="0 0 24 24"><path fill="#41b883" d="M2 3l10 17L22 3h-4l-6 10.4L6 3H2z"/><path fill="#35495e" d="M6 3l6 10.4L18 3h-3.2L12 7.6 9.2 3H6z"/></svg>',
        node: '<svg viewBox="0 0 24 24"><path fill="#539e43" d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z"/><path fill="#fff" d="M12 8.4c-1.9 0-3.1.9-3.1 2.3 0 1.6 1.2 2 3 2.2 1.5.2 1.7.4 1.7.8 0 .4-.4.7-1.4.7-1.2 0-1.6-.4-1.7-1H8.7c.1 1.4 1.1 2.2 3.4 2.2 2.1 0 3.2-.9 3.2-2.3 0-1.6-1.3-2-3.1-2.2-1.6-.2-1.7-.4-1.7-.8 0-.3.3-.6 1.2-.6 1 0 1.4.3 1.5.9h1.7c-.1-1.4-1-2.1-3.1-2.1z"/></svg>',
        python: '<svg viewBox="0 0 24 24"><path fill="#366994" d="M12 2c-2.5 0-4 1-4 3v2h4v.7H6c-2 0-3 1.3-3 4 0 2.6 1 4.3 3 4.3h1.2v-2.2c0-1.7 1.3-3 3-3h3.5c1.5 0 2.3-.9 2.3-2.4V5c0-2-1.5-3-5-3zM9.8 4.5c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z"/><path fill="#ffc331" d="M12 22c2.5 0 4-1 4-3v-2h-4v-.7h6c2 0 3-1.3 3-4 0-2.6-1-4.3-3-4.3h-1.2v2.2c0 1.7-1.3 3-3 3H10.3c-1.5 0-2.3.9-2.3 2.4V19c0 2 1.5 3 5 3zm2.2-2.5c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9z"/></svg>',
        postgres: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8" ry="9" fill="#336791"/><path fill="#fff" d="M9 8.5c1.4-.6 4.6-.6 6 0M8.5 11c0 3 .5 5 1.5 6M14 10.5c.2 2.5 0 4.5-.5 6" stroke="#fff" stroke-width="1" fill="none"/><circle cx="9.5" cy="9.5" r="1" fill="#fff"/></svg>',
        mongo: '<svg viewBox="0 0 24 24"><path fill="#4faa41" d="M12 2c0 5-4 6-4 11 0 5 3 7 3.5 9 .2.4.8.4 1 0 .5-2 3.5-4 3.5-9 0-5-4-6-4-11z"/><path fill="#3f8b35" d="M12 2c0 5 0 18 0 20 .2.4.8.4 1 0 .5-2 3.5-4 3.5-9 0-5-4-6-4-11z"/></svg>',
        docker: '<svg viewBox="0 0 24 24"><path fill="#2496ed" d="M22 10.5c-.4-.3-1.4-.4-2.1-.2-.1-.7-.5-1.3-1.1-1.8l-.4-.3-.3.4c-.4.6-.5 1.6-.1 2.3-.2.1-.6.2-1 .2H2.2c-.2.9-.2 3.5 1.7 5.4 1.5 1.5 3.6 2.2 6.4 2.2 6 0 10.5-2.8 12.6-7.9.8 0 2 0 2.6-1.2l.2-.3-.3-.2c-.6-.4-1.6-.5-2.2-.4-.4 0-.8.1-1.1.2-.2-.1-.6-.2-1-.2z"/><g fill="#2496ed"><rect x="3.5" y="11" width="2.4" height="2.2"/><rect x="6.3" y="11" width="2.4" height="2.2"/><rect x="9.1" y="11" width="2.4" height="2.2"/><rect x="11.9" y="11" width="2.4" height="2.2"/><rect x="6.3" y="8.3" width="2.4" height="2.2"/><rect x="9.1" y="8.3" width="2.4" height="2.2"/><rect x="9.1" y="5.6" width="2.4" height="2.2"/></g></svg>',
        git: '<svg viewBox="0 0 24 24"><path fill="#f05133" d="M22.6 11l-9.6-9.6c-.5-.5-1.4-.5-2 0L9 3.4l2.5 2.5c.6-.2 1.3 0 1.7.5.5.5.6 1.2.4 1.8l2.4 2.4c.6-.2 1.3 0 1.8.4.7.7.7 1.8 0 2.5s-1.8.7-2.5 0c-.5-.5-.6-1.3-.4-1.9l-2.2-2.2v5.9c.2.1.3.2.5.3.7.7.7 1.8 0 2.5s-1.8.7-2.5 0-.7-1.8 0-2.5c.2-.2.4-.3.6-.4V9.7c-.2-.1-.4-.2-.6-.4-.5-.5-.6-1.3-.4-1.9L7.9 5 1.4 11.4c-.6.6-.6 1.5 0 2.1l9.6 9.6c.5.5 1.4.5 2 0l9.6-9.6c.6-.6.6-1.5 0-2.1z"/></svg>',
        aws: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="#232f3e"/><path fill="#ff9900" d="M5 16.5c2.2 1.4 5 2 7 2s4.8-.6 7-2c.3-.2.6.1.3.4-1.8 1.8-4.6 2.6-7.3 2.6S6.5 18.7 4.7 16.9c-.2-.3.1-.5.3-.4z"/><path fill="#ff9900" d="M18.8 15.6c-.3.3-1.7.2-2.4.1-.2 0-.2.1 0 .2 1.1.8 2.9.6 3.1.3.2-.3-.1-2-.9-2.4-.1-.1-.2 0-.1.1.3.4.6 1.4.3 1.7z"/><path fill="#fff" d="M8.4 8.6h-1l1.4 4.4h1l1-3 1 3h1l1.4-4.4h-1l-.9 3.1-1-3.1h-.9l-1 3.1-1-3.1z"/></svg>',
        next: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#000"/><path fill="#fff" d="M9 7h1.3l6 8.7V7H17v10h-1.3L8 7.5V17H9V7z"/></svg>',
        sass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#cd6799"/><path fill="#fff" d="M16.5 10.5c-.9 0-1.7.4-2.3 1-.2-1-.7-1.7-.9-2.6-.2-1 .1-1.6.4-2 .2-.3-.1-.6-.4-.4-1.4.6-2 1.9-1.7 3 .1.6.4 1.3.7 2-.5.2-1 .4-1.5.7-1.5.9-2.8 2-2.8 3.4 0 1 .8 1.6 1.7 1.6 1.6 0 2.7-1.7 2.7-3.3 0-.2 0-.4-.1-.6.3-.2.7-.3 1-.4 1 0 1.6.7 1.6 1.4 0 .9-.7 1.4-1.3 1.6-.2.1-.2.3.1.3 1.1 0 2.2-.9 2.2-2.2 0-1.2-1-2.5-2.9-2.5z"/></svg>',
        tailwind: '<svg viewBox="0 0 24 24"><path fill="#06b6d4" d="M12 6c-2.7 0-4.4 1.3-5 4 .9-1.3 2-1.7 3.2-1.4.7.2 1.2.7 1.8 1.3.9.9 2 2 4.5 2 2.7 0 4.4-1.3 5-4-.9 1.3-2 1.7-3.2 1.4-.7-.2-1.2-.7-1.8-1.3C15.6 7.1 14.5 6 12 6zM7 12c-2.7 0-4.4 1.3-5 4 .9-1.3 2-1.7 3.2-1.4.7.2 1.2.7 1.8 1.3.9.9 2 2 4.5 2 2.7 0 4.4-1.3 5-4-.9 1.3-2 1.7-3.2 1.4-.7-.2-1.2-.7-1.8-1.3C10.6 13.1 9.5 12 7 12z"/></svg>',
        redis: '<svg viewBox="0 0 24 24"><path fill="#d82c20" d="M12 4l9 3-9 3-9-3 9-3z"/><path fill="#a41e11" d="M21 10l-9 3-9-3v3l9 3 9-3v-3z"/><path fill="#d82c20" d="M21 13.5l-9 3-9-3V16l9 3 9-3v-2.5z"/></svg>',
        linux: '<svg viewBox="0 0 24 24"><path fill="#000" d="M12 2c-2 0-3 1.7-3 4 0 1.3.2 2 .2 3-.1 1-2.2 3.5-2.7 5.5-.4 1.6.1 2.6.1 2.6s-1 1.7-.5 2.6c.6 1 2.4.6 3.6.8 1.1.2 1.5 1 2.3 1s1.2-.8 2.3-1c1.2-.2 3 .2 3.6-.8.5-.9-.5-2.6-.5-2.6s.5-1 .1-2.6c-.5-2-2.6-4.5-2.7-5.5 0-1 .2-1.7.2-3 0-2.3-1-4-3-4z"/><ellipse cx="10.4" cy="6.5" rx=".9" ry="1.2" fill="#fff"/><ellipse cx="13.6" cy="6.5" rx=".9" ry="1.2" fill="#fff"/><circle cx="10.4" cy="6.7" r=".5" fill="#000"/><circle cx="13.6" cy="6.7" r=".5" fill="#000"/><path fill="#ffc331" d="M10.8 9c.4.5 2 .5 2.4 0 .2-.2-.1-.5-.3-.4-.6.3-1.2.3-1.8 0-.2-.1-.5.2-.3.4z"/></svg>',
    };

    function letterBadge(name, color) {
        return '<span class="letter" style="background:' + color + '">' + name.trim().charAt(0).toUpperCase() + "</span>";
    }

    const GROUPS = [
        { title: "前端", items: [
            { name: "HTML", icon: "html", level: 95 },
            { name: "CSS", icon: "css", level: 92 },
            { name: "JavaScript", icon: "js", level: 90 },
            { name: "TypeScript", icon: "ts", level: 85 },
            { name: "React", icon: "react", level: 88 },
            { name: "Vue", icon: "vue", level: 86 },
            { name: "Next.js", icon: "next", level: 78 },
            { name: "Sass", icon: "sass", level: 80 },
            { name: "Tailwind", icon: "tailwind", level: 82 },
        ] },
        { title: "后端", items: [
            { name: "Node.js", icon: "node", level: 87 },
            { name: "Python", icon: "python", level: 84 },
            { name: "Go", letter: "Go", color: "#00add8", level: 70 },
            { name: "Express", letter: "E", color: "#444", level: 80 },
        ] },
        { title: "数据库", items: [
            { name: "PostgreSQL", icon: "postgres", level: 82 },
            { name: "MongoDB", icon: "mongo", level: 78 },
            { name: "Redis", icon: "redis", level: 72 },
            { name: "MySQL", letter: "M", color: "#00758f", level: 75 },
        ] },
        { title: "工具", items: [
            { name: "Git", icon: "git", level: 90 },
            { name: "Docker", icon: "docker", level: 80 },
            { name: "Linux", icon: "linux", level: 78 },
            { name: "Vite", letter: "V", color: "#646cff", level: 80 },
            { name: "Webpack", letter: "W", color: "#8dd6f9", level: 70 },
        ] },
        { title: "云", items: [
            { name: "AWS", icon: "aws", level: 76 },
            { name: "Vercel", letter: "▲", color: "#000", level: 82 },
            { name: "Cloudflare", letter: "C", color: "#f38020", level: 70 },
        ] },
    ];

    function autoColor(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
        return "hsl(" + h + ", 62%, 48%)";
    }

    const techBars = []; // { fill, level } —— 首次切到技术栈时再动画
    function makeCard(item) {
        const card = document.createElement("div");
        card.className = "card";
        const iconWrap = document.createElement("div");
        iconWrap.className = "icon";
        if (item.icon && ICONS[item.icon]) {
            iconWrap.innerHTML = ICONS[item.icon];
        } else {
            iconWrap.innerHTML = letterBadge(item.letter || item.name, item.color || autoColor(item.name));
        }
        const name = document.createElement("p");
        name.className = "card-name";
        name.textContent = item.name;
        card.appendChild(iconWrap);
        card.appendChild(name);
        if (typeof item.level === "number") {
            const bar = document.createElement("div");
            bar.className = "bar";
            const fill = document.createElement("span");
            fill.className = "bar-fill";
            fill.style.width = "0%";
            bar.appendChild(fill);
            card.appendChild(bar);
            techBars.push({ fill: fill, level: item.level });
        }
        return card;
    }

    if (mount) {
        GROUPS.forEach(function (group) {
            const section = document.createElement("div");
            section.className = "group";
            const heading = document.createElement("p");
            heading.className = "group-title";
            heading.textContent = group.title;
            section.appendChild(heading);
            const grid = document.createElement("div");
            grid.className = "grid";
            group.items.forEach(function (item) { grid.appendChild(makeCard(item)); });
            section.appendChild(grid);
            mount.appendChild(section);
        });
    }

    /* ============================================================
     * 三、分段控件切换 + 进度条懒动画
     * ============================================================ */
    const tabs = win.querySelectorAll(".am-tab");
    const panels = win.querySelectorAll(".am-panel");
    let techAnimated = false;

    function animateBars() {
        if (techAnimated) return;
        techAnimated = true;
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                techBars.forEach(function (b) { b.fill.style.width = b.level + "%"; });
            });
        });
    }

    function activate(tabName) {
        tabs.forEach(t => t.classList.toggle("is-active", t.dataset.tab === tabName));
        panels.forEach(p => p.toggleAttribute("hidden", p.dataset.panel !== tabName));
        if (tabName === "tech") animateBars();
    }

    tabs.forEach(t => t.addEventListener("click", () => activate(t.dataset.tab)));

    /* 点击窗体置顶(不触发拖拽) */
    const body = win.querySelector(".body");
    if (body) {
        body.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            bringToFront(win, "关于我");
        });
    }

    /* 生命周期:窗口移除时清理观察器 */
    const mo = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            if (io) io.disconnect();
            mo.disconnect();
        }
    });
    mo.observe(document.body, { childList: true });
})();
