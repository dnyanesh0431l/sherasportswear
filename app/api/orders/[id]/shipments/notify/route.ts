// app/api/orders/[id]/shipments/notify/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type Body = {
  email?: string;
  orderNumber?: string;
  customerName?: string;
  totalPaise?: number;
  shipment?: {
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string | null;
    status?: string;
    shippedAt?: string | null; // ISO
    deliveredAt?: string | null; // ISO
  };
  orderStatus?: string | null;
  event?: "created" | "updated" | "deleted";
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
  if (v === "delivered" || v === "captured" || v === "fulfilled")
    return "#16a34a";
  if (
    v === "shipped" ||
    v === "in_transit" ||
    v === "out_for_delivery" ||
    v === "picked_up"
  )
    return "#2563eb";
  if (v === "failed" || v === "returned" || v === "cancelled") return "#dc2626";
  return "#d97706";
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function shipmentHeadline(status?: string, carrier?: string) {
  const s = (status || "").toLowerCase();
  const c = carrier ? ` via ${carrier}` : "";
  switch (s) {
    case "label_created":
      return `A shipping label has been created${c}.`;
    case "picked_up":
      return `Your package has been picked up${c}.`;
    case "in_transit":
      return `Your order is on the way${c}.`;
    case "out_for_delivery":
      return `Your order is out for delivery today${c}.`;
    case "delivered":
      return `Your order has been delivered${c}. We hope you love it!`;
    case "failed":
      return `We hit a snag with your delivery${c}. We'll be in touch shortly.`;
    case "returned":
      return `Your returned package has been received${c}.`;
    case "pending":
    default:
      return `A shipment has been added to your order${c}.`;
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
    if (!body.shipment) {
      return NextResponse.json(
        { ok: false, error: "Missing shipment payload" },
        { status: 400 },
      );
    }

    const orderRef = body.orderNumber || id.slice(0, 8).toUpperCase();
    const s = body.shipment;
    const shipStatusLabel = pretty(s.status);
    const shipTone = statusColor(s.status);
    const trackingUrlSafe =
      s.trackingUrl &&
      /^https?:\/\//i.test(s.trackingUrl) &&
      s.trackingUrl.trim();

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
                <div style="display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:6px 12px;border-radius:999px;background:${shipTone}1a;color:${shipTone};">
                  Shipment · ${shipStatusLabel || "Update"}
                </div>
              </td>
            </tr>

            <!-- Title + message -->
            <tr>
              <td style="padding:8px 24px 0;">
                <h1 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#171717;">
                  Order #${orderRef} — Shipment update
                </h1>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#525252;">
                  Hi ${body.customerName || "there"},<br/>
                  ${shipmentHeadline(s.status, s.carrier)}
                </p>
              </td>
            </tr>

            <!-- Shipment details -->
            <tr>
              <td style="padding:20px 24px;">
                <table role="presentation" width="100%" style="border:1px solid #e5e5e5;border-radius:8px;padding:14px;">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#737373;">Carrier</td>
                    <td style="padding:6px 0;font-size:13px;color:#171717;text-align:right;font-weight:600;">${s.carrier || "—"}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#737373;">Tracking number</td>
                    <td style="padding:6px 0;font-size:13px;color:#171717;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;">${s.trackingNumber || "—"}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#737373;">Status</td>
                    <td style="padding:6px 0;font-size:13px;text-align:right;color:${shipTone};font-weight:600;">${shipStatusLabel || "—"}</td>
                  </tr>
                  ${
                    s.shippedAt
                      ? `
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#737373;">Shipped on</td>
                    <td style="padding:6px 0;font-size:13px;color:#171717;text-align:right;font-weight:600;">${formatDate(s.shippedAt)}</td>
                  </tr>`
                      : ""
                  }
                  ${
                    s.deliveredAt
                      ? `
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#737373;">Delivered on</td>
                    <td style="padding:6px 0;font-size:13px;color:#16a34a;text-align:right;font-weight:600;">${formatDate(s.deliveredAt)}</td>
                  </tr>`
                      : ""
                  }
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#737373;">Order amount</td>
                    <td style="padding:6px 0;font-size:13px;color:#171717;text-align:right;font-weight:600;">${formatINR(body.totalPaise)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td style="padding:0 24px 8px;">
                ${
                  trackingUrlSafe
                    ? `<a href="${trackingUrlSafe}"
                       style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 22px;border-radius:999px;">
                      Track your package →
                    </a>`
                    : `<a href="https://sherasportswear.com/account/orders/${id}"
                       style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 22px;border-radius:999px;">
                      View your order →
                    </a>`
                }
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
      subject: `Order #${orderRef} — Shipment ${shipStatusLabel || "update"}`,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[shipment-notify] send failed", err);
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || "Send failed" },
      { status: 500 },
    );
  }
}
