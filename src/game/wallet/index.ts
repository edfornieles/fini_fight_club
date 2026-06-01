/**
 * Wallet ownership integration — public, read-only NFT roster plumbing.
 *
 * Quick start:
 *   import { resolveProvider } from "@/game/wallet";
 *   const provider = await resolveProvider();
 *   const roster = await provider.getRoster("0xff3d…43ea3");
 *
 * The roster's `traits` feed the attributes stream's `traitsToStats()`.
 */

export * from "./types";
export * from "./normalize";
export * from "./rpc";
export * from "./metadata";
export * from "./providers";
export * from "./toFini";
export * from "./teamStorage";
