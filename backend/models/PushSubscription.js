import mongoose from 'mongoose';

const PushSubscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    endpoint: {
        type: String,
        required: true,
        unique: true
    },
    keys: {
        p256dh: {
            type: String,
            required: true
        },
        auth: {
            type: String,
            required: true
        }
    },
    userAgent: String,
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for quick lookup
PushSubscriptionSchema.index({ user: 1, active: 1 });

export default mongoose.model('PushSubscription', PushSubscriptionSchema);
