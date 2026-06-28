import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instagram Automation",
  description: "Schedule Instagram Reels from Supabase-hosted video URLs.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
