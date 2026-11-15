import type {
  CategoryId,
  CountryGroup,
  Dataset,
  Fingerprint,
  Purchaser,
  Schedule,
} from "../data/types";
import { blend } from "./blend";
import { headlineDrivers, type Driver } from "./drivers";
import { hasSlider, readerShare, SAME_SHARE, type ViewState } from "./state";
import { staffFingerprint } from "./staff";

/** Years 1 and 2 are the build. Operations run from year 3. */
const FIRST_YEAR = 1;
const BUILD_LAST_YEAR = 2;
/** How many years the build takes, for copy that spreads its job-years over them. */
export const BUILD_YEARS = BUILD_LAST_YEAR - FIRST_YEAR + 1;
const OPERATIONS_FIRST_YEAR = 3;
const MILLION = 1_000_000;

export interface Bucket {
  id: string;
  eur: number;
}

export interface Result {
  heatOn: boolean;
  spendEur: number;
  domesticVaEur: number;
  headlineShare: number;
  bandLowShare: number;
  bandHighShare: number;
  /** Each assumption moved alone, largest effect on the headline first. */
  drivers: Driver[];
  countries: Bucket[];
  industries: Bucket[];
  constructionJobs: number;
  ongoingJobs: number | null;
  /** Value added at home in an average year of operation. */
  ongoingVaEur: number | null;
  /** Value added at home per euro of ordinary building work, for comparison. */
  buildEuroShare: number;
  embodiedKg: number;
  operationalKg: number;
  heatOffsetKg: number;
  payrollEur: number;
  crossBorderShare: number;
  headlineSourceIds: string[];
  jobsSourceIds: string[];
  carbonSourceIds: string[];
  payrollSourceIds: string[];
  tiers: TierCents[];
  tierSourceIds: string[][];
  shareByYear: number[];
  bandLowByYear: number[];
  bandHighByYear: number[];
}

export interface TierCents {
  outputHome: number;
  outputAbroad: number;
  vaHome: number;
  vaAbroad: number;
  passHome: number;
  passAbroad: number;
  taxHome: number;
  taxAbroad: number;
  tax: number;
}

interface CategoryFlow {
  id: CategoryId;
  spend: number;
  sourceIds: string[];
  adjusted: boolean;
}

const BUILD_IDS = new Set([
  "liquid_cooling_premium",
  "installation_share",
  "engineering_share",
  "build_share_year1",
]);

function isBuildId(id: string): boolean {
  return id.startsWith("facility_capex_per_mw.") || id.startsWith("capex_share.") || BUILD_IDS.has(id);
}

function isMidlifeId(id: string): boolean {
  return id === "midlife_refresh_year" || id === "midlife_refresh_share";
}

function isItId(id: string): boolean {
  return id.startsWith("it_capex_per_mw.") || id.startsWith("it_refresh_years.");
}

function isElectricityId(id: string): boolean {
  return id.startsWith("electricity_price.") || id.startsWith("it_load_factor.") || id.startsWith("pue.");
}

function isStaffId(id: string): boolean {
  return id === "staff_per_mw" || id.startsWith("payroll_per_job.");
}

function isHeatCapexId(id: string): boolean {
  return id === "heat_recovery_share" || id === "heat_pump_capex_per_mw_heat" || id === "heat_connection_capex_per_mw";
}

function isHeatPumpId(id: string): boolean {
  return id === "heat_recovery_share" || id === "heat_pump_cop";
}

function isKnownSpecific(id: string): boolean {
  return (
    isBuildId(id)
    || isMidlifeId(id)
    || isItId(id)
    || isElectricityId(id)
    || id === "maintenance_share"
    || isStaffId(id)
    || isHeatCapexId(id)
    || isHeatPumpId(id)
    || id === "heat_recovery_upkeep_share"
    || id.startsWith("cross_border_share.")
    || id.startsWith("grid_factor.")
    || id === "contract_factor"
    || id === "heat_displaced_factor"
  );
}

function categoryScheduleIds(
  categoryId: CategoryId,
  scheduleIds: string[],
  heatOn: boolean,
  selectedYear: number,
): string[] {
  return scheduleIds.filter((id) => {
    if (!isKnownSpecific(id)) return true;
    switch (categoryId) {
      case "construction":
      case "engineering":
        return isBuildId(id);
      case "electrical":
      case "cooling":
        return isBuildId(id) || (selectedYear >= OPERATIONS_FIRST_YEAR && isMidlifeId(id));
      case "it_hardware":
        return isItId(id);
      case "electricity":
        return isElectricityId(id) || (heatOn && isHeatPumpId(id));
      case "maintenance":
        return id.startsWith("facility_capex_per_mw.") || id === "liquid_cooling_premium" || id === "maintenance_share";
      case "staff":
        return isStaffId(id);
      case "heat_recovery":
        return isHeatCapexId(id) || (selectedYear >= OPERATIONS_FIRST_YEAR && id === "heat_recovery_upkeep_share");
    }
  });
}

function emptyTier(): TierCents {
  return {
    outputHome: 0, outputAbroad: 0, vaHome: 0, vaAbroad: 0,
    passHome: 0, passAbroad: 0, taxHome: 0, taxAbroad: 0, tax: 0,
  };
}

function addTier(into: TierCents, tier: Fingerprint["tiers"][number], home: Purchaser, spend: number): void {
  let outputHome = 0;
  let outputAbroad = 0;
  for (const [country, value] of Object.entries(tier.output ?? {}) as [CountryGroup, number][]) {
    const amount = (value ?? 0) * spend;
    if (country === home) outputHome += amount;
    else outputAbroad += amount;
  }
  let vaHome = 0;
  let vaAbroad = 0;
  for (const [country, value] of Object.entries(tier.va) as [CountryGroup, number][]) {
    const amount = (value ?? 0) * spend;
    if (country === home) vaHome += amount;
    else vaAbroad += amount;
  }
  let passHome = 0;
  let passAbroad = 0;
  for (const [buyer, sellers] of Object.entries(tier.purchases ?? {}) as [CountryGroup, Partial<Record<CountryGroup, number>>][]) {
    let sum = 0;
    for (const amount of Object.values(sellers ?? {})) sum += amount ?? 0;
    const scaled = sum * spend;
    if (buyer === home) passHome += scaled;
    else passAbroad += scaled;
  }
  into.outputHome += outputHome;
  into.outputAbroad += outputAbroad;
  into.vaHome += vaHome;
  into.vaAbroad += vaAbroad;
  into.passHome += passHome;
  into.passAbroad += passAbroad;
  into.tax += tier.tax * spend;
  if (tier.tier !== "4+") {
    into.taxHome += outputHome - vaHome - passHome;
    into.taxAbroad += outputAbroad - vaAbroad - passAbroad;
  }
}

interface Run {
  spendEur: number;
  domesticVaEur: number;
  countries: Map<CountryGroup, number>;
  industries: Map<string, number>;
  constructionJobs: number;
  operatingYearJobs: number[];
  ongoingVaEur: number | null;
  buildEuroShare: number;
  embodiedKg: number;
  operationalKg: number;
  heatOffsetKg: number;
  payrollEur: number;
  crossBorderShare: number;
  categories: CategoryFlow[];
  sourceIds: Set<string>;
  ongoingJobs: number | null;
  tiers: TierCents[];
  tierSourceIds: string[][];
  shareByYear: number[];
}

interface ReadyCategory {
  category: Dataset["meta"]["categories"][number];
  flow: CategoryFlow;
  fp: Fingerprint;
}

function domesticShare(
  data: Dataset,
  pair: Dataset["fingerprints"]["AT"]["construction"],
  categoryId: CategoryId,
  state: ViewState,
  scenario: ViewState["scenario"],
): number {
  const chosen = readerShare(data, pair, categoryId, state);
  if (chosen !== null) return chosen;
  if (scenario === "low_impact") return pair.domestic_share_low;
  if (scenario === "high_impact") return pair.domestic_share_high;
  return pair.default_domestic_share;
}

function run(
  data: Dataset,
  state: ViewState,
  schedule: Schedule,
  home: Purchaser,
  heatOn: boolean,
  detail: boolean,
  scenario: ViewState["scenario"],
): Run {
  const flows = new Map<CategoryId, CategoryFlow>();
  for (const category of data.meta.categories) {
    flows.set(category.id, {
      id: category.id,
      spend: 0,
      sourceIds: [],
      adjusted: false,
    });
  }

  const countries = new Map<CountryGroup, number>();
  const industries = new Map<string, number>();
  let spendEur = 0;
  let domesticVaEur = 0;
  let constructionJobs = 0;
  const operatingYearJobs: number[] = [];
  const operatingYearVa: number[] = [];
  let embodiedKg = 0;
  let operationalKg = 0;
  let heatOffsetKg = 0;
  let payrollEur = 0;
  const sourceIds = new Set<string>();

  const factor = state.electricityView === "contract"
    ? schedule.contract_kgco2e_per_mwh
    : schedule.grid_kgco2e_per_mwh;
  const horizon = schedule.spend.construction.length;
  const selected = Math.min(state.year, horizon);
  const tiers = [emptyTier(), emptyTier(), emptyTier(), emptyTier(), emptyTier()];
  const tierSources = [new Set<string>(), new Set<string>(), new Set<string>(), new Set<string>(), new Set<string>()];
  const shareByYear: number[] = [];
  let seenSpend = 0;
  let seenVa = 0;
  const ready: ReadyCategory[] = [];
  for (const category of data.meta.categories) {
    const flow = flows.get(category.id);
    if (!flow) continue;
    // A tenant's own kit is not the reader's spend, so it leaves every figure.
    if (state.servers === "tenant" && category.payer === "tenant") continue;
    let fp: Fingerprint;
    let adjusted = false;
    const catScheduleIds = categoryScheduleIds(category.id, schedule.source_ids, heatOn, selected);
    if (category.id === "staff") {
      fp = staffFingerprint(home);
      flow.sourceIds = unique(catScheduleIds);
    } else {
      const pair = data.fingerprints[home][category.id];
      const share = domesticShare(data, pair, category.id, state, scenario);
      adjusted = hasSlider(data, category.id) && Math.abs(state.sourcing[category.id] - pair.default_domestic_share) > SAME_SHARE;
      fp = blend(pair, share);
      flow.sourceIds = unique(catScheduleIds.concat(pair.source_ids));
    }
    flow.adjusted = adjusted;
    ready.push({
      category,
      flow,
      fp,
    });
  }

  for (let year = FIRST_YEAR; year <= horizon; year += 1) {
    const index = year - FIRST_YEAR;
    const inPicture = year <= selected;
    let yearJobs = schedule.staff_jobs[index] * state.sizeMw;
    let yearVa = 0;
    for (const item of ready) {
      const { category, flow, fp } = item;
      let perMw = schedule.spend[category.id][index];
      if (category.id === "heat_recovery" && !heatOn) perMw = 0;
      if (category.id === "electricity" && heatOn) perMw += schedule.heat_pump_spend[index];
      const spend = perMw * state.sizeMw;
      if (spend === 0) continue;
      const jobs = (spend / MILLION) * fp.jobs_domestic_per_meur;
      seenSpend += spend;
      seenVa += (fp.va[home] ?? 0) * spend;
      yearVa += (fp.va[home] ?? 0) * spend;
      if (detail && year <= BUILD_LAST_YEAR && category.phase === "capital") constructionJobs += jobs;
      if (detail && year >= OPERATIONS_FIRST_YEAR) yearJobs += jobs;
      if (!inPicture) continue;
      flow.spend += spend;
      spendEur += spend;
      if (category.id === "staff") payrollEur += spend;
      domesticVaEur += (fp.va[home] ?? 0) * spend;
      if (!detail) continue;
      for (const [country, value] of Object.entries(fp.va) as [CountryGroup, number][]) {
        countries.set(country, (countries.get(country) ?? 0) + value * spend);
      }
      for (const [industry, value] of Object.entries(fp.va_domestic_by_industry)) {
        industries.set(industry, (industries.get(industry) ?? 0) + value * spend);
      }
      if (category.id !== "electricity") {
        for (const value of Object.values(fp.co2e_kg)) embodiedKg += (value ?? 0) * spend;
      }
      fp.tiers.forEach((tier, tierIndex) => {
        addTier(tiers[tierIndex], tier, home, spend);
        for (const id of flow.sourceIds) tierSources[tierIndex].add(id);
      });
    }
    shareByYear.push(seenSpend > 0 ? seenVa / seenSpend : 0);
    if (detail && year >= OPERATIONS_FIRST_YEAR) {
      operatingYearJobs.push(yearJobs);
      operatingYearVa.push(yearVa);
    }
    if (!detail || !inPicture) continue;
    let mwh = schedule.electricity_mwh[index] * state.sizeMw;
    if (heatOn) {
      mwh += schedule.heat_pump_mwh[index] * state.sizeMw;
      heatOffsetKg += schedule.heat_delivered_mwh[index] * state.sizeMw * schedule.heat_displaced_kgco2e_per_mwh;
    }
    operationalKg += mwh * factor;
  }

  for (const item of ready) {
    if (item.flow.spend <= 0) continue;
    for (const id of item.flow.sourceIds) sourceIds.add(id);
  }
  if (sourceIds.size === 0) {
    for (const id of schedule.source_ids) sourceIds.add(id);
  }

  const ongoingJobs = operatingYearJobs.length
    ? operatingYearJobs.reduce((sum, value) => sum + value, 0) / operatingYearJobs.length
    : null;

  return {
    spendEur,
    domesticVaEur,
    countries,
    industries,
    constructionJobs,
    operatingYearJobs,
    ongoingVaEur: operatingYearVa.length ? operatingYearVa.reduce((sum, value) => sum + value, 0) / operatingYearVa.length : null,
    buildEuroShare: blend(data.fingerprints[home].construction, data.fingerprints[home].construction.default_domestic_share).va[home] ?? 0,
    embodiedKg,
    operationalKg,
    heatOffsetKg,
    payrollEur,
    crossBorderShare: schedule.cross_border_payroll_share,
    categories: [...flows.values()].filter((flow) => flow.spend > 0),
    sourceIds,
    ongoingJobs,
    tiers,
    tierSourceIds: tierSources.map((ids) => [...ids]),
    shareByYear,
  };
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function headline(runResult: Run): number {
  return runResult.spendEur > 0 ? runResult.domesticVaEur / runResult.spendEur : 0;
}

function buckets(map: Map<string, number>): Bucket[] {
  return [...map.entries()]
    .filter(([, eur]) => eur > 0)
    .map(([id, eur]) => ({ id, eur }))
    .sort((a, b) => b.eur - a.eur);
}

export function compute(data: Dataset, state: ViewState): Result {
  const site = data.meta.sites.find((entry) => entry.id === state.site);
  if (!site) throw new Error(`Unknown site ${state.site}`);
  const heatOn = state.heat && site.heat_available;
  const book = data.lifecycle[state.site][state.archetype];
  const main = run(data, state, book[state.scenario], site.country, heatOn, true, state.scenario);
  const lowRun = run(data, state, book.low_impact, site.country, heatOn, false, "low_impact");
  const highRun = run(data, state, book.high_impact, site.country, heatOn, false, "high_impact");
  const mainShare = headline(main);
  const low = headline(lowRun);
  const high = headline(highRun);
  const scheduleIds = book[state.scenario].source_ids;
  const carbonIds = unique([
    ...main.categories.filter((flow) => flow.id !== "electricity" && flow.id !== "staff").flatMap((flow) => flow.sourceIds),
    ...scheduleIds.filter(
      (id) =>
        !isKnownSpecific(id)
        || id.startsWith("it_load_factor.")
        || id.startsWith("pue.")
        || id.startsWith("grid_factor.")
        || id === "contract_factor"
        || (heatOn && (id === "heat_recovery_share" || id === "heat_pump_cop" || id === "heat_displaced_factor")),
    ),
  ]);
  const jobsIds = unique([
    ...main.sourceIds,
    ...scheduleIds.filter((id) => !isKnownSpecific(id) || isStaffId(id)),
  ]);
  const payrollIds = unique(
    scheduleIds.filter((id) => !isKnownSpecific(id) || isStaffId(id) || id.startsWith("cross_border_share.")),
  );
  return {
    heatOn,
    spendEur: main.spendEur,
    domesticVaEur: main.domesticVaEur,
    headlineShare: mainShare,
    bandLowShare: Math.min(low, high, mainShare),
    bandHighShare: Math.max(low, high, mainShare),
    drivers: state.scenario === "central" ? headlineDrivers(data, state, book.central, site.country, heatOn) : [],
    countries: buckets(main.countries as Map<string, number>),
    industries: buckets(main.industries),
    constructionJobs: main.constructionJobs,
    ongoingJobs: main.ongoingJobs,
    ongoingVaEur: main.ongoingVaEur,
    buildEuroShare: main.buildEuroShare,
    embodiedKg: main.embodiedKg,
    operationalKg: main.operationalKg,
    heatOffsetKg: main.heatOffsetKg,
    payrollEur: main.payrollEur,
    crossBorderShare: main.crossBorderShare,
    headlineSourceIds: unique([...main.sourceIds, data.meta.table.source_id]),
    jobsSourceIds: jobsIds,
    carbonSourceIds: carbonIds,
    payrollSourceIds: payrollIds,
    tiers: main.tiers,
    tierSourceIds: main.tierSourceIds,
    shareByYear: main.shareByYear,
    bandLowByYear: lowRun.shareByYear,
    bandHighByYear: highRun.shareByYear,
  };
}
