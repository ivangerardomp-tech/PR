const CACHE = "pwa-pr-v1";

const FILES = [
    "/",
    "/index.html",
    "/styles.css",
    "/script.js",
    "/kml_loader.js",
    "/pr_finder.js",
    "/manifest.json",
    "/PRs.csv",
    "/4505.kml",
    "/4503.kml",
    "/45HLB.kml",
    "/icons/icon-192.png",
    "/icons/icon-512.png"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(FILES))
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(resp => resp || fetch(event.request))
    );
});
