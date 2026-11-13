import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
  try {
    const { amountPaise, receipt } = await req.json();

    if (typeof amountPaise !== "number" || amountPaise < 100) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 },
      );
    }

    const order = await razorpay.orders.create({
      amount: amountPaise, // already in paise
      currency: "INR",
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: { source: "storefront-checkout" },
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