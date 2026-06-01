import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import App from "./App";
import { wagmiConfig } from "./lib/wagmi";
import "./index.css";
const queryClient = new QueryClient();
createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(WagmiProvider, { config: wagmiConfig, children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(RainbowKitProvider, { theme: lightTheme({
                    accentColor: "#f472b6",
                    accentColorForeground: "#fff",
                    borderRadius: "large",
                    fontStack: "system",
                }), modalSize: "compact", children: _jsx(BrowserRouter, { children: _jsx(App, {}) }) }) }) }) }));
