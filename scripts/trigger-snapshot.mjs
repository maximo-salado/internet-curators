#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

function estDateString(date = new Date()) {
  const est = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  return est.toISOString().split("T")[0];
}

async function main() {
  const p_date = estDateString();
  console.log(`Target date (EST): ${p_date}`);

  // Step 1: Blacklisted feed URLs
  const { data: blacklisted } = await supabase.from("blacklisted_feeds").select("feed_url");
  const blacklistedUrls = new Set((blacklisted || []).map((b) => b.feed_url));

  // Step 2: Eligible sources
  const { data: sources } = await supabase.from("sources").select("id, feed_url, title").eq("hidden", false);
  const eligible = (sources || []).filter((s) => !blacklistedUrls.has(s.feed_url));

  if (!eligible.length) {
    console.log("No eligible sources.");
    return;
  }

  const eligibleIds = eligible.map((s) => s.id);
  const eligibleMap = new Map(eligible.map((s) => [s.id, s]));
  console.log(`Eligible sources: ${eligible.length}`);

  // Step 3: Already-issued article links
  const { data: issuedArticles } = await supabase.from("issue_articles").select("article_id, articles(link)");
  const issuedLinkSet = new Set();
  for (const row of issuedArticles || []) {
    const articles = row.articles;
    if (articles && articles.link) issuedLinkSet.add(articles.link);
  }
  console.log(`Already-issued links: ${issuedLinkSet.size}`);

  // Step 4: Eligible articles
  const { data: articles } = await supabase
    .from("articles")
    .select("id, link, pub_date, source_id")
    .in("source_id", eligibleIds)
    .order("pub_date", { ascending: false })
    .limit(500);

  if (!articles || !articles.length) {
    console.log("No articles found.");
    return;
  }

  // Step 5: Filter + dedupe
  const seen = new Map();
  for (const a of articles) {
    if (issuedLinkSet.has(a.link)) continue;
    if (!seen.has(a.link)) seen.set(a.link, a);
  }

  const eligibleArticles = [];
  for (const a of seen.values()) {
    if (eligibleMap.has(a.source_id)) eligibleArticles.push(a);
  }
  console.log(`Unissued articles: ${eligibleArticles.length}`);

  if (!eligibleArticles.length) {
    console.log("Empty pool - all articles already issued.");
    return;
  }

  // Step 6: Interleave by source
  const bySource = new Map();
  for (const item of eligibleArticles) {
    const key = item.source_id;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(item);
  }

  const sourceKeys = Array.from(bySource.keys());
  const interleaved = [];
  let idx = 0;
  while (interleaved.length < 20 && sourceKeys.length > 0) {
    const sourceKey = sourceKeys[idx % sourceKeys.length];
    const bucket = bySource.get(sourceKey);
    if (bucket.length > 0) {
      interleaved.push(bucket.shift());
    } else {
      sourceKeys.splice(idx % sourceKeys.length, 1);
      continue;
    }
    idx++;
  }

  const p_article_ids = interleaved.map((a) => a.id);
  console.log(`Selected ${p_article_ids.length} articles`);

  // Step 7: Call RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc("create_daily_issue", {
    p_date,
    p_origin: "auto",
    p_article_ids,
  });

  if (rpcError) {
    if (rpcError.code === "23505") {
      console.log(`Issue for ${p_date} already exists.`);
      const { data: existing } = await supabase
        .from("issues")
        .select("issue_number, date")
        .eq("date", p_date)
        .single();
      console.log(`  Existing: #${existing.issue_number} on ${existing.date}`);
      return;
    }
    console.error("RPC error:", rpcError.message, rpcError.code);
    return;
  }

  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  console.log(`Created issue #${result.issue_number} for ${p_date} (${p_article_ids.length} articles)`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
