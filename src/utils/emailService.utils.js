import nodemailer from "nodemailer";

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

export const sendVerificationEmail = async (email, verificationToken, name, role) => {
  try {
    const transporter = createTransporter();
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    const roleMessage =
      role === "host"
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
          <p>${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending verification email:", error);
    throw error;
  }
};

export const sendWelcomeEmail = async (email, name, role) => {
  try {
    const transporter = createTransporter();

    const roleSpecificMessage =
      role === "host"
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

    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
    throw error;
  }
};

export const sendHostApprovalEmail = async (email, name) => {
  try {
    const transporter = createTransporter();

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

    await transporter.sendMail(mailOptions);
    console.log(`✅ Host approval email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending host approval email:", error);
    throw error;
  }
};
