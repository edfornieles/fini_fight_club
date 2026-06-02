/**
 * "Up next" battle resolver — Polymarket-style continuity.
 *
 * Every battle template (e.g. btc-updown-15m, eth-vs-sol-2h) is a recurring
 * series. When one settles, the player should be one click away from the next
 * instance of the same series. This module finds that next battle:
 *
 *   1. If the current id includes a slot suffix (`template:2026-…`), strip it
 *      to get the template id.
 *   2. Query Supabase battle_instances for the next OPEN row of the same
 *      template, sorted by start_time ascending.
 *   3. Fall back to the local sim if Supabase is offline / empty.
 *   4. As a last resort, return the same template id (mock-battle compat).
 */
import { supabase, isOnline } from "./supabase";
import { useCryptoSim } from "../data/cryptoSim";

export function templateIdOf(battleId: string): string {
  const colon = battleId.indexOf(":");
  return colon === -1 ? battleId : battleId.slice(0, colon);
}

export async function findNextBattle(currentBattleId: string): Promise<string | null> {
  const template = templateIdOf(currentBattleId);
  const nowIso = new Date().toISOString();

  // Primary: Supabase battle_instances (server-spawned, authoritative).
  if (isOnline) {
    try {
      const { data } = await supabase
        .from("battle_instances")
        .select("id, start_time")
        .eq("template_id", template)
        .eq("status", "open")
        .gt("end_time", nowIso)
        .neq("id", currentBattleId)
        .order("start_time", { ascending: true })
        .limit(1);
      if (data && data.length > 0) return data[0].id;
    } catch { /* fall through */ }
  }

  // Secondary: local sim — finds any other battle with the same template
  // root that's still live or upcoming.
  const battles = useCryptoSim.getState().battles;
  const candidate = battles.find(b => {
    if (b.id === currentBattleId) return false;
    if (templateIdOf(b.id) !== template) return false;
    return b.status === "live" || b.status === "upcoming";
  });
  if (candidate) return candidate.id;

  // Tertiary: the template id itself, in case the page resolves it (mock list)
  if (template !== currentBattleId) return template;
  return null;
}
