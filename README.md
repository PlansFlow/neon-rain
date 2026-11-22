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

## Final act (waves 25–50)

- **Wave 25:** a new district (`public/assets/ui/street-25.jpg`) crossfades in: flickering lights, fog, spores, road reflections.
- **Wave 50:** the street clears, the camera moves in, and the final arena (`public/assets/final/arena-50.jpg`) fades in with dawn light, mist and falling leaves. The final boss, THE APPLICATION, has three phases (paper toss → fans + paper rain → charge), each attack telegraphed (“!”, aim line, red ground marks). Its health is sized from your best weapon, so the fight lasts about a minute and a quarter. Bullets can shred paper in flight.
- **Defeat:** slow motion, a paper explosion, then the ending. Endless mode continues afterwards.

## Wave pacing

- Each wave sends only the enemies it still needs, in surges (a burst of groups, then a short pause). At most ~90 are alive at once.
- After the last kill there is a breather (1.5 s early, up to 6 s late, countdown in the wave panel). Titans join one per surge, and trucks and aliens arrive when the breather ends.
- Past wave 10 the kill quota grows slowly and caps at 160; late waves get harder through enemy health, not endless bodies.

## Combat feedback

- Floating damage numbers show the damage actually dealt; bigger hits pop bigger. Rapid hits on one enemy merge, nearby numbers stack, and redraws are throttled.
- Headshots (head, drone eye, alien cockpit side, truck cab, the boss's face) deal ×2 and show in red. Only bullets crit; explosions, chains, blades and pets never do.
- Combat HUD: wave · alive · kills (top-left), HP bar with low/critical states (bottom-left), ammo/heat (bottom-right), abilities (right). The weapon strip and controls hints live in the pause screen.

## Controls

- A/D or arrows: move; W/Up/Space: jump (hold to fly with the jetpack; fuel refills on the ground); Shift: dash (brief invulnerability)
- Mouse: aim; hold left click: shoot
- Q: call the airstrike; G: grenade; F: missile; B, E or right click: shop; V: full screen; 1–0 / click: equip weapon; Esc: pause; Enter: start/restart; M: sound
- Touch: on-screen buttons with auto-aim

## Structure

- `src/game/weapons.ts`: 35 data-driven mods, prices and gun art; `missiles.ts`, `pets.ts`: ordnance and companion data; `assets.ts`: art URLs
- `src/game/enemies.ts`: enemy table (incl. cash values), wave quotas, zoom curve, spawn pacing, difficulty tuning (`TUNING`)
- `src/game/simulation.ts`: renderer-independent combat (explosions, chain lightning, homing, orbit blades, airstrikes)
- `src/phaser/StreetScene.ts`: rendering, camera zoom, effects; `environment.ts`: procedural street, mirrored for zoom-out
- `src/game/audio.ts`: synthesized audio with a compressor and voice limits
- `src/ui/shop.ts`: the Armory UI and hero showcase; `src/main.ts`, `src/ui/style.css`: HUD, mod belt, toasts
- `public/assets/`: optimized game art (guns, missiles, pets, jet, alien carrier)
