// app/api/orders/[id]/notify/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type Body = {
  email?: string;
  orderNumber?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  totalPaise?: number;
  customerName?: string;
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const pretty = (s?: string) =>
  (s || "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const formatINR = (paise?: number) =>
  typeof paise === "number" ? `₹${(paise / 100).toLocaleString("en-IN")}` : "—";

function statusColor(s?: string) {
  const v = (s || "").toLowerCase();
  if (v === "delivered" || v === "captured" || v === "confirmed" || v === "fulfilled")
    return "#16a34a";
  if (v === "shipped" || v === "in_transit" || v === "out_for_delivery" || v === "picked_up")
    return "#2563eb";
  if (v === "cancelled" || v === "failed" || v === "returned")
    return "#dc2626";
  if (v === "refunded" || v === "partially_refunded")
    return "#9333ea";
  return "#d97706";
}

function statusMessage(status?: string) {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "confirmed":
      return "Your order has been confirmed. We'll start preparing it shortly.";
    case "processing":
      return "We're packing your order. You'll get a shipping update soon.";
    case "shipped":
      return "Great news — your order has been shipped!";
    case "out_for_delivery":
      return "Your order is out for delivery today.";
    case "delivered":
      return "Your order has been delivered. We hope you love it!";
    case "cancelled":
      return "Your order has been cancelled. If a payment was made, the refund will be processed within 5–7 working days.";
    case "returned":
      return "We've received your return. The refund will follow shortly.";
    case "refunded":
      return "Your refund has been processed to the original payment method. It may take 5–7 working days to reflect.";
    case "pending_payment":
      return "We're waiting for your payment to confirm the order.";
    default:
      return "There's an update on your order.";
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Body;

    if (!body.email) {
      return NextResponse.json(
        { ok: false, error: "Missing recipient email" },
        { status: 400 },
      );
    }

    const orderRef = body.orderNumber || id.slice(0, 8).toUpperCase();
    const statusLabel = pretty(body.status);
    const statusTone = statusColor(body.status);

    const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
            <!-- Header -->
            <tr>
              <td style="background:#171717;padding:22px 24px;">
                <div style="font-size:22px;font-weight:900;font-style:italic;letter-spacing:-0.5px;color:#ffffff;">
                  SHER<span style="color:#ff5a1f;">A</span>
                </div>
                <div style="font-size:9px;letter-spacing:0.3em;color:#ff5a1f;font-weight:600;margin-top:2px;">
                  SPORTS WEAR
                </div>
              </td>
            </tr>

            <!-- Status badge -->
            <tr>
              <td style="padding:24px 24px 8px;">
                <div style="display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:6px 12px;border-radius:999px;background:${statusTone}1a;color:${statusTone};">
                  ${statusLabel || "Update"}
                </div>
              </td>
            </tr>

            <!-- Title + message -->
            <tr>
              <td style="padding:8px 24px 0;">
                <h1 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#171717;">
                  Order #${orderRef} — ${statusLabel}
                </h1>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#525252;">
                  Hi ${body.customerName || "there"},<br/>
                  ${statusMessage(body.status)}
                </p>
              </td>
            </tr>

            <!-- Order details -->
            <tr>
              <td style="padding:20px 24px;">
                <table role="presentation" width="100%" style="border:1px solid #e5e5e5;border-radius:8px;padding:14px;">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#737373;">Order number</td>
                    <td style="padding:6px 0;font-size:13px;color:#171717;text-align:right;font-weight:600;">#${orderRef}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#737373;">Order status</td>
                    <td style="padding:6px 0;font-size:13px;text-align:right;color:${statusColor(body.status)};font-weight:600;">${statusLabel || "—"}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#737373;">Payment</td>
                    <td style="padding:6px 0;font-size:13px;text-align:right;color:${statusColor(body.paymentStatus)};font-weight:600;">${pretty(body.paymentStatus) || "—"}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#737373;">Fulfillment</td>
                    <td style="padding:6px 0;font-size:13px;text-align:right;color:${statusColor(body.fulfillmentStatus)};font-weight:600;">${pretty(body.fulfillmentStatus) || "—"}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#737373;">Amount</td>
                    <td style="padding:6px 0;font-size:13px;color:#171717;text-align:right;font-weight:600;">${formatINR(body.totalPaise)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td style="padding:0 24px 8px;">
                <a href="https://sherasportswear.com/account/orders/${id}"
                   style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 22px;border-radius:999px;">
                  View your order →
                </a>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px;border-top:1px solid #f0f0f0;font-size:11px;color:#737373;line-height:1.6;">
                Questions? Reply to this email or write to
                <a href="mailto:support@sherasportswear.com" style="color:#ff5a1f;text-decoration:none;">support@sherasportswear.com</a>.<br/>
                © ${new Date().getFullYear()} Shera Sports Wear. Built to move.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `.trim();

    await transporter.sendMail({
      from: `"Shera Sports Wear" <${process.env.GMAIL_USER}>`,
      to: body.email,
      subject: `Order #${orderRef} — ${statusLabel || "Status update"}`,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notify] send failed", err);
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || "Send failed" },
      { status: 500 },
    );
  }
}