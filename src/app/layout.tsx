import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/UserMenu";
import { BottomNav } from "@/components/BottomNav";
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

  // Get curator ID for Profile link
  let curatorId: string | undefined;
  if (user) {
    const { data: curator } = await supabase
      .from("curators")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (curator) curatorId = curator.id;
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-black text-zinc-100 pb-14">
        <header className="border-b border-zinc-800">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Internet Curators
            </Link>
            <div className="flex items-center gap-4">
              {user ? (
                <UserMenu email={user.email!} />
              ) : (
                <Link href="/login" className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-700">
                  Sign In
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <BottomNav user={!!user} curatorId={curatorId} />
      </body>
    </html>
  );
}
