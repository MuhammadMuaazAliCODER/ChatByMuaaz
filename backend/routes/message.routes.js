import express from 'express';
import authenticateToken from '../middleware/auth.middleware.js';
import { checkMessageLimit } from '../middleware/checkMessageLimit.js';
import {
    sendMessage,
    scheduleMessage,
    getScheduledMessages,
    cancelScheduledMessage,
    editMessage,
    getMessages,
    markAsDelivered,
    markAsRead,
    markChatAsRead,
    deleteMessage
} from '../controllers/message.controller.js';

const router = express.Router();

// ─── Regular messages ─────────────────────────────────────────────────────────
router.post('/',                            authenticateToken, checkMessageLimit, sendMessage);
router.get('/:chatId',                      authenticateToken, getMessages);
router.put('/:messageId',                   authenticateToken, editMessage);
router.put('/:messageId/delivered',         authenticateToken, markAsDelivered);
router.put('/:messageId/read',              authenticateToken, markAsRead);
router.put('/chat/:chatId/read',            authenticateToken, markChatAsRead);
router.delete('/:messageId',               authenticateToken, deleteMessage);

// ─── Scheduled messages ───────────────────────────────────────────────────────
// NOTE: keep /schedule and /scheduled ABOVE /:messageId routes to avoid param collision
router.post('/schedule',                    authenticateToken, scheduleMessage);
router.get('/scheduled/list',               authenticateToken, getScheduledMessages);
router.put('/:messageId/cancel-schedule',   authenticateToken, cancelScheduledMessage);

export default router;