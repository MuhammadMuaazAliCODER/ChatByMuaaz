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

    // ── Scheduled message fields ──────────────────────
    isScheduled:    { type: Boolean, default: false },
    scheduledAt:    { type: Date },                                              // when to fire
    scheduledFor:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],    // extra recipients (optional)
    scheduleStatus: {
        type: String,
        enum: ['pending', 'sent', 'cancelled'],
        default: 'pending'
    },

    expiresAt: Date
}, { timestamps: true });

// ── Hooks ─────────────────────────────────────────────
MessageSchema.pre('save', function (next) {
    if (this.readAt && !this.read) {
        this.read = true;
    }
    next();
});

// ── Indexes ───────────────────────────────────────────
MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MessageSchema.index({ chat: 1, createdAt: -1 });
MessageSchema.index({ scheduledAt: 1, scheduleStatus: 1 });  
MessageSchema.index({ sender: 1, isScheduled: 1, scheduleStatus: 1 });

export default mongoose.model('Message', MessageSchema);