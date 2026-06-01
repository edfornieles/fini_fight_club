import { create } from "zustand";

interface UIState {
  // overlay open flags
  stableOpen: boolean;
  leagueOpen: boolean;
  tournamentOpen: boolean;
  leaderboardOpen: boolean;
  // wallet
  walletAddress: string | null;
  walletDropdownOpen: boolean;

  openStable: () => void;
  closeStable: () => void;
  openLeague: () => void;
  closeLeague: () => void;
  openTournament: () => void;
  closeTournament: () => void;
  openLeaderboard: () => void;
  closeLeaderboard: () => void;
  connectWallet: (address: string) => void;
  disconnectWallet: () => void;
  setWalletDropdown: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  stableOpen: false,
  leagueOpen: false,
  tournamentOpen: false,
  leaderboardOpen: false,
  walletAddress: null,
  walletDropdownOpen: false,

  openStable: () => set({ stableOpen: true }),
  closeStable: () => set({ stableOpen: false }),
  openLeague: () => set({ leagueOpen: true }),
  closeLeague: () => set({ leagueOpen: false }),
  openTournament: () => set({ tournamentOpen: true }),
  closeTournament: () => set({ tournamentOpen: false }),
  openLeaderboard: () => set({ leaderboardOpen: true }),
  closeLeaderboard: () => set({ leaderboardOpen: false }),
  connectWallet: (address) => set({ walletAddress: address, walletDropdownOpen: false }),
  disconnectWallet: () => set({ walletAddress: null, walletDropdownOpen: false }),
  setWalletDropdown: (open) => set({ walletDropdownOpen: open }),
}));
