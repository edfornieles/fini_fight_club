import { useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { api } from "../lib/api";
import { supabase, isOnline } from "../lib/supabase";
/**
 * Bridges wagmi wallet connect → Supabase session via SIWE.
 *
 * On wallet connect:
 *  1. Check if we already have a Supabase session for this wallet — done if yes
 *  2. Request a nonce + message from the SIWE endpoint
 *  3. Ask the wallet to sign the message
 *  4. Post sig back to verify endpoint → receive Supabase tokens
 *  5. Set the Supabase session
 *
 * Exposes the current `authedWallet` (the wallet of the active session) so the
 * rest of the app can know whether the user is fully authed (not just connected).
 */
export function useSiweAuth() {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { disconnect } = useDisconnect();
    const [status, setStatus] = useState("idle");
    const [authedWallet, setAuthedWallet] = useState(null);
    const [error, setError] = useState(null);
    const inFlight = useRef(false);
    // On mount, check existing session
    useEffect(() => {
        if (!isOnline)
            return;
        supabase.auth.getSession().then(({ data }) => {
            const w = data.session?.user?.user_metadata?.wallet?.toLowerCase();
            if (w) {
                setAuthedWallet(w);
                setStatus("authed");
            }
        });
    }, []);
    // When wallet connects and doesn't match the current session, kick off SIWE
    useEffect(() => {
        if (!isOnline)
            return;
        if (!isConnected || !address) {
            if (authedWallet) {
                supabase.auth.signOut();
                setAuthedWallet(null);
                setStatus("idle");
            }
            return;
        }
        const a = address.toLowerCase();
        if (authedWallet === a)
            return;
        if (inFlight.current)
            return;
        inFlight.current = true;
        (async () => {
            try {
                setStatus("signing");
                setError(null);
                const { message } = await api.siwe.getNonce(a);
                const signature = await signMessageAsync({ message });
                setStatus("verifying");
                const result = await api.siwe.verify(message, signature);
                await supabase.auth.setSession({
                    access_token: result.accessToken,
                    refresh_token: result.refreshToken,
                });
                setAuthedWallet(result.wallet.toLowerCase());
                setStatus("authed");
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : "auth failed";
                setError(msg);
                setStatus("error");
                // If user rejected the sig, disconnect so they can retry cleanly
                if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("denied")) {
                    disconnect();
                }
            }
            finally {
                inFlight.current = false;
            }
        })();
    }, [address, isConnected, authedWallet, signMessageAsync, disconnect]);
    async function signOut() {
        await supabase.auth.signOut();
        disconnect();
        setAuthedWallet(null);
        setStatus("idle");
    }
    return { status, authedWallet, error, signOut };
}
