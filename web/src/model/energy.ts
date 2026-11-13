import type { Dataset } from "../data/types";
import type { ViewState } from "./state";

export interface EnergyYear {
  /** Site electricity in a year of operation, heat pumps left out, in MWh. */
  siteMwh: number;
  /** The part used by servers, storage and network. */
  itMwh: number;
  /** The rest: cooling, lighting and power losses. */
  otherMwh: number;
  /** Extra electricity for the heat pumps, zero when heat recovery is off. */
  heatPumpMwh: number;
  pue: number;
  sourceIds: string[];
}

/**
 * Electricity in the first year of operation, for the size on screen. Every operating year uses
 * the same load, so one year stands for all of them. The page shows the central scenario, so PUE
 * is the central assumption, the one the schedule was built with.
 */
export function energyInAYear(data: Dataset, state: ViewState, heatOn: boolean): EnergyYear | null {
  const schedule = data.lifecycle[state.site][state.archetype][state.scenario];
  const index = schedule.electricity_mwh.findIndex((mwh) => mwh > 0);
  if (index < 0) return null;
  const pueId = `pue.${state.archetype}`;
  const pue = data.assumptions.find((entry) => entry.id === pueId)?.central;
  if (pue === undefined || !(pue > 0)) throw new Error(`Missing assumption ${pueId}`);
  const siteMwh = schedule.electricity_mwh[index] * state.sizeMw;
  const itMwh = siteMwh / pue;
  const heatIds = heatOn ? ["heat_recovery_share", "heat_pump_cop"] : [];
  return {
    siteMwh,
    itMwh,
    otherMwh: siteMwh - itMwh,
    heatPumpMwh: heatOn ? schedule.heat_pump_mwh[index] * state.sizeMw : 0,
    pue,
    sourceIds: [`it_load_factor.${state.archetype}`, pueId, ...heatIds],
  };
}
