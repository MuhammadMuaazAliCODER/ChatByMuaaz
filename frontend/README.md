# 💬 Modern ChatApp - Frontend Documentation

A modern, real-time chat application frontend built with pure HTML, CSS, and JavaScript. Features real-time messaging, voice notes, friend requests, dark/light mode, and more.

## ✨ Features

- 🔐 **User Authentication** - Secure login and registration
- 💬 **Real-time Messaging** - Instant message delivery via WebSocket
- 🎤 **Voice Messages** - Record and send voice notes
- 👥 **Friend System** - Send/receive friend requests before chatting
- ✓ **Verified Badges** - Special verification marks for verified users
- 🌓 **Dark/Light Mode** - Beautiful theme toggle with smooth transitions
- 📱 **Responsive Design** - Works perfectly on mobile and desktop
- 🗑️ **Auto-Delete** - Messages automatically delete after 7 days
- 😊 **Emoji Picker** - Quick emoji reactions
- 🔍 **Search** - Find users easily
- ⚡ **Real-time Updates** - Online status, typing indicators

## 📁 Project Structure

```
chatapp-frontend/
├── index.html              # Login/Register page
├── chat.html              # Main chat interface
├── css/
│   ├── style.css          # Common styles and variables
│   ├── auth.css           # Authentication page styles
│   └── chat.css           # Chat interface styles
├── js/
│   ├── config.js          # API configuration and utilities
│   ├── auth.js            # Authentication logic
│   ├── utils.js           # Utility functions
│   ├── websocket.js       # WebSocket connection manager
│   ├── friends.js         # Friend request management
│   └── chat.js            # Main chat functionality
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Backend server running on `http://localhost:5500`
- Node.js (for serving the frontend)

### Installation

1. **Clone or download this repository:**
```bash
git clone <your-repo-url>
cd chatapp-frontend
```

2. **No build process needed!** This is pure HTML/CSS/JS

3. **Serve the frontend:**

**Option 1: Using Python**
```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

**Option 2: Using Node.js http-server**
```bash
npm install -g http-server
http-server -p 8080
```

**Option 3: Using Live Server (VS Code)**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

**Option 4: Using PHP**
```bash
php -S localhost:8080
```

4. **Access the app:**
```
http://localhost:8080
```

## 🔧 Configuration

### Backend API Configuration

Edit `js/config.js` to change the backend URL:

```javascript
const API_URL = 'http://localhost:5500/api';
const WS_URL = 'ws://localhost:5500';
```

### Available Endpoints

The frontend connects to these backend endpoints:

**Authentication:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token

**Users:**
- `GET /api/users/search?query=` - Search users

**Chats:**
- `GET /api/chats` - Get user's chats
- `POST /api/chats/direct` - Create direct chat
- `POST /api/chats/group` - Create group chat

**Messages:**
- `GET /api/messages/:chatId` - Get chat messages
- `POST /api/messages` - Send text message
- `POST /api/messages/voice` - Send voice message

**Friends:**
- `POST /api/friends/send` - Send friend request
- `GET /api/friends/incoming` - Get incoming friend requests
- `POST /api/friends/respond` - Accept/reject friend request

## 📖 Usage Guide

### 1. Getting Started

**Register:**
1. Open the app in your browser
2. Click "Register"
3. Fill in your details (Name, Username, Email, Password)
4. Click "Register" button

**Login:**
1. Enter your username and password
2. Click "Sign In"

### 2. Friend System

**Send Friend Request:**
1. Click "Friends" tab in sidebar
2. Click "+ Add Friend" button
3. Search for a user by username
4. Click "Add Friend" next to their name

**Manage Friend Requests:**
1. Click the 👥 icon in the header (shows badge with count)
2. Accept or reject incoming requests
3. Once accepted, you can start chatting

### 3. Chatting

**Start a Conversation:**
1. Click "Chats" tab (or search for a user)
2. Click on a friend to open the chat
3. Type your message and press Enter or click Send

**Send Voice Message:**
1. Click the 🎤 microphone button
2. Speak your message
3. Click the ⏹️ button to stop and send

**Use Emojis:**
1. Click the 😊 emoji button
2. Select an emoji from the picker
3. It will be inserted into your message

### 4. Theme Toggle

- Click the 🌙/☀️ icon in the header
- Switch between dark and light modes
- Your preference is saved automatically

### 5. Search Users

1. Type in the search box at the top of the sidebar
2. Results appear as you type (minimum 2 characters)
3. Click on a user to start chatting

## 🎨 Customization

### Change Theme Colors

Edit `css/style.css`:

```css
:root {
    --accent: #3b82f6;        /* Primary color */
    --success: #10b981;       /* Success color */
    --danger: #ef4444;        /* Danger color */
    --online: #10b981;        /* Online indicator */
}
```

### Add More Emojis

Edit `js/chat.js`:

```javascript
const emojis = ['😊', '😂', '❤️', /* add more here */];
```

### Modify Message Limit

The message limit is controlled by the backend, but you can add client-side validation in `js/chat.js`:

```javascript
// In sendMessage function
if (text.length > 1000) {
    showToast('Message too long!', 'error');
    return;
}
```

## 🔒 Security Features

- JWT token authentication
- Automatic token refresh
- XSS protection via HTML escaping
- Secure WebSocket connection
- Input validation

## 📱 Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**Note:** Voice recording requires HTTPS in production (localhost works without HTTPS)

## 🐛 Troubleshooting

### Cannot Connect to Backend

**Problem:** "Failed to fetch" or connection errors

**Solution:**
1. Ensure backend is running on port 5500
2. Check `js/config.js` has correct API_URL
3. Check browser console for CORS errors
4. Verify backend CORS settings allow your frontend origin

### WebSocket Not Connecting

**Problem:** Real-time messages not working

**Solution:**
1. Check backend WebSocket server is running
2. Verify WS_URL in `js/config.js`
3. Check browser console for WebSocket errors
4. Ensure JWT token is valid (try logging out and in)

### Voice Recording Not Working

**Problem:** Microphone access denied or recording fails

**Solution:**
1. Grant microphone permissions in browser
2. Use HTTPS in production (HTTP works on localhost)
3. Check browser console for errors
4. Verify browser supports MediaRecorder API

### Messages Not Updating

**Problem:** Messages don't appear immediately

**Solution:**
1. Check WebSocket connection status
2. Refresh the page
3. Check browser console for errors
4. Verify backend is sending WebSocket events

### Dark Mode Not Working

**Problem:** Theme doesn't change

**Solution:**
1. Clear browser cache
2. Check localStorage is enabled
3. Try a hard refresh (Ctrl+Shift+R)

### Search Not Working

**Problem:** User search returns no results

**Solution:**
1. Ensure you type at least 2 characters
2. Check backend search endpoint is working
3. Verify API_URL in config.js
4. Check browser console for errors

## 🚀 Production Deployment

### 1. Update Configuration

Edit `js/config.js`:

```javascript
const API_URL = 'https://your-domain.com/api';
const WS_URL = 'wss://your-domain.com';
```

### 2. Enable HTTPS

- Get SSL certificate (Let's Encrypt, Cloudflare)
- Configure your web server (Nginx, Apache)
- Update WebSocket to use `wss://` instead of `ws://`

### 3. Optimize Assets

```bash
# Minify CSS
npm install -g clean-css-cli
cleancss -o css/style.min.css css/style.css

# Minify JavaScript
npm install -g terser
terser js/chat.js -o js/chat.min.js
```

### 4. Add Service Worker (PWA)

Create `sw.js`:

```javascript
const CACHE_NAME = 'chatapp-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/chat.html',
  '/css/style.css',
  '/js/chat.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});
```

### 5. Deploy to Hosting

**Netlify:**
```bash
npm install -g netlify-cli
netlify deploy
```

**Vercel:**
```bash
npm install -g vercel
vercel
```

**GitHub Pages:**
```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push origin main
```

## 🎯 Advanced Features

### Adding Push Notifications

1. Request notification permission in `js/chat.js`:
```javascript
if ('Notification' in window) {
    Notification.requestPermission();
}
```

2. Show notifications for new messages:
```javascript
new Notification('New Message', {
    body: message.text,
    icon: '/icon.png'
});
```

### Adding Message Reactions

1. Add reaction UI to messages
2. Create API endpoint for reactions
3. Update WebSocket to broadcast reactions

### Adding File Sharing

1. Add file input to chat interface
2. Create upload endpoint
3. Display file previews in messages

## 📄 License

MIT License - Feel free to use this project!

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 💡 Tips & Best Practices

1. **Always escape user input** - Prevents XSS attacks
2. **Handle errors gracefully** - Show user-friendly error messages
3. **Test on different browsers** - Ensure compatibility
4. **Use semantic HTML** - Improves accessibility
5. **Optimize images** - Faster load times
6. **Enable HTTPS** - Required for many browser features
7. **Monitor console** - Catch errors early

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section
2. Review browser console errors
3. Verify backend is running correctly
4. Check network tab in browser DevTools

## 🎉 Features Coming Soon

- [ ] Message editing
- [ ] Message deletion
- [ ] Read receipts
- [ ] Group chat creation
- [ ] File sharing
- [ ] Video calls
- [ ] Desktop notifications
- [ ] PWA support
- [ ] Multi-language support

---

**Built with ❤️ using pure HTML, CSS, and JavaScript**

**No frameworks. No build tools. Just clean, modern web development.**
