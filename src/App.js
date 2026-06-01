import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Component } from "react";
import { Routes, Route } from "react-router-dom";
import { BattleArena } from "./components/BattleArena";
class ErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(e) {
        return { error: e instanceof Error ? e.message + "\n" + e.stack : String(e) };
    }
    render() {
        if (this.state.error)
            return (_jsxs("div", { style: { fontFamily: "monospace", padding: 24, background: "#fff", color: "#c00", whiteSpace: "pre-wrap", fontSize: 13, maxHeight: "100vh", overflow: "auto" }, children: [_jsx("strong", { children: "Runtime error:" }), "\n\n", this.state.error] }));
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
    return (_jsxs(_Fragment, { children: [_jsx(WalletSync, {}), _jsx(SiteNav, {}), _jsx(DevWalletSwitcher, {}), _jsx(ErrorBoundary, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(LandingPage, {}) }), _jsx(Route, { path: "/crypto", element: _jsx(CryptoArenaPage, {}) }), _jsx(Route, { path: "/crypto/:asset", element: _jsx(AssetPage, {}) }), _jsx(Route, { path: "/battle/:battleId", element: _jsx(BattlePage, {}) }), _jsx(Route, { path: "/claim", element: _jsx(ClaimPage, {}) }), _jsx(Route, { path: "/account", element: _jsx(AccountPage, {}) }), _jsx(Route, { path: "/profile", element: _jsx(ProfilePage, {}) }), _jsx(Route, { path: "/leaderboard", element: _jsx(LeaderboardPage, {}) }), _jsx(Route, { path: "/fight-club", element: _jsx(FightClubPage, {}) }), _jsx(Route, { path: "/fini/:tokenId", element: _jsx(FiniProfilePage, {}) })] }) }), _jsx(BattleArena, {}), _jsx(StableOverlay, {}), _jsx(LeagueOverlay, {}), _jsx(TournamentOverlay, {}), _jsx(LeaderboardOverlay, {})] }));
}
