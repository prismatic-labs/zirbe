import type { Fingerprint, Tier } from "../data/types";

function amount(record: object | undefined, key: string): number {
  if (!record) return 0;
  const value = (record as Record<string, number | undefined>)[key];
  return value ?? 0;
}

function sumValues(record: Partial<Record<string, number>> | undefined): number {
  let total = 0;
  for (const value of Object.values(record ?? {})) total += value ?? 0;
  return total;
}

export function vaPlusTax(fp: Fingerprint): number {
  let total = 0;
  for (const tier of fp.tiers) total += sumValues(tier.va) + tier.tax;
  return total;
}

export function tierTotalGap(fp: Fingerprint): number {
  const va: Record<string, number> = {};
  let tax = 0;
  for (const tier of fp.tiers) {
    for (const [country, value] of Object.entries(tier.va)) {
      va[country] = (va[country] ?? 0) + (value ?? 0);
    }
    tax += tier.tax;
  }
  let gap = Math.abs(tax - fp.tax);
  const keys = new Set([...Object.keys(va), ...Object.keys(fp.va)]);
  for (const key of keys) gap = Math.max(gap, Math.abs((va[key] ?? 0) - amount(fp.va, key)));
  return gap;
}

function purchasesBySeller(tier: Tier): Record<string, number> {
  const bySeller: Record<string, number> = {};
  for (const buyers of Object.values(tier.purchases ?? {})) {
    for (const [seller, amount] of Object.entries(buyers ?? {})) {
      bySeller[seller] = (bySeller[seller] ?? 0) + (amount ?? 0);
    }
  }
  return bySeller;
}

/** Largest absolute gap for check 3. Tiers 4+ have no output, so only n = 0, 1, 2. */
export function purchaseGap(fp: Fingerprint): number {
  let gap = 0;
  for (let n = 0; n <= 2; n += 1) {
    const bought = purchasesBySeller(fp.tiers[n]);
    const output = fp.tiers[n + 1].output ?? {};
    const keys = new Set([...Object.keys(bought), ...Object.keys(output)]);
    for (const key of keys) gap = Math.max(gap, Math.abs((bought[key] ?? 0) - amount(output, key)));
  }
  return gap;
}

export function fingerprintProblems(fp: Fingerprint): string[] {
  const problems: string[] = [];
  const balance = vaPlusTax(fp);
  if (Math.abs(balance - 1) > 0.005) problems.push(`value added plus taxes is ${balance}`);
  const totals = tierTotalGap(fp);
  if (totals > 1e-6) problems.push(`tier totals differ by ${totals}`);
  const purchases = purchaseGap(fp);
  if (purchases > 1e-9) problems.push(`purchases differ from the next output by ${purchases}`);
  if (fp.tiers[4]?.output || fp.tiers[4]?.purchases) problems.push("tier 4+ must not carry output or purchases");
  return problems;
}
