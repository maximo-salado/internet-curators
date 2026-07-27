import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";
import { Suspense } from "react";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-full flex flex-col">
      <Header initialUser={user} editorPendingCount={0} />
      <main className="flex-1">{children}</main>
      <Footer />
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
