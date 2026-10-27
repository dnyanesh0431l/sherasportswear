# Shera Sports Wear — Firestore Collections & Fields Inventory

> Status: DRAFT / AUDIT REFERENCE  
> Source: Website development instructions only.  
> Important: The complete Firestore schema was not provided in the instruction file.
> Field names below are the fields required by the instructions and typical implementation needs.
> Confirm every field name, type, required/optional status, and default against the actual schema before implementation.

## Global Rules

- Money: integer paise only. Never floating-point currency.
- Timestamps: written server-side.
- Entity IDs: Firestore document IDs.
- Foreign keys: string document IDs.
- Order item, shipping address, and billing address must be stored as immutable snapshots on order creation.
- Cart prices/snapshots are untrusted and must be recalculated server-side.
- Admin authorization: verified Firebase custom claim `admin === true`. Never trust `users.role` alone.
- Do not add inventory, stock, reviews, ratings, coupons, refunds, or returns unless approved.
- Keep arrays bounded and documents size-validated.
- Use transactions/batched writes where atomic consistency is required.
- Webhook payloads, payment records, and private customer data must not be exposed publicly.

---

## 1. `users/{uid}`

Purpose: Customer/admin profile and account metadata.

Fields:

- `uid`: string — document ID, Firebase Auth UID
- `displayName`: string
- `email`: string
- `phone`: string | null
- `photoURL`: string | null
- `marketingOptIn`: boolean — only with proper consent
- `defaultAddressId`: string | null
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Notes:

- Do not use `role` as proof of admin access.
- Admin access must use Firebase custom claim `admin === true`.

---

## 2. `users/{uid}/addresses/{addressId}`

Purpose: Saved customer addresses.

Fields:

- `addressId`: string — document ID
- `fullName`: string
- `phone`: string
- `line1`: string
- `line2`: string | null
- `city`: string
- `state`: string
- `postalCode`: string — PIN code format validated
- `country`: string
- `label`: string | null — e.g. Home, Work
- `isDefault`: boolean
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Ownership:

- Must belong to `users/{uid}`.
- Customers may only read/write their own addresses.

---

## 3. `users/{uid}/wishlist/{uid}`

Purpose: Wishlist container for a user.

Fields:

- `uid`: string — document ID, must match parent user UID
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Notes:

- The path is unusual: `users/{uid}/wishlist/{uid}`. Confirm this against the actual schema.

---

## 4. `users/{uid}/wishlist/{uid}/items/{productId}`

Purpose: Wishlist items.

Fields:

- `productId`: string — document ID
- `variantId`: string | null — if variant-specific wishlist is supported
- `addedAt`: timestamp — server-side

Ownership:

- Must belong to the parent user.
- Customers may only access their own wishlist.

---

## 5. `carts/{cartId}`

Purpose: Cart container for authenticated users or guests.

Fields:

- `cartId`: string — document ID
- `ownerUid`: string | null — authenticated user UID
- `guestId`: string | null — guest cart identifier
- `status`: string — e.g. active, converted, abandoned, expired
- `currency`: string — e.g. INR
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side
- `expiresAt`: timestamp | null — guest cart expiry if supported

Rules:

- Guest carts must be safely reconciled when a guest signs in.
- Cart prices are untrusted and must be revalidated at checkout.

---

## 6. `carts/{cartId}/items/{itemId}`

Purpose: Cart line items.

Fields:

- `itemId`: string — document ID
- `productId`: string
- `variantId`: string | null
- `quantity`: number — integer, bounded
- `addedAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Notes:

- Do not trust client-submitted prices.
- Product/variant validity and final pricing must be recalculated server-side.

---

## 7. `products/{productId}`

Purpose: Product catalog record.

Fields:

- `productId`: string — document ID
- `name`: string
- `slug`: string — unique, server-enforced
- `description`: string
- `shortDescription`: string | null
- `brand`: string — e.g. Shera Sports Wear
- `categoryId`: string
- `collectionIds`: string[] — bounded
- `productType`: string
- `attributes`: map — bounded supported attributes
- `images`: string[] — Firebase Storage URLs/paths, bounded
- `status`: string — e.g. draft, active, archived
- `basePricePaise`: number — integer paise
- `mrpPaise`: number — integer paise
- `seoTitle`: string | null
- `seoDescription`: string | null
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Rules:

- Only active products/variants are purchasable.
- Archived/unavailable products handled appropriately in SEO and storefront.

---

## 8. `products/{productId}/variants/{variantId}`

Purpose: Variant-specific SKU, size, color, and pricing.

Fields:

- `variantId`: string — document ID
- `sku`: string — unique, server-enforced
- `size`: string | null
- `color`: string | null
- `pricePaise`: number — integer paise
- `mrpPaise`: number — integer paise
- `status`: string — e.g. active, inactive, archived
- `attributes`: map — variant-specific attributes
- `images`: string[] — optional variant images, bounded
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Rules:

- Only valid active variants may be purchased.
- Variant-specific SKU and pricing supported where schema allows.

---

## 9. `categories/{categoryId}`

Purpose: Product categories.

Fields:

- `categoryId`: string — document ID
- `name`: string
- `slug`: string — unique, server-enforced
- `description`: string | null
- `image`: string | null
- `parentId`: string | null — if hierarchical categories are supported
- `sortOrder`: number
- `status`: string — e.g. active, hidden
- `seoTitle`: string | null
- `seoDescription`: string | null
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

---

## 10. `collections/{collectionId}`

Purpose: Curated product collections.

Fields:

- `collectionId`: string — document ID
- `name`: string
- `slug`: string — unique, server-enforced
- `description`: string | null
- `image`: string | null
- `productIds`: string[] — bounded, if manual curation is used
- `sortOrder`: number
- `status`: string — e.g. active, hidden
- `seoTitle`: string | null
- `seoDescription`: string | null
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Notes:

- Confirm whether collections use `productIds`, a join collection, or query-based rules.
- Do not invent a different relationship model without approval.

---

## 11. `orders/{orderId}`

Purpose: Immutable order record and snapshots.

Fields:

- `orderId`: string — document ID
- `orderNumber`: string — unique, server-enforced
- `userId`: string | null — authenticated customer UID; null for guest checkout if supported
- `email`: string
- `phone`: string
- `status`: string — order lifecycle state
- `paymentStatus`: string — distinct from fulfillment status
- `fulfillmentStatus`: string
- `currency`: string — e.g. INR
- `items`: array — immutable order item snapshots, bounded
- `shippingAddress`: map — immutable snapshot
- `billingAddress`: map — immutable snapshot
- `subtotalPaise`: number — integer paise
- `discountPaise`: number — integer paise
- `shippingPaise`: number — integer paise
- `taxPaise`: number — integer paise
- `totalPaise`: number — integer paise
- `paymentId`: string | null
- `idempotencyKey`: string | null
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Order item snapshot fields should include at minimum:

- `productId`
- `variantId`
- `sku`
- `name`
- `variantLabel` / `size` / `color`
- `quantity`
- `unitPricePaise`
- `mrpPaise`
- `lineTotalPaise`
- `imageUrl`

Rules:

- Recalculate all prices, discounts, shipping, taxes, and totals on the trusted server.
- Never trust client-calculated totals.
- Prevent duplicate order creation with transactional idempotency.

---

## 12. `orders/{orderId}/shipments/{shipmentId}`

Purpose: Shipment and tracking records.

Fields:

- `shipmentId`: string — document ID
- `orderId`: string
- `carrier`: string
- `trackingNumber`: string
- `trackingUrl`: string | null — validate URL safety
- `status`: string — shipment lifecycle state
- `shippedAt`: timestamp | null
- `deliveredAt`: timestamp | null
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Ownership:

- Customers may only access shipments for their own orders.
- Admin mutations require verified admin claim.

---

## 13. `payments/{paymentId}`

Purpose: Payment records.

Fields:

- `paymentId`: string — document ID
- `orderId`: string
- `userId`: string | null
- `provider`: string — e.g. razorpay, stripe, cashfree, cod
- `providerPaymentId`: string | null
- `amountPaise`: number — integer paise
- `currency`: string
- `status`: string — e.g. pending, authorized, captured, failed, cancelled
- `method`: string | null
- `capturedAt`: timestamp | null
- `failureReason`: string | null
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Rules:

- Never store card numbers, CVVs, UPI VPAs, API secrets, or private keys.
- Never mark online payment captured based only on client redirect/success screen.
- Keep COD state distinct from captured online payment.

---

## 14. `payments/{paymentId}/webhookEvents/{eventId}`

Purpose: Webhook audit and idempotency records.

Fields:

- `eventId`: string — document ID
- `provider`: string
- `providerEventId`: string
- `eventType`: string
- `payload`: map — private audit payload; never public
- `status`: string — e.g. received, processed, failed, ignored
- `processedAt`: timestamp | null
- `createdAt`: timestamp — server-side

Rules:

- Verify provider signatures.
- Verify raw webhook request bodies where required.
- Process transactionally and idempotently.
- Persist audit records.
- Do not expose webhook payloads publicly.

---

## 15. `idempotencyKeys/{key}`

Purpose: Prevent duplicate order/payment creation.

Fields:

- `key`: string — document ID
- `userId`: string | null
- `operation`: string — e.g. createOrder, createPayment
- `requestHash`: string
- `orderId`: string | null
- `paymentId`: string | null
- `status`: string — e.g. in_progress, completed, failed
- `createdAt`: timestamp — server-side
- `expiresAt`: timestamp | null

Rules:

- Use atomic server-side strategy.
- Do not rely on client-supplied idempotency alone.

---

## 16. `banners/{bannerId}`

Purpose: Promotional banners.

Fields:

- `bannerId`: string — document ID
- `title`: string
- `subtitle`: string | null
- `imageUrl`: string — Firebase Storage
- `ctaLabel`: string | null
- `ctaUrl`: string | null — validate and reject unsafe schemes
- `placement`: string — e.g. home_hero, home_strip
- `sortOrder`: number
- `isActive`: boolean
- `startsAt`: timestamp | null
- `endsAt`: timestamp | null
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Rules:

- Validate CTA URLs and reject unsafe schemes.
- Sanitize rich-text content if any.

---

## 17. `homepageSections/{sectionId}`

Purpose: Dynamic homepage content.

Fields:

- `sectionId`: string — document ID
- `type`: string — e.g. featured_products, bestsellers, category_grid, collection, promo_strip, brand_story
- `title`: string | null
- `subtitle`: string | null
- `sortOrder`: number
- `isActive`: boolean
- `config`: map — bounded, section-specific configuration
- `productIds`: string[] — optional, bounded
- `categoryIds`: string[] — optional, bounded
- `collectionIds`: string[] — optional, bounded
- `createdAt`: timestamp — server-side
- `updatedAt`: timestamp — server-side

Rules:

- Use Firestore banners and homepageSections for dynamic homepage content.
- Keep arrays bounded.
- Validate all untrusted input server-side.

---

## Confirmed Collection Paths From Instructions

1. `users/{uid}`
2. `users/{uid}/addresses/{addressId}`
3. `users/{uid}/wishlist/{uid}`
4. `users/{uid}/wishlist/{uid}/items/{productId}`
5. `carts/{cartId}`
6. `carts/{cartId}/items/{itemId}`
7. `products/{productId}`
8. `products/{productId}/variants/{variantId}`
9. `categories/{categoryId}`
10. `collections/{collectionId}`
11. `orders/{orderId}`
12. `orders/{orderId}/shipments/{shipmentId}`
13. `payments/{paymentId}`
14. `payments/{paymentId}/webhookEvents/{eventId}`
15. `idempotencyKeys/{key}`
16. `banners/{bannerId}`
17. `homepageSections/{sectionId}`

---

## Fields Still Needing Schema Confirmation

The following must be confirmed before implementation:

- Exact field names and types for every collection.
- Required vs optional fields.
- Default values.
- Enum values for statuses.
- Whether guest checkout is supported and how guest carts/orders are linked.
- Whether collections reference products by `productIds`, join documents, or queries.
- Whether wishlist items are product-level or variant-level.
- Exact order item snapshot shape.
- Exact address snapshot shape.
- Exact payment provider enum and status transitions.
- Exact homepage section `type` values and `config` shape.
- Firestore security rules for each path.
- Required composite indexes for actual queries.
