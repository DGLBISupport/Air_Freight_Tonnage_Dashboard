import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Tonnage Stats · Dart Global Logistics",
  description: "Interactive dashboard for cargo tonnage, customer and revenue analytics.",
  icons: {
    icon: "/images/Dart_Logo_new.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-[#F8F9FA] text-slate-800`}>
        {children}
      </body>
    </html>
  );
}