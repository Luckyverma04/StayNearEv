import express from "express";
import {
  createStation,
  getAllStations,
  getStationById,
  updateStation,
  deleteStation,
  addReview,
  getStationReviews,
  updateReview,
  deleteReview,
} from "../controllers/station.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = express.Router();

// ---- Public ----
router.get("/", getAllStations);
router.get("/:id", getStationById);
router.get("/:id/reviews", getStationReviews);

// ---- Koi bhi logged-in user station bana sakta hai ----
// Edit/delete ka check controller me hai: sirf owner ya admin
router.post("/", authMiddleware, upload.array("images", 5), createStation);
router.put("/:id", authMiddleware, upload.array("images", 5), updateStation);
router.delete("/:id", authMiddleware, deleteStation);

// ---- Reviews ----
router.post("/:id/reviews", authMiddleware, addReview);
router.put("/:id/reviews/:reviewId", authMiddleware, updateReview);
router.delete("/:id/reviews/:reviewId", authMiddleware, deleteReview);

export default router;