import mongoose from 'mongoose';

const ChatSchema = new mongoose.Schema({
    type: { type: String, enum: ['direct', 'group'], required: true },
    name: String,
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessage: String,
    lastMessageTime: Date,
    lastMessageRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }, // Fixed: Added reference
    unreadCount: { type: Map, of: Number, default: {} } // Fixed: Track unread per user
}, { timestamps: true });

export default mongoose.model('Chat', ChatSchema);