import express from 'express';
import {
    register,
    verifyEmail,
    resendVerificationEmail,
    login,
    verify2FA,
    toggle2FA,
    requestPasswordChange,
    changePassword,
    requestUsernameChange,
    changeUsername,
    updateProfile,
    verify,
    logout
} from '../controllers/auth.controller.js';
import  authenticate  from '../middleware/auth.middleware.js';

const router = express.Router();

// Registration & Email Verification
router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

// Login & 2FA
router.post('/login', login);
router.post('/verify-2fa', verify2FA);
router.put('/toggle-2fa', authenticate, toggle2FA);

// Password Change (requires email verification)
router.post('/request-password-change', authenticate, requestPasswordChange);
router.put('/change-password', authenticate, changePassword);

// Username Change (requires email verification)
router.post('/request-username-change', authenticate, requestUsernameChange);
router.put('/change-username', authenticate, changeUsername);

// Profile Update (no email verification needed)
router.put('/update-profile', authenticate, updateProfile);

// Token verification and logout
router.get('/verify', authenticate, verify);
router.post('/logout', authenticate, logout);

export default router;