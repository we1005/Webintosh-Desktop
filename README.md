# Webintosh - 网页版 macOS Sequoia

<div align="center">

<img src="Logo.png" width="100" alt="Logo" />

![Webintosh 预览](https://img.shields.io/badge/macOS-Sequoia_15-red?style=for-the-badge&logo=apple)
![开源协议](https://img.shields.io/badge/License-GPL3-green?style=for-the-badge&logo=gnu)
![版本](https://img.shields.io/badge/Version-2.0-blue?style=for-the-badge)

**在浏览器中体验 macOS Sequoia 的优雅界面 —— 现在它是一个可用的 WebOS**

</div>

## 🌟 项目介绍

`Webintosh` 是一个开源项目，用现代 Web 技术精确还原 macOS Sequoia 的界面与交互，**完全在浏览器中运行，无需安装**。

在还原界面之上，它已经具备**真实可用的能力**：持久文件系统（OPFS / 可选 FastAPI 双后端）、访达 / 终端 / 文本编辑共享同一份文件、窗口内用 v86 真实启动 FreeDOS、WebGPU 驱动的音乐可视化，以及触屏设备自动切换的 iPhone 5s（iOS 7）形态。

**注意**：本项目仅用于**学习、研究和展示目的**，并非真正的操作系统。我们不隶属于 Apple Inc.，macOS 是 Apple Inc. 的注册商标。

## 📸 运行截图

<div align="center">
  <img src="screenshots/desktop.png" alt="桌面预览" width="800"/>
  <p><em>macOS Sequoia 风格的桌面界面</em></p>

  <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
    <img src="screenshots/settings.png" alt="系统设置" width="400"/>
    <img src="screenshots/about.png" alt="关于本机" width="400"/>
  </div>
</div>

## 🧬 Webintosh OS —— 完整可用的 WebOS

不再只是界面复刻：现在它有**真实的文件系统与应用生态**。

### 持久文件系统（双后端，可切换）
- 统一入口 `os/vfs.js`：访达、终端、文本编辑、桌面图标共享同一份文件，跨窗口实时同步（BroadcastChannel）。
- **OPFS 后端（默认）**：浏览器原生 Origin Private File System，零后端、纯静态部署即可用，刷新/重启浏览器数据不丢。
- **FastAPI 后端（可选）**：`cd server && ./.venv/bin/python main.py`（或 `uv venv && uv pip install -r requirements.txt`），默认端口 8787，数据落在 `server/data/`，并附带全站静态托管（单进程跑全部）。
- 切换方式任选：URL 参数 `?backend=remote`、终端命令 `backend remote` / `backend opfs`、或 localStorage `webintosh.backend`；远端不可达自动回退 OPFS。

### 内置应用
- **访达** —— 真实浏览/新建/重命名/删除文件，面包屑导航、返回/前进、右键菜单，双击文本文件直达文本编辑，VFS 变更自动刷新。
- **终端** —— 1:1 Terminal.app 外观：`ls/cd/cat/echo >/mkdir/rm/mv/cp/df/history/open/backend` 等全套命令对接 VFS，Tab 补全、↑↓ 历史、`neofetch` 彩蛋。
- **文本编辑** —— TextEdit 风格，Cmd+S 保存到 VFS，脏标记「已编辑」。
- **虚拟机** —— 基于 [v86](https://github.com/copy/v86)（Wasm x86 模拟器）在窗口里**真实启动 FreeDOS**（试试 `dir`，或 `invaders`/`tetris` 小游戏）；支持暂停/重启/Ctrl+Alt+Del/载入自定义 .img/.iso；运行时与镜像全部本地化（约 3MB），窗口不可见自动暂停 CPU。
- **桌面图标** —— `/Desktop` 目录实时渲染为桌面图标，双击打开。

### 📱 iPhone 5s 模式（iOS 7）
触屏小屏设备访问自动进入 `ios/`（桌面浏览器加 `?desktop` 强制桌面版，直接访问 `ios/` 可在 iPhone 5s 机身边框中预览）：
- 经典 iOS 7 锁屏：超细字重时钟、「滑动来解锁」流光、拖拽解锁 + SpringBoard 缩放淡入；
- 全 CSS/SVG 手绘扁平图标（日历显示真实日期、时钟真实走针）、毛玻璃 Dock、视差壁纸；
- 音乐 / Spotify 以 iOS 缩放动画全屏打开，home 横条返回；其余应用弹 iOS 7 风格对话框。

## ⚡ GPU 性能与音乐播放器

- **合成器路径动画** —— Dock 放大与窗口拖拽已改造为只触碰 `transform`（`scale` / `translate3d`）的 GPU 合成器路径：Dock 不再逐帧改写 `width/height`（旧实现每帧触发整条 Dock 重排），玻璃背景用 `scaleX` 跟随展宽；窗口拖拽期间只写 `translate3d`，松手一次性提交 `left/top`，并自动屏蔽 iframe 指针事件防止丢帧。
- **🎵 Spotify**（Dock 内置）—— 1:1 复刻暗色界面：资料库侧栏、悬停滑出的绿色播放钮、播放行均衡器动画、底部播放条，附全屏频谱可视化——**WebGPU（WGSL）渲染，WebGL2 自动回退**，AnalyserNode 实时 FFT 直传 GPU 纹理。
- **🍎 音乐（Apple Music）**（Dock 内置）—— 1:1 复刻浅色界面：顶部 LCD 播放器、半透明侧栏；沉浸式播放页：**WebGPU 域扭曲流体氛围背景**（随专辑配色与低频能量呼吸）、封面随播放状态弹簧缩放、逐行歌词（未唱行模糊淡出、点击跳转）。
- **运行时合成曲库**（`apps/music-core.js`）—— 8 首曲目 / 2 张专辑由 `OfflineAudioContext` 在独立线程离线合成（鼓组/贝斯/合成垫/琶音/卷积混响），专辑封面由 Canvas 程序化生成，**零外部音频与图片资源、零版权问题**。

## ✨ 特性

### 🖥️ 桌面环境
- **菜单栏** —— Apple 菜单、随焦点切换的应用菜单、状态图标、实时时钟
- **Dock** —— GPU 合成器路径放大动画、运行指示灯、点击启动 / 最小化恢复
- **窗口管理** —— 拖动、缩放、红黄绿灯（关闭 / 最小化飞入 Dock / 全屏）、双击拉伸、焦点置顶
- **桌面** —— 右键菜单（新建文件夹 / 文本文件，写入文件系统）、`/Desktop` 实时图标、启动台

### 🧩 内置应用
访达、终端、文本编辑、虚拟机（FreeDOS）、Spotify、音乐（Apple Music）、计算器、系统设置、关于本机、Safari

### 🎨 视觉与性能
- Sequoia 设计语言：色彩、阴影、毛玻璃、圆角窗口
- 动画走 `transform` / `opacity` 合成器路径，主线程零布局抖动
- 可视化特效 WebGPU 优先、WebGL2 自动回退

## 🗺️ 路线图 / 已知差距

已识别、尚待打磨的 macOS 还原度差距（详见 [架构说明](docs/架构说明.md)）：

- [ ] 菜单栏"文件/编辑/显示/前往/窗口/帮助"下拉菜单内容（目前仅  与访达菜单可展开）
- [ ] 访达工具栏：面包屑移至底部路径栏、补搜索框与视图切换段控
- [ ] 红绿灯悬停显示 `✕ − +` 符号
- [ ] "关于本机"窗口改为接近不透明的浅灰面板
- [ ] 菜单栏时钟半角冒号、日期格式贴近 macOS

## 🚀 快速开始

整个项目是**纯静态站点**，无需构建、无需安装依赖。只需一个静态服务器，并通过 HTTP 访问（不能用 `file://` 直接打开）。**现已合并为单一自包含仓库**（开机流程在 `boot-experience/` 子目录）。

```bash
# 以 Webintosh-Desktop 为 Web 根
cd /path/to/Webintosh-Desktop
python3 -m http.server 8765
```

浏览器打开任一入口：

| 入口 | 地址 |
|------|------|
| **桌面（直接进）** | http://localhost:8765/?desktop |
| **完整开机流程** | http://localhost:8765/boot-experience/ （登录密码：`Ventura` / `Sonoma` / `Sequoia`） |
| **iPhone 5s 模式** | http://localhost:8765/ios/ |

默认文件系统用浏览器 **OPFS**，数据持久保存、**无需后端**。

### 可选：启动 FastAPI 后端（服务器存储 / 多端共享）

仅当你想把文件系统切到「服务器存储」时才需要。后端代码在 `server/`（已随仓库提供；`server/.venv` 与 `server/data` 不入库，按下面步骤本地生成）。

```bash
cd server
# 首次：创建虚拟环境并装依赖（用 uv；也可用 python -m venv）
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
# 启动（默认 0.0.0.0:8787，并静态托管整个站点）
./.venv/bin/python main.py
```

启动后，可只用这一个进程访问全站并启用后端：

```
http://localhost:8787/?backend=remote
```

切换后端的三种方式（任选）：URL 参数 `?backend=remote`、终端命令 `backend remote` / `backend opfs`、或 localStorage `webintosh.backend`；远端不可达会自动回退 OPFS。

📖 **详细文档：**
- [启动与使用指南](docs/启动与使用.md) —— 启动方式、入口区别、各应用用法、常见问题
- [架构说明](docs/架构说明.md) —— 目录结构、文件系统、窗口/应用机制、GPU 渲染、测试方法

### 在线体验
**主项目:** [https://mengobs.github.io/Webintosh](https://mengobs.github.io/Webintosh)　**桌面部分:** [https://mengobs.github.io/Webintosh-Desktop](https://mengobs.github.io/Webintosh-Desktop)

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| `HTML 5` | 语义化结构和内容 |
| `CSS 3` | 样式、动画、合成器路径动画（transform/opacity） |
| `JavaScript (ES Module)` | 交互逻辑与状态管理 |
| `OPFS / IndexedDB` | 浏览器端持久文件系统（默认后端，零依赖） |
| `WebGPU / WebGL2` | 频谱可视化、流体氛围背景（WebGPU 优先，WebGL2 回退） |
| `Web Audio (OfflineAudioContext)` | 曲目离线合成、播放与实时频谱分析 |
| `WebAssembly (v86)` | 「虚拟机」应用：窗口内真实启动 FreeDOS |
| `Python (FastAPI)` | 可选后端：文件系统 REST API + 全站静态托管 |

## 📝 许可证

本项目采用 GPL-3.0 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- **Apple Inc.** - 为我们提供优秀的 macOS 设计灵感
- **[macOSicons](https://macosicons.com/)** - 部分应用图标（密码、iPhone 镜像、博客、无边记等）来自该社区图标库
- **[v86](https://github.com/copy/v86)** - 「虚拟机」应用的 x86 模拟器
- **所有贡献者** - 感谢每一位为项目做出贡献的人
- **开源社区** - 感谢提供的各种工具和库

## ⚠️ 免责声明

本项目是 macOS 用户界面的非官方网页版实现，仅供学习和研究使用。所有 Apple、macOS 和相关商标均为 Apple Inc. 的财产。本项目与 Apple Inc. 没有任何关联。

## 📞 联系与支持

- **问题反馈**: [GitHub Issues](https://github.com/mengobs/webintosh/issues)
- **讨论区**: [GitHub Discussions](https://github.com/mengobs/webintosh/discussions)
- **邮件**: 1825456084@qq.com

---

<div align="center">
  
**如果喜欢这个项目，请给它一个 ⭐️Star**

[![Star History Chart](https://api.star-history.com/svg?repos=mengobs/webintosh&type=Date)](https://star-history.com/#mengobs/webintosh&Date)

[![Star History Chart](https://api.star-history.com/svg?repos=mengobs/webintosh-desktop&type=Date)](https://star-history.com/#mengobs/webintosh-desktop&Date)

</div>
