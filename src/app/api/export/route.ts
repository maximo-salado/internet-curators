import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: curator } = await supabase
    .from("curators")
    .select("id, display_name")
    .eq("user_id", user.id)
    .single();

  if (!curator) return NextResponse.json({ error: "No curator profile" }, { status: 404 });

  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, sources(feed_url, title, site_url)")
    .eq("curator_id", curator.id);

  const outlines = (collections ?? []).map((col: any) => {
    const feeds = (col.sources ?? []).filter((s: any) => s.feed_url).map((s: any) => {
      const title = s.title || (() => {
        try { return new URL(s.feed_url).hostname.replace("www.", ""); } catch { return s.feed_url; }
      })();
      const htmlUrl = s.site_url || (() => {
        try { return new URL(s.feed_url).origin; } catch { return ""; }
      })();
      return `      <outline type="rss" text="${escapeXml(title)}" xmlUrl="${escapeXml(s.feed_url)}" htmlUrl="${escapeXml(htmlUrl)}"/>`;
    }).join("\n");

    return `    <outline text="${escapeXml(col.name)}">\n${feeds}\n    </outline>`;
  }).join("\n");

  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(curator.display_name)}'s Collections</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>`;

  return new NextResponse(opml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="internet-curators-export.opml"`,
    },
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
