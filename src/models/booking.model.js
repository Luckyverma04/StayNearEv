// models/Booking.js
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    station: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Station",
      required: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    duration: {
      type: Number, // in minutes
      required: true
    },
    totalCost: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled', 'no-show'],
      default: 'pending'
    },
   vehicleInfo: {
  vehicleType: {
    type: String,
    enum: [
      'car', 'bike', 'scooter', 
      'Electric Car', 'Electric Bike', 'Electric Scooter', 'Electric Auto'
    ],
    required: true
  },
      model: String,
      licensePlate: {
        type: String,
        required: true
      },
      batteryCapacity: Number // in kWh
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'wallet', 'cash', 'upi'],
      default: 'card'
    },
    transactionId: String,
    energyConsumed: {
      type: Number, // in kWh
      default: 0
    },
    finalCost: {
      type: Number // Actual cost after charging
    },
    notes: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    cancellationReason: String,
    cancelledBy: {
      type: String,
      enum: ['user', 'host', 'system']
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ station: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ "vehicleInfo.licensePlate": 1 });
bookingSchema.index({ paymentStatus: 1 });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;