// app/api/razorpay/verify/route.ts
import crypto from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";
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

// ---------------------------------------------------------------------------
// Order number: SHERA-YYMMDD-XXXX
//   e.g. SHERA-261118-A7K2
//   YY = 2-digit year, MM = month, DD = day, XXXX = 4 random chars.
// Alphabet excludes 0/O, 1/I/L to avoid human confusion when read aloud.
// Retries up to 5 times if the candidate already exists that day.
// ---------------------------------------------------------------------------
const ORDER_NO_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function generateUniqueOrderNumber(db: Firestore): Promise<string> {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  for (let attempt = 0; attempt < 5; attempt++) {
    let rand = "";
    for (let i = 0; i < 4; i++) {
      rand +=
        ORDER_NO_ALPHABET[Math.floor(Math.random() * ORDER_NO_ALPHABET.length)];
    }
    const candidate = `SHERA-${yy}${mm}${dd}-${rand}`;

    const existing = await db
      .collection("orders")
      .where("orderNumber", "==", candidate)
      .limit(1)
      .get();

    if (existing.empty) return candidate;
  }
  throw new Error("Could not generate a unique order number");
}

type Body = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

function fail(error: string, status = 400) {
  return NextResponse.json({ verified: false, error }, { status });
}

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
      const existing = await db
        .collection("orders")
        .where("razorpayOrderId", "==", razorpay_order_id)
        .limit(1)
        .get();
      return NextResponse.json({
        verified: true,
        orderId: existing.empty ? null : existing.docs[0].id,
        orderNumber: existing.empty
          ? null
          : (existing.docs[0].data()?.orderNumber ?? null),
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

    // ---------- 4. Order number generate ----------
    const orderNumber = await generateUniqueOrderNumber(db);

    // ---------- 5. AB order banao ----------
    const orderRef = db.collection("orders").doc();
    const orderId = orderRef.id;
    const paymentRef = db.collection("payments").doc();
    const paymentId = paymentRef.id;

    const batch = db.batch();

    batch.set(orderRef, {
      orderId, // Firestore doc id (internal)
      orderNumber, // SHERA-YYMMDD-XXXX (customer-facing)
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
      orderNumber, // same number for easy join
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

    batch.update(sessionDoc.ref, { status: "consumed" });
    batch.delete(sessionDoc.ref);

    await batch.commit();

    // ---------- 6. Email (same orderNumber pass karo) ----------
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    try {
      await fetch(`${siteUrl}/api/orders/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          orderNumber, // ← SHERA-YYMMDD-XXXX
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
      orderNumber,
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
