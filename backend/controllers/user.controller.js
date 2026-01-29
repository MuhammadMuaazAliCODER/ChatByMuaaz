import User from '../models/User.js';

export const searchUsers = async (req, res) => {
    try {
        const q = req.query.query?.trim();

        if (!q) {
            return res.status(400).json({ message: 'Search query required' });
        }

        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const users = await User.find({
            username: { $regex: q, $options: 'i' },
            _id: { $ne: req.user._id }
        }).select('-password');

        res.json(users);

    } catch (error) {
        console.error('Search Users Error:', error);
        res.status(500).json({ message: 'Search failed', error: error.message });
    }
};

export const getUsers = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const users = await User.find({
            _id: { $ne: req.user._id }
        }).select('-password');

        res.json(users);

    } catch (error) {
        console.error('Get Users Error:', error);
        res.status(500).json({ message: 'Failed to get users', error: error.message });
    }
};
