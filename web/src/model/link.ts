import type { ArchetypeId, Dataset, SiteId } from "../data/types";
import {
  defaultState,
  SAME_SHARE,
  withArchetype,
  withCurrency,
  withElectricity,
  withHeat,
  withServers,
  withShare,
  withSite,
  withSize,
  withYear,
  yearBounds,
  type SliderId,
  type ViewState,
} from "./state";

/**
 * The case on screen as a query string, so a link opens the same case for someone else.
 * Only what the reader changed is written: a control left at its default follows the data.
 */
const SLIDER_KEYS: Record<SliderId, string> = { electrical: "electrical", cooling: "cooling", it_hardware: "it" };
const PERCENT = 100;
/** Shares travel as percentages with two decimals at most, which is finer than a slider step. */
const PERCENT_STEPS = 100;

function percent(share: number): string {
  return String(Math.round(share * PERCENT * PERCENT_STEPS) / PERCENT_STEPS);
}

/** The starting case for a site: its own currency and the table's sourcing shares. */
function startFor(data: Dataset, site: SiteId): ViewState {
  return withSite(defaultState(data), data, site);
}

export function caseQuery(state: ViewState, data: Dataset): string {
  const first = defaultState(data);
  const start = startFor(data, state.site);
  const params = new URLSearchParams();
  if (state.site !== first.site) params.set("site", state.site);
  if (state.archetype !== start.archetype) params.set("type", state.archetype);
  if (state.sizeMw !== start.sizeMw) params.set("mw", String(state.sizeMw));
  if (state.year !== start.year) params.set("year", String(state.year));
  for (const id of Object.keys(SLIDER_KEYS) as SliderId[]) {
    if (Math.abs(state.sourcing[id] - start.sourcing[id]) > SAME_SHARE) params.set(SLIDER_KEYS[id], percent(state.sourcing[id]));
  }
  if (state.heat) params.set("heat", "on");
  if (state.servers !== start.servers) params.set("servers", state.servers);
  if (state.electricityView !== start.electricityView) params.set("power", state.electricityView);
  if (state.currency !== start.currency) params.set("money", state.currency);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Reads a query string back into a case. Anything missing or not understood stays at its default. */
export function readCase(search: string, data: Dataset): ViewState {
  const params = new URLSearchParams(search);
  let state = defaultState(data);
  const site = params.get("site");
  if (site && data.meta.sites.some((entry) => entry.id === site)) state = withSite(state, data, site as SiteId);
  const type = params.get("type");
  if (type && type in data.lifecycle[state.site]) state = withArchetype(state, type as ArchetypeId);
  const size = params.get("mw");
  if (size !== null) state = withSize(state, size);
  const year = params.get("year");
  if (year !== null && year.trim() !== "") {
    const schedule = data.lifecycle[state.site][state.archetype][state.scenario];
    state = withYear(state, year, yearBounds(schedule.spend.construction.length));
  }
  for (const id of Object.keys(SLIDER_KEYS) as SliderId[]) {
    const raw = params.get(SLIDER_KEYS[id]);
    if (raw === null || raw.trim() === "" || !Number.isFinite(Number(raw))) continue;
    state = withShare(state, id, String(Number(raw) / PERCENT));
  }
  if (params.get("heat") === "on") state = withHeat(state, data, true);
  const servers = params.get("servers");
  if (servers === "own" || servers === "tenant") state = withServers(state, servers);
  const power = params.get("power");
  if (power === "grid" || power === "contract") state = withElectricity(state, power);
  const money = params.get("money");
  if (money === "EUR" || money === "CHF") state = withCurrency(state, money);
  return state;
}

/** True when the case differs from the starting case, so a reset has something to do. */
export function isChanged(state: ViewState, data: Dataset): boolean {
  return caseQuery(state, data) !== "";
}
