import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Edcruiter - AI Teacher Assessment & Recruitment Platform",
  description: "Screen credentials, automate school criteria, run asynchronous 5-minute AI chalkboard video interviews, assess structured lesson plans, and manage 3-stage clearances in one AI recruitment platform built specifically for schools.",
  keywords: ["teacher hiring", "ai teacher assessment", "school recruitment software", "cbse teacher hiring", "education hiring platform"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.className} min-h-screen antialiased flex flex-col bg-[#f8fafc] text-slate-900 selection:bg-indigo-600 selection:text-white`}>
        <Navbar />
        <main className="flex-1 w-full">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
