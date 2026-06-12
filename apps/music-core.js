/* ============================================================
 * Webintosh Music Core
 * 共享引擎：程序化音轨合成（OfflineAudioContext 离线渲染）
 *           程序化专辑封面（Canvas）
 *           播放引擎（Web Audio + AnalyserNode 实时频谱）
 *           WebGL2 工具（可视化 / 氛围背景共用）
 * 所有音频均为运行时合成，不依赖任何外部音频文件。
 * ============================================================ */

// ---------------------------------------------------------- PRNG
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const SCALES = {
    minor:      [0, 2, 3, 5, 7, 8, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    major:      [0, 2, 4, 5, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

// ---------------------------------------------------------- 曲库
// 8 首曲目 / 2 张专辑。时长由 bpm × 40 小节决定，完全确定。
export const ALBUMS = [
    { id: 'neon',   title: '霓虹区 Neon District', artist: '九号线乐队', year: 2025 },
    { id: 'seafog', title: '海雾电台 Seafog Radio', artist: 'Lumen',     year: 2026 },
];

const BARS = 40;

function makeTrack(t) {
    t.duration = BARS * 4 * (60 / t.bpm) + 2.5;
    return t;
}

export const CATALOG = [
    makeTrack({
        id: 'neon-1', album: 'neon', title: '午夜公路', artist: '九号线乐队',
        bpm: 108, root: 45, scale: 'minor', style: 'synthwave', seed: 11,
        palette: ['#ff2d78', '#7a1fa2', '#1a0533', '#ffb340'],
        lyrics: ['霓虹在后视镜里融化', '雨刷数着城市的心跳', '收音机只剩下电流声', '而你在副驾驶睡着', '午夜公路没有尽头', '隧道把灯光折成河流', '我们逆着风开往八月', '把昨天留在收费站后', '仪表盘亮成小小星座', '你的呼吸比引擎更轻', '如果天亮之前不回头', '世界就只剩这一盏灯', '霓虹在后视镜里融化', '而你在副驾驶睡着'],
    }),
    makeTrack({
        id: 'neon-2', album: 'neon', title: 'Neon District', artist: '九号线乐队',
        bpm: 118, root: 43, scale: 'dorian', style: 'house', seed: 27,
        palette: ['#00e5ff', '#2940d3', '#0b0b2a', '#ff2d78'],
        lyrics: ['玻璃幕墙折射出千个我', '人潮把街道按下快进', '霓虹区从不需要日落', '电梯里循环昨天的新闻', '我把耳机音量调到最满', '让贝斯盖过所有疑问', '在第九大道和未来之间', '我们只差一个绿灯', '城市醒着 我们就醒着', '信号满格 孤独也满格', '玻璃幕墙折射出千个我', '其中一个正在唱歌'],
    }),
    makeTrack({
        id: 'neon-3', album: 'neon', title: '尾灯 Taillights', artist: '九号线乐队',
        bpm: 96, root: 41, scale: 'minor', style: 'lofi', seed: 42,
        palette: ['#ff6b3d', '#c2274b', '#2a0a18', '#ffd166'],
        lyrics: ['尾灯连成一条红色的河', '我在桥上数到第一百个', '风把外套吹成一面旗', '没人知道我要去哪里', '城市在身后慢慢变小', '心事在口袋慢慢变老', '如果你也在某辆车里', '请替我看一眼海的方向', '尾灯连成一条红色的河', '流向没有名字的明天'],
    }),
    makeTrack({
        id: 'neon-4', album: 'neon', title: '信号塔 Signal', artist: '九号线乐队',
        bpm: 124, root: 45, scale: 'minor', style: 'house', seed: 73,
        palette: ['#b14bff', '#3b1fa2', '#120428', '#00e5ff'],
        lyrics: ['信号塔在山顶眨着红眼', '把我的频率发向深空', '如果有人在远方收到', '请回答 请回答 请回答', '电波穿过云层和人海', '穿过所有未接的来电', '我把心跳调成摩斯密码', '在午夜准时广播', '信号塔在山顶眨着红眼', '它和我一样固执地等', '请回答 请回答 请回答', '哪怕只是一声噪音'],
    }),
    makeTrack({
        id: 'sf-1', album: 'seafog', title: '海雾 Sea Fog', artist: 'Lumen',
        bpm: 84, root: 48, scale: 'major', style: 'ambient', seed: 5,
        palette: ['#7fd8e8', '#3a7ca5', '#0e2233', '#e8f4f8'],
        lyrics: ['海雾漫过清晨的栈桥', '灯塔的光变得很温柔', '渔船还没醒 鸥鸟还没醒', '世界轻得像一句耳语', '我把脚印留给退潮', '把名字写在雾的背面', '如果你也曾路过这片海', '你会懂得安静的重量', '海雾漫过清晨的栈桥', '一切都还来得及开始'],
    }),
    makeTrack({
        id: 'sf-2', album: 'seafog', title: 'Glass Garden', artist: 'Lumen',
        bpm: 92, root: 50, scale: 'mixolydian', style: 'lofi', seed: 58,
        palette: ['#9be8c8', '#3aa57c', '#11281e', '#f4e8b8'],
        lyrics: ['玻璃花园里没有四季', '阳光被切成整齐的方块', '我浇灌一株透明的树', '它结出昨天的回声', '你说温室里长不出野花', '可野花也开不进冬天', '我们各自守着各自的玻璃', '隔着光 互相挥手', '玻璃花园里没有四季', '只有一直亮着的下午'],
    }),
    makeTrack({
        id: 'sf-3', album: 'seafog', title: 'Daybreak FM', artist: 'Lumen',
        bpm: 102, root: 47, scale: 'major', style: 'synthwave', seed: 91,
        palette: ['#ffb86b', '#ff5e78', '#2b1232', '#7fd8e8'],
        lyrics: ['黎明电台四点开始放歌', '给所有没睡着的人', '给加班的 失恋的 想家的', '给把窗帘拉开一条缝的', '天空从墨蓝调成蜂蜜', '楼下的早餐店冒出白汽', '主播说今天会是晴天', '概率百分之七十', '黎明电台四点开始放歌', '你听到的话 就算回应了'],
    }),
    makeTrack({
        id: 'sf-4', album: 'seafog', title: 'Parallel 平行', artist: 'Lumen',
        bpm: 76, root: 45, scale: 'dorian', style: 'ambient', seed: 33,
        palette: ['#c8b8ff', '#6b5ca5', '#181233', '#ffd8e8'],
        lyrics: ['平行世界的我们好吗', '是否也在听同一首歌', '那里的雨是否落得更慢', '那里的再见是否更少', '我把这个问题折成纸船', '放进银河的支流', '如果某天它漂到你那边', '请把答案写在背面', '平行世界的我们好吗', '希望至少有一个我们 很好'],
    }),
];

export const trackById = id => CATALOG.find(t => t.id === id);
export const albumTracks = id => CATALOG.filter(t => t.album === id);

// 为每首歌生成定时歌词 [{t, text}]
export function timedLyrics(track) {
    const lines = track.lyrics;
    const start = 10, end = track.duration - 14;
    const step = (end - start) / lines.length;
    const rng = mulberry32(track.seed * 7 + 1);
    return lines.map((text, i) => ({
        t: start + i * step + rng() * step * 0.15,
        text,
    }));
}

/* ============================================================
 * 合成器 —— OfflineAudioContext 离线渲染
 * 结构（40 小节）：intro 4 / groove A 12 / break 4 / groove B 12 / outro 8
 * ============================================================ */

const bufferCache = new Map();
const renderPromises = new Map();

export function renderTrack(track) {
    if (bufferCache.has(track.id)) return Promise.resolve(bufferCache.get(track.id));
    if (renderPromises.has(track.id)) return renderPromises.get(track.id);
    const p = doRender(track).then(buf => {
        bufferCache.set(track.id, buf);
        renderPromises.delete(track.id);
        return buf;
    });
    renderPromises.set(track.id, p);
    return p;
}

const hz = m => 440 * Math.pow(2, (m - 69) / 12);

function makeImpulse(ctx, seconds, decay) {
    const sr = ctx.sampleRate, len = sr * seconds;
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
    }
    return buf;
}

function makeNoise(ctx, seconds = 1.2) {
    const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
}

async function doRender(track) {
    const sr = 44100;
    const spb = 60 / track.bpm;        // 一拍秒数
    const bar = spb * 4;
    const total = BARS * bar + 2.5;
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * total), sr);
    const rng = mulberry32(track.seed);

    // ---------- 母线 ----------
    const master = ctx.createGain(); master.gain.value = 0.86;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 3.2;
    comp.attack.value = 0.004; comp.release.value = 0.24;
    master.connect(comp); comp.connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, track.style === 'ambient' ? 3.4 : 2.0, 2.6);
    const revGain = ctx.createGain();
    revGain.gain.value = track.style === 'ambient' ? 0.42 : 0.22;
    reverb.connect(revGain); revGain.connect(master);

    const echo = ctx.createDelay(2);
    echo.delayTime.value = spb * 0.75;
    const echoFb = ctx.createGain(); echoFb.gain.value = 0.34;
    const echoOut = ctx.createGain(); echoOut.gain.value = 0.28;
    const echoLp = ctx.createBiquadFilter(); echoLp.type = 'lowpass'; echoLp.frequency.value = 3200;
    echo.connect(echoLp); echoLp.connect(echoFb); echoFb.connect(echo);
    echoLp.connect(echoOut); echoOut.connect(master);

    const noiseBuf = makeNoise(ctx);

    // ---------- 乐器 ----------
    function kick(t, vel = 1) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(165, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
        g.gain.setValueAtTime(0.95 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.32);
        const n = ctx.createBufferSource(); n.buffer = noiseBuf;
        const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 900;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.16 * vel, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        n.connect(nf); nf.connect(ng); ng.connect(master);
        n.start(t, rng() * 0.4); n.stop(t + 0.05);
    }
    function snare(t, vel = 1) {
        const n = ctx.createBufferSource(); n.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.34 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        n.connect(bp); bp.connect(g); g.connect(master); g.connect(reverb);
        n.start(t, rng() * 0.5); n.stop(t + 0.2);
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(196, t);
        og.gain.setValueAtTime(0.18 * vel, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        o.connect(og); og.connect(master);
        o.start(t); o.stop(t + 0.1);
    }
    function hat(t, open = false, vel = 1) {
        const n = ctx.createBufferSource(); n.buffer = noiseBuf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8200;
        const g = ctx.createGain();
        const dur = open ? 0.22 : 0.045;
        g.gain.setValueAtTime(0.13 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        n.connect(hp); hp.connect(g); g.connect(master);
        n.start(t, rng() * 0.6); n.stop(t + dur + 0.02);
    }
    function bass(t, midi, dur, vel = 1) {
        const o = ctx.createOscillator(), sub = ctx.createOscillator();
        o.type = track.style === 'house' ? 'sawtooth' : 'square';
        sub.type = 'sine';
        o.frequency.value = hz(midi); sub.frequency.value = hz(midi - 12);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
        f.frequency.setValueAtTime(120 + 900 * vel, t);
        f.frequency.exponentialRampToValueAtTime(110, t + Math.min(dur, 0.4));
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.30 * vel, t + 0.012);
        g.gain.setValueAtTime(0.30 * vel, t + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        const sg = ctx.createGain(); sg.gain.value = 0.22 * vel;
        o.connect(f); f.connect(g);
        sub.connect(sg); sg.connect(g);
        g.connect(master);
        o.start(t); o.stop(t + dur + 0.05);
        sub.start(t); sub.stop(t + dur + 0.05);
    }
    function pad(t, midis, dur, vel = 1) {
        const g = ctx.createGain();
        const atk = track.style === 'ambient' ? dur * 0.45 : 0.6;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.052 * vel, t + atk);
        g.gain.setValueAtTime(0.052 * vel, t + dur * 0.75);
        g.gain.linearRampToValueAtTime(0, t + dur);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.value = track.style === 'ambient' ? 1400 : 2400;
        g.connect(f); f.connect(master); f.connect(reverb);
        for (const m of midis) {
            for (const det of [-7, 0, 7]) {
                const o = ctx.createOscillator();
                o.type = 'sawtooth';
                o.frequency.value = hz(m);
                o.detune.value = det + (rng() - 0.5) * 4;
                o.connect(g);
                o.start(t); o.stop(t + dur + 0.1);
            }
        }
    }
    function pluck(t, midi, vel = 1, send = true) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = hz(midi);
        g.gain.setValueAtTime(0.16 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
        o.connect(g); g.connect(master);
        if (send) { g.connect(echo); g.connect(reverb); }
        o.start(t); o.stop(t + 0.4);
    }
    function lead(t, midi, dur, vel = 1) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = hz(midi);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3000; f.Q.value = 2;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.085 * vel, t + 0.03);
        g.gain.setValueAtTime(0.085 * vel, t + dur * 0.8);
        g.gain.linearRampToValueAtTime(0, t + dur);
        const vib = ctx.createOscillator(), vg = ctx.createGain();
        vib.frequency.value = 5.4; vg.gain.value = 6;
        vib.connect(vg); vg.connect(o.detune);
        o.connect(f); f.connect(g); g.connect(master); g.connect(echo);
        o.start(t); vib.start(t);
        o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
    }

    // ---------- 编曲 ----------
    const scale = SCALES[track.scale];
    const deg = (d, oct = 0) => track.root + scale[((d % 7) + 7) % 7] + 12 * (oct + Math.floor(d / 7));
    const progressions = [[0, 5, 3, 4], [0, 3, 5, 4], [0, 5, 1, 4], [5, 3, 0, 4]];
    const prog = progressions[Math.floor(rng() * progressions.length)];
    const chordOf = d => [deg(d, 1), deg(d + 2, 1), deg(d + 4, 1)];

    // 低音音型（每小节 8 个八分音符槽位）
    const bassPattern = [];
    for (let i = 0; i < 8; i++) bassPattern.push(rng() < (track.style === 'house' ? 0.85 : 0.55));
    bassPattern[0] = true;
    // 琶音音型（16 槽位，选和弦音 + 八度）
    const arpSteps = [];
    for (let i = 0; i < 16; i++) arpSteps.push(Math.floor(rng() * 6));
    // 主旋律乐句（两小节，groove B 使用）
    const melody = [];
    for (let i = 0; i < 8; i++) {
        melody.push({
            step: i * 2 + (rng() < 0.3 ? 1 : 0),
            d: Math.floor(rng() * 8),
            len: rng() < 0.3 ? 2 : 1,
            on: rng() < 0.75,
        });
    }

    const sections = [
        { bars: 4,  drums: 0,   bass: 0, pad: 1, arp: track.style !== 'ambient', lead: 0, hat: 0 },
        { bars: 12, drums: 1,   bass: 1, pad: 1, arp: 1, lead: 0, hat: 1 },
        { bars: 4,  drums: 0.3, bass: 1, pad: 1, arp: 0, lead: 0, hat: 1 },
        { bars: 12, drums: 1,   bass: 1, pad: 1, arp: 1, lead: track.style !== 'ambient', hat: 1 },
        { bars: 8,  drums: 0.5, bass: 0.6, pad: 1, arp: 1, lead: 0, hat: 0.5 },
    ];

    const swing = track.style === 'lofi' ? 0.06 * spb : 0;
    let barIdx = 0;
    for (const sec of sections) {
        for (let b = 0; b < sec.bars; b++, barIdx++) {
            const t0 = barIdx * bar;
            const chord = prog[barIdx % 4];
            const isLast = barIdx === BARS - 1;
            const fill = (barIdx % 8 === 7) && sec.drums >= 1;

            if (sec.pad) pad(t0, chordOf(chord), bar * 1.02, sec === sections[4] ? 0.8 : 1);

            if (sec.drums > 0 && !isLast) {
                for (let q = 0; q < 4; q++) {
                    const tq = t0 + q * spb;
                    if (track.style === 'house') kick(tq, sec.drums);
                    else if (q === 0 || (q === 2 && rng() < 0.9)) kick(tq, sec.drums);
                    if (track.style === 'lofi' && q === 0 && rng() < 0.3) kick(tq + spb * 0.75, 0.6 * sec.drums);
                    if (q === 1 || q === 3) snare(tq, sec.drums * (track.style === 'ambient' ? 0.5 : 1));
                }
                if (fill) for (let s = 0; s < 4; s++) snare(t0 + 3 * spb + s * spb * 0.25, 0.4 + s * 0.15);
            }
            if (sec.hat > 0 && !isLast) {
                const div = track.style === 'house' ? 4 : 2;
                for (let s = 0; s < 4 * div; s++) {
                    const sw = (s % 2 === 1) ? swing : 0;
                    if (track.style === 'house' && s % 4 === 2) hat(t0 + s * spb / div + sw, true, sec.hat);
                    else if (rng() < 0.92) hat(t0 + s * spb / div + sw, false, sec.hat * (0.6 + rng() * 0.4));
                }
            }
            if (sec.bass > 0) {
                for (let s = 0; s < 8; s++) {
                    if (!bassPattern[s]) continue;
                    const sw = (s % 2 === 1) ? swing : 0;
                    const note = (s === 6 && rng() < 0.4) ? deg(chord + 4, -1) : deg(chord, -1);
                    bass(t0 + s * spb / 2 + sw, note, spb * 0.48, sec.bass);
                }
            }
            if (sec.arp) {
                const ch = chordOf(chord);
                for (let s = 0; s < 16; s++) {
                    if (track.style === 'ambient' && s % 2 === 1) continue;
                    const pick = arpSteps[s];
                    const note = ch[pick % 3] + 12 * Math.floor(pick / 3);
                    if (rng() < 0.85) pluck(t0 + s * spb / 4, note, 0.5 + rng() * 0.5);
                }
            }
            if (sec.lead && b >= 2 && b % 2 === 0) {
                for (const n of melody) {
                    if (!n.on) continue;
                    lead(t0 + n.step * spb / 4, deg(n.d + chord, 2), n.len * spb / 2, 0.9);
                }
            }
        }
    }
    // 结尾长音
    pad((BARS - 0.02) * bar, chordOf(prog[0]), 2.2, 0.7);

    return ctx.startRendering();
}

/* ============================================================
 * 程序化专辑封面 —— Canvas 生成，返回 dataURL（带缓存）
 * ============================================================ */

const artCache = new Map();

export function artwork(track, size = 640) {
    const key = track.id + ':' + size;
    if (artCache.has(key)) return artCache.get(key);

    const rng = mulberry32(track.seed * 1000 + 7);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const [c0, c1, c2, c3] = track.palette;

    // 基底渐变
    const base = g.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, c2); base.addColorStop(1, c1);
    g.fillStyle = base; g.fillRect(0, 0, size, size);

    const style = track.seed % 4;
    if (style === 0) {            // 光斑网格
        for (let i = 0; i < 5; i++) {
            const x = rng() * size, y = rng() * size, r = size * (0.25 + rng() * 0.4);
            const rad = g.createRadialGradient(x, y, 0, x, y, r);
            const col = [c0, c3, c1][i % 3];
            rad.addColorStop(0, col + 'dd'); rad.addColorStop(1, col + '00');
            g.fillStyle = rad;
            g.fillRect(0, 0, size, size);
        }
    } else if (style === 1) {     // 同心圆环
        const cx = size * (0.3 + rng() * 0.4), cy = size * (0.3 + rng() * 0.4);
        for (let i = 14; i > 0; i--) {
            g.beginPath();
            g.arc(cx, cy, i * size * 0.07, 0, Math.PI * 2);
            g.fillStyle = i % 2 ? c0 + 'cc' : c2 + 'ee';
            if (i % 5 === 0) g.fillStyle = c3 + 'cc';
            g.fill();
        }
    } else if (style === 2) {     // 正弦波层
        for (let layer = 0; layer < 4; layer++) {
            g.beginPath();
            const baseY = size * (0.35 + layer * 0.17);
            const amp = size * (0.05 + rng() * 0.08), freq = 2 + rng() * 3, ph = rng() * 7;
            g.moveTo(0, baseY);
            for (let x = 0; x <= size; x += 4) {
                g.lineTo(x, baseY + Math.sin(x / size * Math.PI * freq + ph) * amp);
            }
            g.lineTo(size, size); g.lineTo(0, size); g.closePath();
            g.fillStyle = [c0, c3, c1, c2][layer] + (layer === 0 ? 'ee' : 'bb');
            g.fill();
        }
    } else {                      // 几何切面
        g.save();
        g.translate(size / 2, size / 2);
        g.rotate(rng() * Math.PI);
        const w = size * (0.45 + rng() * 0.25);
        g.fillStyle = c0;
        g.fillRect(-w / 2, -w / 2, w, w);
        g.rotate(Math.PI / 4);
        g.fillStyle = c3 + 'd9';
        g.fillRect(-w / 3, -w / 3, w / 1.5, w / 1.5);
        g.restore();
        g.beginPath();
        g.arc(size * rng(), size * rng(), size * 0.1, 0, Math.PI * 2);
        g.fillStyle = c2; g.fill();
    }

    // 颗粒
    const noise = g.getImageData(0, 0, size, size);
    const d = noise.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 18;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(noise, 0, 0);

    // 暗角
    const vig = g.createRadialGradient(size / 2, size / 2, size * 0.45, size / 2, size / 2, size * 0.78);
    vig.addColorStop(0, '#00000000'); vig.addColorStop(1, '#00000055');
    g.fillStyle = vig; g.fillRect(0, 0, size, size);

    const url = c.toDataURL('image/png');
    artCache.set(key, url);
    return url;
}

/* ============================================================
 * 播放引擎
 * ============================================================ */

export class Player extends EventTarget {
    constructor(queue = CATALOG) {
        super();
        this.queue = queue.slice();
        this.index = -1;
        this.ctx = null;
        this.analyser = null;
        this.gain = null;
        this.source = null;
        this.buffer = null;
        this.playing = false;
        this.loading = false;
        this._offset = 0;
        this._startedAt = 0;
        this.repeat = 'off';      // off | all | one
        this.shuffle = false;
        this._volume = 0.8;
    }

    _ensureCtx() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
        this.gain = this.ctx.createGain();
        this.gain.gain.value = this._volume;
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.82;
        this.gain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
    }

    get track() { return this.queue[this.index] || null; }
    get duration() { return this.buffer ? this.buffer.duration : (this.track ? this.track.duration : 0); }
    get time() {
        if (!this.buffer) return 0;
        if (!this.playing) return this._offset;
        return Math.min(this._offset + this.ctx.currentTime - this._startedAt, this.duration);
    }

    set volume(v) {
        this._volume = v;
        if (this.gain) this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }
    get volume() { return this._volume; }

    async playIndex(i, offset = 0) {
        this._ensureCtx();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this._stopSource();
        this.index = i;
        const track = this.track;
        if (!track) return;
        this.loading = true;
        this.dispatchEvent(new CustomEvent('loading', { detail: track }));
        this.dispatchEvent(new CustomEvent('trackchange', { detail: track }));
        const buf = await renderTrack(track);
        if (this.track !== track) return;     // 渲染期间已切歌
        this.loading = false;
        this.buffer = buf;
        this._startAt(offset);
        this.dispatchEvent(new CustomEvent('ready', { detail: track }));
    }

    playTrack(track, offset = 0) {
        const i = this.queue.indexOf(track);
        return this.playIndex(i >= 0 ? i : 0, offset);
    }

    _startAt(offset) {
        this._stopSource();
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffer;
        src.connect(this.gain);
        src.start(0, offset);
        this._offset = offset;
        this._startedAt = this.ctx.currentTime;
        this.source = src;
        this.playing = true;
        const expected = this.track;
        src.onended = () => {
            if (this.source !== src || !this.playing) return;
            if (this.track !== expected) return;
            this.playing = false;
            this._offset = 0;
            this.dispatchEvent(new CustomEvent('ended', { detail: expected }));
            if (this.repeat === 'one') this.playIndex(this.index);
            else this.next(true);
        };
        this.dispatchEvent(new Event('play'));
    }

    _stopSource() {
        if (this.source) {
            this.source.onended = null;
            try { this.source.stop(); } catch (e) { /* already stopped */ }
            this.source = null;
        }
    }

    pause() {
        if (!this.playing) return;
        this._offset = this.time;
        this._stopSource();
        this.playing = false;
        this.dispatchEvent(new Event('pause'));
    }

    resume() {
        if (this.playing || !this.buffer) return;
        this._startAt(this._offset);
    }

    toggle() {
        if (this.playing) this.pause();
        else if (this.buffer) this.resume();
        else if (this.queue.length) this.playIndex(Math.max(this.index, 0));
    }

    seek(t) {
        t = Math.max(0, Math.min(t, this.duration - 0.05));
        if (this.playing) this._startAt(t);
        else { this._offset = t; this.dispatchEvent(new Event('pause')); }
    }

    _pickNext(dir, auto) {
        if (this.shuffle) {
            if (this.queue.length <= 1) return this.index;
            let n;
            do { n = Math.floor(Math.random() * this.queue.length); } while (n === this.index);
            return n;
        }
        const n = this.index + dir;
        if (n >= this.queue.length) {
            if (this.repeat === 'all') return 0;
            return auto ? -1 : 0;
        }
        if (n < 0) return this.queue.length - 1;
        return n;
    }

    next(auto = false) {
        const n = this._pickNext(1, auto);
        if (n === -1) { this.dispatchEvent(new Event('queueend')); return; }
        this.playIndex(n);
    }

    prev() {
        if (this.time > 4) { this.seek(0); return; }
        this.playIndex(this._pickNext(-1, false));
    }
}

/* ============================================================
 * GPU 渲染面 —— WebGPU(WGSL) 优先，WebGL2 自动回退
 *
 * 统一接口：
 *   const s = await createSurface(canvas, { wgsl, glsl });
 *   s.api                  // 'webgpu' | 'webgl2'
 *   s.resize(dprCap)
 *   s.frame({ time, level, palette: [hex×4], freq?: Uint8Array(512) })
 *
 * 两套着色器共享同一语义：
 *   uniforms: res(vec2) time(f32) level(f32) c0..c3(颜色)
 *   freq:     512×1 单通道频谱纹理（0 号绑定组）
 * ============================================================ */

const hexToRgbF = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

export async function createSurface(canvas, { wgsl, glsl }) {
    if (navigator.gpu && wgsl) {
        try {
            const s = await createWebGPUSurface(canvas, wgsl);
            if (s) return s;
        } catch (e) {
            console.warn('[music-core] WebGPU 初始化失败，回退 WebGL2：', e.message);
        }
    }
    return createGLSurface(canvas, glsl);
}

// ---------- WebGPU ----------

const WGSL_COMMON = /* wgsl */`
struct U {
    res:   vec2f,
    time:  f32,
    level: f32,
    c0: vec4f,
    c1: vec4f,
    c2: vec4f,
    c3: vec4f,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var freqTex: texture_2d<f32>;

fn freqAt(x: f32) -> f32 {
    return textureSampleLevel(freqTex, samp, vec2f(x, 0.5), 0.0).r;
}
fn grain(p: vec2f) -> f32 {
    return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

struct VSOut {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
};
@vertex fn vs_main(@builtin(vertex_index) vi: u32) -> VSOut {
    var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
    var o: VSOut;
    o.pos = vec4f(p[vi], 0.0, 1.0);
    o.uv = p[vi] * 0.5 + vec2f(0.5);
    return o;
}
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    return vec4f(shade(uv), 1.0);
}`;

async function createWebGPUSurface(canvas, shadeFn) {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const ctx = canvas.getContext('webgpu');
    if (!ctx) return null;
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: 'opaque' });

    const module = device.createShaderModule({ code: WGSL_COMMON + '\n' + shadeFn });
    const info = await module.getCompilationInfo();
    for (const m of info.messages) {
        if (m.type === 'error') throw new Error('WGSL: ' + m.message);
    }

    const ubuf = device.createBuffer({
        size: 80,   // vec2f+f32+f32 (16B) + 4×vec4f (64B)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const freqTex = device.createTexture({
        size: [512, 1],
        format: 'r8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    // 显式绑定组布局：layout:'auto' 会剔除着色器未静态使用的绑定，
    // 导致不采样频谱纹理的着色器（如氛围背景）bindGroup 校验失败而黑屏
    const bgl = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        ],
    });
    const pipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
        vertex: { module, entryPoint: 'vs_main' },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
    });
    const bindGroup = device.createBindGroup({
        layout: bgl,
        entries: [
            { binding: 0, resource: { buffer: ubuf } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: freqTex.createView() },
        ],
    });
    device.addEventListener?.('uncapturederror', e =>
        console.error('[music-core] WebGPU 错误:', e.error?.message));

    const udata = new Float32Array(20);
    const zeroFreq = new Uint8Array(512);

    function resize(dprCap = 2) {
        const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
        const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w; canvas.height = h;
        }
    }

    function frame({ time = 0, level = 0, palette, freq = null }) {
        udata[0] = canvas.width; udata[1] = canvas.height;
        udata[2] = time; udata[3] = level;
        for (let i = 0; i < 4; i++) {
            const [r, g, b] = hexToRgbF(palette[i]);
            udata[4 + i * 4] = r; udata[5 + i * 4] = g; udata[6 + i * 4] = b; udata[7 + i * 4] = 1;
        }
        device.queue.writeBuffer(ubuf, 0, udata);
        device.queue.writeTexture(
            { texture: freqTex },
            freq || zeroFreq,
            { bytesPerRow: 512 },
            [512, 1],
        );
        const enc = device.createCommandEncoder();
        const pass = enc.beginRenderPass({
            colorAttachments: [{
                view: ctx.getCurrentTexture().createView(),
                loadOp: 'clear', storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
            }],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        device.queue.submit([enc.finish()]);
    }

    return { api: 'webgpu', resize, frame };
}

// ---------- WebGL2 回退 ----------

function createGLSurface(canvas, fragSrc) {
    const glx = createGL(canvas, fragSrc);
    if (!glx) return null;
    const { gl, uniforms } = glx;

    let freqTex = null;
    function ensureFreqTex() {
        if (freqTex) return;
        freqTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, freqTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    }

    function frame({ time = 0, level = 0, palette, freq = null }) {
        if (uniforms.uFreq) {
            ensureFreqTex();
            gl.bindTexture(gl.TEXTURE_2D, freqTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 512, 1, 0,
                gl.LUMINANCE, gl.UNSIGNED_BYTE, freq || new Uint8Array(512));
            gl.uniform1i(uniforms.uFreq, 0);
        }
        if (uniforms.uTime) gl.uniform1f(uniforms.uTime, time);
        if (uniforms.uLevel) gl.uniform1f(uniforms.uLevel, level);
        if (uniforms.uRes) gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
        ['uC0', 'uC1', 'uC2', 'uC3'].forEach((name, i) => {
            if (uniforms[name]) gl.uniform3fv(uniforms[name], hexToRgbF(palette[i]));
        });
        glx.draw();
    }

    return { api: 'webgl2', resize: glx.resize, frame };
}

export function createGL(canvas, fragSrc) {
    const gl = canvas.getContext('webgl2', {
        antialias: false, depth: false, stencil: false,
        powerPreference: 'high-performance',
    });
    if (!gl) return null;

    const vsSrc = `#version 300 es
    layout(location=0) in vec2 p;
    out vec2 uv;
    void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(s));
            return null;
        }
        return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(prog));
        return null;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(prog, i);
        uniforms[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, info.name);
    }

    function resize(dprCap = 2) {
        const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
        const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w; canvas.height = h;
            gl.viewport(0, 0, w, h);
        }
    }

    return {
        gl, prog, uniforms, resize,
        draw() { gl.drawArrays(gl.TRIANGLES, 0, 3); },
    };
}

// 格式化 mm:ss
export function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
}
