import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import { sendMessageNotification, sendToUser } from '../websocket/socket.js';

// Send a new message
export const sendMessage = async (req, res) => {
    try {
        const { chatId, content, type = 'text', audioUrl } = req.body;
        const senderId = req.user._id;

        const chat = await Chat.findById(chatId).populate('participants', 'name username profilePicture');
        
        if (!chat) {
            return res.status(404).json({ success: false, message: 'Chat not found' });
        }

        const isParticipant = chat.participants.some(
            p => p._id.toString() === senderId.toString()
        );

        if (!isParticipant) {
            return res.status(403).json({ success: false, message: 'You are not a participant of this chat' });
        }

        const message = new Message({
            chat: chatId,
            sender: senderId,
            content,
            type,
            audioUrl,
            status: 'sent'
        });

        await message.save();
        // Populate sender so message.sender is a full object before we use it below
        await message.populate('sender', 'name username profilePicture');

        chat.lastMessage = message._id;
        chat.updatedAt = new Date();
        await chat.save();

        if (req.countMessage) {
            await req.countMessage();
        }

        const recipient = chat.participants.find(
            p => p._id.toString() !== senderId.toString()
        );

        if (recipient) {
            await sendMessageNotification(recipient._id.toString(), {
                _id: message._id,
                chatId: chatId,
                content: message.content,
                type: message.type,
             
                sender: {
                    _id: message.sender._id,
                    name: message.sender.name,
                    username: message.sender.username,
                    profilePicture: message.sender.profilePicture
                },
              
                senderName: message.sender.name,
                senderAvatar: message.sender.profilePicture,
                createdAt: message.createdAt
            });
        }

        res.status(201).json({
            success: true,
            message: message,
            usage: req.usageInfo || null
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
};


export const editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content }   = req.body;
        const userId        = req.user._id;

        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Content cannot be empty' });
        }

        const message = await Message.findById(messageId).populate('sender', 'name username profilePicture');

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

    
        if (message.sender._id.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
        }

    
        if (message.type === 'audio' || message.type === 'voice') {
            return res.status(400).json({ success: false, message: 'Voice messages cannot be edited' });
        }

        message.content  = content.trim();
        message.edited   = true;
        message.editedAt = new Date();
        await message.save();

        // Notify all participants in the chat via WebSocket
        const chat = await Chat.findById(message.chat);
        if (chat) {
            chat.participants.forEach(participantId => {
                const pid = participantId._id?.toString() || participantId.toString();
                if (pid !== userId.toString()) {
                    sendToUser(pid, {
                        type:      'message_edited',
                        messageId: message._id,
                        chatId:    message.chat,
                        content:   message.content,
                        editedAt:  message.editedAt
                    });
                }
            });
        }

        res.json({ success: true, message });
    } catch (error) {
        console.error('Error editing message:', error);
        res.status(500).json({ success: false, message: 'Failed to edit message' });
    }
};

// Mark message as delivered
export const markAsDelivered = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId).populate('sender');

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        if (message.sender._id.toString() === userId.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot mark your own message as delivered' });
        }

        if (message.status === 'sent') {
            message.status = 'delivered';
            message.deliveredAt = new Date();
            await message.save();

            sendToUser(message.sender._id.toString(), {
                type: 'message_delivered',
                messageId: message._id,
                deliveredAt: message.deliveredAt
            });
        }

        res.json({ success: true, message });
    } catch (error) {
        console.error('Error marking message as delivered:', error);
        res.status(500).json({ success: false, message: 'Failed to mark message as delivered' });
    }
};

// Mark message as read
export const markAsRead = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId).populate('sender');

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        if (message.sender._id.toString() === userId.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot mark your own message as read' });
        }

        if (message.status !== 'read') {
            message.status = 'read';
            message.readAt = new Date();
            message.read   = true;
            
            if (!message.deliveredAt) {
                message.deliveredAt = message.readAt;
            }
            
            await message.save();

            sendToUser(message.sender._id.toString(), {
                type:      'message_read',
                messageId: message._id,
                readAt:    message.readAt
            });
        }

        res.json({ success: true, message });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ success: false, message: 'Failed to mark message as read' });
    }
};

// Mark all messages in a chat as read
export const markChatAsRead = async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user._id;

        const messages = await Message.find({
            chat: chatId,
            sender: { $ne: userId },
            status: { $in: ['sent', 'delivered'] }
        }).populate('sender');

        if (messages.length === 0) {
            return res.json({ success: true, message: 'No unread messages' });
        }

        const now = new Date();
        const messageIds = [];

        for (const message of messages) {
            message.status = 'read';
            message.readAt = now;
            message.read   = true;
            
            if (!message.deliveredAt) {
                message.deliveredAt = now;
            }
            
            await message.save();
            messageIds.push(message._id);

            sendToUser(message.sender._id.toString(), {
                type:      'message_read',
                messageId: message._id,
                readAt:    now
            });
        }

        res.json({ success: true, count: messages.length, messageIds });
    } catch (error) {
        console.error('Error marking chat as read:', error);
        res.status(500).json({ success: false, message: 'Failed to mark chat as read' });
    }
};

// Get messages for a chat
export const getMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const messages = await Message.find({ chat: chatId })
            .populate('sender', 'name username profilePicture')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Message.countDocuments({ chat: chatId });

        res.json({
            success: true,
            messages: messages.reverse(),
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ success: false, message: 'Failed to get messages' });
    }
};

// Delete a message
export const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'You can only delete your own messages' });
        }

        await message.deleteOne();

        res.json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ success: false, message: 'Failed to delete message' });
    }
};