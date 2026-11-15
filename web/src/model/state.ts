import type { ArchetypeId, CategoryId, Dataset, Purchaser, SiteId } from "../data/types";

/** Schedules are per MW, so the page opens at one MW. Totals scale. Shares do not. */
export const SIZE_IN_DATA_UNITS = 1;

export type SliderId = Extract<CategoryId, "electrical" | "cooling" | "it_hardware">;

export interface ViewState {
  site: SiteId;
  archetype: ArchetypeId;
  scenario: "low_impact" | "central" | "high_impact";
  sizeMw: number;
  year: number;
  sourcing: Record<SliderId, number>;
  heat: boolean;
  /** Who buys the servers, storage and network kit: the reader, or a tenant. A tenant's kit leaves the spend. */
  servers: "own" | "tenant";
  electricityView: "grid" | "contract";
  currency: "EUR" | "CHF";
}

const FIRST_YEAR = 1;
/** The page opens at year 2, the construction view, before the first IT fit-out. */
export const OPEN_YEAR = 2;

export function yearBounds(length: number): { min: number; max: number } {
  return { min: FIRST_YEAR, max: length };
}

export function shareBounds(): { min: number; max: number; step: string } {
  return { min: 0, max: 1, step: "0.01" };
}

export function sizeField(): { min: number; step: string } {
  return { min: 0, step: "any" };
}

function clampShare(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function defaultSourcing(data: Dataset, country: Purchaser): Record<SliderId, number> {
  const book = data.fingerprints[country];
  const sourcing = {} as Record<SliderId, number>;
  for (const category of data.meta.categories) {
    if (!category.has_slider || category.id === "staff") continue;
    if (category.id !== "electrical" && category.id !== "cooling" && category.id !== "it_hardware") continue;
    sourcing[category.id] = book[category.id].default_domestic_share;
  }
  return sourcing;
}

export function defaultState(data: Dataset): ViewState {
  const site = data.meta.sites[0];
  const archetype: ArchetypeId = "ai";
  const bounds = yearBounds(data.lifecycle[site.id][archetype].central.spend.construction.length);
  return {
    site: site.id,
    archetype,
    scenario: "central",
    sizeMw: SIZE_IN_DATA_UNITS,
    year: Math.min(bounds.max, Math.max(bounds.min, OPEN_YEAR)),
    sourcing: defaultSourcing(data, site.country),
    /** The heat switch starts off. Its inputs are estimates, so the reader opts in. */
    heat: false,
    servers: "own",
    electricityView: "grid",
    currency: site.currency,
  };
}

export function withSite(state: ViewState, data: Dataset, siteId: SiteId): ViewState {
  const site = data.meta.sites.find((entry) => entry.id === siteId);
  if (!site) return state;
  return {
    ...state,
    site: siteId,
    currency: site.currency,
    heat: state.heat && site.heat_available,
    sourcing: defaultSourcing(data, site.country),
  };
}

export function withArchetype(state: ViewState, archetype: ArchetypeId): ViewState {
  return { ...state, archetype };
}

export function withYear(state: ViewState, raw: string, bounds: { min: number; max: number }): ViewState {
  const value = Number(raw);
  if (!Number.isFinite(value)) return state;
  const year = Math.round(Math.min(bounds.max, Math.max(bounds.min, value)));
  return { ...state, year };
}

export function withSize(state: ViewState, raw: string): ViewState {
  const value = Number(raw);
  if (!Number.isFinite(value) || !(value > 0)) return state;
  return { ...state, sizeMw: value };
}

export function withShare(state: ViewState, id: SliderId, raw: string): ViewState {
  const value = Number(raw);
  if (!Number.isFinite(value)) return state;
  return { ...state, sourcing: { ...state.sourcing, [id]: clampShare(value) } };
}

export function withHeat(state: ViewState, data: Dataset, on: boolean): ViewState {
  const site = data.meta.sites.find((entry) => entry.id === state.site);
  if (!site?.heat_available) return { ...state, heat: false };
  return { ...state, heat: on };
}

export function withServers(state: ViewState, servers: ViewState["servers"]): ViewState {
  return { ...state, servers };
}

export function withElectricity(state: ViewState, view: ViewState["electricityView"]): ViewState {
  return { ...state, electricityView: view };
}

export function withCurrency(state: ViewState, currency: ViewState["currency"]): ViewState {
  return { ...state, currency };
}

export function restartIfEnded(state: ViewState, data: Dataset): ViewState {
  const bounds = yearBounds(data.lifecycle[state.site][state.archetype][state.scenario].spend.construction.length);
  if (state.year >= bounds.max) return { ...state, year: bounds.min };
  return state;
}

export function stepPlay(state: ViewState, data: Dataset): ViewState {
  const bounds = yearBounds(data.lifecycle[state.site][state.archetype][state.scenario].spend.construction.length);
  if (state.year >= bounds.max) return state;
  return { ...state, year: state.year + 1 };
}

/** Two shares this close are the same slider position. */
export const SAME_SHARE = 0.0005;

export function hasSlider(data: Dataset, id: CategoryId): id is SliderId {
  return data.meta.categories.some((category) => category.id === id && category.has_slider)
    && id !== "staff"
    && (id === "electrical" || id === "cooling" || id === "it_hardware");
}

/** The share the reader set on a sourcing slider, or null while the slider sits at the table default. */
export function readerShare(
  data: Dataset,
  pair: { default_domestic_share: number },
  categoryId: CategoryId,
  state: ViewState,
): number | null {
  if (hasSlider(data, categoryId) && Math.abs(state.sourcing[categoryId] - pair.default_domestic_share) > SAME_SHARE) {
    return state.sourcing[categoryId];
  }
  return null;
}
