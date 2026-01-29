// Load environment variables FIRST - THIS IS CRITICAL!
require('dotenv').config();

// server.js - Main Express Server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const cron = require('node-cron');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads', 'voice');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created uploads/voice directory');
}

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection - USE ENVIRONMENT VARIABLE
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB Connected Successfully');
        console.log(`📊 Database: ${mongoose.connection.name}`);
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    });

// Handle MongoDB connection errors after initial connection
mongoose.connection.on('error', err => {
    console.error('❌ MongoDB Error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB Disconnected');
});

// JWT Secret - USE ENVIRONMENT VARIABLE
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_in_production';

// Admin usernames from environment
const ADMIN_USERNAMES = process.env.ADMIN_USERNAMES 
    ? process.env.ADMIN_USERNAMES.split(',').map(u => u.trim())
    : ['admin'];

// Multer Configuration for Voice Messages
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.wav`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB
    }
});

// ==================== MODELS ====================

// User Schema
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    online: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Chat Schema
const ChatSchema = new mongoose.Schema({
    type: { type: String, enum: ['direct', 'group'], required: true },
    name: String,
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessage: String,
    lastMessageTime: Date,
    createdAt: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Chat', ChatSchema);

// Message Schema
const MessageSchema = new mongoose.Schema({
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: String,
    type: { type: String, enum: ['text', 'voice'], default: 'text' },
    audioUrl: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { 
        type: Date, 
        default: () => {
            const days = parseInt(process.env.MESSAGE_EXPIRY_DAYS) || 7;
            return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        }
    }
});

// Index for automatic deletion after expiry
MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Message = mongoose.model('Message', MessageSchema);

// ==================== MIDDLEWARE ====================

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, username, email, password } = req.body;

        // Validate input
        if (!name || !username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if username should be verified
        const isVerified = ADMIN_USERNAMES.includes(username);

        // Create user
        const user = new User({
            name,
            username,
            email,
            password: hashedPassword,
            verified: isVerified
        });

        await user.save();

        console.log(`✅ New user registered: ${username}`);

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Update online status
        user.online = true;
        user.lastSeen = new Date();
        await user.save();

        // Generate token
        const token = jwt.sign(
            { _id: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        console.log(`✅ User logged in: ${username}`);

        res.json({
            token,
            user: {
                _id: user._id,
                name: user.name,
                username: user.username,
                verified: user.verified
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
});

// Verify Token
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ message: 'Verification failed' });
    }
});

// Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { 
            online: false,
            lastSeen: new Date()
        });
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Logout failed' });
    }
});

// ==================== CHAT ROUTES ====================

// Get User Chats
app.get('/api/chats', authenticateToken, async (req, res) => {
    try {
        const chats = await Chat.find({
            participants: req.user._id
        })
        .populate('participants', 'name username verified online')
        .sort({ lastMessageTime: -1 });

        const formattedChats = chats.map(chat => {
            if (chat.type === 'direct') {
                const otherUser = chat.participants.find(p => p._id.toString() !== req.user._id);
                if (!otherUser) return null;
                
                return {
                    _id: chat._id,
                    type: chat.type,
                    name: otherUser.name,
                    username: otherUser.username,
                    verified: otherUser.verified,
                    online: otherUser.online,
                    lastMessage: chat.lastMessage,
                    lastMessageTime: chat.lastMessageTime
                };
            } else {
                return {
                    _id: chat._id,
                    type: chat.type,
                    name: chat.name,
                    participants: chat.participants.length,
                    lastMessage: chat.lastMessage,
                    lastMessageTime: chat.lastMessageTime
                };
            }
        }).filter(Boolean);

        res.json(formattedChats);
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ message: 'Failed to load chats', error: error.message });
    }
});

// Create Direct Chat
app.post('/api/chats/direct', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'User ID required' });
        }

        // Check if chat already exists
        const existingChat = await Chat.findOne({
            type: 'direct',
            participants: { $all: [req.user._id, userId] }
        });

        if (existingChat) {
            return res.json(existingChat);
        }

        // Create new chat
        const chat = new Chat({
            type: 'direct',
            participants: [req.user._id, userId]
        });

        await chat.save();
        await chat.populate('participants', 'name username verified online');
        
        res.status(201).json(chat);
    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ message: 'Failed to create chat', error: error.message });
    }
});

// Create Group Chat
app.post('/api/chats/group', authenticateToken, async (req, res) => {
    try {
        const { name, participants } = req.body;

        if (!name || !participants || participants.length < 2) {
            return res.status(400).json({ message: 'Group name and at least 2 participants required' });
        }

        const chat = new Chat({
            type: 'group',
            name,
            participants: [...participants, req.user._id],
            admin: req.user._id
        });

        await chat.save();
        res.status(201).json(chat);
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ message: 'Failed to create group', error: error.message });
    }
});

// ==================== MESSAGE ROUTES ====================

// Get Messages
app.get('/api/messages/:chatId', authenticateToken, async (req, res) => {
    try {
        const messages = await Message.find({
            chat: req.params.chatId
        })
        .populate('sender', 'name username verified')
        .sort({ createdAt: 1 });

        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ message: 'Failed to load messages', error: error.message });
    }
});

// Send Text Message
app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const { chatId, content, type } = req.body;

        if (!chatId || !content) {
            return res.status(400).json({ message: 'Chat ID and content required' });
        }

        const message = new Message({
            chat: chatId,
            sender: req.user._id,
            content,
            type: type || 'text'
        });

        await message.save();
        await message.populate('sender', 'name username verified');

        // Update chat last message
        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: content.substring(0, 50),
            lastMessageTime: new Date()
        });

        // Broadcast to WebSocket clients
        broadcastMessage({
            type: 'new_message',
            message
        });

        res.status(201).json(message);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ message: 'Failed to send message', error: error.message });
    }
});

// Send Voice Message
app.post('/api/messages/voice', authenticateToken, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Audio file required' });
        }

        const { chatId } = req.body;
        if (!chatId) {
            return res.status(400).json({ message: 'Chat ID required' });
        }

        const audioUrl = `/uploads/voice/${req.file.filename}`;

        const message = new Message({
            chat: chatId,
            sender: req.user._id,
            type: 'voice',
            audioUrl
        });

        await message.save();
        await message.populate('sender', 'name username verified');

        // Update chat last message
        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: '🎤 Voice message',
            lastMessageTime: new Date()
        });

        // Broadcast to WebSocket clients
        broadcastMessage({
            type: 'new_message',
            message
        });

        res.status(201).json(message);
    } catch (error) {
        console.error('Send voice message error:', error);
        res.status(500).json({ message: 'Failed to send voice message', error: error.message });
    }
});

// ==================== USER ROUTES ====================

// Search Users
app.get('/api/users/search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.json([]);
        }

        const users = await User.find({
            $or: [
                { username: new RegExp(query, 'i') },
                { name: new RegExp(query, 'i') }
            ],
            _id: { $ne: req.user._id }
        }).select('-password').limit(20);

        res.json(users);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Search failed', error: error.message });
    }
});

// Get all users (for creating chats)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({
            _id: { $ne: req.user._id }
        }).select('-password').limit(50);
        
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Failed to get users', error: error.message });
    }
});

// Verify User (Admin only - set specific usernames as verified)
app.post('/api/users/verify/:userId', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { verified: true },
            { new: true }
        ).select('-password');

        res.json(user);
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ message: 'Verification failed', error: error.message });
    }
});

// ==================== WEBSOCKET ====================

const clients = new Map();

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
        console.log('❌ WebSocket: No token provided');
        ws.close();
        return;
    }

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) {
            console.log('❌ WebSocket: Invalid token');
            ws.close();
            return;
        }

        clients.set(user._id, ws);
        console.log(`✅ WebSocket: User ${user.username} connected (Total: ${clients.size})`);

        // Update user online status
        await User.findByIdAndUpdate(user._id, { online: true });

        ws.on('close', async () => {
            clients.delete(user._id);
            console.log(`⚠️ WebSocket: User ${user.username} disconnected (Total: ${clients.size})`);
            
            // Update user offline status
            await User.findByIdAndUpdate(user._id, { 
                online: false,
                lastSeen: new Date()
            });
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
        });
    });
});

function broadcastMessage(data) {
    const message = JSON.stringify(data);
    clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

// ==================== CRON JOB ====================

// Clean up expired messages (runs daily at midnight)
cron.schedule('0 0 * * *', async () => {
    try {
        const result = await Message.deleteMany({
            expiresAt: { $lt: new Date() }
        });
        console.log(`🗑️ Deleted ${result.deletedCount} expired messages`);
    } catch (error) {
        console.error('❌ Error deleting expired messages:', error);
    }
});

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime()
    });
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({ 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ==================== START SERVER ====================

// const PORT = process.env.PORT || 5700;
const PORT = 5700;

server.listen(PORT, () => {
    console.log('');
    console.log('🚀 ================================');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
    console.log('🚀 ================================');
    console.log('');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
    server.close(() => process.exit(1));
});

// Handle SIGTERM
process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM received, closing server...');
    server.close(() => {
        mongoose.connection.close(false, () => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    });
});