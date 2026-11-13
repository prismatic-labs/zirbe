import type { CategoryFingerprints, CountryGroup, Fingerprint, Tier, TierId } from "../data/types";

function blendMap<K extends string>(
  left: Partial<Record<K, number>> | undefined,
  right: Partial<Record<K, number>> | undefined,
  share: number,
): Partial<Record<K, number>> {
  const keys = new Set<K>([
    ...(Object.keys(left ?? {}) as K[]),
    ...(Object.keys(right ?? {}) as K[]),
  ]);
  const out: Partial<Record<K, number>> = {};
  for (const key of keys) {
    const value = share * (left?.[key] ?? 0) + (1 - share) * (right?.[key] ?? 0);
    if (value !== 0) out[key] = value;
  }
  return out;
}

function blendPurchases(
  left: Tier["purchases"],
  right: Tier["purchases"],
  share: number,
): Tier["purchases"] {
  const buyers = new Set<CountryGroup>([
    ...(Object.keys(left ?? {}) as CountryGroup[]),
    ...(Object.keys(right ?? {}) as CountryGroup[]),
  ]);
  const out: NonNullable<Tier["purchases"]> = {};
  for (const buyer of buyers) {
    const sellers = blendMap(left?.[buyer], right?.[buyer], share);
    if (Object.keys(sellers).length > 0) out[buyer] = sellers;
  }
  return out;
}

function blendTier(left: Tier, right: Tier, share: number): Tier {
  const tier: Tier = {
    tier: left.tier,
    va: blendMap(left.va, right.va, share),
    tax: share * left.tax + (1 - share) * right.tax,
  };
  if (left.tier !== ("4+" as TierId)) {
    tier.output = blendMap(left.output, right.output, share);
    tier.purchases = blendPurchases(left.purchases, right.purchases, share);
  }
  return tier;
}

/** s times the domestic fingerprint plus (1 - s) times the imported one, field by field. */
export function blend(pair: CategoryFingerprints, share: number): Fingerprint {
  return {
    tiers: pair.domestic.tiers.map((tier, index) => blendTier(tier, pair.imported.tiers[index], share)),
    va: blendMap(pair.domestic.va, pair.imported.va, share),
    tax: share * pair.domestic.tax + (1 - share) * pair.imported.tax,
    va_domestic_by_industry: blendMap(
      pair.domestic.va_domestic_by_industry,
      pair.imported.va_domestic_by_industry,
      share,
    ) as Record<string, number>,
    co2e_kg: blendMap(pair.domestic.co2e_kg, pair.imported.co2e_kg, share),
    jobs_domestic_per_meur:
      share * pair.domestic.jobs_domestic_per_meur + (1 - share) * pair.imported.jobs_domestic_per_meur,
  };
}
