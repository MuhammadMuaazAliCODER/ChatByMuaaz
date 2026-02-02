
// Complete example of User schema with all fields:
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
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationOTP: {
        type: String
    },
    emailVerificationExpires: {
        type: Date
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorOTP: {
        type: String
    },
    twoFactorOTPExpires: {
        type: Date
    },
    passwordChangeOTP: {
        type: String
    },
    passwordChangeOTPExpires: {
        type: Date
    },
    passwordResetOTP: {
        type: String
    },
    passwordResetOTPExpires: {
        type: Date
    },
    usernameChangeOTP: {
        type: String
    },
    usernameChangeOTPExpires: {
        type: Date
    },
    pendingUsername: {
        type: String
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);

export default User;