import { recoveryMenu } from "../src/js/finder.js";
import { getP } from "../src/js/element.js";

const menu_logo = getP("logo");

menu_logo.addEventListener('click', () => recoveryMenu(menu_logo));