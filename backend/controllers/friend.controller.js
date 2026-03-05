// controllers/friend.controller.js
import Friend from '../models/FRIEND.js';
import User from '../models/User.js';

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
        const friend = user1Id === userId ? f.user2 : f.user1;

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
    res.status(500).json({
      message: 'Failed to fetch friends',
      error: err.message
    });
  }
};