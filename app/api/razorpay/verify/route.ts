// app/api/razorpay/verify/route.ts
import crypto from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";

function getAdminApp() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKeyRaw)
      throw new Error("Missing Firebase Admin env vars");
    const privateKey = privateKeyRaw
      .replace(/^["']/, "")
      .replace(/["']$/, "")
      .replace(/\\n/g, "\n");
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getApps()[0];
}
function getAdminDb() {
  getAdminApp();
  return getFirestore();
}
function getRazorpay() {
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error("Missing Razorpay env vars");
  return new Razorpay({ key_id, key_secret });
}

type Body = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

function fail(error: string, status = 400) {
  return NextResponse.json({ verified: false, error }, { status });
}

// ---------------------------------------------------------------------------
// POST /api/razorpay/verify
// 1. Signature verify
// 2. Payment captured confirm
// 3. payment_sessions se order data uthao
// 4. AB orders doc banao (sirf successful payment ke baad)
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const razorpay_order_id = body?.razorpay_order_id;
    const razorpay_payment_id = body?.razorpay_payment_id;
    const razorpay_signature = body?.razorpay_signature;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return fail("Missing fields");

    // ---------- 1. HMAC ----------
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return fail("Server misconfigured", 500);

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!/^[0-9a-f]+$/i.test(razorpay_signature))
      return fail("Invalid signature");

    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(razorpay_signature, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
      return fail("Invalid signature");

    // ---------- 2. Razorpay se payment confirm ----------
    const razorpay = getRazorpay();
    let payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.currency !== "INR") return fail("Currency mismatch");
    if (payment.order_id !== razorpay_order_id)
      return fail("Order ID mismatch");

    const amountPaise = Number(payment.amount);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0)
      return fail("Invalid amount");

    if (payment.status === "authorized") {
      try {
        await razorpay.payments.capture(
          razorpay_payment_id,
          amountPaise,
          "INR",
        );
        payment = await razorpay.payments.fetch(razorpay_payment_id);
      } catch (e) {
        console.error("[verify] capture failed", e);
        return fail("Could not capture payment");
      }
    }
    if (payment.status !== "captured")
      return fail(`Payment status: ${payment.status}`);

    // ---------- 3. Session dhundo ----------
    const db = getAdminDb();
    const sessionsSnap = await db
      .collection("payment_sessions")
      .where("razorpayOrderId", "==", razorpay_order_id)
      .limit(1)
      .get();

    if (sessionsSnap.empty) return fail("Session not found for payment", 404);

    const sessionDoc = sessionsSnap.docs[0];
    const session = sessionDoc.data();

    if (session.status === "consumed") {
      // Pehle se order ban chuka hai — idempotent
      const existing = await db
        .collection("orders")
        .where("razorpayOrderId", "==", razorpay_order_id)
        .limit(1)
        .get();
      return NextResponse.json({
        verified: true,
        orderId: existing.empty ? null : existing.docs[0].id,
        paymentStatus: "captured",
      });
    }

    if (Number(session.totalPaise) !== amountPaise) {
      console.error("[verify] amount mismatch", {
        expected: session.totalPaise,
        paid: amountPaise,
      });
      return fail("Amount mismatch");
    }

    // ---------- 4. AB order banao ----------
    const orderRef = db.collection("orders").doc();
    const orderId = orderRef.id;
    const paymentRef = db.collection("payments").doc();
    const paymentId = paymentRef.id;

    const batch = db.batch();

    batch.set(orderRef, {
      orderId,
      orderNumber: orderId,
      userId: session.userId,
      email: session.email,
      phone: session.phone,
      status: "confirmed",
      paymentStatus: "captured",
      paymentMethod: "razorpay",
      fulfillmentStatus: "unfulfilled",
      currency: "INR",
      items: session.items,
      shippingAddress: session.shippingAddress,
      billingAddress: session.shippingAddress,
      subtotalPaise: session.subtotalPaise,
      discountPaise: session.discountPaise,
      shippingPaise: session.shippingPaise,
      totalPaise: session.totalPaise,
      paymentId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.set(paymentRef, {
      paymentId,
      orderId,
      userId: session.userId,
      provider: "razorpay",
      providerOrderId: razorpay_order_id,
      providerPaymentId: razorpay_payment_id,
      amountPaise,
      currency: "INR",
      status: "captured",
      method: payment.method || "online",
      capturedAt: FieldValue.serverTimestamp(),
      failureReason: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Session consumed mark + delete
    batch.update(sessionDoc.ref, { status: "consumed" });
    batch.delete(sessionDoc.ref);

    await batch.commit();

    // ---------- 5. Email ----------
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    try {
      await fetch(`${siteUrl}/api/orders/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          orderNumber: orderId,
          email: session.email,
          customerName: session.shippingAddress?.fullName,
          items: session.items,
          shippingAddress: session.shippingAddress,
          subtotalPaise: session.subtotalPaise,
          discountPaise: session.discountPaise,
          shippingPaise: session.shippingPaise,
          totalPaise: session.totalPaise,
          paymentMethod: "razorpay",
          paymentStatus: "captured",
        }),
      });
    } catch (e) {
      console.error("[verify] email trigger failed", e);
    }

    return NextResponse.json({
      verified: true,
      orderId,
      paymentStatus: "captured",
    });
  } catch (err) {
    console.error("[verify] error", err);
    return NextResponse.json(
      { verified: false, error: "Verification failed" },
      { status: 500 },
    );
  }
}
