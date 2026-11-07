// src/utils/mailer.utils.js
// -----------------------------------------------------------------------------
//  Saare emails yahin se jaate hain.
//  - BREVO_API_KEY set hai  → Brevo (https://api.brevo.com)
//  - warna RESEND_API_KEY   → Resend (purana setup, fallback)
//  - dono nahi              → mail skip, sirf console warning (server crash nahi hoga)
//
//  .env:
//    BREVO_API_KEY=xkeysib-...
//    EMAIL_FROM_ADDRESS=you@yourdomain.com   (Brevo me verified sender hona chahiye)
//    EMAIL_FROM_NAME=StayNearEV
//    ADMIN_NOTIFY_EMAIL=you@gmail.com        (naye signup ka alert yahan aayega)
// -----------------------------------------------------------------------------

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const RESEND_URL = "https://api.resend.com/emails";

// "Name <email@x.com>" ya sirf "email@x.com" dono samajh leta hai
const getSender = () => {
  const name = process.env.EMAIL_FROM_NAME || "StayNearEV";
  if (process.env.EMAIL_FROM_ADDRESS) {
    return { name, email: process.env.EMAIL_FROM_ADDRESS.trim() };
  }
  const raw = process.env.EMAIL_FROM || "";
  const match = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (match) return { name: match[1] || name, email: match[2] };
  if (raw.includes("@")) return { name, email: raw.trim() };
  return { name, email: "" };
};

const toList = (to) => (Array.isArray(to) ? to : [to]).filter(Boolean);

const sendWithBrevo = async ({ to, subject, html, replyTo }) => {
  const sender = getSender();
  if (!sender.email) {
    throw new Error("EMAIL_FROM_ADDRESS missing in .env (Brevo verified sender)");
  }

  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      to: toList(to).map((email) => ({ email })),
      subject,
      htmlContent: html,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Brevo ${res.status}: ${data.message || data.code || "send failed"}`);
  }
  return { provider: "brevo", id: data.messageId };
};

const sendWithResend = async ({ to, subject, html, replyTo }) => {
  const sender = getSender();
  const from = sender.email
    ? `${sender.name} <${sender.email}>`
    : "StayNearEV <onboarding@resend.dev>";

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: toList(to),
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${data.message || "send failed"}`);
  }
  return { provider: "resend", id: data.id };
};

// 📩 Main function — pura app isi ko use karta hai
export const sendEmail = async ({ to, subject, html, replyTo }) => {
  if (!toList(to).length) throw new Error("Email 'to' is missing");

  let result;
  if (process.env.BREVO_API_KEY) {
    result = await sendWithBrevo({ to, subject, html, replyTo });
  } else if (process.env.RESEND_API_KEY) {
    result = await sendWithResend({ to, subject, html, replyTo });
  } else {
    console.warn(`⚠️ No email provider configured — skipped "${subject}" → ${to}`);
    return { success: false, skipped: true };
  }

  console.log(`📨 [${result.provider}] "${subject}" → ${toList(to).join(", ")} (id: ${result.id})`);
  return { success: true, ...result };
};

// -----------------------------------------------------------------------------
//  TEMPLATES
// -----------------------------------------------------------------------------
const ACCENT = "#00E5A8";
const appUrl = () =>
  (process.env.FRONTEND_URL || "https://staynearevfrontend.onrender.com").replace(/\/+$/, "");

const escapeHtml = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Common wrapper — dark header, white body (sab email apps me theek dikhta hai)
const layout = (title, body) => `
<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#020617;padding:22px 28px;">
            <span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background:${ACCENT};color:#020617;font-weight:bold;font-size:18px;">&#9889;</span>
            <span style="color:#F8FAFC;font-size:20px;font-weight:bold;vertical-align:middle;margin-left:8px;">StayNear<span style="color:${ACCENT};">EV</span></span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:#0f172a;font-size:15px;line-height:1.6;">
            <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">${title}</h1>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:#f8fafc;color:#94a3b8;font-size:12px;text-align:center;">
            Charge closer, drive farther. · © ${new Date().getFullYear()} StayNearEV
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const button = (href, label) => `
  <a href="${href}" style="display:inline-block;margin-top:8px;padding:12px 22px;background:${ACCENT};color:#020617;text-decoration:none;font-weight:bold;border-radius:10px;">${label}</a>`;

export const welcomeEmailHtml = (name) =>
  layout(
    `Welcome, ${escapeHtml(name)}! 🎉`,
    `<p style="margin:0 0 12px;">Your StayNearEV account is ready. Here's what you can do now:</p>
     <ul style="margin:0 0 16px;padding-left:20px;">
       <li><b>Find chargers</b> near you</li>
       <li><b>Book a charging slot</b> in seconds</li>
       <li><b>List your own charger</b> and earn</li>
     </ul>
     ${button(appUrl(), "Find a charger")}
     <p style="margin:20px 0 0;color:#64748b;font-size:13px;">Questions? Just reply to this email.</p>`
  );

export const otpEmailHtml = (name, otp) =>
  layout(
    "Verify your email",
    `<p style="margin:0 0 12px;">Hi ${escapeHtml(name)}, use this code to verify your email:</p>
     <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f1f5f9;padding:16px;text-align:center;border-radius:10px;margin:16px 0;color:#020617;">${otp}</div>
     <p style="margin:0;color:#64748b;font-size:13px;">This code expires in 10 minutes. If you didn't sign up, you can ignore this email.</p>`
  );

export const approvedEmailHtml = (name) =>
  layout(
    "Your account is approved ✅",
    `<p style="margin:0 0 16px;">Hi ${escapeHtml(name)}, an admin has verified your StayNearEV account. You can login now.</p>
     ${button(`${appUrl()}/login`, "Login")}`
  );

const adminSignupHtml = (user, method) => {
  const row = (k, v) =>
    `<tr><td style="padding:6px 0;color:#64748b;width:110px;">${k}</td><td style="padding:6px 0;font-weight:bold;">${v}</td></tr>`;
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  return layout(
    "🆕 New user signed up",
    `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
       ${row("Name", escapeHtml(user.name))}
       ${row("Email", escapeHtml(user.email))}
       ${row("Signed up via", escapeHtml(method))}
       ${row("Time", `${when} IST`)}
     </table>`
  );
};

// -----------------------------------------------------------------------------
//  HIGH-LEVEL HELPERS — fail ho to bhi signup nahi rukta
// -----------------------------------------------------------------------------

// User ko welcome mail + admin ko "naya signup" alert
export const sendSignupEmails = (user, method) => {
  sendEmail({
    to: user.email,
    subject: "🎉 Welcome to StayNearEV!",
    html: welcomeEmailHtml(user.name),
  }).catch((err) => console.error("❌ Welcome mail failed:", err.message));

  const adminTo = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (!adminTo) {
    console.warn("⚠️ ADMIN_NOTIFY_EMAIL not set — skipping new-signup alert");
    return;
  }
  sendEmail({
    to: adminTo,
    subject: `🆕 New signup: ${user.name} (${method})`,
    html: adminSignupHtml(user, method),
    replyTo: user.email,
  }).catch((err) => console.error("❌ Admin signup alert failed:", err.message));
};

// 🧪 Test route ke liye
export const sendTestEmail = (to) =>
  sendEmail({
    to,
    subject: "✅ StayNearEV email test",
    html: layout("Email is working! 🎉", "<p style=\"margin:0;\">This is a test email from your StayNearEV backend.</p>"),
  });
