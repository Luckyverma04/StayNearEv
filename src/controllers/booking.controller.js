// controllers/bookingController.js
import Booking from '../models/booking.model.js';
import Station from '../models/station.model.js';
import { User } from '../models/user.model.js';

// ✅ Create a new booking
export const createBooking = async (req, res) => {
  try {
    const {
      stationId,
      startTime,
      duration,
      vehicleInfo
    } = req.body;

    const userId = req.user.userId;

    console.log('🔍 User ID from auth:', userId);

    // Validate input
    if (!stationId || !startTime || !duration || !vehicleInfo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: stationId, startTime, duration, vehicleInfo'
      });
    }

    // Check if station exists
    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Station not found'
      });
    }

    // ⛔ Apna khud ka station book nahi kar sakte
    if (station.createdBy && station.createdBy.toString() === userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You cannot book your own station'
      });
    }

    const startDateTime = new Date(startTime);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    // Time validation with buffer
    const now = new Date();
    const bufferTime = 30 * 60 * 1000; // 30 minutes buffer

    // Allow booking if start time is at least 30 minutes from now
    if (startDateTime < (now.getTime() + bufferTime)) {
      return res.status(400).json({
        success: false,
        message: 'Booking must be at least 30 minutes from current time'
      });
    }

    // Check for overlapping bookings for this station
    const overlappingBooking = await Booking.findOne({
      station: stationId,
      status: { $in: ['confirmed', 'active'] },
      $or: [
        {
          startTime: { $lt: endDateTime },
          endTime: { $gt: startDateTime }
        }
      ]
    });

    if (overlappingBooking) {
      return res.status(400).json({
        success: false,
        message: 'Time slot is already booked at this station'
      });
    }

    // Calculate cost based on station's pricePerUnit and estimated energy
    const estimatedEnergy = (7 * duration) / 60; // kWh
    const totalCost = estimatedEnergy * station.pricePerUnit;

    // Create booking
    const booking = new Booking({
      user: userId,
      station: stationId,
      startTime: startDateTime,
      endTime: endDateTime,
      duration,
      totalCost,
      vehicleInfo
    });

    await booking.save();

    await booking.populate('station', 'name location pricePerUnit amenities');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ✅ AUTO-UPDATE EXPIRED BOOKINGS (Admin/System function)
export const autoUpdateExpiredBookings = async (req, res) => {
  try {
    const result = await Booking.autoUpdateExpiredBookings();
    const activateResult = await Booking.autoActivateOngoingBookings();

    res.json({
      success: true,
      message: 'Auto-update completed successfully',
      data: {
        completed: result.modifiedCount,
        activated: activateResult.modifiedCount,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Auto-update bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ✅ GET ALL BOOKINGS (admin)
export const getAllBookings = async (req, res) => {
  try {
    const user = req.user;
    const { page = 1, limit = 10, status } = req.query;

    // ✅ AUTO-UPDATE before fetching (only for admin)
    if (user.role === 'admin') {
      await Booking.autoUpdateExpiredBookings();
      await Booking.autoActivateOngoingBookings();
    }

    const query = {};
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('user', 'name email')
      .populate('station', 'name location createdBy pricePerUnit')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBookings: total,
      },
    });
  } catch (error) {
    console.error("Get all bookings (admin) error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ✅ Get available time slots for a station
export const getAvailableSlots = async (req, res) => {
  try {
    const { stationId, date, duration = 60 } = req.query;

    if (!stationId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Station ID and date are required'
      });
    }

    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Station not found'
      });
    }

    const selectedDate = new Date(date);
    const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

    // Get existing bookings for the day
    const existingBookings = await Booking.find({
      station: stationId,
      status: { $in: ['confirmed', 'active'] },
      startTime: { $gte: startOfDay, $lte: endOfDay }
    });

    // Generate available time slots (8 AM to 10 PM)
    const availableSlots = [];
    const timeSlots = [];

    for (let hour = 8; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) { // 30-minute intervals
        const slotTime = new Date(selectedDate);
        slotTime.setHours(hour, minute, 0, 0);

        // Skip if slot time is before current time for today
        if (selectedDate.toDateString() === new Date().toDateString() &&
            slotTime < new Date()) {
          continue;
        }

        timeSlots.push(slotTime);
      }
    }

    // ✅ 1-hour buffer between bookings
    const bufferTime = 60 * 60 * 1000; // 1 hour in milliseconds

    // Check availability for each time slot
    for (const slotTime of timeSlots) {
      const slotEndTime = new Date(slotTime.getTime() + duration * 60000);

      const isConflict = existingBookings.some(booking => {
        const bookingStartWithBuffer = new Date(booking.startTime.getTime() - bufferTime);
        const bookingEndWithBuffer = new Date(booking.endTime.getTime() + bufferTime);

        return (
          (slotTime < bookingEndWithBuffer && slotEndTime > bookingStartWithBuffer)
        );
      });

      if (!isConflict && slotEndTime <= new Date(selectedDate.setHours(22, 0, 0, 0))) {
        const estimatedEnergy = (7 * duration) / 60;
        const estimatedCost = estimatedEnergy * station.pricePerUnit;

        availableSlots.push({
          startTime: slotTime,
          endTime: slotEndTime,
          duration,
          estimatedEnergy,
          estimatedCost
        });
      }
    }

    res.json({
      success: true,
      data: {
        station: {
          name: station.name,
          location: station.location,
          pricePerUnit: station.pricePerUnit,
          amenities: station.amenities
        },
        availableSlots
      }
    });

  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ✅ Get user's bookings
export const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const query = { user: userId };
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('station', 'name location images pricePerUnit')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBookings: total
      }
    });

  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ✅ Get booking by ID  — apni booking ya admin
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name email')
      .populate('station', 'name location createdBy pricePerUnit amenities');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const isOwner = booking.user._id.toString() === req.user.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking'
      });
    }

    res.json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ✅ Cancel booking
export const cancelBooking = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const bookingId = req.params.id;
    const userId = req.user.userId;

    const booking = await Booking.findOne({
      _id: bookingId,
      user: userId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Only allow cancellation for pending and confirmed bookings
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel booking in current status'
      });
    }

    // Check if booking starts within 1 hour (no cancellation allowed)
    const timeUntilBooking = booking.startTime - new Date();
    if (timeUntilBooking < 60 * 60 * 1000) { // 1 hour
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel booking within 1 hour of start time'
      });
    }

    booking.status = 'cancelled';
    booking.cancellationReason = cancellationReason;
    booking.cancelledBy = 'user';
    await booking.save();

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ✅ Get bookings for MY stations (jo maine banaye hain)
export const getMyStationBookings = async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;

    // Meri banayi hui stations
    const stations = await Station.find({ createdBy: ownerId }).select('_id');
    const stationIds = stations.map((s) => s._id);

    if (stationIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { currentPage: 1, totalPages: 0, totalBookings: 0 },
      });
    }

    const query = { station: { $in: stationIds } };
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('user', 'name email')
      .populate('station', 'name location pricePerUnit')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBookings: total,
      },
    });
  } catch (error) {
    console.error('Get my station bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ✅ Update booking status (station owner ya admin)
export const updateBookingStatus = async (req, res) => {
  try {
    const { status, energyConsumed, notes } = req.body;
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId).populate('station');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const isAdmin = req.user.role === 'admin';
    const isStationOwner =
      booking.station?.createdBy?.toString() === req.user.userId;

    if (!isAdmin && !isStationOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this booking'
      });
    }

    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['active', 'cancelled'],
      'active': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };

    if (!validTransitions[booking.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${booking.status} to ${status}`
      });
    }

    booking.status = status;

    // Update final cost if energy consumed is provided
    if (energyConsumed) {
      booking.energyConsumed = energyConsumed;
      booking.finalCost = energyConsumed * booking.station.pricePerUnit;
    }

    if (notes) booking.notes = notes;

    if (status === 'cancelled') {
      booking.cancelledBy = isAdmin ? 'admin' : 'owner';
    }

    await booking.save();

    res.json({
      success: true,
      message: `Booking ${status} successfully`,
      data: booking
    });

  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ✅ Add review to booking
export const addReview = async (req, res) => {
  try {
    const { rating, review } = req.body;
    const bookingId = req.params.id;
    const userId = req.user.userId;

    const booking = await Booking.findOne({
      _id: bookingId,
      user: userId,
      status: 'completed'
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not completed'
      });
    }

    if (booking.rating) {
      return res.status(400).json({
        success: false,
        message: 'Review already submitted for this booking'
      });
    }

    booking.rating = rating;
    booking.review = review;
    await booking.save();

    // Update station's average rating
    const station = await Station.findById(booking.station);
    const stationBookings = await Booking.find({
      station: booking.station,
      rating: { $exists: true }
    });

    const totalRating = stationBookings.reduce((sum, b) => sum + b.rating, 0);
    station.averageRating = totalRating / stationBookings.length;
    await station.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: booking
    });

  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};