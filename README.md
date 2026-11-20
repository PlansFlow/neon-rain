# NEON RAIN

A playable Phaser + TypeScript arcade shooter prototype inspired by a rainy, purple neon street. Five immediately selectable weapons, continuous hold-to-fire, score chains, escalating waves, runner/heavy/drone enemies, jumping and a cooldown dash. All world art and sound are generated locally; no remote asset requests.

## Run

```sh
npm install
npm run dev
```

`npm run build` performs TypeScript checks and creates `dist/`. `npm test` runs the deterministic combat tests.

## Controls

- A/D or left/right: move
- W/up/Space: jump
- Mouse: aim; hold left click: shoot
- Shift: dash (brief invulnerability)
- 1–5, mouse wheel, or weapon buttons: select
- Escape: pause/resume; Enter: start/restart
- M: toggle synthesized sound
- Touch: movement, jump, dash and fire buttons; automatic aim at the nearest enemy

Start with Sidekick, then try Room Service (8 pellets), Afterhours (12 rounds/sec), AK–47 (16 rounds/sec, 2-target penetration) and Lightspeed (25 pulses/sec, 5-target penetration). Unlimited ammo is intentional for this weapon-feel prototype. Health recovers on wave transitions and every eight eliminations. Best score is saved in this browser.

## Structure

- `src/game/simulation.ts`: renderer-independent combat and movement; 120 Hz integration and swept projectile collisions
- `src/game/weapons.ts`: data-driven arsenal, ready to expand
- `src/phaser/StreetScene.ts`: input adapter, world rendering and effects
- `src/phaser/environment.ts`: procedural street artwork
- `src/game/audio.ts`: synthesized weapon and hit audio
- `src/main.ts`, `src/ui/style.css`: DOM HUD, menus, responsive controls
- `tests/combat.test.ts`: seven focused simulation tests

This is a first playable prototype: a single arena, local score storage, procedural pixel characters, and synthesized audio. The simulation is bounded to 22 active enemies and 600 effect particles. Reduced-motion preferences disable camera shake and UI transitions.
