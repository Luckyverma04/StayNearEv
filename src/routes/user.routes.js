import express from "express";
import {
  signup,
  login,
  verifyEmail,
  getProfile,
  verifyHost,
  getAllHosts,
  deleteUser,
  deleteMyAccount,
  createAdmin,
  resetAdminPassword,
  manualVerifyEmail,
} from "../controllers/user.controller.js";

import { authMiddleware } from "../middleware/auth.middleware.js";
import { testResend } from "../utils/resendService.utils.js";

const router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-email", verifyEmail);

// Protected routes
router.get("/profile", authMiddleware, getProfile);
router.get("/hosts", authMiddleware, getAllHosts);
router.put("/verify-host/:hostId", authMiddleware, verifyHost);
router.delete("/me", authMiddleware, deleteMyAccount);
router.delete("/delete/:id", authMiddleware, deleteUser);
router.post("/manual-verify", manualVerifyEmail);

// Email test route (CORRECTED)
router.get("/test-email", async (req, res) => {
  try {
    console.log("🧪 Starting email test...");

    const result = await testResend(); // ✅ Correct function

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
