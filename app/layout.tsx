// app/layout.tsx
import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
// import { Toaster } from "sonner";
import  AppToaster  from "./(storefront)/_components/toaster";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Shera Sports Wear — Built to Move",
    template: "%s | Shera Sports Wear",
  },
  description:
    "Premium performance sportswear engineered for training, running, and everyday movement.",
  openGraph: {
    title: "Shera Sports Wear",
    description: "Premium performance sportswear engineered to move.",
    type: "website",
    siteName: "Shera Sports Wear",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shera Sports Wear",
    description: "Premium performance sportswear engineered to move.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${anton.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="font-sans antialiased bg-white text-neutral-900">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}