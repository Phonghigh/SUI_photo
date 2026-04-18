import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SnapProof — Verify photo authenticity on Sui",
  description:
    "SnapProof anchors photos to the Sui blockchain. Paste a proof ID or image hash to verify the cryptographic record.",
  openGraph: {
    title: "SnapProof — Verify photo authenticity on Sui",
    description:
      "Every photo you take, cryptographically anchored on Sui. Verifiable by anyone.",
    siteName: "SnapProof",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SnapProof",
    description:
      "Cryptographic photo authenticity on Sui — verify any image in one click.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
