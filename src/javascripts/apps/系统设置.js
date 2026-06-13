import { createAlert } from '../ui/alert.js';

let window_settings = document.querySelector(".window.settings");
let selectionIcons = document.querySelectorAll(".left .list .selection div.icon");
let selections = document.querySelectorAll(".left .list .selection");
let rightTitle = document.querySelector(".right .toolbar p");

let nowPage = document.getElementById("moonphase.last.quarter.inverse");
let nowSelection = document.querySelector(".left .list .selection.focus");

selectionIcons.forEach(icon => {
    let scale = "75%";
    if (icon.getAttribute("scale")) {
        scale = icon.getAttribute("scale");
    }
    icon.style.background = `url(${icon.getAttribute("icon")}) center center / ${scale} no-repeat,
        url(./assets/images/backgrounds/bg.${icon.classList[1]}.svg) center center / cover no-repeat`;
});

selections.forEach(selection => {
    selection.addEventListener("click", () => {
        nowSelection.classList.remove("focus");
        selection.classList.add("focus");
        nowSelection = selection;

        let pageId = selection.querySelector("div").getAttribute("icon").replace("./assets/images/", "").replace("./assets/icons/", "");
        if (pageId.includes(".svg")) {
            pageId = pageId.replace(".svg", "");
        } else if (pageId.includes(".jpeg")) {
            pageId = pageId.replace(".jpeg", "");
        } else if (pageId.includes(".png")) {
            pageId = pageId.replace(".png", "");
        } else {
            createAlert("./assets/icons/访达.svg", "系统设置遇到问题。", "Selection 图标拓展名不支持", "好", "close");
        }
        let nextPage = document.getElementById(pageId);

        nowPage.classList.remove("focus");
        nextPage.classList.add("focus");
        nowPage = nextPage;

        rightTitle.textContent = selection.querySelector("p:not(.title)").textContent;
    });
});

const dockAutoHideSwitch = document.getElementById("dock-autohide");
if (dockAutoHideSwitch) {
    dockAutoHideSwitch.state = localStorage.getItem("dock-autohide") || "off";

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === "attributes" && mutation.attributeName === "state") {
                const newState = dockAutoHideSwitch.getAttribute("state");
                localStorage.setItem("dock-autohide", newState);
                window.dispatchEvent(new CustomEvent("dock-autohide-change", { detail: newState }));
            }
        });
    });

    observer.observe(dockAutoHideSwitch, { attributes: true });
}

const dockZoomSwitch = document.getElementById("dock-zoom");
if (dockZoomSwitch) {
    dockZoomSwitch.state = localStorage.getItem("dock-zoom") || "off";

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === "attributes" && mutation.attributeName === "state") {
                const newState = dockZoomSwitch.getAttribute("state");
                localStorage.setItem("dock-zoom", newState);
                window.dispatchEvent(new CustomEvent("dock-zoom-change", { detail: newState }));
            }
        });
    });

    observer.observe(dockZoomSwitch, { attributes: true });
}

/* ---------------- 控制中心 外观风格切换 ---------------- */
const CC_STYLE_KEY = "webintosh.cc.style";
const ccStyleCards = window_settings
    ? window_settings.querySelectorAll(".cc-style-card[data-cc-style-value]")
    : document.querySelectorAll(".cc-style-card[data-cc-style-value]");

if (ccStyleCards.length) {
    let currentCcStyle = localStorage.getItem(CC_STYLE_KEY) || "frosted";
    if (currentCcStyle !== "frosted" && currentCcStyle !== "liquid") {
        currentCcStyle = "frosted";
    }

    const highlightCcStyle = (style) => {
        ccStyleCards.forEach((card) => {
            card.classList.toggle(
                "cc-style-selected",
                card.getAttribute("data-cc-style-value") === style
            );
        });
    };

    // 页面打开时高亮当前选项
    highlightCcStyle(currentCcStyle);

    ccStyleCards.forEach((card) => {
        card.addEventListener("click", () => {
            const style = card.getAttribute("data-cc-style-value");
            if (style !== "frosted" && style !== "liquid") return;
            if (style === currentCcStyle) return;
            currentCcStyle = style;
            localStorage.setItem(CC_STYLE_KEY, style);
            highlightCcStyle(style);
            document.dispatchEvent(
                new CustomEvent("webintosh-cc-style", { detail: style })
            );
        });
    });
}