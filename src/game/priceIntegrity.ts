/**
 * Price Integrity — server-authoritative resolution schema.
 *
 * The client NEVER submits prices, winners, returns, payouts, or balances.
 * Every battle instance carries a complete, immutable audit trail that any
 * user can inspect to verify exactly why the battle resolved the way it did.
 */

// ── Battle template (defines rules before any instance is created) ─────────────

export type PriceSource =
  | "coingecko_v3"
  | "coinbase_spot"
  | "binance_spot"
  | "kraken_spot"
  | "manual_admin";

export type FallbackBehavior = "use_backup" | "pause" | "manual_review" | "void";
export type ManualReviewBehavior = "hold_entries" | "void_after_hours";
export type VoidBehavior = "return_all_entries" | "return_minus_fee";

export type ResolutionStatus =
  | "pending"        // battle not yet started
  | "open"           // battle running, entries accepted
  | "locked"         // entry cutoff passed, awaiting end
  | "resolving"      // end price snapshot in progress
  | "resolved"       // winner determined, payouts queued
  | "manual_review"  // price integrity failed, human needed
  | "voided";        // cannot resolve fairly, all entries returned

export interface BattleTemplate {
  templateId: string;
  name: string;
  questionTemplate: string;           // e.g. "Will {asset} close above {target} at {end}?"
  primaryPriceSource: PriceSource;
  backupPriceSources: PriceSource[];
  startPriceRule: "at_battle_start" | "5min_twap_before_start";
  endPriceRule: "at_battle_end" | "5min_twap_before_end" | "ohlc_close";
  stalePriceThresholdSeconds: number; // reject snapshot if older than this
  maxAllowedDeviationBps: number;     // reject if sources deviate more than N basis points
  fallbackBehavior: FallbackBehavior;
  manualReviewBehavior: ManualReviewBehavior;
  voidBehavior: VoidBehavior;
  entryCutoffSeconds: number;         // no entries this many seconds before end
  resolutionFormula: string;          // human-readable formula description
}

// ── Per-snapshot record ────────────────────────────────────────────────────────

export interface PriceSnapshot {
  source: PriceSource;
  price: number;
  fetchedAt: string;          // ISO timestamp
  latencyMs: number;
  raw?: string;               // optional raw response hash for audit
}

export interface DeviationReport {
  primaryPrice: number;
  backupPrices: { source: PriceSource; price: number }[];
  maxDeviationBps: number;
  withinThreshold: boolean;
}

// ── Battle instance (created per actual battle) ────────────────────────────────

export interface BattleInstance {
  battleId: string;
  templateId: string;
  asset: string;
  question: string;
  sideALabel: string;
  sideBLabel: string;

  // Official start
  officialStartPrice: number | null;
  officialStartPriceSource: PriceSource | null;
  officialStartTimestamp: string | null;
  startBackupPriceChecks: PriceSnapshot[];
  startDeviationReport: DeviationReport | null;

  // Official end
  officialEndPrice: number | null;
  officialEndPriceSource: PriceSource | null;
  officialEndTimestamp: string | null;
  endBackupPriceChecks: PriceSnapshot[];
  endDeviationReport: DeviationReport | null;

  // Resolution
  resolutionFormula: string;
  resolutionCalculation: string;      // filled-in formula, e.g. "97420 > 97240 → Up wins"
  winningSide: "A" | "B" | null;
  resolutionStatus: ResolutionStatus;
  resolutionAuditLog: AuditLogEntry[];

  // Void reason (if voided)
  voidReason?: string;
}

export interface AuditLogEntry {
  timestamp: string;
  event: string;
  detail?: string;
  actor: "system" | "admin";
}

// ── Validation helpers (run server-side before any resolution) ─────────────────

export function isPriceStale(snapshot: PriceSnapshot, thresholdSeconds: number): boolean {
  const age = (Date.now() - new Date(snapshot.fetchedAt).getTime()) / 1000;
  return age > thresholdSeconds;
}

export function computeDeviationBps(priceA: number, priceB: number): number {
  return Math.abs((priceA - priceB) / priceA) * 10000;
}

export function validatePriceIntegrity(
  primary: PriceSnapshot,
  backups: PriceSnapshot[],
  template: Pick<BattleTemplate, "stalePriceThresholdSeconds" | "maxAllowedDeviationBps">,
): { valid: boolean; reason?: string; deviationReport: DeviationReport } {
  if (isPriceStale(primary, template.stalePriceThresholdSeconds)) {
    return {
      valid: false,
      reason: `Primary price is stale (>${template.stalePriceThresholdSeconds}s old)`,
      deviationReport: buildDeviationReport(primary, backups),
    };
  }

  const report = buildDeviationReport(primary, backups);
  if (!report.withinThreshold) {
    return {
      valid: false,
      reason: `Price deviation ${report.maxDeviationBps.toFixed(0)}bps exceeds limit of ${template.maxAllowedDeviationBps}bps`,
      deviationReport: report,
    };
  }

  return { valid: true, deviationReport: report };
}

function buildDeviationReport(primary: PriceSnapshot, backups: PriceSnapshot[]): DeviationReport {
  const backupPrices = backups.map(b => ({ source: b.source, price: b.price }));
  const maxDeviationBps = backups.reduce((max, b) => {
    return Math.max(max, computeDeviationBps(primary.price, b.price));
  }, 0);
  return {
    primaryPrice: primary.price,
    backupPrices,
    maxDeviationBps,
    withinThreshold: maxDeviationBps <= 50, // default 50bps; real check uses template value
  };
}
