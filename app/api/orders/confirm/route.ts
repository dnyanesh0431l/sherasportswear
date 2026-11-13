// app/api/orders/confirm/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type Item = {
  name?: string;
  sku?: string;
  size?: string;
  color?: string;
  quantity?: number;
  unitPricePaise?: number;
  lineTotalPaise?: number;
  imageUrl?: string;
};

type Address = {
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type Body = {
  orderId: string;
  orderNumber?: string;
  email: string;
  customerName?: string;
  items: Item[];
  shippingAddress?: Address | null;
  subtotalPaise?: number;
  discountPaise?: number;
  shippingPaise?: number;
  totalPaise: number;
  paymentMethod?: string;
  paymentStatus?: string;
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const formatINR = (paise?: number) =>
  typeof paise === "number" ? `₹${(paise / 100).toLocaleString("en-IN")}` : "—";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.email || !body.orderId) {
      return NextResponse.json(
        { ok: false, error: "Missing email or orderId" },
        { status: 400 },
      );
    }

    const orderRef = body.orderNumber || body.orderId;
    const items = Array.isArray(body.items) ? body.items : [];
    const address = body.shippingAddress || null;

    const itemsHtml = items
      .map((it) => {
        const name = escapeHtml(it.name || "(unnamed)");
        const meta = [it.size && `Size ${it.size}`, it.color]
          .filter(Boolean)
          .join(" · ");
        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;width:56px;vertical-align:top;">
              ${
                it.imageUrl
                  ? `<img src="${it.imageUrl}" alt="" width="48" height="48" style="display:block;border-radius:6px;object-fit:cover;" />`
                  : `<div style="width:48px;height:48px;background:#f5f5f5;border-radius:6px;"></div>`
              }
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top;">
              <div style="font-size:13px;font-weight:700;color:#171717;">${name}</div>
              <div style="font-size:11px;color:#737373;margin-top:2px;">${escapeHtml(meta)}</div>
              <div style="font-size:11px;color:#737373;margin-top:2px;">Qty: ${it.quantity ?? 1}</div>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top;text-align:right;font-size:13px;font-weight:700;color:#171717;white-space:nowrap;">
              ${formatINR(it.lineTotalPaise ?? (it.unitPricePaise ?? 0) * (it.quantity ?? 1))}
            </td>
          </tr>
        `;
      })
      .join("");

    const addressHtml = address
      ? `
        <div style="font-size:13px;line-height:1.6;color:#404040;">
          ${address.fullName ? `<div style="font-weight:700;color:#171717;">${escapeHtml(address.fullName)}</div>` : ""}
          ${address.line1 ? `<div>${escapeHtml(address.line1)}</div>` : ""}
          ${address.line2 ? `<div>${escapeHtml(address.line2)}</div>` : ""}
          <div>${escapeHtml(
            [address.city, address.state, address.postalCode]
              .filter(Boolean)
              .join(", "),
          )}</div>
          ${address.country ? `<div>${escapeHtml(address.country)}</div>` : ""}
          ${address.phone ? `<div style="margin-top:6px;color:#171717;font-weight:600;">Phone: ${escapeHtml(address.phone)}</div>` : ""}
        </div>
      `
      : `<div style="font-size:13px;color:#737373;">Not provided</div>`;

    const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
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

            <!-- Success banner -->
            <tr>
              <td style="padding:24px 24px 8px;text-align:center;">
                <div style="display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:6px 12px;border-radius:999px;background:#16a34a1a;color:#16a34a;">
                  ✓ Order confirmed
                </div>
                <h1 style="margin:14px 0 6px;font-size:22px;line-height:1.3;color:#171717;">
                  Thanks for your order!
                </h1>
                <p style="margin:0;font-size:14px;color:#525252;">
                  Hi ${escapeHtml(body.customerName || "there")}, we've received your order and it's now being prepared.
                </p>
              </td>
            </tr>

            <!-- Order number -->
            <tr>
              <td style="padding:16px 24px;">
                <div style="border:1px solid #e5e5e5;border-radius:8px;padding:14px;text-align:center;">
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#737373;font-weight:600;">Order number</div>
                  <div style="font-size:18px;font-weight:800;color:#171717;margin-top:4px;font-family:monospace;">${escapeHtml(orderRef)}</div>
                </div>
              </td>
            </tr>

            <!-- Items -->
            <tr>
              <td style="padding:8px 24px 0;">
                <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#171717;margin:0 0 8px;">Your items</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  ${itemsHtml || `<tr><td style="padding:10px 0;color:#737373;font-size:13px;">No items</td></tr>`}
                </table>
              </td>
            </tr>

            <!-- Totals -->
            <tr>
              <td style="padding:16px 24px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${body.subtotalPaise != null ? `<tr><td style="padding:4px 0;font-size:13px;color:#737373;">Subtotal</td><td style="padding:4px 0;font-size:13px;color:#171717;text-align:right;font-weight:600;">${formatINR(body.subtotalPaise)}</td></tr>` : ""}
                  ${body.discountPaise && body.discountPaise > 0 ? `<tr><td style="padding:4px 0;font-size:13px;color:#737373;">Discount</td><td style="padding:4px 0;font-size:13px;color:#16a34a;text-align:right;font-weight:600;">−${formatINR(body.discountPaise)}</td></tr>` : ""}
                  ${body.shippingPaise != null ? `<tr><td style="padding:4px 0;font-size:13px;color:#737373;">Shipping</td><td style="padding:4px 0;font-size:13px;color:#171717;text-align:right;font-weight:600;">${body.shippingPaise === 0 ? "Free" : formatINR(body.shippingPaise)}</td></tr>` : ""}
                  <tr>
                    <td style="padding:10px 0 4px;font-size:14px;color:#171717;font-weight:800;border-top:1px solid #e5e5e5;">Total</td>
                    <td style="padding:10px 0 4px;font-size:16px;color:#171717;text-align:right;font-weight:800;border-top:1px solid #e5e5e5;">${formatINR(body.totalPaise)}</td>
                  </tr>
                  ${body.paymentMethod ? `<tr><td style="padding:4px 0;font-size:11px;color:#737373;">Paid via</td><td style="padding:4px 0;font-size:11px;color:#171717;text-align:right;font-weight:600;text-transform:capitalize;">${escapeHtml(body.paymentMethod)}</td></tr>` : ""}
                </table>
              </td>
            </tr>

            <!-- Shipping address -->
            <tr>
              <td style="padding:20px 24px 0;">
                <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#171717;margin:0 0 8px;">Shipping to</h2>
                ${addressHtml}
              </td>
            </tr>

            <!-- CTA -->
            <tr>
              <td style="padding:22px 24px 8px;text-align:center;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://sherasportswear.com"}/account/orders/${body.orderId}"
                   style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 22px;border-radius:999px;">
                  Track your order →
                </a>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:22px 24px;border-top:1px solid #f0f0f0;font-size:11px;color:#737373;line-height:1.6;text-align:center;">
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
      subject: `Order confirmed — ${orderRef}`,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[order-confirm] send failed", err);
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message || "Send failed" },
      { status: 500 },
    );
  }
}