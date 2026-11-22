import { WEAPONS } from './weapons';

type Cue = 'shot' | 'kill' | 'hurt' | 'boom' | 'unlock' | 'wave' | 'spit' | 'arc' | 'plane' | 'alien' | 'crit' | 'paper' | 'tear' | 'jet';

/**
 * Synthesized sound. With dozens of guns firing at once the mix is protected three ways:
 * a compressor on the master bus, a per-weapon rate limit and a global voice budget.
 */
export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null; private noise: AudioBuffer | null = null; private bus: AudioNode | null = null;
  private last: Record<string, number> = {}; private voices = 0;

  unlock() {
    if (!this.ctx) {
      const c = this.ctx = new AudioContext();
      this.noise = c.createBuffer(1, c.sampleRate * .6, c.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 6; comp.attack.value = .003; comp.release.value = .18;
      const master = c.createGain(); master.gain.value = .9; comp.connect(master); master.connect(c.destination);
      this.bus = comp;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(cue: Cue, weapon = 0, stack = 1, power = 1) {
    if (!this.enabled || !this.ctx || !this.bus) return;
    const c = this.ctx, t = c.currentTime;
    const key = cue === 'shot' ? 'shot' + weapon : cue, gap = cue === 'shot' ? .055 : cue === 'crit' ? .06 : cue === 'tear' ? .05 : cue === 'jet' ? .09 : cue === 'kill' ? .03 : cue === 'boom' ? .06 : cue === 'arc' ? .05 : 0;
    if (gap && t - (this.last[key] ?? -1) < gap) return;
    if (this.voices > 28) return;
    this.last[key] = t;
    if (cue === 'unlock') return this.unlockJingle(t);
    if (cue === 'crit') return this.tone(t, 1480, .07, 'square', .035, .55);
    if (cue === 'paper') return this.sweep(t, 900, 2600, .28, .06);
    if (cue === 'jet') return this.sweep(t, 380, 220, .16, .028);
    if (cue === 'tear') return this.sweep(t, 2400, 700, .12, .05);
    if (cue === 'plane') return this.sweep(t, 220, 1800, 1.1, .1);
    if (cue === 'alien') return this.tone(t, 90, .9, 'sawtooth', .14, .4, 700);
    if (cue === 'wave') return this.tone(t, 70, .6, 'sawtooth', .12, 0.25, 900);

    const g = c.createGain(); g.connect(this.bus);
    const track = (n: AudioScheduledSourceNode, end: number) => { this.voices++; n.onended = () => { this.voices--; }; n.start(t); n.stop(end); };
    if (cue === 'shot') {
      const s = WEAPONS[weapon].sfx; if (s.v <= 0) return;
      const vol = .075 * s.v / Math.sqrt(Math.max(1, stack * .6));
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + s.d);
      if (s.n) { const n = c.createBufferSource(); n.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = s.n; n.connect(f); f.connect(g); track(n, t + s.d + .05); }
      const o = c.createOscillator(); o.type = s.t; o.frequency.setValueAtTime(s.hz, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, s.hz * .35), t + s.d); o.connect(g); track(o, t + s.d + .03);
    } else if (cue === 'boom') {
      const d = .18 + Math.min(.5, power / 600);
      g.gain.setValueAtTime(.16 * Math.min(1.6, .5 + power / 200), t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      const n = c.createBufferSource(); n.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(120, t + d); n.connect(f); f.connect(g); track(n, t + d + .05);
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(34, t + d); o.connect(g); track(o, t + d + .03);
    } else {
      const vol = cue === 'hurt' ? .1 : cue === 'arc' ? .03 : .035, hz = cue === 'kill' ? 640 : cue === 'hurt' ? 80 : cue === 'arc' ? 1200 : 220;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .09);
      const o = c.createOscillator(); o.type = cue === 'arc' ? 'sawtooth' : 'triangle'; o.frequency.setValueAtTime(hz, t); o.frequency.exponentialRampToValueAtTime(hz * .35, t + .09); o.connect(g); track(o, t + .12);
    }
  }

  private tone(t: number, hz: number, d: number, type: OscillatorType, vol: number, endRatio: number, lp?: number) {
    const c = this.ctx!, g = c.createGain(), o = c.createOscillator();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.type = type; o.frequency.setValueAtTime(hz, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, hz * endRatio), t + d);
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(this.bus!); o.start(t); o.stop(t + d + .02);
  }

  private sweep(t: number, from: number, to: number, d: number, vol: number) {
    const c = this.ctx!, g = c.createGain(), n = c.createBufferSource(), f = c.createBiquadFilter();
    n.buffer = this.noise; n.loop = true; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(vol, t + d * .35); g.gain.exponentialRampToValueAtTime(.001, t + d);
    n.connect(f); f.connect(g); g.connect(this.bus!); n.start(t); n.stop(t + d + .05);
  }

  private unlockJingle(t: number) {
    [523, 659, 784, 1047].forEach((hz, i) => this.tone(t + i * .07, hz, .22, 'triangle', .09, .98));
  }
}
