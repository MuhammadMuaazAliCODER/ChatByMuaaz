import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';

const FRIEND_LIMITS = {
  FREE:  5,
  BASIC: 10,
  PRO:   -1
};

export const checkFriendLimit = async (req, res, next) => {
  try {
    const { action, requestId } = req.body;

    if (action !== 'accepted') return next();

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    const [sender, receiver] = await Promise.all([
      User.findById(request.from).select('role subscription usage username'),
      User.findById(request.to).select('role subscription usage username')
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ success: false, message: 'One or both users not found' });
    }

    const senderRole    = sender.getEffectiveRole();
    const senderLimit   = FRIEND_LIMITS[senderRole] ?? 5;
    const senderCount   = sender.usage.friendsCount || 0;

    if (senderLimit !== -1 && senderCount >= senderLimit) {
      return res.status(429).json({
        success: false,
        limitReached: true,
        message: `${sender.username} has reached their friend limit of ${senderLimit} on the ${senderRole.toLowerCase()} plan.`,
        upgrade: {
          message: 'Upgrade to add more friends.',
          options: { basic: '10 friends — $5/month', pro: 'Unlimited friends — $10/month' }
        }
      });
    }

    const receiverRole  = receiver.getEffectiveRole();
    const receiverLimit = FRIEND_LIMITS[receiverRole] ?? 5;
    const receiverCount = receiver.usage.friendsCount || 0;

    if (receiverLimit !== -1 && receiverCount >= receiverLimit) {
      return res.status(429).json({
        success: false,
        limitReached: true,
        message: `You have reached your friend limit of ${receiverLimit} on the ${receiverRole.toLowerCase()} plan.`,
        upgrade: {
          message: 'Upgrade to add more friends.',
          options: { basic: '10 friends — $5/month', pro: 'Unlimited friends — $10/month' }
        }
      });
    }

    req.countFriend = async () => {
      await Promise.all([
        User.findByIdAndUpdate(request.from, { $inc: { 'usage.friendsCount': 1 } }),
        User.findByIdAndUpdate(request.to,   { $inc: { 'usage.friendsCount': 1 } })
      ]);
    };

    next();
  } catch (error) {
    console.error('checkFriendLimit error:', error);
    return res.status(500).json({ success: false, message: 'Error checking friend limit' });
  }
};