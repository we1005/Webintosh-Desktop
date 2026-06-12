/* ============================================================
 * Webintosh OS — 终端（zsh 风格 shell，对接 VFS）
 * 注入主文档执行；可能被多次注入，按窗口元素做幂等守卫。
 * ============================================================ */

import vfs, { normPath, dirname, basename, joinPath } from "../../../os/vfs.js";

const HISTORY_KEY = "webintosh.terminal.history";
const HISTORY_MAX = 200;

const APPLE_LOGO = [
    "                    'c.",
    "                 ,xNMM.",
    "               .OMMMMo",
    "               OMMM0,",
    "     .;loddo:' loolloddol;.",
    "   cKMMMMMMMMMMNWMMMMMMMMMM0:",
    " .KMMMMMMMMMMMMMMMMMMMMMMMWd.",
    " XMMMMMMMMMMMMMMMMMMMMMMMX.",
    ";MMMMMMMMMMMMMMMMMMMMMMMM:",
    ":MMMMMMMMMMMMMMMMMMMMMMMM:",
    ".MMMMMMMMMMMMMMMMMMMMMMMMX.",
    " kMMMMMMMMMMMMMMMMMMMMMMMMWd.",
    " .XMMMMMMMMMMMMMMMMMMMMMMMMMMk",
    "  .XMMMMMMMMMMMMMMMMMMMMMMMMK.",
    "    kMMMMMMMMMMMMMMMMMMMMMMd",
    "     ;KMMMMMMMWXXWMMMMMMMk.",
    "       .cooc,.    .,coo:.",
];
// 每行配色段（neofetch 经典彩虹）
const LOGO_COLORS = ["nf-c1", "nf-c1", "nf-c1", "nf-c1", "nf-c2", "nf-c2", "nf-c2", "nf-c3", "nf-c3", "nf-c3", "nf-c4", "nf-c4", "nf-c4", "nf-c5", "nf-c5", "nf-c6", "nf-c6"];

const HELP_TEXT = [
    ["help", "显示本帮助"],
    ["ls [-l] [路径]", "列出目录内容（-l 显示大小与修改时间）"],
    ["cd [路径]", "切换当前目录"],
    ["pwd", "打印当前目录"],
    ["cat <文件>...", "查看文件内容"],
    ["echo <文本> [>|>> 文件]", "输出文本，> 覆盖写入、>> 追加写入"],
    ["mkdir <目录>...", "创建目录"],
    ["touch <文件>...", "创建空文件"],
    ["rm [-r] <路径>...", "删除文件（-r 递归删除目录）"],
    ["mv <源> <目标>", "移动 / 重命名"],
    ["cp [-r] <源> <目标>", "复制文件或目录"],
    ["clear", "清空屏幕（也可按 Ctrl+L）"],
    ["date", "显示当前日期时间"],
    ["whoami", "显示当前用户"],
    ["uname [-a]", "显示系统信息"],
    ["history", "显示命令历史（↑↓ 可翻阅）"],
    ["df", "显示存储空间用量"],
    ["backend [opfs|remote]", "查看或切换 VFS 存储后端"],
    ["open <应用名>", "打开桌面应用，如 open 计算器"],
    ["neofetch", "系统信息彩蛋"],
];

(function boot() {
    const wins = document.querySelectorAll(".terminal.window");
    const root = wins[wins.length - 1];
    if (!root || root.dataset.termReady) return;
    root.dataset.termReady = "1";
    initTerminal(root);
})();

function initTerminal(root) {
    const screenEl = root.querySelector(".screen");
    const outputEl = root.querySelector(".output");
    const inputLine = root.querySelector(".inputline");
    const promptEl = root.querySelector(".prompt");
    const typedEl = root.querySelector(".typed");
    const cursorEl = root.querySelector(".cursor");
    const tailEl = root.querySelector(".tail");
    const kbd = root.querySelector(".kbd");
    const titleEl = root.querySelector(".topbar .title");
    const measureEl = root.querySelector(".measure");

    let cwd = "/";
    let busy = false;
    let history = loadHistory();
    let histIdx = history.length;
    let histDraft = "";

    /* ---------------- 输出助手 ---------------- */

    function scrollBottom() {
        screenEl.scrollTop = screenEl.scrollHeight;
    }
    function line(cls) {
        const d = document.createElement("div");
        d.className = "line" + (cls ? " " + cls : "");
        outputEl.appendChild(d);
        return d;
    }
    function print(text = "", cls) {
        const d = line(cls);
        d.textContent = text;
        scrollBottom();
        return d;
    }
    function printErr(text) {
        print(text, "err");
    }
    function addSpan(parent, text, cls) {
        const s = document.createElement("span");
        if (cls) s.className = cls;
        s.textContent = text;
        parent.appendChild(s);
        return s;
    }

    /* ---------------- 提示符与输入渲染 ---------------- */

    function promptText() {
        const label = cwd === "/" ? "/" : basename(cwd);
        return `admin@Webintosh ${label} % `;
    }
    function renderPrompt() {
        promptEl.textContent = promptText();
    }
    function renderInput() {
        const v = kbd.value;
        const pos = kbd.selectionStart === null ? v.length : kbd.selectionStart;
        typedEl.textContent = v.slice(0, pos);
        cursorEl.textContent = v.charAt(pos) || " ";
        tailEl.textContent = v.slice(pos + 1);
    }
    function echoCommandLine(text) {
        print(promptText() + text);
    }

    /* ---------------- 路径与历史 ---------------- */

    function resolve(p) {
        if (!p) return cwd;
        if (p === "~") return "/";
        if (p.startsWith("~/")) p = p.slice(1);
        return p.startsWith("/") ? normPath(p) : joinPath(cwd, p);
    }
    function loadHistory() {
        try {
            const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
            return Array.isArray(arr) ? arr.slice(-HISTORY_MAX) : [];
        } catch (e) {
            return [];
        }
    }
    function pushHistory(cmd) {
        if (!cmd.trim()) return;
        if (history[history.length - 1] !== cmd) {
            history.push(cmd);
            if (history.length > HISTORY_MAX) history = history.slice(-HISTORY_MAX);
            try {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
            } catch (e) { /* 配额满则忽略 */ }
        }
        histIdx = history.length;
        histDraft = "";
    }

    /* ---------------- 分词（支持引号与 > / >> ） ---------------- */

    function tokenize(str) {
        const out = [];
        let cur = "";
        let quote = null;
        let hasToken = false;
        const flush = () => {
            if (cur || hasToken) out.push(cur);
            cur = "";
            hasToken = false;
        };
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (quote) {
                if (c === quote) quote = null;
                else cur += c;
            } else if (c === '"' || c === "'") {
                quote = c;
                hasToken = true;
            } else if (c === " " || c === "\t") {
                flush();
            } else if (c === ">") {
                flush();
                if (str[i + 1] === ">") {
                    out.push(">>");
                    i++;
                } else out.push(">");
            } else {
                cur += c;
            }
        }
        flush();
        return out;
    }

    /* ---------------- 工具函数 ---------------- */

    function fmtSize(n) {
        if (n < 1024) return n + " B";
        const units = ["KB", "MB", "GB", "TB"];
        let i = -1;
        do {
            n /= 1024;
            i++;
        } while (n >= 1024 && i < units.length - 1);
        return n.toFixed(n >= 10 ? 0 : 1) + " " + units[i];
    }
    function fmtTime(ms) {
        if (!ms) return "       --      ";
        const d = new Date(ms);
        const p = (x) => String(x).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    function uaShort() {
        const ua = navigator.userAgent;
        let m;
        if ((m = ua.match(/Edg\/([\d.]+)/))) return "Edge " + m[1];
        if ((m = ua.match(/Chrome\/([\d.]+)/))) return "Chrome " + m[1];
        if ((m = ua.match(/Version\/([\d.]+).*Safari/))) return "Safari " + m[1];
        if ((m = ua.match(/Firefox\/([\d.]+)/))) return "Firefox " + m[1];
        return ua.split(" ")[0];
    }
    function gpuName() {
        try {
            const canvas = document.createElement("canvas");
            const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (!gl) return "未知";
            const ext = gl.getExtension("WEBGL_debug_renderer_info");
            const raw = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
            return String(raw).replace(/^ANGLE \((.*)\)$/, "$1");
        } catch (e) {
            return "未知";
        }
    }
    async function copyRec(src, dst) {
        const kind = await vfs.exists(src);
        if (kind === "file") {
            await vfs.writeBytes(dst, await vfs.readBytes(src));
        } else if (kind === "dir") {
            await vfs.mkdir(dst);
            for (const e of await vfs.list(src)) {
                await copyRec(joinPath(src, e.name), joinPath(dst, e.name));
            }
        } else {
            throw new Error(`cp: ${src}: 没有那个文件或目录`);
        }
    }

    /* ---------------- 命令实现 ---------------- */

    const commands = {
        async help() {
            print("Webintosh 终端 — 可用命令：", "ok");
            const pad = Math.max(...HELP_TEXT.map(([u]) => u.length)) + 3;
            for (const [usage, desc] of HELP_TEXT) {
                const d = line();
                addSpan(d, "  " + usage.padEnd(pad), "ok");
                addSpan(d, desc);
            }
            scrollBottom();
        },

        async ls(args) {
            const flags = args.filter((a) => a.startsWith("-")).join("");
            const long = flags.includes("l");
            const target = resolve(args.find((a) => !a.startsWith("-")) || ".");
            const kind = await vfs.exists(target);
            if (kind === null) throw new Error(`ls: ${target}: 没有那个文件或目录`);
            if (kind === "file") {
                print(basename(target));
                return;
            }
            const entries = (await vfs.list(target)).sort((a, b) => {
                if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
                return a.name.localeCompare(b.name, "zh-Hans-CN");
            });
            if (!entries.length) return;
            if (long) {
                print(`总计 ${entries.length} 项`, "dim");
                for (const e of entries) {
                    const d = line();
                    addSpan(d, e.kind === "dir" ? "drwxr-xr-x  " : "-rw-r--r--  ", "dim");
                    addSpan(d, (e.kind === "dir" ? "--" : fmtSize(e.size)).padStart(8) + "  ");
                    addSpan(d, fmtTime(e.mtime) + "  ", "dim");
                    addSpan(d, e.name, e.kind === "dir" ? "dir" : "");
                }
            } else {
                const d = line();
                for (const e of entries) {
                    addSpan(d, e.name, "ls-item" + (e.kind === "dir" ? " dir" : ""));
                }
            }
            scrollBottom();
        },

        async cd(args) {
            const target = resolve(args[0] || "/");
            const kind = await vfs.exists(target);
            if (kind === null) throw new Error(`cd: ${args[0] || target}: 没有那个文件或目录`);
            if (kind !== "dir") throw new Error(`cd: ${args[0]}: 不是目录`);
            cwd = target;
        },

        async pwd() {
            print(cwd);
        },

        async cat(args) {
            if (!args.length) throw new Error("cat: 缺少文件参数");
            for (const a of args) {
                const p = resolve(a);
                const kind = await vfs.exists(p);
                if (kind === null) throw new Error(`cat: ${a}: 没有那个文件或目录`);
                if (kind === "dir") throw new Error(`cat: ${a}: 是一个目录`);
                const text = (await vfs.readText(p)).replace(/\n$/, "");
                for (const ln of text.split("\n")) print(ln);
            }
        },

        async echo(args) {
            let op = null;
            let idx = args.findIndex((a) => a === ">" || a === ">>");
            let textArgs = args;
            let target = null;
            if (idx !== -1) {
                op = args[idx];
                target = args[idx + 1];
                textArgs = args.slice(0, idx);
                if (!target) throw new Error("zsh: 解析错误：重定向后缺少文件名");
            }
            const text = textArgs.join(" ");
            if (!op) {
                print(text);
                return;
            }
            const p = resolve(target);
            if ((await vfs.exists(p)) === "dir") throw new Error(`zsh: ${target}: 是一个目录`);
            let content = text + "\n";
            if (op === ">>") {
                if ((await vfs.exists(p)) === "file") content = (await vfs.readText(p)) + content;
            }
            await vfs.writeText(p, content);
        },

        async mkdir(args) {
            if (!args.length) throw new Error("mkdir: 缺少目录参数");
            for (const a of args) {
                const p = resolve(a);
                if (await vfs.exists(p)) throw new Error(`mkdir: ${a}: 文件已存在`);
                await vfs.mkdir(p);
            }
        },

        async touch(args) {
            const files = args.filter((a) => !a.startsWith("-"));
            if (!files.length) throw new Error("touch: 缺少文件参数");
            for (const a of files) {
                const p = resolve(a);
                const kind = await vfs.exists(p);
                if (kind === "dir") continue;
                if (kind === "file") {
                    await vfs.writeBytes(p, await vfs.readBytes(p)); // 更新 mtime
                } else {
                    await vfs.writeBytes(p, new Uint8Array());
                }
            }
        },

        async rm(args) {
            const recursive = args.some((a) => /^-[rRf]+$/.test(a));
            const targets = args.filter((a) => !a.startsWith("-"));
            if (!targets.length) throw new Error("rm: 缺少路径参数");
            for (const a of targets) {
                const p = resolve(a);
                const kind = await vfs.exists(p);
                if (kind === null) throw new Error(`rm: ${a}: 没有那个文件或目录`);
                if (kind === "dir" && !recursive) throw new Error(`rm: ${a}: 是一个目录（请使用 rm -r）`);
                if (p === "/") throw new Error("rm: 拒绝删除根目录");
                await vfs.rm(p);
                if (cwd === p || cwd.startsWith(p + "/")) cwd = dirname(p);
            }
        },

        async mv(args) {
            const t = args.filter((a) => !a.startsWith("-"));
            if (t.length < 2) throw new Error("用法: mv <源> <目标>");
            const src = resolve(t[0]);
            let dst = resolve(t[1]);
            if ((await vfs.exists(src)) === null) throw new Error(`mv: ${t[0]}: 没有那个文件或目录`);
            if ((await vfs.exists(dst)) === "dir") dst = joinPath(dst, basename(src));
            if (src === dst) return;
            if (dst.startsWith(src + "/")) throw new Error(`mv: 不能把 ${t[0]} 移动到它自己的子目录里`);
            await vfs.mv(src, dst);
            if (cwd === src || cwd.startsWith(src + "/")) cwd = dst + cwd.slice(src.length);
        },

        async cp(args) {
            const t = args.filter((a) => !a.startsWith("-"));
            if (t.length < 2) throw new Error("用法: cp [-r] <源> <目标>");
            const recursive = args.some((a) => /^-[rR]+$/.test(a));
            const src = resolve(t[0]);
            let dst = resolve(t[1]);
            const kind = await vfs.exists(src);
            if (kind === null) throw new Error(`cp: ${t[0]}: 没有那个文件或目录`);
            if (kind === "dir" && !recursive) throw new Error(`cp: ${t[0]}: 是一个目录（请使用 cp -r）`);
            if ((await vfs.exists(dst)) === "dir") dst = joinPath(dst, basename(src));
            if (src === dst) throw new Error(`cp: ${t[0]} 和 ${t[1]} 是同一个文件`);
            if (dst.startsWith(src + "/")) throw new Error(`cp: 不能把 ${t[0]} 复制到它自己的子目录里`);
            await copyRec(src, dst);
        },

        async clear() {
            outputEl.textContent = "";
        },

        async date() {
            print(new Date().toLocaleString("zh-CN", { dateStyle: "full", timeStyle: "medium" }));
        },

        async whoami() {
            print("admin");
        },

        async uname(args) {
            if (args.includes("-a")) {
                print(`Webintosh webintosh.local 1.0.0 WebKernel/vfs-${vfs.backendName} ${navigator.platform} JavaScript`);
            } else {
                print("Webintosh");
            }
        },

        async history() {
            history.forEach((h, i) => print(`  ${String(i + 1).padStart(4)}  ${h}`));
        },

        async df() {
            if (!navigator.storage || !navigator.storage.estimate) {
                throw new Error("df: 此浏览器不支持 navigator.storage.estimate()");
            }
            const est = await navigator.storage.estimate();
            const quota = est.quota || 0;
            const usage = est.usage || 0;
            const pct = quota ? ((usage / quota) * 100).toFixed(1) + "%" : "--";
            print("文件系统        容量       已用       可用       使用率   挂载点", "dim");
            const free = Math.max(0, quota - usage);
            print(
                "opfs (浏览器)".padEnd(14) +
                fmtSize(quota).padStart(9) + "  " +
                fmtSize(usage).padStart(9) + "  " +
                fmtSize(free).padStart(9) + "  " +
                pct.padStart(7) + "   /"
            );
            if (vfs.backendName === "remote") {
                print("提示：当前后端为 remote，以上为本地 OPFS 配额统计。", "dim");
            }
        },

        async backend(args) {
            const want = args[0];
            if (!want) {
                print(`当前后端: ${vfs.backendName}`);
                return;
            }
            const name = await vfs.setBackend(want);
            print(`已切换到后端: ${name}`, "ok");
        },

        async open(args) {
            const name = args.join(" ").trim();
            if (!name) throw new Error("用法: open <应用名>，如 open 计算器");
            if (!window.moduleItems || typeof window.moduleItems.create !== "function") {
                throw new Error("open: 窗口管理器尚未就绪");
            }
            window.moduleItems.create("./assets/apps/" + name + ".html", name);
            print(`正在打开 “${name}”…`, "dim");
        },

        async neofetch() {
            const wrap = line();
            const nf = document.createElement("div");
            nf.className = "nf";
            wrap.appendChild(nf);

            const logo = document.createElement("div");
            logo.className = "nf-logo";
            APPLE_LOGO.forEach((ln, i) => {
                const d = document.createElement("div");
                d.className = LOGO_COLORS[i] || "nf-c6";
                d.textContent = ln;
                logo.appendChild(d);
            });
            nf.appendChild(logo);

            const info = document.createElement("div");
            info.className = "nf-info";
            const addInfo = (key, val) => {
                const d = document.createElement("div");
                if (key === null) {
                    d.textContent = val;
                } else if (key === "@title") {
                    addSpan(d, val, "nf-title");
                } else {
                    addSpan(d, key + ": ", "nf-key");
                    addSpan(d, val);
                }
                info.appendChild(d);
            };
            let storageLine = "未知";
            try {
                if (navigator.storage && navigator.storage.estimate) {
                    const est = await navigator.storage.estimate();
                    storageLine = `${fmtSize(est.usage || 0)} / ${fmtSize(est.quota || 0)}`;
                }
            } catch (e) { /* 忽略 */ }
            const up = Math.floor(performance.now() / 1000);
            const uptime = up >= 3600
                ? `${Math.floor(up / 3600)} 小时 ${Math.floor((up % 3600) / 60)} 分钟`
                : `${Math.floor(up / 60)} 分钟 ${up % 60} 秒`;

            addInfo("@title", "admin@Webintosh");
            addInfo(null, "----------------");
            addInfo("OS", "Webintosh OS 1.0 (Web)");
            addInfo("主机", `${uaShort()} · ${navigator.platform || "Web"}`);
            addInfo("内核", `WebKernel vfs-${vfs.backendName}`);
            addInfo("Shell", "zsh (Webintosh 终端)");
            addInfo("分辨率", `${screen.width}×${screen.height} @ ${window.devicePixelRatio || 1}x`);
            addInfo("GPU", gpuName());
            addInfo("存储", storageLine + ` (${vfs.backendName})`);
            addInfo("运行时长", uptime);
            addInfo("字体", "SF Mono 12pt");

            const sw = document.createElement("div");
            sw.className = "nf-swatches";
            ["#2e2e32", "#ff5f57", "#5fd765", "#f7d94c", "#4ba0ff", "#bf7af0", "#52c8d8", "#e9e9ea"].forEach((c) => {
                const i = document.createElement("i");
                i.style.background = c;
                sw.appendChild(i);
            });
            info.appendChild(sw);
            nf.appendChild(info);
            scrollBottom();
        },
    };

    /* ---------------- 执行 ---------------- */

    async function execute(raw) {
        const tokens = tokenize(raw);
        if (!tokens.length) return;
        const cmd = tokens[0];
        const args = tokens.slice(1);
        const fn = commands[cmd];
        if (!fn) {
            printErr(`zsh: command not found: ${cmd}`);
            return;
        }
        try {
            await fn(args, raw);
        } catch (e) {
            printErr(e && e.message ? e.message : String(e));
        }
    }

    async function submit() {
        if (busy) return;
        const raw = kbd.value;
        echoCommandLine(raw);
        kbd.value = "";
        renderInput();
        pushHistory(raw);
        busy = true;
        inputLine.classList.add("busy");
        try {
            await execute(raw);
        } finally {
            busy = false;
            inputLine.classList.remove("busy");
            renderPrompt();
            renderInput();
            scrollBottom();
        }
    }

    /* ---------------- Tab 补全 ---------------- */

    async function tabComplete() {
        const v = kbd.value;
        const pos = kbd.selectionStart === null ? v.length : kbd.selectionStart;
        if (pos !== v.length) return;
        const m = v.match(/(^|\s)(\S*)$/);
        if (!m) return;
        const partial = m[2];
        const dirPart = partial.includes("/") ? partial.slice(0, partial.lastIndexOf("/") + 1) : "";
        const prefix = partial.slice(dirPart.length);
        const listDir = dirPart ? resolve(dirPart) : cwd;
        let entries;
        try {
            entries = await vfs.list(listDir);
        } catch (e) {
            return;
        }
        const hits = entries.filter((e) => e.name.startsWith(prefix));
        if (!hits.length) return;
        if (hits.length === 1) {
            const e = hits[0];
            const completed = dirPart + e.name + (e.kind === "dir" ? "/" : " ");
            kbd.value = v.slice(0, v.length - partial.length) + completed;
        } else {
            let common = hits[0].name;
            for (const h of hits) {
                while (!h.name.startsWith(common)) common = common.slice(0, -1);
            }
            if (common.length > prefix.length) {
                kbd.value = v.slice(0, v.length - partial.length) + dirPart + common;
            } else {
                echoCommandLine(v);
                const d = line();
                hits.forEach((h) => addSpan(d, h.name, "ls-item" + (h.kind === "dir" ? " dir" : "")));
            }
        }
        kbd.setSelectionRange(kbd.value.length, kbd.value.length);
        renderInput();
        scrollBottom();
    }

    /* ---------------- 事件绑定 ---------------- */

    kbd.addEventListener("input", renderInput);
    kbd.addEventListener("keyup", renderInput);

    kbd.addEventListener("keydown", (e) => {
        if (e.isComposing) return;
        if (e.key === "Enter") {
            e.preventDefault();
            submit();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!history.length || histIdx <= 0) return;
            if (histIdx === history.length) histDraft = kbd.value;
            histIdx--;
            kbd.value = history[histIdx];
            kbd.setSelectionRange(kbd.value.length, kbd.value.length);
            renderInput();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (histIdx >= history.length) return;
            histIdx++;
            kbd.value = histIdx === history.length ? histDraft : history[histIdx];
            kbd.setSelectionRange(kbd.value.length, kbd.value.length);
            renderInput();
        } else if (e.key === "Tab") {
            e.preventDefault();
            tabComplete();
        } else if (e.key === "c" && e.ctrlKey) {
            e.preventDefault();
            print(promptText() + kbd.value + "^C");
            kbd.value = "";
            histIdx = history.length;
            renderInput();
        } else if (e.key === "l" && e.ctrlKey) {
            e.preventDefault();
            outputEl.textContent = "";
        } else if (e.key === "a" && e.ctrlKey) {
            e.preventDefault();
            kbd.setSelectionRange(0, 0);
            renderInput();
        } else if (e.key === "e" && e.ctrlKey) {
            e.preventDefault();
            kbd.setSelectionRange(kbd.value.length, kbd.value.length);
            renderInput();
        } else if (e.key === "u" && e.ctrlKey) {
            e.preventDefault();
            kbd.value = kbd.value.slice(kbd.selectionStart || 0);
            kbd.setSelectionRange(0, 0);
            renderInput();
        } else {
            requestAnimationFrame(renderInput);
        }
    });

    kbd.addEventListener("focus", () => root.classList.remove("term-blur"));
    kbd.addEventListener("blur", () => root.classList.add("term-blur"));

    // 点击窗口聚焦输入（保留划选复制能力）
    root.addEventListener("click", () => {
        const sel = window.getSelection();
        if (sel && String(sel).length) return;
        kbd.focus({ preventScroll: true });
    });

    /* ---------------- 标题栏 cols×rows ---------------- */

    function updateTitle() {
        if (!titleEl || !measureEl) return;
        const rect = measureEl.getBoundingClientRect();
        const charW = rect.width / 10 || 7.2;
        const lineH = rect.height || 16;
        const cols = Math.max(20, Math.floor((screenEl.clientWidth - 20) / charW));
        const rows = Math.max(5, Math.floor(screenEl.clientHeight / lineH));
        titleEl.textContent = `admin — -zsh — ${cols}×${rows}`;
    }
    if (window.ResizeObserver) {
        let first = true;
        const ro = new ResizeObserver(() => {
            if (first) {
                first = false; // 保留初始 80×24 文案
                return;
            }
            if (!root.isConnected) {
                ro.disconnect();
                return;
            }
            updateTitle();
        });
        ro.observe(root);
    }

    /* ---------------- 启动 ---------------- */

    renderPrompt();
    renderInput();
    print(
        "Last login: " +
        new Date().toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }) +
        " on ttys000",
        "dim"
    );
    print("输入 help 查看可用命令，neofetch 有彩蛋。", "dim");
    vfs.init().catch((e) => printErr("VFS 初始化失败: " + e.message));
    setTimeout(() => kbd.focus({ preventScroll: true }), 120);
}
