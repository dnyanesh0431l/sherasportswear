# Shera Sports Wear — Firestore Schema

## Global Conventions

- **Money** is always `Int` in **paise**. ₹2,399 → `239900`. Never `Float`. Never strings. A write is rejected if the amount is not an integer or is negative.
- **Timestamps** are Firestore `Timestamp`, written server-side.
- **IDs are never stored as fields** — the document ID is the ID.
- **Foreign keys** are stored as `string` document IDs. Never `DocumentReference`.
- **Out of scope entirely:** inventory/stock, reviews, ratings, coupons, refunds, returns.

---

## Collection Map

```text
users/{uid}
users/{uid}/addresses/{addressId}
users/{uid}/wishlist/{uid}
users/{uid}/wishlist/{uid}/items/{productId}

carts/{cartId}
carts/{cartId}/items/{itemId}

products/{productId}
products/{productId}/variants/{variantId}

categories/{categoryId}
collections/{collectionId}

orders/{orderId}
orders/{orderId}/shipments/{shipmentId}

payments/{paymentId}
payments/{paymentId}/webhookEvents/{eventId}
idempotencyKeys/{key}

banners/{bannerId}
homepageSections/{sectionId}
```

### Access Tiers

- **Public reads:** `products`, `products/*/variants`, `categories`, `collections`, `banners`, `homepageSections`
- **Owner-only:** `users`, `users/*/addresses`, `users/*/wishlist`, `carts`, `orders`, `orders/*/shipments`
- **Server-only:** `payments`, `payments/*/webhookEvents`, `idempotencyKeys`

---

## 1. `users/{uid}`

**Doc ID:** Firebase Auth UID  
**Access:** Owner read + limited write · Admin read · Server-only for `role`, `status`, `stats`

### Fields

- `email` — `string | null` — required — mirrors Auth
- `emailVerified` — `boolean` — required
- `displayName` — `string | null` — required
- `phoneNumber` — `string | null` — required — 10-digit Indian mobile
- `photoURL` — `string | null` — required
- `role` — `'customer' | 'admin'` — required — display mirror only; real auth uses `request.auth.token.admin`
- `status` — `'active' | 'disabled' | 'deletion_requested' | 'deleted'` — required
- `defaultAddressId` — `string | null` — required — points into `users/{uid}/addresses/*`
- `marketingConsent` — `{ email, sms, whatsapp, updatedAt }` — required
- `stats` — `{ orderCount, lifetimeValue, lastOrderAt }` — required — denormalised
- `lastLoginAt` — `Timestamp | null` — required
- `deletedAt` — `Timestamp | null` — optional
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Write Rules

- Client-writable: `displayName`, `phoneNumber`, `photoURL`, `marketingConsent`, `defaultAddressId`
- Server-only: `role`, `status`, `stats`, all timestamps

### Index

- `status ASC, createdAt DESC`

---

## 2. `users/{uid}/addresses/{addressId}`

**Doc ID:** auto-generated  
**Access:** Owner only

### Fields

- `userId` — `string` — required — must equal parent `uid`
- `fullName` — `string` — required
- `phoneNumber` — `string` — required
- `line1` — `string` — required
- `line2` — `string | null` — optional
- `landmark` — `string | null` — optional
- `city` — `string` — required
- `state` — `string` — required
- `postalCode` — `string` — required — 6-digit PIN
- `country` — `string` — required — default `"IN"`
- `deliveryInstructions` — `string | null` — optional
- `label` — `'home' | 'work' | 'other'` — required
- `isDefault` — `boolean` — required — at most one `true` per user
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Index

- `userId ASC, isDefault DESC`

---

## 3. `users/{uid}/wishlist/{uid}`

**Doc ID:** exactly `=== uid`  
**Access:** Owner only

### Fields

- `userId` — `string` — required
- `itemCount` — `number` — required — denormalised
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

---

## 4. `users/{uid}/wishlist/{uid}/items/{productId}`

**Doc ID:** `productId` — duplicates structurally impossible  
**Access:** Owner only

### Fields

- `wishlistId` — `string` — required — equals `uid`
- `productId` — `string` — required — points into `products/*`
- `snapshot` — `{ slug, name, imageUrl, price, mrp }` — required — denormalised
- `addedAt` — `Timestamp` — required

### Index

- `wishlistId ASC, addedAt DESC`

---

## 5. `carts/{cartId}`

**Doc ID:** `uid` for signed-in users · `guest_<uuid>` for guests  
**Access:** Owner only

### Fields

- `ownerType` — `'user' | 'guest'` — required
- `userId` — `string | null` — required
- `guestTokenHash` — `string | null` — required — SHA-256 only
- `currency` — `'INR'` — required
- `itemCount` — `number` — required — denormalised
- `lineItemCount` — `number` — required — denormalised
- `subtotal` — `number` (paise) — required — denormalised, untrusted
- `expiresAt` — `Timestamp | null` — required
- `lastSyncedAt` — `Timestamp | null` — required
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Indexes

- `userId ASC`
- `expiresAt ASC`

---

## 6. `carts/{cartId}/items/{itemId}`

**Doc ID:** `${productId}__${variantId}`  
**Access:** Owner only

### Fields

- `cartId` — `string` — required
- `productId` — `string` — required — points into `products/*`
- `variantId` — `string` — required — points into `products/*/variants/*`
- `quantity` — `number` (1–10) — required
- `snapshot` — `{ productId, variantId, slug, name, sku, imageUrl, sizeLabel, colorName, unitPrice, mrp }` — required — **untrusted**; re-read at checkout
- `addedAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Index

- `cartId ASC, addedAt ASC`

---

## 7. `products/{productId}`

**Doc ID:** auto-generated  
**Access:** Public read when `status == 'active'` · Admin write

### Fields

- `slug` — `string` — required — unique
- `name` — `string` — required
- `shortDescription` — `string` — required
- `description` — `string` — required
- `brand` — `string` — required
- `categoryId` — `string` — required — points into `categories/*`
- `categoryPath` — `string[]` — required — denormalised root → parent
- `collectionIds` — `string[]` — required — denormalised, max 20
- `productType` — `'shoes' | 'apparel' | 'accessories' | 'equipment' | 'other'` — required
- `status` — `'draft' | 'active' | 'archived'` — required
- `sku` — `string` — required — unique
- `hsnCode` — `string | null` — optional
- `mrp` — `number` (paise) — required — e.g. `239900`
- `price` — `number` (paise) — required — must be ≤ `mrp`
- `discountPercent` — `number` — required — denormalised
- `discountLabel` — `string | null` — optional
- `saleEndsAt` — `Timestamp | null` — optional
- `images` — `OrderedImageAsset[]` (1–10) — required
- `hoverImage` — `ImageAsset | null` — optional
- `attributes` — `Record<string, unknown>` — required
- `filterTags` — `string[]` — required
- `tags` — `string[]` — required
- `optionColors` — `{ slug, name, hex?, order }[]` — required
- `optionSizes` — `{ value, label, system, order }[]` — required
- `variantCount` — `number` — required — denormalised
- `minPrice` — `number` (paise) — required — denormalised
- `maxPrice` — `number` (paise) — required — denormalised
- `isFeatured` — `boolean` — required
- `isBestseller` — `boolean` — required
- `seo` — `SeoMetadata` — required
- `publishedAt` — `Timestamp | null` — optional
- `archivedAt` — `Timestamp | null` — optional
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Indexes

- `status ASC, categoryId ASC, price ASC`
- `status ASC, categoryId ASC, createdAt DESC`
- `status ASC, categoryPath ARRAY, price ASC`
- `status ASC, collectionIds ARRAY`
- `status ASC, isFeatured ASC, publishedAt DESC`
- `status ASC, isBestseller ASC, price ASC`
- `status ASC, filterTags ARRAY, price ASC`
- `status ASC, productType ASC, price ASC`
- `slug ASC` — unique, server-enforced

---

## 8. `products/{productId}/variants/{variantId}`

**Doc ID:** `${colorSlug}__${sizeValue}`  
**Access:** Public read when `isActive == true` · Admin write

### Fields

- `productId` — `string` — required
- `sku` — `string` — required — unique
- `barcode` — `string | null` — optional — unique
- `colorSlug` — `string` — required — must match parent `optionColors[].slug`
- `colorName` — `string` — required — denormalised
- `sizeValue` — `string` — required — must match parent `optionSizes[].value`
- `sizeLabel` — `string` — required — denormalised
- `priceOverride` — `number | null` — required — paise; `null` means inherit
- `mrpOverride` — `number | null` — required — paise; `null` means inherit
- `images` — `ImageAsset[]` — optional
- `isActive` — `boolean` — required
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Indexes

- `productId ASC, isActive ASC`
- `isActive ASC, sizeValue ASC`
- `isActive ASC, colorSlug ASC`

---

## 9. `categories/{categoryId}`

**Doc ID:** auto-generated  
**Access:** Public read when `isActive == true` · Admin write

### Fields

- `slug` — `string` — required — unique
- `name` — `string` — required
- `description` — `string | null` — optional
- `parentId` — `string | null` — required — `null` means root
- `ancestorIds` — `string[]` — required — denormalised
- `depth` — `number` — required
- `image` — `ImageAsset | null` — optional
- `iconName` — `string | null` — optional
- `order` — `number` — required
- `isActive` — `boolean` — required
- `showInNavigation` — `boolean` — required
- `productCount` — `number` — required — denormalised
- `seo` — `SeoMetadata` — required
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Indexes

- `parentId ASC, order ASC`
- `isActive ASC, showInNavigation ASC, order ASC`

---

## 10. `collections/{collectionId}`

**Doc ID:** auto-generated  
**Access:** Public read when `isActive == true` · Admin write

### Fields

- `slug` — `string` — required — unique
- `name` — `string` — required
- `description` — `string | null` — optional
- `kind` — `'manual' | 'automated'` — required
- `productIds` — `string[]` — required — reference list, max 200
- `rules` — `{ field, operator, value }[]` — optional — automated collections only
- `image` — `ImageAsset | null` — optional
- `order` — `number` — required
- `isActive` — `boolean` — required
- `showOnHomepage` — `boolean` — required
- `seo` — `SeoMetadata` — required
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Index

- `isActive ASC, showOnHomepage ASC, order ASC`

---

## 11. `orders/{orderId}`

**Doc ID:** auto-generated · `orderNumber` is human-readable, e.g. `SSW-20250314-7F2K9`  
**Access:** Owner read · Admin read/write · Server-only creates

### Fields

- `orderNumber` — `string` — required — unique
- `userId` — `string | null` — required — `null` means guest
- `guest` — `{ fullName, email, phoneNumber } | null` — required
- `contactEmail` — `string` — required
- `contactPhone` — `string` — required
- `items` — `OrderItemSnapshot[]` — required — **embedded**, max 100
- `totals` — `OrderTotals` — required — **embedded**, all paise
- `shippingAddress` — `AddressSnapshot` — required — **frozen snapshot**
- `billingAddress` — `AddressSnapshot` — required — **frozen snapshot**
- `status` — `OrderStatus` — required
- `paymentStatus` — `PaymentStatus` — required
- `paymentMethod` — `'cod' | 'online'` — required — coarse logic value
- `paymentId` — `string | null` — required — points into `payments/*`
- `shipmentSummary` — `ShipmentSummary | null` — required — denormalised
- `cancellation` — `CancellationDetails | null` — required
- `customerNote` — `string | null` — required
- `internalNote` — `string | null` — required — admin-only
- `idempotencyKey` — `string` — required — uniqueness enforced by `idempotencyKeys/{key}`
- `statusHistory` — `OrderStatusEvent[]` — required — max 40
- `placedAt` — `Timestamp` — required
- `confirmedAt` — `Timestamp | null` — optional
- `shippedAt` — `Timestamp | null` — optional
- `deliveredAt` — `Timestamp | null` — optional
- `cancelledAt` — `Timestamp | null` — optional
- `closedAt` — `Timestamp | null` — optional
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Embedded `OrderItemSnapshot`

- `productId` — `string`
- `variantId` — `string`
- `sku` — `string`
- `productName` — `string`
- `productSlug` — `string`
- `imageUrl` — `string | null`
- `sizeLabel` — `string | null`
- `colorName` — `string | null`
- `unitMrp` — `number` (paise)
- `unitPrice` — `number` (paise)
- `itemDiscount` — `number` (paise)
- `lineTotal` — `number` (paise)
- `quantity` — `number`
- `taxRatePercent` — optional
- `taxAmount` — optional
- `hsnCode` — optional

### Embedded `OrderTotals`

- `subtotal` — `number` (paise)
- `itemDiscountTotal` — `number` (paise)
- `shippingCharge` — `number` (paise)
- `codFee` — `number` (paise)
- `taxAmount` — `number` (paise)
- `roundOff` — `number` (paise)
- `grandTotal` — `number` (paise)
- `amountPaid` — `number` (paise)
- `currency` — `'INR'`

### Indexes

- `userId ASC, placedAt DESC`
- `status ASC, placedAt DESC`
- `paymentStatus ASC, placedAt DESC`
- `orderNumber ASC` — unique, server-enforced
- `idempotencyKey ASC`

### Allowed Status Transitions — Server-Enforced

```text
pending_payment  → confirmed | cancelled
confirmed        → processing | cancelled
processing       → packed | cancelled
packed           → shipped | cancelled
shipped          → out_for_delivery | delivered
out_for_delivery → delivered
delivered        → terminal
cancelled        → terminal
```

---

## 12. `orders/{orderId}/shipments/{shipmentId}`

**Doc ID:** auto-generated  
**Access:** Owner read · Admin write

### Fields

- `orderId` — `string` — required
- `carrier` — `string` — required
- `carrierName` — `string | null` — optional
- `trackingNumber` — `string` — required
- `trackingUrl` — `string | null` — optional
- `status` — `ShipmentStatus` — required
- `shippedAt` — `Timestamp | null` — required
- `estimatedDeliveryFrom` — `Timestamp | null` — required
- `estimatedDeliveryTo` — `Timestamp | null` — required
- `deliveredAt` — `Timestamp | null` — required
- `events` — `{ status, at, location?, description? }[]` — required — max 25
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Indexes

- `orderId ASC, createdAt DESC`
- `trackingNumber ASC`
- `status ASC, updatedAt DESC`

---

## 13. `payments/{paymentId}`

**Doc ID:** auto-generated  
**Access:** **Server-only** — never client-readable  
**Purpose:** Payment record. No card data, no CVV, no provider secrets.

### Fields

- `orderId` — `string` — required — points into `orders/*`
- `orderNumber` — `string` — required — denormalised
- `userId` — `string | null` — required
- `provider` — `'razorpay' | 'stripe' | 'cashfree' | 'cod'` — required
- `method` — `'cod' | 'online'` — required — coarse business classification
- `instrument` — `'upi' | 'card' | 'netbanking' | 'wallet' | 'emi' | 'paylater' | 'cod' | null` — required — actual instrument reported by provider
- `amount` — `Int` (paise) — required — **integer only**; write rejected if `!Number.isInteger(amount) || amount < 0`; must equal `order.totals.grandTotal` at capture
- `currency` — `'INR'` — required
- `status` — `'created' | 'authorized' | 'captured' | 'failed' | 'cancelled'` — required
- `providerOrderId` — `string | null` — required — provider-issued opaque ID
- `providerPaymentId` — `string | null` — required — provider-issued opaque ID
- `verification` — `ProviderVerification | null` — required
- `capturedAt` — `Timestamp | null` — required
- `failedAt` — `Timestamp | null` — required
- `failureCode` — `string | null` — required
- `failureMessage` — `string | null` — required
- `idempotencyKey` — `string` — required — uniqueness enforced by `idempotencyKeys/{key}`
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### `ProviderVerification` — Discriminated Union

```ts
type ProviderVerification =
  | {
      kind: "razorpay_hmac";
      headerName: "x-razorpay-signature";
      algorithm: "sha256";
      verifiedAt: Timestamp;
    }
  | {
      kind: "stripe_v1";
      headerName: "stripe-signature";
      algorithm: "hmac_sha256";
      toleranceSeconds: number;
      verifiedAt: Timestamp;
    }
  | {
      kind: "cashfree_signature";
      headerName: "x-webhook-signature";
      algorithm: "sha256";
      verifiedAt: Timestamp;
    }
  | { kind: "cod_na"; verifiedAt: null };
```

Rules:

- Every webhook handler validates the specific `kind` it supports. Unknown kinds → reject.
- `verifiedAt` is populated only after the server cryptographically verifies the raw payload using the provider's documented scheme.
- For online payments, the record is marked `captured` only after verification succeeds.

### Indexes

- `orderId ASC`
- `providerPaymentId ASC`
- `status ASC, createdAt DESC`

---

## 14. `banners/{bannerId}`

**Doc ID:** auto-generated  
**Access:** Public read when `isActive == true` **and** within `startsAt`–`endsAt` window · Admin write

### Fields

- `placement` — `'home_hero' | 'home_secondary' | 'home_strip' | 'category_top' | 'checkout'` — required
- `headline` — `string` — required
- `subtitle` — `string | null` — optional
- `ctaLabel` — `string | null` — optional
- `ctaHref` — `string | null` — optional
- `image` — `ImageAsset` — required
- `mobileImage` — `ImageAsset | null` — optional
- `theme` — `{ textColor?, overlayOpacity?, alignment? } | null` — optional
- `order` — `number` — required
- `isActive` — `boolean` — required
- `startsAt` — `Timestamp | null` — required
- `endsAt` — `Timestamp | null` — required
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Indexes

- `placement ASC, isActive ASC, order ASC`
- `isActive ASC, startsAt ASC, endsAt ASC`

---

## 15. `homepageSections/{sectionId}`

**Doc ID:** auto-generated  
**Access:** Public read when `isActive == true` **and** within `startsAt`–`endsAt` window · Admin write

### Fields

- `type` — `'hero_carousel' | 'banner_strip' | 'product_carousel' | 'collection_grid' | 'category_grid' | 'rich_text'` — required
- `title` — `string | null` — optional
- `subtitle` — `string | null` — optional
- `layout` — `'grid' | 'carousel' | 'list'` — required
- `order` — `number` — required
- `isActive` — `boolean` — required
- `startsAt` — `Timestamp | null` — required
- `endsAt` — `Timestamp | null` — required
- `collectionIds` — `string[]` — required — reference list, max 20
- `categoryIds` — `string[]` — required — reference list, max 20
- `bannerIds` — `string[]` — required — reference list, max 20
- `productIds` — `string[]` — required — reference list, max 20
- `body` — `string | null` — required — sanitised HTML, `rich_text` only
- `createdAt` — `Timestamp` — required
- `updatedAt` — `Timestamp` — required

### Indexes

- `isActive ASC, order ASC`
- `type ASC, isActive ASC, order ASC`

---

## 16. `payments/{paymentId}/webhookEvents/{eventId}`

**Doc ID:** `${provider}:${eventId}` — duplicate webhooks from the same provider are structurally impossible  
**Access:** **Server-only**  
**Purpose:** Durable webhook deduplication + audit trail. Replaces the old capped `processedWebhookEventIds: string[]` array.

### Fields

- `paymentId` — `string` — required
- `provider` — `PaymentProviderId` — required
- `eventId` — `string` — required — provider-issued event ID
- `eventType` — `string` — required — e.g. `payment.captured`, `payment.failed`
- `payloadHash` — `string` — required — SHA-256 of raw payload; detects providers that reuse `eventId` with a different body
- `signatureVerified` — `boolean` — required
- `receivedAt` — `Timestamp` — required
- `processedAt` — `Timestamp | null` — required
- `outcome` — `'captured' | 'failed' | 'ignored' | 'duplicate'` — required
- `error` — `string | null` — required

### Why This Beats an Array Field

- Unlimited retention — no cap; duplicates never re-process.
- Atomic deduplication — a doc-ID collision inside a transaction catches replays.
- Cross-provider safe — the `provider:` prefix prevents collisions between Razorpay, Stripe, and Cashfree event IDs.
- Tamper detection — `payloadHash` catches resends with the same event ID but a different body.
- Auditable — every received event is queryable.

### Indexes

- `provider ASC, processedAt DESC`
- `eventType ASC, receivedAt DESC`

---

## 17. `idempotencyKeys/{key}`

**Doc ID:** the idempotency key itself (UUID or hash) — duplicates structurally impossible  
**Access:** **Server-only**  
**Purpose:** The actual mechanism that enforces uniqueness of `orders.idempotencyKey` and `payments.idempotencyKey`. A plain field does not enforce uniqueness in Firestore.

### Fields

- `scope` — `'order_create' | 'payment_create' | 'payment_webhook'` — required
- `entityType` — `'order' | 'payment'` — required
- `entityId` — `string | null` — required — populated inside the same transaction
- `requestHash` — `string | null` — optional — SHA-256 of request body; detects key reuse with different payload
- `createdAt` — `Timestamp` — required
- `expiresAt` — `Timestamp` — required — TTL field; Firestore TTL policy auto-deletes after 24h

### Indexes

- `scope ASC, createdAt DESC`
- `expiresAt ASC` — TTL

---

## Idempotency & Webhook Deduplication Strategy

### Creating an Order Idempotently

The `idempotencyKeys` collection is the actual reservation mechanism, not the order field.

```text
begin transaction
  keyRef  = idempotencyKeys/{clientKey}
  keySnap = tx.get(keyRef)

  if keySnap.exists:
    return existing order (via keySnap.entityId)
    → no duplicate created, no error thrown

  else:
    orderRef = orders/{auto}
    tx.set(orderRef, orderDoc)
    tx.set(keyRef, {
      scope: 'order_create',
      entityType: 'order',
      entityId: orderRef.id,
      requestHash: sha256(requestPayload),
      createdAt: serverTimestamp(),
      expiresAt: now + 24h,
    })
commit
```

- The key document is written inside the same transaction as the order — no gap where a concurrent retry could create a second order.
- Retries with the same key return the original order.
- Retries with the same key but a different `requestHash` return `409 Conflict`.
- TTL policy on `expiresAt` auto-deletes old reservations.

### Processing a Webhook Idempotently

```text
begin transaction
  paymentSnap = tx.get(payments/{paymentId})
  eventRef    = payments/{paymentId}/webhookEvents/{provider}:{eventId}
  eventSnap   = tx.get(eventRef)

  if eventSnap.exists:
    tx.set(eventRef, { outcome: 'duplicate', receivedAt: now }, { merge: true })
    return 200  → duplicate; do nothing else

  if !signatureVerified(payload, header, providerVerification):
    tx.set(eventRef, { signatureVerified: false, outcome: 'ignored', receivedAt: now })
    return 400  → reject

  if paymentSnap.amount !== payload.amount:
    tx.set(eventRef, { outcome: 'ignored', error: 'amount_mismatch', ... })
    return 400

  tx.set(eventRef, {
    provider, eventId, eventType,
    payloadHash: sha256(rawBody),
    signatureVerified: true,
    receivedAt: now,
    processedAt: now,
    outcome: 'captured',   // or 'failed'
  })

  tx.update(payments/{paymentId}, {
    status: 'captured',
    verification: { kind: 'razorpay_hmac', ..., verifiedAt: now },
    capturedAt: now,
  })

  tx.update(orders/{orderId}, { paymentStatus: 'paid' })
commit
```

- Every event is written inside the transaction that applies its effect — a crash cannot leave payment updated but event unrecorded.
- Replays hit the doc-ID collision inside the same transaction.
- Cross-provider events never collide.

### Why the Old `processedWebhookEventIds: string[]` Approach Failed

- 50-item cap — after 50 webhooks, oldest IDs are dropped; a re-delivery of a dropped event re-processes → double credit or double status transition.
- Array mutation in transactions — less efficient than a single doc read; large arrays inflate the payment doc size.
- No per-event metadata — can't record `payloadHash`, `eventType`, `receivedAt`; no tamper detection.
- No audit trail — can't query what events the provider sent for this payment.

---

## Embedded Value Types

Stored as JSON maps inside the parent document — not separate collections.

### `ImageAsset`

```ts
{
  storagePath: string;
  url: string;
  alt: string;
  width?: number;
  height?: number;
  blurDataUrl?: string;
}
```

### `OrderedImageAsset`

```ts
{ ...ImageAsset, order: number }
```

### `SeoMetadata`

```ts
{ title?: string; description?: string; keywords?: string[]; canonicalPath?: string; noIndex?: boolean }
```

### `ProductColorOption`

```ts
{ slug: string; name: string; hex?: string; order: number }
```

### `ProductSizeOption`

```ts
{
  value: string;
  label: string;
  system: "uk" | "us" | "eu" | "cm" | "universal";
  order: number;
}
```

### `AddressSnapshot`

```ts
{
  fullName: string; phoneNumber: string;
  line1: string; line2?: string; landmark?: string;
  city: string; state: string; postalCode: string; country: string;
  deliveryInstructions?: string;
  label: 'home'|'work'|'other';
  capturedAt: Timestamp;
}
```

### `ProviderVerification`

```ts
type ProviderVerification =
  | {
      kind: "razorpay_hmac";
      headerName: "x-razorpay-signature";
      algorithm: "sha256";
      verifiedAt: Timestamp;
    }
  | {
      kind: "stripe_v1";
      headerName: "stripe-signature";
      algorithm: "hmac_sha256";
      toleranceSeconds: number;
      verifiedAt: Timestamp;
    }
  | {
      kind: "cashfree_signature";
      headerName: "x-webhook-signature";
      algorithm: "sha256";
      verifiedAt: Timestamp;
    }
  | { kind: "cod_na"; verifiedAt: null };
```

### `BannerTheme`

```ts
{ textColor?: string; overlayOpacity?: number; alignment?: 'left'|'center'|'right' }
```

### `CollectionRule`

```ts
{ field: string; operator: '=='|'!='|'in'|'array-contains'|'>='|'<='; value: string|number|boolean|string[] }
```

---

## Design Decisions — Plain Summary

- **Money:** Always `Int` in paise. Never `Float`. Never strings. Write rejected if not integer or negative.
- **Timestamps:** `Timestamp` on write; `Timestamp | null` for optional lifecycle events.
- **Foreign keys:** Stored as `string` document IDs — never `DocumentReference`.
- **Snapshots:** Order `shippingAddress`, `billingAddress`, and `items` are frozen at placement.
- **Denormalisation:** Kept on `Product.{variantCount,minPrice,maxPrice,discountPercent}`, `Cart.{subtotal,itemCount}`, `User.stats`, and `Order.shipmentSummary`.
- **Embedded vs subcollection:** Order `items` embedded (bounded, immutable). Variants, cart items, shipments, webhookEvents are subcollections.
- **Deterministic IDs:** Cart item `${productId}__${variantId}` · Variant `${colorSlug}__${sizeValue}` · Wishlist item `${productId}` · Webhook event `${provider}:${eventId}` · Idempotency key `${key}`.
- **Idempotency:** Enforced via dedicated `idempotencyKeys/{key}` collection, written inside the same transaction that creates the entity. A plain field is not enough.
- **Webhook deduplication:** Enforced via `payments/{paymentId}/webhookEvents/{provider}:{eventId}` subcollection. Unlimited retention. Not a capped array.
- **Payment instruments:** `method` = coarse logic (`cod | online`); `instrument` = provider-reported granular method (`upi | card | netbanking | wallet | emi | paylater | cod`).
- **Provider verification:** Discriminated union `ProviderVerification` — Razorpay, Stripe, Cashfree, and COD each have different semantics. No uniform `signatureVerifiedAt` scalar.
- **No inventory:** No `stock` field anywhere. Availability enforced by `product.status` and `variant.isActive`.
- **Secrets:** No card numbers, CVVs, UPI VPAs, API keys, or service account keys in any collection. Ever.
- **Authorization:** Firestore Rules + verified custom claim `admin === true`. Never the `users.role` field.

---

## Seeded Data

- `categories` — 6
- `collections` — 2
- `products` — 2
- `products/*/variants` — 18
- `banners` — 1
- `homepageSections` — 3
- `users`, `carts`, `orders`, `payments`, `idempotencyKeys` — 0 (populated at runtime)
