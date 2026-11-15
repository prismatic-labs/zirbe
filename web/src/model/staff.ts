import type { Fingerprint, Purchaser } from "../data/types";

/** Payroll is the operator's own value added: all of it at home, at tier 0, in IT services, with no carbon. */
export function staffFingerprint(home: Purchaser): Fingerprint {
  const industry: Record<string, number> = {
    construction: 0, electrical_machinery: 0, electronics: 0, metals_mining: 0, energy: 0,
    transport_logistics: 0, trade: 0, business_services: 0, it_services: 1, other: 0,
  };
  return {
    tiers: [
      { tier: "0", output: { [home]: 1 }, va: { [home]: 1 }, tax: 0, purchases: {} },
      { tier: "1", output: {}, va: {}, tax: 0, purchases: {} },
      { tier: "2", output: {}, va: {}, tax: 0, purchases: {} },
      { tier: "3", output: {}, va: {}, tax: 0, purchases: {} },
      { tier: "4+", va: {}, tax: 0 },
    ],
    va: { [home]: 1 },
    tax: 0,
    va_domestic_by_industry: industry,
    co2e_kg: {},
    jobs_domestic_per_meur: 0,
  };
}
