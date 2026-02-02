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
        enum: ['text', 'voice'], 
        default: 'text' 
    },
    audioUrl: String,
    
    // Enhanced status tracking
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    
    // Track when message was delivered
    deliveredAt: {
        type: Date
    },
    
    // Track when message was read
    readAt: {
        type: Date
    },
    
    // Legacy field for backward compatibility
    read: { 
        type: Boolean, 
        default: false 
    },
    
    expiresAt: Date
}, { 
    timestamps: true 
});

// Update read field when readAt is set
MessageSchema.pre('save', function(next) {
    if (this.readAt && !this.read) {
        this.read = true;
    }
    next();
});

MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MessageSchema.index({ chat: 1, createdAt: -1 });

export default mongoose.model('Message', MessageSchema);
