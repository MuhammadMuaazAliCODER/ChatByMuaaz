// ── MAIN APP MODULE ──────────────────────────────────
const APP = {
  me: {},
  currentChatId: null,
  currentChatName: null,
  currentChatType: null,
  chats: [],
  friends: [],
  subStatus: null,
  pollTimer: null,
  _lastIds: new Set(),
  _userCache: {},
  _unreadCounts: {},
  _totalUnread: 0,
};

// ── WEBSOCKET ─────────────────────────────────────────
let _ws = null;
let _wsReconnectTimer = null;

function connectWS() {
  const token = API.get();
  if (!token) return;
  clearTimeout(_wsReconnectTimer);
  try {
    _ws = new WebSocket(`ws://localhost:5300?token=${token}`);
  } catch (e) {
    console.error('WS init failed:', e);
    return;
  }
  _ws.onopen = () => { console.log('[WS] Connected'); };
  _ws.onmessage = (e) => {
    try { const data = JSON.parse(e.data); handleWSMessage(data); }
    catch (err) { console.error('[WS] Parse error:', err); }
  };
  _ws.onclose = () => {
    console.log('[WS] Disconnected — reconnecting in 3s...');
    _ws = null;
    if (API.get()) _wsReconnectTimer = setTimeout(connectWS, 3000);
  };
  _ws.onerror = (err) => { console.error('[WS] Error:', err); };
}

function disconnectWS() {
  clearTimeout(_wsReconnectTimer);
  if (_ws) { _ws.onclose = null; _ws.close(); _ws = null; }
}

function handleWSMessage(data) {
  switch (data.type) {

    case 'online_users':
      Object.keys(APP._userCache).forEach(id => { APP._userCache[id].online = false; });
      data.users.forEach(userId => {
        if (APP._userCache[userId]) APP._userCache[userId].online = true;
        else APP._userCache[userId] = { _id: userId, online: true };
      });
      renderChatList(APP.chats);
      renderFriends(APP.friends);
      break;

    case 'user_online':
      if (APP._userCache[data.userId]) APP._userCache[data.userId].online = true;
      else APP._userCache[data.userId] = { _id: data.userId, online: true };
      renderChatList(APP.chats);
      renderFriends(APP.friends);
      updateChatHeaderStatus(data.userId, true);
      break;

    case 'user_offline':
      if (APP._userCache[data.userId]) APP._userCache[data.userId].online = false;
      renderChatList(APP.chats);
      renderFriends(APP.friends);
      updateChatHeaderStatus(data.userId, false);
      break;

    case 'new_message': {
      const msg    = data.message;
      const chatId = msg?.chatId;
      if (chatId && chatId !== APP.currentChatId) {
        APP._unreadCounts[chatId] = (APP._unreadCounts[chatId] || 0) + 1;
        recalcTotalUnread();
        showInAppNotification(msg);
      }
      if (APP.currentChatId && chatId === APP.currentChatId) {
        APP._lastIds.clear();
        loadMessages();
        API.markAllRead(APP.currentChatId);
      }
      loadChats();
      break;
    }

    case 'typing':
      handleTypingIndicator(data);
      break;

    case 'message_delivered':
    case 'message_read':
    case 'messages_read':
      if (APP.currentChatId) { APP._lastIds.clear(); loadMessages(); }
      break;

    case 'message_edited':
      if (APP.currentChatId) { APP._lastIds.clear(); loadMessages(); }
      break;

    case 'message_deleted':
      if (APP.currentChatId) { APP._lastIds.clear(); loadMessages(); }
      break;
       
case 'friend_request': {
  const req = data.request;
  loadIncomingReqs(); 
  const name = req.sender?.name || req.sender?.username || 'Someone';
  toast(`👋 ${name} sent you a friend request!`, 'ok', 5000);
  break;
}

case 'friend_accepted': {
  toast(`🎉 ${data.friendName || 'Someone'} accepted your friend request!`, 'ok', 5000);
  loadFriends();
  loadChats();
  break;
}
case 'call_offer':
  handleIncomingCallOffer(data);
  break;

case 'call_accepted':
  handleCallAccepted(data);
  break;

case 'sdp_offer':
  handleSdpOffer(data);
  break;

case 'sdp_answer':
  handleSdpAnswer(data);
  break;

case 'call_answer':
  handleCallAnswer(data);
  break;

case 'ice_candidate':
  handleIceCandidate(data);
  break;

case 'call_ended':
  handleCallEnded();
  break;

case 'call_rejected':
  handleCallRejected(data);
  break;
    default:
      console.log('[WS] Unknown event:', data.type);
  }
}

// ── IN-APP NOTIFICATION BANNER ────────────────────────
let _inAppTimer = null;

async function resolveUser(senderId) {
  if (!senderId) return {};

  // 1. Already cached
  if (APP._userCache[senderId]) return APP._userCache[senderId];

  // 2. Check chat member lists
  for (const chat of (APP.chats || [])) {
    const member = (chat.members || chat.participants || [])
      .find(m => (m._id || m) === senderId);
    if (member && (member.name || member.username)) {
      APP._userCache[senderId] = member;
      return member;
    }
  }

  // 3. Fetch ALL users and cache
  try {
    const res = await API.getUsers();
    if (res.ok) {
      const users = res.data.users || res.data || [];
      if (Array.isArray(users)) {
        users.forEach(u => { if (u._id) APP._userCache[u._id] = u; });
        if (APP._userCache[senderId]) return APP._userCache[senderId];
      }
    }
  } catch (e) { /* silent fail */ }

  return {};
}

// ── ROBUST SENDER RESOLVER FOR NOTIFICATIONS ──────────
// Tries every possible location to find the sender's name.
// Works even when msg.sender is just an ID string.
async function resolveSenderForNotif(msg) {
  // ── DEBUG: log the raw WS message so we can see the format ──
  console.log('[Notif] raw msg:', JSON.stringify(msg));

  const senderRaw = msg.sender;

  // Extract the ID whether sender is an object or a plain string
  const senderId = senderRaw
    ? (typeof senderRaw === 'object' ? (senderRaw._id || senderRaw.id) : String(senderRaw))
    : null;

  console.log('[Notif] senderId:', senderId, '| chatId:', msg.chatId);
  console.log('[Notif] chats loaded:', APP.chats.length, '| cache size:', Object.keys(APP._userCache).length);

  // 1. If sender object already has a name, use it directly
  if (typeof senderRaw === 'object' && senderRaw !== null) {
    const name = senderRaw.name || senderRaw.username;
    if (name) {
      console.log('[Notif] resolved from sender object:', name);
      return senderRaw;
    }
  }

  // 2. Check user cache by ID
  if (senderId && APP._userCache[senderId]) {
    const u = APP._userCache[senderId];
    if (u.name || u.username) {
      console.log('[Notif] resolved from cache:', u.name || u.username);
      return u;
    }
  }

  // 3. Look through chat participants — check ALL chats, not just matching chatId
  //    (in case chatId field name differs in the WS payload)
  if (senderId) {
    for (const chat of (APP.chats || [])) {
      for (const p of (chat.participants || chat.members || [])) {
        const pid = typeof p === 'object' ? (p._id || p.id) : p;
        if (pid === senderId && typeof p === 'object' && (p.name || p.username)) {
          console.log('[Notif] resolved from participants (chat', chat._id, '):', p.name || p.username);
          APP._userCache[senderId] = p;
          return p;
        }
      }
    }
  }

  // 4. Try matching chatId with multiple possible field names
  const possibleChatId = msg.chatId || msg.chat || msg.room || msg.channel;
  if (senderId && possibleChatId) {
    const chat = APP.chats.find(c => c._id === possibleChatId || c.id === possibleChatId);
    if (chat) {
      const p = (chat.participants || chat.members || [])
        .find(m => {
          const mid = typeof m === 'object' ? (m._id || m.id) : m;
          return mid === senderId && typeof m === 'object' && (m.name || m.username);
        });
      if (p) {
        console.log('[Notif] resolved via possibleChatId:', p.name || p.username);
        APP._userCache[senderId] = p;
        return p;
      }
    }
  }

  // 5. Last resort: fetch users from API
  console.log('[Notif] falling back to API fetch for sender:', senderId);
  const resolved = await resolveUser(senderId);
  if (resolved && (resolved.name || resolved.username)) {
    console.log('[Notif] resolved from API:', resolved.name || resolved.username);
    return resolved;
  }

  console.warn('[Notif] could not resolve sender for ID:', senderId);
  return typeof senderRaw === 'object' ? (senderRaw || {}) : {};
}

async function showInAppNotification(msg) {
  if (!msg) return;

  const sender  = await resolveSenderForNotif(msg);
  const name    = sender.name || sender.username || 'Someone';
  const pic     = sender.profilePicture || '';
  const letter  = name[0]?.toUpperCase() || '?';
  const color   = ac(name);
  const preview = msg.type === 'audio' ? '🎤 Voice message' : (msg.content || 'New message');

  let notif = document.getElementById('inAppNotif');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'inAppNotif';
    notif.style.cssText = `
      position:fixed; top:16px; right:16px; z-index:9999;
      background:var(--bg2); border:1px solid var(--bdr);
      border-radius:14px; padding:12px 14px; min-width:260px; max-width:320px;
      box-shadow:0 8px 32px rgba(0,0,0,.45);
      display:flex; align-items:center; gap:10px; cursor:pointer;
      transform:translateX(calc(100% + 24px)); transition:transform .3s cubic-bezier(.4,0,.2,1);
    `;
    document.body.appendChild(notif);
  }

  const avHtml = pic
    ? `<div style="width:38px;height:38px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid var(--bdr2)">
         <img src="${pic}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.style.background='${color}';this.remove()"/>
       </div>`
    : `<div style="width:38px;height:38px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0;color:#071525">${letter}</div>`;

  notif.innerHTML = `
    ${avHtml}
    <div style="flex:1;min-width:0;overflow:hidden">
      <div style="font-size:13px;font-weight:700;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
      <div style="font-size:12px;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${esc(preview)}</div>
    </div>
    <button onclick="dismissInAppNotif(event)" style="background:none;border:none;color:var(--txt2);font-size:16px;cursor:pointer;flex-shrink:0;padding:0 0 0 4px;line-height:1">✕</button>
  `;

  notif.onclick = (e) => {
    if (e.target.closest('button')) return;
    dismissInAppNotif();
    const chatId = msg.chatId || msg.chat || msg.room;
    const chat = APP.chats.find(c => c._id === chatId);
    if (chat) openChat(chat._id, chatName(chat), chat.type || 'direct');
    else loadChats().then(() => {
      const c2 = APP.chats.find(c => c._id === chatId);
      if (c2) openChat(c2._id, chatName(c2), c2.type || 'direct');
    });
  };

  requestAnimationFrame(() => { notif.style.transform = 'translateX(0)'; });
  clearTimeout(_inAppTimer);
  _inAppTimer = setTimeout(dismissInAppNotif, 5000);
  playNotifSound();
}

function dismissInAppNotif(e) {
  if (e) e.stopPropagation();
  clearTimeout(_inAppTimer);
  const notif = document.getElementById('inAppNotif');
  if (notif) notif.style.transform = 'translateX(calc(100% + 24px))';
}

function playNotifSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (_) {}
}

// ── UNREAD COUNT HELPERS ──────────────────────────────
function recalcTotalUnread() {
  APP._totalUnread = Object.values(APP._unreadCounts).reduce((a, b) => a + b, 0);
  updateSidebarUnreadBadge();
}

function updateSidebarUnreadBadge() {
  let badge = document.getElementById('sbUnreadBadge');
  if (!badge) {
    const btn = document.querySelector('.sb-toggle, #sbToggle, [onclick="toggleSb()"]');
    if (btn) {
      badge = document.createElement('span');
      badge.id = 'sbUnreadBadge';
      badge.style.cssText = `
        position:absolute; top:-4px; right:-4px;
        background:#ef4444; color:#fff; border-radius:10px;
        font-size:10px; font-weight:700; padding:1px 5px;
        min-width:16px; text-align:center; line-height:16px;
        pointer-events:none;
      `;
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }
  if (badge) {
    if (APP._totalUnread > 0) {
      badge.textContent = APP._totalUnread > 99 ? '99+' : String(APP._totalUnread);
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }
  document.title = APP._totalUnread > 0 ? `(${APP._totalUnread}) Chat App` : 'Chat App';
}

function updateChatHeaderStatus(userId, isOnline) {
  if (APP.currentChatType !== 'direct') return;
  const chat  = APP.chats.find(c => c._id === APP.currentChatId);
  if (!chat) return;
  const other = otherParticipant(chat);
  if (!other || other._id !== userId) return;
  const sub = document.getElementById('cwSub');
  if (sub && !sub.textContent.includes('typing')) {
    sub.textContent = isOnline ? '🟢 Online' : 'Offline';
  }
}

// ── Typing indicator ──────────────────────────────────
let _typingTimer = null;
function handleTypingIndicator(data) {
  if (data.chatId !== APP.currentChatId) return;
  const sub = document.getElementById('cwSub');
  if (!sub) return;
  if (data.isTyping) {
    sub.textContent = 'typing…';
    clearTimeout(_typingTimer);
    _typingTimer = setTimeout(() => {
      const chat  = APP.chats.find(c => c._id === APP.currentChatId);
      const other = chat ? otherParticipant(chat) : null;
      sub.textContent = APP.currentChatType === 'group' ? 'Group chat' : (other?.online ? '🟢 Online' : 'Offline');
    }, 2000);
  } else {
    clearTimeout(_typingTimer);
    const chat  = APP.chats.find(c => c._id === APP.currentChatId);
    const other = chat ? otherParticipant(chat) : null;
    sub.textContent = APP.currentChatType === 'group' ? 'Group chat' : (other?.online ? '🟢 Online' : 'Offline');
  }
}

function sendTyping(isTyping) {
  if (_ws && _ws.readyState === 1 && APP.currentChatId) {
    _ws.send(JSON.stringify({ type: 'typing', chatId: APP.currentChatId, isTyping }));
  }
}

// ── BOOT ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  initEmojiBar();
  injectMsgContextStyles();
  const restored = tryRestore();
  if (restored) {
    try {
      const r = await API.verifyToken();
      if (r.ok) {
        APP.me = r.data.user || r.data || {};
        startApp();
        return;
      }
    } catch (e) {
      console.warn('[Boot] Token verify failed:', e);
    }
    try { localStorage.removeItem('cba_token'); } catch (e) {}
    API.set(null);
  }
  document.getElementById('authWrap').classList.remove('hidden');
});

function startApp() {
  document.getElementById('authWrap').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const isMobile = window.innerWidth <= 720;
  if (isMobile) {
    document.getElementById('sb').classList.add('open');
    document.getElementById('sbOverlay').classList.remove('hidden');
    document.getElementById('fab').classList.add('hidden');
  } else {
    document.getElementById('fab').classList.remove('hidden');
  }
  refreshUserUI();
  loadChats();
  loadFriends();
  loadIncomingReqs();
  loadSubStatus();
  prefetchUsers();
  connectWS();
  requestNotifPermission();
  setInterval(() => { loadChats(); loadIncomingReqs(); }, 10000);
}

async function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

// ── USER CACHE ────────────────────────────────────────
function cacheUserFromAPI(u) {
  if (!u || !u._id) return;
  const { online, ...rest } = u;
  APP._userCache[u._id] = { ...APP._userCache[u._id], ...rest };
}

async function prefetchUsers() {
  const r = await API.getUsers();
  if (!r.ok) return;
  const users = r.data.users || r.data || [];
  users.forEach(cacheUserFromAPI);
}

function cachedUser(idOrObj) {
  if (!idOrObj) return null;
  if (typeof idOrObj === 'object' && idOrObj._id) {
    const cached = APP._userCache[idOrObj._id] || {};
    return {
      ...idOrObj,
      ...cached,
      profilePicture: idOrObj.profilePicture || cached.profilePicture || '',
      online: cached.online ?? false,
    };
  }
  if (typeof idOrObj === 'string') return APP._userCache[idOrObj] || null;
  return null;
}

// ── UNIVERSAL AVATAR BUILDER ──────────────────────────
function makeAv(userOrId, size = 'xs', showOnline = false) {
  const u      = cachedUser(userOrId) || (typeof userOrId === 'object' ? userOrId : {});
  const name   = u.name || u.username || 'User';
  const letter = name[0]?.toUpperCase() || '?';
  const color  = ac(name);
  const pic    = u.profilePicture || '';
  const online = showOnline && u.online === true;

  const inner = pic
    ? `<img src="${pic}" alt="${letter}"
         style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"
         onerror="this.remove()"/>`
    : letter;

  const dot = online
    ? `<span style="position:absolute;bottom:1px;right:1px;
         width:9px;height:9px;background:#22c55e;border-radius:50%;
         border:2px solid var(--bg,#1e1e2e);display:block;z-index:1"></span>`
    : '';

  return `<div style="position:relative;display:inline-flex;flex-shrink:0">
    <div class="av av-${size}" style="${pic ? 'background:transparent' : `background:${color}`}">${inner}</div>
    ${dot}
  </div>`;
}

// ── USER UI (own profile) ─────────────────────────────
function refreshUserUI() {
  const u      = APP.me;
  const name   = u.name || u.username || 'User';
  const letter = name[0]?.toUpperCase() || '?';
  const color  = ac(name);
  setAv('sbAv', u.profilePicture, letter, color, 'sm');
  document.getElementById('sbName').textContent     = name;
  setAv('drAv', u.profilePicture, letter, color, 'xl');
  document.getElementById('drName').textContent     = name;
  document.getElementById('drUsername').textContent = '@' + (u.username || '');
  document.getElementById('drEmail').textContent    = u.email || '';
  const curU = document.getElementById('curUsername');
  if (curU) curU.textContent = '@' + (u.username || '');
}

function setAv(elId, imgUrl, letter, color, size) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className = `av av-${size}`;
  if (imgUrl) {
    el.style.background = 'transparent';
    el.innerHTML = `<img src="${imgUrl}" alt="${letter}"
      style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"
      onerror="this.remove()"/>`;
  } else {
    el.style.background = color;
    el.textContent = letter;
  }
}

// ── TOAST ─────────────────────────────────────────────
function toast(msg, type = '', dur = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast ${type} show`;
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), dur);
}

// ── SIDEBAR ───────────────────────────────────────────
function toggleSb() {
  document.getElementById('sb').classList.toggle('open');
  document.getElementById('sbOverlay').classList.toggle('hidden',
    !document.getElementById('sb').classList.contains('open'));
}
function closeSb() {
  document.getElementById('sb').classList.remove('open');
  document.getElementById('sbOverlay').classList.add('hidden');
  if (!APP.currentChatId) document.getElementById('fab').classList.remove('hidden');
}
function sbTab(t) {
  document.querySelectorAll('.sn-tab').forEach(b => b.classList.toggle('active', b.dataset.t === t));
  document.getElementById('pChats').classList.toggle('hidden', t !== 'chats');
  document.getElementById('pFriends').classList.toggle('hidden', t !== 'friends');
}

// ── CHATS ─────────────────────────────────────────────
async function loadChats() {
  const r = await API.getChats();
  if (!r.ok) return;
  APP.chats = r.data.chats || r.data || [];
  APP.chats.forEach(c => {
    (c.participants || []).forEach(p => { if (p && p._id) cacheUserFromAPI(p); });
    if (c._id) {
      const apiCount = c.unreadCount || 0;
      if (apiCount > (APP._unreadCounts[c._id] || 0)) APP._unreadCounts[c._id] = apiCount;
    }
  });
  recalcTotalUnread();
  renderChatList(APP.chats);
}

function chatName(c) {
  if (c.name) return c.name;
  if (c.participants?.length) {
    const others = c.participants.filter(p => (p._id || p) !== APP.me._id);
    const list   = others.length ? others : c.participants;
    return list.map(p => {
      const u = cachedUser(p) || (typeof p === 'object' ? p : {});
      return u.name || u.username || 'User';
    }).join(', ');
  }
  return 'Chat';
}

function otherParticipant(c) {
  if (!c?.participants?.length) return null;
  const raw = c.participants.find(p => (p._id || p) !== APP.me._id);
  if (!raw) return null;
  return cachedUser(raw) || (typeof raw === 'object' ? raw : null);
}

function renderChatList(list) {
  const el = document.getElementById('chatList');
  if (!list.length) {
    el.innerHTML = '<div class="empty-list">No chats yet.<br>Tap + to start one!</div>';
    return;
  }
  el.innerHTML = list.map(c => {
    const name   = chatName(c);
    const prev   = c.lastMessage?.type === 'audio' ? '🎤 Voice message' : (c.lastMessage?.content || '');
    const time   = c.lastMessage?.createdAt ? fmtTime(c.lastMessage.createdAt) : '';
    const unread = APP._unreadCounts[c._id] || 0;
    const avHtml = c.type === 'group'
      ? makeAv({ name, profilePicture: c.profilePicture || '' }, 'xs', false)
      : makeAv(otherParticipant(c) || { name }, 'xs', true);
    const badge  = unread > 0
      ? `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;background:#22c55e;color:#fff;border-radius:9px;font-size:11px;font-weight:700;flex-shrink:0">${unread > 99 ? '99+' : unread}</span>`
      : '';
    return `<div class="crow${c._id === APP.currentChatId ? ' active' : ''}${unread > 0 ? ' has-unread' : ''}"
        onclick="openChat('${c._id}','${esc(name)}','${c.type||'direct'}')" data-id="${c._id}">
      ${avHtml}
      <div class="cri">
        <div class="cri-top">
          <span class="cri-name" style="${unread > 0 ? 'font-weight:700' : ''}">${esc(name)}</span>
          <span class="cri-time">${time}</span>
        </div>
        <div class="cri-bot">
          <span class="cri-prev" style="${unread > 0 ? 'font-weight:600;color:var(--txt,#e8e8f0)' : ''}">${esc(prev)}</span>
          ${badge}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── OPEN CHAT ─────────────────────────────────────────
function openChat(id, name, type) {
  APP.currentChatId   = id;
  APP.currentChatName = name;
  APP.currentChatType = type;
  document.querySelectorAll('.crow').forEach(r => r.classList.toggle('active', r.dataset.id === id));
  APP._unreadCounts[id] = 0;
  recalcTotalUnread();
  renderChatList(APP.chats);

  const chat   = APP.chats.find(c => c._id === id);
  const color  = ac(name);
  const letter = name[0]?.toUpperCase() || '?';
  const cwAv   = document.getElementById('cwAv');
  cwAv.className = 'av av-sm';

  let headerPic = '';
  if (type === 'group') headerPic = chat?.profilePicture || '';
  else if (chat) headerPic = otherParticipant(chat)?.profilePicture || '';

  if (headerPic) {
    cwAv.style.background = 'transparent';
    cwAv.innerHTML = `<img src="${headerPic}" alt="${letter}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" onerror="this.remove()"/>`;
  } else {
    cwAv.style.background = color;
    cwAv.textContent = letter;
  }

  document.getElementById('cwName').textContent = name;
  const sub = document.getElementById('cwSub');
  if (type === 'group') {
    sub.textContent = 'Group chat';
  } else {
    const other = chat ? otherParticipant(chat) : null;
    sub.textContent = other?.online ? '🟢 Online' : 'Offline';
  }

  document.getElementById('welcome').classList.add('hidden');
  // Inject call buttons into header
const actions = document.querySelector('.cw-head-actions');
if (actions) {
  // Remove old call buttons
  actions.querySelectorAll('.call-btn').forEach(b => b.remove());
  if (type === 'direct') {
    const chat2  = APP.chats.find(c => c._id === id);
    const other2 = chat2 ? otherParticipant(chat2) : null;
    const pid    = other2?._id || '';
    const pname  = other2?.name || other2?.username || name;
    const ppic   = other2?.profilePicture || '';

    const audioBtn = document.createElement('button');
    audioBtn.className = 'ib call-btn';
    audioBtn.title = 'Voice call';
    audioBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
    audioBtn.onclick = () => startCall(id, pid, pname, ppic, 'audio');

    const videoBtn = document.createElement('button');
    videoBtn.className = 'ib call-btn';
    videoBtn.title = 'Video call';
    videoBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
    videoBtn.onclick = () => startCall(id, pid, pname, ppic, 'video');

    // Insert before refresh button
    const refreshBtn = actions.querySelector('button[title="Refresh"]');
    if (refreshBtn) {
      actions.insertBefore(audioBtn, refreshBtn);
      actions.insertBefore(videoBtn, refreshBtn);
    } else {
      actions.appendChild(audioBtn);
      actions.appendChild(videoBtn);
    }
  }
}
  document.getElementById('cwin').classList.remove('hidden');
  closeSb();
  document.getElementById('fab').classList.add('hidden');
  APP._lastIds.clear();
  loadMessages();
  clearInterval(APP.pollTimer);
  APP.pollTimer = setInterval(loadMessages, 3000);
  API.markAllRead(id);
}

function closeCwin() {
  document.getElementById('cwin').classList.add('hidden');
  clearInterval(APP.pollTimer);
  APP.currentChatId = null;
  document.querySelectorAll('.crow').forEach(r => r.classList.remove('active'));
  const isMobile = window.innerWidth <= 720;
  if (isMobile) {
    document.getElementById('sb').classList.add('open');
    document.getElementById('sbOverlay').classList.remove('hidden');
    document.getElementById('fab').classList.add('hidden');
  } else {
    document.getElementById('welcome').classList.remove('hidden');
    document.getElementById('fab').classList.remove('hidden');
  }
}

// ── MESSAGES ──────────────────────────────────────────
async function loadMessages() { await refreshMsgs(); }

async function refreshMsgs() {
  if (!APP.currentChatId) return;
  const r = await API.getMessages(APP.currentChatId);
  if (!r.ok) return;
  const msgs = r.data.messages || r.data || [];
  const ids  = msgs.map(m => m._id).join(',');
  if (APP._lastIds.size && ids === [...APP._lastIds].join(',')) return;
  APP._lastIds = new Set(msgs.map(m => m._id));
  msgs.forEach(m => { if (m.sender && typeof m.sender === 'object' && m.sender._id) cacheUserFromAPI(m.sender); });
  renderMessages(msgs);
}

// ── READ RECEIPT TICK RENDERER ────────────────────────
function renderTick(msg) {
  const status = msg.status || (msg.read ? 'read' : msg.deliveredAt ? 'delivered' : 'sent');
  if (status === 'read') {
    return `<span class="mb-tick read" title="Seen" style="color:#3b82f6;font-size:13px;letter-spacing:-2px">✓✓</span>`;
  } else if (status === 'delivered') {
    return `<span class="mb-tick delivered" title="Delivered" style="color:var(--txt3,#888);font-size:13px;letter-spacing:-2px">✓✓</span>`;
  } else {
    return `<span class="mb-tick sent" title="Sent" style="color:var(--txt3,#888);font-size:13px">✓</span>`;
  }
}

function renderMessages(msgs) {
  const area     = document.getElementById('msgs');
  const atBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;

  if (!msgs.length) {
    area.innerHTML = '<div style="text-align:center;color:var(--txt3);padding:40px;font-size:13px">No messages yet. Say hello 👋</div>';
    return;
  }

  let html = ''; let lastDate = null;
  const chat  = APP.chats.find(c => c._id === APP.currentChatId);
  const other = chat ? otherParticipant(chat) : null;

  msgs.forEach(msg => {
    const d = fmtDate(msg.createdAt);
    if (d !== lastDate) { html += `<div class="msg-sep">${d}</div>`; lastDate = d; }

    const isOut  = msg.sender?._id === APP.me._id || msg.sender === APP.me._id;
    const cls    = isOut ? 'mb-out' : 'mb-in';
    const tick   = isOut ? renderTick(msg) : '';

    const editedLabel = msg.edited
      ? `<span style="font-size:10px;color:var(--txt3,#888);margin-right:4px;font-style:italic">edited</span>`
      : '';

    const time = fmtTime(msg.createdAt);

    let senderBlock = '';
    if (!isOut) {
      if (APP.currentChatType === 'group') {
        const sender = cachedUser(msg.sender) || (typeof msg.sender === 'object' ? msg.sender : {});
        const sName  = sender.name || sender.username || 'User';
        senderBlock  = `<div class="mb-sname" style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          ${makeAv(sender, 'xs', false)}<span style="font-size:11px;font-weight:600">${esc(sName)}</span>
        </div>`;
      } else {
        const sender = cachedUser(msg.sender) || other || {};
        senderBlock  = `<div style="display:flex;align-items:flex-end;gap:5px;margin-bottom:2px">${makeAv(sender, 'xs', false)}</div>`;
      }
    }

    const content = (msg.type === 'audio' || msg.audioUrl)
  ? renderVoiceBubble(msg)
  : `<div class="msg-text">${renderMsgContent(msg.content || '')}</div>`;

    const dataAttrs = `data-msg-id="${msg._id}" data-is-out="${isOut}" data-msg-type="${msg.type || 'text'}" data-content="${esc(msg.content || '')}"`;

    html += `<div class="mb ${cls}" ${dataAttrs}>${senderBlock}${content}<div class="mb-foot">${editedLabel}<span class="mb-time">${time}</span>${tick}</div></div>`;
  });

  area.innerHTML = html;
  area.querySelectorAll('.mb').forEach(el => attachMsgLongPress(el));
  if (atBottom || msgs.length < 8) area.scrollTop = area.scrollHeight;
}

function renderVoiceBubble(msg) {
  const bars    = Array.from({ length: 22 }, (_, i) => {
    const h = 6 + Math.floor(Math.abs(Math.sin(i * 0.8)) * 16);
    return `<div class="vb-bar" style="height:${h}px"></div>`;
  }).join('');
  const audioId = 'va_' + msg._id;
  const url     = msg.audioUrl || '';
  return `
    <div class="voice-bubble">
      <button class="vb-play" onclick="playVoice('${audioId}','${esc(url)}',this)">▶</button>
      <div class="vb-wave">${bars}</div>
      <span class="vb-dur" id="dur_${msg._id}">0:00</span>
    </div>
    <audio id="${audioId}" src="${esc(url)}" style="display:none"
      ontimeupdate="voiceTime(this,'${msg._id}')"
      onended="voiceEnded(this,document.querySelector('[onclick*=\\'${audioId}\\']'))"></audio>`;
}

function playVoice(audioId, url, btn) {
  const audio = document.getElementById(audioId);
  if (!audio) return;
  if (audio.paused) { audio.play().catch(() => {}); btn.textContent = '⏸'; }
  else { audio.pause(); btn.textContent = '▶'; }
}
function voiceTime(audio, msgId) {
  const el = document.getElementById('dur_' + msgId);
  if (el) {
    const t = audio.duration - audio.currentTime;
    const s = Math.ceil(t);
    el.textContent = `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  }
}
function voiceEnded(audio, btn) { if (btn) btn.textContent = '▶'; }

async function sendTextMsg() {
  const ta      = document.getElementById('msgTa');
  const content = ta.value.trim();
  if (!content || !APP.currentChatId) return;
  ta.value = ''; taResize(ta);
  sendTyping(false);
  const r = await API.sendMessage({ chatId: APP.currentChatId, content, type: 'text' });
  if (r.ok) { APP._lastIds.clear(); await loadMessages(); loadChats(); }
  else { ta.value = content; toast(r.data?.message || 'Failed to send', 'err'); }
}

// ── LONG-PRESS CONTEXT MENU ───────────────────────────
function injectMsgContextStyles() {
  if (document.getElementById('msgCtxStyles')) return;
  const style = document.createElement('style');
  style.id = 'msgCtxStyles';
  style.textContent = `
    #msgCtxMenu {
      position: fixed;
      z-index: 10000;
      background: var(--bg2, #1e1e2e);
      border: 1px solid var(--bdr, #2a2a3a);
      border-radius: 14px;
      padding: 6px;
      min-width: 180px;
      box-shadow: 0 12px 40px rgba(0,0,0,.55);
      animation: ctxIn .15s cubic-bezier(.4,0,.2,1);
    }
    @keyframes ctxIn {
      from { opacity:0; transform:scale(.92) translateY(-6px); }
      to   { opacity:1; transform:scale(1) translateY(0); }
    }
    .ctx-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 9px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: var(--txt, #e8e8f0);
      transition: background .12s;
      user-select: none;
    }
    .ctx-item:hover { background: var(--bgh, rgba(255,255,255,.07)); }
    .ctx-item.danger { color: #ef4444; }
    .ctx-item .ctx-icon { font-size: 16px; width: 20px; text-align: center; }

    #editMsgBar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--bg2, #1e1e2e);
      border-top: 1px solid var(--acc, #6366f1);
      animation: slideUp .15s ease;
    }
    @keyframes slideUp {
      from { opacity:0; transform:translateY(8px); }
      to   { opacity:1; transform:translateY(0); }
    }
    #editMsgBar .edit-label {
      font-size: 11px;
      color: var(--acc, #6366f1);
      font-weight: 700;
      white-space: nowrap;
    }
    #editMsgBar input {
      flex: 1;
      background: var(--bg3, #2a2a3a);
      border: 1px solid var(--bdr, #3a3a4a);
      border-radius: 10px;
      padding: 8px 12px;
      color: var(--txt, #e8e8f0);
      font-size: 14px;
      outline: none;
    }
    #editMsgBar input:focus { border-color: var(--acc, #6366f1); }
    #editMsgBar .edit-save {
      background: var(--acc, #6366f1);
      color: #fff;
      border: none;
      border-radius: 9px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    #editMsgBar .edit-cancel {
      background: none;
      border: none;
      color: var(--txt2, #888);
      font-size: 18px;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 7px;
    }
    #editMsgBar .edit-cancel:hover { background: var(--bgh); }

    .mb.ctx-highlight {
      outline: 2px solid var(--acc, #6366f1);
      border-radius: 10px;
    }
  `;
  document.head.appendChild(style);
}

let _lpTimer       = null;
let _lpActive      = false;
let _lpStartX      = 0;
let _lpStartY      = 0;
let _currentCtxEl  = null;

function attachMsgLongPress(el) {
  const start = (cx, cy) => {
    _lpStartX = cx; _lpStartY = cy; _lpActive = false;
    _lpTimer = setTimeout(() => {
      _lpActive = true;
      el.classList.add('ctx-highlight');
      setTimeout(() => el.classList.remove('ctx-highlight'), 500);
      showMsgContextMenu(el);
    }, 500);
  };
  const cancel = () => { clearTimeout(_lpTimer); };
  const move   = (cx, cy) => {
    if (Math.abs(cx - _lpStartX) > 10 || Math.abs(cy - _lpStartY) > 10) clearTimeout(_lpTimer);
  };

  el.addEventListener('touchstart',  e => { const t = e.touches[0]; start(t.clientX, t.clientY); }, { passive: true });
  el.addEventListener('touchend',    cancel);
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('touchmove',   e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });

  el.addEventListener('mousedown',   e => { if (e.button === 0) start(e.clientX, e.clientY); });
  el.addEventListener('mouseup',     cancel);
  el.addEventListener('mouseleave',  cancel);
  el.addEventListener('mousemove',   e => move(e.clientX, e.clientY));

  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    showMsgContextMenu(el, e.clientX, e.clientY);
  });
}

function showMsgContextMenu(el, forcedX, forcedY) {
  closeMsgContextMenu();
  _currentCtxEl = el;

  const msgId   = el.dataset.msgId;
  const isOut   = el.dataset.isOut === 'true';
  const msgType = el.dataset.msgType || 'text';
  const content = el.dataset.content || '';

  const menu = document.createElement('div');
  menu.id    = 'msgCtxMenu';

  const items = [];

  if (msgType !== 'audio') {
    items.push({ icon: '📋', label: 'Copy', action: () => { navigator.clipboard?.writeText(content).catch(()=>{}); toast('Copied!'); } });
  }

  if (isOut && msgType !== 'audio') {
    items.push({ icon: '✏️', label: 'Edit', action: () => showEditBar(msgId, content) });
  }

  if (isOut) {
    items.push({ icon: '🗑', label: 'Delete', danger: true, action: () => doDelMsg(msgId, new Event('click')) });
  }

  if (!items.length) { _currentCtxEl = null; return; }

  menu.innerHTML = items.map((it, i) => `
    <div class="ctx-item${it.danger ? ' danger' : ''}" data-idx="${i}">
      <span class="ctx-icon">${it.icon}</span>
      <span>${it.label}</span>
    </div>
  `).join('');

  document.body.appendChild(menu);

  const rect   = el.getBoundingClientRect();
  const menuW  = 200, menuH = items.length * 44 + 12;
  let x = forcedX ?? (rect.left + rect.width / 2 - menuW / 2);
  let y = forcedY ?? rect.top - menuH - 8;

  x = Math.max(8, Math.min(x, window.innerWidth  - menuW - 8));
  y = Math.max(8, Math.min(y, window.innerHeight - menuH - 8));
  if (y < 8) y = (forcedY ?? rect.bottom) + 8;

  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';

  menu.querySelectorAll('.ctx-item').forEach(itemEl => {
    itemEl.addEventListener('click', () => {
      const idx = parseInt(itemEl.dataset.idx);
      closeMsgContextMenu();
      items[idx]?.action();
    });
  });

  setTimeout(() => {
    document.addEventListener('click', closeMsgContextMenuOutside, { once: true });
    document.addEventListener('touchstart', closeMsgContextMenuOutside, { once: true });
  }, 0);
}

function closeMsgContextMenuOutside(e) {
  const menu = document.getElementById('msgCtxMenu');
  if (menu && !menu.contains(e.target)) closeMsgContextMenu();
}

function closeMsgContextMenu() {
  const menu = document.getElementById('msgCtxMenu');
  if (menu) menu.remove();
  _currentCtxEl = null;
}

// ── EDIT MESSAGE ──────────────────────────────────────
let _editingMsgId = null;

function showEditBar(msgId, currentContent) {
  closeEditBar();
  _editingMsgId = msgId;

  const inputArea = document.getElementById('inputBar') || document.querySelector('.input-area, .msg-input-wrap, #msgInputWrap');

  const bar = document.createElement('div');
  bar.id    = 'editMsgBar';
  bar.innerHTML = `
    <span class="edit-label">✏️ Editing</span>
    <input id="editMsgInput" type="text" value="${esc(currentContent)}" placeholder="Edit message…" maxlength="2000"/>
    <button class="edit-cancel" onclick="closeEditBar()" title="Cancel">✕</button>
    <button class="edit-save"   onclick="submitEditMsg()">Save</button>
  `;

  if (inputArea) {
    inputArea.parentNode.insertBefore(bar, inputArea);
  } else {
    const cwin = document.getElementById('cwin');
    if (cwin) cwin.appendChild(bar);
  }

  const inp = document.getElementById('editMsgInput');
  if (inp) {
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submitEditMsg(); }
      if (e.key === 'Escape') closeEditBar();
    });
  }
}

function closeEditBar() {
  const bar = document.getElementById('editMsgBar');
  if (bar) bar.remove();
  _editingMsgId = null;
}

async function submitEditMsg() {
  const inp     = document.getElementById('editMsgInput');
  const content = inp?.value.trim();
  if (!content || !_editingMsgId) return;
  if (content === (inp?.dataset.original || '')) { closeEditBar(); return; }

  const r = await API.editMessage(_editingMsgId, { content });
  if (r.ok) {
    closeEditBar();
    APP._lastIds.clear();
    await loadMessages();
    toast('Message updated ✓', 'ok');
  } else {
    toast(r.data?.message || 'Failed to edit message', 'err');
  }
}

// ── DELETE MESSAGE ────────────────────────────────────
async function doDelMsg(id, e) {
  if (e && e.stopPropagation) e.stopPropagation();
  if (!confirm('Delete this message?')) return;
  const r = await API.deleteMsg(id);
  if (r.ok) { APP._lastIds.clear(); loadMessages(); toast('Message deleted', 'ok'); }
  else toast('Failed to delete', 'err');
}

// ── EMOJI ─────────────────────────────────────────────
function initEmojiBar() {
  const bar = document.getElementById('emojiBar');
  if (!bar) return;
  const emojis = bar.textContent.trim().split(/\s+/);
  bar.innerHTML = emojis.map(e => `<span onclick="addEmoji('${e}')">${e}</span>`).join('');
}
function toggleEmoji() { document.getElementById('emojiBar').classList.toggle('hidden'); }
function addEmoji(e) {
  const ta = document.getElementById('msgTa');
  ta.value += e; ta.focus(); taResize(ta);
}

// ── TEXTAREA RESIZE + TYPING ──────────────────────────
let _typingSendTimer = null;
function taResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  if (el.value.length > 0) {
    sendTyping(true);
    clearTimeout(_typingSendTimer);
    _typingSendTimer = setTimeout(() => sendTyping(false), 3000);
  } else {
    sendTyping(false);
  }
}

// ── SIDEBAR SEARCH ────────────────────────────────────
let _sTimer;
function handleSbSearch() {
  clearTimeout(_sTimer);
  const q = document.getElementById('sbSrch').value.trim().toLowerCase();
  _sTimer = setTimeout(() => {
    if (!q) { renderChatList(APP.chats); return; }
    renderChatList(APP.chats.filter(c => chatName(c).toLowerCase().includes(q)));
  }, 200);
}

// ── NEW CHAT MODAL ────────────────────────────────────
async function openNewChat() {
  openM('New Conversation', `
    <div class="field" style="margin-bottom:14px">
      <div class="finput">
        <svg class="fi-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input id="ncSearch" type="text" placeholder="Search by name or username…" oninput="ncSearchFn()" style="padding:10px 12px 10px 34px"/>
      </div>
    </div>
    <div id="ncResults" style="max-height:320px;overflow-y:auto"><div class="list-spin"><div class="spin"></div></div></div>
  `);
  loadNcUsers();
}

async function loadNcUsers() {
  const r = await API.getUsers();
  if (r.ok) {
    const users = r.data.users || r.data || [];
    users.forEach(cacheUserFromAPI);
    renderNcUsers(users);
  }
}
let _ncT;
function ncSearchFn() {
  clearTimeout(_ncT);
  const q = document.getElementById('ncSearch')?.value.trim();
  if (!q) { loadNcUsers(); return; }
  _ncT = setTimeout(async () => {
    const r = await API.searchUsers(q);
    if (r.ok) {
      const users = r.data.users || r.data || [];
      users.forEach(cacheUserFromAPI);
      renderNcUsers(users);
    }
  }, 300);
}

function renderNcUsers(users) {
  const el = document.getElementById('ncResults'); if (!el) return;
  if (!users.length) { el.innerHTML = '<div class="empty-list">No users found</div>'; return; }
  el.innerHTML = users.slice(0, 30).map(u => {
    const name = u.name || u.username || 'User';
    const live = APP._userCache[u._id] || {};
    const dot  = live.online
      ? `<span style="display:inline-block;width:8px;height:8px;background:#22c55e;border-radius:50%;margin-left:5px;vertical-align:middle"></span>`
      : '';
    return `<div class="freq" onclick="startChatWith('${u._id}')">
      ${makeAv(u, 'xs', true)}
      <div>
        <div style="font-size:14px;font-weight:600">${esc(name)}${dot}</div>
        <div style="font-size:11px;color:var(--txt2)">@${esc(u.username||'')}</div>
      </div>
    </div>`;
  }).join('');
}

async function startChatWith(userId) {
  closeM();
  const r = await API.createDirect({ userId });
  if (r.ok) {
    await loadChats();
    const id = r.data._id || r.data.chat?._id;
    if (id) {
      const found = APP.chats.find(c => c._id === id);
      openChat(id, found ? chatName(found) : 'Chat', 'direct');
    }
  } else toast(r.data?.message || 'Failed', 'err');
}

// ── FRIENDS ───────────────────────────────────────────
async function loadFriends() {
  const r = await API.getMyFriends();
  if (!r.ok) return;
  APP.friends = r.data.friends || r.data || [];
  APP.friends.forEach(f => { const u = f.user || f; cacheUserFromAPI(u); });
  renderFriends(APP.friends);
}

function renderFriends(list) {
  const el = document.getElementById('friendList'); if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="empty-list">No friends yet.<br>Use "Add" to find people!</div>';
    return;
  }
  el.innerHTML = list.map(f => {
    const u    = f.user || f;
    const name = u.name || u.username || 'Friend';
    const live = APP._userCache[u._id] || u;
    const dot  = live.online
      ? `<span style="display:inline-block;width:8px;height:8px;background:#22c55e;border-radius:50%;margin-left:5px;vertical-align:middle"></span>`
      : '';
    return `<div class="freq">
      ${makeAv(u, 'xs', true)}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${esc(name)}${dot}</div>
        <div style="font-size:11px;color:var(--txt2)">@${esc(u.username||'')}</div>
      </div>
      <div class="freq-actions">
        <button class="act-btn acc" onclick="startChatWith('${u._id}')">Message</button>
      </div>
    </div>`;
  }).join('');
}

async function loadIncomingReqs() {
  const r = await API.getIncomingReqs();
  if (!r.ok) return;
  const reqs  = r.data.requests || r.data || [];
  const badge = document.getElementById('reqBadge');
  if (reqs.length) { badge.textContent = reqs.length; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
  renderRequests(reqs);
}

function renderRequests(list) {
  const el = document.getElementById('reqList'); if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="empty-list">No pending requests</div>';
    return;
  }
  el.innerHTML = list.map(req => {
    const u      = req.sender || req;
    const name   = u.name || u.username || 'User';
    const color  = ac(name);
    const letter = name[0]?.toUpperCase() || '?';
    const pic    = u.profilePicture || '';

    const avHtml = pic
      ? `<div style="width:42px;height:42px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid var(--bdr2)">
           <img src="${pic}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.style.background='${color}';this.remove()"/>
         </div>`
      : `<div style="width:42px;height:42px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;color:#071525">${letter}</div>`;

    return `<div class="freq" style="padding:10px 8px;border-bottom:1px solid var(--bdr);align-items:center">
      ${avHtml}
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:var(--txt)">${esc(name)}</div>
        <div style="font-size:12px;color:var(--txt2);margin-top:1px">@${esc(u.username || '')}</div>
        ${u.email ? `<div style="font-size:11px;color:var(--txt3);margin-top:1px">${esc(u.email)}</div>` : ''}
      </div>
      <div class="freq-actions" style="gap:6px">
        <button class="act-btn acc" onclick="doRespondReq('${req._id}','accepted')">✓ Accept</button>
        <button class="act-btn rej" onclick="doRespondReq('${req._id}','rejected')">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function doRespondReq(id, action) {
  const r = await API.respondReq({ requestId: id, action });
  if (r.ok) {
    toast(action === 'accepted' ? 'Friend added! 🎉' : 'Declined', action === 'accepted' ? 'ok' : '');
    loadIncomingReqs();
    if (action === 'accepted') loadFriends();
  } else toast(r.data?.message || 'Failed', 'err');
}

let _afSearchTimer = null;

function renderAddFriendPanel() {
  const panel = document.getElementById('fp-add');
  if (!panel) return;
  panel.innerHTML = `
    <div class="add-friend-wrap">
      <p class="af-hint">Search by name or username</p>
      <div class="finput">
        <svg class="fi-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input id="afInput" type="text" placeholder="Start typing a name…" oninput="afSearch()" autocomplete="off"/>
      </div>
      <div id="afResults" style="margin-top:8px"></div>
      <div id="afResult" style="font-size:13px;min-height:16px;margin-top:6px"></div>
    </div>
  `;
}

async function afSearch() {
  const q         = (document.getElementById('afInput')?.value || '').trim();
  const resultsEl = document.getElementById('afResults');
  if (!resultsEl) return;

  clearTimeout(_afSearchTimer);

  if (q.length < 2) {
    resultsEl.innerHTML = q.length === 1
      ? `<div style="font-size:12px;color:var(--txt3);padding:6px 4px">Keep typing…</div>`
      : '';
    return;
  }

  resultsEl.innerHTML = `<div class="list-spin" style="padding:14px"><div class="spin"></div></div>`;

  _afSearchTimer = setTimeout(async () => {
    const r = await API.searchUsers(q);
    if (!r.ok) {
      resultsEl.innerHTML = `<div style="font-size:13px;color:var(--red);padding:6px 4px">Search failed</div>`;
      return;
    }

    const users = (r.data.users || r.data || []).filter(u => u._id !== APP.me._id);
    users.forEach(u => cacheUserFromAPI(u));

    if (!users.length) {
      resultsEl.innerHTML = `<div class="empty-list" style="padding:16px 4px">No users found for "<b>${esc(q)}</b>"</div>`;
      return;
    }

    resultsEl.innerHTML = users.slice(0, 10).map(u => {
      const name   = u.name || u.username || 'User';
      const color  = ac(name);
      const letter = name[0]?.toUpperCase() || '?';
      const pic    = u.profilePicture || '';

      const avHtml = pic
        ? `<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid var(--bdr2)">
             <img src="${pic}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.style.background='${color}';this.remove()"/>
           </div>`
        : `<div style="width:40px;height:40px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0;color:#071525">${letter}</div>`;

      return `
        <div class="freq" style="padding:9px 6px;border-bottom:1px solid var(--bdr)">
          ${avHtml}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--txt)">${esc(name)}</div>
            <div style="font-size:11px;color:var(--txt2);margin-top:1px">@${esc(u.username || '')}</div>
            ${u.email ? `<div style="font-size:10px;color:var(--txt3);margin-top:1px">${esc(u.email)}</div>` : ''}
          </div>
          <button class="act-btn acc" onclick="doSendFriendReq('${u._id}','${esc(u.username || '')}',this)"
            style="white-space:nowrap;font-size:11px;padding:5px 10px">
            + Add
          </button>
        </div>`;
    }).join('');
  }, 300);
}

async function doSendFriendReq(userId, username, btn) {
  const resEl   = document.getElementById('afResult');
  btn.disabled  = true;
  btn.textContent = '…';
  const r = await API.sendFriendReq({ username });
  if (r.ok) {
    btn.textContent      = '✓ Sent';
    btn.style.background = 'var(--green)';
    if (resEl) { resEl.textContent = `✓ Request sent to @${username}`; resEl.className = 'ok'; }
    toast('Friend request sent!', 'ok');
  } else {
    btn.disabled        = false;
    btn.textContent     = '+ Add';
    const msg = r.data?.message || 'Failed to send request';
    if (resEl) { resEl.textContent = msg; resEl.className = 'err'; }
    toast(msg, 'err');
  }
}

function doAddFriend() {}

function fpTab(t) {
  ['mine','reqs','add'].forEach(id =>
    document.getElementById(`fp-${id}`).classList.toggle('hidden', id !== t)
  );
  document.querySelectorAll('.fp-tab').forEach((b, i) =>
    b.classList.toggle('active', ['mine','reqs','add'][i] === t)
  );
  if (t === 'reqs') loadIncomingReqs();
  if (t === 'mine') loadFriends();
  if (t === 'add')  renderAddFriendPanel();
}

// ── SETTINGS DRAWER ───────────────────────────────────
function openSettings() { document.getElementById('drawerWrap').classList.remove('hidden'); }
function closeDrawer()  { document.getElementById('drawerWrap').classList.add('hidden'); }
function drawerOutside(e) { if (e.target.id === 'drawerWrap') closeDrawer(); }

// ── PROFILE EDIT ──────────────────────────────────────
function openEditProfile() {
  const u = APP.me;
  openM('Edit Profile', `
    <div class="field"><label>Full Name</label>
      <div class="finput"><input id="ep-n" type="text" value="${esc(u.name||'')}" placeholder="Your name"/></div>
    </div>
    <button class="btn-prim" onclick="saveProfile()">Save Changes</button>
  `);
}

async function saveProfile() {
  const name = document.getElementById('ep-n')?.value.trim();
  if (!name) return toast('Name cannot be empty', 'err');
  const fd = new FormData();
  fd.append('name', name);
  const r = await API.updateProfile(fd);
  if (r.ok) {
    APP.me.name = name;
    refreshUserUI();
    toast('Profile updated!', 'ok');
    closeM();
  } else toast(r.data?.message || 'Failed', 'err');
}

function triggerAvatarUpload() { document.getElementById('avatarFile').click(); }

async function uploadAvatar(input) {
  const file = input.files?.[0]; if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Image too large (max 5MB)', 'err'); return; }
  toast('Uploading photo…');
  const fd = new FormData();
  fd.append('profilePicture', file);
  const r = await API.updateProfile(fd);
  if (r.ok) {
    const url = r.data.user?.profilePicture || r.data.profilePicture;
    if (url) {
      APP.me.profilePicture = url;
      if (APP.me._id) APP._userCache[APP.me._id] = { ...APP._userCache[APP.me._id], profilePicture: url };
    }
    refreshUserUI();
    toast('Photo updated! ✓', 'ok');
    loadChats();
  } else toast(r.data?.message || 'Upload failed', 'err');
}

// ── CHANGE PASSWORD ───────────────────────────────────
function openChangePassword() {
  openM('Change Password', `
    <p class="form-note">Enter your current password to receive an OTP, then set a new one.</p>
    <div class="field"><label>Current Password</label>
      <div class="finput"><input id="cp-cur" type="password" placeholder="••••••••"/>
      <button class="eye-btn" onclick="toggleEye('cp-cur',this)">👁</button></div>
    </div>
    <button class="btn-prim" onclick="reqPwChange()">Send OTP</button>
    <div id="cpMsg" style="margin-top:10px;font-size:13px"></div>
  `);
}
async function reqPwChange() {
  const pw  = document.getElementById('cp-cur')?.value;
  if (!pw) return;
  const r   = await API.reqPasswordChange({ currentPassword: pw });
  const msg = document.getElementById('cpMsg'); if (!msg) return;
  if (r.ok) {
    msg.innerHTML = `
      <p style="color:var(--green);margin-bottom:10px">✓ OTP sent to your email</p>
      <div class="field"><label>OTP</label><div class="finput"><input id="cp-otp" type="text" maxlength="6" placeholder="123456"/></div></div>
      <div class="field"><label>New Password</label><div class="finput"><input id="cp-new" type="password" placeholder="••••••••"/><button class="eye-btn" onclick="toggleEye('cp-new',this)">👁</button></div></div>
      <button class="btn-prim" onclick="confirmPwChange()">Change Password</button>`;
  } else msg.innerHTML = `<p style="color:var(--red)">${r.data?.message || 'Failed'}</p>`;
}
async function confirmPwChange() {
  const otp         = (document.getElementById('cp-otp')?.value || '').trim();
  const newPassword = document.getElementById('cp-new')?.value || '';
  const r           = await API.changePassword({ otp, newPassword });
  if (r.ok) { toast('Password changed!', 'ok'); closeM(); }
  else toast(r.data?.message || 'Failed', 'err');
}

// ── CHANGE USERNAME ────────────────────────────────────
function openChangeUsername() {
  openM('Change Username', `
    <p class="form-note">You'll receive an OTP to confirm the change.</p>
    <div class="field"><label>New Username</label><div class="finput"><input id="cu-un" type="text" placeholder="new_username"/></div></div>
    <div class="field"><label>Password</label><div class="finput"><input id="cu-pw" type="password" placeholder="••••••••"/></div></div>
    <button class="btn-prim" onclick="reqUnChange()">Send OTP</button>
    <div id="cuMsg" style="margin-top:10px;font-size:13px"></div>
  `);
}
async function reqUnChange() {
  const newUsername = document.getElementById('cu-un')?.value.trim();
  const password    = document.getElementById('cu-pw')?.value;
  const r           = await API.reqUsernameChange({ newUsername, password });
  const msg         = document.getElementById('cuMsg'); if (!msg) return;
  if (r.ok) {
    msg.innerHTML = `
      <p style="color:var(--green);margin-bottom:10px">✓ OTP sent to your email</p>
      <div class="field"><label>OTP</label><div class="finput"><input id="cu-otp" type="text" maxlength="6" placeholder="123456"/></div></div>
      <button class="btn-prim" onclick="confirmUnChange()">Confirm Change</button>`;
  } else msg.innerHTML = `<p style="color:var(--red)">${r.data?.message || 'Failed'}</p>`;
}
async function confirmUnChange() {
  const otp = (document.getElementById('cu-otp')?.value || '').trim();
  const r   = await API.changeUsername({ otp });
  if (r.ok) {
    toast('Username changed!', 'ok'); closeM();
    const vr = await API.verifyToken();
    if (vr.ok && vr.data.user) { APP.me = vr.data.user; refreshUserUI(); }
  } else toast(r.data?.message || 'Failed', 'err');
}

// ── TWO FACTOR AUTH ────────────────────────────────────
async function toggleTwoFA() {
  const enable = confirm('Toggle Two-Factor Authentication?\n\nOK = Enable | Cancel = Disable');
  const r      = await API.toggle2FA({ enable });
  toast(r.ok ? `2FA ${enable ? 'enabled ✓' : 'disabled'}` : (r.data?.message || 'Failed'), r.ok ? 'ok' : 'err');
  document.getElementById('twoFaStatus').textContent = enable ? 'Enabled' : 'Disabled';
}

// ── SUBSCRIPTION ──────────────────────────────────────
async function loadSubStatus() {
  const r = await API.getSubStatus();
  if (!r.ok) return;
  const raw = r.data;
  const sub = (raw.subscription && typeof raw.subscription === 'object') ? raw.subscription : raw;
  APP.subStatus = sub;

  const plan      = (sub.plan || sub.planType || 'free').toLowerCase();
  const status    = (sub.status || 'none').toLowerCase();
  const planLabel = (plan === 'none' || plan === 'free') ? 'Free' : plan.charAt(0).toUpperCase() + plan.slice(1);

  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('sbPlan',            planLabel + ' Plan');
  setTxt('subPlanName',       planLabel + ' Plan');
  setTxt('cancelResumeLabel', status === 'active' ? 'Cancel Subscription' : 'Resume Subscription');
  setTxt('subPlanDesc',       status === 'active' ? 'Active subscription' : status === 'none' ? 'No active subscription' : 'Inactive');

  const badge = document.getElementById('subBadge');
  if (badge) {
    badge.textContent = planLabel.toUpperCase();
    badge.className   = `sub-badge ${plan !== 'free' && plan !== 'none' ? plan : ''}`;
  }
}

async function openPlans() {
  openM('Choose a Plan', `<div class="list-spin"><div class="spin"></div></div>`);
  let plans = [];
  const r   = await API.getPlans();
  if (r.ok) plans = r.data.plans || r.data || [];
  if (!Array.isArray(plans) || !plans.length) plans = defaultPlans();

  const sub = APP.subStatus || {};
  const cur = (sub.plan || sub.planType || 'free').toLowerCase();

  const mBody = document.getElementById('mBody');
  if (!mBody) return;

  mBody.innerHTML = `<div class="plans-grid">${plans.map(p => {
    const name      = p.name || p.planType || p.type || 'Plan';
    const nameLower = name.toLowerCase();
    const price     = p.price != null
      ? `$${p.price}<span>/mo</span>`
      : (nameLower === 'free' || nameLower === 'none' ? 'Free' : '—');
    const features  = Array.isArray(p.features) && p.features.length ? p.features : defaultFeaturesFor(nameLower);
    const isCur     = cur === nameLower || cur === p.id;
    const popular   = nameLower === 'premium' || nameLower === 'pro';
    return `<div class="plan-card${isCur ? ' current' : ''}${popular ? ' popular' : ''}">
      ${popular ? '<div class="plan-popular-tag">Most Popular</div>' : ''}
      <div class="plan-name">${esc(name)}</div>
      <div class="plan-price">${price}</div>
      <ul class="plan-features">${features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      ${isCur
        ? `<div class="plan-current-tag">✓ Current Plan</div>`
        : `<button class="btn-prim plan-sub-btn" onclick="subscribeToPlan('${nameLower}')">Get ${esc(name)}</button>`}
    </div>`;
  }).join('')}</div>`;
}

function defaultPlans() {
  return [
    { name: 'Free',  price: 0,    features: defaultFeaturesFor('free') },
    { name: 'Basic', price: 4.99, features: defaultFeaturesFor('basic') },
    { name: 'Pro',   price: 9.99, features: defaultFeaturesFor('pro') },
  ];
}
function defaultFeaturesFor(plan) {
  return ({
    free:    ['Messaging', 'Friend requests', 'Basic features'],
    basic:   ['Everything in Free', 'Voice messages', 'Profile customization', 'Priority support'],
    pro:     ['Everything in Basic', 'Group chats', 'Read receipts', 'Custom themes', 'No ads'],
    premium: ['Everything in Basic', 'Group chats', 'Read receipts', 'Custom themes', 'No ads'],
  })[plan] || ['All features included'];
}

async function subscribeToPlan(planType) {
  const sub          = APP.subStatus || {};
  const currentPlan  = (sub.plan || sub.planType || 'free').toLowerCase();
  const hasActiveSub = sub.status === 'active' && currentPlan !== 'free' && currentPlan !== 'none';

  if (hasActiveSub) {
    toast('Updating your plan…', 'info');
    const r = await API.updatePlan({ planType });
    if (r.ok) {
      toast('Plan updated successfully! ✓', 'ok');
      closeM();
      await loadSubStatus();
    } else {
      toast(r.data?.message || 'Failed to update plan', 'err');
    }
  } else {
    toast('Redirecting to checkout…', 'info');
    const r = await API.createCheckout({ planType });
    if (r.ok) {
      const url = r.data.url || r.data.checkoutUrl;
      if (url) { window.open(url, '_blank'); closeM(); }
      else { toast(r.data?.message || 'Checkout created', 'ok'); closeM(); }
    } else {
      toast(r.data?.message || 'Failed', 'err');
    }
  }
}

async function toggleSubscription() {
  const active = APP.subStatus?.status === 'active';
  if (active) {
    if (!confirm('Cancel your subscription? You can resume it later.')) return;
    const r = await API.cancelSub();
    toast(r.ok ? 'Subscription cancelled' : (r.data?.message || 'Failed'), r.ok ? 'ok' : 'err');
  } else {
    const r = await API.resumeSub();
    toast(r.ok ? 'Subscription resumed!' : (r.data?.message || 'Failed'), r.ok ? 'ok' : 'err');
  }
  await loadSubStatus();
}

async function openBillingPortal() {
  toast('Opening billing portal…', 'info');
  const r = await API.openPortal();
  if (r.ok) {
    const url = r.data.url || r.data.portalUrl;
    if (url) window.open(url, '_blank');
    else toast('Portal opened', 'ok');
  } else toast(r.data?.message || 'Failed', 'err');
}

// ── PUSH NOTIFICATIONS ────────────────────────────────
async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast('Push notifications not supported', 'err'); return;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Permission denied', 'err'); return; }
    const vr       = await API.getVapidKey();
    const vapidKey = vr.data.publicKey || vr.data.vapidPublicKey || vr.data.key;
    if (!vapidKey) {
      toast('Push configured ✓', 'ok');
      document.getElementById('pushStatus').textContent = 'Enabled'; return;
    }
    const reg = await navigator.serviceWorker.register('sw.js').catch(() => null);
    if (!reg) {
      toast('Push notifications enabled (basic)', 'ok');
      document.getElementById('pushStatus').textContent = 'Enabled'; return;
    }
    const sub  = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
    const sr   = await API.subscribePush({ subscription: sub.toJSON() });
    if (sr.ok) {
      toast('Push notifications enabled! 🔔', 'ok');
      document.getElementById('pushStatus').textContent = 'Enabled';
    } else toast(sr.data?.message || 'Subscribe failed', 'err');
  } catch (e) { toast('Could not enable push notifications', 'err'); }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── GROUP CHAT ────────────────────────────────────────
function openGroupCreate() {
  closeDrawer();
  openM('Create Group Chat', `
    <div class="field"><label>Group Name</label>
      <div class="finput"><input id="gc-name" type="text" placeholder="My Group"/></div>
    </div>
    <div class="field"><label>Add Friends</label>
      <div id="gcFriendList" style="max-height:200px;overflow-y:auto;margin-top:4px">${renderGcFriends()}</div>
    </div>
    <button class="btn-prim" onclick="doCreateGroup()">Create Group</button>
  `);
}

function renderGcFriends() {
  if (!APP.friends.length) return '<div class="empty-list" style="padding:12px">Add friends first</div>';
  return APP.friends.map(f => {
    const u    = f.user || f;
    const name = u.name || u.username || 'Friend';
    return `<label style="display:flex;align-items:center;gap:8px;padding:7px 4px;cursor:pointer;border-radius:7px;transition:background .15s"
        onmouseenter="this.style.background='var(--bgh)'" onmouseleave="this.style.background=''">
      <input type="checkbox" value="${u._id}" style="width:auto;accent-color:var(--acc)"/>
      ${makeAv(u, 'xs', false)}
      <span style="font-size:13px;font-weight:500">${esc(name)}</span>
    </label>`;
  }).join('');
}

async function doCreateGroup() {
  const name    = document.getElementById('gc-name')?.value.trim();
  if (!name) return toast('Enter group name', 'err');
  const checked = [...document.querySelectorAll('#gcFriendList input[type=checkbox]:checked')].map(c => c.value);
  const r       = await API.createGroup({ name, participants: checked });
  if (r.ok) { toast('Group created! 🎉', 'ok'); closeM(); await loadChats(); }
  else toast(r.data?.message || 'Failed', 'err');
}

// ── VOICE RECORDING ───────────────────────────────────
let _mediaRecorder = null;
let _audioChunks   = [];
let _recTimer      = null;
let _recSeconds    = 0;

function isMobileView() { return window.innerWidth <= 720; }

async function toggleMic() {
  if (_mediaRecorder && _mediaRecorder.state === 'recording') stopAndSendRecording();
  else await startRecording();
}

async function startRecording() {
  toast('Audio recording feature is currently in testing and may not work perfectly. Please try again later.', 'info');
  return;
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Microphone not supported', 'err'); return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _audioChunks   = [];
    _mediaRecorder = new MediaRecorder(stream);

    _mediaRecorder.ondataavailable = e => { if (e.data.size) _audioChunks.push(e.data); };
    _mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      hideRecBar();
      const blob = new Blob(_audioChunks, { type: 'audio/webm' });
      await uploadAudio(blob);
    };

    _mediaRecorder.start(250);
    _recSeconds = 0;
    showRecBar();
    _recTimer = setInterval(() => {
      _recSeconds++;
      const el = document.getElementById('recTime');
      if (el) {
        const m = Math.floor(_recSeconds / 60);
        const s = String(_recSeconds % 60).padStart(2, '0');
        el.textContent = `${m}:${s}`;
      }
    }, 1000);
  } catch (e) {
    toast('Microphone permission denied', 'err');
  }
}

function stopAndSendRecording() {
  if (_mediaRecorder && _mediaRecorder.state === 'recording') _mediaRecorder.stop();
  clearInterval(_recTimer);
}

function cancelRecording() {
  clearInterval(_recTimer);
  if (_mediaRecorder) {
    _mediaRecorder.onstop = () => {
      const stream = _mediaRecorder?.stream;
      stream?.getTracks().forEach(t => t.stop());
    };
    if (_mediaRecorder.state === 'recording') _mediaRecorder.stop();
    _mediaRecorder = null;
  }
  _audioChunks = [];
  hideRecBar();
  toast('Recording cancelled');
}

function showRecBar() {
  const bar = document.getElementById('recBar');
  const inp = document.getElementById('inputBar');
  const mic = document.getElementById('micBtn');
  if (bar) bar.classList.remove('hidden');
  if (inp) inp.classList.add('hidden');
  if (mic) mic.classList.add('recording');
}

function hideRecBar() {
  const bar = document.getElementById('recBar');
  const inp = document.getElementById('inputBar');
  const mic = document.getElementById('micBtn');
  if (bar) bar.classList.add('hidden');
  if (inp) inp.classList.remove('hidden');
  if (mic) mic.classList.remove('recording');
  const el = document.getElementById('recTime');
  if (el) el.textContent = '0:00';
  _recSeconds    = 0;
  _mediaRecorder = null;
  _audioChunks   = [];
}

async function uploadAudio(blob) {
  if (!APP.currentChatId) { toast('No chat selected', 'err'); return; }
  if (!blob || blob.size === 0) { toast('Recording was empty, please try again', 'err'); return; }

  const fd = new FormData();
  fd.append('audio', blob, 'voice.webm');
  const uploadRes = await API.voicemessage(fd);

  if (!uploadRes.ok) { toast(uploadRes.data?.message || 'Failed to upload audio', 'err'); return; }

  const audioUrl = uploadRes.data.url;
  const msgRes   = await API.sendAudioMessage({ chatId: APP.currentChatId, type: 'audio', audioUrl, content: '🎤 Voice message' });

  if (msgRes.ok) { APP._lastIds.clear(); await loadMessages(); loadChats(); }
  else toast(msgRes.data?.message || 'Failed to send audio message', 'err');
}

// ── LOGOUT ────────────────────────────────────────────
async function doLogout() {
  disconnectWS();
  await API.logout();
  try { localStorage.removeItem('cba_token'); } catch (e) {}
  API.set(null);
  clearInterval(APP.pollTimer);
  closeDrawer();
  APP._unreadCounts = {};
  APP._totalUnread  = 0;
  document.title    = 'Chat App';
  document.getElementById('app').classList.add('hidden');
  document.getElementById('fab').classList.add('hidden');
  document.getElementById('authWrap').classList.remove('hidden');
  S('sLogin');
}

// ── MODAL ─────────────────────────────────────────────
function openM(title, body) {
  document.getElementById('mTitle').textContent = title;
  document.getElementById('mBody').innerHTML    = body;
  document.getElementById('mWrap').classList.remove('hidden');
}
function closeM()    { document.getElementById('mWrap').classList.add('hidden'); }
function mOutside(e) { if (e.target.id === 'mWrap') closeM(); }

// ── HELPERS ───────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(d) {
  if (!d) return 'Today';
  const date = new Date(d), today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const yd = new Date(); yd.setDate(today.getDate() - 1);
  if (date.toDateString() === yd.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
const COLORS = ['#4facfe','#00c9ff','#43e97b','#fa709a','#f7971e','#a18cd1','#ffecd2','#4ecdc4','#45b7d1','#96e6a1'];
function ac(s = '') {
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

