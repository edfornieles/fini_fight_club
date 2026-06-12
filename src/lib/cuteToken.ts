/**
 * CUTE$ on-chain read client (testnet, optional).
 *
 * The real in-game currency is the off-chain ledger; this only reads the
 * optional CUTE$ ERC20 (see contracts/CuteToken.sol) so the app can show a
 * wallet's on-chain balance once the token is deployed. Read-only — no signing,
 * no transfers. Standalone viem client so it doesn't touch the mainnet wagmi
 * config. Until VITE_CUTE_TOKEN_ADDRESS is set, everything here no-ops.
 */
import { createPublicClient, http, getAddress } from "viem";
import { baseSepolia } from "viem/chains";

const ADDRESS = (import.meta.env.VITE_CUTE_TOKEN_ADDRESS as string | undefined)?.trim();
const RPC = (import.meta.env.VITE_CUTE_RPC_URL as string | undefined)?.trim();

/** True once a deployed CUTE$ token address is configured. */
export const cuteTokenConfigured = Boolean(ADDRESS);

const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

function makeClient() {
  return createPublicClient({ chain: baseSepolia, transport: http(RPC || undefined) });
}
let client: ReturnType<typeof makeClient> | null = null;
function getClient() {
  if (!ADDRESS) return null;
  client ??= makeClient();
  return client;
}

/**
 * On-chain CUTE$ balance for a wallet, as a human number (decimals applied).
 * Returns null if the token isn't configured or the read fails.
 */
export async function cuteOnchainBalance(wallet: string): Promise<number | null> {
  const c = getClient();
  if (!c || !ADDRESS) return null;
  try {
    const token = getAddress(ADDRESS);
    const owner = getAddress(wallet);
    const [raw, dec] = await Promise.all([
      c.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [owner] }),
      c.readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" }),
    ]);
    return Number(raw) / 10 ** Number(dec);
  } catch {
    return null;
  }
}
