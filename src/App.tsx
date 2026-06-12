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
import { NotificationToasts } from "./components/NotificationToasts";
import { useBattleResolver } from "./hooks/useBattleResolver";
import { useStrategyExecutor } from "./hooks/useStrategyExecutor";
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
import { PlayerProfilePage } from "./pages/PlayerProfilePage";
import { ChallengePage } from "./pages/ChallengePage";
import { TournamentPage } from "./pages/TournamentPage";
import { StrategiesPage } from "./pages/StrategiesPage";
import { AdminBotsPage } from "./pages/AdminBotsPage";
import { Fini3DTestPage } from "./pages/Fini3DTestPage";
import { AnimLabPage } from "./pages/AnimLabPage";

export default function App() {
  // Battle settlement runs globally so resolutions happen no matter where
  // the user is on the site. Toasts pop wherever the user is when an entry
  // resolves.
  useBattleResolver();
  useStrategyExecutor();
  return (
    <>
      <WalletSync />
      <SiteNav />
      <DevWalletSwitcher />
      <NotificationToasts />
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
          <Route path="/p/:wallet" element={<PlayerProfilePage />} />
          <Route path="/challenge" element={<ChallengePage />} />
          <Route path="/strategies" element={<StrategiesPage />} />
          <Route path="/tournament" element={<TournamentPage />} />
          <Route path="/admin/bots" element={<AdminBotsPage />} />
          <Route path="/fini-3d-test" element={<Fini3DTestPage />} />
          <Route path="/anim-lab" element={<AnimLabPage />} />
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
