"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";
import {
  CREDIT_PACKAGES,
  getCreditPackageById,
  addCredits,
  ensureCreditBalance,
} from "@/lib/credits";

function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && configured.trim().length > 0) {
    return configured.replace(/\/$/, "");
  }

  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL ?? "";
  if (vercelEnv) {
    const normalized = vercelEnv.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${normalized}`;
  }

  return "http://localhost:3000";
}

export async function listCreditPackages() {
  return CREDIT_PACKAGES;
}

async function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Stripe is not configured. Please set STRIPE_SECRET_KEY and price IDs."
    );
  }

  try {
    const stripeModule = await import("stripe");
    const StripeCtor = stripeModule.default ?? stripeModule.Stripe;
    return new StripeCtor(secretKey);
  } catch {
    throw new Error(
      "Stripe SDK is not installed. Run `npm install stripe` and redeploy."
    );
  }
}

export async function createCheckoutSession(packageId: string) {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  const creditPackage = getCreditPackageById(packageId);
  if (!creditPackage) {
    return { error: "Unknown credit package selected." };
  }

  const priceId = process.env[creditPackage.stripePriceEnv];
  if (!priceId) {
    return {
      error: `Missing Stripe price id. Please set ${creditPackage.stripePriceEnv} in your environment.`,
    };
  }

  const stripe = await getStripeClient();
  const successUrl = `${getSiteUrl()}/credits/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${getSiteUrl()}/credits`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: creditPackage.billingType === "subscription" ? "subscription" : "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        package_id: creditPackage.id,
        credits: creditPackage.credits.toString(),
        billing_type: creditPackage.billingType,
      },
    });

    if (!session.url) {
      return {
        error:
          "Unable to create checkout session. Please verify your Stripe configuration.",
      };
    }

    return { url: session.url };
  } catch (error) {
    console.error("Stripe checkout session error", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to start checkout at the moment.",
    };
  }
}

export async function finalizeCheckout(sessionId: string | null) {
  if (!sessionId) {
    return { error: "Missing checkout session information." };
  }

  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  let session;
  try {
    const stripe = await getStripeClient();
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error("Stripe session retrieval error", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to verify your payment. Please contact support.",
    };
  }

  if (session.payment_status !== "paid") {
    return {
      error:
        "We couldn't confirm your payment yet. Please wait a moment and refresh, or contact support if the charge appears on your statement.",
    };
  }

  const metadataUserId = session.metadata?.user_id;
  const metadataPackageId = session.metadata?.package_id;
  const metadataCredits = Number(session.metadata?.credits ?? "0");
  const metadataBillingType = session.metadata?.billing_type ?? "one_time";

  if (!metadataUserId || metadataUserId !== user.id) {
    return {
      error:
        "Payment metadata does not match your account. Please contact support with your receipt.",
    };
  }

  const creditPackage =
    getCreditPackageById(metadataPackageId ?? "") ??
    CREDIT_PACKAGES.find(
      (pkg) => pkg.credits === metadataCredits && pkg.priceUsd > 0
    );

  if (!creditPackage) {
    return {
      error:
        "We couldn't match this payment to a credit package. Please contact support.",
    };
  }

  const serviceClient = getServiceSupabaseClient();
  await ensureCreditBalance(user.id, 0, serviceClient);

  const { data: existingCharge } = await serviceClient
    .from("user_credit_transactions")
    .select("id")
    .eq("reference_id", sessionId)
    .maybeSingle();

  if (existingCharge) {
    return { success: true, alreadyProcessed: true };
  }

  const creditsToAdd =
    metadataBillingType === "subscription"
      ? creditPackage.credits
      : metadataCredits || creditPackage.credits;

  await addCredits(
    user.id,
    creditsToAdd,
    "purchase",
    `${creditPackage.name} credit pack`,
    sessionId,
    serviceClient
  );

  revalidatePath("/credits");

  return {
    success: true,
    creditsAdded: creditsToAdd,
    packageName: creditPackage.name,
  };
}
