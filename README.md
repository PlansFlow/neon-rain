# NEON RAIN

A guns-first Phaser + TypeScript arcade shooter. 35 weapons that **stack**, ten escalating waves (then endless), eleven enemy types, and a camera that pulls further back with every wave. All art and sound are generated locally.

## Run

```sh
npm install
npm run dev
```

`npm run build` type-checks and creates `dist/`. `npm test` runs the deterministic simulation tests.

## How it plays

- **One super weapon, the Rainmaker.** The 35 guns are its mods, sold in the Armory (B). Every installed mod fires together; click an installed mod to switch it off or on.
- **The Armory has four tabs:** gun mods (with real gun art), ordnance (12 missile types), companions (5 pets) and the airstrike jet. A hero showcase on the left shows your current gun, your pets and the jet, and previews any gun you hover.
- **Missiles.** Gun missiles reskin and strengthen the rocket mods (Boomstick, Seeker Swarm, Doomsday). Jet missiles are the payload of the airstrike (press Q). Some fit both. Buying one equips it; you can swap in the shop.
- **Companions.** Parakeet (ranged), Amstaff (melee), War Boar (charger), Mutant Wolf (leaper) and Bunny Mutant (ground-slam tank). They never die and their damage scales with the waves.
- **Boss fights.** Titans from wave 4, and the Alien Carrier at waves 5, 8 and 10: it hovers on the right, fires plasma fans, summons sprinters and dives at you.
- **Economy.** Kills pay cash (runner $1, Titan $50, Alien Carrier $150, payouts grow with the wave); score is separate. Prices climb steeply, with the five legendary mods and the top missiles as endgame goals.
- **It starts hard.** Zoomed in close, enemies only from the right, ten long waves with the extreme zoom-out saved for the final wave.

## Controls

- A/D or arrows: move; W/Up/Space: jump; Shift: dash (brief invulnerability)
- Mouse: aim; hold left click: shoot
- Q: call the airstrike; B: shop; 1–0 / click: toggle mod; E: enable all; Esc: pause; Enter: start/restart; M: sound
- Touch: on-screen buttons with auto-aim

## Structure

- `src/game/weapons.ts`: 35 data-driven mods, prices and gun art; `missiles.ts`, `pets.ts`: ordnance and companion data; `assets.ts`: art URLs
- `src/game/enemies.ts`: enemy table (incl. cash values), wave quotas, zoom curve, spawn pacing, difficulty tuning (`TUNING`)
- `src/game/simulation.ts`: renderer-independent combat (explosions, chain lightning, homing, orbit blades, airstrikes)
- `src/phaser/StreetScene.ts`: rendering, camera zoom, effects; `environment.ts`: procedural street, mirrored for zoom-out
- `src/game/audio.ts`: synthesized audio with a compressor and voice limits
- `src/ui/shop.ts`: the Armory UI and hero showcase; `src/main.ts`, `src/ui/style.css`: HUD, mod belt, toasts
- `public/assets/`: optimized game art (guns, missiles, pets, jet, alien carrier)
