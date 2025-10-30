import Station from "../models/station.model.js";
import path from "path";
import fs from "fs";

// ===============================
// Create Station
export const createStation = async (req, res) => {
  try {
    const { name, location, pricePerUnit, description, amenities, chargerTypes } = req.body;

    // Parse chargerTypes if it's a string (from frontend)
    let parsedChargerTypes = [];
    if (chargerTypes) {
      if (typeof chargerTypes === 'string') {
        parsedChargerTypes = JSON.parse(chargerTypes);
      } else {
        parsedChargerTypes = chargerTypes;
      }
    }

    const station = await Station.create({
      name,
      location,
      pricePerUnit,
      description,
      chargerTypes: parsedChargerTypes, // Add this line
      amenities: amenities ? amenities.split(",").map(a => a.trim()) : [],
      images: req.files ? req.files.map((file) => `/uploads/${file.filename}`) : [],
      host: req.user.userId,
    });

    res.status(201).json({
      success: true,
      message: "Station created successfully",
      station,
    });
  } catch (error) {
    console.error("Create station error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create station",
    });
  }
};
// ===============================
// Get All Stations
// ===============================
export const getAllStations = async (req, res) => {
  try {
    const stations = await Station.find().populate("reviews.user", "name email");
    res.json({ success: true, stations });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch stations" });
  }
};

// ===============================
// Get Station by ID
// ===============================
export const getStationById = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id)
      .populate("host", "name email username") // ADD THIS LINE - populate host
      .populate("reviews.user", "name email"); // Keep existing review user population
    
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
// Update Station
// ===============================
export const updateStation = async (req, res) => {
  try {
    const { name, location, pricePerUnit, description, amenities, chargerTypes } = req.body;

    // Parse chargerTypes if it's a string
    let parsedChargerTypes = [];
    if (chargerTypes) {
      if (typeof chargerTypes === 'string') {
        parsedChargerTypes = JSON.parse(chargerTypes);
      } else {
        parsedChargerTypes = chargerTypes;
      }
    }

    const updateData = {
      name,
      location,
      pricePerUnit,
      description,
      chargerTypes: parsedChargerTypes, // Add this line
      amenities: amenities ? amenities.split(",").map(a => a.trim()) : [],
    };

    // ... rest of your update logic
  } catch (error) {
    console.error("Update station error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update station",
    });
  }
};

// ===============================
// Delete Station
// ===============================
export const deleteStation = async (req, res) => {
  try {
    const station = await Station.findByIdAndDelete(req.params.id);
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });

    res.json({ success: true, message: "Station deleted successfully" });
  } catch (error) {
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
// Update Review
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
// Delete Review
// ===============================
export const deleteReview = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id);
    if (!station) return res.status(404).json({ success: false, message: "Station not found" });

    const review = station.reviews.id(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    if (review.user.toString() !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    review.deleteOne();
    await station.save();

    res.json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete review" });
  }
};
