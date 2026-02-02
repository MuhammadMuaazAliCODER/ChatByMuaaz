import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
    savePushSubscription,
    removePushSubscription,
    getUserSubscriptions,
    sendTestNotification
} from '../services/push.service.js';

const router = express.Router();

// Get VAPID public key for client
router.get('/vapid-public-key', (req, res) => {
    res.json({
        publicKey: process.env.VAPID_PUBLIC_KEY
    });
});

// Subscribe to push notifications
router.post('/subscribe', authenticateToken, async (req, res) => {
    try {
        const { subscription } = req.body;
        const userId = req.user._id;
        const userAgent = req.headers['user-agent'];

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subscription object'
            });
        }

        const saved = await savePushSubscription(userId, subscription, userAgent);

        res.json({
            success: true,
            message: 'Push notification subscription saved',
            subscription: saved
        });
    } catch (error) {
        console.error('Error subscribing to push:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to subscribe to push notifications'
        });
    }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authenticateToken, async (req, res) => {
    try {
        const { endpoint } = req.body;
        const userId = req.user._id;

        await removePushSubscription(userId, endpoint);

        res.json({
            success: true,
            message: 'Push notification subscription removed'
        });
    } catch (error) {
        console.error('Error unsubscribing from push:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unsubscribe from push notifications'
        });
    }
});

// Get user's active subscriptions
router.get('/subscriptions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;
        const subscriptions = await getUserSubscriptions(userId);

        res.json({
            success: true,
            subscriptions
        });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscriptions'
        });
    }
});

// Send test notification
router.post('/test', authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;
        await sendTestNotification(userId);

        res.json({
            success: true,
            message: 'Test notification sent'
        });
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test notification'
        });
    }
});

export default router;
