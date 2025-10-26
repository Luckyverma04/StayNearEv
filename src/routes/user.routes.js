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

// ✅ Export properly for ESM
export default router;
