// ------------------ Friends Management - FIXED VERSION ------------------
let pendingRequests = [];
let friends = [];
let friendsInitialized = false;
let friendsLoading = false;
let lastSearchResults = []; // Module-scoped instead of window global

// ------------------ Initialize friends functionality ------------------
async function initFriends() {
    if (friendsInitialized) return;
    friendsInitialized = true;

    try {
        await Promise.all([
            loadPendingRequests(),
            loadFriends()
        ]);
        setupFriendsEventListeners();
    } catch (error) {
        console.error('Error initializing friends:', error);
        showToast('Failed to load friends data', 'error');
    }
}

// ------------------ Setup event listeners ------------------
function setupFriendsEventListeners() {
    const friendRequestsBtn = document.getElementById('friendRequestsBtn');
    if (friendRequestsBtn && !friendRequestsBtn.dataset.bound) {
        friendRequestsBtn.dataset.bound = '1';
        friendRequestsBtn.addEventListener('click', showFriendRequestsModal);
    }

    const addFriendBtn = document.getElementById('addFriendBtn');
    if (addFriendBtn && !addFriendBtn.dataset.bound) {
        addFriendBtn.dataset.bound = '1';
        addFriendBtn.addEventListener('click', showAddFriendModal);
    }

    document.querySelectorAll('.modal-close').forEach(btn => {
        if (!btn.dataset.bound) {
            btn.dataset.bound = '1';
            btn.addEventListener('click', closeModals);
        }
    });

    document.querySelectorAll('.modal').forEach(modal => {
        if (!modal.dataset.bound) {
            modal.dataset.bound = '1';
            modal.addEventListener('click', e => {
                if (e.target === modal) closeModals();
            });
        }
    });

    const friendSearchInput = document.getElementById('friendSearchInput');
    if (friendSearchInput && !friendSearchInput.dataset.bound) {
        friendSearchInput.dataset.bound = '1';
        friendSearchInput.addEventListener('input', debounce(searchUsersForFriend, 500));
    }
}

// ------------------ Load pending friend requests ------------------
async function loadPendingRequests() {
    try {
        const data = await apiRequest(ENDPOINTS.FRIEND_INCOMING);
        
        // FIXED: Handle multiple response formats
        if (Array.isArray(data)) {
            pendingRequests = data;
        } else if (data && Array.isArray(data.requests)) {
            pendingRequests = data.requests;
        } else if (data && Array.isArray(data.friendRequests)) {
            pendingRequests = data.friendRequests;
        } else {
            pendingRequests = [];
        }
        
        // FIXED: Filter out null/undefined requests
        pendingRequests = pendingRequests.filter(req => req !== null && req !== undefined && req.from);
        
        updateRequestsBadge();
    } catch (error) {
        console.error('Error loading friend requests:', error);
        pendingRequests = [];
        // FIXED: Provide user feedback
        if (error.message !== 'Network request failed') {
            showToast('Could not load friend requests', 'error');
        }
    }
}

// ------------------ Update badge ------------------
function updateRequestsBadge() {
    const badge = document.getElementById('requestsBadge');
    if (!badge) return;

    if (pendingRequests.length > 0) {
        badge.textContent = pendingRequests.length;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

// ------------------ Show friend requests modal ------------------
function showFriendRequestsModal() {
    const modal = document.getElementById('friendRequestsModal');
    const list = document.getElementById('friendRequestsList');
    if (!modal || !list) return;

    if (pendingRequests.length === 0) {
        list.innerHTML = createEmptyState('👥', 'No friend requests', 'You have no pending friend requests');
    } else {
        list.innerHTML = pendingRequests.map(createRequestItem).join('');

        // FIXED: Add null checks before adding listeners
        list.querySelectorAll('.accept-btn').forEach(btn => {
            if (btn.dataset.id) {
                btn.addEventListener('click', () => handleRequestResponse(btn.dataset.id, 'accept'));
            }
        });

        list.querySelectorAll('.reject-btn').forEach(btn => {
            if (btn.dataset.id) {
                btn.addEventListener('click', () => handleRequestResponse(btn.dataset.id, 'reject'));
            }
        });
    }

    modal.classList.add('active');
}

// ------------------ Show add friend modal ------------------
function showAddFriendModal() {
    const modal = document.getElementById('addFriendModal');
    const input = document.getElementById('friendSearchInput');
    const results = document.getElementById('friendSearchResults');

    if (!modal) return;
    if (input) input.value = '';
    if (results) results.innerHTML = '';

    modal.classList.add('active');
}

// ------------------ Close modals ------------------
function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// ------------------ Friend request item ------------------
function createRequestItem(request) {
    // FIXED: Comprehensive null checks
    if (!request || !request.from) {
        console.warn('Invalid request object:', request);
        return '';
    }
    
    const u = request.from;
    const userName = u.name || u.username || 'Unknown User';
    const userUsername = u.username || 'unknown';
    const requestId = request._id || '';
    
    if (!requestId) {
        console.warn('Request missing _id:', request);
        return '';
    }
    
    return `
        <div class="request-item">
            ${createAvatar(userName, 'small').outerHTML}
            <div class="request-info">
                <h4>${escapeHtml(userName)}</h4>
                <p>@${escapeHtml(userUsername)}</p>
            </div>
            <div class="request-actions">
                <button class="accept-btn" data-id="${requestId}">Accept</button>
                <button class="reject-btn" data-id="${requestId}">Reject</button>
            </div>
        </div>
    `;
}

// ------------------ Respond to request ------------------
async function handleRequestResponse(requestId, action) {
    if (!requestId) {
        console.error('No request ID provided');
        return;
    }
    
    try {
        // FIXED: Backend might expect 'accepted'/'rejected' or 'accept'/'reject'
        const actionValue = action === 'accept' ? 'accepted' : 'rejected';
        
        const response = await apiRequest(ENDPOINTS.FRIEND_RESPOND, {
            method: 'POST',
            body: JSON.stringify({ 
                requestId, 
                action: actionValue 
            })
        });

        // Remove from pending requests
        pendingRequests = pendingRequests.filter(r => r._id !== requestId);
        updateRequestsBadge();
        showFriendRequestsModal(); // Refresh modal

        showToast(`Friend request ${action}ed`, 'success');

        // If accepted, refresh friends list and chats
        if (action === 'accept') {
            await Promise.all([
                loadFriends(true),
                loadChats()
            ]);
        }
    } catch (err) {
        console.error('Error responding to friend request:', err);
        showToast(`Failed to ${action} request`, 'error');
    }
}

// ------------------ Search users ------------------
async function searchUsersForFriend() {
    const input = document.getElementById('friendSearchInput');
    const results = document.getElementById('friendSearchResults');
    if (!input || !results) return;

    const query = input.value.trim();
    
    if (query.length < 2) {
        results.innerHTML = '';
        return;
    }

    try {
        results.innerHTML = '<div class="loading-messages">Searching...</div>';

        const data = await apiRequest(`${ENDPOINTS.USERS_SEARCH}?query=${encodeURIComponent(query)}`);
        
        // FIXED: Handle multiple response formats
        let users = [];
        if (Array.isArray(data)) {
            users = data;
        } else if (data && Array.isArray(data.users)) {
            users = data.users;
        } else if (data && Array.isArray(data.data)) {
            users = data.data;
        }

        const currentUser = getUser();
        // FIXED: More robust filtering
        const filtered = users.filter(u => 
            u && 
            u._id && 
            u._id !== currentUser._id &&
            (u.name || u.username) // Must have at least one identifier
        );

        if (filtered.length === 0) {
            results.innerHTML = createEmptyState('🔍', 'No users found', 'Try different keywords');
        } else {
            results.innerHTML = filtered.map(createUserSearchItem).join('');

            results.querySelectorAll('.add-friend-btn').forEach(btn => {
                if (btn.dataset.id) {
                    btn.addEventListener('click', () => sendFriendRequest(btn.dataset.id, btn));
                }
            });
        }

        // FIXED: Store in module scope, not window
        lastSearchResults = users;

    } catch (err) {
        console.error('Error searching users:', err);
        results.innerHTML = createEmptyState('❌', 'Search failed', 'Try again');
    }
}

// ------------------ User search item ------------------
function createUserSearchItem(user) {
    // FIXED: Null checks and fallbacks
    if (!user || !user._id) {
        console.warn('Invalid user object:', user);
        return '';
    }
    
    const displayName = user.name || user.username || 'Unknown User';
    const userName = user.username || 'unknown';
    
    return `
        <div class="chat-item">
            ${createAvatar(displayName, 'small').outerHTML}
            <div class="chat-info">
                <h4>${escapeHtml(displayName)}</h4>
                <p>@${escapeHtml(userName)}</p>
            </div>
            <button class="btn-secondary add-friend-btn" data-id="${user._id}">Add Friend</button>
        </div>
    `;
}

// ------------------ Send request ------------------
async function sendFriendRequest(userId, btn) {
    if (!userId) {
        console.error('No user ID provided');
        return;
    }
    
    try {
        btn.disabled = true;
        btn.textContent = 'Sending...';

        // FIXED: Use module-scoped variable
        const user = lastSearchResults.find(u => u && u._id === userId);

        if (!user) {
            throw new Error('User not found in search results');
        }

        // FIXED: Validate username exists
        const username = user.username || user.name;
        if (!username) {
            throw new Error('User has no username');
        }

        await apiRequest(ENDPOINTS.FRIEND_SEND, {
            method: 'POST',
            body: JSON.stringify({ username })
        });

        btn.textContent = 'Sent ✓';
        btn.classList.add('success');
        showToast('Friend request sent', 'success');

    } catch (err) {
        console.error('Error sending friend request:', err);
        btn.disabled = false;
        btn.textContent = 'Add Friend';
        
        // FIXED: More specific error messages
        if (err.message.includes('already sent')) {
            showToast('Request already sent', 'info');
        } else if (err.message.includes('already friends')) {
            showToast('Already friends with this user', 'info');
        } else {
            showToast('Failed to send request', 'error');
        }
    }
}

// ------------------ Load friends ------------------
async function loadFriends(force = false) {
    if (friendsLoading && !force) return;
    
    friendsLoading = true;

    try {
        const data = await apiRequest(ENDPOINTS.FRIENDS);
        
        // FIXED: Handle multiple response formats
        if (Array.isArray(data)) {
            friends = data;
        } else if (data && Array.isArray(data.friends)) {
            friends = data.friends;
        } else if (data && Array.isArray(data.data)) {
            friends = data.data;
        } else {
            friends = [];
        }
        
        // FIXED: Filter out invalid friends
        friends = friends.filter(f => 
            f && 
            f._id && 
            (f.name || f.username)
        );
        
    } catch (err) {
        console.error('Error loading friends:', err);
        friends = [];
        // FIXED: Provide user feedback
        if (err.message !== 'Network request failed') {
            showToast('Could not load friends', 'error');
        }
    } finally {
        // FIXED: Always reset loading flag
        friendsLoading = false;
        renderFriendsList();
    }
}

// ------------------ Render friends ------------------
function renderFriendsList() {
    const list = document.getElementById('friendsList');
    if (!list) return;

    if (friends.length === 0) {
        list.innerHTML = createEmptyState('👥', 'No friends yet', 'Send requests to connect');
        return;
    }

    list.innerHTML = friends.map(createFriendItem).join('');

    list.querySelectorAll('.friend-item').forEach(item => {
        const userId = item.dataset.userId;
        if (userId) {
            item.addEventListener('click', () => startDirectChat(userId));
        }
    });
}

// ------------------ Friend item ------------------
function createFriendItem(friend) {
    // FIXED: Comprehensive null checks
    if (!friend || !friend._id) {
        console.warn('Invalid friend object:', friend);
        return '';
    }
    
    const displayName = friend.name || friend.username || 'Unknown User';
    const isOnline = checkUserOnline(friend._id);
    
    return `
        <div class="friend-item" data-user-id="${friend._id}">
            ${createAvatar(displayName, 'small').outerHTML}
            <div class="friend-info">
                <h4>${escapeHtml(displayName)}</h4>
                <span class="status ${isOnline ? 'online' : ''}">
                    ${isOnline ? 'Online' : 'Offline'}
                </span>
            </div>
        </div>
    `;
}

// ------------------ Expose functions to global scope ------------------
if (typeof window !== 'undefined') {
    window.initFriends = initFriends;
    window.loadFriends = loadFriends;
    window.loadPendingRequests = loadPendingRequests;
}