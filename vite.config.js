import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    return {
        plugins: [react()],
        // Default cache dir works in CI/Vercel. The /tmp override is a local-dev workaround
        // for exFAT drive issues — keep it only if VITE_USE_TMP_CACHE is set.
        ...(env.VITE_USE_TMP_CACHE ? { cacheDir: "/tmp/finiliar-vite-cache" } : {}),
        test: {
            globals: true,
            environment: "node",
            include: ["src/**/*.test.{ts,tsx}"],
            exclude: ["**/._*", "**/node_modules/**"],
        },
    };
});
