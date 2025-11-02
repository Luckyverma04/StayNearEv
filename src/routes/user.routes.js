import express from "express";
import { testEmailConnection } from "../utils/emailService.utils.js";
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
router.get("/test-email", async (req, res) => {
  try {
    console.log("🧪 Starting email test...");
    const result = await testEmailConnection();
    
    if (result) {
      res.json({ 
        success: true, 
        message: "✅ Email test completed successfully! Check your Gmail inbox and server logs for details." 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: "❌ Email test failed. Check server logs for error details." 
      });
    }
  } catch (error) {
    console.error("❌ Email test route error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
export default router;
