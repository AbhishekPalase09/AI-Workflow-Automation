// Pure Damerau-Levenshtein string distance and suggestion helper for Flowcheck (Phase 2.3)
// Non-Negotiable Rule 4: Zero external imports except local/handlebars.

/**
 * Compute the Damerau-Levenshtein (Optimal String Alignment) distance between two strings.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;

  if (al === 0) return bl;
  if (bl === 0) return al;

  // Matrix of size (al + 1) x (bl + 1)
  const d: number[][] = Array.from({ length: al + 1 }, () =>
    new Array(bl + 1).fill(0),
  );

  for (let i = 0; i <= al; i++) d[i][0] = i;
  for (let j = 0; j <= bl; j++) d[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost, // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[al][bl];
}

/**
 * Return closest candidate strings within maxDistance.
 * Case-insensitive tie-breaking, sorted by distance ascending, then alphabetically, capped at 3.
 */
export function closest(
  name: string,
  candidates: string[],
  maxDistance = 2,
): string[] {
  if (!name || candidates.length === 0) return [];

  const lowerName = name.toLowerCase();

  const scored: Array<{
    candidate: string;
    distance: number;
    caseDiff: boolean;
  }> = [];

  for (const candidate of candidates) {
    if (candidate === name) continue; // Don't suggest the exact same name

    const dist = damerauLevenshtein(name, candidate);
    const lowerDist = damerauLevenshtein(lowerName, candidate.toLowerCase());
    const effectiveDist = Math.min(dist, lowerDist);

    if (effectiveDist <= maxDistance) {
      scored.push({
        candidate,
        distance: effectiveDist,
        caseDiff: dist !== lowerDist,
      });
    }
  }

  scored.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return a.candidate.localeCompare(b.candidate);
  });

  return scored.slice(0, 3).map((s) => s.candidate);
}
