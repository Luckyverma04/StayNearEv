import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ✅ FIX: Use correct path - only ONE level up to reach backend root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CORRECT: Go up ONE level from middleware to src, then to uploads
const uploadDir = path.join(__dirname, "..", "uploads");
// Path: src/middleware → src → uploads ✅

// Create directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("✅ Created uploads folder:", uploadDir);
} else {
  console.log("📁 Uploads folder exists:", uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("📤 Multer saving file to:", uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + "-" + uniqueSuffix + ext;
    console.log("📝 Generated filename:", filename);
    cb(null, filename);
  },
});

// ... keep the rest of your code the same
export const upload = multer({ storage, limits, fileFilter });