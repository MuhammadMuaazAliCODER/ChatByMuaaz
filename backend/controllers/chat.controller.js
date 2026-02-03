import Chat from '../models/Chat.js';
import dotenv from 'dotenv';
dotenv.config();

export const getChats = async (req, res) => {
    const chats = await Chat.find({ participants: req.user._id })
        .populate('participants', 'name username online verified')
        .populate({
            path: 'lastMessageRef',
            populate: { path: 'sender', select: 'name username' }
        })
        .sort({ updatedAt: -1 });

    res.json({ chats }); // Fixed: Wrapped in object
};

export const createDirect = async (req, res) => {
    const { userId } = req.body;

    let chat = await Chat.findOne({
        type: 'direct',
        participants: { $all: [req.user._id, userId] }
    }).populate('participants', 'name username online verified');

    if (!chat) {
        chat = await Chat.create({
            type: 'direct',
            participants: [req.user._id, userId]
        });
        
        // Populate after creation
        chat = await Chat.findById(chat._id)
            .populate('participants', 'name username online verified');
    }

    res.json(chat); // This is fine as single object
};

export const createGroup = async (req, res) => {
    const { name, participants } = req.body;

    const chat = await Chat.create({
        type: 'group',
        name,
        participants: [...participants, req.user._id],
        admin: req.user._id
    });

    const populatedChat = await Chat.findById(chat._id)
        .populate('participants', 'name username online verified');

    res.status(201).json(populatedChat);
};