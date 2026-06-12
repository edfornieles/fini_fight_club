/**
 * Normalize raw Finiliar metadata (from api-public.finiliar.com) into our
 * internal `FiniTraits` + `OwnedFini` shapes. Pure functions, no I/O.
 */

import type { CoinFamily, FiniFrequency, FiniTraits } from "../types";
import { ALL_COIN_FAMILIES } from "../types";
import type { FiniArtwork, OwnedFini } from "./types";

/** Finiliar uses full asset names; the game uses tickers. */
const FAMILY_NAME_TO_TICKER: Record<string, CoinFamily> = {
  Bitcoin: "BTC",
  Ethereum: "ETH",
  Solana: "SOL",
  Dogecoin: "DOGE",
  Chainlink: "LINK",
  Uniswap: "UNI",
  Avalanche: "AVAX",
  Binance: "BNB",
  "Binance Coin": "BNB",
  Polygon: "MATIC",
  Tezos: "XTZ",
};

const VALID_FREQUENCIES: FiniFrequency[] = [
  "Hourly",
  "Daily",
  "Twice-Daily",
  "Weekly",
  "Monthly",
];

export function mapFamily(raw: string | undefined): CoinFamily {
  if (!raw) return "BTC";
  const hit = FAMILY_NAME_TO_TICKER[raw.trim()];
  if (hit) return hit;
  // Already a ticker? accept it.
  const upper = raw.trim().toUpperCase() as CoinFamily;
  if (ALL_COIN_FAMILIES.includes(upper)) return upper;
  return "BTC";
}

export function mapFrequency(raw: string | undefined): FiniFrequency {
  const v = (raw ?? "").trim();
  const hit = VALID_FREQUENCIES.find((f) => f.toLowerCase() === v.toLowerCase());
  return hit ?? "Hourly";
}

/**
 * Arweave gateways in preference order. arweave.net currently 404s Finiliar's
 * path-manifest assets (ar://{manifestTx}/{id}.gif), while these mirrors resolve
 * them — so we try the working ones first and keep arweave.net as a last resort.
 */
const ARWEAVE_GATEWAYS = [
  "https://permagate.io",
  "https://ar-io.dev",
  "https://arweave.net",
];

const IPFS_GATEWAYS = ["https://ipfs.io/ipfs", "https://cloudflare-ipfs.com/ipfs"];

/** Resolve ar:// or ipfs:// URIs to an ordered list of https gateway URLs. */
export function resolveAssetUrls(uri: string | undefined): string[] {
  if (!uri) return [];
  if (uri.startsWith("ar://")) {
    const path = uri.slice(5);
    return ARWEAVE_GATEWAYS.map((gw) => `${gw}/${path}`);
  }
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice(7);
    return IPFS_GATEWAYS.map((gw) => `${gw}/${path}`);
  }
  return [uri];
}

/** Resolve to a single (preferred) https gateway URL. */
export function resolveAssetUrl(uri: string | undefined): string {
  return resolveAssetUrls(uri)[0] ?? "";
}

type RawAttribute = { trait_type?: string; value?: unknown };
type RawMetadata = {
  id?: string | number;
  name?: string;
  image?: string;
  animation_url?: string;
  background?: string;
  external_url?: string;
  attributes?: RawAttribute[];
  latestPrice?: number;
  latestDelta?: number;
  priceHistory?: { date: number; price: number }[];
};

function attr(attrs: RawAttribute[] | undefined, type: string): string | undefined {
  const a = attrs?.find(
    (x) => (x.trait_type ?? "").toLowerCase() === type.toLowerCase(),
  );
  return a?.value != null ? String(a.value) : undefined;
}

/** Parse the public metadata payload into normalized traits. */
export function metadataToTraits(meta: RawMetadata, tokenId: number): FiniTraits {
  const attrs = meta.attributes;
  return {
    tokenId,
    family: mapFamily(attr(attrs, "Family")),
    frequency: mapFrequency(attr(attrs, "Frequency")),
    clan: attr(attrs, "Clan") ?? "Unknown",
    special: attr(attrs, "Special"),
    mythical: attr(attrs, "Mythical"),
    latestDelta: typeof meta.latestDelta === "number" ? meta.latestDelta : 0,
  };
}

/** Parse the full metadata payload into an OwnedFini record. */
export function metadataToOwnedFini(
  meta: RawMetadata,
  tokenId: number,
): OwnedFini {
  const imageUrls = resolveAssetUrls(meta.image);
  const animationUrls = resolveAssetUrls(meta.animation_url);
  const artwork: FiniArtwork = {
    imageUrl: imageUrls[0] ?? "",
    imageUrls,
    animationUrl: animationUrls[0],
    animationUrls,
    background: meta.background,
    externalUrl: meta.external_url,
  };
  return {
    tokenId,
    name: meta.name ?? `finiliar #${tokenId}`,
    traits: metadataToTraits(meta, tokenId),
    artwork,
    latestPrice: typeof meta.latestPrice === "number" ? meta.latestPrice : 0,
    latestDelta: typeof meta.latestDelta === "number" ? meta.latestDelta : 0,
    priceHistory: Array.isArray(meta.priceHistory)
      ? meta.priceHistory.filter(p => typeof p?.price === "number")
      : undefined,
  };
}
