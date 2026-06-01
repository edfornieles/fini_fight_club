import { useState } from "react";
import { useGameStore, type TeamSlotState } from "../state/gameStore";
import { FAMILY_COLOR } from "./familyColors";
import { describeItemDelta, type Item } from "../game/items";
import { ROLL_COST, SELL_REFUND, UNIT_COST } from "../game/runConstants";
import { HealthBar } from "./HealthBar";
import { MarketTodayPanel } from "./MarketTodayPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { FiniAvatar, moodFromHp } from "./FiniAvatar";
import type { Fini } from "../game/types";

export function ShopScreen() {
  const teamSlots = useGameStore((s) => s.teamSlots);
  const shop = useGameStore((s) => s.shop);
  const gold = useGameStore((s) => s.gold);
  const inventory = useGameStore((s) => s.inventory);
  const rollShop = useGameStore((s) => s.rollShop);
  const toggleLock = useGameStore((s) => s.toggleShopLock);
  const buyUnit = useGameStore((s) => s.buyUnit);
  const buyItem = useGameStore((s) => s.buyItem);
  const sellUnit = useGameStore((s) => s.sellUnit);
  const equipItem = useGameStore((s) => s.equipItemOnSlot);
  const unequip = useGameStore((s) => s.unequipSlot);
  const readyForEncounter = useGameStore((s) => s.readyForEncounter);

  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<0 | 1 | 2 | null>(null);

  const teamFilled = teamSlots.filter((s) => s.fini).length;
  const stage = useGameStore((s) => s.stage);
  const isRanked = useGameStore((s) => s.isRanked);

  const handleBuyUnit = (idx: number) => {
    setError(null);
    const target =
      selectedSlot !== null && !teamSlots[selectedSlot]!.fini
        ? selectedSlot
        : (teamSlots.findIndex((s) => !s.fini) as 0 | 1 | 2 | -1);
    if (target === -1) {
      setError("All team slots are full — sell a Fini first! 🫧");
      return;
    }
    const err = buyUnit(idx, target as 0 | 1 | 2);
    if (err) setError(err);
  };

  const handleBuyItem = (idx: number) => {
    setError(null);
    const slot = selectedSlot;
    if (slot === null || !teamSlots[slot]!.fini) {
      setError("Tap a Fini on your team first, then buy the treat. 🍬");
      return;
    }
    const err = buyItem(idx, slot);
    if (err) setError(err);
  };

  return (
    <div className="space-y-3">
      <div className="grid lg:grid-cols-[1fr_320px] gap-3">
        <div className="space-y-3">
          {/* TEAM */}
          <section className="kcard p-4">
            <div className="flex items-baseline justify-between mb-2.5">
              <div className="label-soft">🧺 Your Team</div>
              <div className="chip bg-grape/15 text-ink">{teamFilled} / 3</div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {teamSlots.map((slot, i) => (
                <TeamSlot
                  key={i}
                  slot={slot}
                  selected={selectedSlot === i}
                  inventoryItem={
                    slot.itemId
                      ? inventory.find((it) => it.id === slot.itemId) ?? null
                      : null
                  }
                  onClick={() =>
                    setSelectedSlot(selectedSlot === i ? null : (i as 0 | 1 | 2))
                  }
                  onSell={() => sellUnit(i as 0 | 1 | 2)}
                  onUnequip={() => unequip(i as 0 | 1 | 2)}
                />
              ))}
            </div>
            <div className="mt-2.5 text-[11px] text-inkSoft font-semibold">
              Tap a slot to select it, then buy a Fini to fill it or a treat to equip. 💕
            </div>
          </section>

          {/* SHOP UNITS */}
          <section className="kcard p-4">
            <div className="flex items-baseline justify-between mb-2.5">
              <div className="label-soft">🛍️ Finis · {UNIT_COST}🪙 each</div>
              <div className="chip bg-sky/20 text-ink">Stage {stage} pool</div>
            </div>
            {shop.units.length === 0 ? (
              <div className="text-inkSoft text-sm italic font-semibold">
                Stall's empty — give it a roll! 🎲
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-2.5">
                {shop.units.map((u, idx) => (
                  <ShopUnitCard
                    key={u.id}
                    unit={u}
                    affordable={gold >= UNIT_COST}
                    onBuy={() => handleBuyUnit(idx)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* SHOP ITEMS */}
          <section className="kcard p-4">
            <div className="label-soft mb-2.5">🍬 Treats</div>
            {shop.items.length === 0 ? (
              <div className="text-inkSoft text-sm italic font-semibold">
                No treats left this roll.
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-2.5">
                {shop.items.map((it, idx) => (
                  <ShopItemCard
                    key={it.id}
                    item={it}
                    affordable={gold >= it.cost}
                    onBuy={() => handleBuyItem(idx)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* INVENTORY */}
          <section className="kcard p-4">
            <div className="label-soft mb-2.5">🎒 Inventory</div>
            {inventory.length === 0 ? (
              <div className="text-inkSoft text-sm italic font-semibold">
                Inventory is empty.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {inventory.map((it, i) => {
                  const equippedSlot = teamSlots.findIndex(
                    (s) => s.itemId === it.id,
                  );
                  return (
                    <div
                      key={`${it.id}-${i}`}
                      className="kcard-soft px-3 py-2 flex items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-display font-semibold text-ink">
                          {it.name}
                        </div>
                        <div className="text-[10px] text-mintDark font-display font-semibold">
                          {describeItemDelta(it).join(" · ")}
                        </div>
                      </div>
                      {equippedSlot >= 0 ? (
                        <div className="chip bg-mint/20 text-mintDark text-[10px]">
                          slot {equippedSlot + 1}
                        </div>
                      ) : selectedSlot !== null &&
                        teamSlots[selectedSlot]!.fini ? (
                        <button
                          onClick={() => equipItem(it.id, selectedSlot as 0 | 1 | 2)}
                          className="kbtn kbtn-ghost text-[11px] px-2.5 py-1"
                        >
                          Equip
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* SIDE: actions */}
        <aside className="space-y-3">
          <MarketTodayPanel />
          <div className="kcard p-4 space-y-2.5">
            <div className="label-soft">🎮 Shop Actions</div>
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-display font-semibold text-ink">Your coins</span>
              <span className="lcd px-3 py-1">🪙 {gold}</span>
            </div>
            <button
              onClick={rollShop}
              disabled={gold < ROLL_COST}
              className="kbtn kbtn-mint w-full py-3"
            >
              🎲 Roll ({ROLL_COST}🪙)
            </button>
            <button
              onClick={toggleLock}
              className={`kbtn w-full py-3 ${shop.locked ? "kbtn-gold" : "kbtn-ghost"}`}
            >
              {shop.locked ? "🔒 Locked" : "🔓 Lock shop"}
            </button>
            <button
              onClick={readyForEncounter}
              disabled={teamFilled === 0}
              className="kbtn kbtn-primary w-full py-3.5 text-base"
            >
              {isRanked ? "⚔️ Queue Match" : "✨ Ready!"}
            </button>
            <p className="text-[11px] text-inkSoft font-semibold leading-relaxed">
              {isRanked
                ? "Fight a real team near your rating. Your draft joins the rival pool."
                : `Sell refund: ${SELL_REFUND}🪙. Locked shops carry to the next stage.`}
            </p>
          </div>

          {isRanked && <LeaderboardPanel limit={8} />}

          {error && (
            <div className="kcard p-3 text-sm text-coral font-display font-semibold border-2 !border-coral/40 bg-coral/10">
              {error}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TeamSlot(props: {
  slot: TeamSlotState;
  selected: boolean;
  inventoryItem: Item | null;
  onClick: () => void;
  onSell: () => void;
  onUnequip: () => void;
}) {
  const { slot, selected, inventoryItem } = props;
  if (!slot.fini) {
    return (
      <button
        onClick={props.onClick}
        className={`aspect-[3/4] rounded-2xl border-[3px] border-dashed transition-all flex flex-col items-center justify-center gap-1 text-inkSoft text-xs font-display font-semibold ${
          selected
            ? "border-bubble bg-bubble/10 scale-[1.03]"
            : "border-cloud hover:border-grape/50 hover:bg-grape/5"
        }`}
      >
        <span className="text-2xl opacity-50">＋</span>
        empty
      </button>
    );
  }
  const f = slot.fini;
  const color = FAMILY_COLOR[f.family];
  const mood = moodFromHp(f.currentHealth / f.maxHealth, f.fainted);
  return (
    <div
      onClick={props.onClick}
      className={`kcard p-2.5 cursor-pointer transition-all ${
        selected ? "scale-[1.03]" : "hover:-translate-y-0.5"
      }`}
      style={{
        boxShadow: selected
          ? "0 0 0 3px #ff8fc7, 0 12px 24px -12px rgba(255,143,199,0.6)"
          : `0 0 0 2px ${color.hex}33`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <FiniAvatar family={f.family} mood={mood} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-display font-semibold leading-tight truncate text-ink">
            {f.name}
          </div>
          <div className="text-[9px] font-display font-semibold text-inkSoft">
            {f.family} · Lv {f.level}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onSell();
          }}
          className="chip bg-lemon/30 text-[9px] text-ink hover:brightness-105"
        >
          🪙1
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center my-1 text-[10px]">
        <Mini label="ATK" value={f.strength} />
        <Mini label="HP" value={`${f.currentHealth}/${f.maxHealth}`} />
        <Mini label="SPD" value={f.speed} />
      </div>
      <HealthBar current={f.currentHealth} max={f.maxHealth} colorHex={color.hex} height={9} />
      <div className="text-[9px] font-display font-semibold text-inkSoft mt-1.5 truncate">
        {f.passiveAbility.replace(/_/g, " ").toLowerCase()}
      </div>
      <div className="mt-1.5 kcard-soft px-2 py-1 text-[10px]">
        {inventoryItem ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-mintDark font-display font-semibold truncate">
              {inventoryItem.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onUnequip();
              }}
              className="text-[9px] font-semibold text-inkSoft hover:text-ink"
            >
              ✕
            </button>
          </div>
        ) : (
          <span className="text-inkSoft italic">no treat</span>
        )}
      </div>
    </div>
  );
}

function Mini(props: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-inkSoft text-[8px] font-display font-bold tracking-wider">
        {props.label}
      </div>
      <div className="text-sm text-ink font-display font-semibold">{props.value}</div>
    </div>
  );
}

function ShopUnitCard(props: {
  unit: Fini;
  affordable: boolean;
  onBuy: () => void;
}) {
  const { unit, affordable, onBuy } = props;
  const color = FAMILY_COLOR[unit.family];
  return (
    <button
      onClick={onBuy}
      disabled={!affordable}
      className={`kcard-soft text-left p-2.5 transition-all ${
        affordable ? "hover:-translate-y-1 hover:shadow-puff cursor-pointer" : "opacity-55"
      }`}
      style={{ boxShadow: `0 0 0 2px ${color.hex}33` }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <FiniAvatar family={unit.family} mood="happy" size={32} />
          <div className="min-w-0">
            <div className="text-sm font-display font-semibold text-ink truncate">
              {unit.name}
            </div>
            <div className="text-[9px] font-display font-semibold text-inkSoft">
              {unit.family}
            </div>
          </div>
        </div>
        <div className="chip bg-lemon/30 text-ink text-[11px]">{UNIT_COST}🪙</div>
      </div>
      <div className="text-[10px] text-ink font-display font-semibold mt-1">
        ⚔{unit.strength} ❤{unit.maxHealth} ⚡{unit.speed} 🛡{unit.defense}
      </div>
      <div className="text-[9px] text-inkSoft font-display font-semibold mt-0.5 truncate">
        {unit.passiveAbility.replace(/_/g, " ").toLowerCase()}
      </div>
    </button>
  );
}

function ShopItemCard(props: {
  item: Item;
  affordable: boolean;
  onBuy: () => void;
}) {
  const { item, affordable, onBuy } = props;
  return (
    <button
      onClick={onBuy}
      disabled={!affordable}
      className={`kcard-soft text-left p-2.5 transition-all ${
        affordable ? "hover:-translate-y-1 hover:shadow-puff cursor-pointer" : "opacity-55"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-display font-semibold text-ink">{item.name}</div>
        <div className="chip bg-lemon/30 text-ink text-[11px]">{item.cost}🪙</div>
      </div>
      <div className="text-[10px] text-inkSoft font-semibold mt-1">{item.description}</div>
      <div className="text-[10px] text-mintDark font-display font-semibold mt-0.5">
        {describeItemDelta(item).join(" · ")}
      </div>
    </button>
  );
}
