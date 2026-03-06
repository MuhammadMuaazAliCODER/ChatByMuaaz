import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { sendPushNotification } from '../services/push.service.js';
import User from '../models/User.js';

// Map of userId (string) -> WebSocket connection
let clients = new Map();

// Set of userIds that currently have an active WebSocket connection.
// This is the ONLY source of truth for online status.
let onlineUsers = new Set();

export const initSocket = (server) => {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        const url   = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        if (!token) {
            console.log('[WS] No token provided — closing connection');
            ws.close();
            return;
        }

        jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
            if (err) {
                console.log('[WS] Invalid token — closing connection');
                ws.close();
                return;
            }

            const userId = String(user._id);
            console.log(`[WS] User ${userId} connected`);

            // Terminate any stale connection for this user
            if (clients.has(userId)) {
                const oldWs = clients.get(userId);
                oldWs.terminate();
                console.log(`[WS] Terminated stale connection for user ${userId}`);
            }

            clients.set(userId, ws);
            onlineUsers.add(userId);

            // ── (Optional) Persist online status to DB ──────────────────
            try {
                await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
            } catch (dbErr) {
                console.error('[WS] Failed to set online in DB:', dbErr);
            }

            // 1. Tell the newly connected user who is currently online
            ws.send(JSON.stringify({
                type: 'online_users',
                users: Array.from(onlineUsers),
            }));

            // 2. Tell everyone else this user just came online
            broadcast({ type: 'user_online', userId }, [userId]);

            // ── Handle messages sent by this client ──────────────────────
            ws.on('message', (raw) => {
                try {
                    const data = JSON.parse(raw);
                    handleClientMessage(userId, data);
                } catch (error) {
                    console.error('[WS] Error parsing client message:', error);
                }
            });

            // ── Handle clean disconnection ───────────────────────────────
            ws.on('close', async () => {
                console.log(`[WS] User ${userId} disconnected`);
                _removeUser(userId);

                try {
                    await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() });
                } catch (dbErr) {
                    console.error('[WS] Failed to set offline in DB:', dbErr);
                }
            });

            // ── Handle socket errors ─────────────────────────────────────
            ws.on('error', (error) => {
                console.error(`[WS] Socket error for user ${userId}:`, error);
                _removeUser(userId);
            });
        });
    });

    console.log('[WS] WebSocket server initialized');
};

// ── Internal helper: remove user and broadcast offline ────────────────
function _removeUser(userId) {
    if (!onlineUsers.has(userId)) return;
    clients.delete(userId);
    onlineUsers.delete(userId);
    broadcast({ type: 'user_offline', userId });
}

// ── Handle messages from clients ─────────────────────────────────────
function handleClientMessage(userId, data) {
    switch (data.type) {

        case 'typing':
            broadcast({
                type: 'typing',
                chatId: data.chatId,
                userId,
                isTyping: data.isTyping,
            }, [userId]);
            break;

        case 'message_delivered':
            sendToUser(data.senderId, {
                type: 'message_delivered',
                messageId: data.messageId,
                deliveredAt: new Date().toISOString(),
            });
            break;

        case 'message_read':
            sendToUser(data.senderId, {
                type: 'message_read',
                messageId: data.messageId,
                readAt: new Date().toISOString(),
            });
            break;

        case 'messages_read':
            sendToUser(data.senderId, {
                type: 'messages_read',
                messageIds: data.messageIds,
                chatId: data.chatId,
                readAt: new Date().toISOString(),
            });
            break;

        default:
            console.log('[WS] Unknown message type from client:', data.type);
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

// ── Send a message to a specific user ────────────────────────────────
export const sendToUser = (userId, data) => {
    const ws = clients.get(String(userId));
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(data));
        return true;
    }
    return false;
};

/**
 * Send a new message notification to all recipients of a chat.
 *
 * @param {string[]} recipientIds   - All user IDs that should receive the notification (excludes sender)
 * @param {object}   messageData    - The full message object (populated sender, content, type, chatId, etc.)
 * @param {number}   [unreadCount]  - The recipient's current unread count for this chat (optional)
 */
export const sendMessageNotification = async (recipientIds, messageData, unreadCount = 1) => {
    // Guard: accept both a single userId string and an array of userIds.
    // Without this, iterating a plain string loops over each character ("6","8","a"…)
    // which causes Mongoose CastErrors when those single chars hit the DB.
    const ids = Array.isArray(recipientIds) ? recipientIds : [recipientIds];

    const senderName   = messageData.sender?.name || messageData.sender?.username || 'Someone';
    const senderAvatar = messageData.sender?.profilePicture || '';
    const preview      = messageData.type === 'audio' ? '🎤 Voice message' : (messageData.content || '');

    for (const recipientId of ids) {
        const id       = String(recipientId);
        const isOnline = onlineUsers.has(id);

        if (isOnline) {
            // ── User is online → deliver via WebSocket ─────────────────
            sendToUser(id, {
                type: 'new_message',
                message: {
                    ...messageData,
                    // Ensure sender is always an object with enough info for the notification banner
                    sender: {
                        _id:            messageData.sender?._id || messageData.sender,
                        name:           senderName,
                        username:       messageData.sender?.username || '',
                        profilePicture: senderAvatar,
                    },
                },
                unreadCount, // frontend uses this to update badge
                playSound: true,
            });
        } else {
            // ── User is offline → send push notification ───────────────
            try {
                await sendPushNotification(id, {
                    title: senderName,
                    body:  preview,
                    icon:  senderAvatar || '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    tag:   `chat-${messageData.chatId}`,   // Replaces previous notif for same chat
                    renotify: false,
                    data: {
                        chatId:    messageData.chatId,
                        messageId: messageData._id,
                        url:       `/chat/${messageData.chatId}`,
                    },
                });
            } catch (error) {
                console.error(`[WS] Failed to send push notification to ${id}:`, error);
            }
        }
    }
};

// ── Online status helpers ─────────────────────────────────────────────
export const isUserOnline         = (userId)   => onlineUsers.has(String(userId));
export const getOnlineUsers       = ()         => Array.from(onlineUsers);
export const getOnlineUserCount   = ()         => onlineUsers.size;
export const getUsersOnlineStatus = (userIds)  =>
    userIds.map(id => ({ userId: id, isOnline: onlineUsers.has(String(id)) }));