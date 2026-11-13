import type { Dataset } from "../data/types";
import { t } from "../i18n";
import type { Result, TierCents } from "./compute";
import { centsOf, formatCentimes } from "./format";
import { levelCount } from "./level";
import { yearsGeometry, type YearsGeometry } from "./spark";
import { OPEN_YEAR, type ViewState } from "./state";

export interface StagePart {
  key: string;
  text: string;
  infoId: string | null;
  name: string | null;
}

export interface StageSegment {
  key: string;
  className: string;
  left: string;
  width: string;
  infoId: string;
  name: string;
}

export interface StageRow {
  id: string;
  label: string;
  hint: string;
  kept: string | null;
  keptInfoId: string | null;
  keptName: string | null;
  segments: StageSegment[];
}

export interface OpenRequest {
  id: string;
  title: string;
  what: string;
  sourceIds: string[];
}

export interface StageModel {
  steps: { id: string; mark: string; kicker: string; name: string; current: boolean; done: boolean }[];
  /** From level 4 the picture keeps only its added-up bar, so each level's own view sits under it. */
  summary: boolean;
  /** Level 1 shows the map of sites beside its sentence, where the reader is asked to pick one. */
  showMap: boolean;
  kicker: string;
  title: string;
  sentence: StagePart[];
  legend: { id: string; className: string; label: string }[];
  homeNote: StagePart[];
  abroadNote: StagePart[];
  keptHead: string | null;
  rows: StageRow[];
  abroadLine: StagePart[];
  /** One yardstick for the figure: what a euro of ordinary building work supports at home. */
  compareLine: StagePart[];
  years: (YearsGeometry & { label: string; caption: string; guideLabels: Record<string, string> }) | null;
  showYear: boolean;
  showTotals: boolean;
  showCase: boolean;
  tap: string;
  /** What to do at this level, in one line. */
  hint: string;
  back: string;
  next: string;
  canBack: boolean;
  canNext: boolean;
  opens: OpenRequest[];
}

const NAMES = ["who", "keep", "suppliers", "years", "jobs", "case"] as const;
const ROW_KEYS = ["direct", "tier1", "tier2", "tier3", "tier4"] as const;
/** Level 4 is the twenty-year view, and from there the picture is summed up. */
const YEARS_LEVEL = 4;
const SUMMARY_FROM = 4;
const COMPARE_LEVEL = 3;
const MAP_LEVEL = 1;

function words(key: string, text: string): StagePart {
  return { key, text, infoId: null, name: null };
}

function num(key: string, text: string, infoId: string, name: string): StagePart {
  return { key, text, infoId, name };
}

function cents(eur: number, spend: number): number {
  return spend > 0 ? (eur / spend) * 100 : 0;
}

function lay(parts: { key: string; className: string; cents: number; infoId: string; name: string }[]): StageSegment[] {
  let left = 0;
  const segments: StageSegment[] = [];
  for (const part of parts) {
    const width = part.cents > 0 ? part.cents : 0;
    if (width === 0) continue;
    segments.push({
      key: part.key,
      className: part.className,
      left: `${left}%`,
      width: `${width}%`,
      infoId: part.infoId,
      name: part.name,
    });
    left += width;
  }
  return segments;
}

export function buildStage(data: Dataset, state: ViewState, result: Result, level: number, place: string): StageModel {
  const spend = result.spendEur;
  const home = data.meta.sites.find((site) => site.id === state.site)?.country;
  const tiers = result.tiers;
  const opens: OpenRequest[] = [];
  const open = (id: string, title: string, what: string, sourceIds: string[]) => {
    if (!opens.some((entry) => entry.id === id)) opens.push({ id, title, what, sourceIds });
  };
  const shown = (value: number) => formatCentimes(value);
  /** Two decimals, so the rounding to the whole cents at the top is plain to see. */
  const exact = (value: number) => (Math.round(value * 100) / 100).toFixed(2);
  const lastYear = result.shareByYear.length;
  const lastShare = result.shareByYear[lastYear - 1] ?? 0;
  const firstOpenShare = result.shareByYear[Math.min(lastYear, OPEN_YEAR) - 1] ?? lastShare;
  open("years", t("ladder.years"), t("what.headline"), result.headlineSourceIds);
  open("compare", t("compareName"), t("what.compare"), data.fingerprints[home ?? "AT"].construction.source_ids);
  const tierIds = (index: number) => result.tierSourceIds[index] ?? result.headlineSourceIds;

  const showSplit = level >= 2;
  const showJourney = level >= 3;
  const summary = level >= SUMMARY_FROM;

  const split = (tier: TierCents, index: number, id: string) => {
    const keptId = `${id}:kept`;
    const abroadKeptId = `${id}:abroadKept`;
    const passId = `${id}:pass`;
    const taxId = `${id}:tax`;
    const outId = `${id}:out`;
    const abroadOutId = `${id}:abroadOut`;
    open(keptId, t("keptIn", { place }), t("what.kept"), tierIds(index));
    open(abroadKeptId, t("legendKeptAbroad"), t("what.keptAbroad"), tierIds(index));
    open(passId, t("legendPass"), t("what.passed"), tierIds(index));
    open(taxId, t("legendTax"), t("what.productTax"), tierIds(index));
    open(outId, t("legendHomeFirms", { place }), t("what.output"), tierIds(index));
    open(abroadOutId, t("legendAbroadFirms"), t("what.outputAbroad"), tierIds(index));
    const vaHome = cents(tier.vaHome, spend);
    const vaAbroad = cents(tier.vaAbroad, spend);
    const passHome = cents(tier.passHome, spend);
    const passAbroad = cents(tier.passAbroad, spend);
    const taxHome = cents(tier.taxHome, spend);
    const taxAbroad = cents(tier.taxAbroad, spend);
    const tax = cents(tier.tax, spend);
    const outputHome = cents(tier.outputHome, spend);
    const outputAbroad = cents(tier.outputAbroad, spend);
    const parts = !showSplit
      ? [
          { key: "hk", className: "seg home kept", cents: outputHome, infoId: outId, name: `${t("legendHomeFirms", { place })}: ${shown(outputHome)} ${t("centsWord")}` },
          { key: "ak", className: "seg abroad kept", cents: outputAbroad, infoId: abroadOutId, name: `${t("legendAbroadFirms")}: ${shown(outputAbroad)} ${t("centsWord")}` },
        ]
      : index === 4
      ? [
          { key: "hk", className: "seg home kept", cents: vaHome, infoId: keptId, name: `${t("keptIn", { place })}: ${shown(vaHome)} ${t("centsWord")}` },
          { key: "ak", className: "seg abroad kept", cents: vaAbroad, infoId: abroadKeptId, name: `${t("legendKeptAbroad")}: ${shown(vaAbroad)} ${t("centsWord")}` },
          { key: "tx", className: "seg tax", cents: tax, infoId: taxId, name: `${t("legendTax")}: ${shown(tax)} ${t("centsWord")}` },
        ]
      : [
          { key: "hk", className: "seg home kept", cents: vaHome, infoId: keptId, name: `${t("keptIn", { place })}: ${shown(vaHome)} ${t("centsWord")}` },
          { key: "ht", className: "seg home tax", cents: taxHome, infoId: taxId, name: `${t("legendTax")}: ${shown(taxHome)} ${t("centsWord")}` },
          { key: "hp", className: "seg home pass", cents: passHome, infoId: passId, name: `${t("legendPass")}: ${shown(passHome)} ${t("centsWord")}` },
          { key: "ak", className: "seg abroad kept", cents: vaAbroad, infoId: abroadKeptId, name: `${t("legendKeptAbroad")}: ${shown(vaAbroad)} ${t("centsWord")}` },
          { key: "at", className: "seg abroad tax", cents: taxAbroad, infoId: taxId, name: `${t("legendTax")}: ${shown(taxAbroad)} ${t("centsWord")}` },
          { key: "ap", className: "seg abroad pass", cents: passAbroad, infoId: passId, name: `${t("legendPass")}: ${shown(passAbroad)} ${t("centsWord")}` },
        ];
    return { vaHome, vaAbroad, passHome, passAbroad, outputHome, outputAbroad, tax, keptId, abroadKeptId, outId, abroadOutId, segments: lay(parts) };
  };

  const direct = split(tiers[0] ?? emptyFallback(), 0, "tier0");
  const later = [1, 2, 3, 4].map((index) => split(tiers[index] ?? emptyFallback(), index, `tier${index}`));
  const keptSum = direct.vaHome + later.reduce((sum, row) => sum + row.vaHome, 0);
  const abroadSum = direct.vaAbroad + later.reduce((sum, row) => sum + row.vaAbroad, 0);
  const taxSum = (tiers[0]?.tax ?? 0) + later.reduce((sum, _row, index) => sum + (tiers[index + 1]?.tax ?? 0), 0);
  const taxCents = cents(taxSum, spend);
  open("sum", t("rows.sum"), t("what.added"), result.headlineSourceIds);

  const row = (id: string, labelKey: (typeof ROW_KEYS)[number], value: ReturnType<typeof split>, kept: boolean): StageRow => ({
    id,
    label: t(`rows.${labelKey}`),
    hint: t(`rows.${labelKey}Hint`),
    kept: kept ? shown(value.vaHome) : null,
    keptInfoId: kept ? value.keptId : null,
    keptName: kept ? `${t("keptIn", { place })}: ${shown(value.vaHome)} ${t("centsWord")}` : null,
    segments: value.segments,
  });

  const rows: StageRow[] = summary ? [] : [row("r0", "direct", direct, showSplit)];
  if (showJourney) {
    if (!summary) {
      rows.push(row("r1", "tier1", later[0], true));
      rows.push(row("r2", "tier2", later[1], true));
      rows.push(row("r3", "tier3", later[2], true));
      rows.push(row("r4", "tier4", later[3], true));
    }
    rows.push({
      id: "sum",
      label: t("rows.sum"),
      hint: t("rows.sumHint"),
      kept: shown(keptSum),
      keptInfoId: "sum",
      keptName: `${t("keptIn", { place })}: ${shown(keptSum)} ${t("centsWord")}`,
      segments: lay([
        { key: "hk", className: "seg home kept", cents: keptSum, infoId: "sum", name: `${t("keptIn", { place })}: ${shown(keptSum)} ${t("centsWord")}` },
        { key: "ak", className: "seg abroad kept", cents: abroadSum, infoId: "abroad", name: `${t("legendKeptAbroad")}: ${shown(abroadSum)} ${t("centsWord")}` },
        { key: "tx", className: "seg tax", cents: taxCents, infoId: "rest:tax", name: `${t("legendTax")}: ${shown(taxCents)} ${t("centsWord")}` },
      ]),
    });
  }

  const homeNote = summary
    ? []
    : showSplit
    ? [
        words("h0", `${t("noteIn", { place })} `),
        num("h1", shown(direct.vaHome), direct.keptId, `${t("keptIn", { place })}: ${shown(direct.vaHome)} ${t("centsWord")}`),
        words("h2", ` ${t("noteKept")}, `),
        num("h3", shown(direct.passHome), "tier0:pass", `${t("legendPass")}: ${shown(direct.passHome)} ${t("centsWord")}`),
        words("h4", ` ${t("notePassed")}`),
      ]
    : [
        words("h0", `${t("noteFirmsHome", { place })} `),
        num("h1", shown(direct.outputHome), direct.outId, `${t("legendHomeFirms", { place })}: ${shown(direct.outputHome)} ${t("centsWord")}`),
        words("h2", ` ${t("centsWord")}`),
      ];
  const abroadNote = summary
    ? []
    : showSplit
    ? [
        words("a0", `${t("noteAbroad")} `),
        num("a1", shown(direct.vaAbroad), direct.abroadKeptId, `${t("legendKeptAbroad")}: ${shown(direct.vaAbroad)} ${t("centsWord")}`),
        words("a2", ` ${t("noteKept")}, `),
        num("a3", shown(direct.passAbroad), "tier0:pass", `${t("legendPass")}: ${shown(direct.passAbroad)} ${t("centsWord")}`),
        words("a4", ` ${t("notePassed")}`),
      ]
    : [
        words("a0", `${t("noteFirmsAbroad")} `),
        num("a1", shown(direct.outputAbroad), direct.abroadOutId, `${t("legendAbroadFirms")}: ${shown(direct.outputAbroad)} ${t("centsWord")}`),
        words("a2", ` ${t("centsWord")}`),
      ];

  const sentence = level === 1
    ? [
        words("s0", t("lead1a")),
        num("s1", shown(direct.outputHome), direct.outId, `${shown(direct.outputHome)} ${t("centsWord")}`),
        words("s2", t("lead1b", { place })),
        num("s3", shown(direct.outputAbroad), direct.abroadOutId, `${shown(direct.outputAbroad)} ${t("centsWord")}`),
        words("s4", t("lead1c")),
      ]
    : level === 2
      ? [
          words("s0", t("lead2a", { place })),
          num("s1", shown(direct.vaHome), direct.keptId, `${shown(direct.vaHome)} ${t("centsWord")}`),
          words("s2", t("lead2b")),
          num("s3", shown(direct.passHome), "tier0:pass", `${shown(direct.passHome)} ${t("centsWord")}`),
          words("s4", t("lead2c")),
        ]
      : level === 3
        ? [
            words("s0", t("lead3a", { place })),
            num("s1", exact(keptSum), "sum", `${exact(keptSum)} ${t("centsWord")}`),
            words("s2", t("lead3c", { headline: centsOf(result.headlineShare) })),
          ]
        : level === 4
          ? [
              words("s0", t(state.servers === "tenant" ? "lead4aTenant" : "lead4a")),
              words("s1", t(lastShare < firstOpenShare ? "lead4Falls" : "lead4Is", { year: String(lastYear) })),
              num("s2", centsOf(lastShare), "years", `${t("yearLine", { year: String(lastYear) })} ${centsOf(lastShare)} ${t("centsWord")}`),
              words("s3", t("lead4c")),
            ]
          : [words("s0", t(level === 5 ? "lead5" : "lead6"))];

  const groups = result.countries
    .filter((bucket) => bucket.id !== home)
    .map((bucket) => ({
      id: bucket.id,
      label: data.meta.country_groups.find((group) => group.id === bucket.id)?.label ?? bucket.id,
      cents: cents(bucket.eur, spend),
    }));
  const top = groups.slice(0, 5);
  const rest = groups.slice(5).reduce((sum, group) => sum + group.cents, 0);
  open("abroad", t("legendKeptAbroad"), t("what.keptAbroad"), result.headlineSourceIds);
  const abroadLine: StagePart[] = showJourney && !summary
    ? [
        words("b0", t("abroadLead")),
        num("b1", shown(abroadSum), "abroad", `${t("legendKeptAbroad")}: ${shown(abroadSum)} ${t("centsWord")}`),
        words("b2", t("abroadMid")),
        ...top.flatMap((group, index) => [
          words(`g${index}a`, index === 0 ? "" : ", "),
          words(`g${index}b`, `${group.label} `),
          num(`g${index}c`, shown(group.cents), `country:${group.id}`, `${group.label}: ${shown(group.cents)} ${t("centsWord")}`),
        ]),
        ...(groups.length > 5
          ? [words("restA", t("abroadOthers")), num("restB", shown(rest), "abroad", `${t("abroadOthersLabel")}: ${shown(rest)} ${t("centsWord")}`)]
          : []),
        words("bend", "."),
      ]
    : [];

  const schedule = data.lifecycle[state.site][state.archetype][state.scenario];
  const geometry = yearsGeometry(
    result.shareByYear,
    result.bandLowByYear,
    result.bandHighByYear,
    schedule.milestones.map((mark) => mark.year),
    state.year,
  );

  return {
    steps: NAMES.map((name, index) => {
      const n = index + 1;
      return {
        id: name,
        mark: String(n),
        kicker: t("ladderKicker", { level: String(n) }),
        name: t(`ladder.${name}`),
        current: n === level,
        done: n < level,
      };
    }),
    kicker: t("levelKicker", { level: String(level), count: String(levelCount()) }),
    title: t(`ladder.${NAMES[level - 1] ?? "who"}`),
    sentence,
    summary,
    showMap: level === MAP_LEVEL,
    legend: summary
      ? [
          { id: "home", className: "swatch home", label: t("legendKeptHome", { place }) },
          { id: "abroad", className: "swatch abroad", label: t("legendKeptAbroad") },
          { id: "tax", className: "swatch tax", label: t("legendTax") },
        ]
      : showSplit
      ? [
          { id: "home", className: "swatch home", label: t("legendKeptHome", { place }) },
          { id: "abroad", className: "swatch abroad", label: t("legendKeptAbroad") },
          { id: "pass", className: "swatch pass", label: t("legendPass") },
          { id: "tax", className: "swatch tax", label: t("legendTax") },
        ]
      : [
          { id: "home", className: "swatch home", label: t("legendHomeFirms", { place }) },
          { id: "abroad", className: "swatch abroad", label: t("legendAbroadFirms") },
        ],
    homeNote,
    abroadNote,
    keptHead: showJourney ? t("keptIn", { place }) : null,
    rows,
    abroadLine,
    years: level === YEARS_LEVEL
      ? {
          ...geometry,
          label: t("sparkLabel"),
          caption: t("yearsCaption"),
          guideLabels: Object.fromEntries(geometry.grid.map((guide) => [guide.id, t("yearsGuide", { cents: String(guide.cents) })])),
        }
      : null,
    showYear: level >= 4,
    showTotals: level >= 5,
    showCase: level >= 6,
    tap: t("tap"),
    hint: t(level === YEARS_LEVEL && state.servers === "tenant" ? "hint.yearsTenant" : `hint.${NAMES[level - 1] ?? "who"}`),
    compareLine: level === COMPARE_LEVEL
      ? [
          words("c0", t("compareLead")),
          num("c1", centsOf(result.buildEuroShare), "compare", `${t("compareName")}: ${centsOf(result.buildEuroShare)} ${t("centsWord")}`),
          words("c2", t("compareTail", { place })),
        ]
      : [],
    back: t("stepBack"),
    next: level < levelCount() ? t("nextTo", { name: t(`ladder.${NAMES[level] ?? "case"}`) }) : t("next"),
    canBack: level > 1,
    canNext: level < levelCount(),
    opens,
  };
}

function emptyFallback(): TierCents {
  return {
    outputHome: 0, outputAbroad: 0, vaHome: 0, vaAbroad: 0,
    passHome: 0, passAbroad: 0, taxHome: 0, taxAbroad: 0, tax: 0,
  };
}
