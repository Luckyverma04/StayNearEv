// src/utils/resendService.utils.js
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// 📩 Send email using Resend
export const sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM || "StayNearBy <noreply@staynearby.com>",
      to,
      subject,
      html,
    });

    console.log("📨 Email sent:", response);
    return { success: true, response };
  } catch (error) {
    console.error("❌ Email sending error:", error);
    return { success: false, error };
  }
};

// 🧪 Test function for route
export const testResend = async () => {
  return await sendEmail({
    to: "lv001490@gmail.com",
    subject: "✅ Resend Email Test (StayNearBy)",
    html: "<h2>Email working successfully from Resend! 🎉</h2>",
  });
};
