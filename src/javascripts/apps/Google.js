// Google —— Google 搜索首页（通用版，原生 JS）
// 通过 create('./assets/apps/Google.html','Google') 打开；脚本注入后自执行。
// 注意：Google 禁止 iframe 嵌入，故搜索/手气不错在新标签页打开真实结果。
(() => {
  const win = document.getElementById("Google");
  if (!win) return;

  const input = win.querySelector(".g-input");
  // 防重入：同一窗口已初始化则跳过（脚本可能被多次注入）
  if (!input || input._googleInited) return;
  input._googleInited = true;

  const searchBtn = win.querySelector(".g-search-btn");
  const luckyBtn = win.querySelector(".g-lucky-btn");
  const navLinks = win.querySelectorAll(".g-nav-link");

  function doSearch(lucky) {
    const q = (input.value || "").trim();
    if (!q) {
      input.focus();
      return;
    }
    const base = "https://www.google.com/search?q=" + encodeURIComponent(q);
    // 手气不错：附带 btnI 参数，尽量直达首条结果
    const url = lucky ? base + "&btnI=I" : base;
    window.open(url, "_blank");
  }

  if (searchBtn) searchBtn.addEventListener("click", () => doSearch(false));
  if (luckyBtn) luckyBtn.addEventListener("click", () => doSearch(true));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch(false);
    }
  });

  // 顶部导航：纯视觉链接，点击在新标签页打开对应 Google 服务
  navLinks.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const go = a.dataset.go;
      if (go) window.open(go, "_blank");
    });
  });

  // 自动聚焦输入框（窗口动画稳定后）
  setTimeout(() => {
    if (document.body.contains(input)) input.focus();
  }, 200);
})();
