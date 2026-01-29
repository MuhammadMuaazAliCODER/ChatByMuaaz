// friend.routes.js
import { Router } from 'express';
import auth from '../middleware/auth.middleware.js';
import Friend from '../models/FRIEND.js';
// Import models
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Chat from '../models/Chat.js';

const router = Router();

// Controllers
const sendRequest = async (req, res) => {
   try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ message: 'Username required' });

        const targetUser = await User.findOne({ username });
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        if (targetUser._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: "You can't send request to yourself" });
        }

        const existing = await FriendRequest.findOne({
            $or: [
                { from: req.user._id, to: targetUser._id },
                { from: targetUser._id, to: req.user._id }
            ],
            status: 'pending'
        });

        if (existing) {
            return res.status(400).json({ message: 'Friend request already exists' });
        }

        const request = new FriendRequest({
            from: req.user._id,
            to: targetUser._id
        });

        await request.save();

        res.status(201).json({
            message: 'Friend request sent',
            request
        });

    } catch (error) {
        console.error('Send Friend Request Error:', error);
        res.status(500).json({ message: 'Failed to send request', error: error.message });
    }
};

const getIncoming = async (req, res) => {
     try {
        const requests = await FriendRequest.find({
            to: req.user._id,
            status: 'pending'
        }).populate('from', 'name username verified');

        res.json(requests);
    } catch (error) {
        console.error('Get Incoming Requests Error:', error);
        res.status(500).json({ message: 'Failed to get requests', error: error.message });
    }
};


const respondRequest = async (req, res) => {
    try {
        const { requestId, action } = req.body;
        if (!requestId || !action) 
            return res.status(400).json({ message: 'Request ID and action required' });

        const request = await FriendRequest.findById(requestId);
        if (!request) 
            return res.status(404).json({ message: 'Friend request not found' });

        if (request.to.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Update friend request status
        request.status = action;
        await request.save();

        if (action === 'accepted') {
            // 1️⃣ Add to Friends collection
            const alreadyFriends = await Friend.findOne({
                $or: [
                    { user1: request.from, user2: request.to },
                    { user1: request.to, user2: request.from }
                ]
            });

            if (!alreadyFriends) {
                await Friend.create({
                    user1: request.from,
                    user2: request.to
                });
            }

            // 2️⃣ Create a direct chat if not exists
            let chat = await Chat.findOne({
                type: 'direct',
                participants: { $all: [request.from, request.to] }
            });

            if (!chat) {
                chat = new Chat({
                    type: 'direct',
                    participants: [request.from, request.to]
                });
                await chat.save();
            }
        }

        res.json({ message: `Friend request ${action}`, request });
    } catch (error) {
        console.error('Respond Friend Request Error:', error);
        res.status(500).json({ message: 'Failed to respond', error: error.message });
    }
};




// Routes
router.post('/send', auth, sendRequest);
router.get('/incoming', auth, getIncoming);
router.post('/respond', auth, respondRequest);

export default router;
