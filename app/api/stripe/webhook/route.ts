"use server";

import { NextRequest } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabaseServer";
import {
  CREDIT_PACKAGES,
  addCredits,
  ensureCreditBalance,
  getCreditPackageById,
} from "@/lib/credits";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

async function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const stripeModule = await import("stripe");
  const StripeCtor = stripeModule.default ?? stripeModule.Stripe;
  return new StripeCtor(secretKey);
}

function resolvePackageFromMetadata(metadata: Record<string, unknown>) {
  const packageId =
    typeof metadata.package_id === "string" ? metadata.package_id : "";
  const credits = Number(metadata.credits ?? 0);
  const billingType =
    typeof metadata.billing_type === "string"
      ? metadata.billing_type
      : "one_time";

  const directMatch = getCreditPackageById(packageId);
  if (directMatch) {
    return { pkg: directMatch, billingType };
  }

  const fallback = CREDIT_PACKAGES.find(
    (pkg) => pkg.credits === credits && pkg.billingType === billingType
  );

  return { pkg: fallback ?? null, billingType };
}

async function creditSubscriptionCharge(
  userId: string,
  packageId: string,
  credits: number,
  referenceId: string
) {
  const serviceClient = getServiceSupabaseClient();
  await ensureCreditBalance(userId, 0, serviceClient);

  const { data: existingTxn } = await serviceClient
    .from("user_credit_transactions")
    .select("id")
    .eq("reference_id", referenceId)
    .maybeSingle();

  if (existingTxn) {
    return { success: true };
  }

  await addCredits(
    userId,
    credits,
    "purchase",
    `${packageId} subscription deposit`,
    referenceId,
    serviceClient
  );

  return { success: true };
}

export async function POST(request: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe webhook secret not configured.", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing Stripe signature.", { status: 400 });
  }

  const rawBody = await request.text();

  let event: StripeEvent;
  try {
    const stripe = await getStripeClient();
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET
    ) as unknown as StripeEvent;
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return new Response("Invalid signature.", { status: 400 });
  }

  switch (event.type) {
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Record<string, unknown>;
      const billingReason = invoice["billing_reason"];
      const metadata = (invoice["lines"] as Record<string, unknown>)?.["data"];

      if (billingReason !== "subscription_cycle" || !Array.isArray(metadata)) {
        break;
      }

      const subscriptionLine = metadata[0] as Record<string, unknown>;
      const meta = (subscriptionLine["metadata"] ??
        invoice["metadata"] ??
        {}) as Record<string, unknown>;

      const userId =
        typeof meta.user_id === "string"
          ? meta.user_id
          : typeof invoice["customer_email"] === "string"
          ? invoice["customer_email"]
          : null;

      if (!userId) {
        console.warn("Missing user in subscription invoice metadata", event.id);
        break;
      }

      const { pkg, billingType } = resolvePackageFromMetadata(meta);

      if (!pkg || billingType !== "subscription") {
        console.warn(
          "Unable to resolve package for subscription invoice",
          event.id
        );
        break;
      }

      const referenceId =
        typeof invoice["id"] === "string"
          ? invoice["id"]
          : typeof subscriptionLine["id"] === "string"
          ? subscriptionLine["id"]
          : event.id;

      try {
        await creditSubscriptionCharge(
          userId,
          pkg.id,
          pkg.credits,
          referenceId
        );
      } catch (error) {
        console.error("Failed to credit subscription invoice", error);
        return new Response("Failed to credit subscription", { status: 500 });
      }
      break;
    }

    default:
      // ignore other event types for now
      break;
  }

  return new Response("ok", { status: 200 });
}
