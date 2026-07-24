import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";
import "./globals.css";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Internet Curators",
  description: "Discover and curate the best of the internet",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-black text-zinc-100">
        <Header initialUser={user} editorPendingCount={0} />
        <main className="flex-1">{children}</main>
        <Footer />
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
