// src/utils/bookingEmails.utils.js
// -----------------------------------------------------------------------------
//  Booking ke saare emails:
//   1. Booking bani      → user ko "Booking received", station owner ko "New booking"
//   2. Owner ne confirm  → user ko "Booking confirmed"
//   3. Owner ne cancel   → user ko "Booking cancelled"
//   4. User ne cancel    → owner ko "Booking cancelled by customer"
//  Mail fail ho to bhi booking ka kaam nahi rukta (sirf console me error).
// -----------------------------------------------------------------------------
import Station from "../models/station.model.js";
import { User } from "../models/user.model.js";
import { sendEmail, layout, button, appUrl, escapeHtml } from "./mailer.utils.js";

const fmtTime = (d) =>
  new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const fmtMoney = (n) =>
  typeof n === "number" && !Number.isNaN(n) ? `₹${n.toFixed(2)}` : "-";

const shortId = (id) => String(id).slice(-6).toUpperCase();

const row = (k, v) =>
  `<tr><td style="padding:8px 0;color:#64748b;width:120px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${k}</td><td style="padding:8px 0;font-weight:bold;border-bottom:1px solid #f1f5f9;">${v}</td></tr>`;

// Booking ki details ki table — sab mails me same
const detailsTable = (booking, station, extraRows = "") => {
  const v = booking.vehicleInfo || {};
  const vehicle = [v.vehicleType, v.model].filter(Boolean).join(" · ");
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin:8px 0 20px;">
      ${row("Booking ID", `#${shortId(booking._id)}`)}
      ${row("Station", escapeHtml(station?.name || "-"))}
      ${row("Location", escapeHtml(station?.location || "-"))}
      ${row("Start", `${fmtTime(booking.startTime)} IST`)}
      ${row("End", `${fmtTime(booking.endTime)} IST`)}
      ${row("Duration", `${booking.duration} min`)}
      ${vehicle ? row("Vehicle", escapeHtml(vehicle)) : ""}
      ${v.licensePlate ? row("Number plate", escapeHtml(v.licensePlate)) : ""}
      ${row("Estimated cost", fmtMoney(booking.totalCost))}
      ${extraRows}
    </table>`;
};

const statusPill = (label, bg, color) =>
  `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};color:${color};font-size:13px;font-weight:bold;">${label}</span>`;

// Booking, station, customer aur owner — jo bhi missing ho DB se le aao
const loadContext = async (booking, stationArg) => {
  const station =
    stationArg && stationArg.name ? stationArg : await Station.findById(booking.station?._id || booking.station);
  const [customer, owner] = await Promise.all([
    User.findById(booking.user?._id || booking.user).select("name email"),
    station?.createdBy ? User.findById(station.createdBy).select("name email") : null,
  ]);
  return { station, customer, owner };
};

const safeSend = (opts, label) =>
  sendEmail(opts).catch((err) => console.error(`❌ ${label} mail failed:`, err.message));

// -----------------------------------------------------------------------------
//  1. NEW BOOKING
// -----------------------------------------------------------------------------
export const sendBookingCreatedEmails = async (booking, stationArg) => {
  try {
    const { station, customer, owner } = await loadContext(booking, stationArg);

    if (customer?.email) {
      safeSend(
        {
          to: customer.email,
          subject: `⚡ Booking received: ${station?.name || "charging slot"} (#${shortId(booking._id)})`,
          html: layout(
            "Your booking is received ⚡",
            `<p style="margin:0 0 12px;">Hi ${escapeHtml(customer.name)}, thanks for booking with StayNearEV!</p>
             <p style="margin:0 0 8px;">${statusPill("Waiting for station owner", "#fef3c7", "#92400e")}</p>
             <p style="margin:0 0 8px;color:#475569;">The station owner will confirm your slot soon. We'll email you as soon as they do.</p>
             ${detailsTable(booking, station)}
             ${button(`${appUrl()}/my-bookings`, "View my bookings")}`
          ),
          replyTo: owner?.email,
        },
        "Booking received"
      );
    }

    if (owner?.email) {
      safeSend(
        {
          to: owner.email,
          subject: `🔔 New booking at ${station?.name || "your station"}: ${fmtTime(booking.startTime)}`,
          html: layout(
            "You have a new booking 🔔",
            `<p style="margin:0 0 12px;">Hi ${escapeHtml(owner.name)}, <b>${escapeHtml(customer?.name || "A customer")}</b> just booked a slot at <b>${escapeHtml(station?.name || "your station")}</b>.</p>
             <p style="margin:0 0 8px;">${statusPill("Action needed: confirm or cancel", "#fee2e2", "#991b1b")}</p>
             ${detailsTable(
               booking,
               station,
               `${row("Customer", escapeHtml(customer?.name || "-"))}${row("Customer email", customer?.email ? `<a href="mailto:${escapeHtml(customer.email)}" style="color:#0f766e;">${escapeHtml(customer.email)}</a>` : "-")}`
             )}
             ${button(`${appUrl()}/my-station-bookings`, "Confirm booking")}
             <p style="margin:20px 0 0;color:#64748b;font-size:13px;">Reply to this email to contact the customer.</p>`
          ),
          replyTo: customer?.email,
        },
        "Owner new-booking"
      );
    }
  } catch (err) {
    console.error("❌ Booking created emails failed:", err.message);
  }
};

// -----------------------------------------------------------------------------
//  2/3. OWNER/ADMIN NE STATUS BADLA → customer ko batao
// -----------------------------------------------------------------------------
export const sendBookingStatusEmail = async (booking, status) => {
  if (!["confirmed", "cancelled"].includes(status)) return; // baaki status par mail nahi
  try {
    const { station, customer, owner } = await loadContext(booking, booking.station);
    if (!customer?.email) return;

    const confirmed = status === "confirmed";
    const cancelledBy = booking.cancelledBy === "admin" ? "StayNearEV admin" : "the station owner";

    safeSend(
      {
        to: customer.email,
        subject: confirmed
          ? `✅ Booking confirmed: ${station?.name || "charging slot"} on ${fmtTime(booking.startTime)}`
          : `❌ Booking cancelled: ${station?.name || "charging slot"} (#${shortId(booking._id)})`,
        html: layout(
          confirmed ? "Your booking is confirmed ✅" : "Your booking was cancelled",
          `<p style="margin:0 0 12px;">Hi ${escapeHtml(customer.name)},</p>
           <p style="margin:0 0 8px;">${
             confirmed
               ? statusPill("Confirmed", "#dcfce7", "#166534")
               : statusPill("Cancelled", "#fee2e2", "#991b1b")
           }</p>
           <p style="margin:0 0 8px;color:#475569;">${
             confirmed
               ? "Your charging slot is booked. Please reach the station on time."
               : `Sorry, this booking was cancelled by ${cancelledBy}. You can book another slot anytime.`
           }</p>
           ${detailsTable(booking, station)}
           ${
             confirmed
               ? button(`${appUrl()}/my-bookings`, "View booking")
               : button(appUrl(), "Find another charger")
           }`
        ),
        replyTo: owner?.email,
      },
      `Booking ${status}`
    );
  } catch (err) {
    console.error("❌ Booking status email failed:", err.message);
  }
};

// -----------------------------------------------------------------------------
//  4. CUSTOMER NE CANCEL KIYA → owner ko batao
// -----------------------------------------------------------------------------
export const sendBookingCancelledByUserEmail = async (booking) => {
  try {
    const { station, customer, owner } = await loadContext(booking);
    if (!owner?.email) return;

    const reason = booking.cancellationReason
      ? row("Reason", escapeHtml(booking.cancellationReason))
      : "";

    safeSend(
      {
        to: owner.email,
        subject: `🚫 Booking cancelled by customer: ${station?.name || "your station"} (#${shortId(booking._id)})`,
        html: layout(
          "A booking was cancelled",
          `<p style="margin:0 0 12px;">Hi ${escapeHtml(owner.name)}, <b>${escapeHtml(customer?.name || "A customer")}</b> cancelled their booking. The slot is free again.</p>
           <p style="margin:0 0 8px;">${statusPill("Cancelled by customer", "#fee2e2", "#991b1b")}</p>
           ${detailsTable(booking, station, reason)}
           ${button(`${appUrl()}/my-station-bookings`, "View station bookings")}`
        ),
        replyTo: customer?.email,
      },
      "Owner cancellation"
    );
  } catch (err) {
    console.error("❌ Cancel email failed:", err.message);
  }
};
