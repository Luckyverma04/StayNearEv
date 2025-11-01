import crypto from "crypto";
import { User, UserRole } from "../models/user.model.js";
import { generateToken } from "../utils/jwt.utils.js";
import { sendVerificationEmail, sendWelcomeEmail, sendHostApprovalEmail } from "../utils/emailService.utils.js";


// Create default admin user (run once)

// Create admin user manually
const createAdmin = async (req, res) => {
  try {
    const { User, UserRole } = require('../models/user.model');
    
    const adminEmail = 'admin@staynearby.com';
    const adminExists = await User.findOne({ email: adminEmail });
    
    if (adminExists) {
      return res.json({ 
        success: false, 
        message: 'Admin user already exists' 
      });
    }

    const adminUser = new User({
      name: 'StayNearBy Admin',
      email: adminEmail,
      password: 'admin123',
      role: UserRole.ADMIN,
      isEmailVerified: true
    });

    await adminUser.save();

    res.json({
      success: true,
      message: 'Admin user created successfully!',
      data: {
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role
        }
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Reset admin password
const resetAdminPassword = async (req, res) => {
  try {
    const { User } = require('../models/user.model');
    
    const admin = await User.findOne({ email: "admin@staynearby.com" });
    if (!admin) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin user not found' 
      });
    }

    // Set new password (it will be automatically hashed by the pre-save hook)
    admin.password = "admin123";
    await admin.save();

    res.json({
      success: true,
      message: 'Admin password reset to "admin123"'
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};


const signup = async (req, res) => {
  try {
    const { name, email, password, role = UserRole.CUSTOMER, hostInfo } = req.body;

    // Prevent admin registration through signup
    if (role === UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Admin registration is not allowed'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Validate host registration
    if (role === UserRole.HOST && (!hostInfo || !hostInfo.phone || !hostInfo.address)) {
      return res.status(400).json({
        success: false,
        message: 'Phone and address are required for host registration'
      });
    }

    // Create new user (ORIGINAL CODE - no auto-verification)
    const userData = {
      name,
      email,
      password,
      role
    };

    // Add host info if role is host
    if (role === UserRole.HOST) {
      userData.hostInfo = {
        phone: hostInfo.phone,
        address: hostInfo.address,
        idProof: hostInfo.idProof || '',
        isVerified: false // Hosts need admin verification
      };
    }

    const user = new User(userData);

    // Generate email verification token (ORIGINAL CODE)
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // ✅ YEH PART CHANGE KARO - NAYA EMAIL SEND METHOD
    // Send verification email (but don't block registration if it fails)
    sendVerificationEmail(email, verificationToken, name, role)
      .then(() => console.log(`✅ Verification email sent to ${email}`))
      .catch(err => console.error(`❌ Failed to send email to ${email}:`, err.message));

    res.status(201).json({
      success: true,
      message: role === UserRole.HOST ? 
        'Host account created successfully! Please check your email to verify your account. Your account will be activated after admin verification.' :
        'Account created successfully! Please check your email to verify your account.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          ...(role === UserRole.HOST && { 
            hostInfo: user.hostInfo 
          })
        }
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
// Keep all other functions the same as your original code
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if email is verified (ORIGINAL CODE)
    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    // For hosts, check if they are verified by admin
    if (user.role === UserRole.HOST && !user.hostInfo.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'Your host account is pending admin verification. Please wait for approval.'
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    });

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    };

    // Add host info if user is a host
    if (user.role === UserRole.HOST) {
      userResponse.hostInfo = user.hostInfo;
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Your manual verify endpoint (keep this separate)
const manualVerifyEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Email verified manually for testing',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Update user as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name, user.role);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    };

    // Add host info if user is a host
    if (user.role === UserRole.HOST) {
      userResponse.hostInfo = user.hostInfo;
    }

    res.json({
      success: true,
      message: user.role === UserRole.HOST ? 
        'Email verified successfully! Your host account is pending admin verification.' :
        'Email verified successfully! You can now login to your account.',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    };

    // Add host info if user is a host
    if (user.role === UserRole.HOST) {
      userResponse.hostInfo = user.hostInfo;
    }

    res.json({
      success: true,
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Admin only - Verify host
const verifyHost = async (req, res) => {
  try {
    const { hostId } = req.params;
    
    const host = await User.findOne({ 
      _id: hostId, 
      role: UserRole.HOST 
    });

    if (!host) {
      return res.status(404).json({
        success: false,
        message: 'Host not found'
      });
    }

    // ✅ AUTO-VERIFY BOTH FOR TESTING
    host.hostInfo.isVerified = true;
    host.isEmailVerified = true;  // Auto-verify email
    host.emailVerificationToken = undefined;
    host.emailVerificationExpires = undefined;
    
    await host.save();

    // Send approval email to host
    try {
      await sendHostApprovalEmail(host.email, host.name);
    } catch (emailError) {
      console.error('Failed to send host approval email:', emailError);
    }

    res.json({
      success: true,
      message: 'Host verified successfully (Email auto-verified for testing)',
      data: {
        host: {
          id: host._id,
          name: host.name,
          email: host.email,
          isEmailVerified: host.isEmailVerified,  // Now this will be true
          hostInfo: host.hostInfo
        }
      }
    });

  } catch (error) {
    console.error('Verify host error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all hosts (Admin only)
const getAllHosts = async (req, res) => {
  try {
    const hosts = await User.find({ role: UserRole.HOST })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        hosts,
        total: hosts.length
      }
    });

  } catch (error) {
    console.error('Get hosts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete user (Admin can delete any user, users can delete their own account)
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id; // ✅ FIXED
    const requestingUser = req.user; // From auth middleware

    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ Admin can delete anyone, user can delete themselves
    if (requestingUser.role !== UserRole.ADMIN && requestingUser.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own account'
      });
    }

    // ✅ Prevent admin from deleting their own account
    if (userToDelete.role === UserRole.ADMIN && requestingUser.userId === userId) {
      return res.status(403).json({
        success: false,
        message: 'Admin cannot delete their own account'
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete my own account
const deleteMyAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user.role === UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Admin cannot delete their own account'
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'Your account has been deleted successfully'
    });

  } catch (error) {
    console.error('Delete my account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

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
  manualVerifyEmail
};