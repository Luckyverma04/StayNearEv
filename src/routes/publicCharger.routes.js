import express from "express";
import { findPublicChargers } from "../services/publicChargers.service.js";

const router = express.Router();

// GET /api/public-chargers?lat=22.72&lng=75.86&radius=15
// Public hai — login ki zaroorat nahi
router.get("/", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Number(req.query.radius ?? 15);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ success: false, message: "Valid lat and lng are required" });
  }
  // 1 se 50 km ke beech
  const radiusKm = Math.min(50, Math.max(1, Number.isFinite(radius) ? Math.round(radius) : 15));

  try {
    const data = await findPublicChargers({ lat, lng, radiusKm });
    res.set("Cache-Control", "public, max-age=600");
    res.json({ success: true, data: { ...data, radiusKm } });
  } catch (err) {
    console.error("❌ Public chargers error:", err.message);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

export default router;
