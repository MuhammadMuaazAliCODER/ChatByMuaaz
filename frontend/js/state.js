// ===== STATE MODULE =====
const STATE = {
  token: null,
  userId: null,
  user: null,
  currentChatId: null,
  currentChatName: null,
  pending2FAUserId: null,
  pendingVerifyEmail: null,
  logCollapsed: false,

  setToken(token) {
    this.token = token;
    try { localStorage.setItem('cba_token', token); } catch(e) {}
    // update footer badge
    const badge = document.getElementById('footerToken');
    if (badge) badge.textContent = token ? token.substring(0,20)+'...' : 'No token';
  },

  setUser(user) {
    this.user = user;
    if (user?._id) this.userId = user._id;
    const nameEl = document.getElementById('footerName');
    const avatarEl = document.getElementById('footerAvatar');
    if (nameEl) nameEl.textContent = user?.name || user?.username || 'User';
    if (avatarEl) avatarEl.textContent = (user?.name || user?.username || '?')[0].toUpperCase();
  },

  loadPersisted() {
    try {
      const t = localStorage.getItem('cba_token');
      if (t) { this.token = t; this.setToken(t); }
    } catch(e) {}
  },

  clear() {
    this.token = null;
    this.userId = null;
    this.user = null;
    this.currentChatId = null;
    try { localStorage.removeItem('cba_token'); } catch(e) {}
  }
};
