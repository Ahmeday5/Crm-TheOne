import { Injectable } from '@angular/core';

/**
 * Synthesised notification chime (Web Audio) — no audio asset needed.
 *
 * Plays a soft celesta-like major arpeggio (C5·E5·G5·C6) with bell envelopes:
 * pleasant and "classical", clear but not jarring. The AudioContext is unlocked
 * on the first user gesture to satisfy browser autoplay policies.
 */
@Injectable({ providedIn: 'root' })
export class NotificationSoundService {
  private ctx: AudioContext | null = null;
  private enabled = true;

  constructor() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.ensureContext()?.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  play(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    // C5, E5, G5, C6 — a bright major arpeggio.
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    notes.forEach((freq, i) => this.bell(ctx, master, freq, now + i * 0.11));
  }

  private bell(
    ctx: AudioContext,
    out: AudioNode,
    freq: number,
    start: number,
  ): void {
    const duration = 0.9;
    const gain = ctx.createGain();
    gain.connect(out);

    // Fundamental + a quieter octave overtone for shimmer.
    const fundamental = ctx.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.value = freq;
    fundamental.connect(gain);

    const overtone = ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.value = freq * 2;
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.25;
    overtone.connect(overtoneGain).connect(gain);

    // Percussive bell envelope: fast attack, exponential decay.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.32, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    fundamental.start(start);
    overtone.start(start);
    fundamental.stop(start + duration);
    overtone.stop(start + duration);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }
}
