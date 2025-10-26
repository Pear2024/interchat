type ModelPricing = {
  inputUsdPerThousand: number;
  outputUsdPerThousand: number;
};

export const TOKENS_PER_CREDIT = 1000;

const BASE_MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o-mini": {
    inputUsdPerThousand: 0.00015,
    outputUsdPerThousand: 0.0006,
  },
  "gpt-4o-mini-translate": {
    inputUsdPerThousand: 0.00012,
    outputUsdPerThousand: 0.00048,
  },
  "gpt-4o": {
    inputUsdPerThousand: 0.005,
    outputUsdPerThousand: 0.015,
  },
  "gpt-4.1": {
    inputUsdPerThousand: 0.005,
    outputUsdPerThousand: 0.015,
  },
  "gpt-4.1-mini": {
    inputUsdPerThousand: 0.0015,
    outputUsdPerThousand: 0.003,
  },
};

const DEFAULT_PRICING: ModelPricing = {
  inputUsdPerThousand: 0.0005,
  outputUsdPerThousand: 0.0005,
};

function normalizeModelKey(model?: string | null) {
  if (!model) return "";
  return model.replace(/^openai-/, "").trim().toLowerCase();
}

export function getModelPricing(model?: string | null): {
  normalizedModel: string;
  pricing: ModelPricing;
} {
  const normalizedModel = normalizeModelKey(model);
  if (!normalizedModel) {
    return { normalizedModel: "unknown", pricing: DEFAULT_PRICING };
  }

  const pricing =
    BASE_MODEL_PRICING[normalizedModel] ??
    BASE_MODEL_PRICING[normalizedModel.replace(/:.+$/, "")] ??
    DEFAULT_PRICING;

  return { normalizedModel, pricing };
}

export function estimateCostUSD({
  modelVersion,
  inputTokens = 0,
  outputTokens = 0,
}: {
  modelVersion?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}) {
  const safeInput = Math.max(0, inputTokens ?? 0);
  const safeOutput = Math.max(0, outputTokens ?? 0);

  const { normalizedModel, pricing } = getModelPricing(modelVersion);

  const inputCost =
    (safeInput / 1000) * (pricing.inputUsdPerThousand ?? DEFAULT_PRICING.inputUsdPerThousand);
  const outputCost =
    (safeOutput / 1000) * (pricing.outputUsdPerThousand ?? DEFAULT_PRICING.outputUsdPerThousand);

  const totalCost = inputCost + outputCost;

  return {
    costUsd: totalCost,
    normalizedModel,
    pricing,
  };
}

export function suggestPricePerCredit({
  costPerCredit,
  targetMargin = 0.6,
  premiumMultiplier = 1.25,
  floorPrice = 0.01,
}: {
  costPerCredit: number;
  targetMargin?: number;
  premiumMultiplier?: number;
  floorPrice?: number;
}) {
  const safeCost = Math.max(0, costPerCredit);
  const breakeven = safeCost;

  const recommended = Math.max(
    floorPrice,
    safeCost * (1 + Math.max(0, targetMargin))
  );

  const premium = Math.max(
    recommended * Math.max(1, premiumMultiplier),
    recommended + 0.01
  );

  const margin =
    recommended > 0 ? (recommended - breakeven) / recommended : 0;

  return {
    breakeven,
    recommended,
    premium,
    margin,
  };
}

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
