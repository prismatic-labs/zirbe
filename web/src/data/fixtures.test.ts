import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { blend } from "../model/blend";
import { fingerprintProblems } from "../model/checks";
import type { Assumptions, Fingerprints, Meta } from "./types";

const webRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const repoRoot = resolve(webRoot, "..");
const dataDir = resolve(webRoot, "public/data");

function python(): string {
  const candidates = [
    resolve(repoRoot, ".venv/bin/python"),
    resolve(repoRoot, "../zirbe/.venv/bin/python"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? "python3";
}

describe("fixtures", () => {
  it("matches the schemas", () => {
    const result = spawnSync(python(), ["-m", "engine", "validate", dataDir], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it("obeys the fingerprint identities and a plausible shape", () => {
    const fingerprints = JSON.parse(readFileSync(resolve(dataDir, "fingerprints.json"), "utf8")) as Fingerprints;
    for (const home of ["AT", "CH"] as const) {
      for (const [name, pair] of Object.entries(fingerprints[home])) {
        expect(pair.default_domestic_share).toBeGreaterThanOrEqual(0);
        expect(pair.default_domestic_share).toBeLessThanOrEqual(1);
        expect(pair.domestic_share_low).toBeLessThanOrEqual(pair.default_domestic_share);
        expect(pair.domestic_share_high).toBeGreaterThanOrEqual(pair.default_domestic_share);
        if (name === "it_hardware") expect(pair.domestic_share_low).toBeLessThan(pair.domestic_share_high);
        else {
          expect(pair.domestic_share_low).toBe(pair.default_domestic_share);
          expect(pair.domestic_share_high).toBe(pair.default_domestic_share);
        }
        for (const side of [pair.domestic, pair.imported]) {
          expect(fingerprintProblems(side), `${home} ${name}`).toEqual([]);
        }
        const co2 = Object.values(pair.domestic.co2e_kg).reduce((sum, value) => sum + (value ?? 0), 0)
          + Object.values(pair.imported.co2e_kg).reduce((sum, value) => sum + (value ?? 0), 0);
        if (name === "electricity") expect(co2).toBe(0);
      }
    }
    const construction = blend(fingerprints.AT.construction, fingerprints.AT.construction.default_domestic_share);
    const servers = blend(fingerprints.AT.it_hardware, fingerprints.AT.it_hardware.default_domestic_share);
    expect(fingerprints.AT.construction.default_domestic_share).toBeGreaterThan(0.7);
    expect(fingerprints.AT.it_hardware.default_domestic_share).toBeLessThan(0.15);
    expect(construction.va.AT ?? 0).toBeGreaterThan(servers.va.AT ?? 0);
  });

  it("reads the setup from meta", () => {
    const meta = JSON.parse(readFileSync(resolve(dataDir, "meta.json"), "utf8")) as Meta;
    const assumptions = JSON.parse(readFileSync(resolve(dataDir, "assumptions.json"), "utf8")) as Assumptions;
    expect(meta.fixture).toBe(false);
    expect(meta.table.reference_year).toBeGreaterThan(0);
    expect(new Set(assumptions.map((entry) => entry.id)).size).toBe(assumptions.length);
    for (const group of [...meta.country_groups, ...meta.industry_groups]) expect(group.label.length, group.id).toBeGreaterThan(0);
    for (const category of meta.categories) {
      expect(category.label.length, category.id).toBeGreaterThan(0);
      expect(["capital", "operating"]).toContain(category.phase);
      expect(typeof category.has_slider).toBe("boolean");
    }
    for (const site of meta.sites) {
      expect(site.label.length, site.id).toBeGreaterThan(0);
      expect(typeof site.heat_available).toBe("boolean");
    }
  });
});

describe("words", () => {
  it("keeps banned words and em dashes out of the copy and the components", () => {
    const banned = [/—/, /\bcreated\b/i, /\bgenerated\b/i, /\btrace\b/i, /\btrack\b/i, /net benefit/i, /net gain/i, /\bupgrade\b/i, /sign up/i, /\bpricing\b/i];
    const copy = readFileSync(resolve(webRoot, "src/i18n/en.json"), "utf8");
    for (const rule of banned) expect(copy).not.toMatch(rule);
    const dir = resolve(webRoot, "src/components");
    for (const name of readdirSync(dir)) {
      const text = readFileSync(resolve(dir, name), "utf8");
      for (const rule of banned) expect(text, name).not.toMatch(rule);
    }
  });

  it("does not type a number into a component", () => {
    const files = [
      ...readdirSync(resolve(webRoot, "src/components")).map((name) => resolve(webRoot, "src/components", name)),
      resolve(webRoot, "src/App.tsx"),
      resolve(webRoot, "src/main.tsx"),
    ];
    for (const file of files) {
      const stripped = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*import .*$/gm, "");
      expect(stripped, file).not.toMatch(/\d/);
    }
  });
});
