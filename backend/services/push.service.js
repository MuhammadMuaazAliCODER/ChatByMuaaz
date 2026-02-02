import webPush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

// Configure web-push with VAPID keys
// Generate keys with: npx web-push generate-vapid-keys
webPush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@chatbymuaaz.online'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

/**
 * Send push notification to a user
 * @param {String} userId - User ID to send notification to
 * @param {Object} payload - Notification payload
 * @returns {Promise}
 */
export const sendPushNotification = async (userId, payload) => {
    try {
        // Get all active subscriptions for this user
        const subscriptions = await PushSubscription.find({
            user: userId,
            active: true
        });

        if (subscriptions.length === 0) {
            console.log(`No active push subscriptions for user ${userId}`);
            return;
        }

        const notificationPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icon-192x192.png',
            badge: payload.badge || '/badge-72x72.png',
            vibrate: [200, 100, 200],
            data: payload.data || {},
            actions: payload.actions || [],
            tag: payload.tag || 'message-notification',
            requireInteraction: false,
            timestamp: Date.now()
        });

        // Send to all subscriptions
        const results = await Promise.allSettled(
            subscriptions.map(async (subscription) => {
                try {
                    await webPush.sendNotification(
                        {
                            endpoint: subscription.endpoint,
                            keys: {
                                p256dh: subscription.keys.p256dh,
                                auth: subscription.keys.auth
                            }
                        },
                        notificationPayload
                    );
                    return { success: true, subscriptionId: subscription._id };
                } catch (error) {
                    // If subscription is invalid, mark as inactive
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        await PushSubscription.findByIdAndUpdate(
                            subscription._id,
                            { active: false }
                        );
                    }
                    throw error;
                }
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`Push notifications sent: ${successful} successful, ${failed} failed`);
        
        return { successful, failed };
    } catch (error) {
        console.error('Error sending push notification:', error);
        throw error;
    }
};

/**
 * Save a new push subscription
 * @param {String} userId - User ID
 * @param {Object} subscription - Push subscription object from browser
 * @param {String} userAgent - Browser user agent
 * @returns {Promise}
 */
export const savePushSubscription = async (userId, subscription, userAgent = '') => {
    try {
        // Check if subscription already exists
        const existing = await PushSubscription.findOne({
            endpoint: subscription.endpoint
        });

        if (existing) {
            // Update existing subscription
            existing.user = userId;
            existing.keys = subscription.keys;
            existing.userAgent = userAgent;
            existing.active = true;
            await existing.save();
            return existing;
        }

        // Create new subscription
        const newSubscription = new PushSubscription({
            user: userId,
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            userAgent,
            active: true
        });

        await newSubscription.save();
        return newSubscription;
    } catch (error) {
        console.error('Error saving push subscription:', error);
        throw error;
    }
};

/**
 * Remove a push subscription
 * @param {String} userId - User ID
 * @param {String} endpoint - Subscription endpoint
 * @returns {Promise}
 */
export const removePushSubscription = async (userId, endpoint) => {
    try {
        await PushSubscription.findOneAndUpdate(
            { user: userId, endpoint },
            { active: false }
        );
    } catch (error) {
        console.error('Error removing push subscription:', error);
        throw error;
    }
};

/**
 * Get all active subscriptions for a user
 * @param {String} userId - User ID
 * @returns {Promise}
 */
export const getUserSubscriptions = async (userId) => {
    return await PushSubscription.find({
        user: userId,
        active: true
    });
};

/**
 * Test push notification
 * @param {String} userId - User ID to test
 * @returns {Promise}
 */
export const sendTestNotification = async (userId) => {
    return await sendPushNotification(userId, {
        title: 'Test Notification',
        body: 'This is a test notification from ChatByMuaaz!',
        icon: '/icon-192x192.png',
        data: {
            url: '/'
        }
    });
};
