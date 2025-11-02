import { google } from 'googleapis';
import nodemailer from 'nodemailer';

const OAuth2 = google.auth.OAuth2;

// Create OAuth2 client
const createTransporter = async () => {
  try {
    console.log('🔧 Creating Gmail OAuth2 transporter...');
    
    // For testing, we'll use App Password method but with different configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: process.env.GOOGLE_ACCESS_TOKEN
      }
    });

    return transporter;
  } catch (error) {
    console.error('❌ Error creating Gmail transporter:', error);
    throw error;
  }
};

// Alternative: Use direct app password with different settings
export const testEmailConnection = async () => {
  try {
    console.log("🧪 Testing email connection with alternative method...");
    console.log("📧 Email User:", process.env.EMAIL_USER);
    
    // Try different SMTP configurations
    const configs = [
      {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        connectionTimeout: 10000, // Shorter timeout
        socketTimeout: 10000
      },
      {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // SSL
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        connectionTimeout: 10000,
        socketTimeout: 10000
      },
      {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // TLS
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        connectionTimeout: 10000,
        socketTimeout: 10000,
        tls: {
          rejectUnauthorized: false
        }
      }
    ];

    for (let i = 0; i < configs.length; i++) {
      try {
        console.log(`🔄 Trying config ${i + 1}...`);
        const transporter = nodemailer.createTransport(configs[i]);
        
        await transporter.verify();
        console.log(`✅ Config ${i + 1} - SMTP Connection Verified`);
        
        const testResult = await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: process.env.EMAIL_USER,
          subject: `Test Email - Config ${i + 1}`,
          text: `This is a test email using configuration ${i + 1}`
        });
        
        console.log(`✅ Email sent successfully with config ${i + 1}`);
        return { success: true, config: i + 1, messageId: testResult.messageId };
      } catch (configError) {
        console.log(`❌ Config ${i + 1} failed:`, configError.message);
      }
    }
    
    throw new Error('All email configurations failed');
    
  } catch (error) {
    console.error("❌ All email connection tests failed");
    return { success: false, error: error.message };
  }
};

// Send email with multiple fallback methods
export const sendVerificationEmail = async (email, verificationToken, name, role) => {
  try {
    console.log(`📧 Sending verification email to: ${email}`);
    
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Verify Your ${role === "host" ? "Host " : ""}Email - StayNearBy`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to StayNearBy, ${name}!</h2>
          <p>You are registering as a <strong>${role}</strong>.</p>
          <p>Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="background-color: #007bff; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
            ${verificationUrl}
          </p>
          <p>This link will expire in 24 hours.</p>
        </div>
      `,
      text: `Welcome to StayNearBy, ${name}!\n\nPlease verify your email by visiting: ${verificationUrl}\n\nThis link expires in 24 hours.`
    };

    // Try different configurations
    const configs = [
      {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        connectionTimeout: 10000,
        socketTimeout: 10000
      },
      {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        },
        connectionTimeout: 10000,
        socketTimeout: 10000
      }
    ];

    for (let i = 0; i < configs.length; i++) {
      try {
        console.log(`🔄 Trying email config ${i + 1} for ${email}...`);
        const transporter = nodemailer.createTransport(configs[i]);
        
        const result = await transporter.sendMail(mailOptions);
        console.log(`✅ Verification email sent to ${email} using config ${i + 1}`);
        console.log(`📨 Message ID: ${result.messageId}`);
        
        return result;
      } catch (error) {
        console.log(`❌ Config ${i + 1} failed for ${email}:`, error.message);
        
        if (i === configs.length - 1) {
          // Last config failed
          throw error;
        }
      }
    }
    
  } catch (error) {
    console.error("❌ All email sending methods failed for:", email);
    console.error("🔍 Error details:", error.message);
    
    // Don't block user registration
    console.log("⚠️ Email sending failed, but user registration completed");
    return null;
  }
};

// Keep other functions similar but use the new approach
export const sendWelcomeEmail = async (email, name, role) => {
  // Similar implementation as sendVerificationEmail
  console.log(`📧 Welcome email would be sent to: ${email}`);
  return null; // Temporarily disable until email works
};

export const sendHostApprovalEmail = async (email, name) => {
  console.log(`📧 Host approval email would be sent to: ${email}`);
  return null; // Temporarily disable until email works
};