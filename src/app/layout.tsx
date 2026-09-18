import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aegis on Monad — Trust Layer for Capital-Moving AI Agents",
  description: "ERC-8004 agent registry, fail-closed CHP policy gate, HMAC-chained proof ledger with onchain anchors, and an autonomous circuit breaker — live on a multi-agent trading desk.",
  keywords: ["Monad", "ERC-8004", "AI agents", "policy gate", "circuit breaker", "trust layer", "Monad testnet"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Aegis on Monad",
    description: "The trust layer for AI agents that move capital — live demo.",
    siteName: "Aegis",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
