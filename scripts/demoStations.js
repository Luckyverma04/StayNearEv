// scripts/demoStations.js
// -----------------------------------------------------------------------------
//  Testing ke liye Indore me nakli (demo) charging stations.
//
//    npm run demo:add     → 12 demo stations daalo (pehle wale demo hata ke)
//    npm run demo:remove  → saare demo stations (aur unki bookings) hatao
//
//  - Har station par isDemo: true aur naam me "[Demo]" hota hai.
//  - Live frontend inhe CHHUPA deta hai. Dikhane ke liye frontend .env me:
//        VITE_SHOW_DEMO=true
//  - Demo owner: demo-owner@staynearev.test (login nahi kar sakta, sirf owner ke liye)
// -----------------------------------------------------------------------------
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import crypto from "crypto";
import Station from "../src/models/station.model.js";
import Booking from "../src/models/booking.model.js";
import { User, UserRole } from "../src/models/user.model.js";

const DEMO_OWNER_EMAIL = "demo-owner@staynearev.test";

const DEMO = [
  ["Vijay Nagar FastCharge", "Vijay Nagar, Indore", 22.7533, 75.8937, 18, ["CCS2", "Type 2"], ["Parking", "Cafe", "Restroom"]],
  ["Rajwada EV Point", "Rajwada, Indore", 22.7186, 75.8553, 14, ["Type 2", "Bharat AC001"], ["Parking"]],
  ["Palasia Supercharge Hub", "Palasia Square, Indore", 22.7243, 75.8839, 20, ["CCS2", "CHAdeMO"], ["Parking", "WiFi", "Cafe"]],
  ["Bhawarkua Green Plug", "Bhawarkua, Indore", 22.6930, 75.8670, 15, ["Type 2"], ["Parking"]],
  ["AB Road Charge Stop", "AB Road, Indore", 22.7449, 75.8932, 19, ["CCS2"], ["Parking", "Restroom"]],
  ["Rau Highway EV Halt", "Rau, Indore", 22.6400, 75.8100, 17, ["CCS2", "Bharat DC001"], ["Parking", "Food court"]],
  ["Super Corridor Volt", "Super Corridor, Indore", 22.7840, 75.8400, 16, ["Type 2", "CCS2"], ["Parking", "WiFi"]],
  ["Sapna Sangeeta Charge Bay", "Sapna Sangeeta, Indore", 22.7010, 75.8600, 15, ["Type 2"], ["Parking", "Shopping"]],
  ["Nipania Smart Charge", "Nipania, Indore", 22.7600, 75.9200, 18, ["CCS2", "Type 2"], ["Parking", "Cafe"]],
  ["Airport Road EV Hub", "Airport Road, Indore", 22.7230, 75.8020, 21, ["CCS2", "CHAdeMO", "Type 2"], ["Parking", "Restroom", "WiFi"]],
  ["Bypass Quick Charge", "Bypass Road, Indore", 22.7056, 75.9102, 19, ["CCS2"], ["Parking"]],
  ["Old Palasia Home Charger", "Old Palasia, Indore", 22.7280, 75.8790, 12, ["Bharat AC001"], ["Parking"]],
];

const connect = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI missing in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const { host, name } = mongoose.connection;
  console.log(`🗄️  Connected to ${host} / ${name}`);
};

const removeDemo = async () => {
  const ids = (await Station.find({ isDemo: true }).select("_id")).map((s) => s._id);
  const b = await Booking.deleteMany({ station: { $in: ids } });
  const s = await Station.deleteMany({ isDemo: true });
  console.log(`🧹 Removed ${s.deletedCount} demo stations and ${b.deletedCount} demo bookings`);
};

const getDemoOwner = async () => {
  let owner = await User.findOne({ email: DEMO_OWNER_EMAIL });
  if (!owner) {
    owner = await User.create({
      name: "Demo Station Owner",
      email: DEMO_OWNER_EMAIL,
      // Random password — is account se koi login nahi karega
      password: crypto.randomBytes(24).toString("hex"),
      role: UserRole.CUSTOMER,
      isEmailVerified: true,
    });
    console.log(`👤 Created demo owner (${DEMO_OWNER_EMAIL})`);
  }
  return owner;
};

const addDemo = async () => {
  await removeDemo();
  const owner = await getDemoOwner();
  const docs = DEMO.map(([name, location, latitude, longitude, pricePerUnit, chargerTypes, amenities]) => ({
    name: `[Demo] ${name}`,
    location,
    latitude,
    longitude,
    pricePerUnit,
    chargerTypes,
    amenities,
    description: "Demo station for testing StayNearEV. Not a real charger.",
    images: [],
    createdBy: owner._id,
    isDemo: true,
  }));
  await Station.insertMany(docs);
  console.log(`✅ Added ${docs.length} demo stations in Indore`);
  console.log("   Frontend me dikhane ke liye .env me: VITE_SHOW_DEMO=true");
};

const main = async () => {
  const cmd = process.argv[2];
  if (!["add", "remove"].includes(cmd)) {
    console.log("Usage: npm run demo:add  |  npm run demo:remove");
    process.exit(1);
  }
  await connect();
  try {
    if (cmd === "add") await addDemo();
    else await removeDemo();
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
