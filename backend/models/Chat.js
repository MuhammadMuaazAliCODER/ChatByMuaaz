import mongoose from 'mongoose';

const ChatSchema = new mongoose.Schema({
    type: { type: String, enum: ['direct', 'group'], required: true },
    name: String,
    groupDP: { type: String, default: null },                   // group profile picture URL

    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // invite flow: users sit here until they accept
    pendingInvites: [
        {
            user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            invitedAt: { type: Date, default: Date.now }
        }
    ],

    // group-level permissions
    permissions: {
        onlyAdminCanSendMessages: { type: Boolean, default: false },
        onlyAdminCanEditGroupInfo: { type: Boolean, default: true },
        onlyAdminCanAddMembers:    { type: Boolean, default: false }
    },

    lastMessage:    String,
    lastMessageTime: Date,
    lastMessageRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    unreadCount:    { type: Map, of: Number, default: {} }
}, { timestamps: true });

export default mongoose.model('Chat', ChatSchema);