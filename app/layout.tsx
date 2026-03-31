import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import ClientProviders from "@/components/client-providers";
import ThemeToggle from "@/components/theme-toggle";

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
  description: "Public access portal for Hydrex and the Urbex DB member experience."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body
        style={{
          fontFamily: "var(--font-display), sans-serif"
        }}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var stored=localStorage.getItem("theme");var prefers=window.matchMedia("(prefers-color-scheme: dark)").matches;var isDark=stored?stored==="dark":prefers;document.documentElement.setAttribute("data-theme",isDark?"dark":"light");}catch(e){}})();`}
        </Script>
        <div className="grain" />
        <ThemeToggle />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}