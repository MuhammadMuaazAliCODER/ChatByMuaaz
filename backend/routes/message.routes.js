import express from 'express';
import authenticateToken  from '../middleware/auth.middleware.js';
import {
    sendMessage,
    getMessages,
    markAsDelivered,
    markAsRead,
    markChatAsRead,
    deleteMessage
} from '../controllers/message.controller.js'

const router = express.Router();

// Send a message
router.post('/', authenticateToken, sendMessage);

// Get messages for a chat
router.get('/:chatId', authenticateToken, getMessages);

// Mark message as delivered
router.put('/:messageId/delivered', authenticateToken, markAsDelivered);

// Mark message as read
router.put('/:messageId/read', authenticateToken, markAsRead);

// Mark all messages in chat as read
router.put('/chat/:chatId/read', authenticateToken, markChatAsRead);

// Delete a message
router.delete('/:messageId', authenticateToken, deleteMessage);

export default router;