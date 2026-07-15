import { createClient } from "@/lib/supabase/server";
import { ensureCurator, generateSlug } from "@/lib/db-helpers";
import { validateFeedUrl } from "@/lib/url-validator";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 1_000_000; // 1 MB
const MAX_FEEDS_PER_IMPORT = 500;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 1 MB)" }, { status: 400 });
  }

  const text = await file.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty file" }, { status: 400 });

  const { folders, ungrouped } = parseOpml(text);
  const allFeeds = [...ungrouped, ...folders.flatMap((f) => f.feeds.map((feed) => ({ ...feed, folder: f.name })))];

  if (allFeeds.length === 0) {
    return NextResponse.json({ error: "No RSS feeds found in file" }, { status: 400 });
  }

  if (allFeeds.length > MAX_FEEDS_PER_IMPORT) {
    return NextResponse.json(
      { error: `Too many feeds (max ${MAX_FEEDS_PER_IMPORT} per import)` },
      { status: 400 }
    );
  }

  const displayName = user.email?.split("@")[0] ?? "Curator";
  const curator = await ensureCurator(user.id, displayName);

  // Get all existing feed URLs across all user's collections
  const { data: existingSources } = await supabase
    .from("sources")
    .select("feed_url, collection_id, collections!inner(curator_id)")
    .eq("collections.curator_id", curator.id);

  const existingUrls = new Set((existingSources ?? []).map((s: any) => s.feed_url));

  // Get existing collection names for matching
  const { data: existingCols } = await supabase
    .from("collections")
    .select("id, name")
    .eq("curator_id", curator.id);

  const existingNames = new Map<string, string>(); // lowercase name → id
  for (const col of existingCols ?? []) {
    existingNames.set(col.name.toLowerCase(), col.id);
  }

  // Group feeds by folder for insertion
  const byFolder = new Map<string, Array<{ title: string; xmlUrl: string; htmlUrl?: string }>>();

  // Process folders from OPML
  for (const folder of folders) {
    if (!byFolder.has(folder.name)) byFolder.set(folder.name, []);
    for (const feed of folder.feeds) {
      byFolder.get(folder.name)!.push(feed);
    }
  }

  // Ungrouped feeds go to "Imported"
  if (ungrouped.length > 0) {
    byFolder.set("Imported", ungrouped);
  }

  let imported = 0;
  let skipped = 0;
  const createdFolders: string[] = [];

  for (const [folderName, folderFeeds] of byFolder) {
    // Try to match existing collection
    let collectionId = existingNames.get(folderName.toLowerCase());

    if (!collectionId) {
      const slug = await generateSlug(folderName);
      const { data: created } = await supabase
        .from("collections")
        .insert({ curator_id: curator.id, name: folderName, slug })
        .select("id")
        .single();
      if (created) {
        collectionId = created.id;
        createdFolders.push(folderName);
      }
    }

    if (!collectionId) continue;

    for (const feed of folderFeeds) {
      if (existingUrls.has(feed.xmlUrl)) {
        skipped++;
        continue;
      }

      const urlCheck = await validateFeedUrl(feed.xmlUrl);
      if (!urlCheck.valid) {
        skipped++;
        continue;
      }

      await supabase.from("sources").insert({
        collection_id: collectionId,
        feed_url: feed.xmlUrl,
        title: feed.title,
        site_url: feed.htmlUrl || "",
      });

      existingUrls.add(feed.xmlUrl);
      imported++;
    }
  }

  return NextResponse.json({ imported, skipped, matched: byFolder.size - createdFolders.length, created: createdFolders.length });
}

function parseOpml(xml: string): {
  folders: Array<{ name: string; feeds: Array<{ title: string; xmlUrl: string; htmlUrl?: string }> }>;
  ungrouped: Array<{ title: string; xmlUrl: string; htmlUrl?: string }>;
} {
  const folders: Array<{ name: string; feeds: Array<{ title: string; xmlUrl: string; htmlUrl?: string }> }> = [];
  const ungrouped: Array<{ title: string; xmlUrl: string; htmlUrl?: string }> = [];
  let currentFolder: string | null = null;
  let depth = 0;

  // Match <outline ...> or <outline .../> 
  const re = /<outline\s+([^>]*?)(\/>|>)|<\/outline>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(xml)) !== null) {
    // Closing tag
    if (match[0].startsWith("</outline>")) {
      depth = Math.max(0, depth - 1);
      if (depth === 0) currentFolder = null;
      continue;
    }

    const attrs = match[1];
    const type = getAttr(attrs, "type");
    const text = getAttr(attrs, "text");
    const xmlUrl = getAttr(attrs, "xmlUrl");
    const selfClosing = match[2] === "/>";

    if (type === "rss" && xmlUrl) {
      const feed = {
        title: getAttr(attrs, "title") || text || xmlUrl,
        xmlUrl,
        htmlUrl: getAttr(attrs, "htmlUrl"),
      };
      if (currentFolder) {
        let folder = folders.find((f) => f.name === currentFolder);
        if (!folder) {
          folder = { name: currentFolder, feeds: [] };
          folders.push(folder);
        }
        folder.feeds.push(feed);
      } else {
        ungrouped.push(feed);
      }
    } else if (text && !selfClosing && type !== "rss") {
      // This is a folder container
      if (depth === 0) {
        currentFolder = text;
      }
      depth++;
    }
  }

  return { folders, ungrouped };
}

function getAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? match[1] : undefined;
}
