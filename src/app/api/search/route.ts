import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ curators: [], collections: [] });

  const supabase = await createClient();

  // Search curators by display_name
  const { data: curators } = await supabase
    .from("curators")
    .select("id, display_name, bio")
    .ilike("display_name", `%${q}%`)
    .limit(5);

  // Search published collections by name
  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, description, slug, curator_id, curators(display_name)")
    .eq("published", true)
    .ilike("name", `%${q}%`)
    .limit(5);

  return NextResponse.json({
    curators: curators ?? [],
    collections: (collections ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      slug: c.slug,
      curatorName: c.curators?.display_name ?? "Unknown",
    })),
  });
}
