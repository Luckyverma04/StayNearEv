import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
  },
  { timestamps: true }
);

const stationSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Station name is required"], trim: true },
    location: { type: String, required: [true, "Location is required"], trim: true },
    description: { type: String, required: [true, "Description is required"] },
    pricePerUnit: { type: Number, required: [true, "Price per unit is required"] },
    amenities: { type: [String], default: [] },
    images: { type: [String], default: [] },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviews: { type: [reviewSchema], default: [] },
    averageRating: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Station = mongoose.model("Station", stationSchema);
export default Station;
