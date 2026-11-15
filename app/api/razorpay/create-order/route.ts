// app/api/razorpay/create-order/route.ts
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------
function getAdminApp() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKeyRaw) {
      throw new Error(
        "Missing Firebase Admin env vars: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY",
      );
    }

    const privateKey = privateKeyRaw
      .replace(/^["']/, "")
      .replace(/["']$/, "")
      .replace(/\\n/g, "\n");

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getApps()[0];
}

function getAdminDb() {
  getAdminApp();
  return getFirestore();
}

function getAdminAuth() {
  getAdminApp();
  return getAuth();
}

// ---------------------------------------------------------------------------
// Razorpay client
// ---------------------------------------------------------------------------
function getRazorpay() {
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "Missing Razorpay env vars: NEXT_PUBLIC_RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET",
    );
  }
  return new Razorpay({ key_id, key_secret });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SHIPPING_FEE_PAISE = 8000; // ₹80
const MAX_QTY_PER_ITEM = 99;
const MAX_ITEMS = 50;
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

type IncomingItem = {
  productId: string;
  size: string;
  color: string;
  quantity: number;
};

type PricedItem = {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  variantLabel: string;
  size: string;
  color: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  imageUrl: string;
};

function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// ---------------------------------------------------------------------------
// Price helpers — SELLING PRICE ONLY (pricePaise), MRP never used
// ---------------------------------------------------------------------------
function pickSellingPrice(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Normalize strings for comparison: trim, lowercase, collapse spaces. */
function norm(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Resolve the selling price for a cart item.
 * Handles three shapes:
 *   1) Product with `hasVariants: true` → look up variants subcollection
 *   2) Product without variants     → product-level pricePaise / basePricePaise
 *   3) Variants stored as an array ON the product doc (legacy) → scan array
 */
async function resolveItemPrice(
  db: FirebaseFirestore.Firestore,
  productId: string,
  size: string,
  color: string,
): Promise<{
  unitPricePaise: number;
  variantSku: string | null;
  variantDocId: string | null;
  product: FirebaseFirestore.DocumentData;
}> {
  const productSnap = await db.collection("products").doc(productId).get();
  if (!productSnap.exists) {
    throw new Error(`Product not found: ${productId}`);
  }
  const product = productSnap.data()!;
  const hasVariants =
    product.hasVariants === true ||
    (Array.isArray(product.variants) && product.variants.length > 0);

  // ---------- A. Product has variants ----------
  if (hasVariants) {
    const wantSize = norm(size);
    const wantColor = norm(color);

    // A1. Variants subcollection
    let variantData: FirebaseFirestore.DocumentData | null = null;
    let variantDocId: string | null = null;

    try {
      const variantsRef = db
        .collection("products")
        .doc(productId)
        .collection("variants");

      // exact size + color + active
      let vSnap = await variantsRef
        .where("size", "==", size)
        .where("color", "==", color)
        .where("status", "==", "active")
        .limit(1)
        .get();

      // size + active
      if (vSnap.empty) {
        vSnap = await variantsRef
          .where("size", "==", size)
          .where("status", "==", "active")
          .limit(1)
          .get();
      }

      // size only
      if (vSnap.empty) {
        vSnap = await variantsRef.where("size", "==", size).limit(1).get();
      }

      // last resort: fetch all active and match in JS (case/space tolerant)
      if (vSnap.empty) {
        const all = await variantsRef.get();
        const match = all.docs.find((d) => {
          const v = d.data();
          return (
            norm(v.size) === wantSize &&
            norm(v.color) === wantColor &&
            (v.status === "active" || v.status === undefined)
          );
        });
        if (match) {
          variantData = match.data();
          variantDocId = match.id;
        }
      } else {
        variantData = vSnap.docs[0].data();
        variantDocId = vSnap.docs[0].id;
      }
    } catch (err) {
      // Subcollection may not exist — fall through to array check
      console.warn("[create-order] variants subcollection read failed", err);
    }

    // A2. Legacy array on the product doc
    if (!variantData && Array.isArray(product.variants)) {
      const match = (product.variants as FirebaseFirestore.DocumentData[]).find(
        (v) =>
          norm(v.size) === wantSize &&
          norm(v.color) === wantColor &&
          (v.status === "active" || v.status === undefined),
      );
      if (match) variantData = match;
    }

    if (!variantData) {
      throw new Error(
        `Variant not found: ${productId} / size=${size} / color=${color}`,
      );
    }

    const price = pickSellingPrice(
      variantData.pricePaise,
      variantData.price,
      product.basePricePaise,
    );
    if (price === null) {
      throw new Error(
        `Invalid selling price for variant: ${productId} / ${size} / ${color}`,
      );
    }

    return {
      unitPricePaise: price,
      variantSku: (variantData.sku as string) || null,
      variantDocId,
      product,
    };
  }

  // ---------- B. Simple product (no variants) ----------
  const price = pickSellingPrice(
    product.pricePaise,
    product.price,
    product.basePricePaise,
  );
  if (price === null) {
    throw new Error(`Invalid selling price: ${productId}`);
  }

  return {
    unitPricePaise: price,
    variantSku: (product.sku as string) || null,
    variantDocId: null,
    product,
  };
}

// ---------------------------------------------------------------------------
// POST /api/razorpay/create-order
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    // ---------- 1. Auth ----------
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    if (!idToken) return badRequest("Unauthorized", 401);

    let uid: string;
    let userEmail = "";
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
      userEmail = decoded.email ?? "";
    } catch {
      return badRequest("Unauthorized", 401);
    }

    // ---------- 2. Parse items ----------
    const body = (await req.json().catch(() => null)) as {
      items?: IncomingItem[];
      email?: string;
      phone?: string;
      shippingAddress?: Record<string, unknown>;
    } | null;

    const rawItems = body?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return badRequest("Cart is empty");
    }
    if (rawItems.length > MAX_ITEMS) {
      return badRequest("Too many items in cart");
    }

    const items: IncomingItem[] = [];
    for (const it of rawItems) {
      if (
        !it ||
        typeof it.productId !== "string" ||
        !it.productId.trim() ||
        typeof it.size !== "string" ||
        typeof it.color !== "string" ||
        typeof it.quantity !== "number"
      ) {
        return badRequest("Invalid cart item");
      }
      const qty = Math.floor(it.quantity);
      if (qty < 1 || qty > MAX_QTY_PER_ITEM) {
        return badRequest("Invalid quantity");
      }
      items.push({
        productId: it.productId.trim(),
        size: it.size.trim(),
        color: it.color.trim(),
        quantity: qty,
      });
    }

    // ---------- 3. Re-price ----------
    const db = getAdminDb();

    let pricedItems: PricedItem[];
    try {
      pricedItems = await Promise.all(
        items.map(async (it) => {
          const { unitPricePaise, variantSku, variantDocId, product } =
            await resolveItemPrice(db, it.productId, it.size, it.color);

          const name = String(product.name ?? "Product");
          const imagesArr = Array.isArray(product.images) ? product.images : [];
          const imageUrl = String(
            imagesArr[0] ?? product.image ?? product.imageUrl ?? "",
          );

          const variantId =
            variantDocId ||
            `${it.productId}-${it.size}-${it.color}`
              .toLowerCase()
              .replace(/\s+/g, "-");

          const sku =
            variantSku ||
            `SHERA-${it.productId}-${it.size}-${it.color}`
              .toUpperCase()
              .replace(/\s+/g, "");

          return {
            productId: it.productId,
            variantId,
            sku,
            name,
            variantLabel: `${it.size} / ${it.color}`,
            size: it.size,
            color: it.color,
            quantity: it.quantity,
            unitPricePaise,
            lineTotalPaise: unitPricePaise * it.quantity,
            imageUrl,
          };
        }),
      );
    } catch (priceErr) {
      console.error("[create-order] pricing failed", priceErr);
      return badRequest((priceErr as Error)?.message || "Pricing failed");
    }

    const subtotalPaise = pricedItems.reduce(
      (s, it) => s + it.lineTotalPaise,
      0,
    );
    const discountPaise = 0;
    const shippingPaise = SHIPPING_FEE_PAISE;
    const totalPaise = subtotalPaise - discountPaise + shippingPaise;

    if (totalPaise < 100) {
      return badRequest("Order total is too low");
    }

    // ---------- 4. Razorpay order ----------
    const razorpay = getRazorpay();
    const sessionRef = db.collection("payment_sessions").doc();
    const sessionId = sessionRef.id;

    const rzpOrder = await razorpay.orders.create({
      amount: totalPaise,
      currency: "INR",
      receipt: sessionId,
      notes: { sessionId, userId: uid },
    });

    // ---------- 5. Temporary session (orders NAHI) ----------
    await sessionRef.set({
      sessionId,
      userId: uid,
      email: (body?.email || userEmail || "").trim(),
      phone: (body?.phone || "").trim(),
      shippingAddress: body?.shippingAddress || null,
      items: pricedItems,
      subtotalPaise,
      discountPaise,
      shippingPaise,
      totalPaise,
      currency: "INR",
      razorpayOrderId: rzpOrder.id,
      status: "pending", // pending | consumed
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return NextResponse.json({
      sessionId,
      razorpayOrderId: rzpOrder.id,
      amount: totalPaise,
      currency: "INR",
      items: pricedItems,
      subtotalPaise,
      shippingPaise,
      totalPaise,
    });
  } catch (err) {
    console.error("[create-order] error", err);
    return NextResponse.json(
      { error: (err as Error)?.message || "Could not create payment order" },
      { status: 500 },
    );
  }
}