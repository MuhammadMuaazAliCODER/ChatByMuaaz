// friend.routes.js
import express from 'express';
import { getFriends, removeFriend } from '../controllers/friend.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

// GET  /friends        — get all friends for logged-in user
router.get('/',        auth, getFriends);

// DELETE /friends/remove — unfriend someone, decrements both users' count
router.delete('/remove', auth, removeFriend);

export default router;