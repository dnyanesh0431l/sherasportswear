// app/api/razorpay/webhook/route.ts
import crypto from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getAdminApp() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKeyRaw)
      throw new Error(
        "Missing Firebase Admin env vars: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY",
      );
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

export async function POST(req: Request) {
  let stage = "init";
  const startedAt = Date.now();
  console.log("[webhook] === START ===");

  try {
    const raw = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    stage = "secret-check";
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[webhook] RAZORPAY_WEBHOOK_SECRET missing");
      return NextResponse.json(
        { ok: false, error: "Server misconfigured (webhook secret)" },
        { status: 500 },
      );
    }

    stage = "signature-verify";
    const expected = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.warn("[webhook] signature mismatch");
      return NextResponse.json(
        { ok: false, error: "Invalid signature" },
        { status: 400 },
      );
    }

    stage = "parse-event";
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch (parseErr) {
      console.error("[webhook] JSON parse failed", parseErr);
      return NextResponse.json(
        { ok: false, error: "Bad JSON" },
        { status: 400 },
      );
    }
    console.log("[webhook] event:", event.event);

    if (event.event === "payment.captured" || event.event === "order.paid") {
      stage = "extract-payment";
      const payment = event.payload?.payment?.entity;
      const razorpayOrderId: string | undefined = payment?.order_id;
      const razorpayPaymentId: string | undefined = payment?.id;
      if (!razorpayOrderId || !razorpayPaymentId)
        return NextResponse.json({ ok: true });

      const db = getAdminDb();

      stage = "idempotency-check";
      const existingOrders = await db
        .collection("orders")
        .where("razorpayOrderId", "==", razorpayOrderId)
        .limit(1)
        .get();
      if (!existingOrders.empty) return NextResponse.json({ ok: true });

      stage = "find-session";
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

      stage = "amount-check";
      if (Number(session.totalPaise) !== amountPaise) {
        console.error("[webhook] amount mismatch", razorpayOrderId);
        return NextResponse.json({ ok: true });
      }

      stage = "batch-write";
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

      try {
        await batch.commit();
      } catch (batchErr) {
        console.error("[webhook] BATCH COMMIT FAILED", batchErr);
        return NextResponse.json(
          { ok: false, error: "DB write failed" },
          { status: 500 },
        );
      }
    }

    console.log("[webhook] === DONE ===", {
      elapsedMs: Date.now() - startedAt,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(`[webhook] FATAL at stage=${stage}`, {
      message: err?.message,
      stack: err?.stack,
    });
    return NextResponse.json(
      { ok: false, error: err?.message || "Webhook failed", stage },
      { status: 500 },
    );
  }
}
