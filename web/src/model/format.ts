const euros = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const francs = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "CHF",
  maximumFractionDigits: 0,
});
const grouped = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const precise = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 });
const percent = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 });
const wholePercent = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 0 });
const wholeNumber = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
/** At or above this many tonnes, a decimal place claims more precision than the model has. */
const WHOLE_TONNES_FROM = 10;
const assumptionNumber = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 });

export function formatMoney(amount: number, currency: "EUR" | "CHF"): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const millions = amount / 1_000_000;
    const digits = Math.abs(millions) >= 100 ? 0 : 1;
    const unit = currency === "CHF" ? "CHF " : "€";
    return `${unit}${millions.toFixed(digits)} million`;
  }
  return currency === "CHF" ? francs.format(amount) : euros.format(amount);
}

export function formatCount(value: number): string {
  return grouped.format(value);
}

/** Whole numbers with thousands separators, for megawatt-hours. */
export function formatWhole(value: number): string {
  return wholeNumber.format(value);
}

export function formatShare(value: number): string {
  return percent.format(value);
}

/** Sourcing sliders move in whole percent, so their labels do too. */
export function formatWholeShare(value: number): string {
  return wholePercent.format(value);
}

export function formatPrecise(value: number): string {
  return precise.format(value);
}

export function centsOf(share: number): string {
  return String(Math.round(share * 100));
}

export function formatCentimes(cents: number): string {
  return (Math.round(cents * 10) / 10).toFixed(1);
}

export function formatCarbon(kg: number): { amount: string; unit: "tonnes" | "kg" } {
  const perTonne = 1000;
  if (Math.abs(kg) >= perTonne) {
    const tonnes = kg / perTonne;
    const shaped = Math.abs(tonnes) >= WHOLE_TONNES_FROM ? wholeNumber : grouped;
    return { amount: shaped.format(tonnes), unit: "tonnes" };
  }
  return { amount: wholeNumber.format(kg), unit: "kg" };
}

export function formatAssumption(value: number, unit: string): string {
  if (unit === "share") return percent.format(value);
  return `${assumptionNumber.format(value)} ${unit}`;
}

export function barWidth(part: number, whole: number): string {
  if (!(whole > 0)) return "0%";
  const pct = Math.min(100, Math.max(0, (part / whole) * 100));
  return `${pct}%`;
}

export function markLeft(year: number, min: number, max: number): string {
  if (max === min) return "0%";
  return `${((year - min) / (max - min)) * 100}%`;
}

/** Keeps the first and last marks inside the slider instead of hanging off the ends. */
export function markPlace(year: number, min: number, max: number): "start" | "middle" | "end" {
  if (max === min) return "start";
  const ratio = (year - min) / (max - min);
  if (ratio <= 0.12) return "start";
  if (ratio >= 0.88) return "end";
  return "middle";
}
