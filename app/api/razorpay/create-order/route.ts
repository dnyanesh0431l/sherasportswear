import { adminAuth, adminDb } from "@/lib/firebase/admin"; // your Admin SDK init
import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const SHIPPING_FEE_PAISE = 8000;
const TAX_RATE = 0.05;

export async function POST(req: Request) {
  try {
    // 1. Must be a signed-in user
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await adminAuth.verifyIdToken(token);

    // 2. Validate input (no amount from the client)
    const { items, receipt } = await req.json();
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50 ||
      !items.every(
        (i) =>
          typeof i?.productId === "string" &&
          Number.isInteger(i.quantity) &&
          i.quantity >= 1 &&
          i.quantity <= 20,
      ) ||
      typeof receipt !== "string" ||
      receipt.length > 40
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 3. Price from YOUR catalog, never from the client
    const refs = items.map((i) => adminDb.doc(`products/${i.productId}`));
    const snaps = await adminDb.getAll(...refs);
    let subtotal = 0;
    for (let n = 0; n < snaps.length; n++) {
      const price = snaps[n].exists ? snaps[n].get("pricePaise") : null; // <- your field name
      if (typeof price !== "number") {
        return NextResponse.json({ error: "Invalid product" }, { status: 400 });
      }
      subtotal += price * items[n].quantity;
    }
    const tax = Math.round(subtotal * TAX_RATE);
    const amountPaise = subtotal + SHIPPING_FEE_PAISE + tax;

    // 4. Create the Razorpay order and remember what it was for
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: { uid: user.uid, source: "storefront-checkout" },
    });
    await adminDb.doc(`razorpayOrders/${order.id}`).set({
      uid: user.uid,
      amountPaise,
      receipt,
      createdAt: new Date(),
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error("razorpay create-order error", err);
    return NextResponse.json(
      { error: "Could not create payment order" },
      { status: 500 },
    );
  }
}
