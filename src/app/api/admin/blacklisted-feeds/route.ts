import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const feedUrl = body.feed_url as string;
  const reason = (body.reason as string) ?? "";

  if (!feedUrl) {
    return NextResponse.json({ error: "feed_url required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("blacklisted_feeds")
    .upsert(
      { feed_url: feedUrl, reason },
      { onConflict: "feed_url" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
