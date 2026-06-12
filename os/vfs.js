/* ============================================================
 * Webintosh OS — 虚拟文件系统（VFS）
 *
 * 双后端，可切换：
 *   'opfs'   —— 浏览器 Origin Private File System（默认，零后端、纯静态部署可用）
 *   'remote' —— FastAPI 服务器（server/main.py），多端共享
 *
 * 切换方式（优先级从高到低）：
 *   1. URL 参数        ?backend=remote
 *   2. localStorage    webintosh.backend
 *   3. 默认           'opfs'
 * 终端里可用 `backend remote` / `backend opfs` 命令切换。
 *
 * 跨窗口/iframe 同步：所有写操作经 BroadcastChannel('webintosh-vfs')
 * 广播 change 事件，访达/终端/编辑器据此自动刷新。
 *
 * 路径一律为绝对规范路径：'/Documents/readme.txt'
 * ============================================================ */

const CHANNEL = new BroadcastChannel('webintosh-vfs');
const DEFAULT_DIRS = ['/Desktop', '/Documents', '/Downloads', '/Music', '/Pictures', '/Applications'];
const WELCOME_FILE = '/Documents/欢迎.txt';
const WELCOME_TEXT = `欢迎来到 Webintosh OS！

这是一个真实可读写的文件系统：
- 默认存储在浏览器 OPFS 中，刷新、重启浏览器都不会丢失；
- 在「终端」里输入 backend remote 可切换到 FastAPI 服务器存储；
- 访达、终端、文本编辑共享同一份文件，任意一处修改其他立即可见。

试试在终端里输入：
  ls /Documents
  echo "hello webintosh" > /Documents/hello.txt
  cat /Documents/hello.txt
`;

export function normPath(p) {
    if (!p) return '/';
    const parts = [];
    for (const seg of String(p).split('/')) {
        if (!seg || seg === '.') continue;
        if (seg === '..') parts.pop();
        else parts.push(seg);
    }
    return '/' + parts.join('/');
}
export const dirname = p => normPath(p).split('/').slice(0, -1).join('/') || '/';
export const basename = p => normPath(p).split('/').pop() || '/';
export const joinPath = (...segs) => normPath(segs.join('/'));

/* ------------------------------------------------ OPFS 后端 */

class OPFSBackend {
    constructor() { this.name = 'opfs'; }

    async _root() {
        if (!this.rootHandle) this.rootHandle = await navigator.storage.getDirectory();
        return this.rootHandle;
    }
    async _dir(path, create = false) {
        let h = await this._root();
        const parts = normPath(path).split('/').filter(Boolean);
        for (const part of parts) {
            h = await h.getDirectoryHandle(part, { create });
        }
        return h;
    }
    async _parentAndName(path) {
        const p = normPath(path);
        return [await this._dir(dirname(p)), basename(p)];
    }

    async list(path) {
        const dir = await this._dir(path);
        const out = [];
        for await (const [name, handle] of dir.entries()) {
            if (handle.kind === 'file') {
                const f = await handle.getFile();
                out.push({ name, kind: 'file', size: f.size, mtime: f.lastModified });
            } else {
                out.push({ name, kind: 'dir', size: 0, mtime: 0 });
            }
        }
        return out;
    }
    async readBytes(path) {
        const [dir, name] = await this._parentAndName(path);
        const fh = await dir.getFileHandle(name);
        return new Uint8Array(await (await fh.getFile()).arrayBuffer());
    }
    async writeBytes(path, bytes) {
        const p = normPath(path);
        await this._dir(dirname(p), true);
        const [dir, name] = await this._parentAndName(p);
        const fh = await dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(bytes);
        await w.close();
    }
    async mkdir(path) { await this._dir(path, true); }
    async rm(path) {
        const [dir, name] = await this._parentAndName(path);
        await dir.removeEntry(name, { recursive: true });
    }
    async exists(path) {
        const p = normPath(path);
        if (p === '/') return 'dir';
        try {
            const [dir, name] = await this._parentAndName(p);
            try { await dir.getFileHandle(name); return 'file'; } catch (e) { /* not a file */ }
            try { await dir.getDirectoryHandle(name); return 'dir'; } catch (e) { /* not a dir */ }
            return null;
        } catch (e) { return null; }
    }
    async mv(src, dst) {
        const kind = await this.exists(src);
        if (!kind) throw new Error('源不存在: ' + src);
        if (kind === 'file') {
            await this.writeBytes(dst, await this.readBytes(src));
        } else {
            await this.mkdir(dst);
            for (const e of await this.list(src)) {
                await this.mv(joinPath(src, e.name), joinPath(dst, e.name));
            }
        }
        await this.rm(src);
    }
}

/* ------------------------------------------------ FastAPI 远端后端 */

class RemoteBackend {
    constructor(base) { this.name = 'remote'; this.base = base; }

    async _req(method, url, body = null) {
        const res = await fetch(this.base + url, {
            method,
            body,
            headers: body instanceof Uint8Array || body instanceof ArrayBuffer
                ? { 'Content-Type': 'application/octet-stream' } : undefined,
        });
        if (!res.ok) throw new Error(`远端 ${method} ${url} 失败: ${res.status} ${await res.text().catch(() => '')}`);
        return res;
    }
    async list(path) {
        return (await this._req('GET', `/api/fs/list?path=${encodeURIComponent(normPath(path))}`)).json();
    }
    async readBytes(path) {
        const res = await this._req('GET', `/api/fs/read?path=${encodeURIComponent(normPath(path))}`);
        return new Uint8Array(await res.arrayBuffer());
    }
    async writeBytes(path, bytes) {
        await this._req('PUT', `/api/fs/write?path=${encodeURIComponent(normPath(path))}`, bytes);
    }
    async mkdir(path) { await this._req('POST', `/api/fs/mkdir?path=${encodeURIComponent(normPath(path))}`); }
    async rm(path) { await this._req('DELETE', `/api/fs/rm?path=${encodeURIComponent(normPath(path))}`); }
    async mv(src, dst) {
        await this._req('POST', `/api/fs/mv?src=${encodeURIComponent(normPath(src))}&dst=${encodeURIComponent(normPath(dst))}`);
    }
    async exists(path) {
        const res = await this._req('GET', `/api/fs/stat?path=${encodeURIComponent(normPath(path))}`);
        return (await res.json()).kind;     // 'file' | 'dir' | null
    }
}

/* ------------------------------------------------ VFS 门面 */

class VFS extends EventTarget {
    constructor() {
        super();
        this.backend = null;
        this._initPromise = null;
        CHANNEL.addEventListener('message', e => {
            this.dispatchEvent(new CustomEvent('change', { detail: e.data }));
        });
    }

    get configuredBackend() {
        return new URLSearchParams(location.search).get('backend')
            || localStorage.getItem('webintosh.backend')
            || 'opfs';
    }

    get backendName() { return this.backend ? this.backend.name : '(未初始化)'; }

    async resolveApiBase() {
        const saved = localStorage.getItem('webintosh.api');
        const candidates = [...(saved ? [saved] : []), '', 'http://localhost:8787'];
        for (const base of candidates) {
            try {
                const res = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1500) });
                if (res.ok) return base;
            } catch (e) { /* try next */ }
        }
        return null;
    }

    init() {
        if (!this._initPromise) this._initPromise = this._init();
        return this._initPromise;
    }

    async _init() {
        const want = this.configuredBackend;
        if (want === 'remote') {
            const base = await this.resolveApiBase();
            if (base !== null) {
                this.backend = new RemoteBackend(base);
            } else {
                console.warn('[VFS] 远端后端不可达，回退到 OPFS（用 `backend remote` 重试）');
                this.backend = new OPFSBackend();
            }
        } else {
            this.backend = new OPFSBackend();
        }
        await this._seed();
        return this;
    }

    async setBackend(name) {
        if (name !== 'opfs' && name !== 'remote') throw new Error('后端只支持 opfs | remote');
        if (name === 'remote') {
            const base = await this.resolveApiBase();
            if (base === null) throw new Error('FastAPI 服务器不可达（请启动 server/main.py，默认端口 8787）');
            this.backend = new RemoteBackend(base);
            if (base) localStorage.setItem('webintosh.api', base);
        } else {
            this.backend = new OPFSBackend();
        }
        localStorage.setItem('webintosh.backend', name);
        await this._seed();
        this._broadcast('/');
        return this.backendName;
    }

    async _seed() {
        try {
            for (const d of DEFAULT_DIRS) {
                if (!(await this.backend.exists(d))) await this.backend.mkdir(d);
            }
            if (!(await this.backend.exists(WELCOME_FILE))) {
                await this.backend.writeBytes(WELCOME_FILE, new TextEncoder().encode(WELCOME_TEXT));
            }
        } catch (e) {
            console.warn('[VFS] 初始化默认目录失败:', e.message);
        }
    }

    _broadcast(path) {
        const detail = { path: normPath(path), backend: this.backendName };
        CHANNEL.postMessage(detail);
        this.dispatchEvent(new CustomEvent('change', { detail }));
    }

    // ---- 读 ----
    async list(path) { await this.init(); return this.backend.list(path); }
    async exists(path) { await this.init(); return this.backend.exists(path); }
    async readBytes(path) { await this.init(); return this.backend.readBytes(path); }
    async readText(path) { return new TextDecoder().decode(await this.readBytes(path)); }

    // ---- 写（全部广播变更）----
    async writeBytes(path, bytes) {
        await this.init();
        if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
        await this.backend.writeBytes(path, bytes);
        this._broadcast(dirname(path));
    }
    async writeText(path, text) { return this.writeBytes(path, new TextEncoder().encode(text)); }
    async mkdir(path) { await this.init(); await this.backend.mkdir(path); this._broadcast(dirname(path)); }
    async rm(path) { await this.init(); await this.backend.rm(path); this._broadcast(dirname(path)); }
    async mv(src, dst) {
        await this.init();
        await this.backend.mv(src, dst);
        this._broadcast(dirname(src));
        if (dirname(dst) !== dirname(src)) this._broadcast(dirname(dst));
    }

    // ---- 设置存取（键值，localStorage 简单可靠，跨后端不变）----
    getSetting(key, fallback = null) {
        const v = localStorage.getItem('webintosh.setting.' + key);
        return v === null ? fallback : JSON.parse(v);
    }
    setSetting(key, value) {
        localStorage.setItem('webintosh.setting.' + key, JSON.stringify(value));
    }
}

export const vfs = new VFS();
export default vfs;
