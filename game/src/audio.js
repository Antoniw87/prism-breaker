// Sound, synthesised live with Web Audio — no audio files, no network. Every sound is
// a short oscillator phrase; the context is created on the first user gesture (unlock),
// so loading the page stays silent and autoplay rules never bite. In a context without
// audio (or before unlock) every call is a no-op.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, when, slideTo, volume) {
    if (!context || muted) return;
    const start = context.currentTime + (when || 0);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + dur);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume || 0.5, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  const sounds = {
    launch() { tone(280, 0.09, 'square', 0, 520, 0.35); },
    paddle() { tone(210, 0.06, 'square', 0, 0, 0.4); },
    brick(row) {
      const base = 520 - Math.min(row, 6) * 36;
      tone(base, 0.07, 'triangle', 0, base * 1.4, 0.5);
    },
    tough() { tone(140, 0.09, 'sawtooth', 0, 90, 0.45); },
    power() {
      tone(520, 0.08, 'sine', 0, 0, 0.45);
      tone(780, 0.08, 'sine', 0.07, 0, 0.45);
      tone(1040, 0.12, 'sine', 0.14, 0, 0.45);
    },
    lose() { tone(320, 0.35, 'sawtooth', 0, 70, 0.4); },
    clear() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'triangle', i * 0.09, 0, 0.45));
    },
    win() {
      [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.16, 'triangle', i * 0.1, 0, 0.45));
    },
    over() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, 'sawtooth', i * 0.16, 0, 0.35));
    },
  };

  return {
    /** Call from a user gesture; creates the context so later sounds can play. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    play(name, arg) {
      if (!ensure()) return;
      const fn = sounds[name];
      if (fn) fn(arg);
    },
    setMuted(value) { muted = !!value; },
  };
}
