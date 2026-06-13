import { finderbar } from './finderbar.js';
import { dock } from './dock.js';
import { createContextMenu, createDesktopFile } from './ui/contextMenu.js';
import { startInlineRename } from './ui/inlineRename.js';
import { initDesktopWidgets } from './desktop-widgets.js';
import vfs, { joinPath } from '../../os/vfs.js';

// 桌面左上角玻璃小组件卡片(时钟/日历/天气/系统状态)
initDesktopWidgets();

// 进入桌面后首次交互请求浏览器全屏(macOS 沉浸式;每会话仅一次,失败静默)
(function enableEnterFullscreen() {
    try { if (sessionStorage.getItem('webintosh.fs') === '1') return; } catch (e) { return; }
    const go = () => {
        try { sessionStorage.setItem('webintosh.fs', '1'); } catch (e) { }
        const root = document.documentElement;
        if (!document.fullscreenElement && root.requestFullscreen) {
            root.requestFullscreen().catch(() => { });
        }
        window.removeEventListener('pointerdown', go, true);
    };
    window.addEventListener('pointerdown', go, true);
})();

// 在 /Desktop 下取不重名的名称（扩展名保持在末尾）
async function uniqueDesktopName(base, ext = '') {
    const names = new Set((await vfs.list('/Desktop')).map(e => e.name));
    let name = base + ext;
    for (let i = 2; names.has(name); i++) name = `${base} ${i}${ext}`;
    return name;
}

const desktop = document.getElementById("desktop");
const containers = document.querySelectorAll(".desktop .container");
let containerList = [];

containers.forEach((container) => {
    containerList.push(container);
})

document.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".item") && !e.target.closest(".menu.contextmenu")) {
        document.querySelectorAll(".item.selected").forEach(el => el.classList.remove("selected"));
    }
});

document.addEventListener("contextmenu", (e) => {
    const item = e.target.closest(".item");
    if (item) {
        e.preventDefault();
        e.stopPropagation();

        document.querySelectorAll(".item.selected").forEach(el => el.classList.remove("selected"));
        item.classList.add("selected");

        const p = item.querySelector("p");

        createContextMenu(e.clientX, e.clientY, [
            { label: "打开", action: () => { } },
            { type: "separator" },
            {
                label: "重命名", action: () => {
                    const vfsPath = item.dataset.vfsPath;
                    const isDir = item.dataset.kind === "dir";
                    startInlineRename(p, {
                        initial: p.innerText,
                        isDir,
                        onCommit: async (newName) => {
                            if (vfsPath) {
                                // 走 VFS:写回文件系统,desktop-sync 与访达自动同步重渲染
                                try { await vfs.rename(vfsPath, newName); }
                                catch (err) { alert("重命名失败: " + err.message); }
                            } else {
                                p.innerText = newName; // 旧式拖入项无 VFS 记录,仅改显示
                            }
                        },
                    });
                }
            },
            {
                label: "移到废纸篓", action: async () => {
                    const vfsPath = item.dataset.vfsPath;
                    if (vfsPath) {
                        try { await vfs.rm(vfsPath); }
                        catch (err) { alert("删除失败: " + err.message); }
                    } else {
                        item.remove();
                    }
                }
            },
            { type: "separator" },
            { label: "显示简介", disabled: true },
        ]);
        return;
    }

    const isDesktopArea = e.target === desktop ||
        e.target.classList.contains("container") ||
        e.target.classList.contains("wallpaper") ||
        e.target.classList.contains("desktop");

    if (isDesktopArea) {
        e.preventDefault();
        e.stopPropagation();

        document.querySelectorAll(".item.selected").forEach(el => el.classList.remove("selected"));

        createContextMenu(e.clientX, e.clientY, [
            {
                label: "新建文件夹",
                // 走 VFS：持久化到 /Desktop，desktop-sync 会自动渲染图标
                action: async () => vfs.mkdir(joinPath('/Desktop', await uniqueDesktopName('未命名文件夹'))),
            },
            {
                label: "新建文本文档",
                action: async () => vfs.writeText(joinPath('/Desktop', await uniqueDesktopName('未命名', '.txt')), ''),
            },
            {
                label: "新建 Markdown 文档",
                action: async () => vfs.writeText(joinPath('/Desktop', await uniqueDesktopName('未命名', '.md')), ''),
            },
            { type: "separator" },
            { label: "显示简介", disabled: true },
            { type: "separator" },
            { label: "使用群组", action: () => console.log("使用群组") },
            { label: "排序方式", action: () => console.log("排序方式") },
            { label: "整理", action: () => console.log("整理") },
            { label: "整理方式", action: () => console.log("整理方式") },
            { label: "查看显示选项", action: () => console.log("查看显示选项") },
        ]);
    }
});


function getThumb(file) {
    return new Promise(resolve => {
        const fileType = file.type
        if (fileType.includes('image/')) {
            const url = URL.createObjectURL(file)
            resolve(url)
        } else if (fileType.includes('video/')) {
            //通过将视频绘制到canvas，再将canvas转换为blob对象即可。
            const canvas = document.createElement("canvas")
            const video = document.createElement("video")
            video.src = URL.createObjectURL(file)
            video.load()
            video.muted = true
            video.currentTime = 0.1
            // document.body.append(canvas)
            // document.body.append(video)
            video.onloadeddata = () => {
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
                video.onseeked = () => {
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                    resolve(canvas.toDataURL())
                    video.remove()
                    canvas.remove()
                }
                video.currentTime = 0.1
            }
        } else {
            resolve("./assets/images/GenericDocumentIcon.png")
        }
    })
}

function getIcon(file, callback) {
    file.file((file) => {
        console.log(file.type);
        let src = "./assets/images/GenericDocumentIcon.png";
        getThumb(file).then((url) => {
            src = url
            callback(url)
        })
    });
}

function addFile(file) {
    if (containerList[containerList.length - 1].querySelectorAll(".item").length < 6) {
        let item = document.createElement("div");
        item.classList.add("item");
        let icon = document.createElement("img");
        // icon.src = getIcon(file);
        let name = document.createElement("p");
        name.innerHTML = file.name;
        item.appendChild(icon);
        item.appendChild(name);
        // item.style.cursor = "grab";
        makeDraggable(item);
        containerList[containerList.length - 1].appendChild(item);
        getIcon(file, (src) => {
            console.log(src)
            icon.src = src;
        });
    } else {
        let container = document.createElement("div");
        container.classList.add("container");
        let item = document.createElement("div");
        item.classList.add("item");
        let icon = document.createElement("img");
        // icon.src = getIcon(file);
        let name = document.createElement("p");
        name.innerHTML = file.name;
        item.appendChild(icon);
        item.appendChild(name);
        // item.style.cursor = "grab";
        makeDraggable(item);
        containerList.push(container);
        container.appendChild(item);
        getIcon(file, (src) => {
            icon.src = src;
        });
    }
}

function addFolder(folder) {
    if (containerList[containerList.length - 1].querySelectorAll(".item").length < 6) {
        let item = document.createElement("div");
        item.classList.add("item");
        let icon = document.createElement("img");
        icon.src = "./assets/images/Folder.png";
        let name = document.createElement("p");
        name.innerHTML = folder.name;
        item.appendChild(icon);
        item.appendChild(name);
        // item.style.cursor = "grab";
        makeDraggable(item);
        containerList[containerList.length - 1].appendChild(item);
    } else {
        let container = document.createElement("div");
        container.classList.add("container");
        let item = document.createElement("div");
        item.classList.add("item");
        let icon = document.createElement("img");
        icon.src = "./assets/images/Folder.png";
        let name = document.createElement("p");
        name.innerHTML = folder.name;
        item.appendChild(icon);
        item.appendChild(name);
        // item.style.cursor = "grab";
        makeDraggable(item);
        containerList.push(container);
        container.appendChild(item);
    }
}

function makeDraggable(item) {
    let isDragging = false;
    let startX, startY, offsetX, offsetY;

    item.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;

        document.querySelectorAll(".item.selected").forEach(el => el.classList.remove("selected"));
        item.classList.add("selected");

        isDragging = true;
        const rect = item.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        item.style.position = "fixed";
        item.style.margin = "0";
        item.style.left = (e.clientX - offsetX) + "px";
        item.style.top = (e.clientY - offsetY) + "px";
        item.style.zIndex = "9999";
        item.style.cursor = "grabbing";
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        item.style.left = e.clientX - offsetX + "px";
        item.style.top = e.clientY - offsetY + "px";
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            item.style.zIndex = "0";
            // item.style.cursor = "grab";
        }
    });
}

function resize() {
    // desktop.style.height = `${document.body.clientHeight - finderbar.clientHeight - dock.clientHeight - 5}px`;

    // let maxContainer = Math.floor(desktop.clientHeight / 120);
    // containerList.forEach((container, index) => {
    //     let items = Array.from(container.children);
    //     let nextOrLastItems;

    //     if (items.length > maxContainer) {
    //         console.log("items.length > maxContainer");
    //         nextOrLastItems = items.slice(maxContainer);
    //         nextOrLastItems.push(items[items.length - 1]);

    //         console.log(nextOrLastItems);

    //         nextOrLastItems.forEach((item) => {
    //             container.removeChild(item);
    //             if (item && containerList[index + 1]) {
    //                 containerList[index + 1].prepend(item);
    //             }
    //         });
    //     }
    // });
}

window.addEventListener("resize", resize);
resize();

document.addEventListener("dragenter", (event) => {
    event.preventDefault();
    event.stopPropagation();
});

document.addEventListener("dragleave", (event) => {
    event.preventDefault();
    event.stopPropagation();
});

document.addEventListener("dragend", (event) => {
    event.preventDefault();
    event.stopPropagation();
});

document.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
});

document.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.items;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.webkitGetAsEntry) {
            const entry = file.webkitGetAsEntry();
            if (entry.isDirectory) {
                addFolder(entry);
            } else if (entry.isFile) {
                addFile(entry);
            }
        } else {
            addFile(file);
        }
    }
});