sherasportswear/
├── app/ ← Next.js App Router ONLY
│ ├── layout.tsx · page.tsx · error.tsx · loading.tsx · not-found.tsx · globals.css · favicon.ico
│ ├── middleware.ts
│ │
│ ├── (storefront)/
│ │ ├── layout.tsx · page.tsx
│ │ ├── products/ ( page.tsx · [slug]/{page,loading,not-found}.tsx )
│ │ ├── categories/[slug]/page.tsx
│ │ ├── collections/[slug]/page.tsx
│ │ ├── search/page.tsx
│ │ ├── cart/page.tsx
│ │ ├── wishlist/page.tsx
│ │ ├── checkout/ ( page.tsx · success/[orderNumber]/page.tsx )
│ │ ├── orders/ ( page.tsx · [orderNumber]/page.tsx )
│ │ ├── account/ ( layout.tsx · page.tsx · addresses/{page.tsx,new/page.tsx} )
│ │ ├── login/page.tsx
│ │ └── register/page.tsx
│ │
│ ├── admin/
│ │ ├── layout.tsx · page.tsx
│ │ ├── products/ ( page.tsx · new/page.tsx · [id]/{edit,variants}/page.tsx )
│ │ ├── categories/ ( page.tsx · new/page.tsx · [id]/edit/page.tsx )
│ │ ├── collections/ ( page.tsx · new/page.tsx · [id]/edit/page.tsx )
│ │ ├── orders/ ( page.tsx · [id]/{page,shipment/page}.tsx )
│ │ ├── customers/ ( page.tsx · [uid]/page.tsx )
│ │ ├── payments/ ( page.tsx · [id]/page.tsx )
│ │ ├── banners/ ( page.tsx · new/page.tsx · [id]/edit/page.tsx )
│ │ └── homepage-sections/ ( page.tsx · new/page.tsx · [id]/edit/page.tsx )
│ │
│ └── api/
│ ├── auth/ ( session/route.ts · logout/route.ts )
│ ├── guest-cart/route.ts
│ ├── products/ ( route.ts · [slug]/route.ts )
│ ├── categories/ ( route.ts · [slug]/route.ts )
│ ├── cart/ ( route.ts · items/route.ts · items/[itemId]/route.ts · merge/route.ts )
│ ├── checkout/route.ts
│ ├── orders/ ( route.ts · [orderId]/route.ts )
│ └── payments/ ( initiate/route.ts · webhook/[provider]/route.ts )
│
├── modules/ ← 14 files, was ~44
│ ├── auth.ts ← service + repo + schema + types
│ ├── catalog/
│ │ ├── products.ts ← ProductDocument · Zod schemas · repo · service
│ │ ├── categories.ts
│ │ └── collections.ts
│ ├── cart.ts
│ ├── wishlist.ts
│ ├── customers/
│ │ ├── customer.ts
│ │ └── addresses.ts
│ ├── checkout.ts ← imports cart.ts + orders.ts
│ ├── orders.ts ← imports products.ts (reprice), shipping.ts
│ ├── payments.ts
│ ├── shipping.ts
│ └── cms/
│ ├── banners.ts
│ └── homepage-sections.ts
│
├── shared/ ← cross-cutting, no business rules
│ ├── auth/
│ │ ├── session.ts ← getSessionUser · requireUser · requireAdmin
│ │ ├── claims.ts ← setAdminClaim (Admin SDK only)
│ │ └── guards.ts ← assertOwnership · assertGuestCart
│ ├── validation/
│ │ ├── common.schemas.ts ← paiseSchema · slugSchema · skuSchema · mobileSchema · pinSchema
│ │ └── zod-helpers.ts ← parseOrThrow · formatZodError
│ ├── errors/
│ │ ├── app-error.ts ← AppError
│ │ ├── action-result.ts ← ActionResult<T> · ok() · err()
│ │ └── normalize.ts ← normalizeError
│ ├── http/
│ │ ├── response.ts ← jsonOk · jsonError
│ │ └── cursor.ts ← encodeCursor · decodeCursor
│ └── utils/
│ ├── money.ts ← paise helpers · formatINR · computeDiscountPercent
│ ├── slug.ts ← slugify
│ ├── date.ts ← toIso · isWithinWindow
│ └── logger.ts ← server-side structured logging
│
├── infrastructure/ ← external SDK wrappers
│ ├── firebase/
│ │ ├── client.ts (exists)
│ │ ├── admin.ts (exists)
│ │ └── storage.ts ← uploadImage · deleteImage (Admin SDK)
│ └── payments/
│ ├── provider.interface.ts ← PaymentProvider contract
│ └── razorpay.provider.ts ← env-gated implementation
│
├── types/ ← primitives + enums only
│ ├── common.ts ← Paise · CurrencyCode · FirestoreId · ImageAsset · SeoMetadata
│ └── enums.ts ← ProductStatus · OrderStatus · PaymentStatus · ShipmentStatus · …
│
├── scripts/
│ ├── seed.ts (exists)
│ └── grant-admin.ts
│
├── firestore.rules · firestore.indexes.json · storage.rules · firebase.json
├── next.config.ts · tsconfig.json · package.json
└── .env.example · .env.local (gitignored)
