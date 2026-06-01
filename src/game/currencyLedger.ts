/**
 * Mock currency ledger — the simulated-ETH analogue of MockOwnershipLedger.
 *
 * All amounts are INTEGER MINOR UNITS (think "gwei-ish credits"). The UI
 * formats them for display; the game logic only ever does integer math so
 * prize splits are exact and never leak floating-point dust.
 *
 *  ─────────────── FUTURE REAL ESCROW ───────────────────────────────────
 *  This ledger is in-memory only. When the audited escrow contract lands:
 *    - Replace `escrowDeposit` with an on-chain deposit() call.
 *    - Replace `payout` / `houseCollect` with contract-driven settlement.
 *    - Player balances become real wallet balances; the "house" becomes a
 *      protocol treasury address.
 *  Keep this interface stable so the swap is mechanical. Do NOT wire real
 *  funds through this file.
 *  ──────────────────────────────────────────────────────────────────────
 */

export const HOUSE_ACCOUNT = "__house__";

export type EscrowId = string;

export class MockCurrencyLedger {
  private balances = new Map<string, number>();
  /** Funds locked in a named escrow (e.g. a league pot) until settled. */
  private escrows = new Map<EscrowId, number>();
  private houseTotal = 0;

  getBalance(playerId: string): number {
    return this.balances.get(playerId) ?? 0;
  }

  /** Top up a player's balance (faucet / test setup). */
  credit(playerId: string, amount: number): void {
    if (amount < 0) throw new Error("credit amount must be >= 0");
    this.balances.set(playerId, this.getBalance(playerId) + amount);
  }

  /** Returns false if the player can't cover the amount (no mutation). */
  debit(playerId: string, amount: number): boolean {
    if (amount < 0) throw new Error("debit amount must be >= 0");
    const bal = this.getBalance(playerId);
    if (bal < amount) return false;
    this.balances.set(playerId, bal - amount);
    return true;
  }

  /**
   * Move `amount` from a player's balance into a named escrow pot.
   * Returns false (no mutation) if the player can't cover it.
   */
  escrowDeposit(escrowId: EscrowId, playerId: string, amount: number): boolean {
    if (!this.debit(playerId, amount)) return false;
    this.escrows.set(escrowId, (this.escrows.get(escrowId) ?? 0) + amount);
    return true;
  }

  escrowBalance(escrowId: EscrowId): number {
    return this.escrows.get(escrowId) ?? 0;
  }

  /**
   * Pay `amount` out of an escrow pot to a player's balance.
   * Throws if the pot can't cover it (a settlement bug, not a user error).
   */
  payout(escrowId: EscrowId, playerId: string, amount: number): void {
    const pot = this.escrowBalance(escrowId);
    if (amount > pot) {
      throw new Error(
        `payout ${amount} exceeds escrow ${escrowId} balance ${pot}`,
      );
    }
    this.escrows.set(escrowId, pot - amount);
    this.credit(playerId, amount);
  }

  /** Collect the house rake out of an escrow pot into the house total. */
  houseCollect(escrowId: EscrowId, amount: number): void {
    const pot = this.escrowBalance(escrowId);
    if (amount > pot) {
      throw new Error(
        `house cut ${amount} exceeds escrow ${escrowId} balance ${pot}`,
      );
    }
    this.escrows.set(escrowId, pot - amount);
    this.houseTotal += amount;
  }

  /** Refund an entire escrow back to a single player (cancelled league). */
  escrowRefund(escrowId: EscrowId, playerId: string): number {
    const pot = this.escrowBalance(escrowId);
    this.escrows.set(escrowId, 0);
    this.credit(playerId, pot);
    return pot;
  }

  getHouseTotal(): number {
    return this.houseTotal;
  }

  snapshot(): { balances: Record<string, number>; house: number } {
    return {
      balances: Object.fromEntries(this.balances.entries()),
      house: this.houseTotal,
    };
  }
}

/** Shared singleton for MVP, mirroring mockOwnershipLedger. */
export const mockCurrencyLedger = new MockCurrencyLedger();
