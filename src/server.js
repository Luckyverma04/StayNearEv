// ⚠️ dotenv sabse pehle
import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import stationRoutes from "./routes/station.routes.js";
import userRoutes from "./routes/user.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import publicChargerRoutes from "./routes/publicCharger.routes.js";

const app = express();

// =====================================================
// ✅ ESM __dirname
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// 🌐 ENVIRONMENT
// =====================================================

const PORT = process.env.PORT || 3002;

const MONGODB_URI = process.env.MONGODB_URI;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://staynearevfrontend.onrender.com";

// Optional: multiple frontend URLs
const FRONTEND_URLS = [
  FRONTEND_URL,
  ...(process.env.FRONTEND_URLS
    ? process.env.FRONTEND_URLS
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
    : []),
];

// Local development URLs
const LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5177",
  "http://127.0.0.1:5177",
];

// Remove duplicates
const allowedOrigins = [
  ...new Set([
    ...LOCAL_ORIGINS,
    ...FRONTEND_URLS,
  ]),
];

console.log("🌐 Allowed CORS origins:");
allowedOrigins.forEach((origin) => {
  console.log(`   → ${origin}`);
});

// =====================================================
// 🛡️ CORS CONFIGURATION
// =====================================================

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without Origin
    // Postman / Thunder Client / server-to-server
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error(
      `❌ CORS blocked origin: ${origin}`
    );

    return callback(
      new Error("Not allowed by CORS")
    );
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-setup-key",
  ],

  credentials: true,

  optionsSuccessStatus: 204,
};

// =====================================================
// 🌐 CORS MIDDLEWARE
// =====================================================

app.use(cors(corsOptions));

// =====================================================
// 📦 BODY PARSER
// =====================================================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// =====================================================
// 📁 STATIC UPLOADS
// =====================================================

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads")
  )
);

// =====================================================
// ❤️ API HEALTH CHECK
// =====================================================

// This fixes:
// GET https://staynearev.onrender.com/api
// Cannot GET /api

app.get("/api", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "🚀 StayNearEV API is running",
    version: "1.0.0",
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

// =====================================================
// 🔐 API ROUTES
// =====================================================

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/stations",
  stationRoutes
);

app.use(
  "/api/bookings",
  bookingRoutes
);

// Public EV chargers (OpenStreetMap + Open Charge Map)
app.use(
  "/api/public-chargers",
  publicChargerRoutes
);

// =====================================================
// 🏠 ROOT ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    message:
      "🚀 StayNearEV Backend API is running",
    api: "/api",
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

// =====================================================
// ❌ 404 HANDLER
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    status: "ERROR",
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// =====================================================
// 🚨 GLOBAL ERROR HANDLER
// =====================================================

app.use(
  (err, req, res, next) => {
    console.error(
      "❌ Server Error:",
      err.message
    );

    // CORS error
    if (
      err.message ===
      "Not allowed by CORS"
    ) {
      return res.status(403).json({
        status: "ERROR",
        message:
          "CORS policy blocked this origin",
        origin:
          req.headers.origin || null,
      });
    }

    return res.status(500).json({
      status: "ERROR",
      message:
        "Internal server error",
    });
  }
);

// =====================================================
// 🗄️ MONGODB CONNECTION
// =====================================================

if (!MONGODB_URI) {
  console.error(
    "❌ MONGODB_URI is missing in environment variables"
  );
} else {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log(
        "✅ MongoDB connected successfully"
      );
    })
    .catch((err) => {
      console.error(
        "❌ MongoDB connection error:",
        err.message
      );
    });
}

// =====================================================
// 🚀 START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT}`
  );

  console.log(
    `🌐 Backend URL: https://staynearev.onrender.com`
  );

  console.log(
    `🌐 Frontend URL: ${FRONTEND_URL}`
  );

  console.log(
    `❤️ API Health: https://staynearev.onrender.com/api`
  );
});