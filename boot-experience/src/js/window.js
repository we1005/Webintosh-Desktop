function create_window(x, y, file) {
    const iframe = document.createElement('iframe');
    iframe.src = file;
    iframe.style.position = 'absolute';
    iframe.style.top = y + 'px';
    iframe.style.left = x + 'px';
    document.body.appendChild(iframe);

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