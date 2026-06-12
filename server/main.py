"""
Webintosh OS — FastAPI 文件系统后端（可选）

与前端 os/vfs.js 的 RemoteBackend 契约一一对应。
数据沙箱在 server/data/ 下，所有路径经 resolve 校验防穿越。

启动：
    cd Webintosh-Desktop/server
    pip install -r requirements.txt
    python main.py                 # 默认 0.0.0.0:8787

启动后它同时静态托管上级目录（personal/），因此也可以只跑这一个进程：
    http://localhost:8787/Webintosh-Desktop/?backend=remote
"""

from __future__ import annotations

import shutil
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent / "data"
ROOT.mkdir(exist_ok=True)
STATIC_ROOT = Path(__file__).resolve().parent.parent.parent  # personal/

app = FastAPI(title="Webintosh OS FS")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def safe(path: str) -> Path:
    """把虚拟绝对路径映射到沙箱内的真实路径，拒绝任何穿越。"""
    p = (ROOT / path.lstrip("/")).resolve()
    if p != ROOT and ROOT not in p.parents:
        raise HTTPException(400, "路径越界")
    return p


@app.get("/api/health")
def health():
    return {"ok": True, "service": "webintosh-fs"}


@app.get("/api/fs/list")
def fs_list(path: str = Query("/")):
    p = safe(path)
    if not p.is_dir():
        raise HTTPException(404, f"目录不存在: {path}")
    out = []
    for child in p.iterdir():
        stat = child.stat()
        out.append({
            "name": child.name,
            "kind": "dir" if child.is_dir() else "file",
            "size": 0 if child.is_dir() else stat.st_size,
            "mtime": int(stat.st_mtime * 1000),
        })
    return out


@app.get("/api/fs/stat")
def fs_stat(path: str = Query(...)):
    p = safe(path)
    kind = "dir" if p.is_dir() else "file" if p.is_file() else None
    return {"kind": kind}


@app.get("/api/fs/read")
def fs_read(path: str = Query(...)):
    p = safe(path)
    if not p.is_file():
        raise HTTPException(404, f"文件不存在: {path}")
    return Response(p.read_bytes(), media_type="application/octet-stream")


@app.put("/api/fs/write")
async def fs_write(request: Request, path: str = Query(...)):
    p = safe(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(await request.body())
    return {"ok": True}


@app.post("/api/fs/mkdir")
def fs_mkdir(path: str = Query(...)):
    safe(path).mkdir(parents=True, exist_ok=True)
    return {"ok": True}


@app.delete("/api/fs/rm")
def fs_rm(path: str = Query(...)):
    p = safe(path)
    if p == ROOT:
        raise HTTPException(400, "不能删除根目录")
    if p.is_dir():
        shutil.rmtree(p)
    elif p.is_file():
        p.unlink()
    else:
        raise HTTPException(404, f"不存在: {path}")
    return {"ok": True}


@app.post("/api/fs/mv")
def fs_mv(src: str = Query(...), dst: str = Query(...)):
    s, d = safe(src), safe(dst)
    if not s.exists():
        raise HTTPException(404, f"源不存在: {src}")
    d.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(s), str(d))
    return {"ok": True}


# 静态托管 personal/（Webintosh + Webintosh-Desktop），实现单进程跑全站
app.mount("/", StaticFiles(directory=STATIC_ROOT, html=True), name="static")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8787)
