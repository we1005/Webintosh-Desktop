import { getImg } from "./element.js";
import { getQueryParam } from "./url.js";

document.body.style.opacity = 0;

const logo = getImg("logo");
const theme = getQueryParam("theme");

setInterval(() => {
    logo.style.opacity = (logo.style.opacity === '1' ? '0' : '1');
}, 750);

let altPressed;
let interval;
let manager_down_sec = 2;

window.addEventListener('keydown', function (event) {
    if (event.key === "Alt" && !altPressed) {
        altPressed = true;
    }

    if (!interval && altPressed) {
        let elapsedSeconds = 0;
        const targetTime = manager_down_sec;
        interval = setInterval(() => {
            elapsedSeconds++;

            if (elapsedSeconds >= targetTime) {
                clearInterval(interval);
                interval = null;
                
                if (altPressed) {
                    toManager();
                }
            }
        }, 1000);
    }
});

window.addEventListener('keyup', function (event) {
    if (event.key === "Alt") {
        altPressed = false;
    }

    if (!altPressed && interval) {
        clearInterval(interval);
        interval = null;
    }
});

function toManager() {
    window.location = `./manager.html?theme=${theme}`;
}
function toBoot() {
    window.location = `../boot/?theme=${theme}&nowait=true`;
}

function firmware() {
    if (theme == "gray") {
        document.body.style.background = "var(--grayboot-bg)";
        document.body.style.color = "var(--grayboot-color)";
    }

    if (altPressed) {
        return;
    }
    setTimeout(() => {
        toBoot();
    }, 3000);
}

window.onload = firmware;