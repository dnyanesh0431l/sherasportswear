// app/api/razorpay/webhook/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getAdminApp() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY!
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

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret)
      return NextResponse.json({ ok: false }, { status: 500 });

    const expected = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
      return NextResponse.json({ ok: false }, { status: 400 });

    const event = JSON.parse(raw);

    if (event.event === "payment.captured" || event.event === "order.paid") {
      const payment = event.payload?.payment?.entity;
      const razorpayOrderId: string | undefined = payment?.order_id;
      const razorpayPaymentId: string | undefined = payment?.id;
      if (!razorpayOrderId || !razorpayPaymentId)
        return NextResponse.json({ ok: true });

      const db = getAdminDb();

      // Pehle dekho order already bana to nahi
      const existingOrders = await db
        .collection("orders")
        .where("razorpayOrderId", "==", razorpayOrderId)
        .limit(1)
        .get();
      if (!existingOrders.empty)
        return NextResponse.json({ ok: true }); // idempotent

      // Session dhundo
      const sessionsSnap = await db
        .collection("payment_sessions")
        .where("razorpayOrderId", "==", razorpayOrderId)
        .limit(1)
        .get();
      if (sessionsSnap.empty) {
        console.warn("[webhook] session missing", razorpayOrderId);
        return NextResponse.json({ ok: true });
      }

      const sessionDoc = sessionsSnap.docs[0];
      const session = sessionDoc.data();
      const amountPaise = Number(payment.amount);
      if (Number(session.totalPaise) !== amountPaise) {
        console.error("[webhook] amount mismatch", razorpayOrderId);
        return NextResponse.json({ ok: true });
      }

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
        razorpayOrderId,
        razorpayPaymentId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(paymentRef, {
        paymentId,
        orderId,
        userId: session.userId,
        provider: "razorpay",
        providerOrderId: razorpayOrderId,
        providerPaymentId: razorpayPaymentId,
        amountPaise,
        currency: "INR",
        status: "captured",
        method: "card",
        capturedAt: FieldValue.serverTimestamp(),
        failureReason: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.delete(sessionDoc.ref);
      await batch.commit();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}