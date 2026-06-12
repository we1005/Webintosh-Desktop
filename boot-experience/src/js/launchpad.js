function getQueryParam(param) {
    const params = new URLSearchParams(window.location.search);
    return params.get(param);
}

if (getQueryParam('status') == "close") {
    document.body.style.animation = "fade 1s ease forwards reverse";
    document.querySelector('div[launchpad]').style.animation = "scale 0.75s ease forwards reverse";
} else if (getQueryParam('status') == "open") {
    document.body.style.animation = "fade 1s ease forwards";
    document.querySelector('div[launchpad]').style.animation = "scale 0.75s ease forwards";
}

fetch('../assets/jsons/launchpad.json')
    .then(response => {
        return response.json();
    })
    .then(data => {
        const itemsArray = data.items;

        itemsArray.forEach(appitem => {
            let container = document.createElement('div');
            container.setAttribute('container', '');
            let icon = document.createElement('img');
            icon.src = "../assets/images/" + appitem + ".png";
            let appname = document.createElement('p');
            appname.innerHTML = appitem;
            container.appendChild(icon);
            container.appendChild(appname);
            document.querySelector("div[launchpad]").appendChild(container);
        });
    })
    .catch(error => {
        console.error('Error loading the JSON file:', error);
    });