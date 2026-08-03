import { Suspense } from "react";
import ShelfCarousel from "@/components/shelf/ShelfCarousel";
export const dynamic = "force-dynamic";
export default function IssuesPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center bg-black"><p className="text-zinc-400 text-sm">Loading shelf...</p></div>}>
      <ShelfCarousel />
    </Suspense>
  );
}
