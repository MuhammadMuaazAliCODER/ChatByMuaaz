// API Configuration
const API_URL = 'http://localhost:5500/api';
const WS_URL = 'ws://localhost:5500';

// Local Storage Keys
const TOKEN_KEY = 'chatapp_token';
const USER_KEY = 'chatapp_user';
const THEME_KEY = 'chatapp_theme';

// API Endpoints
const ENDPOINTS = {
    // Auth
    REGISTER: `${API_URL}/auth/register`,
    LOGIN: `${API_URL}/auth/login`,
    VERIFY: `${API_URL}/auth/verify`,
    
    // Users
    USERS_SEARCH: `${API_URL}/users/search`,
    USER_VERIFY: `${API_URL}/users/verify`,
    
    // Chats
    CHATS: `${API_URL}/chats`,
    CHAT_DIRECT: `${API_URL}/chats/direct`,
    CHAT_GROUP: `${API_URL}/chats/group`,
    
    // Messages
    MESSAGES: `${API_URL}/messages`,
    MESSAGES_VOICE: `${API_URL}/messages/voice`,
    
    // Friends
    FRIEND_SEND: `${API_URL}/friend/send`,         // send friend request
    FRIEND_INCOMING: `${API_URL}/friend/incoming`, // get pending requests
    FRIEND_RESPOND: `${API_URL}/friend/respond`,   // accept/reject request
    FRIENDS: `${API_URL}/friends/friends`                 // <-- new: get all accepted friends
};


// Utility Functions
function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
}

function getUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
}

function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function removeUser() {
    localStorage.removeItem(USER_KEY);
}

function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
}

function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
}

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => {
    const theme = getTheme();
    document.documentElement.setAttribute('data-theme', theme);
});

// API Helper Functions
async function apiRequest(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    

    
    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          
            throw new Error(data.error || data.message || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

async function apiUpload(url, formData) {
    const token = getToken();
    const headers = {};
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Upload Error:', error);
        throw error;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_URL,
        WS_URL,
        ENDPOINTS,
        getToken,
        setToken,
        removeToken,
        getUser,
        setUser,
        removeUser,
        getTheme,
        setTheme,
        apiRequest,
        apiUpload,
    };
}