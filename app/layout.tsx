import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

import ClientProviders from "@/components/client-providers";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "Urbex Dashboard",
  description: "Cloudflare-first control center for Urbex DB and future platform apps."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body
        style={{
          fontFamily: "var(--font-display), sans-serif"
        }}
      >
        <div className="grain" />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}