import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import { broadcast, sendToUser } from '../websocket/socket.js';
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import cloudinary from "../config/cloudinary.js";

export const getMessages = async (req, res) => {
    try {
        const messages = await Message.find({ chat: req.params.chatId })
            .populate('sender', 'name username verified')
            .sort({ createdAt: 1 });
        
        res.json({ messages }); 
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
};

export const sendText = async (req, res) => {
    try {
        const { chatId, content } = req.body;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        // Create message
        const msg = await Message.create({
            chat: chatId,
            sender: req.user._id,
            content: content.trim()
        });

        // Update chat
        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: content.trim(),
            lastMessageTime: new Date(),
            lastMessageRef: msg._id
        });

        // Populate message with sender info
        const populatedMsg = await Message.findById(msg._id)
            .populate('sender', 'name username verified');

        // Get chat to find participants
        const chat = await Chat.findById(chatId).populate('participants', '_id');
        
        if (chat) {
            // Send to each participant except the sender
            chat.participants.forEach(participant => {
                if (participant._id.toString() !== req.user._id.toString()) {
                    sendToUser(participant._id.toString(), {
                        type: 'new_message',
                        message: {
                            _id: populatedMsg._id,
                            chat: chatId,
                            sender: {
                                _id: populatedMsg.sender._id,
                                name: populatedMsg.sender.name,
                                username: populatedMsg.sender.username,
                                verified: populatedMsg.sender.verified
                            },
                            content: populatedMsg.content,
                            type: 'text',
                            createdAt: populatedMsg.createdAt
                        }
                    });
                }
            });
        }

        res.status(201).json({ message: populatedMsg });
    } catch (error) {
        console.error('Error sending text message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

export const sendVoice = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Audio file is required' });
        }

        // Upload to cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: 'video', 
            folder: 'chat_voices'
        });

        const audioUrl = result.secure_url;

        // Create message
        const msg = await Message.create({
            chat: req.body.chatId,
            sender: req.user._id,
            type: 'voice',
            audioUrl
        });

        // Update chat
        await Chat.findByIdAndUpdate(req.body.chatId, {
            lastMessage: '🎤 Voice message',
            lastMessageTime: new Date(),
            lastMessageRef: msg._id
        });

        // Populate message
        const populatedMsg = await Message.findById(msg._id)
            .populate('sender', 'name username verified');

        // Get chat to find participants
        const chat = await Chat.findById(req.body.chatId).populate('participants', '_id');
        
        if (chat) {
            // Send to each participant except the sender
            chat.participants.forEach(participant => {
                if (participant._id.toString() !== req.user._id.toString()) {
                    sendToUser(participant._id.toString(), {
                        type: 'new_message',
                        message: {
                            _id: populatedMsg._id,
                            chat: req.body.chatId,
                            sender: {
                                _id: populatedMsg.sender._id,
                                name: populatedMsg.sender.name,
                                username: populatedMsg.sender.username,
                                verified: populatedMsg.sender.verified
                            },
                            type: 'voice',
                            audioUrl: populatedMsg.audioUrl,
                            createdAt: populatedMsg.createdAt
                        }
                    });
                }
            });
        }

        res.status(201).json({ message: populatedMsg });

        // Delete local file after upload
        fs.unlinkSync(req.file.path);
    } catch (error) {
        console.error('Error sending voice message:', error);
        
        // Clean up file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: 'Failed to send voice message' });
    }
};