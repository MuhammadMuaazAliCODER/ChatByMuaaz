// controllers/friend.controller.js
import Friend from '../models/FRIEND.js';
import User from '../models/User.js';

export const getFriends = async (req, res) => {
    try {
        const userId = req.user._id.toString();

        const friends = await Friend.find({
            $or: [{ user1: userId }, { user2: userId }]
        })
        .populate('user1', 'username email')
        .populate('user2', 'username email');

        const friendList = friends.map(f => {
            const user1Id = f.user1._id?.toString() || f.user1.toString();
            return user1Id === userId ? f.user2 : f.user1;
        });

        res.status(200).json(friendList);
    } catch (err) {
        console.error('Get Friends Error:', err);
        res.status(500).json({ message: 'Failed to fetch friends', error: err.message });
    }
};