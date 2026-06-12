import { getDiv } from './element.js';

let launchpad = false;
let launchpadIframe = undefined;

function create_window(x, y, zindex=null, file, type=null) {
    const iframe = window.parent.document.createElement('iframe');
    iframe.src = file;
    iframe.style.position = 'absolute';
    iframe.style.top = y + 'px';
    iframe.style.left = x + 'px';
    iframe.style.overflow = 'hidden';
    if (zindex) {
        iframe.style.zIndex = zindex;
    }

    if (type == "Launchpad") {
        if (launchpad) {
            launchpadIframe.src = file + "?status=close";
            if (launchpadIframe) {
                setTimeout(() => {
                    document.body.removeChild(launchpadIframe);
                }, 1000);
                launchpadIframe = undefined;
                launchpad = false;
            }
        } else {
            if (launchpadIframe) {
                launchpadIframe.src = file + "?status=open";
            } else {
                launchpadIframe = iframe;
            }
            window.parent.document.body.appendChild(iframe);
            launchpad = true;
        }
    } else {
        // For other types of iframes, append normally
        window.parent.document.body.appendChild(iframe);
    }

    iframe.onload = function() {
        iframe.style.width = iframe.contentWindow.document.body.scrollWidth + 'px';
        iframe.style.height = iframe.contentWindow.document.body.scrollHeight + 'px';
    };

    window.addEventListener('resize', function() {
        if (iframe.contentWindow.document) {
            iframe.style.width = iframe.contentWindow.document.body.scrollWidth + 'px';
            iframe.style.height = iframe.contentWindow.document.body.scrollHeight + 'px';
        }
    });
}

const dock = getDiv('dock');
const appname = getDiv("appname");

fetch('../assets/jsons/dock.json')
    .then(response => {
        return response.json();
    })
    .then(data => {
        const itemsArray = data.items;
        const result = itemsArray.map(item => ({
            name: item[0],
            path: item[1],
            x: item[3],
            y: item[4]
        }));
        let i = 0;
        let icons = [];

        result.forEach(dockitem => {
            i += 1;
            if (i == 19) {
                let hr = document.createElement('hr');
                dock.appendChild(hr);
            }
            let icon = document.createElement('img');
            let container = document.createElement('div');
            let light = document.createElement('div');
            container.setAttribute('container', '');
            light.setAttribute('light', '');
            if (i == 1) {
                light.style.opacity = "0.4";
            }
            icon.src = "../assets/images/" + dockitem.name + ".png";
            icon.alt = dockitem.name;
            icon.path = dockitem.path;
            icons.push([icon, dockitem.path]);
            container.appendChild(icon);
            container.appendChild(light);
            dock.appendChild(container);
        });

        icons.forEach(iconlist => {
            const icon = iconlist[0];
            const path = iconlist[1];
            const x = iconlist[3];
            const y = iconlist[4];
            icon.addEventListener('click', () => {
                if (x == 0 || y == 0) {
                    create_window(x, y, "3", "../" + path, "Launchpad");
                }
                create_window(x, y, null, "../" + path);
                // updateMenu(app_menus[icon.alt]);
            });
            icon.addEventListener('mouseover', () => {
                const event = new MouseEvent('mouseover', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                icon.dispatchEvent(event);

                const iconrect = icon.getBoundingClientRect();
                appname.style.display = 'block';
                appname.style.top = `${iconrect.top - dock.clientHeight * 0.75}px`;
                appname.style.left = `${iconrect.left + (iconrect.width - appname.offsetWidth) / 2}px`;
                appname.innerHTML = icon.alt;
            });
            icon.addEventListener('mouseout', () => {
                appname.style.display = 'none';
            });
        });
        dock.style.transform = 'translateY(0)';
    })
    .catch(error => {
        console.error('Error loading the JSON file:', error);
    });