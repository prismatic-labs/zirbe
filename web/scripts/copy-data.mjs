import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(webRoot, "../data/out");
const dest = resolve(webRoot, "public/data");
const names = ["meta.json", "fingerprints.json", "lifecycle.json", "assumptions.json"];
const missing = !existsSync(source) || names.some((name) => !existsSync(resolve(source, name)));

if (missing) {
  console.error("data/out is missing. Run `python -m engine build` on main.");
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
for (const name of names) copyFileSync(resolve(source, name), resolve(dest, name));
