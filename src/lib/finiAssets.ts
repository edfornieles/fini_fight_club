const BASE = ((import.meta.env.VITE_FINI_ASSETS_URL as string | undefined) ??
  "https://pub-af40a5ba16d9438ab2141f56ff0bbcfe.r2.dev/raw/temp_fini_upload").replace(/\/$/, "");
export const finiModelUrl = (t: number | string) => `${BASE}/characters/${t}.glb`;
export const FINI_ANIMATIONS_URL = `${BASE}/animations/all_animations-opt.glb`;
export const FINI_IDLE_CLIP = "fin_happy_idle";
// Battle-state → clip map (from the working reference build battles.pixelsolve.net):
export const FINI_STATE_CLIPS = { start:"fin_battle_A1", idle:"fin_battle_C1", attack:"fin_battle_B1", defend:"fin_battle_D3", winner:"fin_battle_F2", loser:"fin_battle_F3" } as const;
export const FINI_BATTLE_CLIPS = ["fin_battle_A1","fin_battle_A1_B1","fin_battle_A1_B2","fin_battle_A1_B3","fin_battle_B1","fin_battle_B1_C1","fin_battle_B1_C2","fin_battle_B2","fin_battle_B2_C1","fin_battle_B2_C2","fin_battle_B3","fin_battle_B3_C1","fin_battle_B3_C2","fin_battle_C1","fin_battle_C1_B1","fin_battle_C1_B2","fin_battle_C1_B3","fin_battle_C1_D2","fin_battle_C1_E1","fin_battle_C2","fin_battle_C2_B1","fin_battle_C2_B2","fin_battle_C2_B3","fin_battle_C2_D3","fin_battle_C2_E2","fin_battle_D1","fin_battle_D1_C1","fin_battle_D1_D1","fin_battle_D1_F1","fin_battle_D1_F2","fin_battle_D2","fin_battle_D2_C2","fin_battle_D2_D2","fin_battle_D2_E1","fin_battle_D2_F3","fin_battle_D3","fin_battle_D3_D3","fin_battle_D3_E2","fin_battle_D3_F3","fin_battle_E1","fin_battle_E1_D1","fin_battle_E2","fin_battle_E2_D2","fin_battle_F2","fin_battle_F3","fin_battle_SP1","fin_battle_SP1_env","fin_battle_SP2"] as const;
