import { Component, type ReactNode } from "react";
import { Routes, Route } from "react-router-dom";
import { BattleArena } from "./components/BattleArena";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message + "\n" + (e as Error).stack : String(e) };
  }
  render() {
    if (this.state.error) return (
      <div style={{ fontFamily: "monospace", padding: 24, background: "#fff", color: "#c00", whiteSpace: "pre-wrap", fontSize: 13, maxHeight: "100vh", overflow: "auto" }}>
        <strong>Runtime error:</strong>
        {"\n\n"}{this.state.error}
      </div>
    );
    return this.props.children;
  }
}
import { StableOverlay } from "./components/StableOverlay";
import { LeagueOverlay } from "./components/LeagueOverlay";
import { TournamentOverlay } from "./components/TournamentOverlay";
import { LeaderboardOverlay } from "./components/LeaderboardOverlay";
import { SiteNav } from "./components/SiteNav";
import { WalletSync } from "./components/WalletSync";
import { DevWalletSwitcher } from "./components/DevWalletSwitcher";
import { LandingPage } from "./pages/LandingPage";
import { CryptoArenaPage } from "./pages/CryptoArenaPage";
import { AssetPage } from "./pages/AssetPage";
import { BattlePage } from "./pages/BattlePage";
import { ClaimPage } from "./pages/ClaimPage";
import { AccountPage } from "./pages/AccountPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { FightClubPage } from "./pages/FightClubPage";
import { FiniProfilePage } from "./pages/FiniProfilePage";

export default function App() {
  return (
    <>
      <WalletSync />
      <SiteNav />
      <DevWalletSwitcher />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/crypto" element={<CryptoArenaPage />} />
          <Route path="/crypto/:asset" element={<AssetPage />} />
          <Route path="/battle/:battleId" element={<BattlePage />} />
          <Route path="/claim" element={<ClaimPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/fight-club" element={<FightClubPage />} />
          <Route path="/fini/:tokenId" element={<FiniProfilePage />} />
        </Routes>
      </ErrorBoundary>
      {/* Game overlays (modal layers, phase-driven) */}
      <BattleArena />
      <StableOverlay />
      <LeagueOverlay />
      <TournamentOverlay />
      <LeaderboardOverlay />
    </>
  );
}
