import { redirect } from "next/navigation";
import KnowledgeClient, { type KnowledgeEntry } from "./knowledge-client";
import { ensureProfile } from "@/app/actions/ensure-profile";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KnowledgePage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  await ensureProfile();

  const serviceClient = getServiceSupabaseClient();
  const { data, error } = await serviceClient
    .from("knowledge_sources")
    .select("id,type,title,source,status,error_message,created_at")
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch knowledge sources", error);
  }

  return <KnowledgeClient initialEntries={(data ?? []) as KnowledgeEntry[]} />;
}
