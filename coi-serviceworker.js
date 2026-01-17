/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
// This is a custom version that only activates on GitHub Pages (not on lovable.app)
// to avoid interference with React development
let coepCredentialless = false;
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

    self.addEventListener("message", (ev) => {
        if (!ev.data) {
            return;
        } else if (ev.data.type === "deregister") {
            self.registration
                .unregister()
                .then(() => {
                    return self.clients.matchAll();
                })
                .then((clients) => {
                    clients.forEach((client) => client.navigate(client.url));
                });
        } else if (ev.data.type === "coepCredentialless") {
            coepCredentialless = ev.data.value;
        }
    });

    self.addEventListener("fetch", function (event) {
        const r = event.request;
        if (r.cache === "only-if-cached" && r.mode !== "same-origin") {
            return;
        }

        const request =
            coepCredentialless && r.mode === "no-cors"
                ? new Request(r, {
                      credentials: "omit",
                  })
                : r;
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set(
                        "Cross-Origin-Embedder-Policy",
                        coepCredentialless ? "credentialless" : "require-corp"
                    );
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((e) => console.error(e))
        );
    });
} else {
    (() => {
        // Only activate on GitHub Pages, not on lovable.app or localhost
        const isGitHubPages = window.location.hostname.endsWith('.github.io');
        
        if (!isGitHubPages) {
            console.log('[COI] Skipping COI setup - not on GitHub Pages');
            return;
        }
        
        // Check if SharedArrayBuffer is already available
        if (typeof SharedArrayBuffer !== 'undefined') {
            console.log('[COI] SharedArrayBuffer already available');
            return;
        }

        const coi = {
            shouldRegister: () => !navigator.serviceWorker?.controller,
            shouldDeregister: () => false,
            coepCredentialless: () => true,
            quiet: false,
        };

        const n = navigator;
        const controlling = n.serviceWorker?.controller;

        if (controlling) {
            console.log('[COI] Service worker already controlling');
            controlling.postMessage({ type: "coepCredentialless", value: coi.coepCredentialless() });
            return;
        }

        if (!coi.shouldRegister()) {
            console.log('[COI] Should not register');
            return;
        }

        if (!n.serviceWorker) {
            console.error("[COI] Service worker is not supported");
            return;
        }

        // Get correct path for the service worker
        const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
        const swPath = basePath + 'coi-serviceworker.js';
        
        n.serviceWorker.register(swPath).then(
            (registration) => {
                !coi.quiet && console.log("[COI] Service worker registered");
                registration.addEventListener("updatefound", () => {
                    !coi.quiet && console.log("[COI] Reloading page to enable SharedArrayBuffer");
                    window.location.reload();
                });
                if (registration.active && !n.serviceWorker.controller) {
                    !coi.quiet && console.log("[COI] Reloading page to enable SharedArrayBuffer");
                    window.location.reload();
                }
            },
            (err) => {
                !coi.quiet && console.error("[COI] Service worker registration failed:", err);
            }
        );
    })();
}
