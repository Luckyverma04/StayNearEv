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
} from "../controllers/user.controller.js";

import { authMiddleware, authorize } from "../middleware/auth.middleware.js";
import { UserRole } from "../models/user.model.js";
import { testResend } from "../utils/resendService.utils.js";

const router = express.Router();

// ---------------- Public routes ----------------
router.post("/signup", signup);
router.post("/login", login);
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
router.get("/test-email", async (req, res) => {
  try {
    console.log("🧪 Starting email test...");

    const result = await testResend();

    res.json({
      success: true,
      message: "✅ Email test triggered! Check your Gmail inbox.",
      result,
    });
  } catch (error) {
    console.error("❌ Email test route error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;