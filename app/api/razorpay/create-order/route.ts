// app/api/razorpay/create-order/route.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";

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

function badRequest(error: string, status = 400, stage?: string) {
  return NextResponse.json({ error, stage }, { status });
}

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------
function logEnvPresence() {
  console.log("[create-order] ENV presence:", {
    NEXT_PUBLIC_RAZORPAY_KEY_ID: !!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: !!process.env.RAZORPAY_KEY_SECRET,
    FIREBASE_ADMIN_PROJECT_ID: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
    FIREBASE_ADMIN_CLIENT_EMAIL: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    FIREBASE_ADMIN_PRIVATE_KEY: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  });
  const id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (id) {
    const mode = id.startsWith("rzp_live_")
      ? "LIVE"
      : id.startsWith("rzp_test_")
        ? "TEST"
        : "UNKNOWN";
    console.log(
      "[create-order] Razorpay key mode:",
      mode,
      "| prefix:",
      id.slice(0, 10) + "…",
    );
  } else {
    console.warn("[create-order] NEXT_PUBLIC_RAZORPAY_KEY_ID is missing");
  }
}

function findMissingEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)
    missing.push("NEXT_PUBLIC_RAZORPAY_KEY_ID");
  if (!process.env.RAZORPAY_KEY_SECRET) missing.push("RAZORPAY_KEY_SECRET");
  if (!process.env.FIREBASE_ADMIN_PROJECT_ID)
    missing.push("FIREBASE_ADMIN_PROJECT_ID");
  if (!process.env.FIREBASE_ADMIN_CLIENT_EMAIL)
    missing.push("FIREBASE_ADMIN_CLIENT_EMAIL");
  if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY)
    missing.push("FIREBASE_ADMIN_PRIVATE_KEY");
  return missing;
}

function logRazorpayError(context: string, e: any) {
  console.error(`[${context}] Razorpay SDK error:`, {
    message: e?.message,
    statusCode: e?.statusCode,
    code: e?.error?.code,
    description: e?.error?.description,
    source: e?.error?.source,
    step: e?.error?.step,
    reason: e?.error?.reason,
    metadata: e?.error?.metadata,
    stack: e?.stack,
  });
}

function razorpayErrorMessage(e: any): string {
  return (
    e?.error?.description ||
    e?.error?.reason ||
    e?.message ||
    "Razorpay request failed"
  );
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

function norm(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

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

    let variantData: FirebaseFirestore.DocumentData | null = null;
    let variantDocId: string | null = null;

    try {
      const variantsRef = db
        .collection("products")
        .doc(productId)
        .collection("variants");

      let vSnap = await variantsRef
        .where("size", "==", size)
        .where("color", "==", color)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (vSnap.empty) {
        vSnap = await variantsRef
          .where("size", "==", size)
          .where("status", "==", "active")
          .limit(1)
          .get();
      }

      if (vSnap.empty) {
        vSnap = await variantsRef.where("size", "==", size).limit(1).get();
      }

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
      console.warn(
        "[create-order] variants subcollection read failed",
        { productId, size, color },
        err,
      );
    }

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
  let stage = "init";
  const startedAt = Date.now();
  console.log("[create-order] === START ===");

  try {
    // ---------- 0. ENV CHECK ----------
    stage = "env-check";
    logEnvPresence();
    const missing = findMissingEnv();
    if (missing.length > 0) {
      console.error("[create-order] MISSING ENV VARS:", missing);
      return NextResponse.json(
        {
          error: `Server misconfigured. Missing env vars: ${missing.join(", ")}`,
          stage,
          missing,
        },
        { status: 500 },
      );
    }

    // ---------- 1. Auth ----------
    stage = "auth";
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    if (!idToken) {
      console.warn("[create-order] no bearer token");
      return badRequest("Unauthorized", 401, stage);
    }

    let uid: string;
    let userEmail = "";
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
      userEmail = decoded.email ?? "";
      console.log("[create-order] auth OK", { uid, email: userEmail });
    } catch (authErr) {
      console.error("[create-order] verifyIdToken failed", authErr);
      return badRequest("Unauthorized", 401, stage);
    }

    // ---------- 2. Parse items ----------
    stage = "parse-body";
    const body = (await req.json().catch((e) => {
      console.error("[create-order] body parse failed", e);
      return null;
    })) as {
      items?: IncomingItem[];
      email?: string;
      phone?: string;
      shippingAddress?: Record<string, unknown>;
    } | null;

    const rawItems = body?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      console.warn("[create-order] cart empty");
      return badRequest("Cart is empty", 400, stage);
    }
    if (rawItems.length > MAX_ITEMS) {
      return badRequest("Too many items in cart", 400, stage);
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
        console.warn("[create-order] invalid item shape", it);
        return badRequest("Invalid cart item", 400, stage);
      }
      const qty = Math.floor(it.quantity);
      if (qty < 1 || qty > MAX_QTY_PER_ITEM) {
        return badRequest("Invalid quantity", 400, stage);
      }
      items.push({
        productId: it.productId.trim(),
        size: it.size.trim(),
        color: it.color.trim(),
        quantity: qty,
      });
    }
    console.log("[create-order] parsed items", {
      count: items.length,
      productIds: items.map((i) => i.productId),
    });

    // ---------- 3. Re-price ----------
    stage = "pricing";
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
      console.error("[create-order] PRICING FAILED", priceErr);
      return badRequest(
        (priceErr as Error)?.message || "Pricing failed",
        400,
        stage,
      );
    }

    const subtotalPaise = pricedItems.reduce(
      (s, it) => s + it.lineTotalPaise,
      0,
    );
    const discountPaise = 0;
    const shippingPaise = SHIPPING_FEE_PAISE;
    const totalPaise = subtotalPaise - discountPaise + shippingPaise;

    console.log("[create-order] pricing", {
      subtotalPaise,
      shippingPaise,
      totalPaise,
    });

    if (totalPaise < 100) {
      return badRequest("Order total is too low", 400, stage);
    }

    // ---------- 4. Razorpay order ----------
    stage = "razorpay-create";
    const razorpay = getRazorpay();
    const sessionRef = db.collection("payment_sessions").doc();
    const sessionId = sessionRef.id;

    let rzpOrder: any;
    try {
      rzpOrder = await razorpay.orders.create({
        amount: totalPaise,
        currency: "INR",
        receipt: sessionId,
        notes: { sessionId, userId: uid },
      });
      console.log("[create-order] razorpay order created", {
        id: rzpOrder.id,
        amount: rzpOrder.amount,
        status: rzpOrder.status,
      });
    } catch (rzpErr) {
      logRazorpayError("create-order/razorpay-create", rzpErr);
      return NextResponse.json(
        {
          error: razorpayErrorMessage(rzpErr),
          stage,
          code: (rzpErr as any)?.error?.code ?? null,
        },
        { status: 502 }, // upstream failure
      );
    }

    // ---------- 5. Temporary session ----------
    stage = "session-save";
    try {
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
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
      console.log("[create-order] session saved", sessionId);
    } catch (saveErr) {
      console.error("[create-order] SESSION SAVE FAILED", {
        sessionId,
        error: saveErr,
      });
      return NextResponse.json(
        { error: "Could not save payment session", stage },
        { status: 500 },
      );
    }

    console.log("[create-order] === SUCCESS ===", {
      sessionId,
      razorpayOrderId: rzpOrder.id,
      elapsedMs: Date.now() - startedAt,
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
  } catch (err: any) {
    console.error(`[create-order] FATAL at stage=${stage}`, {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      raw: err,
    });
    return NextResponse.json(
      {
        error: err?.message || "Could not create payment order",
        stage,
      },
      { status: 500 },
    );
  }
}
