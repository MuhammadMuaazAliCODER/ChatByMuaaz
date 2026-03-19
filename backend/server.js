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
import friendRoutes from './routes/friendRequest.route.js';
import friend from './routes/friend.routes.js';
import emailRoutes from "./routes/email.routes.js";
import pushroutes from "./routes/push.routes.js"
import audioroutes from "./routes/upload.routes.js";
import subscriptionRoutes from './routes/subscription.routes.js';
 
import uploadRoutes from './routes/upload.routes.js';
 
// Place these with your other app.use() route registrations:
 

const app = express();
const server = http.createServer(app);


app.use('/api/subscription/webhook', 
  express.raw({ type: 'application/json' }), 
  subscriptionRoutes
);

// Fixed: Configure CORS only once
app.use(cors({
  origin: [process.env.CORS_ORIGIN, process.env.CORST_TEST_ORIGIN],
  credentials: true,              
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests for all routes
app.options('*', cors());

// Fixed: JSON middleware only once
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
app.use("/api/email", emailRoutes);
app.use("/api/push",pushroutes)
app.use("/api/upload", audioroutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/uploads', express.static('uploads'));   // serve audio files publicly
app.use('/upload',  uploadRoutes); 
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    stripe: 'Integrated' 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = 5300;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`💳 Stripe webhook: http://localhost:${PORT}/api/subscription/webhook`);
});

export default app;

