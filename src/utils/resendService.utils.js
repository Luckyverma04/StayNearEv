// src/utils/resendService.utils.js
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// 📩 Send email using Resend
export const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY missing in .env");
  }

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "StayNearBy <onboarding@resend.dev>",
    to,
    subject,
    html,
  });

  // ⚠️ Resend throw nahi karta — error object return karta hai
  if (error) {
    console.error("❌ Resend rejected the email:", error);
    throw new Error(error.message || "Email sending failed");
  }

  console.log("📨 Email sent successfully. ID:", data?.id, "→", to);
  return { success: true, data };
};

// 🧪 Test function for route
export const testResend = async () => {
  return await sendEmail({
    to: "lv001490@gmail.com",
    subject: "✅ Resend Email Test (StayNearBy)",
    html: "<h2>Email working successfully from Resend! 🎉</h2>",
  });
};