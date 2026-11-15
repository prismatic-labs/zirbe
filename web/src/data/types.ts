export type CountryGroup = "AT" | "CH" | "DE" | "IT" | "FR" | "EU_OTHER" | "UK"
  | "US" | "CN" | "TW" | "KR" | "JP" | "ROW";
export type Purchaser = "AT" | "CH";
export type CategoryId = "construction" | "electrical" | "cooling" | "it_hardware"
  | "engineering" | "electricity" | "maintenance" | "heat_recovery" | "staff";
export type SiteId = "vienna" | "innsbruck" | "linz" | "zurich" | "geneva" | "lugano";
export type ArchetypeId = "ai" | "cloud";
export type ScenarioId = "low_impact" | "central" | "high_impact";
export type TierId = "0" | "1" | "2" | "3" | "4+";
export type Series20 = number[]; // exactly 20 values, years 1 to 20

export interface Meta {
  version: string;
  generated_at: string;        // ISO 8601
  fixture: boolean;            // true for fake data
  name: string;                // "Zirbe"
  tagline: string;             // "Follow the Euro"
  table: { name: string; edition: string; reference_year: number; prices: "basic"; source_id: string };
  datasets: {
    id: string; name: string; publisher: string; edition: string;
    url: string; accessed: string;   // accessed: ISO 8601 date
    license?: string;
  }[];
  price_year: number;
  fx_eur_chf: { value: number; source_id: string };   // 1 EUR = value CHF
  tiers: TierId[];
  country_groups: { id: CountryGroup; label: string }[];
  industry_groups: { id: string; label: string }[];
  categories: {
    id: CategoryId; label: string;
    phase: "capital" | "operating"; has_slider: boolean;
    payer: "building" | "tenant";
  }[];
  sites: {
    id: SiteId; label: string; country: Purchaser; currency: "EUR" | "CHF";
    lat: number; lon: number; heat_available: boolean; source_ids: string[];
  }[];
}

export interface Tier {
  tier: TierId;
  output?: Partial<Record<CountryGroup, number>>;     // absent for "4+"
  va: Partial<Record<CountryGroup, number>>;
  tax: number;
  // buyer at this tier -> seller at the next tier; absent for "4+"
  purchases?: Partial<Record<CountryGroup, Partial<Record<CountryGroup, number>>>>;
}

export interface Fingerprint {                 // per 1 EUR of spend
  tiers: Tier[];                        // five entries, "0" to "4+"
  va: Partial<Record<CountryGroup, number>>;          // sum over tiers
  tax: number;                                        // sum over tiers
  va_domestic_by_industry: Record<string, number>;    // purchaser's own industries
  co2e_kg: Partial<Record<CountryGroup, number>>;     // kg CO2e per EUR, where emitted
  jobs_domestic_per_meur: number;                     // job-years per million EUR (persons employed)
}

export interface CategoryFingerprints {
  default_domestic_share: number;       // 0 to 1
  domestic_share_low: number;           // 0 to 1, used by the low_impact set
  domestic_share_high: number;          // 0 to 1, used by the high_impact set
  domestic: Fingerprint;
  imported: Fingerprint;
  source_ids: string[];
}

export type Fingerprints = Record<Purchaser,
  Record<Exclude<CategoryId, "staff">, CategoryFingerprints>>;

export interface Variant {                     // one assumption moved alone: only what differs from the central schedule
  spend?: Partial<Record<CategoryId, Series20>>;
  heat_pump_spend?: Series20;
  domestic_share?: Partial<Record<CategoryId, number>>;   // 0 to 1, for a category whose share is an assumption
}

export interface Schedule {                    // per MW of IT load, EUR at the price year
  spend: Record<CategoryId, Series20>;  // staff = payroll
  electricity_mwh: Series20;
  heat_delivered_mwh: Series20;         // used only when the heat switch is on
  heat_pump_mwh: Series20;              // extra electricity, heat switch on
  heat_pump_spend: Series20;            // cost of that electricity, heat switch on; uses the electricity fingerprint
  staff_jobs: Series20;                 // operator staff, persons employed
  grid_kgco2e_per_mwh: number;          // location-based, life-cycle, consumption mix
  contract_kgco2e_per_mwh: number;      // market-based renewable contract
  heat_displaced_kgco2e_per_mwh: number;
  cross_border_payroll_share: number;   // 0 to 1
  milestones: { year: number; key: "build" | "first_fit" | "it_refresh" | "midlife_refresh" }[];
  source_ids: string[];
  // central schedule only: every assumption that moves spend or a domestic share,
  // at its low and at its high value while the others stay central
  variants?: Record<string, { low: Variant; high: Variant }>;
}

export type Lifecycle = Record<SiteId, Record<ArchetypeId, Record<ScenarioId, Schedule>>>;

export interface Assumption {
  id: string;
  label: string;
  unit: string;
  low: number; central: number; high: number;
  source: string; url?: string; note?: string;
  source_accessed: string;                       // ISO 8601 date the source was read
  source_published?: string;                     // year, year-month or date of the source
  status: "draft" | "approved";
  direction?: "raises" | "lowers" | "neutral";   // effect of a higher value on the headline
}

export type Assumptions = Assumption[];

export interface Dataset {
  meta: Meta;
  fingerprints: Fingerprints;
  lifecycle: Lifecycle;
  assumptions: Assumptions;
}
