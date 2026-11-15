import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Assumptions, Dataset, Fingerprints, Lifecycle, Meta } from "../data/types";
import { compute } from "./compute";
import { caseQuery, isChanged, readCase } from "./link";
import { defaultState, withCurrency, withElectricity, withHeat, withServers, withShare, withSite, withSize } from "./state";

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

describe("the case in the link", () => {
  const data = servedData();
  const start = defaultState(data);

  it("writes nothing for the starting case", () => {
    expect(caseQuery(start, data)).toBe("");
    expect(isChanged(start, data)).toBe(false);
    expect(readCase("", data)).toEqual(start);
  });

  it("writes only the site when only the site changes, though its currency and shares change with it", () => {
    const zurich = withSite(start, data, "zurich");
    expect(zurich.currency).toBe("CHF");
    expect(caseQuery(zurich, data)).toBe("?site=zurich");
    expect(readCase("?site=zurich", data)).toEqual(zurich);
  });

  it("opens the same case and the same figures from its own link", () => {
    const cases = [
      { ...start, year: 20 },
      { ...withSize(start, "50"), archetype: "cloud" as const, year: 12 },
      withShare(withShare(start, "it_hardware", "0.4"), "electrical", "0.55"),
      { ...withElectricity(withHeat(withServers(start, "tenant"), data, true), "contract"), year: 9 },
      withCurrency(withSize(withSite(start, data, "geneva"), "12.5"), "EUR"),
      { ...withShare(withSite(start, data, "lugano"), "cooling", "0"), year: 1 },
    ];
    for (const view of cases) {
      const query = caseQuery(view, data);
      expect(isChanged(view, data)).toBe(true);
      const opened = readCase(query, data);
      expect(opened, query).toEqual(view);
      expect(compute(data, opened).headlineShare).toBe(compute(data, view).headlineShare);
      expect(caseQuery(opened, data)).toBe(query);
    }
  });

  it("writes a whole case in plain words", () => {
    const view = { ...withHeat(withShare(withSize(start, "100"), "it_hardware", "0.1"), data, true), year: 20 };
    expect(caseQuery(view, data)).toBe("?mw=100&year=20&it=10&heat=on");
  });

  it("keeps the default for anything it does not understand", () => {
    const opened = readCase("?site=paris&type=quantum&mw=-3&year=soon&it=lots&servers=nobody&power=coal&money=USD&x=1", data);
    expect(opened).toEqual(start);
  });

  it("keeps numbers inside their limits", () => {
    const opened = readCase("?year=99&it=250&cooling=-20", data);
    expect(opened.year).toBe(20);
    expect(opened.sourcing.it_hardware).toBe(1);
    expect(opened.sourcing.cooling).toBe(0);
  });

  it("leaves heat off where the site has no network, whatever the link says", () => {
    expect(readCase("?site=lugano&heat=on", data).heat).toBe(false);
    expect(readCase("?site=vienna&heat=on", data).heat).toBe(true);
  });
});
