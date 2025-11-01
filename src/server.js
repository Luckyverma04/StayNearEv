import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import stationRoutes from "./routes/station.routes.js";
import userRoutes from "./routes/user.routes.js";
import bookingRoutes from "./routes/booking.routes.js";

dotenv.config();
const app = express();

// ✅ CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5177",
      "http://127.0.0.1:5177",
      "https://staynearevfrontend.onrender.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Handle preflight requests
app.options("*", cors());

// ✅ JSON parsing and static uploads
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ✅ Routes
app.use("/api/stations", stationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bookings", bookingRoutes);

// ✅ Root route (to show API running)
app.get("/", (req, res) => {
  res.send("✅ StayNearEV Backend API is running successfully!");
});

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Start Server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});