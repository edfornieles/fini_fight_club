import type { Fini } from "./types";
import { allMockFinis } from "./mockTeams";

/**
 * Placeholder NFT ownership lookup.
 *
 * Replace this with a real ownership query when the Finiliar contract
 * address + ABI + RPC are available. Suggested replacement strategies:
 *   - ethers.js + Alchemy/NFT API for ownership scan
 *   - The Graph subgraph for the Finiliar collection
 *   - reservoir.tools or a custom indexer
 *
 * NEVER block Free Mode on this — Free Mode must work without wallet.
 */
export async function getOwnedFinis(
  walletAddress: string,
): Promise<Fini[]> {
  // TODO: Replace with real NFT ownership lookup.
  // Right now we pretend the wallet owns 4 mock Finis for demo purposes.
  await new Promise((r) => setTimeout(r, 250));
  const tagged = allMockFinis.slice(0, 4).map((f) => ({
    ...f,
    ownerAddress: walletAddress,
  }));
  return tagged;
}

/**
 * Simulated ownership state that lives in memory during MVP.
 * Death Mode simulated transfers update this map only.
 *
 * TODO: When real Death Mode launches, replace with on-chain transfer
 * events. Do NOT mutate this map AS IF it were authoritative once we
 * have real on-chain ownership.
 */
export class MockOwnershipLedger {
  private byFiniId = new Map<string, string>();

  setOwner(finiId: string, owner: string): void {
    this.byFiniId.set(finiId, owner);
  }

  getOwner(finiId: string): string | undefined {
    return this.byFiniId.get(finiId);
  }

  transfer(finiId: string, from: string, to: string): boolean {
    const current = this.byFiniId.get(finiId);
    if (current !== from) return false;
    this.byFiniId.set(finiId, to);
    return true;
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.byFiniId.entries());
  }
}

export const mockOwnershipLedger = new MockOwnershipLedger();
