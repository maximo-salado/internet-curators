import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = await createClient();

  let body: { hidden?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "hidden must be a boolean" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sources")
    .update({ hidden: body.hidden })
    .eq("id", id)
    .select("id, hidden")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
