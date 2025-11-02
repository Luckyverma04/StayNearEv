import nodemailer from "nodemailer";

const createTransporter = () => {
  console.log('🔧 Creating email transporter...');
  console.log('📧 Email User:', process.env.EMAIL_USER);
  console.log('🔑 Email Password Length:', process.env.EMAIL_PASSWORD?.length);
  console.log('🌐 CLIENT_URL:', process.env.CLIENT_URL);

  // ✅ FIXED: Use service instead of host/port for Gmail
  const config = {
    service: 'gmail', // ✅ Use service for Gmail
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    debug: true, // ✅ Enable debug
    logger: true  // ✅ Enable logger
  };
  
  const transporter = nodemailer.createTransport(config);
  
  // Verify connection on creation
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email transporter verification failed:', error);
    } else {
      console.log('✅ Email transporter ready');
    }
  });
  
  return transporter;
};

// ✅ TEST FUNCTION - Updated with better logging
export const testEmailConnection = async () => {
  try {
    console.log("🧪 Testing email connection...");
    console.log("📧 Email User:", process.env.EMAIL_USER);
    console.log("🔑 Email Password exists:", !!process.env.EMAIL_PASSWORD);
    console.log("📨 Email From:", process.env.EMAIL_FROM);
    console.log("🌐 Client URL:", process.env.CLIENT_URL);
    
    const transporter = createTransporter();
    
    // Verify connection
    await transporter.verify();
    console.log("✅ SMTP Connection Verified");
    
    // Test email
    const testResult = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: "📧 Test Email from StayNearBy",
      text: "This is a test email to verify SMTP configuration.",
      html: "<h1>Test Email</h1><p>This is a test email from StayNearBy</p>"
    });
    
    console.log("✅ Test email sent successfully!");
    console.log("📨 Message ID:", testResult.messageId);
    console.log("📤 Response:", testResult.response);
    
    return true;
  } catch (error) {
    console.error("❌ Email connection test failed:", error);
    console.error("🔍 Error details:", {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    return false;
  }
};

// ✅ Add retry logic
const sendEmailWithRetry = async (mailOptions, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📤 Email attempt ${attempt}/${retries} to: ${mailOptions.to}`);
      
      const transporter = createTransporter();
      const result = await transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully on attempt ${attempt}`);
      console.log(`📨 Message ID: ${result.messageId}`);
      console.log(`📤 Response: ${result.response}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Email attempt ${attempt} failed:`, error.message);
      console.error(`🔍 Error details:`, {
        code: error.code,
        command: error.command,
        response: error.response
      });
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retrying
      console.log(`⏳ Waiting 2 seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

export const sendVerificationEmail = async (email, verificationToken, name, role) => {
  try {
    console.log(`📧 Preparing verification email for: ${email}`);
    
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    console.log(`🔗 Verification URL: ${verificationUrl}`);
    
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
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            If you didn't create this account, please ignore this email.
          </p>
        </div>
      `,
      text: `Welcome to StayNearBy, ${name}!\n\nPlease verify your email by visiting: ${verificationUrl}\n\nThis link expires in 24 hours.`
    };

    // Use retry logic
    const result = await sendEmailWithRetry(mailOptions);
    console.log(`✅ Verification email sent successfully to ${email}`);
    console.log(`📨 Message ID: ${result.messageId}`);
    
    return result;
    
  } catch (error) {
    console.error("❌ Error sending verification email:", error);
    console.error("🔍 Full error:", error);
    
    // Don't throw error - let user register even if email fails
    console.log("⚠️ Email sending failed, but user registration completed");
    return null;
  }
};

// Keep other functions the same but ensure they use the fixed createTransporter
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