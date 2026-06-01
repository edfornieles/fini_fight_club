/**
 * Fetch + cache Finiliar metadata from the public, keyless metadata API.
 * Browser-safe. One small request per token; a wallet owns few, so this is fine.
 */

import type { OwnedFini } from "./types";
import { metadataToOwnedFini } from "./normalize";

const METADATA_BASE = "https://api-public.finiliar.com/metadata";

const cache = new Map<number, OwnedFini>();

export async function fetchOwnedFini(tokenId: number): Promise<OwnedFini> {
  const cached = cache.get(tokenId);
  if (cached) return cached;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${METADATA_BASE}/${tokenId}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`metadata HTTP ${res.status} for #${tokenId}`);
    const meta = await res.json();
    const owned = metadataToOwnedFini(meta, tokenId);
    cache.set(tokenId, owned);
    return owned;
  } finally {
    clearTimeout(t);
  }
}

/** Fetch many tokens with a small concurrency cap (be polite to the API). */
export async function fetchManyOwnedFinis(
  tokenIds: number[],
  concurrency = 5,
): Promise<OwnedFini[]> {
  const out: OwnedFini[] = [];
  let i = 0;
  async function worker() {
    while (i < tokenIds.length) {
      const idx = i++;
      try {
        out.push(await fetchOwnedFini(tokenIds[idx]));
      } catch {
        // Skip tokens whose metadata fails; roster degrades gracefully.
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tokenIds.length) }, worker);
  await Promise.all(workers);
  return out.sort((a, b) => a.tokenId - b.tokenId);
}
