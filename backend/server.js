import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';

import { connectDB } from './database/db.connection.js';
import { initSocket } from './websocket/socket.js';
import './cron/cleanup.js';

import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import messageRoutes from './routes/message.routes.js';
import userRoutes from './routes/user.routes.js';
import friendRoutes  from './routes/friendRequest.route.js';
import friend from './routes/friend.routes.js';

const app = express();
const server = http.createServer(app);


// Fixed: Configure CORS only once
app.use(cors({
  origin: [process.env.CORS_ORIGIN, process.env.CORST_TEST_ORIGIN],
  credentials: true,              
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests for all routes
app.options('*', cors());

// Fixed: JSON middleware only once
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Connect to database and initialize WebSocket
connectDB(); 
initSocket(server);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friend', friendRoutes);
app.use('/api/friends', friend);

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));