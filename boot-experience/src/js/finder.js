import { getP } from './element.js';
import { WidgetMenu } from "./ui.js";

export const app_menus = {
    "menu0": [
        "关于访达 hr 设置... hr 清倒废纸篓... hr 服务 hr 隐藏访达 隐藏其他 全部显示",
        "none none none none none none none"
    ],
    "menu1": [
        "新建%20“访达”%20窗口",
        "none"
    ]
};

export let menus = [];
export let menu_states = [];
export let registed_menus = [];
let applemenu;
let appleMenu_state = false;
let recoverymenu;
let recoveryMenu_state = false;

export function appleMenu(menu_logo) {
    if (!appleMenu_state) {
        menu_logo.style.background = '#fafafa25';
        menu_logo.style.textShadow = 'none';
        appleMenu_state = true;
        applemenu = new WidgetMenu(menu_logo, appleMenu_state);
        applemenu.setAttribute('applemenu', '');
        applemenu.setAttribute("x", "10");
        applemenu.setAttribute("y", "25");
        applemenu.setAttribute("width", "200");
        applemenu.setAttribute("content", "关于本机 hr 系统设置... App%20Store... hr 最近使用的项目 hr 强制退出... hr 睡眠 重新启动... 关机... hr 锁定屏幕 退出登录%20“Webintosh”...");
        applemenu.setAttribute("command", "none none none none none none none none none none");
        document.body.appendChild(applemenu);
        const closeMenu = (e) => {
            if (!e.target.matches("widget-menu[applemenu]") && !e.target.isSameNode(menu_logo)) {
                menu_logo.style.background = 'none';
                menu_logo.style.textShadow = '0 2px 10px #000a;';
                appleMenu_state = false;
                applemenu.style.opacity = 0;
                setTimeout(function () {
                    document.body.removeChild(applemenu);
                }, 100);
                document.removeEventListener('click', closeMenu);
            }
        };

        document.addEventListener('click', closeMenu);
    } else {
        menu_logo.style.background = '#fafafa00';
        menu_logo.style.textShadow = '0 2px 10px #000a;';
        appleMenu_state = false;
        applemenu.style.opacity = 0;
        setTimeout(function () {
            document.body.removeChild(applemenu);
        }, 100);
    }
}

function restart() {

}

function shutdown() {
    window.close();
}

export function recoveryMenu(menu_logo) {
    if (!recoveryMenu_state) {
        menu_logo.style.background = '#fafafa25';
        menu_logo.style.textShadow = 'none';
        recoveryMenu_state = true;
        recoverymenu = new WidgetMenu(menu_logo, recoveryMenu_state);
        recoverymenu.setAttribute('recoverymenu', '');
        recoverymenu.setAttribute("x", "10");
        recoverymenu.setAttribute("y", "25");
        // recoverymenu.setAttribute("width", "200");
        recoverymenu.setAttribute("content", "重新启动 关机 hr 启动磁盘...");
        recoverymenu.setAttribute("command", "none none none");
        document.body.appendChild(recoverymenu);
        const closeMenu = (e) => {
            if (!e.target.matches("widget-menu[recoverymenu]") && !e.target.isSameNode(menu_logo)) {
                menu_logo.style.background = 'none';
                menu_logo.style.textShadow = '0 2px 10px #000a;';
                recoveryMenu_state = false;
                recoverymenu.style.opacity = 0;
                setTimeout(function () {
                    document.body.removeChild(recoverymenu);
                }, 100);
                document.removeEventListener('click', closeMenu);
            }
        };

        document.addEventListener('click', closeMenu);
    } else {
        menu_logo.style.background = '#fafafa00';
        menu_logo.style.textShadow = '0 2px 10px #000a;';
        recoveryMenu_state = false;
        recoverymenu.style.opacity = 0;
        setTimeout(function () {
            document.body.removeChild(recoverymenu);
        }, 100);
    }
}

export function updateMenubar(menu) {
    menu.forEach((menu, index) => {
        menus[index].innerHTML = menu;
    });
}

export function getMenu() {
    for (let index = 0; index < 11; index++) {
        menus.push(getP(`menu${index}`));
    }
}

function showAppMenu(element, menu, cmd) {
    let index = registed_menus.indexOf(element);
    let this_state = menu_states[index];
    let this_menu = null;

    // 查找已存在的菜单
    if (index !== -1) {
        this_menu = document.querySelector(`widget-menu[appmenu${index}]`);
    }

    if (!this_state) {
        // 打开菜单
        element.style.background = '#fafafa25';
        element.style.textShadow = 'none';
        menu_states[index] = true;

        if (!this_menu) {
            // 创建新菜单
            this_menu = new WidgetMenu(element, true);
            registed_menus.push(this_menu);
            this_menu.setAttribute(`appmenu${index}`, '');
            this_menu.setAttribute("x", `${element.offsetLeft}`);
            this_menu.setAttribute("y", "25");
            this_menu.setAttribute("width", "150");
            this_menu.setAttribute("content", menu);
            this_menu.setAttribute("command", cmd);
            document.body.appendChild(this_menu);
        } else {
            // 显示已存在的菜单
            this_menu.style.opacity = 1;
        }

        // 关闭菜单的函数
        const closeMenu = (e) => {
            if (!e.target.matches(`widget-menu[appmenu${index}]`) && !e.target.isSameNode(element)) {
                element.style.background = 'none';
                element.style.textShadow = '0 2px 10px #000a';
                menu_states[index] = false;
                if (this_menu) {
                    this_menu.style.opacity = 0;
                    setTimeout(() => {
                        if (this_menu && document.body.contains(this_menu)) {
                            document.body.removeChild(this_menu);
                        }
                    }, 100);
                }
                document.removeEventListener('click', closeMenu);
            }
        };

        // 移除旧的监听器并绑定新的监听器
        document.removeEventListener('click', closeMenu);
        document.addEventListener('click', closeMenu);
    } else {
        // 关闭菜单
        element.style.background = 'none';
        element.style.textShadow = '0 2px 10px #000a';
        menu_states[index] = false;
        if (this_menu) {
            this_menu.style.opacity = 0;
            setTimeout(() => {
                if (this_menu && document.body.contains(this_menu)) {
                    document.body.removeChild(this_menu);
                }
            }, 100);
        }
    }
}

export function registerAllMenu() {
    getMenu();
    for (let i = 1; i < menus.length; i++) {
        console.log("Registered " + menus[i]);
        menus[i].addEventListener("click", () => {
            showAppMenu(menus[i], app_menus[i][0], app_menus[i][1]);
        });
    }
}