const cursor = document.createElement("img");
cursor.src = "../assets/images/Cursor.svg";
cursor.style.width = "256px";
cursor.style.height = "256px";
cursor.style.transition = "transform 0.2s ease";
cursor.style.position = "fixed";
cursor.style.top = "10px";
cursor.style.left = "10px";
cursor.style.transformOrigin = "left top";
cursor.style.transform = "scale(0.1)";
cursor.style.pointerEvents = "none";
cursor.style.zIndex = 2048;
cursor.id = "cursor";

document.body.appendChild(cursor);

const iframes = document.querySelectorAll("iframe");
const url = window.location.href;
let is_app = false;

if (url.includes("Apps/")) {
    cursor.style.opacity = "0";
    is_app = true;
} else {
    cursor.style.opacity = "1";
}

let lastX = 0;
let lastY = 0;
let lastTime = 0;
let idleTimer;

window.addEventListener("mousemove", (e) => {
    const currentX = e.clientX;
    const currentY = e.clientY;
    const currentTime = new Date().getTime();

    if (lastTime > 0) {
        const distance = Math.sqrt((currentX - lastX) ** 2 + (currentY - lastY) ** 2);
        const timeDiff = currentTime - lastTime;
        const speed = distance / timeDiff;

        if (speed > 10) {
            cursor.style.transform = "scale(0.75)";
        } else {
            cursor.style.transform = "scale(0.1)";
        }
    }

    lastX = currentX;
    lastY = currentY;
    lastTime = currentTime;

    cursor.style.top = `${currentY}px`;
    cursor.style.left = `${currentX}px`;

    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        cursor.style.transform = "scale(0.1)";
    }, 1000);

    cursor.style.opacity = "1";
});

if (!is_app) {
    iframes.forEach((iframe) => {
        const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;

        iframe.addEventListener("mouseenter", () => {
            cursor.style.opacity = "0";
            if (iframeDocument) {
                iframe.contentWindow.document.getElementById("cursor").style.opacity = "1";
            }
            console.log("Enter Iframe");
        });

        iframe.addEventListener("mouseleave", () => {
            cursor.style.opacity = "0";
            if (iframeDocument) {
                iframe.contentWindow.document.getElementById("cursor").style.opacity = "0";
            }
            console.log("Leave Iframe");
        });

        if (iframeDocument) {
            iframe.contentWindow?.document.body.addEventListener("mouseenter", () => {
                cursor.style.opacity = "0";
                if (iframeDocument) {
                    iframe.contentWindow.document.getElementById("cursor").style.opacity = "0";
                }
                console.log("Enter Body (Iframe)");
            });

            iframe.contentWindow?.document.body.addEventListener("mouseleave", () => {
                cursor.style.opacity = "0";
                if (iframeDocument) {
                    iframe.contentWindow.document.getElementById("cursor").style.opacity = "0";
                }
                console.log("Leave Body (Iframe)");
            });

            iframe.contentWindow?.document.body.addEventListener("mouseenter", () => {
                cursor.style.opacity = "0"; 
                if (iframeDocument) {
                    iframe.contentWindow.document.getElementById("cursor").style.opacity = "1";
                }
                console.log("Enter Iframe Body");
            });

            iframe.contentWindow?.document.body.addEventListener("mouseleave", () => {
                cursor.style.opacity = "0"; 
                if (iframeDocument) {
                    iframe.contentWindow.document.getElementById("cursor").style.opacity = "0";
                }
                console.log("Leave Iframe Body");
            });
        }
    });
} else {
    cursor.style.opacity = "0";
}
