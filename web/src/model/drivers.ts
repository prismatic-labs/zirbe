import type { Dataset, Purchaser, Schedule, Variant } from "../data/types";
import { staffFingerprint } from "./staff";
import { readerShare, type ViewState } from "./state";

/** The headline with one assumption at its low and at its high value, the others as on screen. */
export interface Driver {
  id: string;
  low: number;
  high: number;
}

/** A move this small would not show in cents with one decimal, so it is not listed. */
const TOO_SMALL_TO_SHOW = 0.0005;

/**
 * The headline for the case on screen with a variant laid over the central schedule.
 * It follows the main run (tenant kit, heat switch, reader's sliders, year on screen)
 * but keeps only what the headline needs, so many variants cost little.
 */
export function headlineWith(
  data: Dataset,
  state: ViewState,
  schedule: Schedule,
  home: Purchaser,
  heatOn: boolean,
  changed: Variant,
): number {
  const through = Math.min(state.year, schedule.spend.construction.length);
  let spent = 0;
  let kept = 0;
  for (const category of data.meta.categories) {
    if (state.servers === "tenant" && category.payer === "tenant") continue;
    if (category.id === "heat_recovery" && !heatOn) continue;
    const series = changed.spend?.[category.id] ?? schedule.spend[category.id];
    const heatPumps = category.id === "electricity" && heatOn
      ? changed.heat_pump_spend ?? schedule.heat_pump_spend
      : null;
    let sum = 0;
    for (let index = 0; index < through; index += 1) sum += series[index] + (heatPumps ? heatPumps[index] : 0);
    if (sum === 0) continue;
    let atHome: number;
    if (category.id === "staff") {
      atHome = staffFingerprint(home).va[home] ?? 0;
    } else {
      const pair = data.fingerprints[home][category.id];
      // A slider the reader has moved wins, as it does in the stress test.
      const share = readerShare(data, pair, category.id, state)
        ?? changed.domestic_share?.[category.id]
        ?? pair.default_domestic_share;
      atHome = share * (pair.domestic.va[home] ?? 0) + (1 - share) * (pair.imported.va[home] ?? 0);
    }
    spent += sum;
    kept += sum * atHome;
  }
  return spent > 0 ? kept / spent : 0;
}

/** Every assumption that moves the headline for the case on screen, largest move first. */
export function headlineDrivers(
  data: Dataset,
  state: ViewState,
  central: Schedule,
  home: Purchaser,
  heatOn: boolean,
): Driver[] {
  const found: Driver[] = [];
  for (const [id, ends] of Object.entries(central.variants ?? {})) {
    const low = headlineWith(data, state, central, home, heatOn, ends.low);
    const high = headlineWith(data, state, central, home, heatOn, ends.high);
    if (Math.abs(high - low) < TOO_SMALL_TO_SHOW) continue;
    found.push({ id, low, high });
  }
  return found.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low) || a.id.localeCompare(b.id));
}
