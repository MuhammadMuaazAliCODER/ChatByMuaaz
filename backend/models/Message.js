import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    type: { type: String, enum: ['text', 'voice'], default: 'text' },
    audioUrl: String,
    read: { type: Boolean, default: false },
    expiresAt: Date
}, { timestamps: true });

MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Message', MessageSchema);
