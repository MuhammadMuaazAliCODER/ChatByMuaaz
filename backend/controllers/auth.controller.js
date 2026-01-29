import User from '../models/User.js';

import bcrypt from 'bcryptjs';

import jwt from 'jsonwebtoken';

import dotenv from 'dotenv';
dotenv.config();

export const register = async (req, res) => {
    try {
        const { name, username, email, password } = req.body;
        if (!name || !username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            return res.status(400).json({ message: 'Enter a valid username' });
        }
        if (!/^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/.test(email)) {
            return res.status(400).json({ message: 'Enter a valid email' });
        }

        if (password.length < 6 && password.length > 50) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const exist = await User.findOne({ $or: [{ email }, { username }] });
        if (exist) return res.status(400).json({ message: 'User exists' });

        const hash = await bcrypt.hash(password, 10);

        await User.create({ name, username, email, password: hash });

        res.status(201).json({ message: 'Registered successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: 'User not exists' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ message: 'Password is incorrect' });

        const token = jwt.sign(
            { _id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, user });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const verify = async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
};

export const logout = async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { online: false });
    res.json({ message: 'Logged out' });
};
