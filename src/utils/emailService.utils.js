import nodemailer from "nodemailer";

const createTransporter = () => {
  // Try multiple configurations
  const config = {
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    connectionTimeout: 30000, // 30 seconds
    greetingTimeout: 30000,
    socketTimeout: 60000,
    tls: {
      rejectUnauthorized: false // Important for Render
    }
  };
  
  return nodemailer.createTransport(config);
};

// ✅ TEST FUNCTION - Add this to check email connection
export const testEmailConnection = async () => {
  try {
    console.log("Testing email connection...");
    console.log("Email User:", process.env.EMAIL_USER ? "Set" : "Not Set");
    
    const transporter = createTransporter();
    
    // Verify connection
    await transporter.verify();
    console.log("✅ SMTP Connection Verified");
    
    // Test email
    const testResult = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_USER,
      subject: "Test Email from StayNearBy",
      text: "This is a test email to verify SMTP configuration."
    });
    
    console.log("✅ Test email sent successfully:", testResult.messageId);
    return true;
  } catch (error) {
    console.error("❌ Email connection test failed:", error);
    return false;
  }
};

// ✅ Add retry logic to your existing functions
const sendEmailWithRetry = async (mailOptions, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const transporter = createTransporter();
      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully on attempt ${attempt}`);
      return result;
    } catch (error) {
      console.error(`❌ Email attempt ${attempt} failed:`, error.message);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
};

export const sendVerificationEmail = async (email, verificationToken, name, role) => {
  try {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    const roleMessage = role === "host" 
      ? "<p><strong>Host Account:</strong> Your account will be activated after admin verification.</p>" 
      : "";

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
          ${roleMessage}
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px;">
            ${verificationUrl}
          </p>
          <p>This link will expire in 24 hours.</p>
        </div>
      `
    };

    // Use retry logic
    await sendEmailWithRetry(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
    
  } catch (error) {
    console.error("❌ Error sending verification email:", error);
    
    // Don't throw error - let user register even if email fails
    // You can implement a fallback method here
    console.log("⚠️ Email sending failed, but user registration completed");
  }
};

// Keep other functions same but use sendEmailWithRetry
export const sendWelcomeEmail = async (email, name, role) => {
  try {
    const roleSpecificMessage = role === "host"
      ? "<p><strong>Note:</strong> As a host, you can now list your properties. Your account requires admin verification before you can start accepting bookings.</p>"
      : "<p>You can now browse and book properties on our platform.</p>";

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Welcome to StayNearBy!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to StayNearBy, ${name}!</h2>
          <p>Your email has been successfully verified and your account is now active.</p>
          <p><strong>Role:</strong> ${role}</p>
          ${roleSpecificMessage}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/login"
               style="background-color: #28a745; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Login to Your Account
            </a>
          </div>
        </div>
      `
    };

    await sendEmailWithRetry(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
  }
};

export const sendHostApprovalEmail = async (email, name) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Host Account Approved - StayNearBy",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Congratulations, ${name}!</h2>
          <p>Your host account has been approved by our admin team.</p>
          <p>You can now start listing your properties and accepting bookings from customers.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/host/dashboard"
               style="background-color: #28a745; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Go to Host Dashboard
            </a>
          </div>
        </div>
      `
    };

    await sendEmailWithRetry(mailOptions);
    console.log(`✅ Host approval email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending host approval email:", error);
  }
};