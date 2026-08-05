import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const UserRole = {
  CUSTOMER: "customer",
  ADMIN: "admin",
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // ---- OTP based email verification ----
    emailOtp: {
      type: String,
      select: false, // hashed OTP, kabhi client ko na jaye
    },
    emailOtpExpires: Date,
    otpAttempts: {
      type: Number,
      default: 0,
    },
    otpLastSentAt: Date,

    // Admin ne manually verify kiya ho to yaha record rahega
    verifiedByAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// 🔒 Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 🔑 Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// 🔢 Generate 6 digit OTP — plain OTP return hota hai (mail me bhejne ke liye),
//    database me sirf hash save hota hai
userSchema.methods.generateEmailOtp = function () {
  const otp = crypto.randomInt(100000, 1000000).toString();

  this.emailOtp = crypto.createHash("sha256").update(otp).digest("hex");
  this.emailOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  this.otpAttempts = 0;
  this.otpLastSentAt = new Date();

  return otp;
};

// ✅ OTP verify karo
userSchema.methods.verifyEmailOtp = function (candidateOtp) {
  if (!this.emailOtp || !this.emailOtpExpires) return false;
  if (this.emailOtpExpires < Date.now()) return false;

  const hashed = crypto
    .createHash("sha256")
    .update(String(candidateOtp))
    .digest("hex");

  return hashed === this.emailOtp;
};

// 🧹 OTP clear karo (verify hone ke baad)
userSchema.methods.clearEmailOtp = function () {
  this.emailOtp = undefined;
  this.emailOtpExpires = undefined;
  this.otpAttempts = 0;
};

// ✅ Export model
export const User = mongoose.model("User", userSchema);