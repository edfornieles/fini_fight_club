import React, { useState, useEffect } from "react";
import { useUIStore } from "../state/uiStore";
import { useLivePrices } from "../hooks/useLivePrices";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { api } from "../lib/api";
import { useCoinStore } from "../state/coinStore";

const GENESIS_CAMPAIGN_ID = "00000000-0000-0000-0000-000000000001";

const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

const BASE_CLAIM = 0;
const PER_FINI   = 10_000;
const MAX_CLAIM  = Infinity;

// Mock snapshot data — in production this comes from the server snapshot
const MOCK_SNAPSHOT_FINIS = [
  { tokenId: 1062, family: "BTC",  clan: "Townspeople",       eligible: true },
  { tokenId: 2847, family: "ETH",  clan: "Artists",           eligible: true },
  { tokenId: 4103, family: "SOL",  clan: "Soldiers",          eligible: true },
  { tokenId: 7291, family: "DOGE", clan: "Miners",            eligible: true },
  { tokenId: 6010, family: "LINK", clan: "Twice Daily",       eligible: true },
  { tokenId: 6212, family: "UNI",  clan: "Artists",           eligible: true },
  { tokenId: 6420, family: "AVAX", clan: "Soldiers",          eligible: true },
  { tokenId: 6818, family: "BNB",  clan: "Hourly",            eligible: true },
  { tokenId: 7001, family: "MATIC",clan: "Arms of the State", eligible: true },
  { tokenId: 9100, family: "XTZ",  clan: "Farmers",           eligible: true },
];

type Step = "connect" | "check" | "sign" | "done";

export function ClaimPage() {
  const { walletAddress } = useUIStore();
  const { openConnectModal } = useConnectModal();
  const [step, setStep] = useState<Step>(walletAddress ? "check" : "connect");
  const [loading, setLoading] = useState(false);
  const { prices } = useLivePrices();

  const finiCount = MOCK_SNAPSHOT_FINIS.length;
  const totalClaim = finiCount * PER_FINI;
  const short = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "";
  const nonce = "8f3a92c1-d4e7-4b91-a2f3-9c8d6e2a1b47";
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 300_000).toISOString();

  async function handleConnect() {
    openConnectModal?.();
  }

  // Auto-advance to "check" once a real wallet is connected
  useEffect(() => {
    if (walletAddress && step === "connect") setStep("check");
  }, [walletAddress, step]);

  const [claimError, setClaimError] = useState<string | null>(null);
  const [, setClaimResult] = useState<{ amount: number; tokenIds: number[] } | null>(null);

  async function handleSign() {
    setLoading(true);
    setClaimError(null);
    try {
      const result = await api.claimFini(GENESIS_CAMPAIGN_ID);
      setClaimResult({ amount: result.claimedAmount, tokenIds: result.tokenIds });
      useCoinStore.setState({ balance: result.newBalance, loaded: true });
      setStep("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "claim_failed";
      // Friendly errors for common cases
      if (msg.includes("already_claimed")) setClaimError("This wallet has already claimed in this campaign.");
      else if (msg.includes("no_finis_in_snapshot")) setClaimError("No Finis found in the campaign snapshot for this wallet.");
      else if (msg.includes("supply_cap")) setClaimError("Sorry — the campaign supply cap has been reached.");
      else if (msg.includes("offline")) setClaimError("Backend not configured. Claim disabled in offline mode.");
      else setClaimError(msg);
    } finally {
      setLoading(false);
    }
  }

  const STEPS: Step[] = ["connect", "check", "sign", "done"];
  const STEP_LABELS = ["Connect Wallet", "Check Holdings", "Sign & Claim", "Done!"];

  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        {/* Page header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🪙</div>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: "#111", margin: "0 0 10px" }}>Fini Coin Claim</h1>
          <p style={{ fontSize: 16, color: "#666", maxWidth: 560, margin: "0 auto", lineHeight: 1.7 }}>
            Existing Fini NFT holders can claim an initial Fini Coin allocation to start playing in the Battle Arena.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }}>
          {/* Left: how it works */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* What is Fini Coin */}
            <InfoCard title="What is Fini Coin?">
              <p style={P}>Fini Coin is an <strong>internal, non-transferable game currency</strong> used exclusively inside Fini Crypto Battle Arena. It has no real-world value and cannot be withdrawn, sold, transferred, or exchanged for money, crypto, NFTs, or anything of monetary value.</p>
              <p style={P}>You use Fini Coin to predict battle outcomes, enter arenas, and participate in clan competitions. Think of it as battle energy — the fuel that powers your predictions.</p>
              <div style={{ background: "#fef9c3", border: "1.5px solid #fde047", borderRadius: 12, padding: "12px 16px", fontSize: 12, color: "#854d0e", fontWeight: 600, lineHeight: 1.6, marginTop: 8 }}>
                Fini Coin is a game currency. It may not become money, a token, or anything redeemable. Future ecosystem rewards, if any, are discretionary and subject to legal and regulatory review.
              </div>
            </InfoCard>

            {/* Claim formula */}
            <InfoCard title="Your Claim Allocation">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <AllocRow label="One-time per Fini" value={`${BASE_CLAIM.toLocaleString()} FINI$`} color="#f472b6" />
                <AllocRow label="Per Fini NFT (once each)" value={`${PER_FINI.toLocaleString()} FINI$`} color="#a78bfa" />
                <AllocRow label="Each Fini redeemable once" value={`${MAX_CLAIM.toLocaleString()} FINI$`} color="#60a5fa" />
                <AllocRow label="Campaign status" value="Active" color="#22c55e" />
              </div>
              <div style={{ background: "#f9fafb", borderRadius: 12, padding: "14px 16px", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#666", marginBottom: 5 }}>
                  <span>One-time per Fini</span><span style={{ fontWeight: 700 }}>{BASE_CLAIM.toLocaleString()} FINI$</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#666", marginBottom: 5 }}>
                  <span>Finis held × {PER_FINI} FINI$</span><span style={{ fontWeight: 700 }}>{finiCount} × {PER_FINI} = {(finiCount * PER_FINI).toLocaleString()} FINI$</span>
                </div>
                <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, color: "#111", fontSize: 15 }}>
                  <span>Your claim</span>
                  <span style={{ color: "#f472b6" }}>{totalClaim.toLocaleString()} Fini Coin</span>
                </div>
              </div>
            </InfoCard>

            {/* Daily holder rewards */}
            <InfoCard title="Daily Holder Play Allowance">
              <p style={P}>After your initial claim, Fini holders receive a daily Fini Coin grant to keep playing. This is not yield or income — it is battle energy to keep you in the arena.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                <AllocRow label="Non-holder daily grant" value="100 FINI$ / day" color="#9ca3af" />
                <AllocRow label="Holder base grant" value="250 FINI$ / day" color="#f472b6" />
                <AllocRow label="Per Fini bonus" value="50 FINI$ / day" color="#a78bfa" />
                <AllocRow label="Your daily grant" value={`${250 + finiCount * 50} FINI$ / day`} color="#22c55e" />
              </div>
            </InfoCard>

            {/* Security */}
            <InfoCard title="Claim Security">
              <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13, color: "#555", lineHeight: 1.8 }}>
                <li>Each wallet can claim <strong>once per campaign</strong></li>
                <li>Each NFT token ID can only be used <strong>once per campaign</strong></li>
                <li>Claim calculation happens <strong>server-side only</strong> — the client never decides your allocation</li>
                <li>Wallet signature is <strong>single-use with a 5-minute expiry</strong></li>
                <li>Signature is <strong>domain-bound</strong> — cannot be replayed on another site</li>
                <li>All claims are written to an <strong>append-only ledger</strong> with idempotency keys</li>
                <li>No gas cost. No token approvals. No asset transfers of any kind.</li>
              </ul>
            </InfoCard>

            {/* Live prices context */}
            {Object.keys(prices).length > 0 && (
              <InfoCard title="Your Finis vs Today's Market">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {MOCK_SNAPSHOT_FINIS.map(f => {
                    const p = prices[f.family];
                    return (
                      <div key={f.tokenId} style={{ textAlign: "center", background: "#f9fafb", borderRadius: 12, padding: "10px 8px" }}>
                        <div style={{ fontSize: 18 }}>🐾</div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#333", marginTop: 4 }}>#{f.tokenId}</div>
                        <div style={{ fontSize: 10, color: "#888" }}>{f.family} · {f.clan}</div>
                        {p && <div style={{ fontSize: 10, fontWeight: 700, color: p.usd_24h_change >= 0 ? "#16a34a" : "#dc2626", marginTop: 2 }}>
                          {p.usd_24h_change >= 0 ? "▲" : "▼"} {Math.abs(p.usd_24h_change).toFixed(1)}% today
                        </div>}
                      </div>
                    );
                  })}
                </div>
              </InfoCard>
            )}
          </div>

          {/* Right: claim flow card */}
          <div style={{ position: "sticky", top: 80 }}>
            <div style={{ background: "#fff", borderRadius: 24, border: "1.5px solid #f0f0f0", overflow: "hidden" }}>
              {/* Progress bar */}
              <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0" }}>
                {STEPS.map((s, i) => {
                  const done = STEPS.indexOf(step) > i;
                  const active = step === s;
                  return (
                    <div key={s} style={{
                      flex: 1, padding: "12px 6px", textAlign: "center", fontSize: 10, fontWeight: 700,
                      color: active ? "#f472b6" : done ? "#22c55e" : "#aaa",
                      borderBottom: active ? "2px solid #f472b6" : "2px solid transparent",
                      background: active ? "#fdf0f7" : "transparent",
                    }}>
                      <div style={{ fontSize: 13, marginBottom: 2 }}>{done ? "✓" : i + 1}</div>
                      {STEP_LABELS[i]}
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: "28px 24px" }}>
                {/* Step: connect */}
                {step === "connect" && (
                  <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ fontSize: 40 }}>👛</div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#111", marginBottom: 6 }}>Connect your wallet</div>
                      <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                        Connect the wallet that holds your Fini NFTs. Read-only — no approvals, no gas, no transfers.
                      </div>
                    </div>
                    <button onClick={handleConnect} disabled={loading} style={pinkBtn}>
                      {loading ? "Connecting..." : "Connect Wallet"}
                    </button>
                    <div style={{ fontSize: 11, color: "#bbb" }}>MetaMask · Rainbow · Coinbase Wallet · WalletConnect</div>
                  </div>
                )}

                {/* Step: check */}
                {step === "check" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <WalletRow address={short} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                        Finis in snapshot ({finiCount})
                      </div>
                      {MOCK_SNAPSHOT_FINIS.map(f => (
                        <div key={f.tokenId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, border: "1.5px solid #f0f0f0", marginBottom: 6 }}>
                          <span>🐾</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>Fini #{f.tokenId}</div>
                            <div style={{ fontSize: 10, color: "#888" }}>{f.family} · {f.clan}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa" }}>+{PER_FINI} FINI$</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: "#f9fafb", borderRadius: 12, padding: "14px" }}>
                      <Row label={`Base claim`} value={`${BASE_CLAIM.toLocaleString()} FINI$`} />
                      <Row label={`${finiCount} Finis × ${PER_FINI} FINI$`} value={`${(finiCount * PER_FINI).toLocaleString()} FINI$`} />
                      <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0" }} />
                      <Row label="Total" value={`${totalClaim.toLocaleString()} FINI$`} bold />
                    </div>
                    <button onClick={() => setStep("sign")} style={pinkBtn}>Proceed to Sign →</button>
                  </div>
                )}

                {/* Step: sign */}
                {step === "sign" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 36, marginBottom: 6 }}>✍️</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 4 }}>Sign to claim</div>
                      <div style={{ fontSize: 12, color: "#666" }}>No gas. No approvals. Proves wallet ownership.</div>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 10.5, background: "#111", color: "#a0aec0", borderRadius: 12, padding: "14px", lineHeight: 1.9, overflowX: "auto" }}>
                      <div style={{ color: "#fff", fontWeight: 700, marginBottom: 6 }}>Fini Crypto Battle Arena</div>
                      <div>Sign this message to verify wallet ownership and</div>
                      <div>claim non-transferable Fini Coin for gameplay.</div>
                      <br />
                      <div>Domain: fini.xyz</div>
                      <div>Wallet: {short}</div>
                      <div>Nonce: {nonce.slice(0, 18)}...</div>
                      <div>Issued At: {issuedAt.slice(0, 19)}Z</div>
                      <div>Expires At: {expiresAt.slice(0, 19)}Z</div>
                      <br />
                      <div style={{ color: "#68d391" }}>This signature does not cost gas and does not</div>
                      <div style={{ color: "#68d391" }}>give permission to move any assets.</div>
                    </div>
                    <button onClick={handleSign} disabled={loading} style={{ ...pinkBtn, background: loading ? "#e5e7eb" : "#f472b6", color: loading ? "#aaa" : "#fff" }}>
                      {loading ? "Verifying..." : "Sign & Claim FINI$"}
                    </button>
                    {claimError && (
                      <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 700, padding: "10px 14px", background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: 10 }}>
                        {claimError}
                      </div>
                    )}
                  </div>
                )}

                {/* Step: done */}
                {step === "done" && (
                  <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ fontSize: 52 }}>🎉</div>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#111", marginBottom: 6 }}>Claim successful!</div>
                      <div style={{ fontSize: 14, color: "#666" }}>
                        <strong style={{ color: "#f472b6" }}>{totalClaim.toLocaleString()} Fini Coin</strong> added to your balance
                      </div>
                    </div>
                    <div style={{ background: "#f9fafb", borderRadius: 14, padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <MiniStat label="Fini Coin" value={totalClaim.toLocaleString() + " FINI$"} />
                      <MiniStat label="Finis counted" value={String(finiCount)} />
                      <MiniStat label="Status" value="Claimed" />
                      <MiniStat label="Daily grant" value={`${250 + finiCount * 50} FINI$/day`} />
                    </div>
                    <a href="/crypto" style={{ ...pinkBtn, display: "block", textDecoration: "none", textAlign: "center" }}>
                      Enter the Arena →
                    </a>
                    <div style={{ fontSize: 10, color: "#bbb", lineHeight: 1.6 }}>
                      Claim recorded in immutable ledger. Each wallet claims once per campaign.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Legal notice */}
            <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 14, background: "#fef9c3", border: "1.5px solid #fde047", fontSize: 11, color: "#854d0e", lineHeight: 1.6 }}>
              <strong>Game currency only.</strong> Fini Coin cannot be withdrawn, sold, transferred, or exchanged for money, crypto, NFTs, or anything of value. This is a game claim, not a token launch, airdrop, or investment.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

const P: React.CSSProperties = { fontSize: 13, color: "#555", lineHeight: 1.7, margin: "0 0 8px" };
const pinkBtn: React.CSSProperties = { width: "100%", padding: "13px 0", borderRadius: 100, border: "none", background: "#f472b6", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" };

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: "22px 24px", border: "1.5px solid #f0f0f0" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111", marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function AllocRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: color + "12", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: bold ? "#111" : "#666", fontWeight: bold ? 900 : 400, marginBottom: bold ? 0 : 4 }}>
      <span>{label}</span><span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function WalletRow({ address }: { address: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "#f9fafb" }}>
      <span>👛</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700 }}>Connected</div>
        <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#111" }}>{address}</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "#dcfce7", color: "#15803d" }}>✓ Verified</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 900, color: "#111" }}>{value}</div>
    </div>
  );
}

