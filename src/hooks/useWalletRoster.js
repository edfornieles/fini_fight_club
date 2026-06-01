import { useEffect, useState } from "react";
import { resolveProvider } from "../game/wallet";
const CACHE = new Map();
/**
 * Loads the real on-chain roster for a wallet using the snapshot/live providers
 * from src/game/wallet. Falls back to MockOwnershipProvider if the snapshot
 * isn't reachable (e.g. dev mode with no /data/ownership.json).
 *
 * Cached in-memory per wallet so navigating between pages doesn't re-fetch.
 */
export function useWalletRoster(walletAddress) {
    const [roster, setRoster] = useState(walletAddress ? CACHE.get(walletAddress.toLowerCase()) ?? null : null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!walletAddress) {
            setRoster(null);
            return;
        }
        const key = walletAddress.toLowerCase();
        if (CACHE.has(key)) {
            setRoster(CACHE.get(key));
            return;
        }
        let alive = true;
        setLoading(true);
        setError(null);
        resolveProvider()
            .then(p => p.getRoster(walletAddress))
            .then(r => {
            if (!alive)
                return;
            CACHE.set(key, r);
            setRoster(r);
            setLoading(false);
        })
            .catch(e => {
            if (!alive)
                return;
            setError(e instanceof Error ? e.message : "Failed to load roster");
            setRoster([]);
            setLoading(false);
        });
        return () => { alive = false; };
    }, [walletAddress]);
    return { roster, loading, error };
}
