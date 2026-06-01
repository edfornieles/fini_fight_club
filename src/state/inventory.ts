/**
 * Player inventory — consumables (potions, snacks).
 * Persisted to localStorage for the MVP prototype. In production this is a
 * server-side ledger so items can't be duplicated.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PotionId = "energy_potion" | "quick_snack" | "full_revive" | "xp_truffle";

export interface Potion {
  id: PotionId;
  name: string;
  icon: string;
  effect: string;
  description: string;
  price: number;       // in 🍪 Crumbs
  color: string;
}

export const POTIONS: Record<PotionId, Potion> = {
  energy_potion: {
    id: "energy_potion",
    name: "Energy Potion",
    icon: "🧪",
    effect: "Fully restores rest cooldown",
    description: "A fizzy pink draught — wakes a Fini up instantly and clears all fatigue.",
    price: 40,
    color: "#f472b6",
  },
  quick_snack: {
    id: "quick_snack",
    name: "Quick Snack",
    icon: "🍪",
    effect: "Removes 15 min of rest",
    description: "A buttery biscuit — small bite, big boost. Knocks 15 minutes off the cooldown.",
    price: 12,
    color: "#fbbf24",
  },
  full_revive: {
    id: "full_revive",
    name: "Full Revive",
    icon: "💖",
    effect: "Restores rest + heals to max HP next battle",
    description: "A rare elixir. Wakes the Fini up AND grants +20% HP for their next battle.",
    price: 90,
    color: "#ef4444",
  },
  xp_truffle: {
    id: "xp_truffle",
    name: "XP Truffle",
    icon: "🍫",
    effect: "+20 XP instantly",
    description: "A chocolate-coated experience boost. Awards 20 XP — useful for grinding to the next level.",
    price: 30,
    color: "#a78bfa",
  },
};

interface InventoryState {
  items: Partial<Record<PotionId, number>>;  // potionId → count
  add:     (id: PotionId, qty?: number) => void;
  consume: (id: PotionId) => boolean;        // returns true if consumed
  count:   (id: PotionId) => number;
  /** Buy a potion: debits FINI$ on the server, then adds to inventory. */
  buyPotion: (id: PotionId) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export const useInventory = create<InventoryState>()(
  persist(
    (set, getState) => ({
      items: { quick_snack: 2, energy_potion: 1 },
      add: (id, qty = 1) => set(s => ({ items: { ...s.items, [id]: (s.items[id] ?? 0) + qty } })),
      consume: (id) => {
        const have = getState().items[id] ?? 0;
        if (have <= 0) return false;
        set(s => ({ items: { ...s.items, [id]: (s.items[id] ?? 0) - 1 } }));
        return true;
      },
      count: (id) => getState().items[id] ?? 0,

      buyPotion: async (id) => {
        // Crumbs are purely client-side — no server call required. Use the
        // crumb store atomically (spend returns false if you can't afford it).
        const { useCrumbStore } = await import("./crumbStore");
        const p = POTIONS[id];
        if (!useCrumbStore.getState().spend(p.price)) {
          return { ok: false, error: "not_enough_crumbs" };
        }
        getState().add(id);
        return { ok: true };
      },
    }),
    { name: "fini-inventory-v1" }
  )
);
