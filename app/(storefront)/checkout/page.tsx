// app/(storefront)/checkout/page.tsx
"use client";

import { auth, db } from "@/lib/firebase/client";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Check,
  ChevronDown,
  CreditCard,
  Loader2,
  Lock,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useCart } from "../../context/cart-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CartItem = {
  id: string;
  name: string;
  slug: string;
  price: number;
  mrp: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
};

type AddressFields = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  label: string;
};

type SavedAddress = AddressFields & { id: string; isDefault: boolean };

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------
const FREE_SHIPPING_PAISE = 99900;
const SHIPPING_FEE_PAISE = 4900;
const TAX_RATE = 0.05;

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

const ADDRESS_LABELS = ["Home", "Work", "Other"] as const;

const EMPTY_ADDRESS: AddressFields = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  label: "Home",
};

const ADDRESS_ERROR_KEYS = [
  "address",
  "fullName",
  "addrPhone",
  "line1",
  "city",
  "state",
  "postalCode",
];

const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

// Same color-dot helper as the cart page
const COLOR_MAP: Record<string, string> = {
  black: "#111111",
  white: "#f7f7f7",
  orange: "#ff5a1f",
  charcoal: "#3a3a3a",
  navy: "#1e2a44",
  grey: "#9aa0a6",
  gray: "#9aa0a6",
  teal: "#0f766e",
};
function colorHex(name: string): string {
  const key = name.trim().toLowerCase();
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  if (key.startsWith("#")) return name.trim();
  return "#d4d4d4";
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function isIndianMobile(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d);
}

const isPin = (v: string) => /^[1-9]\d{5}$/.test(v.trim());

function generateOrderNumber(): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).toUpperCase().slice(2, 8);
  return `SHE-${yy}${mm}${dd}${rand}`;
}

// ---------------------------------------------------------------------------
// Styles — flat fills only: no borders, no rings, no shadows (same as cart)
// ---------------------------------------------------------------------------
const fieldBase =
  "block h-11 w-full rounded px-3.5 text-base text-neutral-950 outline-none transition-colors placeholder:text-neutral-500 sm:text-sm";
const fieldOk = "bg-neutral-100 hover:bg-neutral-200/70 focus:bg-neutral-200";
const fieldBad = "bg-red-50 focus:bg-red-100";
const fieldReadOnly = "cursor-not-allowed bg-neutral-50 text-neutral-500";

const focusCls =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5a1f]";

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------
function FieldLabel({
  htmlFor,
  label,
  optional,
}: {
  htmlFor: string;
  label: string;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-baseline justify-between text-[11px] font-bold uppercase tracking-wide text-neutral-500"
    >
      {label}
      {optional && (
        <span className="text-[10px] font-medium normal-case tracking-normal text-neutral-400">
          Optional
        </span>
      )}
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-1 text-[11px] font-medium text-red-600"
    >
      <AlertCircle className="mt-px h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  error?: string | null;
  optional?: boolean;
  hint?: string;
  className?: string;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "autoComplete" | "placeholder" | "maxLength" | "readOnly"
>;

function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  optional,
  hint,
  className,
  readOnly,
  ...rest
}: TextFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} optional={optional} />
      <input
        id={id}
        name={id}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          fieldBase,
          readOnly ? fieldReadOnly : error ? fieldBad : fieldOk,
        )}
        {...rest}
      />
      {error ? (
        <FieldError id={`${id}-error`} message={error} />
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[11px] text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  options,
  placeholder,
  autoComplete,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string | null;
  options: string[];
  placeholder: string;
  autoComplete?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} />
      <div className="relative">
        <select
          id={id}
          name={id}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cx(
            fieldBase,
            "appearance-none pr-10",
            !value && "text-neutral-500",
            error ? fieldBad : fieldOk,
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o} className="text-neutral-950">
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function SectionCard({
  step,
  title,
  done,
  children,
}: {
  step: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span
          className={cx(
            "grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] font-bold transition-colors",
            done
              ? "bg-neutral-950 text-white"
              : "bg-neutral-100 text-neutral-500",
          )}
          aria-hidden
        >
          {done ? <Check className="h-3 w-3" strokeWidth={3} /> : step}
        </span>
        <h2 className="text-sm font-black uppercase tracking-wide text-neutral-900">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Order summary (item rows + totals, styled like the cart)
// ---------------------------------------------------------------------------
function OrderSummary({
  items,
  subtotalPaise,
  savingsPaise,
  shippingPaise,
  taxPaise,
  totalPaise,
}: {
  items: CartItem[];
  subtotalPaise: number;
  savingsPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
}) {
  const remaining = Math.max(FREE_SHIPPING_PAISE - subtotalPaise, 0);
  const progress = Math.min((subtotalPaise / FREE_SHIPPING_PAISE) * 100, 100);

  return (
    <div>
      <ul className="max-h-[340px] space-y-4 overflow-y-auto pr-1">
        {items.map((item, i) => (
          <li
            key={`${item.id}-${item.size}-${item.color}-${i}`}
            className="flex items-start pt-2 gap-3.5"
          >
            {/* Image — always square */}
            <div className="relative aspect-square h-16 w-16 shrink-0">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt={item.name}
                  className="aspect-square h-full w-full rounded bg-[#f5f5f5] object-cover"
                />
              ) : (
                <div className="grid aspect-square h-full w-full place-items-center rounded bg-[#f5f5f5]">
                  <Package className="h-5 w-5 text-neutral-400" />
                </div>
              )}
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-neutral-950 px-1 text-[10px] font-bold text-white">
                {item.quantity}
              </span>
            </div>

            <div className="min-w-0 flex-1 py-0.5">
              <p className="line-clamp-2 text-sm font-bold leading-snug text-neutral-900">
                {item.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                <p>
                  Size:{" "}
                  <span className="font-bold uppercase text-neutral-900">
                    {item.size}
                  </span>
                </p>
                <div className="flex items-center gap-1.5">
                  Color:
                  <span
                    className="h-3 w-3 rounded-full border border-neutral-200"
                    style={{ backgroundColor: colorHex(item.color) }}
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 py-0.5 text-right">
              <p className="text-sm font-black tabular-nums text-neutral-950">
                {formatINR(item.price * item.quantity)}
              </p>
              {item.mrp > item.price && (
                <p className="mt-0.5 text-[11px] tabular-nums text-neutral-400 line-through">
                  {formatINR(item.mrp * item.quantity)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Free shipping progress */}
      <div className="mt-5 rounded bg-neutral-50 px-3 py-2.5">
        <p className="text-[11px] font-medium text-neutral-700">
          {remaining > 0 ? (
            <>
              Add{" "}
              <span className="font-bold text-neutral-950">
                {formatINR(remaining)}
              </span>{" "}
              more to get free shipping
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-bold text-[#22c55e]">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              You&apos;ve unlocked free shipping
            </span>
          )}
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-sm bg-neutral-200">
          <div
            className={cx(
              "h-full rounded-sm transition-[width] duration-500",
              remaining > 0 ? "bg-[#ff5a1f]" : "bg-[#22c55e]",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Totals — same rows as the cart */}
      <div className="mt-5 space-y-2 border-t border-neutral-100 pt-4 text-xs sm:text-sm">
        <div className="flex justify-between text-neutral-600">
          <span>Subtotal (MRP)</span>
          <span className="font-semibold tabular-nums text-neutral-900">
            {formatINR(subtotalPaise + savingsPaise)}
          </span>
        </div>
        {savingsPaise > 0 && (
          <div className="flex justify-between font-medium text-[#22c55e]">
            <span>Discount</span>
            <span className="tabular-nums">-{formatINR(savingsPaise)}</span>
          </div>
        )}
        <div className="flex justify-between text-neutral-600">
          <span>Shipping</span>
          {shippingPaise === 0 ? (
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#22c55e]">
              Free
            </span>
          ) : (
            <span className="font-semibold tabular-nums text-neutral-900">
              {formatINR(shippingPaise)}
            </span>
          )}
        </div>
        <div className="flex justify-between text-neutral-600">
          <span>Tax (5%)</span>
          <span className="font-semibold tabular-nums text-neutral-900">
            {formatINR(taxPaise)}
          </span>
        </div>
        <div className="mt-1 flex items-end justify-between border-t border-neutral-100 pt-3">
          <span className="text-sm font-bold text-neutral-900">Total</span>
          <span className="text-xl font-black tabular-nums text-neutral-950 sm:text-2xl">
            {formatINR(totalPaise)}
          </span>
        </div>
      </div>
    </div>
  );
}

function PlaceOrderButton({
  submitting,
  label,
  className,
}: {
  submitting: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      form="checkout-form"
      disabled={submitting}
      className={cx(
        "flex items-center justify-center gap-2 rounded bg-neutral-950 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-neutral-950",
        focusCls,
        className,
      )}
    >
      {submitting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing…
        </>
      ) : (
        <>
          <Lock className="h-4 w-4" />
          {label}
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Full-screen states (empty-cart state mirrors the cart page)
// ---------------------------------------------------------------------------
function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center bg-white px-4 text-center">
      {children}
    </div>
  );
}

const primaryLinkCls = cx(
  "mt-6 inline-flex items-center gap-2 rounded-md bg-neutral-950 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff5a1f]",
  focusCls,
);

// ---------------------------------------------------------------------------
// Checkout body
// ---------------------------------------------------------------------------
function CheckoutBody() {
  const router = useRouter();
  const { items, clearCart } = useCart() as {
    items: CartItem[];
    clearCart: () => void;
  };

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressMode, setAddressMode] = useState<"saved" | "new">("new");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [newAddress, setNewAddress] = useState<AddressFields>({
    ...EMPTY_ADDRESS,
  });
  const [saveAddress, setSaveAddress] = useState(true);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const submittingRef = useRef(false);

  const touch = (key: string) =>
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  const patchAddress = (patch: Partial<AddressFields>) =>
    setNewAddress((a) => ({ ...a, ...patch }));

  // ----- Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        router.replace("/login?next=/checkout");
        return;
      }
      setEmail((prev) => prev || (u.email ?? ""));
    });
    return () => unsub();
  }, [router]);

  // ----- Load saved addresses
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDocs(
          collection(db, "users", user.uid, "addresses"),
        );
        const list: SavedAddress[] = snap.docs.map((d) => {
          const a = d.data();
          return {
            id: d.id,
            fullName: a.fullName || "",
            phone: a.phone || "",
            line1: a.line1 || "",
            line2: a.line2 || "",
            city: a.city || "",
            state: a.state || "",
            postalCode: a.postalCode || "",
            country: a.country || "India",
            label: a.label || "",
            isDefault: !!a.isDefault,
          };
        });
        list.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
        setSavedAddresses(list);
        if (list.length > 0) {
          setAddressMode("saved");
          setSelectedAddressId(list[0].id);
          setSaveAddress(false);
          setPhone((p) => p || list[0].phone);
        }
      } catch {
        // Fall back to the new-address form
      } finally {
        setLoadingAddresses(false);
      }
    })();
  }, [user]);

  // ----- Totals (all in paise)
  const subtotalPaise = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const savingsPaise = items.reduce(
    (s, it) => s + Math.max((it.mrp || 0) - it.price, 0) * it.quantity,
    0,
  );
  const discountPaise = 0;
  const shippingPaise =
    subtotalPaise >= FREE_SHIPPING_PAISE ? 0 : SHIPPING_FEE_PAISE;
  const taxPaise = Math.round((subtotalPaise - discountPaise) * TAX_RATE);
  const totalPaise = subtotalPaise - discountPaise + shippingPaise + taxPaise;

  // ----- Effective shipping address
  const usingSaved = addressMode === "saved" && savedAddresses.length > 0;
  const selectedSaved = savedAddresses.find((x) => x.id === selectedAddressId);

  const effectiveAddress: AddressFields | null = usingSaved
    ? selectedSaved
      ? {
          fullName: selectedSaved.fullName,
          phone: selectedSaved.phone || phone.trim(),
          line1: selectedSaved.line1,
          line2: selectedSaved.line2,
          city: selectedSaved.city,
          state: selectedSaved.state,
          postalCode: selectedSaved.postalCode,
          country: selectedSaved.country,
          label: selectedSaved.label,
        }
      : null
    : {
        fullName: newAddress.fullName.trim(),
        phone: newAddress.phone.trim() || phone.trim(),
        line1: newAddress.line1.trim(),
        line2: newAddress.line2.trim(),
        city: newAddress.city.trim(),
        state: newAddress.state.trim(),
        postalCode: newAddress.postalCode.trim(),
        country: newAddress.country.trim(),
        label: newAddress.label.trim(),
      };

  // ----- Validation
  const errors: Record<string, string> = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!isEmail(email)) errors.email = "Enter a valid email address.";

  if (!phone.trim()) errors.phone = "Enter your phone number.";
  else if (!isIndianMobile(phone))
    errors.phone = "Enter a valid 10-digit mobile number.";

  if (usingSaved) {
    const a = effectiveAddress;
    if (!a) errors.address = "Choose a delivery address.";
    else if (
      !a.fullName ||
      !a.line1 ||
      !a.city ||
      !a.state ||
      !isPin(a.postalCode)
    )
      errors.address =
        "This saved address is incomplete. Choose another or add a new one.";
  } else {
    if (!newAddress.fullName.trim())
      errors.fullName = "Enter the recipient's name.";
    if (newAddress.phone.trim() && !isIndianMobile(newAddress.phone))
      errors.addrPhone = "Enter a valid 10-digit mobile number.";
    if (!newAddress.line1.trim()) errors.line1 = "Enter the street address.";
    if (!newAddress.city.trim()) errors.city = "Enter the city.";
    if (!newAddress.state.trim()) errors.state = "Select the state.";
    if (!newAddress.postalCode.trim())
      errors.postalCode = "Enter the PIN code.";
    else if (!isPin(newAddress.postalCode))
      errors.postalCode = "PIN code must be 6 digits.";
  }

  const err = (key: string) =>
    touched[key] || showErrors ? (errors[key] ?? null) : null;

  const contactDone = !errors.email && !errors.phone;
  const addressDone = !ADDRESS_ERROR_KEYS.some((k) => errors[k]);

  // ----- Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || submittingRef.current) return;

    if (Object.keys(errors).length > 0 || !effectiveAddress) {
      setShowErrors(true);
      toast.error("Please fix the highlighted fields.");
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(
          '[aria-invalid="true"], [data-section-error]',
        );
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus?.({ preventScroll: true });
      });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const orderNumber = generateOrderNumber();
      const orderId = orderNumber;
      const paymentId = `pay_${orderId}`;

      const orderItems = items.map((item) => {
        const variantId = `${item.size}-${item.color}`
          .toLowerCase()
          .replace(/\s+/g, "-");
        const sku = `SHERA-${item.id}-${item.size}-${item.color}`
          .toUpperCase()
          .replace(/\s+/g, "");
        return {
          productId: item.id,
          variantId,
          sku,
          name: item.name,
          variantLabel: `${item.size} / ${item.color}`,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          unitPricePaise: item.price,
          mrpPaise: item.mrp,
          lineTotalPaise: item.price * item.quantity,
          imageUrl: item.image,
        };
      });

      // Order + payment are written atomically: both succeed or neither does.
      const batch = writeBatch(db);
      batch.set(doc(db, "orders", orderId), {
        orderId,
        orderNumber,
        userId: user.uid,
        email: email.trim(),
        phone: phone.trim(),
        status: "confirmed",
        paymentStatus: "pending",
        fulfillmentStatus: "unfulfilled",
        currency: "INR",
        items: orderItems,
        shippingAddress: effectiveAddress,
        billingAddress: effectiveAddress,
        subtotalPaise,
        discountPaise,
        shippingPaise,
        taxPaise,
        totalPaise,
        paymentId,
        idempotencyKey: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, "payments", paymentId), {
        paymentId,
        orderId,
        userId: user.uid,
        provider: "cod",
        providerPaymentId: null,
        amountPaise: totalPaise,
        currency: "INR",
        status: "pending",
        method: "cod",
        capturedAt: null,
        failureReason: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      // Optional: remember the address. Never blocks the order.
      if (!usingSaved && saveAddress) {
        try {
          await addDoc(collection(db, "users", user.uid, "addresses"), {
            ...effectiveAddress,
            isDefault: savedAddresses.length === 0,
            createdAt: serverTimestamp(),
          });
        } catch {
          // ignore
        }
      }

      setPlaced(true);
      clearCart();
      toast.success("Order placed successfully");
      router.replace(`/account/orders/${orderId}`);
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error(
        (error as Error)?.message || "We couldn't place your order. Try again.",
      );
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // ----- Screens
  if (placed) {
    return (
      <CenteredState>
        <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-neutral-50">
          <Check className="h-9 w-9 text-[#22c55e]" strokeWidth={3} />
        </div>
        <h1 className="font-display text-2xl font-black uppercase italic tracking-tight text-neutral-900 md:text-3xl">
          Order placed
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          Taking you to your order…
        </p>
      </CenteredState>
    );
  }

  if (authLoading) {
    return (
      <CenteredState>
        <Loader2 className="h-6 w-6 animate-spin text-[#ff5a1f]" />
      </CenteredState>
    );
  }

  if (!user) {
    return (
      <CenteredState>
        <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-neutral-50">
          <Lock className="h-9 w-9 text-neutral-400" />
        </div>
        <h1 className="font-display text-2xl font-black uppercase italic tracking-tight text-neutral-900 md:text-3xl">
          Sign in to continue
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          Sign in to place your order.
        </p>
        <Link href="/login?next=/checkout" className={primaryLinkCls}>
          Sign in
        </Link>
      </CenteredState>
    );
  }

  if (loadingAddresses) {
    return (
      <CenteredState>
        <Loader2 className="h-6 w-6 animate-spin text-[#ff5a1f]" />
      </CenteredState>
    );
  }

  if (items.length === 0) {
    return (
      <CenteredState>
        <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-neutral-50">
          <ShoppingBag className="h-9 w-9 text-neutral-400" />
        </div>
        <h1 className="font-display text-2xl font-black uppercase italic tracking-tight text-neutral-900 md:text-3xl">
          Your cart is empty
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          Add something to your cart, then come back to check out.
        </p>
        <Link href="/products" className={primaryLinkCls}>
          Shop now
        </Link>
      </CenteredState>
    );
  }

  const summaryProps = {
    items,
    subtotalPaise,
    savingsPaise,
    shippingPaise,
    taxPaise,
    totalPaise,
  };

  return (
    <div className="min-h-screen bg-[#fafafa] pb-28 pt-6 md:pt-8 lg:pb-12">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Header (same as cart) */}
        <div className="mb-5 flex items-end justify-between border-b border-neutral-200 pb-3">
          <h1 className="font-display text-xl font-black uppercase italic tracking-tight text-neutral-900 md:text-2xl">
            Checkout
          </h1>
          <Link
            href="/cart"
            className={cx(
              "hidden items-center gap-1 text-xs font-bold text-neutral-900 transition-colors hover:text-[#ff5a1f] sm:inline-flex",
              focusCls,
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Cart
          </Link>
        </div>

        {/* Mobile collapsible summary */}
        <div className="mb-4 rounded-xl bg-white lg:hidden">
          <button
            type="button"
            onClick={() => setSummaryOpen((o) => !o)}
            aria-expanded={summaryOpen}
            className={cx(
              "flex w-full items-center justify-between rounded-xl px-4 py-3.5",
              focusCls,
            )}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-900">
              Order summary ({items.length}{" "}
              {items.length === 1 ? "item" : "items"})
              <ChevronDown
                className={cx(
                  "h-4 w-4 text-neutral-500 transition-transform",
                  summaryOpen && "rotate-180",
                )}
              />
            </span>
            <span className="text-sm font-black tabular-nums text-neutral-950">
              {formatINR(totalPaise)}
            </span>
          </button>
          {summaryOpen && (
            <div className="px-4 pb-4">
              <OrderSummary {...summaryProps} />
            </div>
          )}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-12">
          {/* ---- LEFT: form ---- */}
          <form
            id="checkout-form"
            onSubmit={handleSubmit}
            noValidate
            className="space-y-4 lg:col-span-7"
          >
            {/* 1. Contact */}
            <SectionCard step={1} title="Contact" done={contactDone}>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  id="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={setEmail}
                  onBlur={() => touch("email")}
                  error={err("email")}
                />
                <TextField
                  id="phone"
                  label="Mobile number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={setPhone}
                  onBlur={() => touch("phone")}
                  error={err("phone")}
                  hint="Used for delivery updates."
                />
              </div>
            </SectionCard>

            {/* 2. Delivery address */}
            <SectionCard
              step={2}
              title="Shipping address"
              done={addressDone}
            >
              {savedAddresses.length > 0 && (
                <fieldset>
                  <legend className="sr-only">Choose a delivery address</legend>
                  <div className="space-y-1.5">
                    {savedAddresses.map((a) => {
                      const selected =
                        addressMode === "saved" && selectedAddressId === a.id;
                      return (
                        <label
                          key={a.id}
                          className={cx(
                            "flex cursor-pointer items-start gap-3 rounded p-3 transition-colors",
                            selected
                              ? "bg-neutral-100"
                              : "hover:bg-neutral-50",
                          )}
                        >
                          <input
                            type="radio"
                            name="address-choice"
                            value={a.id}
                            checked={selected}
                            onChange={() => {
                              setAddressMode("saved");
                              setSelectedAddressId(a.id);
                            }}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden
                            className={cx(
                              "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#ff5a1f]",
                              selected
                                ? "border-neutral-950 bg-neutral-950 text-white"
                                : "border-neutral-300",
                            )}
                          >
                            {selected && (
                              <Check className="h-2.5 w-2.5" strokeWidth={3} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-neutral-950">
                                {a.fullName}
                              </span>
                              {a.label && (
                                <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                                  {a.label}
                                </span>
                              )}
                              {a.isDefault && (
                                <span className="rounded bg-[#ff5a1f] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-600">
                              {[a.line1, a.line2].filter(Boolean).join(", ")}
                              <br />
                              {[a.city, a.state].filter(Boolean).join(", ")}{" "}
                              {a.postalCode}
                              {a.phone && <> · {a.phone}</>}
                            </p>
                          </div>
                        </label>
                      );
                    })}

                    <label
                      className={cx(
                        "flex cursor-pointer items-center gap-3 rounded p-3 transition-colors",
                        addressMode === "new"
                          ? "bg-neutral-100"
                          : "hover:bg-neutral-50",
                      )}
                    >
                      <input
                        type="radio"
                        name="address-choice"
                        value="new"
                        checked={addressMode === "new"}
                        onChange={() => setAddressMode("new")}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className={cx(
                          "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#ff5a1f]",
                          addressMode === "new"
                            ? "border-neutral-950 bg-neutral-950 text-white"
                            : "border-neutral-300",
                        )}
                      >
                        {addressMode === "new" && (
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-950">
                        <Plus className="h-3.5 w-3.5" />
                        Use a different address
                      </span>
                    </label>
                  </div>

                  {err("address") && (
                    <div data-section-error tabIndex={-1} className="mt-2">
                      <FieldError id="address-error" message={err("address")} />
                    </div>
                  )}
                </fieldset>
              )}

              {!usingSaved && (
                <div
                  className={cx(
                    "space-y-3",
                    savedAddresses.length > 0 &&
                      "mt-4 border-t border-neutral-100 pt-4",
                  )}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      id="fullName"
                      label="Full name"
                      autoComplete="name"
                      value={newAddress.fullName}
                      onChange={(v) => patchAddress({ fullName: v })}
                      onBlur={() => touch("fullName")}
                      error={err("fullName")}
                    />
                    <TextField
                      id="addrPhone"
                      label="Phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Same as contact number"
                      optional
                      value={newAddress.phone}
                      onChange={(v) => patchAddress({ phone: v })}
                      onBlur={() => touch("addrPhone")}
                      error={err("addrPhone")}
                    />
                  </div>
                  <TextField
                    id="line1"
                    label="Address line 1"
                    autoComplete="address-line1"
                    placeholder="House / flat no., building, street"
                    value={newAddress.line1}
                    onChange={(v) => patchAddress({ line1: v })}
                    onBlur={() => touch("line1")}
                    error={err("line1")}
                  />
                  <TextField
                    id="line2"
                    label="Address line 2"
                    autoComplete="address-line2"
                    placeholder="Area, landmark"
                    optional
                    value={newAddress.line2}
                    onChange={(v) => patchAddress({ line2: v })}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      id="city"
                      label="City"
                      autoComplete="address-level2"
                      value={newAddress.city}
                      onChange={(v) => patchAddress({ city: v })}
                      onBlur={() => touch("city")}
                      error={err("city")}
                    />
                    <SelectField
                      id="state"
                      label="State"
                      autoComplete="address-level1"
                      placeholder="Select state"
                      options={INDIAN_STATES}
                      value={newAddress.state}
                      onChange={(v) => patchAddress({ state: v })}
                      onBlur={() => touch("state")}
                      error={err("state")}
                    />
                    <TextField
                      id="postalCode"
                      label="PIN code"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={6}
                      placeholder="6 digits"
                      value={newAddress.postalCode}
                      onChange={(v) =>
                        patchAddress({ postalCode: v.replace(/\D/g, "") })
                      }
                      onBlur={() => touch("postalCode")}
                      error={err("postalCode")}
                    />
                    <TextField
                      id="country"
                      label="Country"
                      value={newAddress.country}
                      readOnly
                    />
                  </div>

                  <div className="flex flex-col gap-3 border-t border-neutral-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs text-neutral-700">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="h-4 w-4 rounded accent-neutral-950"
                      />
                      Save this address for next time
                    </label>
                    {saveAddress && (
                      <div
                        role="radiogroup"
                        aria-label="Address type"
                        className="inline-flex rounded bg-neutral-100 p-0.5"
                      >
                        {ADDRESS_LABELS.map((l) => (
                          <button
                            key={l}
                            type="button"
                            role="radio"
                            aria-checked={newAddress.label === l}
                            onClick={() => patchAddress({ label: l })}
                            className={cx(
                              "rounded px-3.5 py-1.5 text-[11px] font-bold transition-colors",
                              focusCls,
                              newAddress.label === l
                                ? "bg-white text-neutral-950"
                                : "text-neutral-500 hover:text-neutral-900",
                            )}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </SectionCard>

            {/* 3. Payment */}
            <SectionCard step={3} title="Payment method" done>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 rounded bg-neutral-100 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-white">
                    <Banknote className="h-4 w-4 text-neutral-900" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-neutral-950">
                      Cash on Delivery (COD)
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Pay when your order arrives.
                    </div>
                  </div>
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-950 text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </div>

                <div
                  aria-disabled
                  className="flex items-center gap-3 rounded bg-neutral-50 p-3 opacity-70"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-white">
                    <CreditCard className="h-4 w-4 text-neutral-500" />
                  </span>
                  <div className="min-w-0 flex-1 text-xs font-bold text-neutral-700">
                    UPI, cards and netbanking
                  </div>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                    Coming soon
                  </span>
                </div>
              </div>
            </SectionCard>
          </form>

          {/* ---- RIGHT: summary (desktop) ---- */}
          <aside className="hidden lg:col-span-5 lg:block">
            <div className="sticky top-20 rounded-xl bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
                <h2 className="text-sm font-black uppercase tracking-wide text-neutral-900">
                  Order Summary
                </h2>
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-500">
                  {items.length} {items.length === 1 ? "Item" : "Items"}
                </span>
              </div>

              <OrderSummary {...summaryProps} />

              <PlaceOrderButton
                submitting={submitting}
                label={`Place Order · ${formatINR(totalPaise)}`}
                className="mt-4 w-full"
              />

              <p className="mt-2.5 text-center text-[11px] text-neutral-500">
                You&apos;ll pay {formatINR(totalPaise)} in cash on delivery.
              </p>

              {/* Trust badges (same as cart) */}
              <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-neutral-100 pt-4">
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-neutral-700" />{" "}
                  Secure
                </div>
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                  <Truck className="h-3.5 w-3.5 text-neutral-700" /> Fast
                </div>
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                  <RotateCcw className="h-3.5 w-3.5 text-neutral-700" /> Returns
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ---- Mobile sticky bar ---- */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4">
          <div className="shrink-0">
            <p className="text-[11px] text-neutral-500">Total</p>
            <p className="text-lg font-black leading-tight tabular-nums text-neutral-950">
              {formatINR(totalPaise)}
            </p>
          </div>
          <PlaceOrderButton
            submitting={submitting}
            label="Place Order"
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[75vh] items-center justify-center bg-[#fafafa]">
          <Loader2 className="h-6 w-6 animate-spin text-[#ff5a1f]" />
        </div>
      }
    >
      <CheckoutBody />
    </Suspense>
  );
}