import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  Assumptions,
  CategoryId,
  Dataset,
  Fingerprint,
  Fingerprints,
  Lifecycle,
  Meta,
  Schedule,
} from "../data/types";
import { blend } from "./blend";
import { vaPlusTax } from "./checks";
import { compute } from "./compute";
import { present } from "./present";
import { defaultState, type ViewState } from "./state";

const webRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

function readData(): Dataset {
  const dir = resolve(webRoot, "public/data");
  const load = <T>(name: string) => JSON.parse(readFileSync(resolve(dir, name), "utf8")) as T;
  return {
    meta: load<Meta>("meta.json"),
    fingerprints: load<Fingerprints>("fingerprints.json"),
    lifecycle: load<Lifecycle>("lifecycle.json"),
    assumptions: load<Assumptions>("assumptions.json"),
  };
}

function industries(home: number): Record<string, number> {
  return {
    construction: home,
    electrical_machinery: 0,
    electronics: 0,
    metals_mining: 0,
    energy: 0,
    transport_logistics: 0,
    trade: 0,
    business_services: 0,
    it_services: 0,
    other: 0,
  };
}

/** Value added at home is 0.55. Value added plus taxes is 1. */
function handFingerprint(): Fingerprint {
  return {
    tiers: [
      { tier: "0", output: { AT: 1 }, va: { AT: 0.5 }, tax: 0.1, purchases: { AT: { DE: 0.4 } } },
      { tier: "1", output: { DE: 0.4 }, va: { DE: 0.2 }, tax: 0.05, purchases: { DE: { AT: 0.15 } } },
      { tier: "2", output: { AT: 0.15 }, va: { AT: 0.05 }, tax: 0.02, purchases: { AT: { CN: 0.08 } } },
      { tier: "3", output: { CN: 0.08 }, va: { CN: 0.03 }, tax: 0.01, purchases: { CN: { CN: 0.04 } } },
      { tier: "4+", va: { CN: 0.03 }, tax: 0.01 },
    ],
    va: { AT: 0.55, DE: 0.2, CN: 0.06 },
    tax: 0.19,
    va_domestic_by_industry: industries(0.55),
    co2e_kg: {},
    jobs_domestic_per_meur: 10,
  };
}

function flat(homeShare: number, co2 = 0, jobs = 0): Fingerprint {
  return {
    tiers: [
      { tier: "0", output: { AT: 1 }, va: { AT: homeShare }, tax: 1 - homeShare, purchases: {} },
      { tier: "1", output: {}, va: {}, tax: 0, purchases: {} },
      { tier: "2", output: {}, va: {}, tax: 0, purchases: {} },
      { tier: "3", output: {}, va: {}, tax: 0, purchases: {} },
      { tier: "4+", va: {}, tax: 0 },
    ],
    va: { AT: homeShare },
    tax: 1 - homeShare,
    va_domestic_by_industry: industries(homeShare),
    co2e_kg: co2 === 0 ? {} : { AT: co2 },
    jobs_domestic_per_meur: jobs,
  };
}

function pair(fp: Fingerprint, share = 1, imported = fp, low = share, high = share) {
  return {
    default_domestic_share: share,
    domestic_share_low: low,
    domestic_share_high: high,
    domestic: fp,
    imported,
    source_ids: ["fixture.icio"],
  };
}

function zeros(): number[] {
  return Array.from({ length: 20 }, () => 0);
}

function schedule(patch: Partial<Schedule> = {}): Schedule {
  const spend = {} as Schedule["spend"];
  for (const id of ["construction", "electrical", "cooling", "it_hardware", "engineering", "electricity", "maintenance", "heat_recovery", "staff"] as CategoryId[]) {
    spend[id] = zeros();
  }
  const base: Schedule = {
    spend,
    electricity_mwh: zeros(),
    heat_delivered_mwh: zeros(),
    heat_pump_mwh: zeros(),
    heat_pump_spend: zeros(),
    staff_jobs: zeros(),
    grid_kgco2e_per_mwh: 100,
    contract_kgco2e_per_mwh: 20,
    heat_displaced_kgco2e_per_mwh: 50,
    cross_border_payroll_share: 0.2,
    milestones: [{ year: 1, key: "build" }, { year: 2, key: "build" }],
    source_ids: ["fixture.icio"],
  };
  return { ...base, ...patch, spend: { ...spend, ...patch.spend } };
}

function dataset(life: Schedule, books?: Partial<Fingerprints["AT"]>): Dataset {
  const fingerprints = {
    construction: pair(handFingerprint()),
    electrical: pair(flat(0)),
    cooling: pair(flat(0)),
    it_hardware: pair(flat(0)),
    engineering: pair(flat(0)),
    electricity: pair(flat(0.5, 9, 0)),
    maintenance: pair(flat(0)),
    heat_recovery: pair(flat(1, 0.2, 0)),
    ...books,
  };
  const one = { low_impact: life, central: life, high_impact: life };
  const meta: Meta = {
    version: "test",
    generated_at: "2026-01-01T00:00:00Z",
    fixture: true,
    name: "Zirbe",
    tagline: "Follow the Euro",
    table: { name: "Test", edition: "test", reference_year: 2022, prices: "basic", source_id: "fixture.icio" },
    datasets: [{ id: "fixture.icio", name: "Test", publisher: "Test", edition: "test", url: "https://example.org/t", accessed: "2026-01-01" }],
    price_year: 2024,
    fx_eur_chf: { value: 0.9, source_id: "fx.eur_chf" },
    tiers: ["0", "1", "2", "3", "4+"],
    country_groups: [{ id: "AT", label: "Austria" }],
    industry_groups: [{ id: "construction", label: "Construction" }],
    categories: (["construction", "electrical", "cooling", "it_hardware", "engineering", "electricity", "maintenance", "heat_recovery", "staff"] as CategoryId[]).map((id) => ({
      id,
      label: id,
      phase: id === "electricity" || id === "maintenance" || id === "staff" ? "operating" as const : "capital" as const,
      payer: id === "it_hardware" ? "tenant" as const : "building" as const,
      has_slider: id === "electrical" || id === "cooling" || id === "it_hardware",
    })),
    sites: [
      { id: "vienna", label: "Vienna", country: "AT", currency: "EUR", lat: 48, lon: 16, heat_available: true, source_ids: ["fixture.icio"] },
      { id: "innsbruck", label: "Innsbruck", country: "AT", currency: "EUR", lat: 47, lon: 11, heat_available: false, source_ids: ["fixture.icio"] },
      { id: "linz", label: "Linz", country: "AT", currency: "EUR", lat: 48, lon: 14, heat_available: true, source_ids: ["fixture.icio"] },
      { id: "zurich", label: "Zurich", country: "CH", currency: "CHF", lat: 47, lon: 8, heat_available: true, source_ids: ["fixture.icio"] },
      { id: "geneva", label: "Geneva", country: "CH", currency: "CHF", lat: 46, lon: 6, heat_available: true, source_ids: ["fixture.icio"] },
      { id: "lugano", label: "Lugano", country: "CH", currency: "CHF", lat: 46, lon: 9, heat_available: false, source_ids: ["fixture.icio"] },
    ],
  };
  const lifecycle = {
    vienna: { ai: one, cloud: one },
    innsbruck: { ai: one, cloud: one },
    linz: { ai: one, cloud: one },
    zurich: { ai: one, cloud: one },
    geneva: { ai: one, cloud: one },
    lugano: { ai: one, cloud: one },
  } as Lifecycle;
  return {
    meta,
    fingerprints: { AT: fingerprints, CH: fingerprints },
    lifecycle,
    assumptions: [{
      id: "fx.eur_chf", label: "Francs", unit: "CHF per EUR", low: 0.8, central: 0.9, high: 1,
      source: "Fixture", source_accessed: "2026-01-01", status: "draft",
    }],
  };
}

function state(patch: Partial<ViewState> = {}): ViewState {
  return {
    site: "vienna",
    archetype: "ai",
    scenario: "central",
    sizeMw: 2,
    year: 20,
    sourcing: { electrical: 1, cooling: 1, it_hardware: 1 },
    heat: false,
    servers: "own",
    electricityView: "grid",
    currency: "EUR",
    ...patch,
  };
}

describe("blend", () => {
  it("keeps value added plus taxes at one", () => {
    const data = readData();
    for (const home of ["AT", "CH"] as const) {
      for (const pair of Object.values(data.fingerprints[home])) {
        for (const share of [0, 0.37, pair.default_domestic_share, 1]) {
          const mixed = blend(pair, share);
          expect(Math.abs(vaPlusTax(mixed) - 1)).toBeLessThan(0.005);
        }
      }
    }
  });
});

describe("compute", () => {
  it("matches a headline worked out by hand at year 20", () => {
    const life = schedule();
    life.spend.construction[0] = 1000;
    const result = compute(dataset(life), state());
    // 1000 euros per MW times 2 MW, and 0.55 of that is value added at home.
    expect(result.spendEur).toBe(2000);
    expect(result.domesticVaEur).toBeCloseTo(1100);
    expect(result.headlineShare).toBeCloseTo(0.55);
  });

  it("changes only the heat terms when heat recovery is switched on", () => {
    const life = schedule();
    life.spend.electricity[2] = 80;
    life.spend.heat_recovery[2] = 100;
    life.spend.staff[2] = 30;
    life.staff_jobs[2] = 2;
    life.electricity_mwh[2] = 5;
    life.heat_pump_mwh[2] = 4;
    life.heat_pump_spend[2] = 40;
    life.heat_delivered_mwh[2] = 10;
    const data = dataset(life);
    const off = compute(data, state({ sizeMw: 1, heat: false }));
    const on = compute(data, state({ sizeMw: 1, heat: true }));
    expect(on.payrollEur).toBe(off.payrollEur);
    expect(on.crossBorderShare).toBe(off.crossBorderShare);
    expect(on.constructionJobs).toBe(off.constructionJobs);
    expect(on.ongoingJobs).toBe(off.ongoingJobs);
    expect(on.spendEur - off.spendEur).toBeCloseTo(140);
    expect(on.domesticVaEur - off.domesticVaEur).toBeCloseTo(120);
    expect(on.embodiedKg - off.embodiedKg).toBeCloseTo(20);
    expect(on.operationalKg - off.operationalKg).toBeCloseTo(400);
    expect(off.heatOffsetKg).toBe(0);
    expect(on.heatOffsetKg).toBeCloseTo(500);
    expect(off.embodiedKg).toBe(0);
  });

  it("keeps heat off where the site has no network", () => {
    const life = schedule();
    life.spend.heat_recovery[2] = 100;
    const data = dataset(life);
    const forced = compute(data, state({ site: "innsbruck", sizeMw: 1, heat: true }));
    expect(forced.heatOn).toBe(false);
    expect(forced.spendEur).toBe(0);
  });

  it("changes amounts and not shares when the currency changes", () => {
    const life = schedule();
    life.spend.construction[0] = 1000;
    life.spend.staff[0] = 250;
    const data = dataset(life);
    const euros = present(data, state({ currency: "EUR", sizeMw: 1 }), compute(data, state({ currency: "EUR", sizeMw: 1 })), { playing: false, reduced: true });
    const francs = present(data, state({ currency: "CHF", sizeMw: 1 }), compute(data, state({ currency: "CHF", sizeMw: 1 })), { playing: false, reduced: true });
    expect(francs.headlineCents).toBe(euros.headlineCents);
    expect(francs.headlineRest).not.toBe(euros.headlineRest);
    expect(francs.panels.countries.rows.map((row) => row.share)).toEqual(euros.panels.countries.rows.map((row) => row.share));
    expect(francs.panels.payroll.figure).not.toBe(euros.panels.payroll.figure);
    const euroShare = euros.panels.payroll.pieces.find((piece) => piece.key === "cross")?.text ?? "";
    const francShare = francs.panels.payroll.pieces.find((piece) => piece.key === "cross")?.text ?? "";
    expect(francShare.startsWith(euroShare.split(",")[0] ?? "missing")).toBe(true);
  });

  it("opens a dataset and an assumption cited by the same number", () => {
    const data = dataset(schedule());
    data.meta.datasets.push({
      id: "cepii_baci",
      name: "CEPII BACI",
      publisher: "CEPII",
      edition: "fixture",
      url: "https://example.org/zirbe-fixture-baci",
      accessed: "2026-01-01",
    });
    const share = (id: string, label: string) => ({
      id,
      label,
      unit: "share",
      low: 0,
      central: 0.07,
      high: 0.2,
      source: "Fixture",
      source_accessed: "2026-01-01",
      status: "draft" as const,
    });
    data.assumptions.push(
      share("it_hardware.domestic_share.at", "Domestic share of IT hardware, Austria"),
      share("it_hardware.domestic_share.ch", "Domestic share of IT hardware, Switzerland"),
    );
    const hardware = data.fingerprints.AT.it_hardware;
    data.fingerprints.AT = {
      ...data.fingerprints.AT,
      it_hardware: { ...hardware, source_ids: ["cepii_baci", "it_hardware.domestic_share.at"] },
    };
    data.fingerprints.CH = {
      ...data.fingerprints.CH,
      it_hardware: { ...hardware, source_ids: ["cepii_baci", "it_hardware.domestic_share.ch"] },
    };
    const flags = { playing: false, reduced: true };
    const austria = present(data, state(), compute(data, state()), flags);
    const austrianCards = austria.explanations["slider:it_hardware"]?.sources ?? [];
    expect(austrianCards.map((card) => card.title)).toEqual([
      "CEPII BACI",
      "Domestic share of IT hardware, Austria",
    ]);
    expect(austrianCards[0]?.url).toBe("https://example.org/zirbe-fixture-baci");
    expect(austrianCards[1]?.draft).toBe(true);
    expect(austrianCards.some((card) => card.lines.some((line) => line.text.includes("No entry")))).toBe(false);

    const swissState = state({ site: "zurich", currency: "CHF" });
    const swiss = present(data, swissState, compute(data, swissState), flags);
    expect(swiss.explanations["slider:it_hardware"]?.sources.map((card) => card.title)).toEqual([
      "CEPII BACI",
      "Domestic share of IT hardware, Switzerland",
    ]);
  });

  it("uses the low and high domestic shares until a sourcing slider moves", () => {
    const life = schedule();
    life.spend.it_hardware[0] = 1000;
    const data = dataset(life, {
      it_hardware: pair(flat(1), 0.4, flat(0), 0.1, 0.9),
    });
    const resting = state({
      sizeMw: 1,
      sourcing: { electrical: 1, cooling: 1, it_hardware: 0.4 },
    });
    const open = compute(data, resting);
    expect(open.headlineShare).toBeCloseTo(0.4);
    expect(open.bandLowShare).toBeCloseTo(0.1);
    expect(open.bandHighShare).toBeCloseTo(0.9);

    const moved = compute(data, {
      ...resting,
      sourcing: { ...resting.sourcing, it_hardware: 0.25 },
    });
    expect(moved.headlineShare).toBeCloseTo(0.25);
    expect(moved.bandLowShare).toBeCloseTo(0.25);
    expect(moved.bandHighShare).toBeCloseTo(0.25);
  });

  it("keeps tier 0, the headline and the added-up bar on one scale", () => {
    const life = schedule();
    life.spend.construction[0] = 1000;
    const result = compute(dataset(life), state({ sizeMw: 1 }));
    const tier0 = result.tiers[0];
    expect(tier0).toBeTruthy();
    expect(Math.abs((tier0.outputHome + tier0.outputAbroad) / result.spendEur - 1)).toBeLessThan(1e-9);
    const vaHome = result.tiers.reduce((sum, tier) => sum + tier.vaHome, 0);
    expect(Math.abs(vaHome / result.spendEur - result.headlineShare)).toBeLessThan(1e-9);
    const added = result.tiers.reduce((sum, tier) => sum + tier.vaHome + tier.vaAbroad + tier.tax, 0);
    expect(Math.abs(added / result.spendEur - 1)).toBeLessThan(0.005);
  });

  it("matches the engine headlines for Vienna and Zurich with heat off", () => {
    const data = readData();
    const cents = (site: "vienna" | "zurich", year: number) => {
      const view = state({
        site,
        sizeMw: 1,
        year,
        heat: false,
        currency: site === "vienna" ? "EUR" : "CHF",
        sourcing: { electrical: 1, cooling: 1, it_hardware: 1 },
      });
      view.sourcing = {
        electrical: data.fingerprints[site === "vienna" ? "AT" : "CH"].electrical.default_domestic_share,
        cooling: data.fingerprints[site === "vienna" ? "AT" : "CH"].cooling.default_domestic_share,
        it_hardware: data.fingerprints[site === "vienna" ? "AT" : "CH"].it_hardware.default_domestic_share,
      };
      const result = compute(data, view);
      return Math.round(result.headlineShare * 1000) / 10;
    };
    expect(cents("vienna", 2)).toBe(43.2);
    expect(cents("vienna", 20)).toBe(14.3);
    expect(cents("zurich", 2)).toBe(51.4);
    expect(cents("zurich", 20)).toBe(19.4);
  });

  it("runs in under 16 ms on the full fixture", () => {
    const data = readData();
    const view = defaultState(data);
    compute(data, view);
    const samples: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      const start = performance.now();
      compute(data, view);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    expect(samples[5]).toBeLessThan(16);
  });
});
