import type { Metadata } from "next";
import { Inter, Anton } from "next/font/google";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://shera.example"),
  title: {
    default: "Shera Sports Wear — Built for the Grind",
    template: "%s | Shera Sports Wear",
  },
  description:
    "Performance sports wear designed in India. Running shoes, training gear, and everyday apparel built for the grind.",
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Shera Sports Wear",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${anton.variable}`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        <SiteHeader />
        <main className="min-h-[60vh]">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}