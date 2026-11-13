import type { Assumption, Dataset, Meta } from "../data/types";
import { t } from "../i18n";
import type { Result } from "./compute";
import {
  barWidth,
  centsOf,
  formatCarbon,
  formatCount,
  formatMoney,
  formatPrecise,
  formatShare,
  formatWhole,
  formatWholeShare,
  markLeft,
  markPlace,
} from "./format";
import { mapShape } from "./map";
import { energyInAYear } from "./energy";
import { buildStage, type StageModel, type StagePart } from "./stage";
import { shareBounds, sizeField, yearBounds, type ViewState } from "./state";
import { motionMs, playMs } from "./timing";

const VISIBLE_ROWS = 24;

export interface SourceCard {
  key: string;
  title: string;
  draft: boolean;
  lines: { key: string; text: string }[];
  url?: string;
  linkLabel?: string;
  kind: "data" | "assumption";
  /** Low, central and high as text, and where central falls between them. */
  range?: { low: string; central: string; high: string; unit: string; at: string };
  note?: string;
}

export interface Explained {
  title: string;
  what: string;
  structure: string;
  tableLine: string;
  priceLine: string;
  averageNote: string | null;
  sources: SourceCard[];
}

export interface RowModel {
  id: string;
  label: string;
  value: string;
  share: string;
  width: string;
  home: boolean;
  infoId: string;
}

export interface TilePiece {
  key: string;
  text: string;
  infoId: string | null;
  name: string | null;
}

export interface TileModel {
  title: string;
  figure: string;
  figureInfoId: string;
  figureName: string;
  unit: string;
  pieces: TilePiece[];
}

export interface View {
  settingsTitle: string;
  resultsTitle: string;
  headlineInfoId: string;
  banner: string | null;
  name: string;
  tagline: string;
  structure: string;
  headline: string;
  headlineCents: string | null;
  headlineRest: string;
  band: string;
  yearParts: StagePart[];
  /** Where the rest of each euro goes, as a sentence and as widths of one slim bar. */
  restParts: StagePart[];
  restBar: { home: string; abroad: string; tax: string };
  bandParts: StagePart[];
  stage: StageModel;
  year: {
    value: number;
    min: number;
    max: number;
    label: string;
    name: string;
    marks: { id: string; left: string; label: string; place: "start" | "middle" | "end"; crowd: boolean }[];
    infoId: string;
  };
  play: { label: string; playing: boolean };
  controls: {
    mapLabel: string;
    siteLabel: string;
    archetypeLabel: string;
    setupLead: string;
    setupMid: string;
    typeLead: string;
    setupTail: string;
    servers: { lead: string; label: string; note: string; options: { id: ViewState["servers"]; label: string; selected: boolean }[] };
    map: ReturnType<typeof mapShape>;
    archetypes: { id: ViewState["archetype"]; label: string; note: string; selected: boolean }[];
    size: { value: number; min: number; step: string; label: string; lead: string; unit: string; note: string; infoId: string };
    sites: { id: ViewState["site"]; label: string; selected: boolean }[];
    sliders: { id: "electrical" | "cooling" | "it_hardware"; label: string; value: number; min: number; max: number; step: string; display: string; mark: string; infoId: string }[];
    sourcing: string;
    sourcingNote: string;
    heat: { on: boolean; enabled: boolean; label: string; reason: string | null; note: string | null; infoId: string; onLabel: string; offLabel: string };
    electricity: { label: string; note: string; options: { id: ViewState["electricityView"]; label: string; note: string; selected: boolean }[] };
    currency: { note: string; options: { id: ViewState["currency"]; label: string; selected: boolean }[] };
  };
  panels: {
    countries: { title: string; rows: RowModel[] };
    industries: { title: string; rows: RowModel[] };
    jobs: TileModel;
    energy: TileModel | null;
    grid: TileModel | null;
    carbon: TileModel;
    payroll: TileModel;
  };
  explanations: Record<string, Explained>;
  playEveryMs: number;
  motionEveryMs: number;
  footer: { credit: string; method: string };
  /** The case on screen as plain text with its caveats, to paste into a memo or a planning file. */
  summary: { label: string; copied: string; fallback: string; text: string };
}

function money(eur: number, state: ViewState, fx: number): string {
  const shown = state.currency === "CHF" ? eur * fx : eur;
  return formatMoney(shown, state.currency);
}

/** ": the build." until operations start, then how many years of operation the figure covers. */
function yearPhase(data: Dataset, state: ViewState): string {
  const schedule = data.lifecycle[state.site][state.archetype][state.scenario];
  const firstRunning = schedule.electricity_mwh.findIndex((mwh) => mwh > 0) + 1;
  if (firstRunning < 1 || state.year < firstRunning) return t("yearBuild");
  const count = state.year - firstRunning + 1;
  return count === 1 ? t("yearRunningOne") : t("yearRunning", { count: String(count) });
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** "spent on the build" until operations start, then "spent over the first N years". */
function yearSpan(data: Dataset, state: ViewState): string {
  const schedule = data.lifecycle[state.site][state.archetype][state.scenario];
  const firstRunning = schedule.electricity_mwh.findIndex((mwh) => mwh > 0) + 1;
  if (firstRunning < 1 || state.year < firstRunning) return t("spanBuild");
  return t("spanYears", { count: String(state.year) });
}

const HALF = 1;
const WHOLE = 2;

function carbonText(kg: number): string {
  const shaped = formatCarbon(kg);
  return t(shaped.unit === "tonnes" ? "tonnes" : "kg", { amount: shaped.amount });
}

function cardsFor(data: Dataset, ids: string[]): SourceCard[] {
  const assumptions = new Map(data.assumptions.map((entry) => [entry.id, entry]));
  const datasets = new Map(data.meta.datasets.map((entry) => [entry.id, entry]));
  return [...new Set(ids)].map((id) => {
    const assumption = assumptions.get(id);
    if (assumption) return assumptionCard(assumption);
    const dataset = datasets.get(id);
    if (dataset) {
      const lines = [
        { key: `${id}-publisher`, text: dataset.publisher },
        { key: `${id}-edition`, text: dataset.edition },
        { key: `${id}-read`, text: t("readOn", { date: dataset.accessed }) },
      ];
      if (dataset.license) lines.push({ key: `${id}-license`, text: dataset.license });
      return { key: id, title: dataset.name, draft: false, kind: "data" as const, lines, url: dataset.url, linkLabel: dataset.name };
    }
    return {
      key: id,
      title: id,
      draft: false,
      kind: "data" as const,
      lines: [{ key: `${id}-missing`, text: t("missingSource", { id }) }],
    };
  });
}

function assumptionCard(entry: Assumption): SourceCard {
  const lines = [{ key: `${entry.id}-read`, text: t("readOn", { date: entry.source_accessed }) }];
  if (!entry.url) lines.push({ key: `${entry.id}-source`, text: entry.source });
  const span = entry.high - entry.low;
  const share = entry.unit.startsWith("share");
  const shown = (value: number) => (share ? formatShare(value) : formatPrecise(value));
  return {
    key: entry.id,
    title: entry.label,
    draft: entry.status === "draft",
    kind: "assumption",
    range: {
      low: shown(entry.low),
      central: shown(entry.central),
      high: shown(entry.high),
      unit: share ? "" : entry.unit,
      at: barWidth(span > 0 ? entry.central - entry.low : HALF, span > 0 ? span : WHOLE),
    },
    note: entry.note,
    lines,
    url: entry.url,
    linkLabel: entry.source,
  };
}

function frame(meta: Meta): { structure: string; tableLine: string; priceLine: string } {
  return {
    structure: t("structure", { year: String(meta.table.reference_year) }),
    tableLine: t("tableLine", { name: meta.table.name, edition: meta.table.edition }),
    priceLine: t("priceLine", { year: String(meta.price_year) }),
  };
}

function explain(
  data: Dataset,
  title: string,
  what: string,
  sourceIds: string[],
  nationalAverage: boolean,
): Explained {
  const lines = frame(data.meta);
  return {
    title,
    what,
    structure: lines.structure,
    tableLine: lines.tableLine,
    priceLine: lines.priceLine,
    averageNote: nationalAverage ? t("nationalAverage") : null,
    sources: cardsFor(data, sourceIds),
  };
}

function moneySources(ids: string[], state: ViewState, data: Dataset): string[] {
  if (state.currency === "CHF") return [...ids, data.meta.fx_eur_chf.source_id];
  return ids;
}

export function present(data: Dataset, state: ViewState, result: Result, flags: { playing: boolean; reduced: boolean; level?: number }): View {
  const site = data.meta.sites.find((entry) => entry.id === state.site);
  if (!site) throw new Error(`Unknown site ${state.site}`);
  const fx = data.meta.fx_eur_chf.value;
  const framed = frame(data.meta);
  const place = t(`place.${site.country}`);
  const unit = t(`moneyUnit.${state.currency}`);
  const explanations: Record<string, Explained> = {};
  const remember = (id: string, title: string, what: string, sourceIds: string[], nationalAverage = false) => {
    explanations[id] = explain(data, title, what, sourceIds, nationalAverage);
  };

  const headlineCents = result.spendEur > 0 ? centsOf(result.headlineShare) : null;
  const span = yearSpan(data, state);
  const headlineRest = result.spendEur > 0
    ? t("headlineRest", { unit, place, span })
    : t("headlineEmpty");
  const headline = result.spendEur > 0
    ? t("headline", { cents: centsOf(result.headlineShare), unit, place, span })
    : t("headlineEmpty");
  const lowCents = centsOf(result.bandLowShare);
  const highCents = centsOf(result.bandHighShare);
  const band = result.bandLowShare === result.bandHighShare
    ? t("bandFlat", { cents: lowCents })
    : t("band", { low: lowCents, high: highCents });
  remember("headline", headline, t("what.headline"), result.headlineSourceIds);
  const yearParts: StagePart[] = [
    { key: "y0", text: t("yearBefore"), infoId: null, name: null },
    { key: "y1", text: String(state.year), infoId: "year", name: t("yearLabel", { year: String(state.year) }) },
    { key: "y2", text: yearPhase(data, state), infoId: null, name: null },
  ];
  const homeCents = Number(centsOf(result.headlineShare));
  const taxShare = result.spendEur > 0 ? result.tiers.reduce((sum, tier) => sum + tier.tax, 0) / result.spendEur : 0;
  const taxCents = Number(centsOf(taxShare));
  const wholeCents = Number(centsOf(result.spendEur > 0 ? result.spendEur / result.spendEur : 0));
  const abroadCents = wholeCents - homeCents - taxCents;
  remember("rest", t("restAbroadName"), t("what.added"), result.headlineSourceIds);
  remember("rest:tax", t("restTaxName"), t("what.productTax"), result.headlineSourceIds);
  const restParts: StagePart[] = result.spendEur > 0
    ? [
        { key: "r0", text: t("restLead", { rest: String(wholeCents - homeCents) }), infoId: null, name: null },
        { key: "r1", text: String(abroadCents), infoId: "rest", name: `${t("restAbroadName")}: ${abroadCents} ${t("centsWord")}` },
        { key: "r2", text: t("restMid"), infoId: null, name: null },
        { key: "r3", text: String(taxCents), infoId: "rest:tax", name: `${t("restTaxName")}: ${taxCents} ${t("centsWord")}` },
        { key: "r4", text: t("restTail"), infoId: null, name: null },
      ]
    : [];
  const restBar = { home: `${homeCents}%`, abroad: `${abroadCents}%`, tax: `${taxCents}%` };
  const bandParts: StagePart[] = result.bandLowShare === result.bandHighShare
    ? [
        { key: "b0", text: t("bandBefore"), infoId: null, name: null },
        { key: "b1", text: lowCents, infoId: "headline", name: headline },
        { key: "b2", text: t("bandAfter"), infoId: null, name: null },
      ]
    : [
        { key: "b0", text: t("bandBefore"), infoId: null, name: null },
        { key: "b1", text: lowCents, infoId: "headline", name: headline },
        { key: "b2", text: t("bandBetween"), infoId: null, name: null },
        { key: "b3", text: highCents, infoId: "headline", name: headline },
        { key: "b4", text: t("bandAfter"), infoId: null, name: null },
      ];
  const stage = buildStage(data, state, result, flags.level ?? 1, place);
  for (const item of stage.opens) remember(item.id, item.title, item.what, item.sourceIds);

  const bounds = yearBounds(data.lifecycle[state.site][state.archetype][state.scenario].spend.construction.length);
  const schedule = data.lifecycle[state.site][state.archetype][state.scenario];
  const marks = new Map<number, string[]>();
  for (const milestone of schedule.milestones) {
    const list = marks.get(milestone.year) ?? [];
    list.push(milestone.key);
    marks.set(milestone.year, list);
  }
  const markRank = ["midlife_refresh", "first_fit", "it_refresh", "build"];
  remember("year", t("yearLabel", { year: String(state.year) }), t("what.year"), schedule.source_ids);

  const countryName = (id: string) => data.meta.country_groups.find((entry) => entry.id === id)?.label ?? id;
  const industryName = (id: string) => data.meta.industry_groups.find((entry) => entry.id === id)?.label ?? id;

  const countryRows = result.countries.map((bucket) => ({
    ...bucket,
    home: bucket.id === site.country,
    label: countryName(bucket.id),
  }));
  const visibleCountries = countryRows.slice(0, VISIBLE_ROWS);
  const hiddenCountries = countryRows.slice(VISIBLE_ROWS);
  if (hiddenCountries.length > 0) {
    const eur = hiddenCountries.reduce((sum, row) => sum + row.eur, 0);
    visibleCountries.push({
      id: "smaller",
      eur,
      home: false,
      label: t("smallerGroups"),
    });
  }
  const countryMax = visibleCountries.reduce((max, row) => Math.max(max, row.eur), 0);
  const countries: RowModel[] = visibleCountries.map((row) => {
    const infoId = `country:${row.id}`;
    const value = money(row.eur, state, fx);
    const share = formatShare(result.spendEur > 0 ? row.eur / result.spendEur : 0);
    const what = row.id === "smaller"
      ? hiddenCountries.map((hidden) => `${hidden.label} ${money(hidden.eur, state, fx)} (${formatShare(result.spendEur > 0 ? hidden.eur / result.spendEur : 0)})`).join(". ")
      : t("what.country", { place: row.label });
    remember(infoId, row.label, what, moneySources(result.headlineSourceIds, state, data), row.id !== site.country && row.id !== "smaller");
    return { id: row.id, label: row.label, value, share, width: barWidth(row.eur, countryMax), home: row.home, infoId };
  });

  const industryRows = result.industries.map((bucket) => ({ ...bucket, label: industryName(bucket.id) }));
  const industryWhole = industryRows.reduce((sum, row) => sum + row.eur, 0);
  const industryMax = industryRows.reduce((max, row) => Math.max(max, row.eur), 0);
  const industries: RowModel[] = industryRows.map((row) => {
    const infoId = `industry:${row.id}`;
    remember(infoId, row.label, t("what.industry", { place: row.label }), moneySources(result.headlineSourceIds, state, data), false);
    return {
      id: row.id,
      label: row.label,
      value: money(row.eur, state, fx),
      share: formatShare(industryWhole > 0 ? row.eur / industryWhole : 0),
      width: barWidth(row.eur, industryMax),
      home: true,
      infoId,
    };
  });

  const jobRows = [
    {
      id: "construction",
      label: t("constructionJobs"),
      value: t("jobYears", { count: formatCount(result.constructionJobs) }),
      infoId: "jobs:construction",
      what: t("what.constructionJobs"),
    },
    {
      id: "ongoing",
      label: t("ongoingJobs"),
      value: result.ongoingJobs === null ? t("ongoingEmpty") : t("jobsAYear", { count: formatCount(result.ongoingJobs) }),
      infoId: "jobs:ongoing",
      what: t("what.ongoingJobs"),
    },
  ];
  for (const row of jobRows) remember(row.infoId, row.label, row.what, result.jobsSourceIds);

  const carbonRows = [
    { id: "embodied", label: t("embodied"), value: carbonText(result.embodiedKg), infoId: "carbon:embodied", what: t("what.embodied") },
    { id: "operational", label: t("operational"), value: carbonText(result.operationalKg), infoId: "carbon:operational", what: t("what.operational") },
    { id: "offset", label: t("offset"), value: carbonText(result.heatOffsetKg), infoId: "carbon:offset", what: t("what.offset") },
  ];
  for (const row of carbonRows) remember(row.infoId, row.label, row.what, result.carbonSourceIds);

  // Payroll for one year of operation, like jobs a year and energy: at year 2 no staff are paid yet.
  const staffSpend = data.lifecycle[state.site][state.archetype][state.scenario].spend.staff;
  const payrollYearEur = (staffSpend.find((perMw) => perMw > 0) ?? 0) * state.sizeMw;
  const payrollRows = [
    {
      id: "total",
      label: t("payrollTotal"),
      value: money(payrollYearEur, state, fx),
      infoId: "payroll:total",
      what: t("what.payroll"),
    },
    {
      id: "cross",
      label: t("crossBorder"),
      value: `${formatShare(result.crossBorderShare)}, ${money(payrollYearEur * result.crossBorderShare, state, fx)}`,
      infoId: "payroll:cross",
      what: t("what.crossBorder"),
    },
  ];
  for (const row of payrollRows) remember(row.infoId, row.label, row.what, moneySources(result.payrollSourceIds, state, data));

  const netCarbon = formatCarbon(result.embodiedKg + result.operationalKg - result.heatOffsetKg);
  remember("carbon:net", t("carbonTitle"), t("what.carbonNet"), result.carbonSourceIds);
  const jobsTile = result.ongoingJobs === null
    ? {
      title: t("jobsTitle"),
      figure: formatCount(result.constructionJobs),
      figureInfoId: "jobs:construction",
      figureName: t("constructionJobs"),
      unit: t("jobYearsUnit"),
      pieces: [{ key: "empty", text: t("ongoingEmpty"), infoId: null, name: null }],
    }
    : {
      title: t("jobsTitle"),
      figure: formatCount(result.ongoingJobs),
      figureInfoId: "jobs:ongoing",
      figureName: t("ongoingJobs"),
      unit: t("jobsAYearUnit"),
      pieces: [
        { key: "lead", text: t("tileJobsLead"), infoId: null, name: null },
        { key: "build", text: `${t("jobYears", { count: formatCount(result.constructionJobs) })}${t("tileJobsTail")}`, infoId: "jobs:construction", name: t("constructionJobs") },
      ],
    };
  const carbonTile = {
    title: t("carbonTitle"),
    figure: netCarbon.amount,
    figureInfoId: "carbon:net",
    figureName: t("carbonTitle"),
    unit: t(netCarbon.unit === "tonnes" ? "tonnesUnit" : "kgUnit"),
    pieces: result.heatOn
      ? [
          { key: "lead", text: t("carbonLead"), infoId: null, name: null },
          { key: "embodied", text: carbonText(result.embodiedKg), infoId: "carbon:embodied", name: t("embodied") },
          { key: "embodied-join", text: t("carbonEmbodiedJoin"), infoId: null, name: null },
          { key: "operational", text: carbonText(result.operationalKg), infoId: "carbon:operational", name: t("operational") },
          { key: "operational-join", text: t("carbonOperationalJoin"), infoId: null, name: null },
          { key: "offset", text: carbonText(result.heatOffsetKg), infoId: "carbon:offset", name: t("offset") },
          { key: "offset-join", text: t("carbonOffsetJoin"), infoId: null, name: null },
        ]
      : [
          { key: "lead", text: t("carbonLead"), infoId: null, name: null },
          { key: "embodied", text: carbonText(result.embodiedKg), infoId: "carbon:embodied", name: t("embodied") },
          { key: "embodied-join", text: t("carbonEmbodiedJoinOff"), infoId: null, name: null },
          { key: "operational", text: carbonText(result.operationalKg), infoId: "carbon:operational", name: t("operational") },
          { key: "operational-end", text: t("carbonOperationalEnd"), infoId: null, name: null },
        ],
  };
  const energy = energyInAYear(data, state, result.heatOn);
  let energyTile: TileModel | null = null;
  if (energy) {
    const mwh = (amount: number) => t("mwh", { amount: formatWhole(amount) });
    remember("energy:total", t("energyTitle"), t("what.energy"), energy.sourceIds);
    remember("energy:it", t("energyItName"), t("what.energyIt"), energy.sourceIds);
    remember("energy:other", t("energyOtherName"), t("what.energyOther"), energy.sourceIds);
    remember("energy:heat", t("energyHeatName"), t("what.energyHeat"), energy.sourceIds);
    energyTile = {
      title: t("energyTitle"),
      figure: formatWhole(energy.siteMwh + energy.heatPumpMwh),
      figureInfoId: "energy:total",
      figureName: t("energyTitle"),
      unit: t("energyUnit"),
      pieces: [
        { key: "lead", text: t("energyLead", { pue: formatPrecise(energy.pue) }), infoId: null, name: null },
        { key: "it", text: mwh(energy.itMwh), infoId: "energy:it", name: t("energyItName") },
        { key: "it-join", text: t("energyItJoin"), infoId: null, name: null },
        { key: "other", text: mwh(energy.otherMwh), infoId: "energy:other", name: t("energyOtherName") },
        { key: "other-join", text: t("energyOtherJoin"), infoId: null, name: null },
        ...(energy.heatPumpMwh > 0
          ? [
              { key: "heat-lead", text: t("energyHeatLead"), infoId: null, name: null },
              { key: "heat", text: mwh(energy.heatPumpMwh), infoId: "energy:heat", name: t("energyHeatName") },
              { key: "heat-tail", text: t("energyHeatTail"), infoId: null, name: null },
            ]
          : []),
      ],
    };
  }
  // Grid capacity is the scarce thing, so show what each MW of connection supports at home.
  let gridTile: TileModel | null = null;
  if (energy && result.ongoingVaEur !== null && result.ongoingJobs !== null) {
    const gridMw = state.sizeMw * energy.pue;
    remember("grid:va", t("gridTitle"), t("what.gridVa"), unique(result.headlineSourceIds.concat(energy.sourceIds)));
    remember("grid:jobs", t("gridTitle"), t("what.gridJobs"), unique(result.jobsSourceIds.concat(energy.sourceIds)));
    gridTile = {
      title: t("gridTitle"),
      figure: money(result.ongoingVaEur / gridMw, state, fx),
      figureInfoId: "grid:va",
      figureName: t("gridTitle"),
      unit: t("gridUnit"),
      pieces: [
        { key: "lead", text: t("gridLead", { mw: formatCount(gridMw) }), infoId: null, name: null },
        { key: "jobs", text: t("jobsAYear", { count: formatCount(result.ongoingJobs / gridMw) }), infoId: "grid:jobs", name: t("gridTitle") },
        { key: "tail", text: t("gridTail"), infoId: null, name: null },
      ],
    };
  }
  const crossBorder = payrollRows.find((row) => row.id === "cross");
  const payrollTile = {
    title: t("payrollTitle"),
    figure: money(payrollYearEur, state, fx),
    figureInfoId: "payroll:total",
    figureName: t("payrollTotal"),
    unit: t("payrollUnit"),
    pieces: [
      { key: "lead", text: t("payrollLead"), infoId: null, name: null },
      { key: "cross", text: `${crossBorder?.value ?? ""}${t("payrollTail")}`, infoId: "payroll:cross", name: t("crossBorder") },
    ],
  };

  const boundsShare = shareBounds();
  const sizeBox = sizeField();
  const sliders = data.meta.categories.flatMap((category) => {
    if (!category.has_slider || category.id === "staff") return [];
    if (category.id !== "electrical" && category.id !== "cooling" && category.id !== "it_hardware") return [];
    const id = category.id;
    const infoId = `slider:${id}`;
    const pair = data.fingerprints[site.country][id];
    remember(infoId, category.label, t("what.slider", { name: category.label }), pair.source_ids, Math.abs(state.sourcing[id] - pair.default_domestic_share) <= 0.0005);
    return [{
      id,
      label: category.label,
      value: state.sourcing[id],
      min: boundsShare.min,
      max: boundsShare.max,
      step: boundsShare.step,
      display: formatWholeShare(state.sourcing[id]),
      mark: `${pair.default_domestic_share * 100}%`,
      infoId,
    }];
  });
  remember("size", t("size"), t("what.size"), []);
  const heatIds = [
    "heat_recovery_share",
    "heat_pump_cop",
    "heat_pump_capex_per_mw_heat",
    "heat_connection_capex_per_mw",
    "heat_recovery_upkeep_share",
    "heat_displaced_factor",
  ].filter((id) => data.assumptions.some((entry) => entry.id === id));
  remember(
    "heat",
    t("heat"),
    t("what.heat"),
    heatIds.length > 0 ? heatIds : site.source_ids,
    false,
  );

  return {
    settingsTitle: t("settingsTitle"),
    resultsTitle: t("resultsTitle"),
    headlineInfoId: "headline",
    banner: data.meta.fixture ? t("banner") : null,
    name: data.meta.name,
    tagline: data.meta.tagline,
    structure: framed.structure,
    headline,
    headlineCents,
    headlineRest,
    band,
    yearParts,
    restParts,
    restBar,
    bandParts,
    stage,
    year: {
      value: state.year,
      min: bounds.min,
      max: bounds.max,
      label: t("yearLabel", { year: String(state.year) }),
      name: t("yearName"),
      marks: [...marks.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([year, keys], index, all) => {
          const previous = index === 0 ? null : all[index - 1][0];
          const span = bounds.max - bounds.min;
          const gap = previous === null || span === 0 ? 1 : (year - previous) / span;
          return {
            id: `year-${year}`,
            left: markLeft(year, bounds.min, bounds.max),
            place: markPlace(year, bounds.min, bounds.max),
            crowd: gap < 0.12,
            label: t(`milestones.${markRank.find((key) => keys.includes(key)) ?? keys[0]}`),
          };
        }),
      infoId: "year",
    },
    play: { label: flags.playing ? t("pause") : t("play"), playing: flags.playing },
    controls: {
      mapLabel: t("mapLabel"),
      siteLabel: t("site"),
      archetypeLabel: t("archetype"),
      setupLead: t("setupLead"),
      setupMid: t("setupMid"),
      typeLead: t("typeLead"),
      setupTail: t("setupTail"),
      servers: {
        lead: t("serversLead"),
        label: t("serversLabel"),
        note: t(state.servers === "tenant" ? "serversNoteTenant" : "serversNoteOwn"),
        options: [
          { id: "own", label: t("serversOwn"), selected: state.servers === "own" },
          { id: "tenant", label: t("serversTenant"), selected: state.servers === "tenant" },
        ],
      },
      sites: data.meta.sites.map((entry) => ({
        id: entry.id,
        label: entry.label,
        selected: entry.id === state.site,
      })),
      map: mapShape(
        data.meta.sites.map((entry) => ({
          id: entry.id,
          label: entry.label,
          lat: entry.lat,
          lon: entry.lon,
        })),
        state.site,
        { AT: countryName("AT"), CH: countryName("CH") },
      ),
      archetypes: (["ai", "cloud"] as const).map((id) => ({
        id,
        label: t(`archetypes.${id}`),
        note: t(`archetypes.${id}Note`),
        selected: state.archetype === id,
      })),
      size: {
        value: state.sizeMw,
        min: sizeBox.min,
        step: sizeBox.step,
        label: t("size"),
        lead: t("sizeLead"),
        unit: t("sizeUnit"),
        note: t("sizeNote"),
        infoId: "size",
      },
      sliders,
      sourcing: t("sourcing"),
      sourcingNote: t("sourcingNote"),
      heat: {
        on: result.heatOn,
        enabled: site.heat_available,
        label: t("heat"),
        reason: site.heat_available ? null : site.id === "lugano" ? t("heatReasonLugano") : t("heatReason"),
        note: site.heat_available ? t("heatNote") : null,
        infoId: "heat",
        onLabel: t("on"),
        offLabel: t("off"),
      },
      electricity: {
        label: t("electricity"),
        note: t("electricityNote"),
        options: [
          { id: "grid", label: t("grid"), note: t("gridNote"), selected: state.electricityView === "grid" },
          { id: "contract", label: t("contract"), note: t("contractNote"), selected: state.electricityView === "contract" },
        ],
      },
      currency: {
        note: t("currencyNote"),
        options: (["EUR", "CHF"] as const).map((id) => ({
          id,
          label: t(`currency.${id}`),
          selected: state.currency === id,
        })),
      },
    },
    panels: {
      countries: { title: t("countriesTitle"), rows: countries },
      industries: { title: t("industriesTitle"), rows: industries },
      jobs: jobsTile,
      energy: energyTile,
      grid: gridTile,
      carbon: carbonTile,
      payroll: payrollTile,
    },
    explanations,
    playEveryMs: playMs(flags.reduced),
    motionEveryMs: motionMs(flags.reduced),
    footer: { credit: t("credit"), method: t("method") },
    summary: {
      label: t("summaryCopy"),
      copied: t("summaryCopied"),
      fallback: t("summaryFallback"),
      text: [
        t("summaryCase", {
          name: data.meta.name,
          site: t(`sites.${site.id}`),
          type: t(`archetypes.${state.archetype}`),
          mw: formatCount(state.sizeMw),
          servers: t(state.servers === "tenant" ? "serversTenant" : "serversOwn"),
        }),
        `${t("yearLine", { year: String(state.year) })} ${headline} ${band}`,
        jobsTile.pieces.length ? `${jobsTile.title}: ${jobsTile.figure} ${jobsTile.unit}. ${jobsTile.pieces.map((piece) => piece.text).join("")}` : "",
        `${payrollTile.title}: ${payrollTile.figure}, ${payrollTile.unit}.`,
        energyTile ? `${energyTile.title}: ${energyTile.figure} ${energyTile.unit}. ${energyTile.pieces.map((piece) => piece.text).join("")}` : "",
        `${carbonTile.title}: ${carbonTile.figure} ${carbonTile.unit}. ${carbonTile.pieces.map((piece) => piece.text).join("")} ${t("summaryCarbonView", { view: t(state.electricityView === "contract" ? "contract" : "grid"), heat: t(result.heatOn ? "on" : "off") })}`,
        t("summaryCaveat", { structure: framed.structure }),
      ].filter((line) => line !== "").join("\n"),
    },
  };
}
