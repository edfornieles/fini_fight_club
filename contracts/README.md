# CUTE$ token (testnet)

`CuteToken.sol` is the play-only CUTE$ ERC20 for the soft-launch beta. It has
**no cash value** — the real in-game currency is the off-chain Supabase ledger.
This token just lets CUTE$ appear in a wallet and back optional claims/airdrops.
Deploy it on a **testnet** (Base Sepolia recommended).

## Easiest: deploy via Remix (no local toolchain)
1. Open <https://remix.ethereum.org>, create `CuteToken.sol`, paste this folder's file.
2. In **Solidity Compiler**, pick `0.8.20+`, enable the OpenZeppelin import
   resolver (Remix fetches `@openzeppelin/contracts` automatically), Compile.
3. In **Deploy & Run**: set Environment to **Injected Provider** with your wallet
   on **Base Sepolia** (add the network + get test ETH from a faucet first).
4. Constructor arg `initialOwner` = your wallet/treasury address. Deploy.
5. Copy the deployed contract address.

## Or with Foundry
```bash
forge install OpenZeppelin/openzeppelin-contracts
forge create contracts/CuteToken.sol:CuteToken \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_KEY \
  --constructor-args $TREASURY_ADDRESS
```

## Wire it into the app
Add to `.env.production` (and `.env.local` for dev):
```
VITE_CUTE_TOKEN_ADDRESS=0x...        # the deployed address
VITE_CUTE_RPC_URL=https://sepolia.base.org   # optional; defaults to a public Base-Sepolia RPC
```
`src/lib/cuteToken.ts` then reads on-chain balances (read-only). Until the
address is set, the app runs entirely on the off-chain ledger — the token is
optional for the beta.

## Notes
- 1B CUTE$ is minted to the owner at deploy (the house treasury). Use `mint` /
  `airdrop` for claim campaigns.
- This stays play-only: do **not** add a cash on-ramp, DEX pair, or
  buy/sell/withdraw path — that would change the legal/gambling posture decided
  for launch (see `/terms`).
