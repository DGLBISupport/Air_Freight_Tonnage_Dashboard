import type { Metadata } from "next";
import "./globals.css";

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
      <head>
        {/* Load Inter font directly from Google CDN — compatible with static export */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-[#F8F9FA] text-slate-800">
        {children}
      </body>
    </html>
  );
}