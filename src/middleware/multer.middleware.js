import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ✅ FIX: Use correct __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ FIX: Go up TWO levels to reach backend/uploads (from src/middleware/)
const uploadDir = path.join(__dirname, "..", "..", "uploads");

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

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|avif/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;
  
  console.log("🔍 Checking file:", { originalname: file.originalname, ext, mime });
  
  const isValid = allowed.test(ext) && allowed.test(mime);
  
  if (!isValid) {
    console.log("❌ File rejected:", file.originalname);
    return cb(new Error("Only image files (JPEG, JPG, PNG, WEBP, AVIF) are allowed!"), false);
  }
  
  console.log("✅ File accepted:", file.originalname);
  cb(null, true);
};

export const upload = multer({
  storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 // Maximum 5 files
  },
  fileFilter,
});

console.log("🔧 Multer configured with upload directory:", uploadDir);