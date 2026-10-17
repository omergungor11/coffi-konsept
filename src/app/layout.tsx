import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Delta, coffee with heart | Delta Cafés",
  description: "Discover Delta Cafés: Portuguese coffee heritage, culture, sustainability, and experiences from bean to cup.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#301c13",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/styles/original.css" />
        <link rel="preload" href="/fonts/delta-season-vf.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/trade-gothic-condenced.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="page.home">{children}</body>
    </html>
  );
}
