import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

// One font for Arabic and English text.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "Budget – Voice Assistant Demo",
  description: "Talk with Noura, the Arabic voice assistant for Budget Rent a Car (NDI demo).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${plexArabic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
