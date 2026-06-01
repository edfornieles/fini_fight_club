/**
 * Family / Clan taxonomy — the data behind the Explore page.
 *
 * The real Family→Clan hierarchy is scanned from the metadata API by
 * scripts/index-taxonomy.mjs into public/data/taxonomy.json. This module loads
 * that dataset and merges it with the game-mechanics identities from
 * attributes.ts (archetype, base stats, counter matchups, clan passive buckets).
 *
 * Pure data access — the loader fetches a static JSON; everything else is sync.
 * If the dataset is missing (scan not run), `loadTaxonomy()` resolves to null
 * and the UI can fall back to mechanics-only info.
 */

import type { CoinFamily } from "./types";
import { ALL_COIN_FAMILIES } from "./types";
import {
  getFamilyInfo,
  getClanProfile,
  type FamilyInfo,
  type ClanProfile,
} from "./attributes";

// ─────────────────────────────────────────────────────────────────────────
// Raw dataset shape (matches scripts/index-taxonomy.mjs output)
// ─────────────────────────────────────────────────────────────────────────

export type FamilyTaxonomyRaw = {
  count: number;
  clans: Record<string, number>;
  frequencies: Record<string, number>;
  specials: number;
  mythicals: number;
};

export type TaxonomyDataset = {
  source: string;
  fetchedAt: string;
  scanned: number;
  total: number;
  families: Partial<Record<CoinFamily, FamilyTaxonomyRaw>>;
};

let cache: TaxonomyDataset | null | undefined;

/** Load the scanned taxonomy dataset (cached). Returns null if not generated. */
export async function loadTaxonomy(
  url = "/data/taxonomy.json",
): Promise<TaxonomyDataset | null> {
  if (cache !== undefined) return cache;
  try {
    const r = await fetch(url);
    if (!r.ok) {
      cache = null;
      return null;
    }
    cache = (await r.json()) as TaxonomyDataset;
    return cache;
  } catch {
    cache = null;
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Merged view: real clan membership + game-mechanics meaning
// ─────────────────────────────────────────────────────────────────────────

export type ClanEntry = ClanProfile & {
  /** How many Finis of this family carry this clan (from the scan). */
  count: number;
};

export type FamilyView = {
  info: FamilyInfo;
  /** Total Finis in this family (from the scan), or null if no dataset. */
  population: number | null;
  /** Clans in this family, sorted by population desc. Empty if no dataset. */
  clans: ClanEntry[];
  specials: number | null;
  mythicals: number | null;
  frequencies: Record<string, number> | null;
};

/** Assemble the Explore view for one family, merging scan data with mechanics. */
export function familyView(
  family: CoinFamily,
  dataset: TaxonomyDataset | null,
): FamilyView {
  const info = getFamilyInfo(family);
  const raw = dataset?.families?.[family];

  const clans: ClanEntry[] = raw
    ? Object.entries(raw.clans)
        .filter(([name]) => name && name !== "(none)")
        .map(([name, count]) => ({ ...getClanProfile(name), count }))
        .sort((a, b) => b.count - a.count)
    : [];

  return {
    info,
    population: raw?.count ?? null,
    clans,
    specials: raw?.specials ?? null,
    mythicals: raw?.mythicals ?? null,
    frequencies: raw?.frequencies ?? null,
  };
}

/** All families in the canonical order, as Explore views. */
export function allFamilyViews(dataset: TaxonomyDataset | null): FamilyView[] {
  return ALL_COIN_FAMILIES.map((f) => familyView(f, dataset));
}
