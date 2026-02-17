import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: '' },
    online: { type: Boolean, default: false },

    // Auth & verification fields
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationOTP: { type: String },
    emailVerificationExpires: { type: Date },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorOTP: { type: String },
    twoFactorOTPExpires: { type: Date },
    passwordChangeOTP: { type: String },
    passwordChangeOTPExpires: { type: Date },
    passwordResetOTP: { type: String },
    passwordResetOTPExpires: { type: Date },
    usernameChangeOTP: { type: String },
    usernameChangeOTPExpires: { type: Date },
    pendingUsername: { type: String },

    //  Subscription Fields 
    role: {
        type: String,
        enum: ["FREE", "BASIC", "PRO"],  
        default: "FREE"
    },
    stripeCustomerId: { type: String, default: null },

    subscription: {
        subscriptionId: { type: String, default: null },
        status: {
            type: String,
            enum: ["none", "active", "trialing", "past_due", "canceled", "cancelled", "incomplete", "incomplete_expired", "unpaid", null],
            default: null
        },
        plan: {
            type: String,
            enum: ["none", "basic", "pro", "premium", null],
            default: null
        },
        currentPeriodEnd: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false }
    },

    //  Usage tracking (for chat limits)
    usage: {
        messagesSentToday: { type: Number, default: 0 },
        lastMessageReset: { type: Date, default: Date.now },
        friendsCount: { type: Number, default: 0 }
    }

}, {
    timestamps: true
});

//  Method to check if subscription is active
userSchema.methods.hasActiveSubscription = function() {
    return this.subscription.status === 'active' || this.subscription.status === 'trialing';
};

//  Method to check if user has specific plan or better
userSchema.methods.hasPlanAccess = function(requiredPlan) {
    const planHierarchy = {
        'basic': 1,
        'pro': 2,
    };
    
    const userLevel = planHierarchy[this.subscription.plan] || 0;
    const requiredLevel = planHierarchy[requiredPlan] || 0;
    
    return userLevel >= requiredLevel;
};


userSchema.methods.resetDailyMessagesIfNeeded = function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastReset = new Date(this.usage.lastMessageReset);
    lastReset.setHours(0, 0, 0, 0);
    
    if (today > lastReset) {
        this.usage.messagesSentToday = 0;
        this.usage.lastMessageReset = new Date();
    }
};


userSchema.methods.getMessageLimit = function() {
    const limits = {
        'FREE': 20,
        'BASIC': 100,
        'PRO': -1,      // Unlimited
    };
    
    return limits[this.role] || 20;
};

// 🔹 Method to check if user can send message
userSchema.methods.canSendMessage = function() {
    // Reset counter if it's a new day
    this.resetDailyMessagesIfNeeded();
    
    const limit = this.getMessageLimit();
    
    // -1 means unlimited
    if (limit === -1) return true;
    
    return this.usage.messagesSentToday < limit;
};

// 🔹 Method to increment message count
userSchema.methods.incrementMessageCount = function() {
    this.resetDailyMessagesIfNeeded();
    this.usage.messagesSentToday += 1;
};

const User = mongoose.model('User', userSchema);

export default User;