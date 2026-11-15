/** Page motion. Components read these so they never contain a duration of their own. */
export function motionMs(reduced: boolean): number {
  if (reduced) return 0;
  return 700;
}

/** How long the case must rest before the address is rewritten: browsers limit how often that may happen. */
export function linkWriteMs(): number {
  return 300;
}

export function playMs(reduced: boolean): number {
  if (reduced) return 1100;
  return 900;
}
