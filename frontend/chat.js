// Main Chat Application Logic - FULLY FIXED
let currentChat = null;
let chats = [];
let messages = {};
let mediaRecorder = null;
let audioChunks = [];
let typingTimeout = null;

// Emojis for picker
const emojis = ['😊', '😂', '❤️', '👍', '🎉', '😍', '🤔', '😭', '🔥', '✨', 
                '👏', '💯', '😎', '🙏', '💪', '🎈', '🌟', '💕', '😜', '🤗',
                '😴', '🤩', '😇', '🥳', '😱', '🤯', '😋', '🥰', '🤪', '😅'];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = getToken();
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Verify token
    try {
        await apiRequest(ENDPOINTS.VERIFY);
    } catch (error) {
        removeToken();
        removeUser();
        window.location.href = 'index.html';
        return;
    }

    // Initialize app
    initializeApp();
});

// Initialize application
async function initializeApp() {
    // Set current user info
    const currentUser = getUser();
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserAvatar').outerHTML = createAvatar(currentUser.name).outerHTML;

    // Initialize theme
    initTheme();

    // Setup event listeners
    setupEventListeners();

    // Initialize WebSocket
    initWebSocket();
    registerWebSocketCallbacks({
        onMessage: handleIncomingMessage,
        onUserStatus: handleUserStatusChange,
        onTyping: handleTypingIndicator
    });

    // Load initial data
    await loadChats();
    await initFriends();
    await loadPendingRequests();

    // Request notification permission
    requestNotificationPermission();

    // Initialize emoji picker
    initEmojiPicker();
}

// Initialize theme
function initTheme() {
    const theme = getTheme();
    const themeIcon = document.querySelector('.theme-icon');
    
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 500));
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim()) {
                document.getElementById('searchResults').style.display = 'block';
            }
        });
    }

    // Tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Typing indicator
        messageInput.addEventListener('input', () => {
            if (currentChat) {
                sendTypingIndicator(currentChat._id, true);
                
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    sendTypingIndicator(currentChat._id, false);
                }, 1000);
            }
        });
    }

    // Send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // Emoji button
    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiBtn) {
        emojiBtn.addEventListener('click', toggleEmojiPicker);
    }

    // Voice button
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', toggleVoiceRecording);
    }

    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        const emojiPicker = document.getElementById('emojiPicker');
        const emojiBtn = document.getElementById('emojiBtn');
        
        if (emojiPicker && emojiBtn && 
            !emojiPicker.contains(e.target) && 
            !emojiBtn.contains(e.target)) {
            emojiPicker.style.display = 'none';
        }
    });
}

// Toggle theme
function toggleTheme() {
    const currentTheme = getTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    setTheme(newTheme);
    
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
}

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        closeWebSocket();
        removeToken();
        removeUser();
        window.location.href = 'index.html';
    }
}

// Switch tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tabName === 'chats') {
        document.getElementById('chatsTab').classList.add('active');
    } else if (tabName === 'friends') {
        document.getElementById('friendsTab').classList.add('active');
    }
}

// Handle search
async function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const searchResultsList = document.getElementById('searchResultsList');
    
    if (!searchInput || !searchResults || !searchResultsList) return;
    
    const query = searchInput.value.trim();
    
    if (query.length < 2) {
        searchResults.style.display = 'none';
        return;
    }
    
    try {
        searchResults.style.display = 'block';
        searchResultsList.innerHTML = '<div class="loading-messages">Searching...</div>';
        
        const data = await apiRequest(`${ENDPOINTS.USERS_SEARCH}?query=${encodeURIComponent(query)}`);
        
        // API returns array directly or in data property
        const users = Array.isArray(data) ? data : (data.users || []);
        
        if (users.length === 0) {
            searchResultsList.innerHTML = createEmptyState('🔍', 'No users found', 'Try a different search term');
            return;
        }
        
        // Filter out current user
        const currentUser = getUser();
        const filteredUsers = users.filter(user => user._id !== currentUser._id);
        
        if (filteredUsers.length === 0) {
            searchResultsList.innerHTML = createEmptyState('🔍', 'No other users found', 'Try a different search term');
            return;
        }
        
        searchResultsList.innerHTML = filteredUsers.map(user => createSearchResultItem(user)).join('');
        
        // Add click listeners
        searchResultsList.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.userId;
                startDirectChat(userId);
                searchInput.value = '';
                searchResults.style.display = 'none';
            });
        });
        
    } catch (error) {
        console.error('Error searching users:', error);
        searchResultsList.innerHTML = createEmptyState('❌', 'Search failed', 'Please try again');
    }
}

// Create search result item
function createSearchResultItem(user) {
    const isOnline = checkUserOnline(user._id);
    
    return `
        <div class="chat-item" data-user-id="${user._id}">
            ${createAvatar(user.name, 'small').outerHTML}
            <div class="chat-info">
                <h4>${escapeHtml(user.name)} ${user.verified ? '<span class="verified"></span>' : ''}</h4>
                <span class="status ${isOnline ? 'online' : ''}">${isOnline ? 'Online' : 'Offline'}</span>
            </div>
        </div>
    `;
}

// Load chats
async function loadChats() {
    try {
        const data = await apiRequest(ENDPOINTS.CHATS);
        const rawChats = data.chats || [];
        chats = rawChats.filter(chat => chat !== null && chat !== undefined);
        
        console.log('Loaded chats:', chats);
        renderChatsList();
    } catch (error) {
        console.error('Error loading chats:', error);
        const chatsList = document.getElementById('chatsList');
        if (chatsList) {
            chatsList.innerHTML = createEmptyState('❌', 'Failed to load chats', 'Please refresh the page');
        }
    }
}

// Render chats list
function renderChatsList() {
    const chatsList = document.getElementById('chatsList');
    
    if (!chatsList) return;
    
    if (chats.length === 0) {
        chatsList.innerHTML = createEmptyState('💬', 'No chats yet', 'Search for users to start chatting');
        return;
    }
    
    chatsList.innerHTML = chats.map(chat => createChatItem(chat)).join('');
    
    // Add click listeners
    chatsList.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const chatId = item.dataset.chatId;
            console.log('Chat item clicked:', chatId);
            openChat(chatId);
        });
    });
}

// Create chat item HTML
function createChatItem(chat) {
    if (!chat) return '';

    const currentUser = getUser();
    let chatName, chatAvatar, isOnline = false;
    
    const isGroup = chat.isGroup === true || (chat.participants && chat.participants.length > 2);
    
    if (isGroup) {
        chatName = chat.name || 'Group Chat';
        chatAvatar = '👥';
    } else {
        const otherUser = chat.participants?.find(p => p._id !== currentUser._id);
        chatName = otherUser ? otherUser.name : 'Unknown User';
        chatAvatar = otherUser ? createAvatar(otherUser.name, 'small').outerHTML : '';
        isOnline = otherUser ? checkUserOnline(otherUser._id) : false;
    }
    
    const lastMessage = chat.lastMessage;
    const messagePreview = lastMessage ? formatMessagePreview({ content: lastMessage, type: 'text' }) : 'No messages yet';
    const messageTime = chat.lastMessageTime ? formatTime(chat.lastMessageTime) : '';
    const unreadCount = chat.unreadCount || 0;
    
    return `
        <div class="chat-item ${currentChat && currentChat._id === chat._id ? 'active' : ''}" 
             data-chat-id="${chat._id}">
            ${chatAvatar}
            <div class="chat-info">
                <h4>${escapeHtml(chatName)}</h4>
                <p>${escapeHtml(messagePreview)}</p>
            </div>
            <div class="chat-meta">
                ${messageTime ? `<span class="chat-time">${messageTime}</span>` : ''}
                ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
            </div>
        </div>
    `;
}

// Start or open direct chat
async function startDirectChat(userId) {
    try {
        console.log('Starting direct chat with user:', userId);
        
        const existingChat = chats.find(chat => {
            if (!chat || !Array.isArray(chat.participants)) return false;

            const isGroup = chat.type === 'group' || chat.isGroup === true;

            return !isGroup && chat.participants.some(p => {
                const participantId = typeof p === 'string' ? p : p?._id;
                return participantId === userId;
            });
        });

        if (existingChat) {
            console.log('Found existing chat:', existingChat._id);
            openChat(existingChat._id);
            return;
        }

        console.log('Creating new chat...');
        const chatData = await apiRequest(ENDPOINTS.CHAT_DIRECT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        console.log('New chat created:', chatData);

        if (chatData && Array.isArray(chatData.participants)) {
            const currentUser = getUser();
            
            chatData.participants = chatData.participants.map(participantId => {
                if (participantId === currentUser._id) {
                    return {
                        _id: currentUser._id,
                        name: currentUser.name
                    };
                } else {
                    return {
                        _id: participantId,
                        name: userId === participantId ? getNameFromSearch(userId) : 'User'
                    };
                }
            });
        }

        chats.unshift(chatData);
        renderChatsList();
        openChat(chatData._id);

    } catch (error) {
        console.error('Error starting direct chat:', error);
        showToast('Failed to start chat', 'error');
    }
}

// Helper function to get name from recent search results
function getNameFromSearch(userId) {
    const searchResultsList = document.getElementById('searchResultsList');
    if (searchResultsList) {
        const userItem = searchResultsList.querySelector(`[data-user-id="${userId}"]`);
        if (userItem) {
            const nameElement = userItem.querySelector('h4');
            if (nameElement) {
                return nameElement.textContent.replace('✓', '').trim();
            }
        }
    }
    
    // Also check friends list
    const friendsList = document.getElementById('friendsList');
    if (friendsList) {
        const friendItem = friendsList.querySelector(`[data-user-id="${userId}"]`);
        if (friendItem) {
            const nameElement = friendItem.querySelector('h4');
            if (nameElement) {
                return nameElement.textContent.trim();
            }
        }
    }
    
    return 'User';
}

// Open chat - COMPLETELY FIXED with safety checks
async function openChat(chatId) {
    console.log('=== Opening chat ===', chatId);
    
    const chat = chats.find(c => c && c._id === chatId);
    
    if (!chat) {
        console.error('Chat not found:', chatId);
        showToast('Chat not found', 'error');
        return;
    }
    
    console.log('Found chat:', chat);
    
    // CRITICAL: Clear messages div IMMEDIATELY
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv) {
        messagesDiv.innerHTML = '<div class="loading-messages"><div class="loading"></div><p>Loading messages...</p></div>';
    } else {
        console.error('messages div not found!');
    }

    // Set current chat
    currentChat = chat;
    
    // Show chat UI - with safety checks
    const welcomeScreen = document.querySelector('.welcome-screen');
    const activeChat = document.getElementById('activeChat');
    
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    } else {
        console.warn('welcome-screen not found');
    }
    
    if (activeChat) {
        activeChat.style.display = 'flex';
    } else {
        console.error('activeChat element not found!');
        return;
    }
    
    // Update active chat in list
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    const chatItem = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (chatItem) {
        console.log('Setting active chat item');
        chatItem.classList.add('active');
    }
    
    // Update header
    updateChatHeader(chat);
    
    // Load messages (this will always fetch fresh)
    console.log('Loading messages for chat:', chatId);
    await loadMessages(chatId);
    
    // Scroll to bottom
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        setTimeout(() => {
            console.log('Scrolling to bottom');
            scrollToBottom(messagesContainer, false);
        }, 100);
    } else {
        console.warn('messagesContainer not found');
    }
}

// Update chat header - FIXED for missing elements
function updateChatHeader(chat) {
    if (!chat) return; 

    const currentUser = getUser();
    let chatName, isOnline = false;
    
    const isGroup = chat.isGroup === true || (chat.participants && chat.participants.length > 2);
    
    if (isGroup) {
        chatName = chat.name || 'Group Chat';
    } else {
        const otherUser = chat.participants?.find(p => p._id !== currentUser._id);
        chatName = otherUser ? otherUser.name : 'Unknown User';
        isOnline = otherUser ? checkUserOnline(otherUser._id) : false;
    }
    
    // Update chat name
    const chatNameEl = document.getElementById('activeChatName');
    if (chatNameEl) {
        chatNameEl.textContent = chatName;
    }
    
    // Update avatar - check if element exists first
    const avatarEl = document.getElementById('activeChatAvatar');
    if (avatarEl) {
        if (isGroup) {
            avatarEl.outerHTML = '<div id="activeChatAvatar" class="avatar">👥</div>';
        } else {
            const newAvatar = createAvatar(chatName);
            newAvatar.id = 'activeChatAvatar';
            avatarEl.outerHTML = newAvatar.outerHTML;
        }
    } else {
        console.warn('activeChatAvatar element not found in HTML');
    }
    
    // Update status
    const statusElement = document.getElementById('activeChatStatus');
    if (statusElement) {
        statusElement.textContent = isOnline ? 'Online' : 'Offline';
        statusElement.className = `status ${isOnline ? 'online' : ''}`;
    } else {
        console.warn('activeChatStatus element not found in HTML');
    }
}

// Load messages for a chat - FULLY FIXED WITH DEBUG
async function loadMessages(chatId) {
    console.log('=== loadMessages called ===', chatId);
    console.log('Current chat:', currentChat);
    console.log('ENDPOINTS object:', ENDPOINTS);
    console.log('ENDPOINTS.MESSAGES:', ENDPOINTS?.MESSAGES);
    
    if (!chatId) {
        console.error('No chatId provided!');
        return;
    }
    
    if (!ENDPOINTS || !ENDPOINTS.MESSAGES) {
        console.error('ENDPOINTS.MESSAGES is not defined!');
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = createEmptyState('❌', 'Configuration Error', 'ENDPOINTS not defined');
        }
        return;
    }
    
    // Check if apiRequest function exists
    if (typeof apiRequest !== 'function') {
        console.error('apiRequest function is not defined!');
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = createEmptyState('❌', 'Configuration Error', 'apiRequest function not found');
        }
        return;
    }
    
    try {
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '<div class="loading-messages"><div class="loading"></div><p>Loading conversation...</p></div>';
            console.log('Loader displayed');
        }
        
        const endpoint = `${ENDPOINTS.MESSAGES}/${chatId}`;
        console.log('Full endpoint URL:', endpoint);
        console.log('About to call apiRequest...');
        
        const startTime = Date.now();
        const data = await apiRequest(endpoint);
        const endTime = Date.now();
        
        console.log(`API call completed in ${endTime - startTime}ms`);
        console.log('API Response received:', data);
        console.log('Response type:', typeof data);
        console.log('Messages in response:', data?.messages?.length || 0);
        
        if (!data) {
            console.error('API returned null/undefined');
            throw new Error('No data received from API');
        }
        
        // Store messages
        messages[chatId] = Array.isArray(data.messages) ? data.messages : [];
        console.log('Stored', messages[chatId].length, 'messages for chat', chatId);
        
        // Only render if we're still on the same chat
        if (currentChat && currentChat._id === chatId) {
            console.log('Still on same chat, rendering messages...');
            renderMessages(chatId);
        } else {
            console.log('Chat changed during load. Current chat:', currentChat?._id, 'Loaded chat:', chatId);
        }
    } catch (error) {
        console.error('=== ERROR in loadMessages ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error object:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = createEmptyState(
                '❌', 
                'Failed to load messages', 
                `Error: ${error.message || 'Unknown error'}`
            );
        }
    }
}

// Render messages
function renderMessages(chatId) {
    console.log('=== renderMessages called ===', chatId);
    
    const messagesDiv = document.getElementById('messages');
    if (!messagesDiv) {
        console.error('Messages div not found');
        return;
    }
    
    const chatMessages = messages[chatId] || [];
    console.log('Rendering', chatMessages.length, 'messages');
    
    const currentUser = getUser();
    
    if (chatMessages.length === 0) {
        messagesDiv.innerHTML = createEmptyState('💬', 'No messages yet', 'Start the conversation!');
        return;
    }
    
    let lastDate = null;
    const messageHTML = chatMessages.map((message, index) => {
        let html = '';
        
        // Add date separator if date changed
        const messageDate = new Date(message.createdAt).toDateString();
        if (messageDate !== lastDate) {
            html += `
                <div class="date-separator">
                    <span>${getDateSeparator(message.createdAt)}</span>
                </div>
            `;
            lastDate = messageDate;
        }
        
        // Add message
        const isSent = message.sender._id === currentUser._id;
        html += createMessageHTML(message, isSent);
        
        return html;
    }).join('');
    
    messagesDiv.innerHTML = messageHTML;
    console.log('Messages rendered to DOM');
    
    // Add event listeners to voice messages
    messagesDiv.querySelectorAll('.voice-play-btn').forEach(btn => {
        btn.addEventListener('click', () => playVoiceMessage(btn));
    });
}

// Create message HTML
function createMessageHTML(message, isSent) {
    const time = formatTime(message.createdAt);
    
    if (message.type === 'voice') {
        return `
            <div class="message ${isSent ? 'sent' : 'received'}">
                ${!isSent ? createAvatar(message.sender.name, 'small').outerHTML : ''}
                <div class="message-content">
                    <div class="message-bubble">
                        <div class="voice-message">
                            <button class="voice-play-btn" data-url="${message.audioUrl}">
                                ▶️
                            </button>
                            <div class="voice-waveform">
                                ${Array(20).fill(0).map(() => 
                                    `<div class="voice-bar" style="height: ${Math.random() * 100}%"></div>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="message-time">${time}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="message ${isSent ? 'sent' : 'received'}">
            ${!isSent ? createAvatar(message.sender.name, 'small').outerHTML : ''}
            <div class="message-content">
                <div class="message-bubble">
                    <div class="message-text">${escapeHtml(message.content)}</div>
                    <div class="message-time">${time}</div>
                </div>
            </div>
        </div>
    `;
}

// Send message
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput || !currentChat) return;
    
    const text = messageInput.value.trim();
    
    if (!text) return;
    
    try {
        const data = await apiRequest(ENDPOINTS.MESSAGES, {
            method: 'POST',
            body: JSON.stringify({
                chatId: currentChat._id,
                content: text
            })
        });
        
        // Clear input
        messageInput.value = '';
        
        // Add message to local state
        if (!messages[currentChat._id]) {
            messages[currentChat._id] = [];
        }
        messages[currentChat._id].push(data.message);
        
        // Re-render messages
        renderMessages(currentChat._id);
        
        // Scroll to bottom
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            setTimeout(() => scrollToBottom(messagesContainer, true), 100);
        }
        
        // Update chat in list
        const chat = chats.find(c => c && c._id === currentChat._id);
        if (chat) {
            chat.lastMessage = data.message.content;
            chat.lastMessageTime = data.message.createdAt;
            renderChatsList();
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
    }
}

function handleIncomingMessage(message) {
    const currentUser = getUser();

    // Ignore own socket message (already added locally)
    if (message.sender._id === currentUser._id) return;

    const chatId = message.chat;

    if (!messages[chatId]) {
        messages[chatId] = [];
    }

    messages[chatId].push(message);

    const chat = chats.find(c => c && c._id === chatId);
    if (chat) {
        chat.lastMessage = message.content;
        chat.lastMessageTime = message.createdAt;

        if (!currentChat || currentChat._id !== chatId) {
            chat.unreadCount = (chat.unreadCount || 0) + 1;
        }

        renderChatsList();
    }

    if (currentChat && currentChat._id === chatId) {
        renderMessages(chatId);

        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            setTimeout(() => scrollToBottom(messagesContainer, true), 100);
        }
    } else {
        const sender = message.sender;
        showNotification(sender.name, formatMessagePreview(message));
        playNotificationSound();
    }
}

// Handle user status change
function handleUserStatusChange(userId, isOnline) {
    renderChatsList();
    
    if (currentChat) {
        const isGroup = currentChat.isGroup === true || (currentChat.participants && currentChat.participants.length > 2);
        if (!isGroup) {
            const otherUser = currentChat.participants?.find(p => p._id === userId);
            if (otherUser) {
                updateChatHeader(currentChat);
            }
        }
    }
    
    const friendsList = document.getElementById('friendsList');
    if (friendsList && friendsList.innerHTML) {
        updateFriendOnlineStatus(userId, isOnline);
    }
}

function updateFriendOnlineStatus(userId, isOnline) {
    const item = document.querySelector(`.friend-item[data-user-id="${userId}"]`);
    if (!item) return;

    const statusEl = item.querySelector('.status');
    if (!statusEl) return;

    statusEl.textContent = isOnline ? 'Online' : 'Offline';
    statusEl.className = `status ${isOnline ? 'online' : ''}`;
}

// Handle typing indicator
function handleTypingIndicator(chatId, userId, isTyping) {
    console.log(`User ${userId} is ${isTyping ? 'typing' : 'not typing'} in chat ${chatId}`);
}

// Initialize emoji picker
function initEmojiPicker() {
    const emojiGrid = document.querySelector('.emoji-grid');
    if (!emojiGrid) return;
    
    emojiGrid.innerHTML = emojis.map(emoji => 
        `<div class="emoji-item">${emoji}</div>`
    ).join('');
    
    // Add click listeners
    emojiGrid.querySelectorAll('.emoji-item').forEach(item => {
        item.addEventListener('click', () => {
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.value += item.textContent;
                messageInput.focus();
            }
        });
    });
}

// Toggle emoji picker
function toggleEmojiPicker(e) {
    e.stopPropagation();
    const emojiPicker = document.getElementById('emojiPicker');
    if (emojiPicker) {
        emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
    }
}

// Toggle voice recording
async function toggleVoiceRecording() {
    const voiceBtn = document.getElementById('voiceBtn');
    
    if (!voiceBtn) return;
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        voiceBtn.textContent = '🎤';
        voiceBtn.style.background = '';
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await sendVoiceMessage(audioBlob);
                
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            voiceBtn.textContent = '⏹️';
            voiceBtn.style.background = 'var(--danger)';
            
            showToast('Recording...', 'info');
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            showToast('Failed to access microphone', 'error');
        }
    }
}

// Send voice message
async function sendVoiceMessage(audioBlob) {
    if (!currentChat) return;
    
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice.webm');
        formData.append('chatId', currentChat._id);
        
        const data = await apiUpload(ENDPOINTS.MESSAGES_VOICE, formData);
        
        if (!messages[currentChat._id]) {
            messages[currentChat._id] = [];
        }
        messages[currentChat._id].push(data.message);
        
        renderMessages(currentChat._id);
        
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            setTimeout(() => scrollToBottom(messagesContainer, true), 100);
        }
        
        const chat = chats.find(c => c && c._id === currentChat._id);
        if (chat) {
            chat.lastMessage = '🎤 Voice message';
            chat.lastMessageTime = data.message.createdAt;
            renderChatsList();
        }
        
        showToast('Voice message sent!', 'success');
        
    } catch (error) {
        console.error('Error sending voice message:', error);
        showToast('Failed to send voice message', 'error');
    }
}

let currentAudio = null;
let currentButton = null;

function playVoiceMessage(button) {
    let url = button.dataset.url;
    if (url && !url.startsWith('http')) {
        const API_BASE = "http://localhost:5500/"; 
        url = API_BASE + (url.startsWith('/') ? url.slice(1) : url);
    }

    const container = button.closest('.voice-message');
    const bars = container.querySelectorAll('.voice-bar');
    
    if (currentAudio && currentButton === button) {
        if (!currentAudio.paused) {
            currentAudio.pause();
        } else {
            currentAudio.play().catch(e => console.error("Play failed:", e));
        }
        return;
    }

    if (currentAudio) {
        currentAudio.pause();
        if (currentButton) {
            currentButton.textContent = '▶️';
            currentButton.closest('.voice-message').querySelectorAll('.voice-bar')
                .forEach(b => b.style.backgroundColor = '#ccc');
        }
    }

    currentAudio = new Audio(url);
    currentButton = button;

    currentAudio.ontimeupdate = () => {
        if (!currentAudio.duration) return; 

        const progress = currentAudio.currentTime / currentAudio.duration;
        const barsToFill = Math.floor(progress * bars.length);

        bars.forEach((bar, index) => {
            if (index <= barsToFill) {
                bar.style.backgroundColor = '#fd5252ff';
                bar.style.opacity = '1';
            } else {
                bar.style.backgroundColor = '#ccc';
                bar.style.opacity = '0.5';
            }
        });
    };

    currentAudio.onplay = () => button.textContent = '⏸️';
    currentAudio.onpause = () => button.textContent = '▶️';
    
    currentAudio.onended = () => {
        button.textContent = '▶️';
        bars.forEach(b => b.style.backgroundColor = '#ccc');
        currentAudio = null;
    };

    currentAudio.play().catch(error => {
        console.error("Playback error:", error);
        showToast('Cannot play audio: ' + error.message, 'error');
    });
}