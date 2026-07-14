import { createClient } from "@/lib/supabase/server";

export async function getCuratorByUserId(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("curators")
    .select("id, display_name, bio, created_at")
    .eq("user_id", userId)
    .single();
  return data;
}

export async function createCurator(userId: string, displayName: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("curators")
    .insert({ user_id: userId, display_name: displayName })
    .select("id, display_name, bio, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function ensureCurator(userId: string, displayName: string) {
  const existing = await getCuratorByUserId(userId);
  if (existing) return existing;
  return createCurator(userId, displayName);
}

export async function generateSlug(name: string): Promise<string> {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // Append short random suffix if needed
  const supabase = await createClient();
  const { data } = await supabase
    .from("collections")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!data) return slug;
  return `${slug}-${crypto.randomUUID().slice(0, 4)}`;
}
