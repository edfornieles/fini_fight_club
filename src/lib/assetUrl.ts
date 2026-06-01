/**
 * Asset URL helper.
 *
 * Heavy art (clan-art, clan-finis, hero) is too big to commit (~1.2 GB).
 * In production it lives on a Cloudflare R2 bucket; locally it lives in
 * /public. This helper returns the right URL based on `VITE_ASSET_CDN`.
 *
 * If `VITE_ASSET_CDN` is set at build time, paths starting with /clan-art/,
 * /clan-finis/, or /hero/ get rewritten to the CDN. Everything else stays
 * site-relative (so /data/ownership.json keeps loading from /public).
 *
 * Usage:
 *   import { asset } from "../lib/assetUrl";
 *   <img src={asset(`/clan-art/${slug}.gif`)} />
 */

const CDN = (import.meta as { env?: { VITE_ASSET_CDN?: string } }).env?.VITE_ASSET_CDN ?? "";

const HEAVY_PREFIXES = ["/clan-art/", "/clan-finis/", "/hero/"];

export function asset(path: string): string {
  if (!CDN) return path;
  for (const prefix of HEAVY_PREFIXES) {
    if (path.startsWith(prefix)) {
      // strip trailing slash from CDN if present so we don't double up
      const cdn = CDN.endsWith("/") ? CDN.slice(0, -1) : CDN;
      return cdn + path;
    }
  }
  return path;
}
