import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Assumptions, Dataset, Fingerprints, Lifecycle, Meta } from "../data/types";
import { compute } from "./compute";
import { energyInAYear } from "./energy";
import { present } from "./present";
import { yearsGeometry } from "./spark";
import { defaultState, withHeat, withLevelYear, withSite } from "./state";

const webRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

function servedData(): Dataset {
  const dir = resolve(webRoot, "public/data");
  const load = <T>(name: string) => JSON.parse(readFileSync(resolve(dir, name), "utf8")) as T;
  return {
    meta: load<Meta>("meta.json"),
    fingerprints: load<Fingerprints>("fingerprints.json"),
    lifecycle: load<Lifecycle>("lifecycle.json"),
    assumptions: load<Assumptions>("assumptions.json"),
  };
}

function sentence(data: Dataset, level: number): string {
  const view = defaultState(data);
  const shown = present(data, view, compute(data, view), { playing: false, reduced: true, level });
  return shown.stage.sentence.map((part) => part.text).join("");
}

describe("heat switch", () => {
  const data = servedData();

  it("starts off, even where the site has a heat network", () => {
    const view = defaultState(data);
    expect(data.meta.sites.find((site) => site.id === view.site)?.heat_available).toBe(true);
    expect(view.heat).toBe(false);
  });

  it("keeps the reader's choice across sites and stays off where there is no network", () => {
    const on = withHeat(defaultState(data), data, true);
    expect(withSite(on, data, "zurich").heat).toBe(true);
    const lugano = withSite(on, data, "lugano");
    expect(lugano.heat).toBe(false);
    expect(withSite(lugano, data, "vienna").heat).toBe(false);
  });

  it("leaves the heat offset out of the carbon sentence while the switch is off", () => {
    const view = defaultState(data);
    const shown = present(data, view, compute(data, view), { playing: false, reduced: true, level: 5 });
    expect(shown.panels.carbon.pieces.some((piece) => piece.key === "offset")).toBe(false);
    const heated = withHeat(view, data, true);
    const shownOn = present(data, heated, compute(data, heated), { playing: false, reduced: true, level: 5 });
    expect(shownOn.panels.carbon.pieces.some((piece) => piece.key === "offset")).toBe(true);
  });
});

describe("ladder copy", () => {
  const data = servedData();

  it("gives every level its own sentence", () => {
    const texts = [1, 2, 3, 4, 5, 6].map((level) => sentence(data, level));
    expect(new Set(texts).size).toBe(6);
  });

  it("ties the level 3 total to the whole cents at the top", () => {
    const view = defaultState(data);
    const result = compute(data, view);
    const top = Math.round(result.headlineShare * 100);
    const text = sentence(data, 3);
    const total = Number(text.match(/you get (\d+\.\d\d) cents/)?.[1]);
    expect(Math.round(total)).toBe(top);
    expect(text).toContain(`the ${top} at the top`);
  });

  it("says the figure falls by the last year when it does", () => {
    const view = defaultState(data);
    const result = compute(data, view);
    const last = result.shareByYear[result.shareByYear.length - 1];
    expect(last).toBeLessThan(result.shareByYear[1]);
    expect(sentence(data, 4)).toContain(`falls to ${Math.round(last * 100)} cents`);
  });
});

describe("years chart", () => {
  it("puts the first year at the left edge, the last at the right, and zero at the bottom", () => {
    const geometry = yearsGeometry([0.5, 0.25, 0], [0.4, 0.2, 0], [0.55, 0.3, 0.1], [1, 3], 2);
    expect(geometry.marks.map((mark) => mark.left)).toEqual(["0%", "100%"]);
    expect(geometry.marks[1].top).toBe("100%");
    expect(geometry.now.left).toBe("50%");
    expect(geometry.grid.map((guide) => guide.cents)).toEqual([20, 40, 60]);
    expect(geometry.grid[2].top).toBe("0%");
  });

  it("uses guides every 10 cents when the line stays low", () => {
    const geometry = yearsGeometry([0.3, 0.2], [0.25, 0.15], [0.35, 0.25], [], 1);
    expect(geometry.grid.map((guide) => guide.cents)).toEqual([10, 20, 30, 40]);
  });
});

describe("energy in a year of operation", () => {
  const data = servedData();

  it("splits site electricity into the IT load and the rest by PUE", () => {
    const view = defaultState(data);
    const energy = energyInAYear(data, view, false);
    expect(energy).not.toBeNull();
    if (!energy) return;
    const pue = data.assumptions.find((entry) => entry.id === `pue.${view.archetype}`)?.central ?? 0;
    expect(energy.itMwh + energy.otherMwh).toBeCloseTo(energy.siteMwh, 9);
    expect(energy.siteMwh / energy.itMwh).toBeCloseTo(pue, 9);
    expect(energy.heatPumpMwh).toBe(0);
  });

  it("scales with size and adds the heat pumps only when heat recovery is on", () => {
    const view = defaultState(data);
    const one = energyInAYear(data, view, false);
    const three = energyInAYear(data, { ...view, sizeMw: 3 }, false);
    expect(three?.siteMwh).toBeCloseTo((one?.siteMwh ?? 0) * 3, 6);
    const heated = energyInAYear(data, view, true);
    expect(heated?.heatPumpMwh).toBeGreaterThan(0);
    expect(heated?.siteMwh).toBeCloseTo(one?.siteMwh ?? 0, 9);
  });
});

describe("servers bought by a tenant", () => {
  const data = servedData();

  it("leaves the tenant's kit out of spend, so the figure stays higher over twenty years", () => {
    const whole = { ...defaultState(data), year: 20 };
    const own = compute(data, whole);
    const let_ = compute(data, { ...whole, servers: "tenant" });
    const itSpend = data.lifecycle[whole.site][whole.archetype].central.spend.it_hardware.reduce((sum, value) => sum + value, 0);
    expect(own.spendEur - let_.spendEur).toBeCloseTo(itSpend * whole.sizeMw, 3);
    expect(let_.headlineShare).toBeGreaterThan(own.headlineShare);
  });

  it("changes nothing during the build, before any servers are bought", () => {
    const view = defaultState(data);
    expect(compute(data, { ...view, servers: "tenant" }).headlineShare).toBeCloseTo(compute(data, view).headlineShare, 12);
  });

  it("gives a yardstick between zero and one euro for ordinary building work", () => {
    const share = compute(data, defaultState(data)).buildEuroShare;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(1);
  });
});

describe("level year progression and source explanations", () => {
  const data = servedData();

  it("moves from the build year to the twenty-year view at level 4 and keeps custom years across levels 4 to 6", () => {
    const start = defaultState(data);
    expect(start.year).toBe(2);
    expect(withLevelYear(start, data, 3).year).toBe(2);
    const level4 = withLevelYear(start, data, 4);
    expect(level4.year).toBe(20);
    const custom = { ...level4, year: 10 };
    expect(withLevelYear(custom, data, 5).year).toBe(10);
    expect(withLevelYear(custom, data, 6).year).toBe(10);
    expect(withLevelYear(custom, data, 3).year).toBe(2);
  });

  it("resolves every source card without missing entries across sites, years and levels", () => {
    for (const siteId of ["vienna", "zurich", "lugano"] as const) {
      for (const level of [1, 2, 3, 4, 5, 6]) {
        const viewState = withLevelYear(withSite(defaultState(data), data, siteId), data, level);
        const shown = present(data, viewState, compute(data, viewState), { playing: false, reduced: true, level });
        for (const [id, exp] of Object.entries(shown.explanations)) {
          if (id !== "size") expect(exp.sources.length, `${siteId} L${level} ${id}`).toBeGreaterThan(0);
          for (const card of exp.sources) {
            for (const line of card.lines) {
              expect(line.text, `${siteId} L${level} ${id} -> ${card.key}`).not.toContain("No entry for source");
            }
          }
        }
        const checkParts = (parts: { infoId: string | null }[]) => {
          for (const part of parts) {
            if (part.infoId) expect(shown.explanations[part.infoId], `${siteId} L${level} part ${part.infoId}`).toBeDefined();
          }
        };
        checkParts(shown.restParts);
        checkParts(shown.bandParts);
        checkParts(shown.stage.sentence);
        checkParts(shown.stage.homeNote);
        checkParts(shown.stage.abroadNote);
        checkParts(shown.stage.abroadLine);
        checkParts(shown.stage.compareLine);
        for (const row of shown.stage.rows) {
          if (row.keptInfoId) expect(shown.explanations[row.keptInfoId]).toBeDefined();
          for (const seg of row.segments) expect(shown.explanations[seg.infoId]).toBeDefined();
        }
      }
    }
  });

  it("wires abroad, product tax, country and heat dialogs to their own titles and assumptions", () => {
    const base = defaultState(data);
    const l1 = present(data, base, compute(data, base), { playing: false, reduced: true, level: 1 });
    expect(l1.stage.rows[0]?.segments.map((s) => s.infoId)).toEqual(["tier0:out", "tier0:abroadOut"]);
    expect(l1.explanations["tier0:out"]?.title).toBe("Firms in Austria");
    expect(l1.explanations["tier0:abroadOut"]?.title).toBe("Firms abroad");
    expect(l1.restParts.find((p) => p.key === "r1")?.infoId).toBe("rest");
    expect(l1.restParts.find((p) => p.key === "r3")?.infoId).toBe("rest:tax");
    expect(l1.explanations["rest:tax"]?.title).toBe("Product taxes");

    const l2 = present(data, base, compute(data, base), { playing: false, reduced: true, level: 2 });
    expect(l2.stage.abroadNote.find((p) => p.key === "a1")?.infoId).toBe("tier0:abroadKept");
    expect(l2.explanations["tier0:abroadKept"]?.title).toBe("Kept abroad");

    const l3 = present(data, base, compute(data, base), { playing: false, reduced: true, level: 3 });
    expect(l3.explanations.abroad?.what).toBe("Wages and profits kept by firms abroad.");
    const firstCountry = l3.stage.abroadLine.find((p) => p.key === "g0c");
    expect(firstCountry?.infoId).toMatch(/^country:/);

    const heatSources = l3.explanations.heat?.sources.map((s) => s.key) ?? [];
    expect(heatSources).toContain("heat_recovery_share");
    expect(heatSources).toContain("heat_pump_cop");
    expect(heatSources.some((key) => key.startsWith("cross_border_share."))).toBe(false);
  });
});
