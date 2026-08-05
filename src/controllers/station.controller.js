import Station from "../models/station.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

// ===============================
// Create Station  (koi bhi logged-in user)
// ===============================
export const createStation = async (req, res) => {
  try {
    const { name, location, description, pricePerUnit, amenities, chargerTypes } = req.body;

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated. Please login again.'
      });
    }

    console.log('📝 Creating station:', { name, location, pricePerUnit, createdBy: req.user.userId });

    let imageUrls = [];

    // Upload images to Cloudinary
    if (req.files && req.files.length > 0) {
      console.log(`📤 Starting Cloudinary upload for ${req.files.length} images...`);

      try {
        const uploadPromises = req.files.map(async (file, index) => {
          const result = await uploadToCloudinary(file.buffer);
          console.log(`✅ Image ${index + 1} uploaded:`, result.secure_url);
          return result.secure_url;
        });

        imageUrls = await Promise.all(uploadPromises);
      } catch (uploadError) {
        console.error('❌ Image upload failed:', uploadError);
        return res.status(400).json({
          success: false,
          message: `Image upload failed: ${uploadError.message}`
        });
      }
    }

    const station = new Station({
      name,
      location,
      description,
      pricePerUnit,
      amenities: amenities ? JSON.parse(amenities) : [],
      chargerTypes: chargerTypes ? JSON.parse(chargerTypes) : [],
      images: imageUrls,
      createdBy: req.user.userId,
    });

    await station.save();
    await station.populate('createdBy', 'name email');

    console.log('✅ Station created successfully:', station._id);

    res.status(201).json({
      success: true,
      message: 'Station created successfully',
      station
    });

  } catch (error) {
    console.error('❌ Error creating station:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ===============================
// Get All Stations
// ===============================
export const getAllStations = async (req, res) => {
  try {
    const stations = await Station.find()
      .populate("createdBy", "name email")
      .populate("reviews.user", "name email");
    res.json({ success: true, stations });
  } catch (error) {
    console.error("Get all stations error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stations" });
  }
};

// ===============================
// Get Station by ID
// ===============================
export const getStationById = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("reviews.user", "name email");

    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Station not found"
      });
    }

    res.json({
      success: true,
      station
    });
  } catch (error) {
    console.error("Get station by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch station"
    });
  }
};

// ===============================
// Update Station  (admin ya jisne banaya)
// ===============================
export const updateStation = async (req, res) => {
  try {
    const { name, location, description, pricePerUnit, amenities, chargerTypes } = req.body;
    const station = await Station.findById(req.params.id);

    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }

    const isOwner = station.createdBy?.toString() === req.user.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this station'
      });
    }

    let newImageUrls = [];

    if (req.files && req.files.length > 0) {
      console.log(`📤 Uploading ${req.files.length} new images to Cloudinary...`);

      const uploadPromises = req.files.map(async (file) => {
        try {
          const result = await uploadToCloudinary(file.buffer);
          return result.secure_url;
        } catch (error) {
          console.error('❌ Error uploading to Cloudinary:', error);
          throw new Error('Failed to upload new images');
        }
      });

      newImageUrls = await Promise.all(uploadPromises);
    }

    station.name = name || station.name;
    station.location = location || station.location;
    station.description = description || station.description;
    station.pricePerUnit = pricePerUnit || station.pricePerUnit;
    station.amenities = amenities ? JSON.parse(amenities) : station.amenities;
    station.chargerTypes = chargerTypes ? JSON.parse(chargerTypes) : station.chargerTypes;
    station.images = [...station.images, ...newImageUrls];

    await station.save();
    await station.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Station updated successfully',
      station
    });

  } catch (error) {
    console.error('❌ Error updating station:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ===============================
// Delete Station  (admin ya jisne banaya)
// ===============================
export const deleteStation = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id);
    if (!station) {
      return res.status(404).json({ success: false, message: "Station not found" });
    }

    const isOwner = station.createdBy?.toString() === req.user.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this station"
      });
    }

    await Station.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Station deleted successfully" });
  } catch (error) {
    console.error("Delete station error:", error);
    res.status(500).json({ success: false, message: "Failed to delete station" });
  }
};

// ===============================
// Add Review
// ===============================
export const addReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const station = await Station.findById(id);
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });

    // ⛔ Apne khud ke station par review nahi likh sakte
    if (station.createdBy && station.createdBy.toString() === req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot review your own station"
      });
    }

    const alreadyReviewed = station.reviews.find(
      (rev) => rev.user.toString() === req.user.userId
    );
    if (alreadyReviewed)
      return res.status(400).json({ success: false, message: "You already reviewed this station" });

    const review = {
      user: req.user.userId,
      name: req.user.email.split("@")[0],
      rating: Number(rating),
      comment,
    };

    station.reviews.push(review);
    station.averageRating =
      station.reviews.reduce((acc, item) => item.rating + acc, 0) / station.reviews.length;

    await station.save();
    res.status(201).json({ success: true, message: "Review added successfully", reviews: station.reviews });
  } catch (error) {
    console.error("Add review error:", error);
    res.status(500).json({ success: false, message: "Failed to add review" });
  }
};

// ===============================
// Get Station Reviews
// ===============================
export const getStationReviews = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id).populate("reviews.user", "name email");
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });

    res.json({ success: true, reviews: station.reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
};

// ===============================
// Update Review  (apna review ya admin)
// ===============================
export const updateReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const { rating, comment } = req.body;

    const station = await Station.findById(id);
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });

    const review = station.reviews.id(reviewId);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    if (review.user.toString() !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (rating) review.rating = rating;
    if (comment) review.comment = comment;

    const totalRating = station.reviews.reduce((sum, r) => sum + r.rating, 0);
    station.averageRating = (totalRating / station.reviews.length).toFixed(1);

    await station.save();
    res.status(200).json({ success: true, message: "Review updated successfully", review });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update review" });
  }
};

// ===============================
// Delete Review  (apna review, station owner ya admin)
// ===============================
export const deleteReview = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id);
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });

    const review = station.reviews.id(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    const isReviewAuthor = review.user.toString() === req.user.userId;
    const isStationOwner = station.createdBy?.toString() === req.user.userId;
    const isAdmin = req.user.role === "admin";

    if (!isReviewAuthor && !isStationOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    review.deleteOne();

    // Rating dobara calculate karo
    station.averageRating =
      station.reviews.length > 0
        ? station.reviews.reduce((sum, r) => sum + r.rating, 0) / station.reviews.length
        : 0;

    await station.save();

    res.json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ success: false, message: "Failed to delete review" });
  }
};