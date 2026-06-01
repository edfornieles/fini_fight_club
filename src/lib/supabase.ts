import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  console.warn("[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — running in offline mode");
}

export const supabase = createClient(
  url ?? "https://offline.invalid",
  anonKey ?? "offline-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "fini-supabase-session-v1",
    },
  },
);

export const isOnline = Boolean(url && anonKey);
