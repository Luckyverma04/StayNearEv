import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// ⚠️ ZAROORI: ye cloudinary.config() se PEHLE chalna chahiye.
// server.js ke imports pehle chalte hain, isliye wahan ka dotenv.config()
// yaha tak time par nahi pahunchta.
dotenv.config();

// Configure Cloudinary with proper error handling
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Startup par ek baar check — credentials mili ya nahi
console.log('☁️ Cloudinary config:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '❌ MISSING',
  api_key: process.env.CLOUDINARY_API_KEY ? '✅' : '❌ MISSING',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '✅' : '❌ MISSING',
});

// Upload image to Cloudinary with better error handling
export const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer) {
      return reject(new Error('No file buffer provided'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'staynearev',
        format: 'webp',
        quality: 'auto',
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          // Cloudinary ka error kabhi kabhi plain object hota hai,
          // isliye asli Error me convert kar rahe hain
          reject(new Error(error.message || 'Cloudinary upload failed'));
        } else {
          console.log('✅ Cloudinary upload successful:', result.secure_url);
          resolve(result);
        }
      }
    );

    uploadStream.on('error', (error) => {
      console.error('❌ Cloudinary stream error:', error);
      reject(new Error(error.message || 'Cloudinary stream failed'));
    });

    uploadStream.end(fileBuffer);
  });
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

export { cloudinary };