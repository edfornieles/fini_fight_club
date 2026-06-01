import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function FooterSection() {
    return (_jsxs("footer", { style: {
            background: "#0a0a0a",
            padding: "64px 48px 40px",
            fontFamily: "'Nunito', system-ui, sans-serif",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 32,
        }, children: [_jsxs("div", { style: { position: "relative", display: "inline-block" }, children: [_jsxs("div", { style: { fontSize: 72, fontWeight: 900, lineHeight: 1, letterSpacing: "-2px", display: "flex", alignItems: "center", gap: 2 }, children: [_jsx("span", { style: { color: "#60a5fa" }, children: "f" }), _jsx("span", { style: { color: "#4ade80" }, children: "i" }), _jsx("span", { style: { color: "#fb923c" }, children: "n" }), _jsx("span", { style: { color: "#f87171" }, children: "i" }), _jsx("span", { style: { fontSize: 40, marginLeft: 4, marginTop: -28 }, children: "\u2B50" })] }), _jsxs("svg", { width: "100", height: "80", viewBox: "0 0 100 80", style: { position: "absolute", right: -100, top: -10, pointerEvents: "none" }, fill: "none", children: [_jsx("path", { d: "M10 20 C30 5, 60 5, 75 25 C85 40, 80 60, 65 70", stroke: "#f9a8d4", strokeWidth: "2.5", strokeLinecap: "round", fill: "none" }), _jsx("path", { d: "M65 70 L55 58 M65 70 L78 62", stroke: "#f9a8d4", strokeWidth: "2.5", strokeLinecap: "round" })] })] }), _jsxs("p", { style: { color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }, children: ["Got questions?", " ", _jsx("a", { href: "mailto:hello@finiliar.com", style: { color: "#f9a8d4", textDecoration: "none" }, children: "Contact us" })] }), _jsx("div", { style: { display: "flex", gap: 48, fontSize: 18, fontWeight: 700 }, children: [
                    { label: "Twitter", href: "https://twitter.com/finiliar" },
                    { label: "Discord", href: "https://discord.gg/finiliar" },
                    { label: "Blog", href: "https://finiliar.com/blog" },
                ].map(({ label, href }) => (_jsx("a", { href: href, target: "_blank", rel: "noopener noreferrer", style: { color: "#fff", textDecoration: "none", transition: "opacity 0.15s" }, onMouseEnter: e => (e.currentTarget.style.opacity = "0.6"), onMouseLeave: e => (e.currentTarget.style.opacity = "1"), children: label }, label))) }), _jsxs("div", { style: {
                    width: "100%", maxWidth: 1200,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    borderTop: "1px solid #222", paddingTop: 24,
                    fontSize: 13, color: "#555",
                }, children: [_jsx("span", { children: "\u00A9 2023 finiliar studios, ltd." }), _jsx("div", { style: { display: "flex", gap: 24 }, children: ["Terms and Conditions", "Privacy Policy"].map(t => (_jsx("a", { href: "#", style: { color: "#555", textDecoration: "underline" }, children: t }, t))) })] })] }));
}
