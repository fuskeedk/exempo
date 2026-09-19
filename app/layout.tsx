import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Exempo — Sagshåndtering",
  description: "FSM-baseret sagshåndtering med kalender, KLS, faktura og dækningsgrad.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da" className={`${fraunces.variable} ${outfit.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
