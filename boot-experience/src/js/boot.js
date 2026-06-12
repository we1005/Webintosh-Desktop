import { getDiv, getP, getImg } from './element.js';
import { getQueryParam } from './url.js';

const process = getDiv("process");
const frame = getDiv("frame");
const proFrame = getDiv("processframe");
const state = getP("state");
const logo = getP("logo");
const logoImg = getImg("logo");
const fileList = [
    "../assets/fonts/PingFangSC-Regular.woff2",
    "../assets/fonts/sf-pro-display_regular.woff2",
    "../assets/fonts/PingFangSC-Semibold.woff2",
    "../assets/fonts/sf-pro-display_semibold.woff2",
    "../assets/styles/boot.css",
    "../assets/images/Unsupported.png",
    "../assets/jsons/boot.json",
    "../assets/images/MacPro.png",
    "../assets/images/Wallpaper.png",
    "../logon/index.html"
];
let ctrlRPressed = false;
let interval = null;
let nowait = getQueryParam('nowait');
let theme = getQueryParam('theme');

window.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.key.toLowerCase() === "r" && !ctrlRPressed) {
        ctrlRPressed = true;
    }

    if (!interval && ctrlRPressed && nowait != "true") {
        let elapsedSeconds = 0;
        interval = setInterval(() => {
            elapsedSeconds++;
        }, 1000);
    }
});

window.addEventListener('keyup', function (event) {
    if (event.key.toLowerCase() === "r" && event.ctrlKey) {
        ctrlRPressed = false;
    }

    if (!ctrlRPressed && interval) {
        clearInterval(interval);
        interval = null;
    }
});

function fetchJSON(url, arrayName, element) {
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应失败');
            }
            return response.json();
        })
        .then(data => {
            if (data.hasOwnProperty(arrayName) && Array.isArray(data[arrayName])) {
                const array = data[arrayName];

                if (array.includes(element)) {
                    return true;
                } else {
                    return false;
                }
            } else {
                throw new Error(`未找到指定的数组名称：${arrayName}`);
            }
        })
        .catch(error => {
            console.error('发生错误:', error);
        });
}

async function fileExists(filename) {
    try {
        const response = await fetch(filename, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function boot() {
    let platform = getQueryParam('platform');
    let boot = getQueryParam('boot');
    if (theme == "gray") {
        document.body.style.background = "var(--grayboot-bg)";
        logo.style.color = "var(--grayboot-color)";
        proFrame.style.background = "var(--grayboot-process-bg)";
        process.style.background = "var(--grayboot-color)";
        state.style.color = "var(--grayboot-color)";
    }

    let freeze = false;
    if (!platform) {
        platform = 'MacPro7,1';
    }

    if (boot == "recovery") {
        toRecovery();
    } else if (boot == "problem") {
        fiveCountry();
    }

    fetchJSON('../assets/jsons/boot.json', 'platform', platform)
        .then(result => {
            if (result) {
                console.log("Loaded SMBIOS: " + platform);
            } else {
                proFrame.style.background = "var(--boot-bg)";
                notSupported();
                freeze = true;
            }
        });

    let anyFileExists = false;
    let fileExistsNum = 0;

    for (let filePath of fileList) {
        const exists = await fileExists(filePath);
        if (exists) {
            fileExistsNum += 1;
            anyFileExists = true;
            console.log("Verify sucess: " + filePath);
        } else {
            console.log("Verify abort: " + filePath);
            break;
        }
    }


    if (!freeze) {
        if (nowait != "true") {
            setTimeout(() => {
                setTimeout(() => {
                    logo.style.visibility = "visible";
                    setTimeout(() => {
                        if (ctrlRPressed) {
                            setTimeout(toRecovery, 1750);
                        }
                        toLogon(anyFileExists, fileExistsNum);
                    }, 1500);
                }, 1500);
            }, 250);
        } else {
            logo.style.visibility = "visible";
            toLogon(anyFileExists, fileExistsNum);
        }
    }
}

function toLogon(anyFileExists, fileExistsNum) {
    if (anyFileExists && fileExistsNum > 0) {
        frame.style.visibility = 'visible';
        process.style.width = (process.clientWidth + 10 * fileExistsNum) + "%";
        if (process.style.width == "100%") {
            setTimeout(function () {
                window.location = "../logon";
            }, 1750);
        }
    }
}

function toRecovery() {
    window.location = "../recovery";
}

function fiveCountry() {

}

window.onload = boot;

function notSupported() {
    frame.style.maxWidth = "none";
    frame.style.minWidth = "none";
    frame.style.width = "auto";
    frame.style.height = "auto";
    frame.style.marginTop = "20vh";
    process.style.display = "none";
    logo.style.display = "none";
    logoImg.style.display = "block";
    state.style.display = "block";
    state.style.visibility = "visible";
}