import { sendOtp } from "../controllers/email.controller.js";
import { verifyOtp } from "../controllers/email.controller.js";
// import { verifyPasswordResetOtp } from "../controllers/email.otp.auth.controller.js";
import { Router } from "express";

const router = Router();

router.post("/send-otp", sendOtp);
router.post("/verifyOtp", verifyOtp);

export default router;