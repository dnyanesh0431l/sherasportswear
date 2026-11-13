// app/api/razorpay/verify/route.ts
import crypto from "crypto";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";

// NOTE: use Firebase Admin SDK for server-side writes.
// If you already have `lib/firebase/admin.ts`, import that instead:
//   import { adminDb } from "@/lib/firebase/admin";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// ---------- Firebase Admin init (idempotent) ----------
function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
          /\\n/g,
          "\n",
        ),
      }),
    });
  }
  return getFirestore();
}

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

type Body = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { verified: false, error: "Missing fields" },
        { status: 400 },
      );
    }

    // ---------- 1. Verify HMAC signature ----------
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("[verify] RAZORPAY_KEY_SECRET is not set");
      return NextResponse.json(
        { verified: false, error: "Server misconfigured" },
        { status: 500 },
      );
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(razorpay_signature, "hex");

    if (expectedBuf.length !== receivedBuf.length) {
      console.warn("[verify] signature length mismatch");
      return NextResponse.json(
        { verified: false, error: "Signature mismatch" },
        { status: 400 },
      );
    }

    const verified = crypto.timingSafeEqual(expectedBuf, receivedBuf);
    if (!verified) {
      console.warn("[verify] invalid signature", {
        razorpay_order_id,
        razorpay_payment_id,
      });
      return NextResponse.json(
        { verified: false, error: "Invalid signature" },
        { status: 400 },
      );
    }

    // ---------- 2. Fetch the real payment from Razorpay ----------
    // Never trust the client. Fetch the payment object to get the *actual*
    // amount, status and method — this also prevents someone replaying a
    // small payment against a big order.
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status !== "captured" && payment.status !== "authorized") {
      console.warn("[verify] payment not captured", {
        payment_id: razorpay_payment_id,
        status: payment.status,
      });
      return NextResponse.json(
        { verified: false, error: `Payment status: ${payment.status}` },
        { status: 400 },
      );
    }

    const amountPaise = Number(payment.amount);
    const paymentOrderId = payment.order_id;

    if (paymentOrderId !== razorpay_order_id) {
      return NextResponse.json(
        { verified: false, error: "Order ID mismatch" },
        { status: 400 },
      );
    }

    // ---------- 3. Confirm the order in Firestore (server-side) ----------
    // We look up the order by `razorpayOrderId` (saved by checkout).
    const db = getAdminDb();
    const ordersSnap = await db
      .collection("orders")
      .where("razorpayOrderId", "==", razorpay_order_id)
      .limit(1)
      .get();

    if (ordersSnap.empty) {
      console.error("[verify] no order matches razorpayOrderId", {
        razorpay_order_id,
      });
      return NextResponse.json(
        { verified: false, error: "Order not found for payment" },
        { status: 404 },
      );
    }

    const orderDoc = ordersSnap.docs[0];
    const orderData = orderDoc.data();

    // Amount sanity check
    if (Number(orderData.totalPaise) !== amountPaise) {
      console.error("[verify] amount mismatch", {
        orderId: orderDoc.id,
        expected: orderData.totalPaise,
        paid: amountPaise,
      });
      return NextResponse.json(
        { verified: false, error: "Amount mismatch" },
        { status: 400 },
      );
    }

    // If already confirmed (webhook race), return success without re-writing
    if (orderData.paymentStatus === "captured") {
      return NextResponse.json({ verified: true, orderId: orderDoc.id });
    }

    // ---------- 4. Atomically mark order + payment as captured ----------
    const paymentId = orderData.paymentId as string;
    const batch = db.batch();

    batch.update(orderDoc.ref, {
      status: "confirmed",
      paymentStatus: "captured",
      paymentMethod: "razorpay",
      razorpayPaymentId: razorpay_payment_id,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (paymentId) {
      batch.update(db.collection("payments").doc(paymentId), {
        status: "captured",
        providerPaymentId: razorpay_payment_id,
        method: payment.method || "online",
        capturedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return NextResponse.json({
      verified: true,
      orderId: orderDoc.id,
    });
  } catch (err) {
    console.error("[verify] error", err);
    return NextResponse.json(
      { verified: false, error: "Verification failed" },
      { status: 500 },
    );
  }
}
