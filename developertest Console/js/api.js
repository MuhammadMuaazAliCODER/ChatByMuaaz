// ===== API MODULE =====

const API = {
  async request(method, endpoint, body = null, isFormData = false) {
    const baseUrl = document.getElementById('baseUrl')?.value || 'http://localhost:5300/api';
    const url = `${baseUrl}${endpoint}`;
    const token = STATE.token;

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const options = { method, headers };
    if (body) options.body = isFormData ? body : JSON.stringify(body);

    const startTime = Date.now();
    let status = null;
    let responseData = null;

    try {
      const res = await fetch(url, options);
      status = res.status;
      try { responseData = await res.json(); } catch { responseData = { raw: await res.text() }; }
      const elapsed = Date.now() - startTime;
      UI.logResponse(method, url, status, responseData, elapsed);
      return { ok: res.ok, status, data: responseData };
    } catch (err) {
      const elapsed = Date.now() - startTime;
      responseData = { error: err.message };
      UI.logResponse(method, url, 0, responseData, elapsed);
      return { ok: false, status: 0, data: responseData };
    }
  },

  get:    (ep)       => API.request('GET',    ep),
  post:   (ep, body) => API.request('POST',   ep, body),
  put:    (ep, body) => API.request('PUT',    ep, body),
  patch:  (ep, body) => API.request('PATCH',  ep, body),
  delete: (ep)       => API.request('DELETE', ep),

  // AUTH
  register:               (d) => API.post('/auth/register', d),
  verifyEmail:            (d) => API.post('/auth/verify-email', d),
  resendVerification:     (d) => API.post('/auth/resend-verification', d),
  login:                  (d) => API.post('/auth/login', d),
  verify2FA:              (d) => API.post('/auth/verify-2fa', d),
  toggle2FA:              (d) => API.put('/auth/toggle-2fa', d),
  forgotPassword:         (d) => API.post('/auth/forgot-password', d),
  resetPassword:          (d) => API.post('/auth/reset-password', d),
  requestPasswordChange:  (d) => API.post('/auth/request-password-change', d),
  changePassword:         (d) => API.put('/auth/change-password', d),
  requestUsernameChange:  (d) => API.post('/auth/request-username-change', d),
  changeUsername:         (d) => API.put('/auth/change-username', d),
  updateProfile:          (fd) => API.request('PUT', '/auth/update-profile', fd, true),
  verifyToken:            ()  => API.get('/auth/verify'),
  logout:                 ()  => API.post('/auth/logout'),

  // EMAIL OTP
  sendOtp:   (d) => API.post('/email/send-otp', d),
  verifyOtp: (d) => API.post('/email/verifyOtp', d),

  // USERS
  getUsers:   ()    => API.get('/users'),
  searchUsers:(q)   => API.get(`/users/search?query=${encodeURIComponent(q)}`),

  // FRIENDS
  sendFriendRequest: (d)  => API.post('/friend/send', d),
  getIncomingRequests: () => API.get('/friend/incoming'),
  respondRequest:  (d)    => API.post('/friend/respond', d),
  getMyFriends:    ()     => API.get('/friends/friends'),

  // CHATS
  getChats:       ()    => API.get('/chats'),
  createDirectChat:(d)  => API.post('/chats/direct', d),
  createGroupChat: (d)  => API.post('/chats/group', d),

  // MESSAGES
  sendMessage:     (d)  => API.post('/messages', d),
  getMessages:     (chatId, page=1, limit=50) => API.get(`/messages/${chatId}?page=${page}&limit=${limit}`),
  markDelivered:   (id) => API.put(`/messages/${id}/delivered`),
  markRead:        (id) => API.put(`/messages/${id}/read`),
  markAllRead:     (chatId) => API.put(`/messages/chat/${chatId}/read`),
  deleteMessage:   (id) => API.delete(`/messages/${id}`),

  // PUSH
  getVapidKey:      () => API.get('/push/vapid-public-key'),
  subscribePush:    (d) => API.post('/push/subscribe', d),
  unsubscribePush:  (d) => API.post('/push/unsubscribe', d),
  getSubscriptions: () => API.get('/push/subscriptions'),
  testNotification: () => API.post('/push/test'),

  // SUBSCRIPTION
  getPlans:           () => API.get('/subscription/plans'),
  getSubStatus:       () => API.get('/subscription/status'),
  createCheckout:     (d) => API.post('/subscription/checkout', d),
  updatePlan:         (d) => API.patch('/subscription/update-plan', d),
  cancelSub:          () => API.post('/subscription/cancel'),
  resumeSub:          () => API.post('/subscription/resume'),
  openPortal:         () => API.post('/subscription/portal'),

  // HEALTH
  health: () => API.get('/health'),
};
