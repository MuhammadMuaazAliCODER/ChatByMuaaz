// ===== UI MODULE =====
const UI = {
  // TOAST
  toast(msg, type = 'info', duration = 3000) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast ${type} show`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.classList.remove('show'); }, duration);
  },

  // LOG
  logResponse(method, url, status, data, elapsed) {
    const logBody = document.getElementById('logBody');
    if (!logBody) return;
    const ok = status >= 200 && status < 300;
    const entry = document.createElement('div');
    entry.className = `log-entry ${ok ? 'success' : status === 0 ? 'error' : 'error'}`;
    const path = url.replace(/https?:\/\/[^/]+/, '');
    entry.innerHTML = `
      <div class="log-entry-header">
        <span class="log-method">${method}</span>
        <span class="log-url" title="${path}">${path}</span>
        <span class="log-status ${ok ? 'ok' : 'err'}">${status || 'ERR'}</span>
        <span class="log-time">${elapsed}ms</span>
      </div>
      <div class="log-data">${JSON.stringify(data, null, 1)}</div>
    `;
    logBody.prepend(entry);
  },

  // AUTH MSG
  setAuthMsg(msg, type = '') {
    const el = document.getElementById('authMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = `auth-msg ${type}`;
  },

  // SWITCH AUTH TAB
  switchAuthTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.classList.add('active');
  },

  // AVATAR LETTER
  avatarLetter(name) {
    return (name || '?')[0].toUpperCase();
  },

  // AVATAR COLOR
  avatarColor(str = '') {
    const colors = ['#2aabee','#229ed9','#6c63ff','#e91e8c','#f7c455','#4caf8a','#ff6b6b'];
    let hash = 0;
    for (let c of str) hash = (hash * 31 + c.charCodeAt(0)) % colors.length;
    return colors[Math.abs(hash) % colors.length];
  },

  // RENDER AVATAR
  makeAvatar(name, size = '') {
    const letter = this.avatarLetter(name);
    const color = this.avatarColor(name);
    return `<div class="avatar ${size}" style="background:${color}">${letter}</div>`;
  },

  // MODAL
  openModal(title, bodyHTML, footerHTML = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('modalFooter').innerHTML = footerHTML;
    document.getElementById('modal').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal').classList.add('hidden');
  },

  // FORMAT TIME
  formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString();
  },

  // RENDER CHATS LIST
  renderChats(chats) {
    const el = document.getElementById('chatsList');
    if (!chats || !chats.length) { el.innerHTML = '<div class="empty-state">No chats yet</div>'; return; }
    el.innerHTML = chats.map(chat => {
      const name = chat.name || (chat.participants?.map(p => p.username || p.name).join(', ') ?? 'Chat');
      const lastMsg = chat.lastMessage?.content || '—';
      const time = chat.lastMessage?.createdAt ? this.formatTime(chat.lastMessage.createdAt) : '';
      return `
        <div class="chat-item" onclick="openChat('${chat._id}', '${this.esc(name)}', '${chat.type || 'direct'}')" data-id="${chat._id}">
          ${this.makeAvatar(name)}
          <div class="chat-item-info">
            <div class="chat-item-name">${this.esc(name)}</div>
            <div class="chat-item-preview">${this.esc(lastMsg)}</div>
          </div>
          <div class="chat-item-meta">
            <span class="chat-item-time">${time}</span>
          </div>
        </div>`;
    }).join('');
  },

  // RENDER MESSAGES
  renderMessages(messages) {
    const area = document.getElementById('messagesArea');
    if (!messages || !messages.length) {
      area.innerHTML = '<div class="empty-state center">No messages yet. Send one!</div>';
      return;
    }

    let html = '';
    let lastDate = null;

    messages.forEach(msg => {
      const dateStr = this.formatDate(msg.createdAt);
      if (dateStr !== lastDate) {
        html += `<div class="date-divider">${dateStr}</div>`;
        lastDate = dateStr;
      }
      const isOut = msg.sender?._id === STATE.userId || msg.sender === STATE.userId;
      const cls = isOut ? 'msg-out' : 'msg-in';
      const senderName = isOut ? '' : `<div class="msg-sender">${this.esc(msg.sender?.username || msg.sender?.name || 'User')}</div>`;
      const time = this.formatTime(msg.createdAt);
      const statusIcon = isOut ? (msg.readBy?.length ? '✓✓' : msg.deliveredTo?.length ? '✓✓' : '✓') : '';
      const statusClass = isOut && msg.readBy?.length ? 'read' : '';
      const audioPlayer = msg.type === 'audio' && msg.audioUrl ?
        `<audio controls src="${this.esc(msg.audioUrl)}" style="max-width:200px;margin-top:6px;border-radius:8px;height:36px;width:200px"></audio>` : '';
      html += `
        <div class="msg-bubble ${cls}" data-id="${msg._id}">
          ${senderName}
          <div>${this.esc(msg.content || '')}</div>
          ${audioPlayer}
          <div class="msg-meta">
            <span class="msg-time">${time}</span>
            <span class="msg-status ${statusClass}">${statusIcon}</span>
          </div>
          <div class="msg-actions">
            <button class="msg-action-btn" onclick="doMarkMsgRead('${msg._id}')">✓ Read</button>
            <button class="msg-action-btn" onclick="doDeleteMessage('${msg._id}')">🗑</button>
          </div>
        </div>`;
    });
    area.innerHTML = html;
    area.scrollTop = area.scrollHeight;
  },

  // RENDER USERS
  renderUsers(users) {
    const el = document.getElementById('usersList');
    if (!users || !users.length) { el.innerHTML = '<div class="empty-state">No users found</div>'; return; }
    el.innerHTML = users.map(u => `
      <div class="user-item" onclick="createDirectChatWith('${u._id}')">
        ${this.makeAvatar(u.name || u.username, 'sm')}
        <div class="chat-item-info">
          <div class="chat-item-name">${this.esc(u.name || u.username || 'User')}</div>
          <div class="chat-item-preview">@${this.esc(u.username || '')} · Click to chat</div>
        </div>
      </div>`).join('');
  },

  // RENDER FRIENDS
  renderFriends(friends) {
    const el = document.getElementById('friendsList');
    if (!friends || !friends.length) { el.innerHTML = '<div class="empty-state">No friends yet</div>'; return; }
    el.innerHTML = friends.map(f => {
      const u = f.user || f;
      return `
        <div class="user-item">
          ${this.makeAvatar(u.name || u.username, 'sm')}
          <div class="chat-item-info">
            <div class="chat-item-name">${this.esc(u.name || u.username || 'Friend')}</div>
            <div class="chat-item-preview">@${this.esc(u.username || '')}</div>
          </div>
          <button class="btn-sm" onclick="createDirectChatWith('${u._id}')">Chat</button>
        </div>`;
    }).join('');
  },

  // RENDER INCOMING REQUESTS
  renderIncomingRequests(requests) {
    const el = document.getElementById('friendsList');
    if (!requests || !requests.length) { el.innerHTML = '<div class="empty-state">No incoming requests</div>'; return; }
    el.innerHTML = `<div style="padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Incoming Requests</div>` + 
      requests.map(r => {
        const u = r.sender || r;
        return `
          <div class="friend-request-item">
            ${this.makeAvatar(u.name || u.username, 'sm')}
            <div class="chat-item-info">
              <div class="chat-item-name">${this.esc(u.name || u.username || 'User')}</div>
            </div>
            <div class="friend-request-actions">
              <button class="btn-sm" onclick="respondRequest('${r._id}','accepted')">✓</button>
              <button class="btn-sm" style="color:var(--error)" onclick="respondRequest('${r._id}','rejected')">✕</button>
            </div>
          </div>`;
      }).join('');
  },

  // JSON PRETTY
  jsonView(data) {
    return `<div class="json-view">${JSON.stringify(data, null, 2)}</div>`;
  },

  // ESCAPE HTML
  esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
};
