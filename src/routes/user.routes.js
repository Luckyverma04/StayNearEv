import express from "express";
import {
  signup,
  login,
  verifyOtp,
  resendOtp,
  getProfile,
  getPendingUsers,
  verifyUserByAdmin,
  getAllUsers,
  deleteUser,
  deleteMyAccount,
  createAdmin,
  googleLogin,
} from "../controllers/user.controller.js";

import { authMiddleware, authorize } from "../middleware/auth.middleware.js";
import { UserRole } from "../models/user.model.js";
import { sendTestEmail } from "../utils/mailer.utils.js";

const router = express.Router();

// ---------------- Public routes ----------------
router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// ---------------- Setup route ----------------
router.post("/create-admin", createAdmin);

// ---------------- Protected (any logged in user) ----------------
router.get("/profile", authMiddleware, getProfile);
router.delete("/me", authMiddleware, deleteMyAccount);

// ---------------- Admin only ----------------
router.get(
  "/pending",
  authMiddleware,
  authorize(UserRole.ADMIN),
  getPendingUsers
);
router.patch(
  "/verify/:id",
  authMiddleware,
  authorize(UserRole.ADMIN),
  verifyUserByAdmin
);
router.get("/all", authMiddleware, authorize(UserRole.ADMIN), getAllUsers);
router.delete(
  "/delete/:id",
  authMiddleware,
  authorize(UserRole.ADMIN),
  deleteUser
);

// ---------------- Email test route ----------------
// Sirf admin chala sakta hai, aur mail admin ke apne email par jaata hai
router.get(
  "/test-email",
  authMiddleware,
  authorize(UserRole.ADMIN),
  async (req, res) => {
  try {
    console.log("🧪 Starting email test...");

    const result = await sendTestEmail(req.user.email);

    res.json({
      success: true,
      message: `✅ Test email sent to ${req.user.email}`,
      result,
    });
  } catch (error) {
    console.error("❌ Email test route error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
  }
);

export default router;