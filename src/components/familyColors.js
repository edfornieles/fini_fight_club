/**
 * Per-family display tokens used across the app.
 *  - text/bg/border: Tailwind classes (saturated accent)
 *  - hex/glow: raw accent for shadows + 3D tints
 *  - label: full coin name shown in the Finiliar UI (e.g. "Ethereum")
 *  - glyph: short monochrome mark for the coin chip (logo stand-in)
 *  - soft: very light pastel tint for the left side of a select row
 *  - swatch: deeper family tint for the render swatch on the right
 */
export const FAMILY_COLOR = {
    ETH: { text: "text-eth", bg: "bg-eth", border: "border-eth", hex: "#7c8bf0", glow: "rgba(124,139,240,0.45)", label: "Ethereum", glyph: "Ξ", soft: "#FDF6E0", swatch: "#E7E1C8" },
    BTC: { text: "text-btc", bg: "bg-btc", border: "border-btc", hex: "#f7931a", glow: "rgba(247,147,26,0.45)", label: "Bitcoin", glyph: "₿", soft: "#FBE9D6", swatch: "#3B342F" },
    SOL: { text: "text-sol", bg: "bg-sol", border: "border-sol", hex: "#9945ff", glow: "rgba(153,69,255,0.45)", label: "Solana", glyph: "◎", soft: "#EDE3F7", swatch: "#C9B6E8" },
    DOGE: { text: "text-doge", bg: "bg-doge", border: "border-doge", hex: "#cbb45e", glow: "rgba(203,180,94,0.45)", label: "Dogecoin", glyph: "Ð", soft: "#FBF3D6", swatch: "#E5D9A6" },
    LINK: { text: "text-link", bg: "bg-link", border: "border-link", hex: "#2a5ada", glow: "rgba(42,90,218,0.45)", label: "Chainlink", glyph: "⬡", soft: "#E2ECFB", swatch: "#B9CDF2" },
    UNI: { text: "text-uni", bg: "bg-uni", border: "border-uni", hex: "#ff007a", glow: "rgba(255,0,122,0.45)", label: "Uniswap", glyph: "🦄", soft: "#FCE3F0", swatch: "#F3B6D6" },
    AVAX: { text: "text-avax", bg: "bg-avax", border: "border-avax", hex: "#e84142", glow: "rgba(232,65,66,0.45)", label: "Avalanche", glyph: "▲", soft: "#FCE3E4", swatch: "#F2B9BA" },
    BNB: { text: "text-bnb", bg: "bg-bnb", border: "border-bnb", hex: "#f3ba2f", glow: "rgba(243,186,47,0.45)", label: "BNB", glyph: "◆", soft: "#FBF1D6", swatch: "#EAD89E" },
    MATIC: { text: "text-matic", bg: "bg-matic", border: "border-matic", hex: "#8247e5", glow: "rgba(130,71,229,0.45)", label: "Polygon", glyph: "⬢", soft: "#EEE4FB", swatch: "#C9B6EE" },
    XTZ: { text: "text-xtz", bg: "bg-xtz", border: "border-xtz", hex: "#2c7df7", glow: "rgba(44,125,247,0.45)", label: "Tezos", glyph: "ꜩ", soft: "#E2EDFB", swatch: "#B6CFF2" },
};
