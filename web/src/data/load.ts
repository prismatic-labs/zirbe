import type { Assumptions, Dataset, Fingerprints, Lifecycle, Meta } from "./types";

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(path);
  return response.json() as Promise<T>;
}

export async function loadData(): Promise<Dataset> {
  const [meta, fingerprints, lifecycle, assumptions] = await Promise.all([
    readJson<Meta>(`${import.meta.env.BASE_URL}data/meta.json`),
    readJson<Fingerprints>(`${import.meta.env.BASE_URL}data/fingerprints.json`),
    readJson<Lifecycle>(`${import.meta.env.BASE_URL}data/lifecycle.json`),
    readJson<Assumptions>(`${import.meta.env.BASE_URL}data/assumptions.json`),
  ]);
  return { meta, fingerprints, lifecycle, assumptions };
}

export async function loadMethod(): Promise<{ method: string; sources: string }> {
  const [method, sources] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}method-docs/METHOD.md`).then((response) => (response.ok ? response.text() : "")),
    fetch(`${import.meta.env.BASE_URL}method-docs/SOURCES.md`).then((response) => (response.ok ? response.text() : "")),
  ]);
  return { method, sources };
}
