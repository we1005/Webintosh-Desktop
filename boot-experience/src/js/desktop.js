import { appleMenu, registerAllMenu } from "./finder.js";
import { getP } from "./element.js";

const datetime = getP('datetime');
const menu_logo = getP("logo");

function updateTime() {
    const currentDateTime = new Date();
    const hours = currentDateTime.getHours().toString().padStart(2, '0');
    const minutes = currentDateTime.getMinutes().toString().padStart(2, '0');
    let day = currentDateTime.getDate();
    let month = currentDateTime.getMonth() + 1;
    const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    let weekDay = days[currentDateTime.getDay()];
    day = day.toString();
    month = month.toString();
    datetime.innerHTML = `${month}月${day}日 ${weekDay} ${hours}:${minutes}`;
}

function getMaxZIndex() {
    let maxZIndex = 0;
    const elements = document.querySelectorAll('*');

    elements.forEach((element) => {
        const zIndex = window.getComputedStyle(element).zIndex;
        if (zIndex !== 'auto' && !isNaN(zIndex)) {
            maxZIndex = Math.max(maxZIndex, parseInt(zIndex, 10));
        }
    });

    return maxZIndex;
}

menu_logo.addEventListener('click', () => appleMenu(menu_logo));
registerAllMenu();
updateTime();
setInterval(updateTime, 10000);
