import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { sendPushNotification } from '../services/push.service.js';

// Map of userId (string) -> WebSocket connection
let clients = new Map();

// Set of userIds that currently have an active WebSocket connection.
// This is the ONLY source of truth for online status — never trust the DB field.
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

            // If this user already has an open connection, terminate the old one cleanly
            if (clients.has(userId)) {
                const oldWs = clients.get(userId);
                oldWs.terminate();
                console.log(`[WS] Terminated stale connection for user ${userId}`);
            }

            // Register the new connection
            clients.set(userId, ws);
            onlineUsers.add(userId);

            // ── (Optional) Persist online status to DB ──────────────────
            // Uncomment once you have your User model imported:
            // try {
            //     await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
            // } catch (dbErr) {
            //     console.error('[WS] Failed to set online in DB:', dbErr);
            // }

            // 1. Tell the newly connected user which users are currently online
            ws.send(JSON.stringify({
                type: 'online_users',
                users: Array.from(onlineUsers),
            }));

            // 2. Tell everyone else that this user just came online
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

                // ── (Optional) Persist offline status to DB ──────────────
                // try {
                //     await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() });
                // } catch (dbErr) {
                //     console.error('[WS] Failed to set offline in DB:', dbErr);
                // }
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
    // Guard: only broadcast if the stored connection matches the closing socket
    // (prevents a reconnect race where a new connection replaces the old one first)
    if (!onlineUsers.has(userId)) return;

    clients.delete(userId);
    onlineUsers.delete(userId);

    broadcast({ type: 'user_offline', userId });
}

// ── Handle messages from clients ─────────────────────────────────────
function handleClientMessage(userId, data) {
    switch (data.type) {

        case 'typing':
            // Forward typing indicator to everyone in that chat except the sender
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

// ── Send new message notification (push if offline) ──────────────────
export const sendMessageNotification = async (recipientId, messageData) => {
    const id       = String(recipientId);
    const isOnline = onlineUsers.has(id);

    if (isOnline) {
        sendToUser(id, {
            type: 'new_message',
            message: messageData,
            playSound: true,
        });
    } else {
        try {
            await sendPushNotification(id, {
                title: messageData.senderName || 'New Message',
                body:  messageData.type === 'voice' ? '🎤 Voice message' : messageData.content,
                icon:  messageData.senderAvatar || '/default-avatar.png',
                badge: '/badge-icon.png',
                data: {
                    chatId:    messageData.chatId,
                    messageId: messageData._id,
                    url:       `/chat/${messageData.chatId}`,
                },
            });
        } catch (error) {
            console.error('[WS] Failed to send push notification:', error);
        }
    }
};

// ── Online status helpers ─────────────────────────────────────────────
export const isUserOnline        = (userId)  => onlineUsers.has(String(userId));
export const getOnlineUsers      = ()        => Array.from(onlineUsers);
export const getOnlineUserCount  = ()        => onlineUsers.size;
export const getUsersOnlineStatus = (userIds) =>
    userIds.map(id => ({ userId: id, isOnline: onlineUsers.has(String(id)) }));