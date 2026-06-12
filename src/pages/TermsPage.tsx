/** /terms — plain-language terms for the play-only beta. Linked from the nav,
 *  the claim flow, and the first-run TermsGate modal. */
import { Link } from "react-router-dom";

const S: React.CSSProperties = { fontFamily: "'Nunito', system-ui, sans-serif" };

export function TermsPage() {
  return (
    <div style={{ ...S, background: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 32px 80px" }}>
        <Link to="/" style={{ fontSize: 13, fontWeight: 700, color: "#f472b6", textDecoration: "none" }}>← Home</Link>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: "#111", margin: "12px 0 6px" }}>Terms & How CUTE$ Works</h1>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 28 }}>Beta · last updated June 2026</p>

        <Section title="This is a game, not gambling">
          Finiliar Crypto Arena is a free-to-play game for entertainment. You make
          predictions about crypto price movements to earn <b>CUTE$</b>, an in-game
          score. There is no buy-in, no wager of real money, and nothing of real
          value is staked or won. It is not a betting, gambling, or money-gaming
          service.
        </Section>

        <Section title="CUTE$ has no cash value">
          CUTE$ is an internal, non-transferable game currency. It <b>cannot</b> be
          purchased, withdrawn, sold, transferred, or exchanged for money, crypto,
          NFTs, or anything of monetary value. It exists only to play the game.
          Future ecosystem rewards, if any, are discretionary and subject to legal
          and regulatory review.
        </Section>

        <Section title="Beta + testnet">
          This is an early beta. Any on-chain CUTE$ token is deployed on a <b>test
          network</b> with no monetary value. Balances, battles, bots, and odds may
          be reset, changed, or removed at any time. Expect rough edges.
        </Section>

        <Section title="Not financial advice">
          Nothing here is financial, investment, or trading advice. Crypto price
          data is sourced from third parties (e.g. CoinGecko / exchanges), may be
          delayed or inaccurate, and must not be used as a trading tool. Predicting
          in the arena has no bearing on real markets.
        </Section>

        <Section title="Fair play">
          One account per person for the beta. Automated abuse, exploiting bugs, or
          attempting to manipulate odds, balances, or settlements may result in
          removal. House bots provide liquidity and opposing sides so battles can
          resolve even with few human players.
        </Section>

        <Section title="How payouts work">
          Odds shown are the live split of CUTE$ staked across the two sides. When
          you place a prediction your payout multiplier is <b>locked at that moment</b>
          (back a 40% side → 2.5×). If your side wins you receive
          stake × the locked multiplier; if it loses you receive nothing; if a
          battle can't be fairly resolved it is voided and your stake is returned.
        </Section>

        <p style={{ fontSize: 13, color: "#999", marginTop: 32, lineHeight: 1.6 }}>
          By playing you acknowledge this is a no-stakes game for fun. Questions?
          Reach the team via the project channels.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f0f0f0", padding: "20px 24px", marginBottom: 14 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111", margin: "0 0 8px" }}>{title}</h2>
      <p style={{ fontSize: 14, color: "#444", lineHeight: 1.65, margin: 0 }}>{children}</p>
    </div>
  );
}
