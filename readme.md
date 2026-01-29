# 💬 Modern ChatApp - Full Stack Setup Guide

A modern, real-time chat application with voice messaging, dark/light mode, and auto-deleting messages.

## ✨ Features

- 🔐 **User Authentication** - Register, login, logout with JWT
- 💬 **Real-time Messaging** - Instant message delivery via WebSocket
- 🎤 **Voice Messages** - Record and send voice notes
- 👥 **Group Chats** - Create and manage group conversations
- ✓ **Verified Badges** - Special verification marks for specific users
- 🌓 **Dark/Light Mode** - Beautiful theme toggle with smooth transitions
- 📱 **Responsive Design** - Works perfectly on mobile and desktop
- 🗑️ **Auto-Delete** - Messages automatically delete after 7 days
- 😊 **Emoji Picker** - Quick emoji reactions
- 🔍 **Search** - Find chats and users easily
- ⚡ **Real-time Updates** - Online status, typing indicators

## 🚀 Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or cloud instance)
- Modern web browser

### Backend Setup

1. **Create project directory:**
```bash
mkdir chatapp
cd chatapp
mkdir backend
cd backend
```

2. **Initialize Node.js project:**
```bash
npm init -y
```

3. **Install dependencies:**
```bash
npm install express mongoose cors jsonwebtoken bcryptjs multer ws node-cron
npm install --save-dev nodemon
```

4. **Create uploads directory:**
```bash
mkdir -p uploads/voice
```

5. **Create server.js file:**
- Copy the backend code from the artifact into `server.js`

6. **Update package.json:**
- Add the scripts from the package.json artifact

7. **Start MongoDB:**
```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas (cloud) and update connection string in server.js
```

8. **Start the backend server:**
```bash
npm run dev
```

Server will run on `http://localhost:3000`

### Frontend Setup

1. **Create frontend directory:**
```bash
cd ..
mkdir frontend
cd frontend
```

2. **Create index.html:**
- Copy the HTML code from the frontend artifact into `index.html`

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
- Install Live Server extension
- Right-click index.html → "Open with Live Server"

4. **Access the app:**
Open `http://localhost:8080` in your browser

## 🔧 Configuration

### Backend Configuration (server.js)

**MongoDB Connection:**
```javascript
mongoose.connect('mongodb://localhost:27017/chatapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
```

**JWT Secret (IMPORTANT - Change in Production):**
```javascript
const JWT_SECRET = 'your_super_secret_jwt_key_change_in_production';
```

**Verified Users:**
To manually verify a user, update the database:
```javascript
// In MongoDB shell or use API endpoint
db.users.updateOne(
    { username: "desired_username" },
    { $set: { verified: true } }
)
```

### Frontend Configuration (index.html)

**API URL:**
```javascript
const API_URL = 'http://localhost:3000/api';
```

**WebSocket URL:**
```javascript
ws = new WebSocket(`ws://localhost:3000?token=${token}`);
```

## 📝 Usage

### 1. Register a New Account
- Open the app
- Click "Register"
- Fill in: Name, Username, Email, Password
- Click "Register"

### 2. Login
- Enter username and password
- Click "Sign In"

### 3. Start Chatting
- Search for users
- Click on a user to start a chat
- Type a message and press Enter or click Send
- Click 🎤 to record a voice message

### 4. Create Group Chat
- Click the + button (you'll need to implement the UI button)
- Select multiple users
- Give the group a name

### 5. Toggle Theme
- Click the theme toggle (🌙/☀️) in the header

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token

### Chats
- `GET /api/chats` - Get user's chats
- `POST /api/chats/direct` - Create direct chat
- `POST /api/chats/group` - Create group chat

### Messages
- `GET /api/messages/:chatId` - Get chat messages
- `POST /api/messages` - Send text message
- `POST /api/messages/voice` - Send voice message

### Users
- `GET /api/users/search?query=` - Search users
- `POST /api/users/verify/:userId` - Verify user (admin)

## 🔒 Security Notes

**For Production Deployment:**

1. **Change JWT Secret:**
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
```

2. **Use Environment Variables:**
```javascript
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 3000;
```

3. **Enable HTTPS:**
- Use SSL/TLS certificates
- Update WebSocket to use `wss://` instead of `ws://`

4. **Add Rate Limiting:**
```bash
npm install express-rate-limit
```

5. **Validate Input:**
```bash
npm install express-validator
```

6. **Set CORS properly:**
```javascript
app.use(cors({
    origin: 'https://yourdomain.com',
    credentials: true
}));
```

## 🐛 Troubleshooting

**MongoDB Connection Error:**
- Ensure MongoDB is running: `mongod`
- Check connection string in server.js

**Port Already in Use:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Voice Recording Not Working:**
- Ensure HTTPS (browsers require secure context)
- Grant microphone permissions
- Check browser compatibility

**WebSocket Connection Failed:**
- Check if backend is running
- Verify WebSocket URL in frontend
- Check for CORS issues

## 📱 Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Note:** Voice recording requires HTTPS in production (not needed for localhost)

## 🎨 Customization

### Change Theme Colors:
Edit CSS variables in the frontend:
```css
:root {
    --accent: #3b82f6; /* Primary color */
    --online: #10b981; /* Online indicator */
}
```

### Modify Message Expiry:
Change in MessageSchema:
```javascript
expiresAt: { 
    type: Date, 
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
}
```

### Add More Emojis:
Update the emoji array in HTML:
```javascript
const emojis = ['😊', '😂', '❤️', '👍', '🎉', /* add more */];
```

## 📄 License

MIT License - Feel free to use this project however you want!

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

## ⭐ Features Coming Soon

- File sharing
- Video calls
- Message reactions
- Read receipts
- Typing indicators
- Push notifications
- Desktop app with Electron

---

**Enjoy chatting! 💬✨**