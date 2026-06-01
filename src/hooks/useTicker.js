import { useEffect, useState } from "react";
/**
 * Re-renders the component every `intervalMs` so countdown UIs stay fresh.
 * Returns the current Date.now() — but mostly you use it just for the re-render side effect.
 */
export function useTicker(intervalMs = 1000) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}
