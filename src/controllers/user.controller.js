import crypto from "crypto";
import { User, UserRole } from "../models/user.model.js";
import { generateToken } from "../utils/jwt.utils.js";
import { sendEmail, testResend } from "../utils/resendService.utils.js";

// -----------------------------------------------------------------------------
//  UTIL: send welcome email (MISSING in your file) → FIXED & ADDED
// -----------------------------------------------------------------------------
const sendWelcomeEmail = async (email, name, role) => {
  return sendEmail({
    to: email,
    subject: "🎉 Welcome to StayNearBy!",
    html: `
      <h2> Welcome ${name}! </h2>
      <p>Your ${role} account is now active.</p>
    `,
  });
};

// -----------------------------------------------------------------------------
//  CREATE ADMIN (cleaned)
// -----------------------------------------------------------------------------
const createAdmin = async (req, res) => {
  try {
    const adminEmail = "admin@staynearby.com";
    const adminExists = await User.findOne({ email: adminEmail });

    if (adminExists) {
      return res.json({
        success: false,
        message: "Admin already exists",
      });
    }

    const adminUser = await User.create({
      name: "StayNearBy Admin",
      email: adminEmail,
      password: "admin123",
      role: UserRole.ADMIN,
      isEmailVerified: true,
    });

    res.json({
      success: true,
      message: "Admin user created successfully",
      data: adminUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  RESET ADMIN PASSWORD
// -----------------------------------------------------------------------------
const resetAdminPassword = async (req, res) => {
  try {
    const admin = await User.findOne({ email: "admin@staynearby.com" });
    if (!admin)
      return res.status(404).json({ success: false, message: "Admin not found" });

    admin.password = "admin123";
    await admin.save();

    res.json({ success: true, message: 'Password reset to "admin123"' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  SIGNUP (AUTO EMAIL VERIFIED + SEND WELCOME)
// -----------------------------------------------------------------------------
const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      isEmailVerified: true,
    });

    // Send welcome email
    sendWelcomeEmail(email, name, role).catch((err) =>
      console.error("❌ Welcome email error:", err)
    );

    res.status(201).json({
      success: true,
      message: "User registered & welcome email sent",
      user,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  LOGIN
// -----------------------------------------------------------------------------
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user)
      return res.status(401).json({ success: false, message: "Invalid login" });

    const isValid = await user.comparePassword(password);
    if (!isValid)
      return res.status(401).json({ success: false, message: "Invalid login" });

    if (!user.isEmailVerified)
      return res.status(401).json({
        success: false,
        message: "Please verify your email before log in",
      });

    if (user.role === UserRole.HOST && !user.hostInfo.isVerified) {
      return res.status(401).json({
        success: false,
        message: "Your host account is pending admin approval",
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
          hostInfo: user.hostInfo,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  MANUAL VERIFY (FOR TESTING)
// -----------------------------------------------------------------------------
const manualVerifyEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    res.json({
      success: true,
      message: "Email verified manually",
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  VERIFY EMAIL (TOKEN BASED)
// -----------------------------------------------------------------------------
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token)
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });

    const hashed = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashed,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    // send welcome email
    sendWelcomeEmail(user.email, user.name, user.role).catch(console.error);

    res.json({
      success: true,
      message: "Email verified successfully!",
      user,
    });
  } catch (error) {
    console.error("Verify error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  GET PROFILE
// -----------------------------------------------------------------------------
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  ADMIN: VERIFY HOST
// -----------------------------------------------------------------------------
const verifyHost = async (req, res) => {
  try {
    const { hostId } = req.params;

    const host = await User.findOne({ _id: hostId, role: UserRole.HOST });
    if (!host)
      return res.status(404).json({ success: false, message: "Host not found" });

    host.hostInfo.isVerified = true;
    host.isEmailVerified = true;

    await host.save();

    sendEmail({
      to: host.email,
      subject: "Host Account Approved",
      html: `<h2>Your host account is now approved</h2>`,
    }).catch(console.error);

    res.json({
      success: true,
      message: "Host verified successfully",
      host,
    });
  } catch (error) {
    console.error("VerifyHost error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
//  GET ALL HOSTS
// -----------------------------------------------------------------------------
const getAllHosts = async (req, res) => {
  try {
    const hosts = await User.find({ role: UserRole.HOST }).select("-password");
    res.json({ success: true, hosts });
  } catch (error) {
    console.error("Get hosts error:", error);
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
    if (!userToDelete)
      return res.status(404).json({ success: false, message: "User not found" });

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
const deleteMyAccount = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.userId);
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete my account error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// -----------------------------------------------------------------------------
// EXPORTS (FIXED – ALL FUNCTIONS NOW VALID)
// -----------------------------------------------------------------------------
export {
  signup,
  login,
  verifyEmail,
  getProfile,
  verifyHost,
  getAllHosts,
  deleteUser,
  deleteMyAccount,
  createAdmin,
  resetAdminPassword,
  manualVerifyEmail,
};
