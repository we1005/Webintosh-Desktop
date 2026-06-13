// LinkedIn —— 通用模板版个人主页（静态内容，原生 JS）
// 通过 create('./assets/apps/LinkedIn.html','LinkedIn') 打开；脚本注入后自执行。
(() => {
  const win =
    document.getElementById("LinkedIn") ||
    document.querySelector(".linkedinapp.window");
  // 防重入：脚本可能在重开时被再次注入，已绑定则跳过
  if (!win || win.dataset.linkedinBound === "1") return;
  win.dataset.linkedinBound = "1";

  // 窗口移除时停止监听，避免泄漏
  const ac = new AbortController();
  const mo = new MutationObserver(() => {
    if (!document.body.contains(win)) {
      ac.abort();
      mo.disconnect();
    }
  });
  mo.observe(document.body, { childList: true });
  const on = (el, ev, fn) =>
    el && el.addEventListener(ev, fn, { signal: ac.signal });

  // 顶部操作按钮：纯演示交互（Follow 切换关注态）
  const followBtn = win.querySelector(".btn-primary");
  on(followBtn, "click", () => {
    const following = followBtn.dataset.following === "1";
    followBtn.dataset.following = following ? "0" : "1";
    followBtn.textContent = following ? "Follow" : "Following";
  });

  const messageBtn = win.querySelector(".btn-secondary");
  on(messageBtn, "click", () => {
    messageBtn.textContent = "Message sent";
    setTimeout(() => {
      if (document.body.contains(messageBtn)) messageBtn.textContent = "Message";
    }, 1500);
  });
})();
