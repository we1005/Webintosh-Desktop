import { createAlert } from "./ui/alert.js";
import { updateMenu } from "./finderbar.js";

let fd = document.querySelector(".finderbar");
export let zIndex = 5;
window.specialCloses = {};

let activeDraggingWindow = null;
let activeResizingWindow = null;

// 任何入口（Dock/菜单/终端 open/访达）打开应用都同步 Dock 运行灯与状态
function syncDockLight(name, on) {
  if (window.appStatus) window.appStatus[name] = on;
  if (name === "启动台") return;   // 启动台是覆盖层，macOS 不显示运行灯
  let img = document.querySelector(`#dock img[alt="${name}"]`);
  if (!img && on) {
    // 不在 Dock 的应用（如桌面/访达双击文件打开）临时加入，关闭后随 transient 标记移除
    // 动态 import 避免与 dock.js 的静态循环依赖
    import("./dock.js").then(m => {
      m.addToDock(name);
      const di = document.querySelector(`#dock img[alt="${name}"]`);
      const light = di && di.closest(".container").querySelector(".light");
      if (light) light.classList.add("on");
    });
    return;
  }
  if (!img) return;
  const container = img.closest(".container");
  if (!on && container && container.dataset.transient === "1") {
    // 非常驻应用（从启动台临时加入 Dock）关闭后从 Dock 移除
    container.remove();
    return;
  }
  const light = container && container.querySelector(".light");
  if (light) light.classList.toggle("on", on);
}

export function create(file, name, light = null, centered = false) {
  const cleanFile = file.split("/").pop().split(".")[0];
  if (!name) name = cleanFile;
  const existing = document.getElementById(name);
  if (existing) {
    // 已最小化的窗口：恢复；否则置顶
    if (existing.isMinimized && existing._restoreWindow) existing._restoreWindow();
    else bringToFront(existing, name);
    return;
  }
  syncDockLight(name, true);

  // 缓存破坏:HTML/CSS 与 JS 保持一致地带版本戳,否则改了 HTML/CSS 普通刷新看不到
  const bust = `?v=${Date.now()}`;
  fetch(file + bust)
    .then((response) => {
      if (response.status !== 200) {
        createAlert(
          "./assets/icons/访达.svg",
          "加载 App 时遇到错误",
          `此 App 仍在开发中<br/>服务器返回状态码: ${response.status}`,
          "好",
          "close",
        );
        return;
      }
      response.text().then((content) => {
        document.body.insertAdjacentHTML("beforeend", content);
        const wins = document.querySelectorAll(".window");
        if (wins.length) {
          const newWin = wins[wins.length - 1];
          if (newWin && !newWin.id) newWin.id = name;

          if (centered) {
            newWin.style.left = `${(window.innerWidth - newWin.offsetWidth) / 2}px`;
            newWin.style.top = `${(window.innerHeight - newWin.offsetHeight) / 2}px`;
            setTimeout(() => {
              newWin.style.left = `${(window.innerWidth - newWin.offsetWidth) / 2}px`;
              newWin.style.top = `${(window.innerHeight - newWin.offsetHeight) / 2}px`;
            }, 50);
          }

          const resizer = document.createElement("div");
          resizer.className = "resizer";
          newWin.appendChild(resizer);
          addResizeListener(newWin, resizer);

          // 新窗口即获得焦点:置顶并把菜单栏切到该应用(macOS 行为)
          bringToFront(newWin, name);
        }
        let script = document.createElement("script");
        script.src = `./src/javascripts/apps/${cleanFile}.js${bust}`;
        script.type = "module";
        script.setAttribute("app", cleanFile);
        document.body.appendChild(script);
        let link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `./assets/stylesheets/apps/${cleanFile}/index.css${bust}`;
        document.querySelector("head").appendChild(link);
      });
    })
    .catch((error) => {
      console.error("Error opening app:", error);
    });
  setTimeout(() => {
    resetWindowListeners(name, light);
  }, 150);
  setTimeout(() => {
    resetWindowListeners(name, light);
  }, 300);
  setTimeout(() => {
    resetWindowListeners(name, light);
  }, 450);
}

// 通用设置窗口位置（大小）的函数
export function setWindowPosition(win, left, top, width, height, zIndex) {
  if (left !== undefined) win.style.left = left;
  if (top !== undefined) win.style.top = top;
  if (width !== undefined) win.style.width = width;
  if (height !== undefined) win.style.height = height;
  if (zIndex !== undefined) win.style.zIndex = zIndex;
}

export function resetWindowListeners(name, light = null) {
  let windows = document.querySelectorAll(".window");
  windows.forEach((win) => {
    // create() 会在 150/300/450ms 重试三次且遍历所有窗口，
    // 不加守卫会给每个窗口重复绑定拖拽/按钮监听
    if (win._wmBound) return;
    win._wmBound = true;

    let closeBtn = win.querySelector(".wintools .red");
    let miniBtn =
      win.querySelector(".wintools .yellow") ||
      win.querySelectorAll(".wintools .gray")[0];
    let zoomBtn =
      win.querySelector(".wintools .green") ||
      win.querySelectorAll(".wintools .gray")[1];

    if (!win.isStretched) win.isStretched = false;

    // 关闭窗口
    const closeWindow = () => {
      win.remove();
      const s = document.querySelector(`script[app="${name}"]`);
      if (s) s.remove();
      if (light) light.classList.remove("on");
      syncDockLight(name, false);
    };

    // 切换拉伸窗口至桌面空白（保留顶部状态栏和底部dock的全屏）
    const toggleStretchWindow = (withTransition = true) => {
      if (withTransition) {
        win.style.transition =
          "left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease";
      }
      if (!win.isStretched) {
        const finderbar = document.getElementById("finderbar");
        const dock = document.getElementsByClassName("dockcontainer")[0];
        const finderbarHeight = finderbar ? finderbar.offsetHeight : 0;
        const dockHeight = dock ? dock.offsetHeight : 0;
        win._preStretchState = {
          left: win.style.left,
          top: win.style.top,
          width: win.style.width,
          height: win.style.height,
        };
        setWindowPosition(
          win,
          "0",
          finderbarHeight + "px",
          "100vw",
          `calc(100vh - ${finderbarHeight}px - ${dockHeight}px)`,
        );
        win.isStretched = true;
      } else {
        if (win._preStretchState) {
          setWindowPosition(
            win,
            win._preStretchState.left,
            win._preStretchState.top,
            win._preStretchState.width,
            win._preStretchState.height,
          );
        }
        win.isStretched = false;
      }
      if (withTransition) {
        setTimeout(() => {
          win.style.transition = "";
        }, 300);
      }
    };
    // 切换全屏窗口至桌面
    const toggleFullscreenWindow = (withTransition = true) => {
      if (withTransition) {
        win.style.transition =
          "left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease";
      }
      if (!win.isFullscreen) {
        win._preFullscreenState = {
          left: win.style.left,
          top: win.style.top,
          width: win.style.width,
          height: win.style.height,
          zIndex: win.style.zIndex,
        };
        setWindowPosition(win, "0", "0", "100vw", `100vh`, 2050);
        win.isFullscreen = true;
      } else {
        if (win._preFullscreenState) {
          setWindowPosition(
            win,
            win._preFullscreenState.left,
            win._preFullscreenState.top,
            win._preFullscreenState.width,
            win._preFullscreenState.height,
            win._preFullscreenState.zIndex,
          );
        }
        win.isFullscreen = false;
      }
      if (withTransition) {
        setTimeout(() => {
          win.style.transition = "";
        }, 300);
      }
    };

    // 最小化：缩入 Dock 方向，点击 Dock 图标恢复
    const minimizeWindow = () => {
      if (win.isMinimized) return;
      win.isMinimized = true;
      const dock = document.getElementById("dock");
      const dr = dock ? dock.getBoundingClientRect() : { x: innerWidth / 2, y: innerHeight };
      const wr = win.getBoundingClientRect();
      const dx = dr.x + dr.width / 2 - (wr.x + wr.width / 2);
      const dy = dr.y - (wr.y + wr.height / 2);
      win.style.transition = "transform 0.34s cubic-bezier(0.5, 0.05, 0.4, 1), opacity 0.34s ease";
      win.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.08)`;
      win.style.opacity = "0";
      setTimeout(() => {
        win.style.visibility = "hidden";
        win.style.transition = "";
        win.style.transform = "";
        win.style.opacity = "";
      }, 360);
    };
    const restoreWindow = () => {
      if (!win.isMinimized) return;
      win.isMinimized = false;
      win.style.visibility = "";
      const dock = document.getElementById("dock");
      const dr = dock ? dock.getBoundingClientRect() : { x: innerWidth / 2, y: innerHeight };
      const wr = win.getBoundingClientRect();
      const dx = dr.x + dr.width / 2 - (wr.x + wr.width / 2);
      const dy = dr.y - (wr.y + wr.height / 2);
      win.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.08)`;
      win.style.opacity = "0";
      requestAnimationFrame(() => requestAnimationFrame(() => {
        win.style.transition = "transform 0.34s cubic-bezier(0.2, 0.8, 0.3, 1.05), opacity 0.3s ease";
        win.style.transform = "";
        win.style.opacity = "1";
        setTimeout(() => {
          win.style.transition = "";
          win.style.opacity = "";
        }, 380);
      }));
      bringToFront(win, name);
    };

    win._closeWindow = closeWindow;
    win._toggleStretchWindow = toggleStretchWindow;
    win._toggleFullscreenWindow = toggleFullscreenWindow;
    win._minimizeWindow = minimizeWindow;
    win._restoreWindow = restoreWindow;

    addWindowDrag(win, name);

    // 点击关闭按钮关闭窗口
    if (closeBtn) closeBtn.addEventListener("click", () => closeWindow());
    // 点击最小化按钮最小化窗口
    if (miniBtn) miniBtn.addEventListener("click", () => minimizeWindow());
    // 点击最大化按钮最大化窗口
    if (zoomBtn)
      zoomBtn.addEventListener("click", () => toggleFullscreenWindow());

    // 双击窗口标题栏切换拉伸窗口至桌面空白（保留顶部状态栏和底部dock的全屏）
    // 优先整个 .topbar（macOS 行为），无标题栏的窗口退回 .wintools
    const wintools = win.querySelector(".topbar") || win.querySelector(".wintools");
    if (wintools) {
      wintools.addEventListener("dblclick", (e) => {
        if (
          !e.target.closest(".red") &&
          !e.target.closest(".yellow") &&
          !e.target.closest(".green") &&
          !e.target.closest(".gray")
        ) {
          toggleStretchWindow();
        }
      });
    }

    win.addEventListener("mousedown", function (e) {
      if (!e.target.closest(".wintools div")) {
        bringToFront(win, name);
      }
    });
  });
}

/* ------------------------------------------------------------
 * 拖拽 / 缩放 —— GPU 合成器路径：
 * - 拖动期间只写 transform: translate3d（不触发布局），松手时一次性
 *   提交 left/top 并清除 transform；
 * - mousemove 统一收敛到 requestAnimationFrame，避免高频写样式；
 * - 交互期间 body.wm-interacting 屏蔽 iframe 指针事件，防止光标滑入
 *   iframe 后丢失 mousemove。
 * ------------------------------------------------------------ */

let dragRaf = 0;
let resizeRaf = 0;
let resizeLastEvent = null;

function setInteracting(on) {
  document.body.classList.toggle("wm-interacting", on);
}

function addWindowDrag(windowElement, name) {
  windowElement.addEventListener("mousedown", function (e) {
    if (e.target.closest(".wintools div") || e.target.closest(".resizer")) {
      return;
    }

    const rect = windowElement.getBoundingClientRect();
    activeDraggingWindow = {
      element: windowElement,
      name: name,
      grabX: e.clientX - rect.left,
      grabY: e.clientY - rect.top,
      startLeft: rect.left,
      startTop: rect.top,
      lastX: e.clientX,
      lastY: e.clientY,
      targetLeft: rect.left,
      targetTop: rect.top,
    };

    windowElement.style.willChange = "transform";
    setInteracting(true);
    bringToFront(windowElement, name);
    e.preventDefault();
  });
}

function applyDrag() {
  dragRaf = 0;
  const d = activeDraggingWindow;
  if (!d) return;
  const minY = fd ? fd.offsetHeight : 0;
  d.targetLeft = d.lastX - d.grabX;
  d.targetTop = Math.max(minY, d.lastY - d.grabY);
  d.element.style.transform =
    `translate3d(${d.targetLeft - d.startLeft}px, ${d.targetTop - d.startTop}px, 0)`;
}

// 拖动中退出最大化/拉伸后窗口几何改变：以当前光标重新锚定
function reanchorDrag(d) {
  const w = d.element.offsetWidth;
  d.grabX = Math.min(d.grabX, Math.max(40, w - 40));
  d.startLeft = d.lastX - d.grabX;
  d.startTop = Math.max(fd ? fd.offsetHeight : 0, d.lastY - d.grabY);
  d.element.style.left = d.startLeft + "px";
  d.element.style.top = d.startTop + "px";
  d.element.style.transform = "";
}

function applyResize() {
  resizeRaf = 0;
  const win = activeResizingWindow;
  if (!win || !resizeLastEvent) return;
  const rect = win.getBoundingClientRect();
  const newWidth = resizeLastEvent.clientX - rect.left;
  const newHeight = resizeLastEvent.clientY - rect.top;
  if (newWidth > 200) win.style.width = newWidth + "px";
  if (newHeight > 150) win.style.height = newHeight + "px";
}

document.addEventListener("mousemove", function (e) {
  if (activeDraggingWindow) {
    const d = activeDraggingWindow;
    d.lastX = e.clientX;
    d.lastY = e.clientY;

    if (d.element.isStretched && d.element._toggleStretchWindow) {
      d.element._toggleStretchWindow(false);
      reanchorDrag(d);
    }
    if (d.element.isFullscreen && d.element._toggleFullscreenWindow) {
      d.element._toggleFullscreenWindow(false);
      reanchorDrag(d);
    }

    if (!dragRaf) dragRaf = requestAnimationFrame(applyDrag);
  }

  if (activeResizingWindow) {
    resizeLastEvent = e;
    if (!resizeRaf) resizeRaf = requestAnimationFrame(applyResize);
  }
});

function addResizeListener(windowElement, resizer) {
  resizer.addEventListener("mousedown", function (e) {
    activeResizingWindow = windowElement;
    setInteracting(true);
    e.preventDefault();
  });
}

document.addEventListener("mouseup", function () {
  if (activeDraggingWindow) {
    const d = activeDraggingWindow;
    // 提交最终位置，回到无 transform 状态
    d.element.style.left = d.targetLeft + "px";
    d.element.style.top = d.targetTop + "px";
    d.element.style.transform = "";
    d.element.style.willChange = "";
    updateMenu(d.name);
    activeDraggingWindow = null;
  }
  activeResizingWindow = null;
  setInteracting(false);
});

export function bringToFront(windowElement, name) {
  zIndex += 1;
  windowElement.style.zIndex = zIndex;
  updateMenu(name);
}
