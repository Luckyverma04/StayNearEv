import multer from "multer";
import path from "path"; // ✅ ADD THIS LINE

// Use memory storage for Cloudinary
const storage = multer.memoryStorage();

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

const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB
  files: 5
};

export const upload = multer({
  storage,
  limits,
  fileFilter
});

console.log("🔧 Multer configured with memory storage for Cloudinary");