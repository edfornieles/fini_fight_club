/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Coin families (kept brand-ish, slightly softened where harsh).
        eth: "#7c8bf0",
        btc: "#f7931a",
        sol: "#9945ff",
        doge: "#e3c75a",
        link: "#3b6ff0",
        uni: "#ff5fa2",
        avax: "#f0595a",
        bnb: "#f3ba2f",
        matic: "#9b6cf0",
        xtz: "#3aa0ff",

        // Kawaii system palette.
        ink: "#534261", // friendly deep plum for text
        inkSoft: "#8a7aa3", // muted label text
        inkMute: "#a99cbd", // faintest captions
        cream: "#fff6f1", // warm page base
        cloud: "#f1e7f3", // card border / dividers
        bubble: "#ff8fc7", // primary candy pink
        bubbleDark: "#f56fb0",
        grape: "#b98cff", // secondary purple
        mint: "#5fd6a4", // positive / happy
        mintDark: "#3fc28d",
        sky: "#7cc8ff", // info
        lemon: "#ffd76b", // gold / coins
        coral: "#ff8a8a", // negative / sad
      },
      fontFamily: {
        display: ['"Fredoka"', '"Baloo 2"', "ui-sans-serif", "system-ui"],
        body: ['"Nunito"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Nunito"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        puff: "0 12px 30px -12px rgba(150,110,190,0.5), 0 2px 8px -4px rgba(150,110,190,0.18)",
        toy: "0 6px 0 0 rgba(160,120,190,0.20)",
        pop: "0 4px 0 0 rgba(0,0,0,0.10)",
        glow: "0 0 36px -6px rgba(255,143,199,0.5), 0 0 60px -10px rgba(176,126,255,0.35)",
      },
      borderRadius: {
        blob: "28px",
      },
      animation: {
        pulseFamily: "pulseFamily 2.5s ease-in-out infinite",
        bobby: "bobby 3.5s ease-in-out infinite",
        wobble: "wobble 3s ease-in-out infinite",
        pop: "pop 0.32s cubic-bezier(0.34,1.56,0.64,1)",
        sparkle: "sparkle 1.8s ease-in-out infinite",
        floaty: "floaty 4.5s ease-in-out infinite",
        rise: "rise 0.45s cubic-bezier(0.34,1.56,0.64,1) both",
      },
      keyframes: {
        pulseFamily: {
          "0%,100%": { opacity: 0.9, transform: "scale(1)" },
          "50%": { opacity: 1, transform: "scale(1.05)" },
        },
        bobby: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        wobble: {
          "0%,100%": { transform: "rotate(-2.5deg)" },
          "50%": { transform: "rotate(2.5deg)" },
        },
        pop: {
          "0%": { transform: "scale(0.8)", opacity: 0 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        sparkle: {
          "0%,100%": { transform: "scale(0.7) rotate(0deg)", opacity: 0.4 },
          "50%": { transform: "scale(1.1) rotate(20deg)", opacity: 1 },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0) rotate(-3deg)" },
          "50%": { transform: "translateY(-14px) rotate(3deg)" },
        },
        rise: {
          "0%": { transform: "translateY(10px) scale(0.98)", opacity: 0 },
          "100%": { transform: "translateY(0) scale(1)", opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
