import { User, UserRole } from "../models/user.model.js";
import Station from "../models/station.model.js";
import Booking from "../models/booking.model.js";
import { generateToken } from "../utils/jwt.utils.js";
import {
  sendEmail,
  sendSignupEmails,
  otpEmailHtml,
  approvedEmailHtml,
} from "../utils/mailer.utils.js";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client();

// -----------------------------------------------------------------------------
//  SWITCH: .env me EMAIL_VERIFICATION=true karte hi OTP flow chalu ho jayega.
//  Abhi false hai → signup ke baad user seedha verified ban jata hai.
// -----------------------------------------------------------------------------
const EMAIL_VERIFICATION_ON =
  String(process.env.EMAIL_VERIFICATION).toLowerCase() === "true";

// -----------------------------------------------------------------------------
//  CREATE ADMIN
// -----------------------------------------------------------------------------
const createAdmin = async (req, res) => {
  try {
    // 🔐 Ye route sirf secret key ke saath chalega.
    //    ADMIN_SETUP_KEY .env me set nahi hai to route band hai.
    const setupKey = process.env.ADMIN_SETUP_KEY;
    if (!setupKey || req.header("x-setup-key") !== setupKey) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      return res.status(500).json({
        success: false,
        message: "ADMIN_EMAIL / ADMIN_PASSWORD not set in .env",
      });
    }

    const adminExists = await User.findOne({ email: adminEmail });
    if (adminExists) {
      return res.json({ success: false, message: "Admin already exists" });
    }

    const adminUser = await User.create({
      name: "StayNearBy Admin",
      email: adminEmail,
      password: adminPassword,
      role: UserRole.ADMIN,
      isEmailVerified: true,
    });

    res.status(201).json({
      success: true,
      message: "Admin user created successfully",
      data: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  SIGNUP
// -----------------------------------------------------------------------------
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const exists = await User.findOne({ email });

    // ---- Verification BAND hai → seedha account bana do ----
    if (!EMAIL_VERIFICATION_ON) {
      if (exists) {
        return res.status(409).json({
          success: false,
          message: "User already exists with this email",
        });
      }

      const user = await User.create({
        name,
        email,
        password,
        role: UserRole.CUSTOMER,
        isEmailVerified: true,
      });

      // User ko welcome + admin ko alert (fail ho to bhi signup nahi rukega)
      sendSignupEmails(user, "Email");

      return res.status(201).json({
        success: true,
        message: "Account created successfully. You can log in now.",
        data: {
          id: user._id,
          email: user.email,
          requiresVerification: false,
        },
      });
    }

    // ---- Verification CHALU hai → OTP wala flow ----
    if (exists) {
      if (exists.isEmailVerified) {
        return res.status(409).json({
          success: false,
          message: "User already exists with this email",
        });
      }

      const otp = exists.generateEmailOtp();
      await exists.save();

      await sendEmail({
        to: exists.email,
        subject: "Your StayNearEV verification code",
        html: otpEmailHtml(exists.name, otp),
      });

      return res.status(200).json({
        success: true,
        message: "Account already exists but not verified. New OTP sent.",
        data: { email: exists.email, requiresVerification: true },
      });
    }

    const user = new User({
      name,
      email,
      password,
      role: UserRole.CUSTOMER,
      isEmailVerified: false,
    });

    const otp = user.generateEmailOtp();
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: "Your StayNearEV verification code",
        html: otpEmailHtml(user.name, otp),
      });
    } catch (mailError) {
      console.error("❌ OTP email failed:", mailError.message);
      return res.status(201).json({
        success: true,
        message: "Account created but OTP email failed. Please use resend OTP.",
        data: { email: user.email, requiresVerification: true },
      });
    }

    res.status(201).json({
      success: true,
      message: "Account created. Verification code sent to your email.",
      data: { email: user.email, requiresVerification: true },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  VERIFY OTP
// -----------------------------------------------------------------------------
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({ email }).select("+emailOtp");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.json({
        success: true,
        message: "Email is already verified. You can log in.",
      });
    }

    if (user.otpAttempts >= 5) {
      return res.status(429).json({
        success: false,
        message: "Too many wrong attempts. Please request a new OTP.",
      });
    }

    if (!user.verifyEmailOtp(otp)) {
      user.otpAttempts += 1;
      await user.save();

      const left = Math.max(0, 5 - user.otpAttempts);
      return res.status(400).json({
        success: false,
        message: `Invalid or expired OTP. ${left} attempt(s) left.`,
      });
    }

    user.isEmailVerified = true;
    user.clearEmailOtp();
    await user.save();

    // OTP verify hua = account active → welcome + admin alert
    sendSignupEmails(user, "Email (OTP verified)");

    res.json({
      success: true,
      message: "Email verified successfully! You can log in now.",
      data: { id: user._id, email: user.email },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  RESEND OTP  (60 second cooldown)
// -----------------------------------------------------------------------------
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.json({ success: true, message: "Email is already verified" });
    }

    if (user.otpLastSentAt) {
      const secondsSince = (Date.now() - user.otpLastSentAt.getTime()) / 1000;
      if (secondsSince < 60) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(60 - secondsSince)} seconds before requesting a new OTP.`,
        });
      }
    }

    const otp = user.generateEmailOtp();
    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Your StayNearEV verification code",
      html: otpEmailHtml(user.name, otp),
    });

    res.json({ success: true, message: "New OTP sent to your email" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  LOGIN
// -----------------------------------------------------------------------------
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid login" });
    }

    const isValid = user.password
      ? await user.comparePassword(password)
      : false;

    if (!isValid) {
      // Google se bana account hai aur password set nahi hai
      if (!user.password && user.googleId) {
        return res.status(401).json({
          success: false,
          message: "This account uses Google sign-in. Please continue with Google.",
        });
      }
      return res.status(401).json({ success: false, message: "Invalid login" });
    }

    // Verification band hai to ye check skip ho jayega
    if (EMAIL_VERIFICATION_ON && !user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first. Check your inbox for the OTP.",
        requiresVerification: true,
        email: user.email,
      });
    }

    const token = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  GOOGLE LOGIN / SIGNUP
//  Frontend Google se ek "credential" (ID token) bhejta hai.
//  Hum use Google se verify karte hain, phir user dhoondte/banate hain.
// -----------------------------------------------------------------------------
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      return res.status(500).json({
        success: false,
        message: "Google login is not configured on the server",
      });
    }
    if (!credential) {
      return res.status(400).json({ success: false, message: "Google credential missing" });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid Google token" });
    }

    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({
        success: false,
        message: "Google account email is not verified",
      });
    }

    const email = payload.email.toLowerCase();
    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });
    let isNewUser = false;

    if (!user) {
      user = await User.create({
        name: payload.name || email.split("@")[0],
        email,
        googleId: payload.sub,
        avatar: payload.picture,
        isEmailVerified: true, // Google ne email verify kar diya hai
      });
      isNewUser = true;
    } else {
      // Pehle email/password se bana account — ab Google bhi link kar do
      let changed = false;
      if (!user.googleId) { user.googleId = payload.sub; changed = true; }
      if (!user.isEmailVerified) { user.isEmailVerified = true; changed = true; }
      if (!user.avatar && payload.picture) { user.avatar = payload.picture; changed = true; }
      if (changed) await user.save();
    }

    if (isNewUser) {
      sendSignupEmails(user, "Google");
    }

    const token = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      message: isNewUser ? "Account created with Google" : "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({ success: false, message: "Google login failed" });
  }
};

// -----------------------------------------------------------------------------
//  GET PROFILE
// -----------------------------------------------------------------------------
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  ADMIN: pending (unverified) users
// -----------------------------------------------------------------------------
const getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({
      isEmailVerified: false,
      role: UserRole.CUSTOMER,
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    console.error("Get pending users error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  ADMIN: manually verify a user
// -----------------------------------------------------------------------------
const verifyUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.json({ success: true, message: "User is already verified" });
    }

    user.isEmailVerified = true;
    user.verifiedByAdmin = true;
    user.clearEmailOtp();
    await user.save();

    sendEmail({
      to: user.email,
      subject: "✅ Your StayNearEV account is approved",
      html: approvedEmailHtml(user.name),
    }).catch((err) => console.error("Approval mail error:", err.message));

    res.json({
      success: true,
      message: "User verified by admin",
      data: { id: user._id, email: user.email },
    });
  } catch (error) {
    console.error("Admin verify error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  ADMIN: all users
// -----------------------------------------------------------------------------
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  DELETE USER
// -----------------------------------------------------------------------------
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (userToDelete.role === UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Admin account cannot be deleted",
      });
    }

    await User.findByIdAndDelete(id);

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  DELETE MY ACCOUNT
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
//  UPDATE MY PROFILE (abhi sirf naam)
// -----------------------------------------------------------------------------
const updateMyProfile = async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({ success: false, message: "Name must be 2 to 50 characters" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { name },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, message: "Profile updated", data: user });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Could not update profile" });
  }
};

// -----------------------------------------------------------------------------
//  DELETE MY ACCOUNT — user ke saath uske stations aur bookings bhi hatao
// -----------------------------------------------------------------------------
const deleteMyAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Admin galti se khud ko delete na kar de (warna admin panel band)
    if (req.user.role === UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Admin account can't be deleted from the app",
      });
    }

    const myStationIds = (await Station.find({ createdBy: userId }).select("_id")).map((s) => s._id);
    const [stationBookings, myBookings, stations] = await Promise.all([
      Booking.deleteMany({ station: { $in: myStationIds } }),
      Booking.deleteMany({ user: userId }),
      Station.deleteMany({ createdBy: userId }),
    ]);
    await User.findByIdAndDelete(userId);

    console.log(
      `🗑️ Account ${userId} deleted: ${stations.deletedCount} stations, ` +
        `${stationBookings.deletedCount + myBookings.deletedCount} bookings`
    );
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete my account error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  EXPORTS
// -----------------------------------------------------------------------------
export {
  signup,
  login,
  verifyOtp,
  resendOtp,
  getProfile,
  getPendingUsers,
  verifyUserByAdmin,
  getAllUsers,
  deleteUser,
  deleteMyAccount,
  updateMyProfile,
  createAdmin,
  googleLogin,
};