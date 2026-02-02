import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    profilePicture: {
        type: String,
        default: ''
    },
    online: {
        type: Boolean,
        default: false
    },
    
    // Email Verification
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationOTP: String,
    emailVerificationExpires: Date,
    
    // Two-Factor Authentication
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorOTP: String,
    twoFactorOTPExpires: Date,
    
    // Password Change
    passwordChangeOTP: String,
    passwordChangeOTPExpires: Date,
    
    // Username Change
    usernameChangeOTP: String,
    usernameChangeOTPExpires: Date,
    pendingUsername: String
    
}, { timestamps: true });

export default mongoose.model('User', userSchema);