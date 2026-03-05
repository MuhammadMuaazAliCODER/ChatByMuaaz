import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { sendPushNotification } from '../services/push.service.js';

let clients = new Map(); // Map of userId -> ws connection
let onlineUsers = new Set(); // Set of online user IDs

export const initSocket = (server) => {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        if (!token) {
            console.log('No token provided, closing connection');
            ws.close();
            return;
        }

        jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
            if (err) {
                console.log('Invalid token, closing connection');
                ws.close();
                return;
            }

            const userId = user._id;
            console.log(`User ${userId} connected`);

            // If user already has a connection open, close the old one cleanly
            if (clients.has(userId)) {
                const oldWs = clients.get(userId);
                oldWs.terminate();
            }

            // Store the connection
            clients.set(userId, ws);
            onlineUsers.add(userId);

            // ── Mark user as online in DB ──────────────────────────
            try {
                // Import your User model at the top of your file if not already done
                // import User from '../models/user.model.js';
                // Uncomment the lines below once you import your User model:
                // await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
            } catch (dbErr) {
                console.error('Failed to update online status in DB:', dbErr);
            }

            // Send current online users list to the newly connected user
            ws.send(JSON.stringify({
                type: 'online_users',
                users: Array.from(onlineUsers)
            }));

            // Broadcast to everyone that this user is now online
            broadcast({
                type: 'user_online',
                userId: userId
            });

            // ── Handle incoming messages from this client ──────────
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    handleClientMessage(userId, data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

            // ── Handle disconnection ───────────────────────────────
            ws.on('close', async () => {
                console.log(`User ${userId} disconnected`);
                clients.delete(userId);
                onlineUsers.delete(userId);

                // ── Mark user as offline in DB ─────────────────────
                try {
                    // Uncomment once you import your User model:
                    // await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() });
                } catch (dbErr) {
                    console.error('Failed to update offline status in DB:', dbErr);
                }

                // Broadcast to everyone that this user is now offline
                broadcast({
                    type: 'user_offline',
                    userId: userId
                });
            });

            // ── Handle errors ──────────────────────────────────────
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                // Clean up on error too
                clients.delete(userId);
                onlineUsers.delete(userId);
                broadcast({ type: 'user_offline', userId });
            });
        });
    });

    console.log('WebSocket server initialized');
};

// ── Handle messages from clients ──────────────────────────────
function handleClientMessage(userId, data) {
    switch (data.type) {

        case 'typing':
            // Broadcast typing indicator to other users in the chat
            broadcast({
                type: 'typing',
                chatId: data.chatId,
                userId: userId,
                isTyping: data.isTyping
            }, [userId]); // Exclude the sender
            break;

        case 'message_delivered':
            // Notify sender that message was delivered
            sendToUser(data.senderId, {
                type: 'message_delivered',
                messageId: data.messageId,
                deliveredAt: new Date().toISOString()
            });
            break;

        case 'message_read':
            // Notify sender that message was read
            sendToUser(data.senderId, {
                type: 'message_read',
                messageId: data.messageId,
                readAt: new Date().toISOString()
            });
            break;

        case 'messages_read':
            // Bulk read status for when user opens a chat
            sendToUser(data.senderId, {
                type: 'messages_read',
                messageIds: data.messageIds,
                chatId: data.chatId,
                readAt: new Date().toISOString()
            });
            break;

        default:
            console.log('Unknown message type:', data.type);
    }
}

// ── Broadcast to all connected clients (with optional exclusion list) ──
export const broadcast = (data, excludeUsers = []) => {
    const msg = JSON.stringify(data);
    clients.forEach((ws, userId) => {
        if (!excludeUsers.includes(userId) && ws.readyState === 1) {
            ws.send(msg);
        }
    });
};

// ── Send message to a specific user ───────────────────────────
export const sendToUser = (userId, data) => {
    const ws = clients.get(userId);
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(data));
        return true;
    }
    return false;
};

// ── Send new message notification (push if offline) ───────────
export const sendMessageNotification = async (recipientId, messageData) => {
    const isOnline = isUserOnline(recipientId);

    if (isOnline) {
        // User is online — send via WebSocket
        sendToUser(recipientId, {
            type: 'new_message',
            message: messageData,
            playSound: true
        });
    } else {
        // User is offline — send push notification
        try {
            await sendPushNotification(recipientId, {
                title: messageData.senderName || 'New Message',
                body: messageData.type === 'voice'
                    ? '🎤 Voice message'
                    : messageData.content,
                icon: messageData.senderAvatar || '/default-avatar.png',
                badge: '/badge-icon.png',
                data: {
                    chatId: messageData.chatId,
                    messageId: messageData._id,
                    url: `/chat/${messageData.chatId}`
                }
            });
        } catch (error) {
            console.error('Failed to send push notification:', error);
        }
    }
};

// ── Online status helpers ──────────────────────────────────────
export const isUserOnline = (userId) => onlineUsers.has(userId);

export const getOnlineUsers = () => Array.from(onlineUsers);

export const getUsersOnlineStatus = (userIds) =>
    userIds.map(id => ({ userId: id, isOnline: onlineUsers.has(id) }));

export const getOnlineUserCount = () => onlineUsers.size;