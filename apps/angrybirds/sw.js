/* Angry Birds BYO 启动器的取数 Service Worker。
 * 只拦截本作用域下 /apps/angrybirds/play/ 的请求,从 Cache Storage 里返回
 * 用户在页面里导入的本地网页版文件。仓库内不含任何游戏素材。 */
const CACHE = 'ab-game-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    if (url.pathname.indexOf('/apps/angrybirds/play/') === -1) return; // 其余请求放行
    e.respondWith((async () => {
        const cache = await caches.open(CACHE);
        let res = await cache.match(url.origin + url.pathname);
        if (!res && url.pathname.endsWith('/')) {
            res = await cache.match(url.origin + url.pathname + 'index.html');
        }
        return res || new Response('未在已导入的游戏中找到:' + url.pathname, {
            status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    })());
});
