import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    chat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: String,
    type: {
        type: String,
        enum: ['text', 'voice', 'audio'],
        default: 'text'
    },
    audioUrl: String,

    // ── Edit tracking ─────────────────────────────────
    edited:   { type: Boolean, default: false },
    editedAt: { type: Date },

    // ── Enhanced status tracking ──────────────────────
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    deliveredAt: { type: Date },
    readAt:      { type: Date },

    // Legacy field for backward compatibility
    read: { type: Boolean, default: false },

    expiresAt: Date
}, { timestamps: true });

// Update read field when readAt is set
MessageSchema.pre('save', function (next) {
    if (this.readAt && !this.read) {
        this.read = true;
    }
    next();
});

MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MessageSchema.index({ chat: 1, createdAt: -1 });

export default mongoose.model('Message', MessageSchema);