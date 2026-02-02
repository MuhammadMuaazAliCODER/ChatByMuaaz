

import nodemailer from "nodemailer";
import crypto from "crypto";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

export const otpStore = new Map();

/* =======================
   SEND OTP
======================= */
export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already registered with this email",
      });
    }

    const otp = crypto.randomInt(100000, 999999);

    otpStore.set(email, {
      otp,
      expires: Date.now() + 5 * 60 * 1000,
      verified: false,
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f8;">
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f4f8;">
    <tr>
      <td style="padding: 40px 20px;">
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 2px solid #e8f0fe;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <div style="width: 50px; height: 50px; background-color: #2563eb; border-radius: 12px; margin: 0 auto 16px; line-height: 50px; text-align: center;">
                      <span style="font-size: 26px;">💬</span>
                    </div>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0; font-size: 26px; font-weight: 600; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                Chat By Muaaz
              </h1>
              <p style="margin: 6px 0 0; font-size: 14px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                Verification Code
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              
              <p style="margin: 0 0 8px; font-size: 16px; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                Assalam-o-Alaikum ,
              </p>
              
              <p style="margin: 0 0 32px; font-size: 15px; line-height: 1.6; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                Use the verification code below to confirm your identity and access your ChatByMuaaz account.
              </p>
              
              <!-- OTP Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 0 0 32px;">
                    <div style="display: inline-block; background-color: #eff6ff; border: 2px solid #2563eb; border-radius: 8px; padding: 20px 48px;">
                      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2563eb; font-family: 'Courier New', monospace;">
                        ${otp}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
              
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 4px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="margin: 0; font-size: 14px; color: #92400e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                      ⏱️ This code will expire in <strong>5 minutes</strong>
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                🔒 For your security, never share this code with anyone. If you didn't request this verification, you can safely ignore this email.
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    
                    <p style="margin: 0 0 4px; font-size: 13px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                      Best regards,
                    </p>
                    <p style="margin: 0 0 2px; font-size: 15px; font-weight: 600; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                      Muhammad Muaaz Ali
                    </p>
                    <p style="margin: 0 0 16px; font-size: 13px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                      Founder, ChatByMuaaz
                    </p>
                    
                   <a href="https://chatbymuaaz.online" style="display: inline-block; padding: 10px 24px; background-color: #ffffff; border: 1.5px solid #2563eb; border-radius: 6px; font-size: 13px; color: #2563eb; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-weight: 500; line-height: 1.4;">
  <span style="vertical-align: middle;">🌐</span> <span style="vertical-align: middle;">Visit ChatByMuaaz</span>
</a>
                    
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
        </table>
        
        <!-- Footer Note -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 20px auto 0;">
          <tr>
            <td style="text-align: center; padding: 0 20px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5;">
                This is an automated message from ChatByMuaaz. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
`;
   

    await transporter.sendMail({
      from: `"ChatByMuaaz" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP - ChatByMuaaz",
      html: htmlTemplate,
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Send OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

/* =======================
   VERIFY OTP
======================= */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const record = otpStore.get(email);

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "OTP not found or expired",
      });
    }

    if (Date.now() > record.expires) {
      otpStore.delete(email);
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    if (record.otp.toString() !== otp.toString()) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    otpStore.set(email, { ...record, verified: true });

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      verified: true,
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
};
