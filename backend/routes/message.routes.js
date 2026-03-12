import express from 'express';
import authenticateToken from '../middleware/auth.middleware.js';
import { checkMessageLimit } from '../middleware/checkMessageLimit.js';
import {
    sendMessage,
    editMessage,       // ← NEW
    getMessages,
    markAsDelivered,
    markAsRead,
    markChatAsRead,
    deleteMessage
} from '../controllers/message.controller.js';

const router = express.Router();

// Send a message — checkMessageLimit blocks if monthly quota is exceeded
router.post('/',                        authenticateToken, checkMessageLimit, sendMessage);

// Get messages for a chat
router.get('/:chatId',                  authenticateToken, getMessages);

// Edit a message (sender only, text messages only)
router.put('/:messageId',               authenticateToken, editMessage);        // ← NEW

// Mark message as delivered
router.put('/:messageId/delivered',     authenticateToken, markAsDelivered);

// Mark message as read
router.put('/:messageId/read',          authenticateToken, markAsRead);

// Mark all messages in chat as read
router.put('/chat/:chatId/read',        authenticateToken, markChatAsRead);

// Delete a message
router.delete('/:messageId',            authenticateToken, deleteMessage);

export default router;