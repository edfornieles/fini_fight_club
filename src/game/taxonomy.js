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
import { ALL_COIN_FAMILIES } from "./types";
import { getFamilyInfo, getClanProfile, } from "./attributes";
let cache;
/** Load the scanned taxonomy dataset (cached). Returns null if not generated. */
export async function loadTaxonomy(url = "/data/taxonomy.json") {
    if (cache !== undefined)
        return cache;
    try {
        const r = await fetch(url);
        if (!r.ok) {
            cache = null;
            return null;
        }
        cache = (await r.json());
        return cache;
    }
    catch {
        cache = null;
        return null;
    }
}
/** Assemble the Explore view for one family, merging scan data with mechanics. */
export function familyView(family, dataset) {
    const info = getFamilyInfo(family);
    const raw = dataset?.families?.[family];
    const clans = raw
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
export function allFamilyViews(dataset) {
    return ALL_COIN_FAMILIES.map((f) => familyView(f, dataset));
}
