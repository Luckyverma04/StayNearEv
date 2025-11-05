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

// ✅ AUTOMATIC STATUS UPDATE MIDDLEWARE
bookingSchema.pre('save', function(next) {
  const now = new Date();
  
  // Agar booking end time over ho gayi hai aur status completed nahi hai
  if (this.endTime < now && this.status !== 'completed' && this.status !== 'cancelled' && this.status !== 'no-show') {
    this.status = 'completed';
    console.log(`✅ Auto-completed booking ${this._id} - End time passed`);
  }
  
  // Agar booking start time ho gayi hai aur status confirmed hai
  if (this.startTime <= now && this.status === 'confirmed') {
    this.status = 'active';
    console.log(`✅ Auto-activated booking ${this._id} - Start time reached`);
  }
  
  next();
});

// ✅ STATIC METHOD: Auto-update all expired bookings
bookingSchema.statics.autoUpdateExpiredBookings = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      endTime: { $lt: now },
      status: { $in: ['pending', 'confirmed', 'active'] }
    },
    {
      $set: { status: 'completed' }
    }
  );
  
  if (result.modifiedCount > 0) {
    console.log(`✅ Auto-updated ${result.modifiedCount} expired bookings to completed`);
  }
  
  return result;
};

// ✅ STATIC METHOD: Auto-activate ongoing bookings
bookingSchema.statics.autoActivateOngoingBookings = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      startTime: { $lte: now },
      endTime: { $gt: now },
      status: 'confirmed'
    },
    {
      $set: { status: 'active' }
    }
  );
  
  if (result.modifiedCount > 0) {
    console.log(`✅ Auto-activated ${result.modifiedCount} ongoing bookings`);
  }
  
  return result;
};

// Indexes for efficient queries
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ station: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ "vehicleInfo.licensePlate": 1 });
bookingSchema.index({ paymentStatus: 1 });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;