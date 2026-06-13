// Calculator —— 源级移植 thanas-os CalculatorApp.tsx（原生 JS）
// 逻辑 1:1 还原：连续运算、百分比、正负号、清除(AC/C)、退格、显示格式化、键盘输入。
(() => {
    const win = document.getElementById("Calculator") || document.querySelector(".calculatorapp.window");
    if (!win || win.dataset.bound === "1") return;
    win.dataset.bound = "1";

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

    const resultEl = win.querySelector("#calc-result") || win.querySelector(".calc-result");
    const clearBtn = win.querySelector('[data-action="clear"]');
    const clearGlyph = clearBtn ? clearBtn.querySelector(".calc-glyph") : null;

    /* ---------- 状态 ---------- */
    let display = "0";
    let accumulator = null; // number | null
    let operator = null;    // '+' | '-' | '*' | '/' | null
    let waitingForNew = false;

    /* ---------- 显示格式化（照搬源 formatNum） ---------- */
    function formatNum(n) {
        if (!Number.isFinite(n)) return "Error";
        const abs = Math.abs(n);
        if (abs !== 0 && (abs < 1e-6 || abs >= 1e10)) {
            return n.toExponential(5).replace(/\.?0+e/, "e");
        }
        return parseFloat(n.toFixed(8)).toString();
    }

    function render() {
        if (resultEl) resultEl.textContent = display;
        // AC / C 标签随状态切换（源 clearLabel 逻辑）
        const allClear = display === "0" && accumulator === null && operator === null && !waitingForNew;
        if (clearGlyph) clearGlyph.textContent = allClear ? "AC" : "C";
        if (clearBtn) clearBtn.setAttribute("aria-label", allClear ? "AC" : "C");
    }

    /* ---------- 运算 ---------- */
    function compute(a, b, op) {
        switch (op) {
            case "+": return a + b;
            case "-": return a - b;
            case "*": return a * b;
            case "/": return b === 0 ? NaN : a / b;
            default: return b;
        }
    }

    function inputDigit(d) {
        if (waitingForNew) {
            waitingForNew = false;
            display = d;
        } else if (display === "0") {
            display = d;
        } else if (display.replace(/[^0-9]/g, "").length >= 9) {
            // 上限 9 位有效数字，保持不变
        } else {
            display = display + d;
        }
        render();
    }

    function inputDecimal() {
        if (waitingForNew) {
            display = "0.";
            waitingForNew = false;
        } else if (!display.includes(".")) {
            display = display + ".";
        }
        render();
    }

    function clearAll() {
        display = "0";
        accumulator = null;
        operator = null;
        waitingForNew = false;
        render();
    }

    function clearEntryOrAll() {
        const allClear = display === "0" && accumulator === null && operator === null && !waitingForNew;
        if (allClear) {
            clearAll();
            return;
        }
        display = "0";
        waitingForNew = false;
        render();
    }

    function toggleSign() {
        if (display.startsWith("-")) {
            display = display.slice(1);
        } else if (display !== "0") {
            display = "-" + display;
        }
        render();
    }

    function percent() {
        const n = parseFloat(display);
        if (!Number.isNaN(n)) display = formatNum(n / 100);
        render();
    }

    function backspace() {
        if (waitingForNew) return;
        if (display.length <= 1 || (display.length === 2 && display.startsWith("-"))) {
            display = "0";
        } else {
            display = display.slice(0, -1);
        }
        render();
    }

    function setOp(next) {
        const value = parseFloat(display);
        if (accumulator === null) {
            accumulator = value;
        } else if (!waitingForNew && operator) {
            const result = compute(accumulator, value, operator);
            accumulator = result;
            waitingForNew = true;
            operator = next;
            display = formatNum(result);
            render();
            return;
        }
        operator = next;
        waitingForNew = true;
        render();
    }

    function equals() {
        if (operator === null || accumulator === null) return;
        const value = parseFloat(display);
        const result = compute(accumulator, value, operator);
        accumulator = null;
        operator = null;
        waitingForNew = true;
        display = formatNum(result);
        render();
    }

    /* ---------- 按钮绑定 ---------- */
    win.querySelectorAll(".calc-key").forEach((btn) => {
        on(btn, "click", () => {
            const digit = btn.dataset.digit;
            const op = btn.dataset.op;
            const action = btn.dataset.action;
            if (op) { setOp(op); return; }
            if (digit != null) { inputDigit(digit); return; }
            switch (action) {
                case "decimal": inputDecimal(); break;
                case "clear": clearEntryOrAll(); break;
                case "percent": percent(); break;
                case "sign": toggleSign(); break;
                case "backspace": backspace(); break;
                case "equals": equals(); break;
            }
        });
    });

    /* ---------- 键盘输入（仅当本窗口为最前台时响应） ---------- */
    function isActive() {
        // 取 z-index 最高的 .window 作为前台判定
        let top = null;
        let topZ = -Infinity;
        document.querySelectorAll(".window").forEach((w) => {
            const z = parseInt(getComputedStyle(w).zIndex, 10) || 0;
            if (z >= topZ) { topZ = z; top = w; }
        });
        return top === win;
    }

    on(document, "keydown", (e) => {
        if (!isActive()) return;
        const k = e.key;
        if (k >= "0" && k <= "9") { inputDigit(k); return; }
        if (k === "." || k === ",") { inputDecimal(); return; }
        if (k === "+") { setOp("+"); }
        else if (k === "-") { setOp("-"); }
        else if (k === "*") { setOp("*"); }
        else if (k === "/") { e.preventDefault(); setOp("/"); }
        else if (k === "Enter" || k === "=") { e.preventDefault(); equals(); }
        else if (k === "Escape" || k === "c" || k === "C") { clearAll(); }
        else if (k === "Backspace") { backspace(); }
        else if (k === "%") { percent(); }
    });

    render();
})();
