// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * CUTE$ — the play-only game token for Finiliar Crypto Arena.
 *
 * IMPORTANT: This is a game token with NO cash value. The real in-game currency
 * is the off-chain Supabase ledger; this ERC20 exists so CUTE$ can show up in a
 * wallet and back optional claims/airdrops. Deploy on a TESTNET for the beta.
 *
 * - Standard ERC20 (18 decimals) so wallets/explorers display it.
 * - Ownable: the deployer/treasury can mint for claim campaigns and airdrops.
 * - 1,000,000,000 CUTE minted to the owner at deploy (the house treasury).
 */
contract CuteToken is ERC20, Ownable {
    constructor(address initialOwner)
        ERC20("Finiliar CUTE", "CUTE")
        Ownable(initialOwner)
    {
        _mint(initialOwner, 1_000_000_000 * 10 ** decimals());
    }

    /// Mint more CUTE$ to an address (claims, airdrops). Owner only.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// Batch airdrop helper for claim campaigns. Owner only.
    function airdrop(address[] calldata recipients, uint256 amountEach) external onlyOwner {
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amountEach);
        }
    }
}
