import express from "express";
import {
  createBooking,
  getAvailableSlots,
  getUserBookings,
  getBookingById,
  cancelBooking,
  updateBookingStatus,
  getStationBookings,
  addReview,
} from "../controllers/booking.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

// User routes
router.post("/create", createBooking);
router.get("/available-slots", getAvailableSlots);
router.get("/my-bookings", getUserBookings);
router.get("/:id", getBookingById);
router.put("/:id/cancel", cancelBooking);
router.put("/:id/review", addReview);

// Host routes
router.put("/:id/status", updateBookingStatus);
router.get("/host/my-station-bookings", getStationBookings);

export default router;
