// ── API MODULE ───────────────────────────────────────
const API = (() => {
  let _tok = null;
  const set = t => { _tok = t; };
  const get = () => _tok;

  async function r(method, path, body = null, isForm = false) {
    const h = {};
    if (_tok) h['Authorization'] = `Bearer ${_tok}`;
    if (!isForm && body) h['Content-Type'] = 'application/json';
    const opts = { method, headers: h };
    if (body) opts.body = isForm ? body : JSON.stringify(body);
    try {
      const res = await fetch(BASE_URL + path, opts);
      let data;
      try { data = await res.json(); } catch { data = {}; }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { message: 'Network error. Is the backend running?' } };
    }
  }

  return {
    set, get,
    get_:   p     => r('GET',    p),
    post:   (p,b) => r('POST',   p, b),
    put:    (p,b) => r('PUT',    p, b),
    patch:  (p,b) => r('PATCH',  p, b),
    del:    p     => r('DELETE', p),
    form:   (p,b) => r('PUT',    p, b, true),

    // Auth
    register:             b => r('POST', '/auth/register', b),
    verifyEmail:          b => r('POST', '/auth/verify-email', b),
    resendVerification:   b => r('POST', '/auth/resend-verification', b),
    login:                b => r('POST', '/auth/login', b),
    verify2FA:            b => r('POST', '/auth/verify-2fa', b),
    toggle2FA:            b => r('PUT',  '/auth/toggle-2fa', b),
    forgotPassword:       b => r('POST', '/auth/forgot-password', b),
    resetPassword:        b => r('POST', '/auth/reset-password', b),
    reqPasswordChange:    b => r('POST', '/auth/request-password-change', b),
    changePassword:       b => r('PUT',  '/auth/change-password', b),
    reqUsernameChange:    b => r('POST', '/auth/request-username-change', b),
    changeUsername:       b => r('PUT',  '/auth/change-username', b),
    updateProfile:        b => r('PUT',  '/auth/update-profile', b, true),
    verifyToken:          () => r('GET',  '/auth/verify'),
    logout:               () => r('POST', '/auth/logout'),

    // Users & Friends
    getUsers:             () => r('GET', '/users'),
    searchUsers:          q  => r('GET', `/users/search?query=${encodeURIComponent(q)}`),
    sendFriendReq:        b  => r('POST', '/friend/send', b),
    getIncomingReqs:      () => r('GET',  '/friend/incoming'),
    respondReq:           b  => r('POST', '/friend/respond', b),
    getMyFriends:         () => r('GET',  '/friends'),

    // Chats
    getChats:             () => r('GET',  '/chats'),
    createDirect:         b  => r('POST', '/chats/direct', b),
    createGroup:          b  => r('POST', '/chats/group', b),

    // Messages
    getMessages:          (id, pg=1) => r('GET', `/messages/${id}?page=${pg}&limit=50`),
    sendMessage:          b          => r('POST', '/messages', b),
    editMessage:          (id, b)    => r('PUT',  `/messages/${id}`, b),   // ← NEW
    deleteMsg:            id         => r('DELETE', `/messages/${id}`),
    markRead:             id         => r('PUT',  `/messages/${id}/read`),
    markAllRead:          id         => r('PUT',  `/messages/chat/${id}/read`),
    voicemessage:         fd         => r('POST', '/upload/audio', fd, true),
    sendAudioMessage:     b          => r('POST', '/messages', b),

    // Push
    getVapidKey:          () => r('GET',  '/push/vapid-public-key'),
    subscribePush:        b  => r('POST', '/push/subscribe', b),
    unsubscribePush:      b  => r('POST', '/push/unsubscribe', b),

    // Subscription
    getPlans:             () => r('GET',  '/subscription/plans'),
    getSubStatus:         () => r('GET',  '/subscription/status'),
    createCheckout:       b  => r('POST', '/subscription/checkout', b),
    updatePlan:           b  => r('PATCH','/subscription/update-plan', b),
    cancelSub:            () => r('POST', '/subscription/cancel'),
    resumeSub:            () => r('POST', '/subscription/resume'),
    openPortal:           () => r('POST', '/subscription/portal'),
  };
})();