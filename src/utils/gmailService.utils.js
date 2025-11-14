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

/** 1️⃣ Send verification email */
export const sendVerificationEmail = async (email, name, token) => {
  const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  const html = `
    <h2>Hello ${name},</h2>
    <p>Please verify your email by clicking the link below:</p>
    <a href="${verificationLink}">Verify Email</a>
  `;

  await sendEmail(email, "Verify your StayNearBy account", html);
};

/** 2️⃣ Send welcome email */
export const sendWelcomeEmail = async (email, name, role) => {
  const html = `
    <h2>Welcome ${name}! 🎉</h2>
    <p>Your account has been successfully created.</p>
    <p>Role: <strong>${role}</strong></p>
    <p>You can now login to StayNearBy.</p>
  `;

  await sendEmail(email, "Welcome to StayNearBy", html);
};

/** 3️⃣ Send Host Approval Email */
export const sendHostApprovalEmail = async (email, name) => {
  const html = `
    <h2>Hello ${name},</h2>
    <p>Your <strong>Host Account</strong> has been approved by admin!</p>
    <p>You can now start adding properties and accepting bookings.</p>
  `;

  await sendEmail(email, "Your Host Account is Approved 🎉", html);
};

/** 4️⃣ Test email connection */
export const testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log("📧 Gmail SMTP Connection Successful!");
  } catch (err) {
    console.error("❌ Gmail SMTP Error:", err);
  }
};
