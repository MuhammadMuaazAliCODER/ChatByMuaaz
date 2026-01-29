
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectTimeout = null;
let onlineUsers = new Set(); 

const wsCallbacks = {
    onMessage: null,
    onUserStatus: null,
    onTyping: null,
};


function initWebSocket() {
    const token = getToken();
    
    if (!token) {
        console.error('No token found for WebSocket connection');
        return;
    }

    
    if (ws) {
        ws.close();
    }

    try {
        console.log('Connecting to WebSocket:', WS_URL);
        ws = new WebSocket(`${WS_URL}?token=${token}`);

        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            reconnectAttempts = 0;
            
            
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            
            showToast('Connected to chat server', 'success');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 WebSocket message received:', data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            
            onlineUsers.clear();
            attemptReconnect();
        };

    } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        attemptReconnect();
    }
}


function handleWebSocketMessage(data) {
    console.log('Handling message type:', data.type);
    
    switch (data.type) {
        case 'new_message':
            console.log('New message received:', data.message);
            if (wsCallbacks.onMessage) {
                wsCallbacks.onMessage(data.message);
            }
            break;

        case 'user_online':
            console.log('User came online:', data.userId);
            onlineUsers.add(data.userId);
            if (wsCallbacks.onUserStatus) {
                wsCallbacks.onUserStatus(data.userId, true);
            }
            break;

        case 'user_offline':
            console.log('User went offline:', data.userId);
            onlineUsers.delete(data.userId);
            if (wsCallbacks.onUserStatus) {
                wsCallbacks.onUserStatus(data.userId, false);
            }
            break;

        case 'typing':
            if (wsCallbacks.onTyping) {
                wsCallbacks.onTyping(data.chatId, data.userId, data.isTyping);
            }
            break;

        case 'online_users':
            console.log('Received online users list:', data.users);
            onlineUsers = new Set(data.users || []);
            
            if (wsCallbacks.onUserStatus) {
                data.users.forEach(userId => {
                    wsCallbacks.onUserStatus(userId, true);
                });
            }
            break;

        default:
            console.log('Unknown message type:', data.type);
    }
}


function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnection attempts reached');
        showToast('Connection lost. Please refresh the page.', 'error');
        return;
    }

    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);

    console.log(`Attempting to reconnect in ${delay}ms... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    showToast(`Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, 'info');

    reconnectTimeout = setTimeout(() => {
        initWebSocket();
    }, delay);
}


function sendWebSocketMessage(type, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify({ type, ...data }));
            return true;
        } catch (error) {
            console.error('Error sending WebSocket message:', error);
            return false;
        }
    } else {
        console.warn('WebSocket is not connected. State:', ws?.readyState);
        return false;
    }
}


function sendTypingIndicator(chatId, isTyping) {
    sendWebSocketMessage('typing', { chatId, isTyping });
}


function registerWebSocketCallbacks(callbacks) {
    Object.assign(wsCallbacks, callbacks);
    console.log('WebSocket callbacks registered:', Object.keys(callbacks));
}


function closeWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
    }
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    onlineUsers.clear();
}


function checkUserOnline(userId) {
    const isOnline = onlineUsers.has(userId);
    console.log(`Checking if user ${userId} is online:`, isOnline);
    return isOnline;
}


function getOnlineUsers() {
    return Array.from(onlineUsers);
}


if (typeof window !== 'undefined') {
    window.initWebSocket = initWebSocket;
    window.sendWebSocketMessage = sendWebSocketMessage;
    window.sendTypingIndicator = sendTypingIndicator;
    window.registerWebSocketCallbacks = registerWebSocketCallbacks;
    window.closeWebSocket = closeWebSocket;
    window.checkUserOnline = checkUserOnline;
    window.getOnlineUsers = getOnlineUsers;
}