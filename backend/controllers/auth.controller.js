import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { sendVerificationEmail, sendPasswordChangeEmail, sendUsernameChangeEmail, send2FAEmail, sendForgotPasswordEmail } from '../config/emailservice.js';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Generate random 6-digit OTP
const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
};

// Generate verification token
const generateToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Upload image to Cloudinary
const uploadToCloudinary = async (base64Image) => {
    try {
        const result = await cloudinary.uploader.upload(base64Image, {
            folder: 'profile_pictures',
            transformation: [
                { width: 500, height: 500, crop: 'limit' },
                { quality: 'auto' }
            ]
        });
        return result.secure_url;
    } catch (error) {
        throw new Error('Failed to upload image');
    }
};

export const register = async (req, res) => {
    try {
        const { name, username, email, password } = req.body;
        
        if (!name || !username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            return res.status(400).json({ message: 'Enter a valid username' });
        }
        
        if (!/^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/.test(email)) {
            return res.status(400).json({ message: 'Enter a valid email' });
        }

        if (password.length < 6 || password.length > 50) {
            return res.status(400).json({ message: 'Password must be between 6 and 50 characters' });
        }

        const exist = await User.findOne({ $or: [{ email }, { username }] });
        if (exist) {
            return res.status(400).json({ message: 'User already exists with this email or username' });
        }

        const hash = await bcrypt.hash(password, 10);
        
        // Generate email verification OTP
        const verificationOTP = generateOTP();
        const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const user = await User.create({
            name,
            username,
            email,
            password: hash,
            emailVerificationOTP: verificationOTP,
            emailVerificationExpires: verificationExpires,
            isEmailVerified: false
        });

        // Send verification email with OTP
        await sendVerificationEmail(email, verificationOTP, name);

        res.status(201).json({
            message: 'Registration successful! Please check your email for verification code.',
            email: email,
            tempUserId: user._id
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({
            email,
            emailVerificationOTP: otp,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        user.isEmailVerified = true;
        user.emailVerificationOTP = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        res.json({ message: 'Email verified successfully! You can now login.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        const verificationOTP = generateOTP();
        const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);

        user.emailVerificationOTP = verificationOTP;
        user.emailVerificationExpires = verificationExpires;
        await user.save();

        await sendVerificationEmail(email, verificationOTP, user.name);

        res.json({ message: 'Verification code sent successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'User does not exist' });
        }

        // Check if email is verified
        if (!user.isEmailVerified) {
            return res.status(403).json({ 
                message: 'Please verify your email before logging in',
                emailNotVerified: true,
                email: user.email
            });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ message: 'Password is incorrect' });
        }

        // Check if 2FA is enabled
        if (user.twoFactorEnabled) {
            const otp = generateOTP();
            const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            user.twoFactorOTP = otp;
            user.twoFactorOTPExpires = otpExpires;
            await user.save();

            await send2FAEmail(user.email, otp, user.name);

            return res.json({
                message: 'OTP sent to your email',
                requires2FA: true,
                tempUserId: user._id
            });
        }

        // Login without 2FA
        const token = jwt.sign(
            { _id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Update online status
        user.online = true;
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.twoFactorOTP;
        delete userResponse.twoFactorOTPExpires;

        res.json({ token, user: userResponse });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const verify2FA = async (req, res) => {
    try {
        const { userId, otp } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.twoFactorOTP || !user.twoFactorOTPExpires) {
            return res.status(400).json({ message: 'No OTP found. Please login again.' });
        }

        if (user.twoFactorOTPExpires < Date.now()) {
            return res.status(400).json({ message: 'OTP expired. Please login again.' });
        }

        if (user.twoFactorOTP !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Clear OTP
        user.twoFactorOTP = undefined;
        user.twoFactorOTPExpires = undefined;
        user.online = true;
        await user.save();

        const token = jwt.sign(
            { _id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({ token, user: userResponse });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const toggle2FA = async (req, res) => {
    try {
        const { enable } = req.body;

        const user = await User.findById(req.user._id);
        user.twoFactorEnabled = enable;
        await user.save();

        res.json({
            message: `Two-factor authentication ${enable ? 'enabled' : 'disabled'} successfully`,
            twoFactorEnabled: user.twoFactorEnabled
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// NEW: Forgot Password - Request OTP
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User with this email does not exist' });
        }

        // Generate OTP for password reset
        const resetOTP = generateOTP();
        const resetOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.passwordResetOTP = resetOTP;
        user.passwordResetOTPExpires = resetOTPExpires;
        await user.save();

        // Send forgot password email
        await sendForgotPasswordEmail(email, resetOTP, user.name);

        res.json({ 
            message: 'Password reset code sent to your email',
            email: email
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// NEW: Reset Password using OTP
export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Email, OTP, and new password are required' });
        }

        if (newPassword.length < 6 || newPassword.length > 50) {
            return res.status(400).json({ message: 'Password must be between 6 and 50 characters' });
        }

        const user = await User.findOne({
            email,
            passwordResetOTP: otp,
            passwordResetOTPExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }

        // Hash new password
        const hash = await bcrypt.hash(newPassword, 10);
        user.password = hash;
        user.passwordResetOTP = undefined;
        user.passwordResetOTPExpires = undefined;
        await user.save();

        res.json({ message: 'Password reset successfully! You can now login with your new password.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const requestPasswordChange = async (req, res) => {
    try {
        const { currentPassword } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.passwordChangeOTP = otp;
        user.passwordChangeOTPExpires = otpExpires;
        await user.save();

        await sendPasswordChangeEmail(user.email, otp, user.name);

        res.json({ message: 'Verification code sent to your email' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { otp, newPassword } = req.body;

        if (!newPassword || newPassword.length < 6 || newPassword.length > 50) {
            return res.status(400).json({ message: 'Password must be between 6 and 50 characters' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.passwordChangeOTP || !user.passwordChangeOTPExpires) {
            return res.status(400).json({ message: 'No verification code found. Please request again.' });
        }

        if (user.passwordChangeOTPExpires < Date.now()) {
            return res.status(400).json({ message: 'Verification code expired. Please request again.' });
        }

        if (user.passwordChangeOTP !== otp) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        user.password = hash;
        user.passwordChangeOTP = undefined;
        user.passwordChangeOTPExpires = undefined;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const requestUsernameChange = async (req, res) => {
    try {
        const { newUsername, password } = req.body;

        if (!newUsername || !/^[a-zA-Z0-9_]{3,30}$/.test(newUsername)) {
            return res.status(400).json({ message: 'Enter a valid username' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ message: 'Password is incorrect' });
        }

        const usernameExists = await User.findOne({ username: newUsername });
        if (usernameExists) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        user.usernameChangeOTP = otp;
        user.usernameChangeOTPExpires = otpExpires;
        user.pendingUsername = newUsername;
        await user.save();

        await sendUsernameChangeEmail(user.email, otp, user.name, newUsername);

        res.json({ message: 'Verification code sent to your email' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const changeUsername = async (req, res) => {
    try {
        const { otp } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.usernameChangeOTP || !user.usernameChangeOTPExpires) {
            return res.status(400).json({ message: 'No verification code found. Please request again.' });
        }

        if (user.usernameChangeOTPExpires < Date.now()) {
            return res.status(400).json({ message: 'Verification code expired. Please request again.' });
        }

        if (user.usernameChangeOTP !== otp) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        if (!user.pendingUsername) {
            return res.status(400).json({ message: 'No pending username change' });
        }

        user.username = user.pendingUsername;
        user.usernameChangeOTP = undefined;
        user.usernameChangeOTPExpires = undefined;
        user.pendingUsername = undefined;
        await user.save();

        // Generate new token with updated username
        const token = jwt.sign(
            { _id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Username changed successfully',
            token,
            username: user.username
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// UPDATED: Profile update with Cloudinary image upload
export const updateProfile = async (req, res) => {
    try {
        const { name, profilePicture } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (name) user.name = name;
        
        // If profilePicture is provided (base64 image), upload to Cloudinary
        if (profilePicture) {
            try {
                const imageUrl = await uploadToCloudinary(profilePicture);
                user.profilePicture = imageUrl;
            } catch (uploadError) {
                return res.status(400).json({ message: 'Failed to upload profile picture' });
            }
        }

        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            message: 'Profile updated successfully',
            user: userResponse
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const verify = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -twoFactorOTP -twoFactorOTPExpires -passwordChangeOTP -passwordChangeOTPExpires -usernameChangeOTP -usernameChangeOTPExpires -passwordResetOTP -passwordResetOTPExpires');
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const logout = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { online: false });
        res.json({ message: 'Logged out successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};