import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // Gmail App Password
  },
});

/** Send basic email */
const sendEmail = async (to, subject, html) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  };

  return transporter.sendMail(mailOptions);
};

/** 1️⃣ Verification email */
export const sendVerificationEmail = async (email, name, token) => {
  const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  const html = `
    <h2>Hello ${name},</h2>
    <p>Please verify your email by clicking the link below:</p>
    <a href="${verificationLink}">Verify Email</a>
  `;

  return sendEmail(email, "Verify your StayNearBy account", html);
};

/** 2️⃣ Welcome email */
export const sendWelcomeEmail = async (email, name, role) => {
  const html = `
    <h2>Welcome ${name}! 🎉</h2>
    <p>Your account has been successfully created.</p>
    <p>Role: <strong>${role}</strong></p>
  `;

  return sendEmail(email, "Welcome to StayNearBy", html);
};

/** 3️⃣ Host Approval Email */
export const sendHostApprovalEmail = async (email, name) => {
  const html = `
    <h2>Hello ${name},</h2>
    <p>Your Host account has been approved by admin!</p>
  `;

  return sendEmail(email, "Your Host Account is Approved 🎉", html);
};

/** 4️⃣ FULL working test function */
export const testEmailConnection = async () => {
  try {
    console.log("🔍 Verifying Gmail SMTP...");
    await transporter.verify();

    console.log("📧 SMTP Verified! Sending test email...");

    const info = await sendEmail(
      process.env.EMAIL_USER,
      "StayNearBy — Email Test Successful 🎉",
      "<h2>This is a test email from StayNearBy backend.</h2>"
    );

    return {
      success: true,
      config: transporter.options,
      messageId: info.messageId,
    };

  } catch (err) {
    console.error("❌ Email error:", err);
    return {
      success: false,
      error: err.message,
    };
  }
};
