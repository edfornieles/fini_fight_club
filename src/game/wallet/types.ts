/**
 * Wallet ownership integration types.
 *
 * This is the "data stream" half of the NFT-ownership pivot: pull the Finis a
 * wallet actually owns and normalize their on-chain metadata into `FiniTraits`
 * (the seam consumed by the attributes stream's `traitsToStats()`), plus the
 * display info the roster UI needs.
 *
 * Everything here is READ-ONLY. We never sign, never transfer, never need a key.
 */

import type { Fini, FiniTraits } from "../types";

/** Resolved artwork + cosmetic info for a Fini (gateway URLs, not ar://). */
export type FiniArtwork = {
  /** Primary https gateway URL for the animated gif. */
  imageUrl: string;
  /** Ordered gateway candidates for the gif (failover). */
  imageUrls: string[];
  /** Primary https gateway URL for the mp4, if available. */
  animationUrl?: string;
  /** Ordered gateway candidates for the mp4 (failover). */
  animationUrls: string[];
  /** Hex background colour from metadata, e.g. "#fae3eb". */
  background?: string;
  /** Finiliar.com discover page. */
  externalUrl?: string;
};

/** A single owned Fini: battle-relevant traits + display + live price mood. */
export type OwnedFini = {
  tokenId: number;
  name: string;
  /** Feeds `traitsToStats()` in the attributes stream. */
  traits: FiniTraits;
  artwork: FiniArtwork;
  /** Live price of the linked asset. */
  latestPrice: number;
  /** Live price move (real mood) in percent-ish units from the API. */
  latestDelta: number;
};

/**
 * Read-only ownership provider. Swappable: mock (no network), snapshot
 * (prebuilt index + live metadata), or live (chain verification + metadata).
 */
export interface OwnershipProvider {
  readonly id: "mock" | "snapshot" | "live";

  /** Token IDs currently owned by a wallet (best-effort, may use a snapshot). */
  getOwnedTokenIds(wallet: string): Promise<number[]>;

  /** Full owned-Fini record (traits + artwork + live price) for one token. */
  getFini(tokenId: number): Promise<OwnedFini>;

  /** Convenience: resolve a wallet straight to its roster of owned Finis. */
  getRoster(wallet: string): Promise<OwnedFini[]>;
}

/**
 * The player's fielded owned team, persisted across sessions. Stores the fully
 * built battle Finis (trait-derived stats baked in) so re-fielding is instant
 * and works offline; the wallet + token IDs are kept for display + re-sync.
 */
export type SavedOwnedTeam = {
  wallet: string;
  tokenIds: number[];
  /** Battle-ready Finis (already through traitsToStats). */
  finis: Fini[];
  savedAt: number;
};

/** Shape of the prebuilt ownership snapshot written by scripts/index-ownership.mjs. */
export type OwnershipSnapshot = {
  contract: string;
  chainId: number;
  fetchedAt: string;
  range: { start: number; count: number };
  heldCount: number;
  ownerCount: number;
  tokenOwners: Record<string, string>;
  byOwner: Record<string, number[]>;
};
