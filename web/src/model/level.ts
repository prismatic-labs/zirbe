const FIRST = 1;
const LAST = 6;

export const EARLIER = -1;
export const LATER = 1;

export function readLevel(hash: string): number {
  const match = /^#level-([1-6])$/.exec(hash);
  return match ? Number(match[1]) : FIRST;
}

export function levelHash(level: number): string {
  return `#level-${level}`;
}

export function stepLevel(current: number, delta: number): number {
  return Math.min(LAST, Math.max(FIRST, current + delta));
}

export function levelCount(): number {
  return LAST;
}
