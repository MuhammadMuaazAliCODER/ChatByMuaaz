// routes/friend.routes.js
import express from 'express';
import { getFriends } from '../controllers/friend.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /friends - get all friends for logged-in user
router.get('/friends', auth, getFriends);

export default router;
