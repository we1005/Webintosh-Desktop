/*
 * 音乐播放器 —— 移植自 thanas-os 的 Apple Music 风格音乐 App（MIT 许可，可借鉴）。
 * 原生 ES module，无 React。注入后自执行，独立窗口 + 独立 <audio> 实例，
 * 与现有「音乐」/「Spotify」App 互不干扰。
 *
 * 设计借鉴 thanas-os/src/lib/nowPlaying.ts：
 *  - 单个惰性创建的 HTMLAudioElement 驱动播放
 *  - playTrack / togglePlay / next / prev / seekTo / setVolume
 *  - timeupdate 更新进度，ended 自动下一首
 * 但音频源改用免版权的 SoundHelix demo mp3（thanas-os 用 iTunes 30s 预览，这里不依赖外网商用 CDN），
 * 封面用纯 CSS 渐变占位（不下载大图）。
 */
(() => {
    const win =
        document.getElementById("音乐播放器") ||
        document.querySelector(".musicplayerapp.window");
    // 防重入：create() 注入脚本可能在某些场景重复执行，guard 避免重复绑定
    if (!win || win.dataset.bound === "1") return;
    win.dataset.bound = "1";

    /* ---------- 生命周期：窗口移除时停止播放 + 解绑 ---------- */
    const ac = new AbortController();
    const on = (el, ev, fn, opts) =>
        el && el.addEventListener(ev, fn, { signal: ac.signal, ...(opts || {}) });

    const mo = new MutationObserver(() => {
        if (!document.body.contains(win)) {
            try {
                audio.pause();
                audio.src = "";
            } catch (e) { /* 忽略 */ }
            ac.abort();
            mo.disconnect();
        }
    });
    mo.observe(document.body, { childList: true });

    /* ---------- 曲目数据（免版权示例音频） ---------- */
    // 封面用渐变占位（gradient 字符串），不下载图片
    const TRACKS = [
        {
            title: "Sunrise Drive",
            artist: "SoundHelix",
            album: "Demo Sessions",
            src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            cover: "linear-gradient(135deg,#ff6a5a,#fa2d48)"
        },
        {
            title: "Neon Skyline",
            artist: "SoundHelix",
            album: "Demo Sessions",
            src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            cover: "linear-gradient(135deg,#7b6cff,#4a3aff)"
        },
        {
            title: "Coastal Wind",
            artist: "SoundHelix",
            album: "Open Roads",
            src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
            cover: "linear-gradient(135deg,#36d1dc,#1d8fae)"
        },
        {
            title: "Midnight Bloom",
            artist: "SoundHelix",
            album: "Open Roads",
            src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
            cover: "linear-gradient(135deg,#f7971e,#ffce54)"
        }
    ];

    const VIEW_META = {
        songs: { title: "歌曲", sub: "资料库中的全部曲目" },
        albums: { title: "专辑", sub: "按专辑浏览" },
        artists: { title: "艺人", sub: "按艺人浏览" },
        favorites: { title: "我喜欢的", sub: "已收藏的曲目" }
    };

    /* ---------- 状态 ---------- */
    let currentIndex = -1; // TRACKS 中正在播放的索引
    let currentView = "songs";
    const favorites = new Set();

    /* ---------- 独立 audio 实例 ---------- */
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = 0.7;

    /* ---------- 元素 ---------- */
    const listEl = win.querySelector(".mp-track-list");
    const emptyEl = win.querySelector(".mp-empty");
    const viewTitleEl = win.querySelector(".mp-view-title");
    const viewSubEl = win.querySelector(".mp-view-sub");
    const navItems = win.querySelectorAll(".mp-nav-item");

    const nowCover = win.querySelector(".mp-now-cover");
    const nowTitle = win.querySelector(".mp-now-title");
    const nowArtist = win.querySelector(".mp-now-artist");
    const favBtn = win.querySelector(".mp-fav-btn");

    const playBtn = win.querySelector(".mp-play");
    const iconPlay = win.querySelector(".mp-icon-play");
    const iconPause = win.querySelector(".mp-icon-pause");
    const prevBtn = win.querySelector(".mp-prev");
    const nextBtn = win.querySelector(".mp-next");

    const seek = win.querySelector(".mp-seek");
    const curTimeEl = win.querySelector(".mp-time-cur");
    const durTimeEl = win.querySelector(".mp-time-dur");
    const volSlider = win.querySelector(".mp-vol");

    /* ---------- 工具 ---------- */
    function escapeHTML(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }
    function fmtTime(sec) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    }

    let toastTimer = null;
    function toast(msg) {
        let el = win.querySelector(".mp-toast");
        if (!el) {
            el = document.createElement("div");
            el.className = "mp-toast";
            win.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
    }

    /* ---------- 视图：当前列表里展示哪些曲目（带原始索引） ---------- */
    function visibleTracks() {
        if (currentView === "favorites") {
            return TRACKS
                .map((t, i) => ({ t, i }))
                .filter((x) => favorites.has(x.i));
        }
        // songs / albums / artists 暂统一展示全部曲目（结构对齐 thanas-os 的多视图）
        return TRACKS.map((t, i) => ({ t, i }));
    }

    /* ---------- 渲染列表 ---------- */
    function renderList() {
        const meta = VIEW_META[currentView] || VIEW_META.songs;
        viewTitleEl.textContent = meta.title;
        viewSubEl.textContent = meta.sub;

        const rows = visibleTracks();
        if (!rows.length) {
            listEl.innerHTML = "";
            emptyEl.hidden = false;
            emptyEl.textContent =
                currentView === "favorites" ? "还没有收藏的歌曲。" : "这里还没有歌曲。";
            return;
        }
        emptyEl.hidden = true;

        listEl.innerHTML = rows
            .map(({ t, i }, pos) => {
                const playing = i === currentIndex ? " playing" : "";
                return `
                <div class="mp-row${playing}" role="listitem" data-index="${i}">
                    <div class="mp-row-index">${pos + 1}</div>
                    <div class="mp-row-cover" style="background:${escapeHTML(t.cover)}"></div>
                    <div class="mp-row-info">
                        <div class="mp-row-title">${escapeHTML(t.title)}</div>
                        <div class="mp-row-artist">${escapeHTML(t.artist)}</div>
                    </div>
                    <div class="mp-row-album">${escapeHTML(t.album || "")}</div>
                    <div class="mp-row-dur">—</div>
                </div>`;
            })
            .join("");
    }

    /* ---------- 更新底部「正在播放」信息 ---------- */
    function renderNow() {
        const t = currentIndex >= 0 ? TRACKS[currentIndex] : null;
        if (t) {
            nowCover.style.background = t.cover;
            nowCover.style.backgroundSize = "cover";
            nowTitle.textContent = t.title;
            nowArtist.textContent = t.artist;
            favBtn.classList.toggle("active", favorites.has(currentIndex));
        } else {
            nowCover.style.background = "linear-gradient(135deg,#d9d9de,#bfbfc6)";
            nowTitle.textContent = "未在播放";
            nowArtist.textContent = "选择一首歌曲开始";
            favBtn.classList.remove("active");
        }
    }

    function renderPlayIcon() {
        const playing = !audio.paused && currentIndex >= 0;
        iconPlay.hidden = playing;
        iconPause.hidden = !playing;
        playBtn.setAttribute("aria-label", playing ? "暂停" : "播放");
    }

    /* ---------- 播放控制 ---------- */
    function playTrack(index) {
        if (index < 0 || index >= TRACKS.length) return;
        const t = TRACKS[index];
        currentIndex = index;
        audio.src = t.src;
        // seek/duration 复位
        seek.value = 0;
        curTimeEl.textContent = "0:00";
        durTimeEl.textContent = "0:00";
        const p = audio.play();
        if (p && typeof p.catch === "function") {
            p.catch(() => {
                // 离线 / 自动播放限制 / 跨域：容错提示，不崩
                toast("无法播放音频，请检查网络连接");
            });
        }
        renderNow();
        renderList();
        renderPlayIcon();
    }

    function togglePlay() {
        if (currentIndex < 0) {
            // 没选歌：从当前视图第一首开始
            const rows = visibleTracks();
            if (rows.length) playTrack(rows[0].i);
            return;
        }
        if (audio.paused) {
            const p = audio.play();
            if (p && typeof p.catch === "function") {
                p.catch(() => toast("无法播放音频，请检查网络连接"));
            }
        } else {
            audio.pause();
        }
        renderPlayIcon();
    }

    function step(delta) {
        if (!TRACKS.length) return;
        let idx = currentIndex < 0 ? 0 : currentIndex + delta;
        // 环绕
        idx = ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
        playTrack(idx);
    }

    /* ---------- audio 事件 ---------- */
    on(audio, "loadedmetadata", () => {
        durTimeEl.textContent = fmtTime(audio.duration);
    });
    on(audio, "timeupdate", () => {
        const dur = audio.duration;
        if (isFinite(dur) && dur > 0) {
            // 拖动 seek 时不被 timeupdate 覆盖
            if (!seeking) seek.value = String(Math.round((audio.currentTime / dur) * 1000));
            curTimeEl.textContent = fmtTime(audio.currentTime);
        }
    });
    on(audio, "ended", () => step(1));
    on(audio, "play", renderPlayIcon);
    on(audio, "pause", renderPlayIcon);
    on(audio, "error", () => {
        if (currentIndex >= 0) toast("音频加载失败，可能处于离线状态");
    });

    /* ---------- 交互绑定 ---------- */
    // 列表点击播放（事件委托）
    on(listEl, "click", (e) => {
        const row = e.target.closest(".mp-row");
        if (!row) return;
        const idx = parseInt(row.dataset.index, 10);
        if (!isNaN(idx)) playTrack(idx);
    });

    // 侧栏导航
    navItems.forEach((item) => {
        on(item, "click", () => {
            navItems.forEach((n) => n.classList.remove("active"));
            item.classList.add("active");
            currentView = item.dataset.view || "songs";
            renderList();
        });
    });

    on(playBtn, "click", togglePlay);
    on(prevBtn, "click", () => step(-1));
    on(nextBtn, "click", () => step(1));

    // 收藏当前曲目
    on(favBtn, "click", () => {
        if (currentIndex < 0) return;
        if (favorites.has(currentIndex)) favorites.delete(currentIndex);
        else favorites.add(currentIndex);
        favBtn.classList.toggle("active", favorites.has(currentIndex));
        if (currentView === "favorites") renderList();
    });

    // 进度条：拖动 seek
    let seeking = false;
    on(seek, "input", () => { seeking = true; });
    on(seek, "change", () => {
        const dur = audio.duration;
        if (isFinite(dur) && dur > 0) {
            audio.currentTime = (parseInt(seek.value, 10) / 1000) * dur;
        }
        seeking = false;
    });

    // 音量
    on(volSlider, "input", () => {
        audio.volume = Math.max(0, Math.min(1, parseInt(volSlider.value, 10) / 100));
    });

    /* ---------- 初始渲染 ---------- */
    renderList();
    renderNow();
    renderPlayIcon();
})();
