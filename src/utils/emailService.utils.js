import nodemailer from "nodemailer";

const createTransporter = () => {
  console.log('🔧 Creating email transporter...');
  console.log('📧 Email User:', process.env.EMAIL_USER);

  const config = {
    host: process.env.EMAIL_HOST || "smtp-relay.brevo.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };

  const transporter = nodemailer.createTransport(config);

  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email transporter verification failed:', error);
    } else {
      console.log('✅ Email transporter ready');
    }
  });

  return transporter;
};

// ✅ Retry logic for reliability
const sendEmailWithRetry = async (mailOptions, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📤 Sending email attempt ${attempt}/${retries} to ${mailOptions.to}`);
      const transporter = createTransporter();
      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully to ${mailOptions.to}`);
      return result;
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed: ${error.message}`);
      if (attempt === retries) throw error;
      console.log(`⏳ Retrying in 3 seconds...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
};

// ✅ Send Welcome Email (used in signup)
export const sendWelcomeEmail = async (email, name, role) => {
  try {
    const roleSpecificMessage = role === "host"
      ? "<p><strong>Note:</strong> As a host, your listing will be visible after admin approval.</p>"
      : "<p>Start finding and booking nearby EV stations easily!</p>";

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "🎉 Welcome to StayNearBy!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <h2 style="color: #333;">Welcome, ${name}! 👋</h2>
          <p>Thank you for joining <strong>StayNearBy</strong>.</p>
          <p><strong>Role:</strong> ${role}</p>
          ${roleSpecificMessage}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL}/login"
              style="background-color: #28a745; color: white; padding: 12px 24px;
              text-decoration: none; border-radius: 5px; display: inline-block;">
              Login to Your Account
            </a>
          </div>
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">
            Drive smarter, charge faster — StayNearBy ⚡
          </p>
        </div>
      `,
    };

    await sendEmailWithRetry(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
  }
};
