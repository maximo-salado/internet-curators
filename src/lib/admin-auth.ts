import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) return null;
  return user;
}

/**
 * Shared editor-role gate for the discovery/moderation routes.
 * Returns the (single) Supabase client so callers reuse one `getUser()` call.
 * On failure, `ok` is false and `{ status, error }` describe the response.
 */
export async function requireEditor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, status: 401, error: "Unauthorized", supabase };
  }
  const { data: curator } = await supabase
    .from("curators")
    .select("id, role")
    .eq("user_id", user.id)
    .single();
  if (!curator || curator.role !== "editor") {
    return { ok: false as const, status: 403, error: "Editor role required", supabase };
  }
  return { ok: true as const, supabase, user, curator };
}
