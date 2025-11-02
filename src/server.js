import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import stationRoutes from "./routes/station.routes.js";
import userRoutes from "./routes/user.routes.js";
import bookingRoutes from "./routes/booking.routes.js";

dotenv.config();
const app = express();

// ✅ Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CORS Configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5177",
      "http://127.0.0.1:5177",
      "https://staynearevfrontend.onrender.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.get('/api/test-cloudinary', async (req, res) => {
  try {
    const cloudinary = require('cloudinary').v2;
    
    // Test configuration
    const config = cloudinary.config();
    console.log('🔧 Cloudinary Config:', {
      cloud_name: config.cloud_name,
      api_key: config.api_key ? '✅ Set' : '❌ Missing',
      api_secret: config.api_secret ? '✅ Set' : '❌ Missing'
    });
    
    res.json({
      success: true,
      cloud_name: config.cloud_name,
      api_key_set: !!config.api_key,
      api_secret_set: !!config.api_secret
    });
  } catch (error) {
    console.error('❌ Cloudinary test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.options("*", cors());
app.use(express.json());

// ✅ Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ API Routes
app.use("/api/users", userRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/bookings", bookingRoutes);

// ✅ Root Route
app.get("/", (req, res) => {
  res.send("✅ StayNearEV Backend API is running successfully!");
});

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
