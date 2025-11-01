import { getServiceSupabaseClient } from "@/lib/supabaseServer";
import { TOKENS_PER_CREDIT } from "@/lib/pricing";
import type { TranslationUsage } from "@/lib/translation";

export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  description: string[];
  stripePriceEnv: string;
  billingType: "one_time" | "subscription";
  cadence?: string;
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 2000,
    priceUsd: 10,
    stripePriceEnv: "STRIPE_PRICE_ID_STARTER",
    billingType: "one_time",
    description: [
      "For testing or single-user use (≈ 2,000 short messages)",
      "Average price $0.005 per credit",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    credits: 12000,
    priceUsd: 49,
    stripePriceEnv: "STRIPE_PRICE_ID_GROWTH",
    billingType: "one_time",
    description: [
      "More value for small teams (≈ 12,000 messages)",
      "Average price $0.0041 per credit",
    ],
  },
  {
    id: "business",
    name: "Business",
    credits: 70000,
    priceUsd: 249,
    stripePriceEnv: "STRIPE_PRICE_ID_BUSINESS",
    billingType: "one_time",
    description: [
      "Large teams / High volume (≈ 70,000 messages)",
      "Average price $0.0035 per credit",
    ],
  }
];

export function getCreditPackageById(id: string) {
  return CREDIT_PACKAGES.find((pkg) => pkg.id === id) ?? null;
}

export async function ensureCreditBalance(
  userId: string,
  initialBalance = 0,
  serviceClientParam = getServiceSupabaseClient()
) {
  await serviceClientParam.rpc("ensure_credit_balance", {
    target_user: userId,
    initial_balance: initialBalance,
  });
}

export async function fetchCreditBalance(
  userId: string,
  serviceClientParam = getServiceSupabaseClient()
) {
  const { data } = await serviceClientParam
    .from("user_credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.balance ?? 0;
}

export async function spendCredits(
  userId: string,
  amount: number,
  description?: string,
  referenceId?: string,
  serviceClientParam = getServiceSupabaseClient()
) {
  if (amount <= 0) {
    return true;
  }

  const { data, error } = await serviceClientParam.rpc("spend_credits", {
    target_user: userId,
    credit_amount: Math.max(Math.floor(amount), 0),
    txn_description: description ?? null,
    reference: referenceId ?? null,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

export async function addCredits(
  userId: string,
  amount: number,
  type: "purchase" | "adjustment" | "refund" = "purchase",
  description?: string,
  referenceId?: string,
  serviceClientParam = getServiceSupabaseClient()
) {
  if (amount <= 0) {
    return;
  }

  await serviceClientParam.rpc("add_credits", {
    target_user: userId,
    credit_amount: Math.max(Math.floor(amount), 0),
    txn_type: type,
    txn_description: description ?? null,
    reference: referenceId ?? null,
  });
}

export function calculateCreditsFromUsage(usage: TranslationUsage | null) {
  if (!usage) {
    return 1;
  }

  const totalTokens =
    usage.totalTokens ??
    ((usage.inputTokens ?? 0) + (usage.outputTokens ?? 0));

  if (!totalTokens || totalTokens <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(totalTokens / TOKENS_PER_CREDIT));
}
