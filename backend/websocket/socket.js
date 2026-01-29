import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

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

        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                console.log('Invalid token, closing connection');
                ws.close();
                return;
            }

            const userId = user._id;
            console.log(`User ${userId} connected`);

            // Store the connection
            clients.set(userId, ws);
            onlineUsers.add(userId);

            // Send current online users to the newly connected user
            ws.send(JSON.stringify({
                type: 'online_users',
                users: Array.from(onlineUsers)
            }));

            // Broadcast to everyone that this user is now online
            broadcast({
                type: 'user_online',
                userId: userId
            });

            // Handle incoming messages from this client
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    handleClientMessage(userId, data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

            // Handle disconnection
            ws.on('close', () => {
                console.log(`User ${userId} disconnected`);
                clients.delete(userId);
                onlineUsers.delete(userId);

                // Broadcast to everyone that this user is now offline
                broadcast({
                    type: 'user_offline',
                    userId: userId
                });
            });

            // Handle errors
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });
    });

    console.log('WebSocket server initialized');
};

// Handle messages from clients (typing indicators, etc.)
function handleClientMessage(userId, data) {
    switch (data.type) {
        case 'typing':
            // Broadcast typing indicator to other users in the chat
            broadcast({
                type: 'typing',
                chatId: data.chatId,
                userId: userId,
                isTyping: data.isTyping
            });
            break;

        default:
            console.log('Unknown message type:', data.type);
    }
}

// Broadcast to all connected clients
export const broadcast = (data) => {
    const msg = JSON.stringify(data);
    clients.forEach((ws, userId) => {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(msg);
        }
    });
};

// Send message to specific user
export const sendToUser = (userId, data) => {
    const ws = clients.get(userId);
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(data));
        return true;
    }
    return false;
};

// Check if user is online
export const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
};

// Get all online users
export const getOnlineUsers = () => {
    return Array.from(onlineUsers);
};

// Get online status for multiple users
export const getUsersOnlineStatus = (userIds) => {
    return userIds.map(id => ({
        userId: id,
        isOnline: onlineUsers.has(id)
    }));
};