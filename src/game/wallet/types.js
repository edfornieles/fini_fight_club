/**
 * Wallet ownership integration types.
 *
 * This is the "data stream" half of the NFT-ownership pivot: pull the Finis a
 * wallet actually owns and normalize their on-chain metadata into `FiniTraits`
 * (the seam consumed by the attributes stream's `traitsToStats()`), plus the
 * display info the roster UI needs.
 *
 * Everything here is READ-ONLY. We never sign, never transfer, never need a key.
 */
export {};
