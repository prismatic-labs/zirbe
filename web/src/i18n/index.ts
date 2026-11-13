import en from "./en.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[next] = value;
    else Object.assign(out, flatten(value, next));
  }
  return out;
}

const messages = flatten(en as Tree);

export function has(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(messages, key);
}

export function t(key: string, vars?: Record<string, string>): string {
  const raw = messages[key];
  if (raw === undefined) throw new Error(`Missing string ${key}`);
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`Missing value ${name} for ${key}`);
    return value;
  });
}

/** meta.json labels are the English fallback. The page prefers i18n, keyed by the same id. */
export function label(group: string, id: string, fallback: string): string {
  const key = `${group}.${id}`;
  return has(key) ? t(key) : fallback;
}
