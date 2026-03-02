# ChatByMuaaz — Developer Test Console

A professional Telegram-style frontend for testing the ChatByMuaaz API.

## 🚀 Quick Start

1. **Start your backend** at `http://localhost:5300/api`
2. **Open `index.html`** in your browser (double-click or use a local server)
3. **Register or Login** using the auth screen
4. Start chatting!

## 📁 File Structure

```
chatbymuaaz/
├── index.html          # Main app shell
├── css/
│   └── style.css       # Telegram-style dark theme
└── js/
    ├── api.js          # All API calls (mirrors your Postman collection)
    ├── state.js        # App state management
    ├── ui.js           # UI rendering helpers
    └── app.js          # Main logic & event handlers
```

## ✨ Features

### Auth
- Register with name, username, email, password
- Email OTP verification
- Login with 2FA support
- Forgot / Reset password
- Change password & username (OTP-verified)
- Toggle 2FA

### Chats & Messaging
- View all chats in a Telegram-style sidebar
- Open direct or group chats
- Send text and audio messages
- Mark messages as read / delivered
- Delete messages
- Mark all chat messages as read

### Friends
- Send friend requests by username
- View & respond to incoming requests (accept/reject)
- View friends list & start chats instantly

### Users
- Browse all users
- Search users by name/username
- One-click create direct chat

### Tools Panel
- Account management (verify token, logout, toggle 2FA)
- Password & username change flows
- Push notification management (VAPID, subscribe/unsubscribe, test)
- Subscription management (plans, status, checkout, cancel, resume, billing portal)
- Health check

### Developer UX
- **API Response Log** at the bottom — every request logged with method, URL, status, response time & body
- Collapsible log panel
- Toast notifications for all actions
- Persisted JWT token in localStorage
- Configurable Base URL field

## 🛠 Running with a Local Server (optional)

```bash
# Python
python3 -m http.server 3000

# Node.js
npx serve .

# Then open: http://localhost:3000
```

## 🎨 Design

- Dark Telegram-inspired theme
- Responsive (mobile-friendly with sidebar drawer)
- Sora + JetBrains Mono fonts
- Smooth animations & micro-interactions
- Real-time API response logging
