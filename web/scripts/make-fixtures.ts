/**
 * Fake meta, fingerprints, lifecycle and assumptions for layout.
 * Shapes follow the same identities as real fingerprints.
 * Servers are mostly imported. Construction is mostly domestic.
 *
 * Phase matches engine/mappings.yaml. Electricity, maintenance and staff
 * are operating. Every other category, heat recovery included, is capital.
 * This file keeps its own copy and does not read the engine. The page
 * reads the phase from meta and does not assume it.
 *
 * Innsbruck and Lugano have no suitable heat network in this fixture,
 * so the disabled switch can be seen. That is a fixture choice.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Assumption,
  CategoryId,
  CountryGroup,
  Fingerprint,
  Meta,
  Purchaser,
  Tier,
  TierId,
} from "../src/data/types";
import { blend } from "../src/model/blend";
import { fingerprintProblems } from "../src/model/checks";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "src/test/fixtures");

const COUNTRIES = [
  "AT", "CH", "DE", "IT", "FR", "EU_OTHER", "UK", "US", "CN", "TW", "KR", "JP", "ROW",
] as const satisfies readonly CountryGroup[];
const INDUSTRIES = [
  "construction", "electrical_machinery", "electronics", "metals_mining", "energy",
  "transport_logistics", "trade", "business_services", "it_services", "other",
] as const;
const CATEGORIES = [
  "construction", "electrical", "cooling", "it_hardware", "engineering",
  "electricity", "maintenance", "heat_recovery", "staff",
] as const satisfies readonly CategoryId[];
const SLIDERS = new Set<CategoryId>(["electrical", "cooling", "it_hardware"]);
const YEARS = 20;
const READ = "2026-11-10";

type Mix = Partial<Record<CountryGroup, number>>;
type Cat = Exclude<CategoryId, "staff">;

const PHASE: Record<CategoryId, "capital" | "operating"> = {
  construction: "capital",
  electrical: "capital",
  cooling: "capital",
  it_hardware: "capital",
  engineering: "capital",
  electricity: "operating",
  maintenance: "operating",
  heat_recovery: "capital",
  staff: "operating",
};

const LABELS = {
  country: {
    AT: "Austria", CH: "Switzerland", DE: "Germany", IT: "Italy", FR: "France",
    EU_OTHER: "Rest of the EU", UK: "United Kingdom", US: "United States", CN: "China",
    TW: "Taiwan", KR: "South Korea", JP: "Japan", ROW: "Rest of the world",
  } as Record<CountryGroup, string>,
  industry: {
    construction: "Construction",
    electrical_machinery: "Electrical equipment and machinery",
    electronics: "Electronics",
    metals_mining: "Metals and mining",
    energy: "Energy",
    transport_logistics: "Transport and logistics",
    trade: "Wholesale and retail trade",
    business_services: "Engineering and business services",
    it_services: "IT services",
    other: "Other",
  } as Record<string, string>,
  category: {
    construction: "Construction",
    electrical: "Electrical equipment",
    cooling: "Cooling",
    it_hardware: "IT hardware",
    engineering: "Engineering",
    electricity: "Electricity",
    maintenance: "Maintenance",
    heat_recovery: "Heat recovery",
    staff: "Staff",
  } as Record<CategoryId, string>,
};

interface Recipe {
  vaRate: number;
  taxRate: number;
  homeKeep: number;
  jobsDomestic: number;
  jobsImported: number;
  co2: number;
  industry: MixOf<string>;
  abroad: Mix;
}

type MixOf<K extends string> = Partial<Record<K, number>>;

const ABROAD: Record<Cat, Mix> = {
  construction: bag({ DE: 40, IT: 16, EU_OTHER: 18, CN: 10, FR: 8, ROW: 8 }),
  electrical: bag({ DE: 30, CN: 18, EU_OTHER: 16, IT: 10, US: 8, FR: 6, JP: 5, ROW: 7 }),
  cooling: bag({ DE: 28, IT: 18, EU_OTHER: 16, CN: 14, FR: 8, US: 6, ROW: 10 }),
  it_hardware: bag({ CN: 32, TW: 20, KR: 10, US: 12, JP: 8, DE: 7, EU_OTHER: 6, ROW: 5 }),
  engineering: bag({ DE: 42, EU_OTHER: 24, UK: 14, FR: 10, US: 10 }),
  electricity: bag({ DE: 34, FR: 22, IT: 16, EU_OTHER: 18, CH: 10, AT: 10 }),
  maintenance: bag({ DE: 40, EU_OTHER: 24, IT: 14, FR: 12, UK: 10 }),
  heat_recovery: bag({ DE: 34, IT: 18, EU_OTHER: 16, CN: 12, FR: 8, JP: 6, ROW: 6 }),
};

const RECIPE: Record<Cat, Recipe> = {
  construction: {
    vaRate: 0.36, taxRate: 0.06, homeKeep: 0.7, jobsDomestic: 11, jobsImported: 2.4, co2: 0.32,
    industry: { construction: 62, trade: 8, transport_logistics: 7, business_services: 8, metals_mining: 5, other: 10 },
    abroad: ABROAD.construction,
  },
  electrical: {
    vaRate: 0.28, taxRate: 0.04, homeKeep: 0.42, jobsDomestic: 7.2, jobsImported: 1.8, co2: 0.42,
    industry: { electrical_machinery: 55, metals_mining: 14, trade: 10, business_services: 8, other: 13 },
    abroad: ABROAD.electrical,
  },
  cooling: {
    vaRate: 0.28, taxRate: 0.04, homeKeep: 0.44, jobsDomestic: 6.6, jobsImported: 1.6, co2: 0.38,
    industry: { electrical_machinery: 48, metals_mining: 12, trade: 12, construction: 8, other: 20 },
    abroad: ABROAD.cooling,
  },
  it_hardware: {
    vaRate: 0.16, taxRate: 0.02, homeKeep: 0.22, jobsDomestic: 3.1, jobsImported: 0.8, co2: 0.58,
    industry: { electronics: 46, trade: 22, transport_logistics: 12, business_services: 8, other: 12 },
    abroad: ABROAD.it_hardware,
  },
  engineering: {
    vaRate: 0.58, taxRate: 0.07, homeKeep: 0.76, jobsDomestic: 8.4, jobsImported: 2.1, co2: 0.08,
    industry: { business_services: 78, it_services: 8, trade: 4, other: 10 },
    abroad: ABROAD.engineering,
  },
  electricity: {
    vaRate: 0.4, taxRate: 0.05, homeKeep: 0.82, jobsDomestic: 1.6, jobsImported: 0.3, co2: 0,
    industry: { energy: 84, business_services: 6, other: 10 },
    abroad: ABROAD.electricity,
  },
  maintenance: {
    vaRate: 0.5, taxRate: 0.06, homeKeep: 0.72, jobsDomestic: 9.1, jobsImported: 2.2, co2: 0.12,
    industry: { other: 36, business_services: 24, electrical_machinery: 14, construction: 12, trade: 14 },
    abroad: ABROAD.maintenance,
  },
  heat_recovery: {
    vaRate: 0.3, taxRate: 0.04, homeKeep: 0.46, jobsDomestic: 6.2, jobsImported: 1.5, co2: 0.4,
    industry: { electrical_machinery: 46, construction: 20, business_services: 12, metals_mining: 8, other: 14 },
    abroad: ABROAD.heat_recovery,
  },
};

const DOMESTIC: Record<Purchaser, Record<Cat, number>> = {
  AT: {
    construction: 0.86, electrical: 0.34, cooling: 0.41, it_hardware: 0.07,
    engineering: 0.8, electricity: 0.95, maintenance: 0.83, heat_recovery: 0.52,
  },
  CH: {
    construction: 0.74, electrical: 0.22, cooling: 0.28, it_hardware: 0.04,
    engineering: 0.72, electricity: 0.97, maintenance: 0.7, heat_recovery: 0.36,
  },
};

interface SiteFact {
  id: Meta["sites"][number]["id"];
  country: Purchaser;
  currency: "EUR" | "CHF";
  label: string;
  lat: number;
  lon: number;
  heat: boolean;
  cross: number;
  grid: number;
  contract: number;
  heatKg: number;
  cooling: number;
  mwh: number;
  staff: number;
  heatOut: number;
}

const SITES: SiteFact[] = [
  { id: "vienna", country: "AT", currency: "EUR", label: "Vienna", lat: 48.2082, lon: 16.3738, heat: true, cross: 0.05, grid: 190, contract: 28, heatKg: 230, cooling: 1, mwh: 1, staff: 1, heatOut: 1.25 },
  { id: "innsbruck", country: "AT", currency: "EUR", label: "Innsbruck", lat: 47.2692, lon: 11.4041, heat: false, cross: 0.03, grid: 42, contract: 16, heatKg: 210, cooling: 0.8, mwh: 0.92, staff: 1, heatOut: 1 },
  { id: "linz", country: "AT", currency: "EUR", label: "Linz", lat: 48.3069, lon: 14.2858, heat: true, cross: 0.04, grid: 220, contract: 30, heatKg: 240, cooling: 1, mwh: 1, staff: 1, heatOut: 1 },
  { id: "zurich", country: "CH", currency: "CHF", label: "Zurich", lat: 47.3769, lon: 8.5417, heat: true, cross: 0.16, grid: 38, contract: 15, heatKg: 200, cooling: 1, mwh: 1, staff: 1.35, heatOut: 1 },
  { id: "geneva", country: "CH", currency: "CHF", label: "Geneva", lat: 46.2044, lon: 6.1432, heat: true, cross: 0.44, grid: 34, contract: 14, heatKg: 190, cooling: 1, mwh: 1, staff: 1.1, heatOut: 1 },
  { id: "lugano", country: "CH", currency: "CHF", label: "Lugano", lat: 46.0037, lon: 8.9511, heat: false, cross: 0.37, grid: 78, contract: 22, heatKg: 180, cooling: 1.2, mwh: 1.12, staff: 1, heatOut: 0.5 },
];

function bag<K extends string = CountryGroup>(parts: Record<string, number>): Partial<Record<K, number>> {
  const total = Object.values(parts).reduce((sum, value) => sum + value, 0);
  const out: Partial<Record<K, number>> = {};
  for (const [key, value] of Object.entries(parts)) out[key as K] = value / total;
  return out;
}

function sumMix(mix: Mix): number {
  return Object.values(mix).reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function normalize(mix: Mix): Mix {
  const total = sumMix(mix);
  if (total === 0) return {};
  const out: Mix = {};
  for (const [key, value] of Object.entries(mix)) {
    if (value) out[key as CountryGroup] = value / total;
  }
  return out;
}

function without(mix: Mix, home: CountryGroup): Mix {
  const copy = { ...mix };
  delete copy[home];
  return normalize(copy);
}

function trim(mix: Mix, floor: number): Mix {
  const entries = Object.entries(mix).filter((entry): entry is [CountryGroup, number] => (entry[1] ?? 0) > 0);
  if (entries.length === 0) return {};
  let dust = 0;
  const kept: [CountryGroup, number][] = [];
  for (const [key, value] of entries) {
    if (value < floor) dust += value;
    else kept.push([key, value]);
  }
  if (kept.length === 0) {
    entries.sort((a, b) => b[1] - a[1]);
    return { [entries[0][0]]: entries.reduce((sum, [, value]) => sum + value, 0) };
  }
  kept.sort((a, b) => b[1] - a[1]);
  kept[0][1] += dust;
  return Object.fromEntries(kept);
}

function suppliers(buyer: CountryGroup, home: Purchaser, homeKeep: number, abroad: Mix): Mix {
  if (buyer === home) {
    const out: Mix = { [home]: homeKeep };
    const rest = 1 - homeKeep;
    for (const [key, value] of Object.entries(without(abroad, home))) {
      out[key as CountryGroup] = (out[key as CountryGroup] ?? 0) + rest * (value ?? 0);
    }
    return trim(normalize(out), 0.03);
  }
  const stay = 0.58;
  const homeReturn = 0.06;
  const out: Mix = { [buyer]: stay, [home]: (1 - stay) * homeReturn };
  const foreign = (1 - stay) * (1 - homeReturn);
  for (const [key, value] of Object.entries(without(abroad, home))) {
    if (key === buyer) continue;
    out[key as CountryGroup] = (out[key as CountryGroup] ?? 0) + foreign * (value ?? 0);
  }
  return trim(normalize(out), 0.03);
}

function scaleTo(mix: Mix, amount: number): Mix {
  const total = sumMix(mix);
  const out: Mix = {};
  if (total === 0 || amount === 0) return out;
  for (const [key, value] of Object.entries(mix)) {
    const next = amount * ((value ?? 0) / total);
    if (next !== 0) out[key as CountryGroup] = next;
  }
  return out;
}

function emptyTier(id: TierId): Tier {
  if (id === "4+") return { tier: id, va: {}, tax: 0 };
  return { tier: id, output: {}, va: {}, tax: 0, purchases: {} };
}

function buildFingerprint(home: Purchaser, cat: Cat, origin: "domestic" | "imported"): Fingerprint {
  const recipe = RECIPE[cat];
  const tiers: Tier[] = ["0", "1", "2", "3", "4+"].map((id) => emptyTier(id as TierId));
  let output: Mix = origin === "domestic" ? { [home]: 1 } : without(recipe.abroad, home);
  output = trim(normalize(output), 0.025);
  const weights: Mix = {};
  for (let n = 0; n < 4; n += 1) {
    const va: Mix = {};
    const purchases: NonNullable<Tier["purchases"]> = {};
    const next: Mix = {};
    let tax = 0;
    for (const [buyer, amount] of Object.entries(output) as [CountryGroup, number][]) {
      if (!amount) continue;
      let valueAdded = amount * recipe.vaRate;
      let productTax = amount * recipe.taxRate;
      let purchased = amount - valueAdded - productTax;
      if (purchased < 0) {
        productTax += purchased;
        purchased = 0;
      }
      if (valueAdded !== 0) va[buyer] = valueAdded;
      tax += productTax;
      weights[buyer] = (weights[buyer] ?? 0) + amount;
      const sellers = suppliers(buyer, home, recipe.homeKeep, recipe.abroad);
      const scaled = scaleTo(sellers, purchased);
      if (Object.keys(scaled).length > 0) purchases[buyer] = scaled;
      for (const [seller, sold] of Object.entries(scaled) as [CountryGroup, number][]) {
        next[seller] = (next[seller] ?? 0) + sold;
      }
    }
    tiers[n] = { tier: String(n) as TierId, output, va, tax, purchases };
    output = next;
  }
  const tailVa: Mix = {};
  let tailTax = 0;
  const vaShare = recipe.vaRate / (recipe.vaRate + recipe.taxRate);
  for (const [country, amount] of Object.entries(output) as [CountryGroup, number][]) {
    if (!amount) continue;
    const valueAdded = amount * vaShare;
    tailVa[country] = valueAdded;
    tailTax += amount - valueAdded;
    weights[country] = (weights[country] ?? 0) + amount;
  }
  tiers[4] = { tier: "4+", va: tailVa, tax: tailTax };

  const dust = 1 - tiers.reduce((sum, tier) => sum + Object.values(tier.va).reduce<number>((inner, value) => inner + (value ?? 0), 0) + tier.tax, 0);
  if (Math.abs(dust) > 0.005) throw new Error(`fingerprint ${home} ${cat} ${origin} is off by ${dust}`);
  const host = tiers[0].va[home] ?? 0;
  tiers[0].va[home] = host + dust;

  const va: Mix = {};
  let tax = 0;
  for (const tier of tiers) {
    for (const [country, value] of Object.entries(tier.va) as [CountryGroup, number][]) {
      va[country] = (va[country] ?? 0) + value;
    }
    tax += tier.tax;
  }
  const homeVa = va[home] ?? 0;
  const industryWeights = bag<string>(recipe.industry as Record<string, number>);
  const byIndustry: Record<string, number> = {};
  for (const id of INDUSTRIES) byIndustry[id] = homeVa * (industryWeights[id] ?? 0);
  const industryDust = homeVa - Object.values(byIndustry).reduce((sum, value) => sum + value, 0);
  const largest = INDUSTRIES.reduce((best, id) => (byIndustry[id] > byIndustry[best] ? id : best), INDUSTRIES[0]);
  byIndustry[largest] += industryDust;

  const weightTotal = sumMix(weights);
  const co2: Mix = {};
  if (recipe.co2 > 0 && weightTotal > 0) {
    for (const [country, value] of Object.entries(weights) as [CountryGroup, number][]) {
      co2[country] = recipe.co2 * (value / weightTotal);
    }
  }

  const fp: Fingerprint = {
    tiers,
    va,
    tax,
    va_domestic_by_industry: byIndustry,
    co2e_kg: co2,
    jobs_domestic_per_meur: origin === "domestic" ? recipe.jobsDomestic : recipe.jobsImported,
  };
  const problems = fingerprintProblems(fp);
  if (problems.length > 0) throw new Error(`${home} ${cat} ${origin}: ${problems.join("; ")}`);
  return fp;
}

const assumptions: Assumption[] = [];

function assume(entry: Pick<Assumption, "id" | "label" | "unit" | "low" | "central" | "high"> & Partial<Assumption>): void {
  if (!(entry.low <= entry.central && entry.central <= entry.high)) {
    throw new Error(`bad range ${entry.id}`);
  }
  assumptions.push({
    source: "Fixture for layout. Not a measured source.",
    source_accessed: READ,
    source_published: "2026",
    status: "draft",
    note: "Made up so the page can be laid out. These numbers are not real.",
    ...entry,
  });
}

function spread(central: number, width: number, floor = Number.NEGATIVE_INFINITY, cap = Number.POSITIVE_INFINITY): [number, number, number] {
  return [Math.max(floor, central - width), central, Math.min(cap, central + width)];
}

function series(fill: (year: number) => number): number[] {
  return Array.from({ length: YEARS }, (_value, index) => fill(index + 1));
}

function scale(values: number[], factor: number): number[] {
  return values.map((value) => Math.round(value * factor));
}

function refreshYears(step: number): number[] {
  const years = [2];
  let year = 2 + step;
  while (year <= YEARS) {
    years.push(year);
    year += step;
  }
  return years;
}

interface BasePlan {
  spend: Record<CategoryId, number[]>;
  electricity_mwh: number[];
  heat_delivered_mwh: number[];
  heat_pump_mwh: number[];
  heat_pump_spend: number[];
  staff_jobs: number[];
  milestones: { year: number; key: "build" | "first_fit" | "it_refresh" | "midlife_refresh" }[];
}

function basePlan(kind: "ai" | "cloud"): BasePlan {
  const it = kind === "ai" ? 8_000_000 : 3_000_000;
  const power = kind === "ai" ? 1_150_000 : 920_000;
  const mwh = kind === "ai" ? 12_000 : 10_500;
  const payroll = kind === "ai" ? 300_000 : 210_000;
  const jobs = kind === "ai" ? 2.6 : 1.7;
  const refreshes = refreshYears(kind === "ai" ? 4 : 6);
  const spend = {
    construction: series((year) => (year === 1 ? 3_600_000 : year === 2 ? 1_800_000 : 0)),
    electrical: series((year) => (year === 1 || year === 2 ? 1_200_000 : year === 10 ? 960_000 : 0)),
    cooling: series((year) => (year === 1 ? 800_000 : year === 2 ? 650_000 : year === 10 ? 580_000 : 0)),
    it_hardware: series((year) => (refreshes.includes(year) ? it : 0)),
    engineering: series((year) => (year === 1 ? 500_000 : year === 2 ? 280_000 : year === 10 ? 120_000 : 0)),
    electricity: series((year) => (year === 1 ? 50_000 : year === 2 ? 90_000 : year >= 3 ? power : 0)),
    maintenance: series((year) => (year >= 3 ? 200_000 : 0)),
    heat_recovery: series((year) => (year === 2 ? 420_000 : year >= 3 ? 50_000 : 0)),
    staff: series((year) => (year === 1 ? 80_000 : year === 2 ? 140_000 : payroll)),
  };
  return {
    spend,
    electricity_mwh: series((year) => (year === 1 ? 400 : year === 2 ? 700 : mwh)),
    heat_delivered_mwh: series((year) => (year >= 3 ? 4_000 : 0)),
    heat_pump_mwh: series((year) => (year >= 3 ? 900 : 0)),
    heat_pump_spend: series((year) => (year >= 3 ? 110_000 : 0)),
    staff_jobs: series((year) => (year === 1 ? 0.5 : year === 2 ? 0.9 : jobs)),
    milestones: [
      { year: 1, key: "build" },
      { year: 2, key: "build" },
      { year: 2, key: "first_fit" },
      ...refreshes.filter((year) => year !== 2).map((year) => ({ year, key: "it_refresh" as const })),
      { year: 10, key: "midlife_refresh" as const },
    ],
  };
}

const SCENARIO_FACTOR = {
  low_impact: { it_hardware: 1.4, construction: 0.8, engineering: 0.75, electrical: 0.9, cooling: 0.9, staff: 0.65, maintenance: 0.85, heat_recovery: 0.7 },
  central: { it_hardware: 1, construction: 1, engineering: 1, electrical: 1, cooling: 1, staff: 1, maintenance: 1, heat_recovery: 1 },
  high_impact: { it_hardware: 0.75, construction: 1.2, engineering: 1.35, electrical: 1.1, cooling: 1.1, staff: 1.45, maintenance: 1.15, heat_recovery: 1.3 },
} as const;

function meta(): Meta {
  return {
    version: "fixture-1",
    generated_at: "2026-11-10T12:00:00Z",
    fixture: true,
    name: "Zirbe",
    tagline: "Follow the Euro",
    table: {
      name: "Fixture stand-in for the OECD ICIO tables",
      edition: "fixture",
      reference_year: 2022,
      prices: "basic",
      source_id: "fixture.icio",
    },
    datasets: [
      {
        id: "fixture.icio",
        name: "Fixture stand-in for the OECD ICIO tables",
        publisher: "Prismatic Labs",
        edition: "fixture",
        url: "https://example.org/zirbe-fixture-icio",
        accessed: READ,
        license: "Fixture. Not the OECD file.",
      },
      {
        id: "fixture.emissions",
        name: "Fixture stand-in for emissions by industry and country",
        publisher: "Prismatic Labs",
        edition: "fixture",
        url: "https://example.org/zirbe-fixture-emissions",
        accessed: READ,
        license: "Fixture. Not a real emissions file.",
      },
      {
        id: "fixture.employment",
        name: "Fixture stand-in for domestic employment by industry",
        publisher: "Prismatic Labs",
        edition: "fixture",
        url: "https://example.org/zirbe-fixture-employment",
        accessed: READ,
        license: "Fixture. Not a real employment file.",
      },
    ],
    price_year: 2024,
    fx_eur_chf: { value: 0.96, source_id: "fx.eur_chf" },
    tiers: ["0", "1", "2", "3", "4+"],
    country_groups: COUNTRIES.map((id) => ({ id, label: LABELS.country[id] })),
    industry_groups: INDUSTRIES.map((id) => ({ id, label: LABELS.industry[id] })),
    categories: CATEGORIES.map((id) => ({
      id,
      label: LABELS.category[id],
      phase: PHASE[id],
      payer: id === "it_hardware" ? "tenant" as const : "building" as const,
      has_slider: SLIDERS.has(id),
    })),
    sites: SITES.map((site) => ({
      id: site.id,
      label: site.label,
      country: site.country,
      currency: site.currency,
      lat: site.lat,
      lon: site.lon,
      heat_available: site.heat,
      source_ids: [`heat.network.${site.id}`, `grid.kgco2.${site.id}`, `cross_border.${site.id}`],
    })),
  };
}

function fingerprints() {
  const built = { AT: {}, CH: {} } as Record<Purchaser, Record<Cat, {
    default_domestic_share: number;
    domestic_share_low: number;
    domestic_share_high: number;
    domestic: Fingerprint;
    imported: Fingerprint;
    source_ids: string[];
  }>>;
  for (const home of ["AT", "CH"] as const) {
    for (const cat of Object.keys(RECIPE) as Cat[]) {
      const shareId = `domestic.${cat}.${home.toLowerCase()}`;
      const sources = ["fixture.icio", "fixture.employment", shareId, `jobs.${cat}`];
      if (cat !== "electricity") sources.push("fixture.emissions", `co2.${cat}`);
      const central = DOMESTIC[home][cat];
      // The table's own share has no range. IT hardware is the assumption, so it does.
      const [low, , high] = cat === "it_hardware" ? spread(central, 0.08, 0, 1) : [central, central, central];
      built[home][cat] = {
        default_domestic_share: central,
        domestic_share_low: low,
        domestic_share_high: high,
        domestic: buildFingerprint(home, cat, "domestic"),
        imported: buildFingerprint(home, cat, "imported"),
        source_ids: sources,
      };
    }
  }
  const construction = blend(built.AT.construction, built.AT.construction.default_domestic_share);
  const servers = blend(built.AT.it_hardware, built.AT.it_hardware.default_domestic_share);
  if ((construction.va.AT ?? 0) <= (servers.va.AT ?? 0)) {
    throw new Error("construction should keep more value added at home than servers");
  }
  if (built.AT.it_hardware.default_domestic_share >= 0.15) throw new Error("servers should be mostly imported");
  if (built.AT.construction.default_domestic_share <= 0.7) throw new Error("construction should be mostly domestic");
  return built;
}

function sharedSourceIds(site: SiteFact, kind: "ai" | "cloud"): string[] {
  return [
    "capex.construction", "capex.electrical", "capex.cooling", `capex.it_${kind}`, "capex.engineering",
    "capex.heat_recovery", "opex.electricity", "opex.maintenance", "opex.heat_recovery", "opex.heat_pump",
    "payroll.per_mw", `staff.fte_${kind}`, `refresh.${kind}_years`, "midlife.year", "midlife.share",
    `electricity.mwh_${kind}`, "heat.delivered_mwh", "heat.pump_mwh", "heat.displaced_kgco2",
    "contract.kgco2", `grid.kgco2.${site.id}`, `cross_border.${site.id}`,
  ];
}

function lifecycle() {
  const plans = { ai: basePlan("ai"), cloud: basePlan("cloud") };
  const out: Record<string, unknown> = {};
  for (const site of SITES) {
    out[site.id] = {};
    for (const kind of ["ai", "cloud"] as const) {
      const plan = plans[kind];
      const scenarios: Record<string, unknown> = {};
      for (const scenario of ["low_impact", "central", "high_impact"] as const) {
        const factor = SCENARIO_FACTOR[scenario];
        const staffScale = factor.staff * site.staff;
        scenarios[scenario] = {
          spend: {
            construction: scale(plan.spend.construction, factor.construction),
            electrical: scale(plan.spend.electrical, factor.electrical),
            cooling: scale(plan.spend.cooling, factor.cooling * site.cooling),
            it_hardware: scale(plan.spend.it_hardware, factor.it_hardware),
            engineering: scale(plan.spend.engineering, factor.engineering),
            electricity: plan.spend.electricity.slice(),
            maintenance: scale(plan.spend.maintenance, factor.maintenance),
            heat_recovery: scale(plan.spend.heat_recovery, factor.heat_recovery),
            staff: scale(plan.spend.staff, staffScale),
          },
          electricity_mwh: scale(plan.electricity_mwh, site.mwh),
          heat_delivered_mwh: scale(plan.heat_delivered_mwh, site.heatOut),
          heat_pump_mwh: plan.heat_pump_mwh.slice(),
          heat_pump_spend: plan.heat_pump_spend.slice(),
          staff_jobs: plan.staff_jobs.map((value) => Math.round(value * staffScale * 100) / 100),
          grid_kgco2e_per_mwh: site.grid,
          contract_kgco2e_per_mwh: site.contract,
          heat_displaced_kgco2e_per_mwh: site.heatKg,
          cross_border_payroll_share: site.cross,
          milestones: plan.milestones,
          source_ids: sharedSourceIds(site, kind),
        };
      }
      (out[site.id] as Record<string, unknown>)[kind] = scenarios;
    }
  }
  return out;
}

function fillAssumptions(): void {
  const [fxLow, fxMid, fxHigh] = spread(0.96, 0.06, 0.5, 1.5);
  assume({ id: "fx.eur_chf", label: "Francs per euro", unit: "CHF per EUR", low: fxLow, central: fxMid, high: fxHigh, direction: "neutral" });

  const capex: [string, string, number, Assumption["direction"]][] = [
    ["capex.construction", "Construction spend per MW during the build", 5_400_000, "raises"],
    ["capex.electrical", "Electrical kit per MW", 2_400_000, "neutral"],
    ["capex.cooling", "Cooling kit per MW", 1_450_000, "neutral"],
    ["capex.it_ai", "IT hardware per MW for an AI fit-out", 8_000_000, "lowers"],
    ["capex.it_cloud", "IT hardware per MW for a cloud fit-out", 3_000_000, "lowers"],
    ["capex.engineering", "Engineering spend per MW during the build", 780_000, "raises"],
    ["capex.heat_recovery", "Heat pump and network connection per MW", 420_000, "neutral"],
  ];
  for (const [id, label, central, direction] of capex) {
    const [low, mid, high] = spread(central, central * 0.2, 0);
    assume({ id, label, unit: "EUR per MW", low, central: mid, high, direction });
  }
  const opex: [string, string, number][] = [
    ["opex.electricity", "Electricity spend per MW in a typical operating year", 1_150_000],
    ["opex.maintenance", "Maintenance spend per MW in an operating year", 200_000],
    ["opex.heat_recovery", "Heat recovery upkeep per MW in an operating year", 50_000],
    ["opex.heat_pump", "Heat pump electricity spend per MW in an operating year", 110_000],
    ["payroll.per_mw", "Direct payroll per MW in an operating year", 300_000],
  ];
  for (const [id, label, central] of opex) {
    const [low, mid, high] = spread(central, central * 0.25, 0);
    assume({
      id, label, unit: "EUR per MW per year", low, central: mid, high,
      direction: id === "payroll.per_mw" ? "raises" : "neutral",
    });
  }
  assume({ id: "staff.fte_ai", label: "Staff per MW for AI, operating years", unit: "jobs per MW", low: 1.8, central: 2.6, high: 3.4, direction: "neutral" });
  assume({ id: "staff.fte_cloud", label: "Staff per MW for cloud, operating years", unit: "jobs per MW", low: 1.1, central: 1.7, high: 2.3, direction: "neutral" });
  assume({ id: "refresh.ai_years", label: "Years between AI hardware refreshes", unit: "years", low: 3, central: 4, high: 5, direction: "raises" });
  assume({ id: "refresh.cloud_years", label: "Years between cloud hardware refreshes", unit: "years", low: 5, central: 6, high: 8, direction: "raises" });
  assume({ id: "midlife.year", label: "Year of the mid-life electrical and cooling refresh", unit: "years", low: 8, central: 10, high: 12, direction: "neutral" });
  assume({ id: "midlife.share", label: "Share of electrical and cooling kit replaced at mid-life", unit: "share", low: 0.25, central: 0.4, high: 0.55, direction: "neutral" });
  assume({ id: "electricity.mwh_ai", label: "Electricity use per MW for AI in an operating year", unit: "MWh per MW", low: 10_000, central: 12_000, high: 14_000, direction: "neutral" });
  assume({ id: "electricity.mwh_cloud", label: "Electricity use per MW for cloud in an operating year", unit: "MWh per MW", low: 8_500, central: 10_500, high: 12_500, direction: "neutral" });
  assume({ id: "heat.delivered_mwh", label: "Heat delivered per MW when recovery is on", unit: "MWh per MW", low: 2_500, central: 4_000, high: 5_500, direction: "neutral" });
  assume({ id: "heat.pump_mwh", label: "Extra electricity for heat pumps per MW", unit: "MWh per MW", low: 600, central: 900, high: 1_300, direction: "neutral" });
  assume({ id: "heat.displaced_kgco2", label: "Greenhouse gases displaced per MWh of heat delivered", unit: "kg CO2e per MWh", low: 140, central: 210, high: 280, direction: "neutral" });
  assume({ id: "contract.kgco2", label: "Market-based factor for a renewable contract", unit: "kg CO2e per MWh", low: 8, central: 20, high: 40, direction: "neutral" });

  for (const site of SITES) {
    const [glow, gmid, ghigh] = spread(site.grid, Math.max(10, site.grid * 0.25), 0);
    assume({ id: `grid.kgco2.${site.id}`, label: `Grid average factor, ${site.label}`, unit: "kg CO2e per MWh", low: glow, central: gmid, high: ghigh, direction: "neutral" });
    const [clow, cmid, chigh] = spread(site.cross, 0.08, 0, 1);
    assume({ id: `cross_border.${site.id}`, label: `Cross-border share of payroll, ${site.label}`, unit: "share", low: clow, central: cmid, high: chigh, direction: "neutral" });
    assume({
      id: `heat.network.${site.id}`,
      label: `Suitable heat network, ${site.label}`,
      unit: "yes or no",
      low: 0,
      central: site.heat ? 1 : 0,
      high: 1,
      direction: "neutral",
    });
  }
  for (const home of ["AT", "CH"] as const) {
    for (const cat of Object.keys(DOMESTIC.AT) as Cat[]) {
      const central = DOMESTIC[home][cat];
      const [low, mid, high] = spread(central, 0.08, 0, 1);
      assume({
        id: `domestic.${cat}.${home.toLowerCase()}`,
        label: `Domestic share of ${LABELS.category[cat]}, ${home === "AT" ? "Austria" : "Switzerland"}`,
        unit: "share",
        low, central: mid, high,
        direction: "raises",
      });
    }
  }
  for (const cat of Object.keys(RECIPE) as Cat[]) {
    const jobs = RECIPE[cat].jobsDomestic;
    const [low, mid, high] = spread(jobs, jobs * 0.25, 0);
    assume({ id: `jobs.${cat}`, label: `Domestic jobs per million euros, ${LABELS.category[cat]}`, unit: "job-years per million EUR", low, central: mid, high, direction: "neutral" });
    if (cat === "electricity") continue;
    const co2 = RECIPE[cat].co2;
    const [cLow, cMid, cHigh] = spread(co2, Math.max(0.02, co2 * 0.3), 0);
    assume({ id: `co2.${cat}`, label: `Embodied greenhouse gases per euro, ${LABELS.category[cat]}`, unit: "kg CO2e per EUR", low: cLow, central: cMid, high: cHigh, direction: "neutral" });
  }
  assume({
    id: "staff.domestic_va",
    label: "Payroll counted as value added at home",
    unit: "share",
    low: 1, central: 1, high: 1,
    direction: "raises",
    note: "Payroll is the operator's own value added. The fixture keeps this at one.",
  });
}

function write(name: string, value: unknown): void {
  writeFileSync(resolve(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

fillAssumptions();
const fp = fingerprints();
mkdirSync(outDir, { recursive: true });
write("meta.json", meta());
write("fingerprints.json", fp);
write("lifecycle.json", lifecycle());
write("assumptions.json", assumptions);
