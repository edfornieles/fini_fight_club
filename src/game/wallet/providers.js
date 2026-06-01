/**
 * Ownership providers. All read-only.
 *
 *  - MockOwnershipProvider:   no network. Deterministic fake rosters for dev/Free Mode.
 *  - SnapshotOwnershipProvider: lists a wallet's tokens from the prebuilt index
 *      (scripts/index-ownership.mjs) and hydrates metadata from the public API.
 *  - LiveOwnershipProvider:    same listing, but verifies current ownership on-chain.
 *
 * The roster UI should prefer Snapshot (fast, keyless) and fall back to Mock if
 * the snapshot isn't available. Free Mode never depends on any of these.
 */
import { ALL_COIN_FAMILIES } from "../types";
import { fetchOwnedFini, fetchManyOwnedFinis } from "./metadata";
import { normalizeAddress, ownsToken, balanceOf } from "./rpc";
// ─────────────────────────────────────────────────────────────────────────
// Mock provider — no network, deterministic.
// ─────────────────────────────────────────────────────────────────────────
const FREQUENCIES = [
    "Hourly",
    "Daily",
    "Twice-Daily",
    "Weekly",
    "Monthly",
];
const MOCK_CLANS = ["Stickies", "Blades", "Miners", "Sprites", "Wisps", "Coots"];
function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function mockTraits(wallet, tokenId) {
    const h = hashStr(`${wallet}:${tokenId}`);
    const family = ALL_COIN_FAMILIES[h % ALL_COIN_FAMILIES.length];
    const frequency = FREQUENCIES[(h >> 4) % FREQUENCIES.length];
    const clan = MOCK_CLANS[(h >> 8) % MOCK_CLANS.length];
    return {
        tokenId,
        family,
        frequency,
        clan,
        latestDelta: (((h >> 12) % 200) - 100) / 1000,
    };
}
export class MockOwnershipProvider {
    countPerWallet;
    id = "mock";
    constructor(countPerWallet = 6) {
        this.countPerWallet = countPerWallet;
    }
    async getOwnedTokenIds(wallet) {
        const addr = normalizeAddress(wallet) ?? wallet;
        const base = hashStr(addr) % 9000;
        return Array.from({ length: this.countPerWallet }, (_, i) => base + i * 137);
    }
    async getFini(tokenId) {
        const traits = mockTraits("mock", tokenId);
        return {
            tokenId,
            name: `finiliar #${tokenId}`,
            traits,
            artwork: { imageUrl: "", imageUrls: [], animationUrls: [], background: "#fae3eb" },
            latestPrice: 0,
            latestDelta: traits.latestDelta,
        };
    }
    async getRoster(wallet) {
        const addr = normalizeAddress(wallet) ?? wallet;
        const ids = await this.getOwnedTokenIds(wallet);
        return ids.map((tokenId) => {
            const traits = mockTraits(addr, tokenId);
            return {
                tokenId,
                name: `finiliar #${tokenId}`,
                traits,
                artwork: { imageUrl: "", imageUrls: [], animationUrls: [], background: "#fae3eb" },
                latestPrice: 0,
                latestDelta: traits.latestDelta,
            };
        });
    }
}
// ─────────────────────────────────────────────────────────────────────────
// Snapshot provider — prebuilt index + live metadata.
// ─────────────────────────────────────────────────────────────────────────
async function loadSnapshot(url) {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`snapshot HTTP ${res.status}`);
    return (await res.json());
}
export class SnapshotOwnershipProvider {
    id = "snapshot";
    snapshot;
    url;
    constructor(opts) {
        this.snapshot = opts?.snapshot ?? null;
        this.url = opts?.url ?? defaultSnapshotUrl();
    }
    async ensure() {
        if (!this.snapshot)
            this.snapshot = await loadSnapshot(this.url);
        return this.snapshot;
    }
    async getOwnedTokenIds(wallet) {
        const addr = normalizeAddress(wallet);
        if (!addr)
            return [];
        const snap = await this.ensure();
        return snap.byOwner[addr] ?? [];
    }
    async getFini(tokenId) {
        return fetchOwnedFini(tokenId);
    }
    async getRoster(wallet) {
        const ids = await this.getOwnedTokenIds(wallet);
        return fetchManyOwnedFinis(ids);
    }
}
// ─────────────────────────────────────────────────────────────────────────
// Live provider — snapshot listing, on-chain ownership verification.
// ─────────────────────────────────────────────────────────────────────────
export class LiveOwnershipProvider {
    id = "live";
    snap;
    constructor(opts) {
        this.snap = new SnapshotOwnershipProvider(opts);
    }
    /** Sanity check a wallet has any Finis without listing them. */
    async getBalance(wallet) {
        return balanceOf(wallet);
    }
    async getOwnedTokenIds(wallet) {
        const candidates = await this.snap.getOwnedTokenIds(wallet);
        // Verify against chain so transfers since the snapshot are respected.
        const checks = await Promise.all(candidates.map(async (id) => ((await ownsToken(wallet, id)) ? id : -1)));
        return checks.filter((id) => id >= 0);
    }
    async getFini(tokenId) {
        return fetchOwnedFini(tokenId);
    }
    async getRoster(wallet) {
        const ids = await this.getOwnedTokenIds(wallet);
        return fetchManyOwnedFinis(ids);
    }
}
// ─────────────────────────────────────────────────────────────────────────
let snapshotCache = null;
/** Load + cache the full ownership snapshot (for collection-wide lookups). */
export async function loadOwnershipSnapshot(url = defaultSnapshotUrl()) {
    if (snapshotCache)
        return snapshotCache;
    snapshotCache = await loadSnapshot(url);
    return snapshotCache;
}
export function defaultSnapshotUrl() {
    // Vite serves /public at BASE_URL; the indexer copies the snapshot there.
    const base = typeof import.meta !== "undefined" && import.meta.env
        ? (import.meta.env?.BASE_URL ?? "/")
        : "/";
    return `${base}data/ownership.json`;
}
/**
 * Pick a provider. Tries snapshot first; if its index can't load, falls back to
 * mock so the UI still works in dev. `verifyOnChain` upgrades to the live
 * provider (slower, but reflects very recent transfers).
 */
export async function resolveProvider(opts) {
    try {
        const url = opts?.url ?? defaultSnapshotUrl();
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) {
            return opts?.verifyOnChain
                ? new LiveOwnershipProvider({ url })
                : new SnapshotOwnershipProvider({ url });
        }
    }
    catch {
        // fall through to mock
    }
    return new MockOwnershipProvider();
}
