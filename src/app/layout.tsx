import type { Metadata } from "next";
import { Noto_Naskh_Arabic, Amiri, Source_Serif_4, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--f-ar",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

const amiri = Amiri({
  variable: "--f-amiri",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

const sourceSerif4 = Source_Serif_4({
  variable: "--f-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const geist = Geist({
  variable: "--f-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--f-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Rahiq",
  description: "Plateforme e-learning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geist.variable} ${geistMono.variable} ${notoNaskhArabic.variable} ${amiri.variable} ${sourceSerif4.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" />
        <script src="https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.js" />
        <script src="https://cdn.jsdelivr.net/npm/marked@9/marked.min.js" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
