import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

// ── Configure VAPID ───────────────────────────────────────────────────
// Generate keys once with: npx web-push generate-vapid-keys
// Then add to your .env:
//   VAPID_PUBLIC_KEY=...
//   VAPID_PRIVATE_KEY=...
//   VAPID_MAILTO=mailto:you@yourdomain.com

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_MAILTO || 'mailto:admin@chatapp.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
    console.log('[Push] VAPID configured');
} else {
    console.warn('[Push] VAPID keys not set — push notifications disabled');
}

// ── Save a push subscription for a user ──────────────────────────────
export const savePushSubscription = async (userId, subscription, userAgent = '') => {
    try {
        // Upsert by endpoint — if it already exists, update keys & mark active
        const saved = await PushSubscription.findOneAndUpdate(
            { endpoint: subscription.endpoint },
            {
                user:      userId,
                endpoint:  subscription.endpoint,
                keys:      subscription.keys,
                userAgent,
                active:    true,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return saved;
    } catch (error) {
        console.error('[Push] Failed to save subscription:', error);
        throw error;
    }
};

// ── Remove a push subscription ────────────────────────────────────────
export const removePushSubscription = async (userId, endpoint) => {
    try {
        await PushSubscription.findOneAndUpdate(
            { user: userId, endpoint },
            { active: false }
        );
    } catch (error) {
        console.error('[Push] Failed to remove subscription:', error);
        throw error;
    }
};

// ── Get all active subscriptions for a user ───────────────────────────
export const getUserSubscriptions = async (userId) => {
    return PushSubscription.find({ user: userId, active: true });
};

/**
 * Send a push notification to a user (all their active devices).
 *
 * @param {string} userId       - MongoDB user _id
 * @param {object} payload      - Notification payload
 * @param {string} payload.title
 * @param {string} payload.body
 * @param {string} [payload.icon]
 * @param {string} [payload.badge]
 * @param {string} [payload.tag]       - Notification tag (replaces previous with same tag)
 * @param {boolean}[payload.renotify]  - Re-alert if replacing an existing tag
 * @param {object} [payload.data]      - Extra data passed to service worker (e.g. url, chatId)
 */
export const sendPushNotification = async (userId, payload) => {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.warn('[Push] Skipping — VAPID keys not configured');
        return;
    }

    const subscriptions = await getUserSubscriptions(userId);
    if (!subscriptions.length) return;

    const notifPayload = JSON.stringify({
        title:    payload.title    || 'New Message',
        body:     payload.body     || '',
        icon:     payload.icon     || '/icons/icon-192x192.png',
        badge:    payload.badge    || '/icons/badge-72x72.png',
        tag:      payload.tag      || 'chat-notification',
        renotify: payload.renotify ?? false,
        data:     payload.data     || {},
    });

    const results = await Promise.allSettled(
        subscriptions.map(sub =>
            webpush.sendNotification(
                { endpoint: sub.endpoint, keys: sub.keys },
                notifPayload,
                { TTL: 86400 } // 24 hours
            ).catch(async (err) => {
                // 410 Gone = subscription expired/unsubscribed → deactivate it
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log(`[Push] Deactivating expired subscription: ${sub.endpoint}`);
                    await PushSubscription.findByIdAndUpdate(sub._id, { active: false });
                } else {
                    console.error(`[Push] Failed to send to ${sub.endpoint}:`, err.message);
                }
            })
        )
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    if (sent)   console.log(`[Push] Sent to ${sent}/${subscriptions.length} devices for user ${userId}`);
    if (failed) console.warn(`[Push] Failed for ${failed} devices`);
};

// ── Send a test notification to a user ───────────────────────────────
export const sendTestNotification = async (userId) => {
    return sendPushNotification(userId, {
        title: '🔔 Notifications are working!',
        body:  'You will now receive message alerts even when the app is closed.',
        tag:   'test-notification',
        data:  { url: '/' },
    });
};

// ── Send a new message push notification (convenience wrapper) ────────
export const sendNewMessagePush = async (recipientId, { senderName, senderAvatar, content, chatId, messageId, type }) => {
    return sendPushNotification(recipientId, {
        title:    senderName || 'New Message',
        body:     type === 'audio' ? '🎤 Voice message' : (content || ''),
        icon:     senderAvatar || '/icons/icon-192x192.png',
        tag:      `chat-${chatId}`,
        renotify: false,
        data: {
            chatId,
            messageId,
            url: `/chat/${chatId}`,
        },
    });
};