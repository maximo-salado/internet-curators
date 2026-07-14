import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-zinc-100">
        <header className="border-b border-zinc-800">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Internet Curators
            </Link>
            <div className="flex items-center gap-6 text-sm">
              {user ? (
                <div className="flex items-center gap-6 text-sm">
                  <Link
                    href="/"
                    className="text-zinc-400 transition-colors hover:text-zinc-100"
                  >
                    Feed
                  </Link>
                  <Link
                    href="/dashboard"
                    className="text-zinc-400 transition-colors hover:text-zinc-100"
                  >
                    Dashboard
                  </Link>
                  <span className="text-zinc-500">{user.email}</span>
                  <form action="/auth/signout" method="post">
                    <button
                      type="submit"
                      className="rounded-md bg-zinc-800 px-3 py-1.5 text-zinc-300 transition-colors hover:bg-zinc-700"
                    >
                      Sign Out
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md bg-zinc-800 px-3 py-1.5 text-zinc-300 transition-colors hover:bg-zinc-700"
                >
                  Sign In
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
