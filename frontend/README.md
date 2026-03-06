# Muaaz Chat — Full User App

A complete Telegram-inspired chat application.

## Setup

1. Start your backend at `http://localhost:5300/api`
2. Open `index.html` in your browser
3. Done! No build step needed.

**To change the backend URL:** edit `js/config.js`

## Features

### Auth
- Register with name, username, email, password
- Email OTP verification
- Login with optional 2FA
- Forgot password / reset via OTP

### Profile & Settings (gear icon)
- **Profile photo upload** — tap the camera icon on your avatar
- Edit display name
- Change password (OTP-verified)
- Change username (OTP-verified)
- Toggle 2FA on/off

### Messaging
- Direct and group chats
- Real-time auto-refresh (every 3s)
- Emoji picker
- **Voice messages** — tap the mic button to record, tap again to send
- Delete messages
- Read receipts (✓✓)
- Message timestamps and date separators

### Friends
- Search users and add as friends
- Accept/decline incoming requests
- Badge count for pending requests
- One-click message from friends list

### Subscription
- View all available plans
- Subscribe / upgrade via Stripe checkout
- Cancel or resume subscription
- Open billing portal
- Live subscription status in sidebar

### Push Notifications
- Enable browser push notifications
- Uses your backend's VAPID key

## Files
```
chatbymuaaz/
├── index.html
├── js/
│   ├── config.js   ← Set BASE_URL here
│   ├── api.js      ← All API calls
│   ├── auth.js     ← Login/register/OTP flows
│   ├── voice.js    ← Voice recording
│   └── app.js      ← Main app logic
└── css/
    └── style.css
```
