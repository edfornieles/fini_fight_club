# Finiliar animation library

Source: `Finiliar Storage` drive → `…/fini_animation/animations/`. All share the
`Fin_Bone_*` skeleton, so they retarget onto any character GLB by bone name
(same mechanism as the shipped battle move-clips).

Convert with: `blender -b -P scripts/fbx2glb.py -- <src.fbx> <out.glb> <clip> <fps>`
then rename + bundle in `public/anim/` and register in `src/lib/finiAssets.ts`.

**Caveat:** Blender only imports *binary* FBX. A few files are ASCII (e.g.
gen-2 `dance`) — convert those to binary first (Autodesk FBX Converter / FBX2glTF).

## Shipped (in `public/anim/`)
- **Mood idles:** `fin_neutral_idle`, `fin_sad_idle`, `fin_supersad_idle` (sick).
  Happy = the character's own baked `fin_happy_idle`. Drives the Explore viewer.
- **Battle emotes:** `entrance`, `doingok`, `doingbadly`, `winning`, `victory`,
  `defeated`. Fight Club fighters play these by HP% and at battle end.

## Available to pull in next (verified present, mostly binary/convertible)

### Battle reactions (`Battle/`)
`fin_battle_ready`, `notdoinggreat`, `doinggreat`, `victory_jump`, plus a full
**Eating** battle variant (eat to heal — burger/donut/corn/hotdog/cookie props).

### Gen-2 idle loops (`gen 2 animations/`) — personality for Explore / workshop
`workout`, `coffee`, `eating`, `frying`, `crying bowl`, `power up`, `zombie`,
`ghost`, `popcorn`, `money`, `rain`, `receiving gift`, `chilling on phone`,
`cake`, `dream sequence`, `dance` (ASCII — needs binary conversion first).

### Other
- **Evolution** (`Evolution/`): 6 level-up transition clips (evo_lvl01–03 × stages) — for a level-up celebration.
- **Games** (`Games/`): `falling01–04`, `tapped` — for mini-game / poke interactions.
- **First Contact**, **interact with viewer**, **sticker**, **zapper**, **meme** — misc reaction loops.
- **Posters / trailers** — multi-character scenes + cameras (marketing, not in-game).

## Notes
- Character skeleton = 26 bones; clips carry 35–36 → all 26 covered, extras ignored. Clean retarget.
- Face moves via texture mouth-swap (`finiFaceMood.ts`), NOT these clips — our
  characters use a texture face, while the rig FBX also has eyebrow/eye/mouth
  empties (a future face-rig upgrade, best with Jakub).
- Source FPS varies per clip; if a converted loop plays too fast/slow, pass the
  right `<fps>` to fbx2glb.py.
