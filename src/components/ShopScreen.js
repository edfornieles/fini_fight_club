import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useGameStore } from "../state/gameStore";
import { FAMILY_COLOR } from "./familyColors";
import { describeItemDelta } from "../game/items";
import { ROLL_COST, SELL_REFUND, UNIT_COST } from "../game/runConstants";
import { HealthBar } from "./HealthBar";
import { MarketTodayPanel } from "./MarketTodayPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { FiniAvatar, moodFromHp } from "./FiniAvatar";
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
    const [error, setError] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const teamFilled = teamSlots.filter((s) => s.fini).length;
    const stage = useGameStore((s) => s.stage);
    const isRanked = useGameStore((s) => s.isRanked);
    const handleBuyUnit = (idx) => {
        setError(null);
        const target = selectedSlot !== null && !teamSlots[selectedSlot].fini
            ? selectedSlot
            : teamSlots.findIndex((s) => !s.fini);
        if (target === -1) {
            setError("All team slots are full — sell a Fini first! 🫧");
            return;
        }
        const err = buyUnit(idx, target);
        if (err)
            setError(err);
    };
    const handleBuyItem = (idx) => {
        setError(null);
        const slot = selectedSlot;
        if (slot === null || !teamSlots[slot].fini) {
            setError("Tap a Fini on your team first, then buy the treat. 🍬");
            return;
        }
        const err = buyItem(idx, slot);
        if (err)
            setError(err);
    };
    return (_jsx("div", { className: "space-y-3", children: _jsxs("div", { className: "grid lg:grid-cols-[1fr_320px] gap-3", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("section", { className: "kcard p-4", children: [_jsxs("div", { className: "flex items-baseline justify-between mb-2.5", children: [_jsx("div", { className: "label-soft", children: "\uD83E\uDDFA Your Team" }), _jsxs("div", { className: "chip bg-grape/15 text-ink", children: [teamFilled, " / 3"] })] }), _jsx("div", { className: "grid grid-cols-3 gap-2.5", children: teamSlots.map((slot, i) => (_jsx(TeamSlot, { slot: slot, selected: selectedSlot === i, inventoryItem: slot.itemId
                                            ? inventory.find((it) => it.id === slot.itemId) ?? null
                                            : null, onClick: () => setSelectedSlot(selectedSlot === i ? null : i), onSell: () => sellUnit(i), onUnequip: () => unequip(i) }, i))) }), _jsx("div", { className: "mt-2.5 text-[11px] text-inkSoft font-semibold", children: "Tap a slot to select it, then buy a Fini to fill it or a treat to equip. \uD83D\uDC95" })] }), _jsxs("section", { className: "kcard p-4", children: [_jsxs("div", { className: "flex items-baseline justify-between mb-2.5", children: [_jsxs("div", { className: "label-soft", children: ["\uD83D\uDECD\uFE0F Finis \u00B7 ", UNIT_COST, "\uD83E\uDE99 each"] }), _jsxs("div", { className: "chip bg-sky/20 text-ink", children: ["Stage ", stage, " pool"] })] }), shop.units.length === 0 ? (_jsx("div", { className: "text-inkSoft text-sm italic font-semibold", children: "Stall's empty \u2014 give it a roll! \uD83C\uDFB2" })) : (_jsx("div", { className: "grid sm:grid-cols-3 gap-2.5", children: shop.units.map((u, idx) => (_jsx(ShopUnitCard, { unit: u, affordable: gold >= UNIT_COST, onBuy: () => handleBuyUnit(idx) }, u.id))) }))] }), _jsxs("section", { className: "kcard p-4", children: [_jsx("div", { className: "label-soft mb-2.5", children: "\uD83C\uDF6C Treats" }), shop.items.length === 0 ? (_jsx("div", { className: "text-inkSoft text-sm italic font-semibold", children: "No treats left this roll." })) : (_jsx("div", { className: "grid sm:grid-cols-3 gap-2.5", children: shop.items.map((it, idx) => (_jsx(ShopItemCard, { item: it, affordable: gold >= it.cost, onBuy: () => handleBuyItem(idx) }, it.id))) }))] }), _jsxs("section", { className: "kcard p-4", children: [_jsx("div", { className: "label-soft mb-2.5", children: "\uD83C\uDF92 Inventory" }), inventory.length === 0 ? (_jsx("div", { className: "text-inkSoft text-sm italic font-semibold", children: "Inventory is empty." })) : (_jsx("div", { className: "grid sm:grid-cols-2 gap-2", children: inventory.map((it, i) => {
                                        const equippedSlot = teamSlots.findIndex((s) => s.itemId === it.id);
                                        return (_jsxs("div", { className: "kcard-soft px-3 py-2 flex items-center gap-2", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-display font-semibold text-ink", children: it.name }), _jsx("div", { className: "text-[10px] text-mintDark font-display font-semibold", children: describeItemDelta(it).join(" · ") })] }), equippedSlot >= 0 ? (_jsxs("div", { className: "chip bg-mint/20 text-mintDark text-[10px]", children: ["slot ", equippedSlot + 1] })) : selectedSlot !== null &&
                                                    teamSlots[selectedSlot].fini ? (_jsx("button", { onClick: () => equipItem(it.id, selectedSlot), className: "kbtn kbtn-ghost text-[11px] px-2.5 py-1", children: "Equip" })) : null] }, `${it.id}-${i}`));
                                    }) }))] })] }), _jsxs("aside", { className: "space-y-3", children: [_jsx(MarketTodayPanel, {}), _jsxs("div", { className: "kcard p-4 space-y-2.5", children: [_jsx("div", { className: "label-soft", children: "\uD83C\uDFAE Shop Actions" }), _jsxs("div", { className: "flex items-center justify-between px-1", children: [_jsx("span", { className: "text-sm font-display font-semibold text-ink", children: "Your coins" }), _jsxs("span", { className: "lcd px-3 py-1", children: ["\uD83E\uDE99 ", gold] })] }), _jsxs("button", { onClick: rollShop, disabled: gold < ROLL_COST, className: "kbtn kbtn-mint w-full py-3", children: ["\uD83C\uDFB2 Roll (", ROLL_COST, "\uD83E\uDE99)"] }), _jsx("button", { onClick: toggleLock, className: `kbtn w-full py-3 ${shop.locked ? "kbtn-gold" : "kbtn-ghost"}`, children: shop.locked ? "🔒 Locked" : "🔓 Lock shop" }), _jsx("button", { onClick: readyForEncounter, disabled: teamFilled === 0, className: "kbtn kbtn-primary w-full py-3.5 text-base", children: isRanked ? "⚔️ Queue Match" : "✨ Ready!" }), _jsx("p", { className: "text-[11px] text-inkSoft font-semibold leading-relaxed", children: isRanked
                                        ? "Fight a real team near your rating. Your draft joins the rival pool."
                                        : `Sell refund: ${SELL_REFUND}🪙. Locked shops carry to the next stage.` })] }), isRanked && _jsx(LeaderboardPanel, { limit: 8 }), error && (_jsx("div", { className: "kcard p-3 text-sm text-coral font-display font-semibold border-2 !border-coral/40 bg-coral/10", children: error }))] })] }) }));
}
function TeamSlot(props) {
    const { slot, selected, inventoryItem } = props;
    if (!slot.fini) {
        return (_jsxs("button", { onClick: props.onClick, className: `aspect-[3/4] rounded-2xl border-[3px] border-dashed transition-all flex flex-col items-center justify-center gap-1 text-inkSoft text-xs font-display font-semibold ${selected
                ? "border-bubble bg-bubble/10 scale-[1.03]"
                : "border-cloud hover:border-grape/50 hover:bg-grape/5"}`, children: [_jsx("span", { className: "text-2xl opacity-50", children: "\uFF0B" }), "empty"] }));
    }
    const f = slot.fini;
    const color = FAMILY_COLOR[f.family];
    const mood = moodFromHp(f.currentHealth / f.maxHealth, f.fainted);
    return (_jsxs("div", { onClick: props.onClick, className: `kcard p-2.5 cursor-pointer transition-all ${selected ? "scale-[1.03]" : "hover:-translate-y-0.5"}`, style: {
            boxShadow: selected
                ? "0 0 0 3px #ff8fc7, 0 12px 24px -12px rgba(255,143,199,0.6)"
                : `0 0 0 2px ${color.hex}33`,
        }, children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-1.5", children: [_jsx(FiniAvatar, { family: f.family, mood: mood, size: 30 }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "text-xs font-display font-semibold leading-tight truncate text-ink", children: f.name }), _jsxs("div", { className: "text-[9px] font-display font-semibold text-inkSoft", children: [f.family, " \u00B7 Lv ", f.level] })] }), _jsx("button", { onClick: (e) => {
                            e.stopPropagation();
                            props.onSell();
                        }, className: "chip bg-lemon/30 text-[9px] text-ink hover:brightness-105", children: "\uD83E\uDE991" })] }), _jsxs("div", { className: "grid grid-cols-3 gap-1 text-center my-1 text-[10px]", children: [_jsx(Mini, { label: "ATK", value: f.strength }), _jsx(Mini, { label: "HP", value: `${f.currentHealth}/${f.maxHealth}` }), _jsx(Mini, { label: "SPD", value: f.speed })] }), _jsx(HealthBar, { current: f.currentHealth, max: f.maxHealth, colorHex: color.hex, height: 9 }), _jsx("div", { className: "text-[9px] font-display font-semibold text-inkSoft mt-1.5 truncate", children: f.passiveAbility.replace(/_/g, " ").toLowerCase() }), _jsx("div", { className: "mt-1.5 kcard-soft px-2 py-1 text-[10px]", children: inventoryItem ? (_jsxs("div", { className: "flex items-center justify-between gap-1", children: [_jsx("span", { className: "text-mintDark font-display font-semibold truncate", children: inventoryItem.name }), _jsx("button", { onClick: (e) => {
                                e.stopPropagation();
                                props.onUnequip();
                            }, className: "text-[9px] font-semibold text-inkSoft hover:text-ink", children: "\u2715" })] })) : (_jsx("span", { className: "text-inkSoft italic", children: "no treat" })) })] }));
}
function Mini(props) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-inkSoft text-[8px] font-display font-bold tracking-wider", children: props.label }), _jsx("div", { className: "text-sm text-ink font-display font-semibold", children: props.value })] }));
}
function ShopUnitCard(props) {
    const { unit, affordable, onBuy } = props;
    const color = FAMILY_COLOR[unit.family];
    return (_jsxs("button", { onClick: onBuy, disabled: !affordable, className: `kcard-soft text-left p-2.5 transition-all ${affordable ? "hover:-translate-y-1 hover:shadow-puff cursor-pointer" : "opacity-55"}`, style: { boxShadow: `0 0 0 2px ${color.hex}33` }, children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx(FiniAvatar, { family: unit.family, mood: "happy", size: 32 }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-sm font-display font-semibold text-ink truncate", children: unit.name }), _jsx("div", { className: "text-[9px] font-display font-semibold text-inkSoft", children: unit.family })] })] }), _jsxs("div", { className: "chip bg-lemon/30 text-ink text-[11px]", children: [UNIT_COST, "\uD83E\uDE99"] })] }), _jsxs("div", { className: "text-[10px] text-ink font-display font-semibold mt-1", children: ["\u2694", unit.strength, " \u2764", unit.maxHealth, " \u26A1", unit.speed, " \uD83D\uDEE1", unit.defense] }), _jsx("div", { className: "text-[9px] text-inkSoft font-display font-semibold mt-0.5 truncate", children: unit.passiveAbility.replace(/_/g, " ").toLowerCase() })] }));
}
function ShopItemCard(props) {
    const { item, affordable, onBuy } = props;
    return (_jsxs("button", { onClick: onBuy, disabled: !affordable, className: `kcard-soft text-left p-2.5 transition-all ${affordable ? "hover:-translate-y-1 hover:shadow-puff cursor-pointer" : "opacity-55"}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-sm font-display font-semibold text-ink", children: item.name }), _jsxs("div", { className: "chip bg-lemon/30 text-ink text-[11px]", children: [item.cost, "\uD83E\uDE99"] })] }), _jsx("div", { className: "text-[10px] text-inkSoft font-semibold mt-1", children: item.description }), _jsx("div", { className: "text-[10px] text-mintDark font-display font-semibold mt-0.5", children: describeItemDelta(item).join(" · ") })] }));
}
