import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet } from "wagmi/chains";
import { http } from "wagmi";

/**
 * Wagmi + RainbowKit config.
 *
 * The Finiliar NFT contract lives on Ethereum mainnet:
 *   0x5a0121a0a21232ec0d024dab9017314509026480
 * (see src/game/wallet/rpc.ts)
 *
 * For closed beta we keep things simple — mainnet only, public RPCs.
 * WalletConnect requires a projectId; get one free at https://cloud.walletconnect.com
 * For local dev, you can use "demo" but it will rate-limit.
 */

const WALLETCONNECT_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "demo";

export const wagmiConfig = getDefaultConfig({
  appName: "Fini Crypto Arena",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [mainnet],
  transports: {
    [mainnet.id]: http("https://ethereum-rpc.publicnode.com"),
  },
  ssr: false,
});
