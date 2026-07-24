// Tiny Web Audio chiptune synth. No files — everything generated on the fly.

type Wave = "square" | "triangle" | "sawtooth" | "sine" | "pulse";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() { ac(); }
export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.35;
}
export function isMuted() { return muted; }

// note name -> midi -> freq
const NOTE_MAP: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
function noteToFreq(name: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const midi = NOTE_MAP[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Build a pulse-wave PeriodicWave (25% duty) for that classic NES square-B feel
let pulseWave: PeriodicWave | null = null;
function getPulseWave(context: AudioContext): PeriodicWave {
  if (pulseWave) return pulseWave;
  const n = 24;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const duty = 0.25;
  for (let k = 1; k < n; k++) {
    imag[k] = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * duty);
  }
  pulseWave = context.createPeriodicWave(real, imag, { disableNormalization: false });
  return pulseWave;
}

interface BlipOpts {
  wave?: Wave;
  freq: number;
  endFreq?: number;
  duration?: number;
  volume?: number;
  attack?: number;
  release?: number;
  vibrato?: number;   // Hz
  vibratoDepth?: number; // Hz depth
  delay?: number;
}

function blip({
  wave = "square",
  freq,
  endFreq,
  duration = 0.09,
  volume = 0.4,
  attack = 0.004,
  release = 0.04,
  vibrato = 0,
  vibratoDepth = 0,
  delay = 0,
}: BlipOpts) {
  const context = ac();
  if (!context || !master || muted) return;
  const t0 = context.currentTime + delay;
  const osc = context.createOscillator();
  const gain = context.createGain();

  if (wave === "pulse") {
    osc.setPeriodicWave(getPulseWave(context));
  } else {
    osc.type = wave;
  }
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
  }

  if (vibrato > 0 && vibratoDepth > 0) {
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = vibrato;
    lfoGain.gain.value = vibratoDepth;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + duration + release);
  }

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + attack);
  gain.gain.setValueAtTime(volume, t0 + Math.max(attack, duration - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration + release);

  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + release + 0.02);
}

// Filtered white noise burst — for hits, explosions, hi-hats
function noise({
  duration = 0.12,
  volume = 0.3,
  filterType = "highpass" as BiquadFilterType,
  filterFreq = 1200,
  filterQ = 1,
  sweepTo,
  delay = 0,
  release = 0.05,
}: {
  duration?: number; volume?: number;
  filterType?: BiquadFilterType; filterFreq?: number; filterQ?: number;
  sweepTo?: number; delay?: number; release?: number;
}) {
  const context = ac();
  if (!context || !master || muted) return;
  const t0 = context.currentTime + delay;
  const len = Math.max(0.02, duration);
  const buf = context.createBuffer(1, Math.ceil(context.sampleRate * len), context.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = context.createBufferSource();
  src.buffer = buf;
  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, t0);
  filter.Q.value = filterQ;
  if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + len);
  const gain = context.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + len + release);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
  src.stop(t0 + len + release + 0.02);
}

// ---------- Public SFX ----------

export const sfx = {
  cursor: () => blip({ wave: "square", freq: 720, duration: 0.04, volume: 0.25 }),
  select: () => {
    blip({ wave: "pulse", freq: 660, duration: 0.06, volume: 0.35 });
    blip({ wave: "pulse", freq: 990, duration: 0.08, volume: 0.32, delay: 0.06 });
  },
  back: () => {
    blip({ wave: "square", freq: 440, duration: 0.06, volume: 0.3 });
    blip({ wave: "square", freq: 220, duration: 0.09, volume: 0.3, delay: 0.05 });
  },
  typeKey: () => {
    const f = 1500 + Math.random() * 700;
    blip({ wave: "square", freq: f, endFreq: f * 0.7, duration: 0.02, volume: 0.12, release: 0.02 });
  },
  typeMiss: () => {
    blip({ wave: "sawtooth", freq: 180, endFreq: 90, duration: 0.14, volume: 0.3 });
    noise({ duration: 0.09, volume: 0.15, filterType: "bandpass", filterFreq: 400 });
  },
  hitLight: () => {
    blip({ wave: "square", freq: 900, endFreq: 300, duration: 0.06, volume: 0.32 });
    noise({ duration: 0.05, volume: 0.18, filterType: "highpass", filterFreq: 2000 });
  },
  hitHeavy: () => {
    blip({ wave: "sawtooth", freq: 260, endFreq: 60, duration: 0.14, volume: 0.4 });
    noise({ duration: 0.14, volume: 0.28, filterType: "lowpass", filterFreq: 1600, sweepTo: 200 });
  },
  hitSpecial: () => {
    // Ultimate impact — thunder + rising sparkle
    noise({ duration: 0.35, volume: 0.35, filterType: "lowpass", filterFreq: 2400, sweepTo: 120 });
    for (let i = 0; i < 6; i++) {
      blip({ wave: "pulse", freq: 400 + i * 180, duration: 0.06, volume: 0.28, delay: i * 0.04 });
    }
    blip({ wave: "triangle", freq: 110, endFreq: 55, duration: 0.5, volume: 0.4, delay: 0.05 });
  },
  block: () => {
    blip({ wave: "triangle", freq: 1200, endFreq: 900, duration: 0.06, volume: 0.3 });
    noise({ duration: 0.05, volume: 0.15, filterType: "highpass", filterFreq: 3000 });
  },
  dodge: () => {
    blip({ wave: "sine", freq: 700, endFreq: 1400, duration: 0.12, volume: 0.28 });
  },
  combo: (n: number) => {
    const base = 440 * Math.pow(2, Math.min(24, n) / 12);
    blip({ wave: "pulse", freq: base, duration: 0.05, volume: 0.3 });
    blip({ wave: "pulse", freq: base * 1.5, duration: 0.06, volume: 0.28, delay: 0.05 });
  },
  meterFull: () => {
    const notes = ["C5", "E5", "G5", "C6", "E6"];
    notes.forEach((n, i) => blip({ wave: "pulse", freq: noteToFreq(n), duration: 0.08, volume: 0.32, delay: i * 0.06 }));
  },
  healthWarn: () => {
    blip({ wave: "square", freq: 880, duration: 0.08, volume: 0.35 });
    blip({ wave: "square", freq: 880, duration: 0.08, volume: 0.35, delay: 0.14 });
  },
  countdown: () => {
    blip({ wave: "square", freq: 660, duration: 0.12, volume: 0.4 });
  },
  roundStart: () => {
    // Short fanfare
    const seq: Array<[string, number]> = [["G4", 0], ["C5", 0.08], ["E5", 0.16], ["G5", 0.24], ["C6", 0.36]];
    seq.forEach(([n, t]) => blip({ wave: "pulse", freq: noteToFreq(n), duration: 0.12, volume: 0.4, delay: t }));
    noise({ duration: 0.08, volume: 0.15, filterType: "highpass", filterFreq: 4000, delay: 0.36 });
  },
  koFlash: () => {
    blip({ wave: "sawtooth", freq: 900, endFreq: 80, duration: 0.6, volume: 0.45 });
    noise({ duration: 0.6, volume: 0.3, filterType: "lowpass", filterFreq: 1800, sweepTo: 80 });
  },

  // -------- Melodies --------
  victory: () => {
    // Upbeat major arpeggio + capstone
    const lead: Array<[string, number, number]> = [
      ["C5", 0.00, 0.12], ["E5", 0.12, 0.12], ["G5", 0.24, 0.12], ["C6", 0.36, 0.12],
      ["G5", 0.50, 0.10], ["C6", 0.62, 0.10], ["E6", 0.74, 0.32],
      ["D6", 1.10, 0.10], ["E6", 1.22, 0.40],
    ];
    lead.forEach(([n, t, d]) => blip({ wave: "pulse", freq: noteToFreq(n), duration: d, volume: 0.36, delay: t }));
    // bass
    const bass: Array<[string, number, number]> = [
      ["C3", 0.00, 0.24], ["G3", 0.24, 0.24], ["C3", 0.50, 0.24], ["G3", 0.74, 0.36],
      ["C3", 1.10, 0.52],
    ];
    bass.forEach(([n, t, d]) => blip({ wave: "triangle", freq: noteToFreq(n), duration: d, volume: 0.32, delay: t }));
    // sparkle
    for (let i = 0; i < 5; i++) {
      blip({ wave: "square", freq: 1500 + i * 300, duration: 0.05, volume: 0.18, delay: 0.75 + i * 0.04 });
    }
  },
  gameOver: () => {
    // Descending melancholic minor melody
    const lead: Array<[string, number, number]> = [
      ["A4", 0.00, 0.22], ["G4", 0.24, 0.22], ["F4", 0.48, 0.22], ["E4", 0.72, 0.32],
      ["D4", 1.08, 0.28], ["C4", 1.40, 0.40], ["A3", 1.84, 0.70],
    ];
    lead.forEach(([n, t, d]) => blip({ wave: "triangle", freq: noteToFreq(n), duration: d, volume: 0.4, delay: t, vibrato: 5, vibratoDepth: 3 }));
    const bass: Array<[string, number, number]> = [
      ["A2", 0.00, 0.48], ["F2", 0.48, 0.48], ["D2", 1.00, 0.44], ["A2", 1.44, 0.90],
    ];
    bass.forEach(([n, t, d]) => blip({ wave: "sawtooth", freq: noteToFreq(n), duration: d, volume: 0.22, delay: t }));
  },
};

export type Sfx = typeof sfx;