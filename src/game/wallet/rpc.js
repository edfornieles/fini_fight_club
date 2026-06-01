/**
 * Keyless, read-only Ethereum calls for the Finiliar contract.
 *
 * Browser-safe (global fetch). No wallet, no signing, no API key — just public
 * RPCs and `eth_call` against `balanceOf(address)` / `ownerOf(uint256)`.
 */
export const FINILIAR_CONTRACT = "0x5a0121a0a21232ec0d024dab9017314509026480";
export const FINILIAR_CHAIN_ID = 1;
export const FINILIAR_TOTAL_SUPPLY = 10000; // token ids 0..9999
const PUBLIC_RPCS = [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.drpc.org",
    "https://1rpc.io/eth",
    "https://eth.merkle.io",
];
const BALANCE_OF = "0x70a08231";
const OWNER_OF = "0x6352211e";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
/** Validate + lowercase an address. Returns null if malformed. */
export function normalizeAddress(input) {
    const a = input.trim();
    return ADDR_RE.test(a) ? a.toLowerCase() : null;
}
function padAddress(addr) {
    return addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}
function padUint(n) {
    return n.toString(16).padStart(64, "0");
}
function decodeAddressWord(hex) {
    if (typeof hex !== "string" || hex.length < 66)
        return null;
    return "0x" + hex.slice(2).slice(24).toLowerCase();
}
async function ethCall(data) {
    let lastErr;
    for (const rpc of PUBLIC_RPCS) {
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 12000);
            const res = await fetch(rpc, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "eth_call",
                    params: [{ to: FINILIAR_CONTRACT, data }, "latest"],
                }),
                signal: ctrl.signal,
            });
            clearTimeout(t);
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.error)
                throw new Error(json.error.message ?? "rpc error");
            if (typeof json.result === "string")
                return json.result;
            throw new Error("no result");
        }
        catch (err) {
            lastErr = err;
        }
    }
    throw new Error(`all public RPCs failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}
/** How many Finis a wallet holds (single cheap call). */
export async function balanceOf(wallet) {
    const addr = normalizeAddress(wallet);
    if (!addr)
        throw new Error("invalid wallet address");
    const result = await ethCall(BALANCE_OF + padAddress(addr));
    return parseInt(result, 16) || 0;
}
/** Current owner of a token, or null for nonexistent/burned. */
export async function ownerOf(tokenId) {
    try {
        const result = await ethCall(OWNER_OF + padUint(tokenId));
        const addr = decodeAddressWord(result);
        return addr && addr !== ZERO_ADDR ? addr : null;
    }
    catch {
        return null;
    }
}
/** Verify (live) that a wallet still owns a given token. */
export async function ownsToken(wallet, tokenId) {
    const owner = await ownerOf(tokenId);
    const addr = normalizeAddress(wallet);
    return !!owner && !!addr && owner === addr;
}
