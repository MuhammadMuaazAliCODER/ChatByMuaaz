// sw.js — Service Worker for push notifications
// Place this file at the ROOT of your public/static directory

const CACHE_NAME = 'chat-app-v1';

// ── Install ───────────────────────────────────────────
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// ── Push event: show notification ────────────────────
self.addEventListener('push', (event) => {
    let payload = {};

    try {
        payload = event.data ? event.data.json() : {};
    } catch (e) {
        payload = {
            title: 'New Message',
            body:  event.data ? event.data.text() : '',
        };
    }

    const title   = payload.title   || 'New Message';
    const options = {
        body:            payload.body    || '',
        icon:            payload.icon    || '/icons/icon-192x192.png',
        badge:           payload.badge   || '/icons/badge-72x72.png',
        tag:             payload.tag     || 'chat-notification',
        renotify:        payload.renotify ?? false,
        silent:          false,
        vibrate:         [200, 100, 200],
        data:            payload.data    || {},
        // Action buttons
        actions: [
            { action: 'open',    title: 'Open Chat' },
            { action: 'dismiss', title: 'Dismiss'   },
        ],
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ── Notification click: open the app ─────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const action = event.action;
    const data   = event.notification.data || {};
    const url    = data.url || '/';

    if (action === 'dismiss') return;

    // Focus existing window or open a new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if a window is already open
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin)) {
                    client.focus();
                    // Post a message to the page so it can navigate to the right chat
                    client.postMessage({
                        type:   'NOTIFICATION_CLICK',
                        chatId: data.chatId,
                        url,
                    });
                    return;
                }
            }
            // No window open — open a new one
            return clients.openWindow(url);
        })
    );
});

// ── Handle messages from the page ────────────────────
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});