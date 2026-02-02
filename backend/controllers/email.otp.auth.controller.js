import crypto from "crypto";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from '../models/User.js';;

let user = User;
dotenv.config();

export const otpStore = new Map();


export const sendPasswordResetOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json(new ApiError(400, "Email is required"));

    const User = await user.findOne({ email });
    if (!User)
      return res.status(404).json(new ApiError(404, "User not found"));

    const otp = crypto.randomInt(100000, 999999).toString();
    otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const htmlTemplate = `
      <div style="background-color: #f3f6fa; padding: 40px 20px; font-family: 'Segoe UI', Arial, sans-serif; color: #333;">
        <div style="max-width: 550px; background: #ffffff; border-radius: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.08); margin: 0 auto; overflow: hidden;">
          <div style="background-color: #0078ff; padding: 20px 0; text-align: center;">
            <h1 style="color: #fff; font-size: 26px; margin: 0;">Code With Muaaz</h1>
          </div>
          <div style="padding: 30px 25px;">
            <p style="font-size: 16px; margin-bottom: 10px;">Assalam-o-Alaikum 👋,</p>
            <p style="font-size: 15px; margin-bottom: 25px;">
              We received a request to reset your password for your <strong>CodeWithMuaaz</strong> account.  
              Please use the following One-Time Password (OTP) to proceed:
            </p>
            <div style="background-color: #0078ff; color: #ffffff; text-align: center; font-size: 28px; font-weight: bold; padding: 12px 0; border-radius: 8px; letter-spacing: 3px; margin-bottom: 25px;">
              ${otp}
            </div>
            <p style="font-size: 14px; color: #555;">
              ⚠️ This OTP will expire in <strong>5 minutes</strong>.  
              If you didn’t request a password reset, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
            <div style="text-align: center; font-size: 13px; color: #777;">
              <p style="margin-bottom: 4px;">Kind Regards,</p>
              <p style="font-weight: 600; color: #0078ff;">Muhammad Muaaz Ali</p>
              <p>Code With Muaaz</p>
              <a href="https://codewithmuaaz.online" style="color:#0078ff; text-decoration:none; font-size: 13px;">
                🌐 codewithmuaaz.online
              </a>
            </div>
          </div>
        </div>
      </div>`;

    await transporter.sendMail({
      from: `"Code With Muaaz" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset OTP",
      html: htmlTemplate,
    });

    return res.status(200).json(new Apiresponse(200, "OTP sent successfully"));
  } catch (error) {
    return res.status(500).json(new ApiError(500, error.message));
  }
};


export const verifyPasswordResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res
        .status(400)
        .json(new ApiError(400, "Email and OTP are required"));

    const stored = otpStore.get(email);
    if (!stored) return res.status(400).json(new ApiError(400, "No OTP found"));

    if (stored.expiresAt < Date.now()) {
      otpStore.delete(email);
      return res.status(400).json(new ApiError(400, "OTP expired"));
    }

    if (stored.otp !== otp)
      return res.status(400).json(new ApiError(400, "Invalid OTP"));

    otpStore.set(email, { ...stored, verified: true });

    return res
      .status(200)
      .json(new Apiresponse(200, "OTP verified successfully"));
  } catch (error) {
    return res.status(500).json(new ApiError(500, error.message));
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res
        .status(400)
        .json(new ApiError(400, "Email and new password are required."));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json(new ApiError(400, "Please provide a valid email address."));
    }

    function validatePasswordDetailed(pwd) {
      const errors = [];
      if (pwd.length < 8) errors.push("at least 8 characters");
      if (!/[a-z]/.test(pwd)) errors.push("one lowercase letter (a-z)");
      if (!/[A-Z]/.test(pwd)) errors.push("one uppercase letter (A-Z)");
      if (!/\d/.test(pwd)) errors.push("one digit (0-9)");
      if (!/[^\w\s]/.test(pwd)) errors.push("one special character (e.g. !@#$%)");
      return errors;
    }

    const pwdErrors = validatePasswordDetailed(newPassword);
    if (pwdErrors.length) {
      const msg = `Password must contain ${pwdErrors.join(", ")}.`;
      return res.status(400).json(new ApiError(400, msg));
    }

    const stored = otpStore.get(email);
    if (!stored || !stored.verified) {
      return res
        .status(400)
        .json(new ApiError(400, "OTP not verified or expired."));
    }
    
    const User = await user.findOne({ email });
    if (!User) {
      return res.status(404).json(new ApiError(404, "User not found."));
    }
   
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.updateOne({ email }, { $set: { password: hashedPassword } });

    otpStore.delete(email);
   
    return res
      .status(200)
      .json(new Apiresponse(200, {}, "Password updated successfully."));
  } catch (error) {
    console.error("Error updating password:", error);
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Something went wrong."));
  }
};