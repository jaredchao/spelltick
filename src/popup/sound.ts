// Short synthesized sound effects (no audio files). Only called from user
// actions inside the popup, so the AudioContext may start.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  ac: AudioContext,
  { freq, start, duration, gain, type = "sine", endFreq }: {
    freq: number;
    start: number;
    duration: number;
    gain: number;
    type?: OscillatorType;
    endFreq?: number;
  },
): void {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  const t0 = ac.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** A soft key click; deletions sound slightly lower. */
export function playKey(deleting = false): void {
  const ac = audio();
  if (!ac) return;
  const length = Math.floor(ac.sampleRate * 0.025);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const amp = ac.createGain();
  src.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = (deleting ? 1400 : 2400) + Math.random() * 400;
  filter.Q.value = 1.2;
  amp.gain.value = 0.35;
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start();
}

/** Two rising notes. */
export function playSuccess(): void {
  const ac = audio();
  if (!ac) return;
  tone(ac, { freq: 880, start: 0, duration: 0.18, gain: 0.12 });
  tone(ac, { freq: 1318.5, start: 0.09, duration: 0.32, gain: 0.12 });
}

/** A short falling buzz. */
export function playFailure(): void {
  const ac = audio();
  if (!ac) return;
  tone(ac, { freq: 220, start: 0, duration: 0.16, gain: 0.07, type: "triangle", endFreq: 196 });
  tone(ac, { freq: 175, start: 0.13, duration: 0.26, gain: 0.08, type: "triangle", endFreq: 147 });
}
