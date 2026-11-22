import Phaser from 'phaser';

/**
 * Floating damage numbers. Every hit reports the damage actually dealt; rapid hits on the same enemy within a short
 * window are merged into one growing number, so automatic weapons read as a clean counter instead of a cloud.
 * Text objects are pooled (hard cap), the oldest is recycled when the cap is reached.
 */
const MERGE_WINDOW = .14, LIFE = .7, CAP = 36;

interface Num { text: Phaser.GameObjects.Text; id: number; crit: boolean; sum: number; age: number; x: number; y: number; jitter: number; size: number; dirty: boolean; shown: string; k: number; drawn: number; }

export function formatDamage(n: number): string {
  if (n < 1000) return String(Math.max(1, Math.round(n)));
  if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return (n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, '') + 'M';
}

/** Bigger hits get bigger numbers, on a log scale with sensible limits; crits are a notch larger. */
export function damageFontSize(dmg: number, crit: boolean): number {
  const base = Math.min(38, Math.max(15, 13 + Math.log10(Math.max(1, dmg)) * 5.2));
  return Math.round(Math.min(46, base * (crit ? 1.28 : 1)));
}

/** At most this many new labels per frame; extra hits merge into the newest label instead (visual only). */
const NEW_PER_FRAME = 3;
/** Last style applied to each pooled text, so a recycled label is only restyled when it has to be. */
const styled = new WeakMap<Phaser.GameObjects.Text, string>();

export class DamageNumbers {
  private live: Num[] = []; private pool: Phaser.GameObjects.Text[] = []; private created = 0; private clock = 0;
  constructor(private scene: Phaser.Scene) {}

  /** O(1)-ish and never touches the text texture: it only accumulates. Rendering happens once per frame in update(). */
  add(id: number, x: number, y: number, dmg: number, crit: boolean, zoom: number) {
    if (!(dmg > 0)) return;
    const k = Math.max(1, .85 / zoom);
    let merge: Num | undefined;
    for (let i = this.live.length - 1; i >= 0; i--) { const n = this.live[i]; if (n.id === id && n.crit === crit && n.age < MERGE_WINDOW) { merge = n; break; } }
    if (!merge && this.created >= NEW_PER_FRAME) for (let i = this.live.length - 1; i >= 0; i--) if (this.live[i].crit === crit && this.live[i].age < .06) { merge = this.live[i]; break; }
    if (merge) { merge.sum += dmg; merge.age = Math.min(merge.age, .04); merge.dirty = true; merge.k = k; return; }
    let text = this.pool.pop();
    if (!text) {
      if (this.live.length >= CAP) { const old = this.live.shift()!; text = old.text; }
      else text = this.scene.add.text(0, 0, '', { fontFamily: 'Barlow, Impact, sans-serif', fontStyle: '900', fontSize: '16px', color: '#fff2d6', stroke: '#140f1c', strokeThickness: 4 }).setOrigin(.5).setDepth(7.5);
    }
    text.setVisible(true).setAlpha(1);
    this.created++;
    // stack instead of overlapping: each recent neighbour pushes the new number up one line
    let near = 0; for (const o of this.live) if (o.age < .3 && Math.abs(o.x - x) < 46 * k && Math.abs(o.y - y) < 60 * k) near++;
    y -= Math.min(near, 4) * 20 * k;
    this.live.push({ text, id, crit, sum: dmg, age: 0, x, y, jitter: (Math.random() - .5) * 22, size: 16, dirty: true, shown: '', k, drawn: -1 });
  }

  update(dt: number) {
    this.created = 0; this.clock += dt;
    for (const n of this.live) {
      // a growing number is redrawn at most 20 times a second; a new one immediately
      if (n.dirty && (n.shown === '' || this.clock - n.drawn >= .05)) {
        n.dirty = false; n.drawn = this.clock;
        const label = formatDamage(n.sum) + (n.crit ? '!' : ''), size = Math.round(damageFontSize(n.sum, n.crit) * n.k);
        // one style call per change: every Phaser text setter re-renders the texture
        const key = size + (n.crit ? 'c' : 'n');
        if (styled.get(n.text) !== key) { styled.set(n.text, key); n.text.setStyle({ fontSize: size + 'px', color: n.crit ? '#ff3b4f' : '#fff2d6', stroke: n.crit ? '#2a070d' : '#140f1c', strokeThickness: Math.max(3, Math.round(size / 6)) }); }
        n.size = size;
        if (label !== n.shown) { n.shown = label; n.text.setText(label); }
      }
      n.age += dt;
      const p = Math.min(1, n.age / LIFE), pop = n.age < .1 ? 1.35 - n.age * 3.5 : 1;
      n.text.setPosition(n.x + n.jitter * p, n.y - 38 * (1 - (1 - p) * (1 - p)) * (n.size / 18)).setScale(pop).setAlpha(p > .65 ? 1 - (p - .65) / .35 : 1);
    }
    for (let i = this.live.length - 1; i >= 0; i--) if (this.live[i].age >= LIFE) { const n = this.live.splice(i, 1)[0]; n.text.setVisible(false); this.pool.push(n.text); }
  }
}
