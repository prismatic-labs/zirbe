export interface YearsGeometry {
  /** Paths in a 0 to 100 box, drawn stretched to the plot. */
  viewBox: string;
  band: string;
  line: string;
  /** Horizontal guides, as a CSS top and the cents they mark. */
  grid: { id: string; top: string; cents: number }[];
  /** Milestone diamonds on the line, as CSS left and top. */
  marks: { id: string; left: string; top: string }[];
  /** The year on the slider. */
  now: { left: string; top: string };
}

const GUIDE_STEP_SMALL = 10;
const GUIDE_STEP_LARGE = 20;
/** Above this many cents the guides go every 20 cents, so there are at most four. */
const LARGE_ABOVE = 40;
const FULL = 100;

function pct(value: number): string {
  return `${Math.round(value * 1000) / 1000}%`;
}

/**
 * The headline in every year from the first to the last, with the stress test as a band.
 * The x scale runs from the first year at 0% to the last at 100%, the same as the year slider,
 * so the line sits straight above it. The y scale starts at zero cents.
 */
export function yearsGeometry(
  central: number[],
  low: number[],
  high: number[],
  milestoneYears: number[],
  selectedYear: number,
): YearsGeometry {
  const count = central.length;
  const upper = central.map((value, index) => Math.max(value, low[index] ?? value, high[index] ?? value));
  const lower = central.map((value, index) => Math.min(value, low[index] ?? value, high[index] ?? value));
  const peakCents = Math.max(...upper, 0) * 100;
  const step = peakCents > LARGE_ABOVE ? GUIDE_STEP_LARGE : GUIDE_STEP_SMALL;
  const topCents = Math.max(step, Math.ceil(peakCents / step) * step);
  const xOf = (index: number) => (count <= 1 ? 0 : (index / (count - 1)) * 100);
  const yOf = (share: number) => 100 - ((share * 100) / topCents) * 100;

  const forward = lower.map((value, index) => `${index === 0 ? "M" : "L"} ${xOf(index)} ${yOf(value)}`);
  const back = [...upper].reverse().map((value, index) => `L ${xOf(count - 1 - index)} ${yOf(value)}`);
  const line = central.map((value, index) => `${index === 0 ? "M" : "L"} ${xOf(index)} ${yOf(value)}`).join(" ");

  const grid: YearsGeometry["grid"] = [];
  for (let cents = step; cents <= topCents; cents += step) {
    grid.push({ id: `guide-${cents}`, top: pct(100 - (cents / topCents) * 100), cents });
  }

  const marks = [...new Set(milestoneYears)]
    .filter((year) => year >= 1 && year <= count)
    .map((year) => ({ id: `years-${year}`, left: pct(xOf(year - 1)), top: pct(yOf(central[year - 1] ?? 0)) }));

  const index = Math.min(count, Math.max(1, selectedYear)) - 1;
  return {
    viewBox: `0 0 ${FULL} ${FULL}`,
    band: count ? `${forward.join(" ")} ${back.join(" ")} Z` : "",
    line,
    grid,
    marks,
    now: { left: pct(xOf(index)), top: pct(yOf(central[index] ?? 0)) },
  };
}
