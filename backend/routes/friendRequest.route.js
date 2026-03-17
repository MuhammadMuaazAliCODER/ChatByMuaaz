// friendRequest.routes.js
import { Router } from 'express';
import auth from '../middleware/auth.middleware.js';
import Friend from '../models/FRIEND.js';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Chat from '../models/Chat.js';
import { checkFriendLimit } from '../middleware/checkFriendLimit.js';
import { sendToUser } from '../websocket/socket.js'; // ← ADD THIS IMPORT (adjust path)

const router = Router();

// POST /friend/send
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
    if (existing) return res.status(400).json({ message: 'Friend request already exists' });

    const request = await new FriendRequest({ from: req.user._id, to: targetUser._id }).save();

    // ── Populate sender details for the WS payload ──
    const populated = await FriendRequest.findById(request._id)
      .populate('from', 'name username email profilePicture');

    // ── Notify the recipient in real-time ──
    sendToUser(String(targetUser._id), {
      type: 'friend_request',
      request: {
        _id:    populated._id,
        sender: populated.from,   // full user object
      }
    });

    res.status(201).json({ message: 'Friend request sent', request: populated });
  } catch (error) {
    console.error('Send Friend Request Error:', error);
    res.status(500).json({ message: 'Failed to send request', error: error.message });
  }
};

// GET /friend/incoming
const getIncoming = async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      to: req.user._id,
      status: 'pending'
    // ── FIX: added profilePicture and email to the populate ──
    }).populate('from', 'name username email profilePicture verified');

    // Reshape so frontend gets { _id, sender: {...} } consistently
    const shaped = requests.map(r => ({
      _id:    r._id,
      status: r.status,
      sender: r.from,
    }));

    res.json(shaped);
  } catch (error) {
    console.error('Get Incoming Requests Error:', error);
    res.status(500).json({ message: 'Failed to get requests', error: error.message });
  }
};

// POST /friend/respond
const respondRequest = async (req, res) => {
  try {
    const { requestId, action } = req.body;
    if (!requestId || !action)
      return res.status(400).json({ message: 'Request ID and action required' });

    const request = await FriendRequest.findById(requestId).populate('from to');
    if (!request) return res.status(404).json({ message: 'Friend request not found' });

    if (request.to._id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });

    request.status = action;
    await request.save();

    if (action === 'accepted') {
      const alreadyFriends = await Friend.findOne({
        $or: [
          { user1: request.from._id, user2: request.to._id },
          { user1: request.to._id,   user2: request.from._id }
        ]
      });
      if (!alreadyFriends) {
        await Friend.create({ user1: request.from._id, user2: request.to._id });
      }

      let chat = await Chat.findOne({
        type: 'direct',
        participants: { $all: [request.from._id, request.to._id] }
      });
      if (!chat) {
        chat = new Chat({ type: 'direct', participants: [request.from._id, request.to._id] });
        await chat.save();
      }

      if (req.countFriend) await req.countFriend();

      // ── Notify the original sender that their request was accepted ──
      sendToUser(String(request.from._id), {
        type: 'friend_accepted',
        friendId:   String(request.to._id),
        friendName: request.to.name || request.to.username,
        chatId:     String(chat._id),
      });
    }

    res.json({ message: `Friend request ${action}`, request });
  } catch (error) {
    console.error('Respond Friend Request Error:', error);
    res.status(500).json({ message: 'Failed to respond', error: error.message });
  }
};

router.post('/send',    auth, sendRequest);
router.get('/incoming', auth, getIncoming);
router.post('/respond', auth, checkFriendLimit, respondRequest);

export default router;