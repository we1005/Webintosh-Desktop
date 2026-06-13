/* 历程 —— 垂直时间线，数据驱动渲染，原生 JS */
import { bringToFront } from "../window.js";

(() => {
    const win = document.getElementById("历程") || document.querySelector(".journeyapp.window");
    if (!win || win.dataset.bound === "1") return;
    win.dataset.bound = "1";

    const timeline = win.querySelector(".timeline");
    const scroller = win.querySelector(".timeline-scroll");
    if (!timeline) return;

    /* ---------- 时间线数据（通用示例里程碑） ---------- */
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

    /* ---------- 渲染 ---------- */
    const nodes = [];
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
        nodes.push(node);
    }
    timeline.appendChild(frag);

    /* ---------- 出现时淡入：IntersectionObserver（GPU 合成） ---------- */
    let io = null;
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
        nodes.forEach(n => io.observe(n));
        // 兜底：首屏已在视口内的节点立即点亮（避免初始未触发回调）
        requestAnimationFrame(() => {
            nodes.forEach(n => {
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
        // 不支持或用户偏好减少动态效果：直接呈现
        nodes.forEach(n => n.classList.add("in-view"));
    }

    /* ---------- 交互：点击主体置顶窗口（不触发拖拽） ---------- */
    if (scroller) {
        scroller.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            bringToFront(win, "历程");
        });
    }

    /* ---------- 生命周期：窗口移除时清理观察器 ---------- */
    const mo = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            if (io) io.disconnect();
            mo.disconnect();
        }
    });
    mo.observe(document.body, { childList: true });
})();
