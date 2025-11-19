import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const alagard = localFont({
  src: "../public/fonts/alagard.woff2",
  variable: "--font-alagard",
})

export const metadata: Metadata = {
  title: "AI Dungeon Crawler",
  description: "An AI-powered dungeon crawling game built with Next.js and Chrome Canary's integrated AI model (Gemini Nano).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${alagard.className} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
