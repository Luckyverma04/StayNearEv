import express from "express";
import {
  createBooking,
  getAvailableSlots,
  getUserBookings,
  getMyStationBookings,
  getBookingById,
  cancelBooking,
  updateBookingStatus,
  addReview,
  getAllBookings,
  autoUpdateExpiredBookings
} from "../controllers/booking.controller.js";
import { authMiddleware, authorize } from "../middleware/auth.middleware.js";
import { UserRole } from "../models/user.model.js";

const router = express.Router();

router.use(authMiddleware);

// ⚠️ Fixed routes hamesha "/:id" se PEHLE aane chahiye,
//    warna Express unhe booking id samajh leta hai.

// ---- Admin routes ----
router.get("/admin/bookings", authorize(UserRole.ADMIN), getAllBookings);
router.get("/auto-update", authorize(UserRole.ADMIN), autoUpdateExpiredBookings);

// ---- User routes ----
router.post("/create", createBooking);
router.get("/available-slots", getAvailableSlots);
router.get("/my-bookings", getUserBookings);
router.get("/my-station-bookings", getMyStationBookings);

// ---- Dynamic id routes (sabse aakhir me) ----
router.get("/:id", getBookingById);
router.put("/:id/cancel", cancelBooking);
router.put("/:id/review", addReview);
router.put("/:id/status", updateBookingStatus);

export default router;