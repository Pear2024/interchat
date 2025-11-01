import { redirect } from "next/navigation";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";
import { ensureProfile } from "@/app/actions/ensure-profile";
import { CREDIT_PACKAGES } from "@/lib/credits";
import { listCreditPackages } from "@/app/actions/credits";
import CreditsDashboard from "@/app/components/credits-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CreditsPage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  await ensureProfile();

  const serviceClient = getServiceSupabaseClient();
  const { data: balanceRow } = await serviceClient
    .from("user_credit_balances")
    .select("balance")
    .eq("user_id", user.id)
    .maybeSingle();

  const packages = await listCreditPackages();

  return (
    <CreditsDashboard
      balance={balanceRow?.balance ?? 0}
      packages={packages ?? CREDIT_PACKAGES}
      userEmail={user.email ?? undefined}
    />
  );
}
