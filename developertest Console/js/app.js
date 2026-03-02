// ===== APP MODULE =====

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  STATE.loadPersisted();
  if (STATE.token) {
    showApp();
  }
  setupTabButtons();
});

function setupTabButtons() {
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      UI.switchAuthTab(btn.dataset.tab);
    });
  });
}

// ===== SHOW / HIDE SCREENS =====
function showApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  loadChats();
}

function showAuth() {
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
}

// ===== AUTH HANDLERS =====
async function doRegister() {
  const name     = document.getElementById('regName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  if (!name || !username || !email || !password) { UI.setAuthMsg('Fill all fields', 'error'); return; }

  UI.setAuthMsg('Registering...', '');
  const r = await API.register({ name, username, email, password });
  if (r.ok) {
    UI.setAuthMsg('Registered! Check email for OTP', 'success');
    STATE.pendingVerifyEmail = email;
    document.getElementById('verifyEmail').value = email;
    setTimeout(() => UI.switchAuthTab('verify'), 800);
  } else {
    UI.setAuthMsg(r.data?.message || 'Registration failed', 'error');
  }
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!username || !password) { UI.setAuthMsg('Fill all fields', 'error'); return; }

  UI.setAuthMsg('Signing in...', '');
  const r = await API.login({ username, password });

  if (r.ok) {
    if (r.data.token) {
      STATE.setToken(r.data.token);
      STATE.setUser(r.data.user);
      UI.setAuthMsg('Logged in!', 'success');
      setTimeout(showApp, 400);
    } else if (r.data.userId || r.data.user?._id) {
      // 2FA required
      STATE.pending2FAUserId = r.data.userId || r.data.user?._id;
      UI.switchAuthTab('2fa');
      UI.setAuthMsg('Enter OTP from your email', '');
    } else {
      UI.setAuthMsg(r.data?.message || 'Unexpected response', 'error');
    }
  } else {
    UI.setAuthMsg(r.data?.message || 'Login failed', 'error');
  }
}

async function do2FA() {
  const otp = document.getElementById('twoFaOtp').value.trim();
  if (!otp) { UI.setAuthMsg('Enter OTP', 'error'); return; }

  const r = await API.verify2FA({ userId: STATE.pending2FAUserId, otp });
  if (r.ok && r.data.token) {
    STATE.setToken(r.data.token);
    STATE.setUser(r.data.user);
    UI.setAuthMsg('Authenticated!', 'success');
    setTimeout(showApp, 400);
  } else {
    UI.setAuthMsg(r.data?.message || 'Invalid OTP', 'error');
  }
}

async function doVerifyEmail() {
  const email = document.getElementById('verifyEmail').value.trim();
  const otp   = document.getElementById('verifyOtp').value.trim();
  if (!email || !otp) { UI.setAuthMsg('Fill all fields', 'error'); return; }

  const r = await API.verifyEmail({ email, otp });
  if (r.ok) {
    UI.setAuthMsg('Email verified! You can now login', 'success');
    setTimeout(() => UI.switchAuthTab('login'), 1000);
  } else {
    UI.setAuthMsg(r.data?.message || 'Verification failed', 'error');
  }
}

async function doResendVerification() {
  const email = document.getElementById('verifyEmail').value.trim();
  if (!email) { UI.setAuthMsg('Enter email first', 'error'); return; }
  const r = await API.resendVerification({ email });
  UI.setAuthMsg(r.ok ? 'OTP sent!' : (r.data?.message || 'Failed'), r.ok ? 'success' : 'error');
}

async function doLogout() {
  await API.logout();
  STATE.clear();
  UI.toast('Logged out', 'info');
  showAuth();
}

async function doVerifyToken() {
  const r = await API.verifyToken();
  UI.openModal('Token Verification', UI.jsonView(r.data));
  if (r.ok && r.data.user) STATE.setUser(r.data.user);
}

async function doToggle2FA(enable) {
  const r = await API.toggle2FA({ enable });
  UI.toast(r.ok ? `2FA ${enable ? 'enabled' : 'disabled'}` : (r.data?.message || 'Failed'), r.ok ? 'success' : 'error');
}

// ===== SIDEBAR NAVIGATION =====
function switchPanel(panel) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === panel));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`panel-${panel}`);
  if (el) el.classList.add('active');
}

function toggleMenu() { /* placeholder for future menu */ }

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ===== SEARCH =====
let searchTimer = null;
async function doSearch() {
  clearTimeout(searchTimer);
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  searchTimer = setTimeout(async () => {
    switchPanel('users');
    const r = await API.searchUsers(q);
    if (r.ok) UI.renderUsers(r.data.users || r.data || []);
  }, 400);
}

// ===== CHATS =====
async function loadChats() {
  const r = await API.getChats();
  if (r.ok) {
    const chats = r.data.chats || r.data || [];
    UI.renderChats(chats);
  } else {
    UI.toast(r.data?.message || 'Failed to load chats', 'error');
  }
}

function openChat(chatId, chatName, chatType) {
  STATE.currentChatId = chatId;
  STATE.currentChatName = chatName;

  // Update active state
  document.querySelectorAll('.chat-item').forEach(el => el.classList.toggle('active', el.dataset.id === chatId));

  // Update header
  const typeLabel = chatType === 'group' ? 'Group Chat' : 'Direct Message';
  document.getElementById('chatAvatar').textContent = UI.avatarLetter(chatName);
  document.getElementById('chatAvatar').style.background = UI.avatarColor(chatName);
  document.getElementById('chatName').textContent = chatName;
  document.getElementById('chatSub').textContent = typeLabel;

  // Show chat pane
  document.getElementById('welcomePane').classList.add('hidden');
  const pane = document.getElementById('chatPane');
  pane.classList.remove('hidden');
  pane.classList.add('mobile-open');
  closeSidebar();

  loadMessages();
}

function closeChatPane() {
  document.getElementById('chatPane').classList.add('hidden');
  document.getElementById('welcomePane').classList.remove('hidden');
  toggleSidebar();
}

async function loadMessages() {
  if (!STATE.currentChatId) return;
  const r = await API.getMessages(STATE.currentChatId);
  if (r.ok) {
    const msgs = r.data.messages || r.data || [];
    UI.renderMessages(msgs);
  } else {
    UI.toast(r.data?.message || 'Failed to load messages', 'error');
  }
}

async function sendMessage() {
  const input = document.getElementById('msgInput');
  const content = input.value.trim();
  const type = document.getElementById('msgType').value;
  if (!content || !STATE.currentChatId) { UI.toast('Type a message first', 'error'); return; }

  const body = { chatId: STATE.currentChatId, content, type };
  if (type === 'audio') body.audioUrl = content; // treat content as url for audio

  const r = await API.sendMessage(body);
  if (r.ok) {
    input.value = '';
    loadMessages();
  } else {
    UI.toast(r.data?.message || 'Failed to send', 'error');
  }
}

async function doMarkAllRead() {
  if (!STATE.currentChatId) return;
  const r = await API.markAllRead(STATE.currentChatId);
  UI.toast(r.ok ? 'Marked all as read' : 'Failed', r.ok ? 'success' : 'error');
}

async function doMarkMsgRead(msgId) {
  const r = await API.markRead(msgId);
  UI.toast(r.ok ? 'Marked as read' : 'Failed', r.ok ? 'success' : 'error');
}

async function doDeleteMessage(msgId) {
  if (!confirm('Delete this message?')) return;
  const r = await API.deleteMessage(msgId);
  if (r.ok) { UI.toast('Message deleted', 'success'); loadMessages(); }
  else UI.toast(r.data?.message || 'Failed', 'error');
}

// ===== CREATE CHATS =====
async function createDirectChatWith(userId) {
  const r = await API.createDirectChat({ userId });
  if (r.ok) {
    UI.toast('Chat created!', 'success');
    await loadChats();
    const chatId = r.data._id || r.data.chat?._id;
    const name = r.data.name || 'Direct Chat';
    if (chatId) openChat(chatId, name, 'direct');
    switchPanel('chats');
  } else {
    UI.toast(r.data?.message || 'Failed', 'error');
  }
}

function showCreateGroup() {
  UI.openModal('Create Group Chat', `
    <div class="field-group">
      <label>Group Name</label>
      <input id="groupName" type="text" placeholder="Dev Team" />
    </div>
    <div class="field-group">
      <label>Participant User IDs (comma-separated)</label>
      <textarea id="groupParticipants" rows="3" placeholder="userId1, userId2"></textarea>
    </div>
  `, `<button class="btn-primary" style="width:auto" onclick="doCreateGroup()">Create Group</button>`);
}

async function doCreateGroup() {
  const name = document.getElementById('groupName').value.trim();
  const raw  = document.getElementById('groupParticipants').value.trim();
  const participants = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (!name) { UI.toast('Enter group name', 'error'); return; }

  const r = await API.createGroupChat({ name, participants });
  if (r.ok) {
    UI.toast('Group created!', 'success');
    UI.closeModal();
    loadChats();
  } else {
    UI.toast(r.data?.message || 'Failed', 'error');
  }
}

// ===== USERS =====
async function loadUsers() {
  const r = await API.getUsers();
  if (r.ok) UI.renderUsers(r.data.users || r.data || []);
  else UI.toast(r.data?.message || 'Failed', 'error');
}

// ===== FRIENDS =====
async function loadFriends() {
  const r = await API.getMyFriends();
  if (r.ok) UI.renderFriends(r.data.friends || r.data || []);
  else UI.toast(r.data?.message || 'Failed', 'error');
}

async function loadIncomingRequests() {
  const r = await API.getIncomingRequests();
  if (r.ok) UI.renderIncomingRequests(r.data.requests || r.data || []);
  else UI.toast(r.data?.message || 'Failed', 'error');
}

async function doSendFriendRequest() {
  const username = document.getElementById('friendUsername').value.trim();
  if (!username) { UI.toast('Enter username', 'error'); return; }
  const r = await API.sendFriendRequest({ username });
  UI.toast(r.ok ? 'Request sent!' : (r.data?.message || 'Failed'), r.ok ? 'success' : 'error');
  if (r.ok) document.getElementById('friendUsername').value = '';
}

async function respondRequest(requestId, action) {
  const r = await API.respondRequest({ requestId, action });
  UI.toast(r.ok ? `Request ${action}` : (r.data?.message || 'Failed'), r.ok ? 'success' : 'error');
  if (r.ok) loadIncomingRequests();
}

// ===== TOOLS =====
async function doGetVapidKey() {
  const r = await API.getVapidKey();
  UI.openModal('VAPID Public Key', UI.jsonView(r.data));
}

async function doGetSubscriptions() {
  const r = await API.getSubscriptions();
  UI.openModal('My Push Subscriptions', UI.jsonView(r.data));
}

async function doSendTestNotification() {
  const r = await API.testNotification();
  UI.toast(r.ok ? 'Test notification sent!' : (r.data?.message || 'Failed'), r.ok ? 'success' : 'error');
}

async function doGetPlans() {
  const r = await API.getPlans();
  UI.openModal('Subscription Plans', UI.jsonView(r.data));
}

async function doGetSubStatus() {
  const r = await API.getSubStatus();
  UI.openModal('My Subscription Status', UI.jsonView(r.data));
}

async function doCancelSubscription() {
  if (!confirm('Cancel your subscription?')) return;
  const r = await API.cancelSub();
  UI.toast(r.ok ? 'Subscription cancelled' : (r.data?.message || 'Failed'), r.ok ? 'success' : 'error');
}

async function doResumeSubscription() {
  const r = await API.resumeSub();
  UI.toast(r.ok ? 'Subscription resumed' : (r.data?.message || 'Failed'), r.ok ? 'success' : 'error');
}

async function doOpenPortal() {
  const r = await API.openPortal();
  if (r.ok && r.data.url) {
    window.open(r.data.url, '_blank');
  } else {
    UI.openModal('Billing Portal Response', UI.jsonView(r.data));
  }
}

async function doHealthCheck() {
  const r = await API.health();
  UI.openModal('Health Check', UI.jsonView(r.data));
  UI.toast(r.ok ? '✅ API is healthy!' : '❌ API unreachable', r.ok ? 'success' : 'error');
}

// ===== PASSWORD / USERNAME TOOLS =====
function showForgotPassword() {
  UI.openModal('Forgot Password', `
    <p class="info-text">An OTP will be sent to your email</p>
    <div class="field-group">
      <label>Email</label>
      <input id="fpEmail" type="email" placeholder="muaaz@example.com" />
    </div>
  `, `<button class="btn-primary" style="width:auto" onclick="doForgotPassword()">Send OTP</button>`);
}

async function doForgotPassword() {
  const email = document.getElementById('fpEmail').value.trim();
  if (!email) { UI.toast('Enter email', 'error'); return; }
  const r = await API.forgotPassword({ email });
  if (r.ok) {
    UI.toast('OTP sent to email', 'success');
    UI.openModal('Reset Password', `
      <div class="field-group"><label>Email</label><input id="rpEmail" value="${email}" type="email" /></div>
      <div class="field-group"><label>OTP</label><input id="rpOtp" type="text" placeholder="123456" /></div>
      <div class="field-group"><label>New Password</label><input id="rpPass" type="password" placeholder="newpassword123" /></div>
    `, `<button class="btn-primary" style="width:auto" onclick="doResetPassword()">Reset Password</button>`);
  } else {
    UI.toast(r.data?.message || 'Failed', 'error');
  }
}

async function doResetPassword() {
  const email = document.getElementById('rpEmail').value.trim();
  const otp   = document.getElementById('rpOtp').value.trim();
  const newPassword = document.getElementById('rpPass').value;
  const r = await API.resetPassword({ email, otp, newPassword });
  UI.toast(r.ok ? 'Password reset!' : (r.data?.message || 'Failed'), r.ok ? 'success' : 'error');
  if (r.ok) UI.closeModal();
}

function showRequestPasswordChange() {
  UI.openModal('Change Password', `
    <div class="field-group"><label>Current Password</label><input id="cpCurrent" type="password" placeholder="current password" /></div>
  `, `<button class="btn-primary" style="width:auto" onclick="doRequestPasswordChange()">Request OTP</button>`);
}

async function doRequestPasswordChange() {
  const currentPassword = document.getElementById('cpCurrent').value;
  const r = await API.requestPasswordChange({ currentPassword });
  if (r.ok) {
    UI.toast('OTP sent', 'success');
    UI.openModal('Enter New Password', `
      <div class="field-group"><label>OTP</label><input id="cpOtp" type="text" placeholder="123456" /></div>
      <div class="field-group"><label>New Password</label><input id="cpNew" type="password" placeholder="newpassword" /></div>
    `, `<button class="btn-primary" style="width:auto" onclick="doChangePassword()">Change Password</button>`);
  } else {
    UI.toast(r.data?.message || 'Failed', 'error');
  }
}

async function doChangePassword() {
  const otp = document.getElementById('cpOtp').value.trim();
  const newPassword = document.getElementById('cpNew').value;
  const r = await API.changePassword({ otp, newPassword });
  UI.toast(r.ok ? 'Password changed!' : (r.data?.message || 'Failed'), r.ok ? 'success' : 'error');
  if (r.ok) UI.closeModal();
}

function showChangeUsername() {
  UI.openModal('Change Username', `
    <div class="field-group"><label>New Username</label><input id="unNew" type="text" placeholder="muaaz_new" /></div>
    <div class="field-group"><label>Password</label><input id="unPass" type="password" placeholder="your password" /></div>
  `, `<button class="btn-primary" style="width:auto" onclick="doRequestUsernameChange()">Request OTP</button>`);
}

async function doRequestUsernameChange() {
  const newUsername = document.getElementById('unNew').value.trim();
  const password    = document.getElementById('unPass').value;
  const r = await API.requestUsernameChange({ newUsername, password });
  if (r.ok) {
    UI.toast('OTP sent', 'success');
    UI.openModal('Confirm Username Change', `
      <div class="field-group"><label>OTP</label><input id="unOtp" type="text" placeholder="123456" /></div>
    `, `<button class="btn-primary" style="width:auto" onclick="doChangeUsername()">Confirm Change</button>`);
  } else {
    UI.toast(r.data?.message || 'Failed', 'error');
  }
}

async function doChangeUsername() {
  const otp = document.getElementById('unOtp').value.trim();
  const r = await API.changeUsername({ otp });
  UI.toast(r.ok ? 'Username changed!' : (r.data?.message || 'Failed'), r.ok ? 'success' : 'error');
  if (r.ok) UI.closeModal();
}

// ===== MODAL CONTROLS =====
function closeModal(event) {
  if (!event || event.target.id === 'modal') UI.closeModal();
}
function closeModalDirect() { UI.closeModal(); }

// ===== LOG CONTROLS =====
function clearLog() {
  document.getElementById('logBody').innerHTML = '';
}

function toggleLog() {
  const panel = document.getElementById('logPanel');
  panel.classList.toggle('log-collapsed');
  const btn = document.getElementById('logToggleBtn');
  const collapsed = panel.classList.contains('log-collapsed');
  btn.innerHTML = collapsed
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`;
}
