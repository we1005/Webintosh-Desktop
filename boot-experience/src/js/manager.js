import { getDiv, getImg } from "./element.js";
import { getQueryParam } from "./url.js";

const option = getDiv("option");
const manager = getDiv("manager");
const disk = getImg("icon");
const selector = getImg("selector");
const theme = getQueryParam("theme")

if (theme == "gray") {
    document.body.style.background = "var(--grayboot-bg)";
    document.body.style.color = "var(--grayboot-color)";
    disk.style.border = "none";
}

function toBoot() {
    option.style.display = "none";
    setTimeout(() => {
        window.location = "./?nowait=true&theme";
    }, 750);
}

window.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        toBoot();
    }
});

disk.addEventListener("click", toBoot);
selector.addEventListener("click", toBoot);

setTimeout(() => {
    manager.style.opacity = 1;
}, 750);