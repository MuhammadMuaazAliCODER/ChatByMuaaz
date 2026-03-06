// controllers/friend.controller.js
import Friend from '../models/FRIEND.js';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /friends
// Returns all friends for the logged-in user
// ─────────────────────────────────────────────────────────────────────────────
export const getFriends = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const friends = await Friend.find({
      $or: [{ user1: userId }, { user2: userId }]
    })
      .populate('user1', 'username email profilePicture')
      .populate('user2', 'username email profilePicture');

    const friendList = friends
      .filter(f => f.user1 && f.user2)
      .map(f => {
        const user1Id = f.user1._id.toString();
        const friend  = user1Id === userId ? f.user2 : f.user1;
        return {
          _id: friend._id,
          username: friend.username,
          email: friend.email,
          profilePicture: friend.profilePicture
        };
      });

    res.status(200).json(friendList);
  } catch (err) {
    console.error('Get Friends Error:', err);
    res.status(500).json({ message: 'Failed to fetch friends', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /friends/remove
// Removes a friendship and decrements friendsCount for both users.
//
// Body: { friendId }  ← _id of the user to unfriend
// ─────────────────────────────────────────────────────────────────────────────
export const removeFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.user._id;

    if (!friendId) {
      return res.status(400).json({ message: 'friendId is required' });
    }

    // Find and delete the Friend record
    const friendship = await Friend.findOneAndDelete({
      $or: [
        { user1: userId, user2: friendId },
        { user1: friendId, user2: userId }
      ]
    });

    if (!friendship) {
      return res.status(404).json({ message: 'Friendship not found' });
    }

    // Decrement friendsCount for both users (never go below 0)
    await Promise.all([
      User.findByIdAndUpdate(userId,   { $inc: { 'usage.friendsCount': -1 } }),
      User.findByIdAndUpdate(friendId, { $inc: { 'usage.friendsCount': -1 } })
    ]);

    // Clean up accepted friend request records between them
    await FriendRequest.deleteMany({
      $or: [
        { from: userId,   to: friendId },
        { from: friendId, to: userId   }
      ]
    });

    res.status(200).json({ success: true, message: 'Friend removed successfully' });
  } catch (err) {
    console.error('Remove Friend Error:', err);
    res.status(500).json({ message: 'Failed to remove friend', error: err.message });
  }
};