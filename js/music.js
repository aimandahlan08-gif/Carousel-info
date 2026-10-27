/*
 * Music for the posts:
 *  1. SONGS – well-known tracks per mood to pick in Instagram's "Add music"
 *     sticker (Instagram licenses its library; these are suggestions only).
 *  2. Soundtrack – an original, royalty-free loop synthesised with the Web Audio
 *     API, matched to the same mood. It can be previewed, downloaded as WAV and
 *     is baked into the exported carousel video.
 */
(function (root) {
  'use strict';

  const MOODS = {
    inspiring: { label: 'Inspiring', emoji: '🌅', description: 'Uplifting, hopeful, forward-looking' },
    corporate: { label: 'Professional', emoji: '💼', description: 'Clean, confident, business-friendly' },
    tech:      { label: 'Tech / Futuristic', emoji: '🤖', description: 'Synth-driven, modern, digital' },
    calm:      { label: 'Calm', emoji: '🌿', description: 'Soft, mindful, relaxing' },
    energetic: { label: 'Energetic', emoji: '⚡', description: 'Punchy, fast, motivational' },
    serious:   { label: 'Serious / Reflective', emoji: '🎻', description: 'Cinematic, thoughtful, emotional' },
    playful:   { label: 'Playful', emoji: '🎈', description: 'Bright, fun, feel-good' }
  };

  const SONGS = {
    inspiring: [
      ['Unstoppable', 'Sia'], ['Hall of Fame', 'The Script ft. will.i.am'], ['On Top of the World', 'Imagine Dragons'],
      ['A Sky Full of Stars', 'Coldplay'], ['Rise Up', 'Andra Day']
    ],
    corporate: [
      ['Electric Feel', 'MGMT'], ['Feel It Still', 'Portugal. The Man'], ['Sunflower', 'Post Malone & Swae Lee'],
      ['Midnight City', 'M83'], ['Dreams', 'Fleetwood Mac']
    ],
    tech: [
      ['Harder, Better, Faster, Stronger', 'Daft Punk'], ['Nightcall', 'Kavinsky'], ['Strobe', 'deadmau5'],
      ['Midnight City', 'M83'], ['Blinding Lights', 'The Weeknd']
    ],
    calm: [
      ['Sunset Lover', 'Petit Biscuit'], ['Weightless', 'Marconi Union'], ['Holocene', 'Bon Iver'],
      ['Bloom', 'The Paper Kites'], ['Coffee', 'beabadoobee']
    ],
    energetic: [
      ['Believer', 'Imagine Dragons'], ["Can't Hold Us", 'Macklemore & Ryan Lewis'], ['Titanium', 'David Guetta ft. Sia'],
      ['Eye of the Tiger', 'Survivor'], ['Levitating', 'Dua Lipa']
    ],
    serious: [
      ['Experience', 'Ludovico Einaudi'], ['Time', 'Hans Zimmer'], ['Nuvole Bianche', 'Ludovico Einaudi'],
      ['Mad World', 'Gary Jules'], ['Breathe Me', 'Sia']
    ],
    playful: [
      ['Happy', 'Pharrell Williams'], ["Can't Stop the Feeling!", 'Justin Timberlake'], ['Walking on Sunshine', 'Katrina & The Waves'],
      ['Good as Hell', 'Lizzo'], ['Here Comes the Sun', 'The Beatles']
    ]
  };

  function suggestSongs(mood, scores) {
    // Primary mood first, then the runner-up mood for variety.
    const ranked = Object.entries(scores || {}).sort((a, b) => b[1] - a[1]).map(([m]) => m);
    const second = ranked.find(m => m !== mood && (scores[m] || 0) > 0);
    const list = (SONGS[mood] || SONGS.inspiring).map(([title, artist]) => ({ title, artist, mood }));
    if (second) list.push(...SONGS[second].slice(0, 2).map(([title, artist]) => ({ title, artist, mood: second })));
    const seen = new Set();
    return list.filter(s => !seen.has(s.title) && seen.add(s.title)).map(s => ({
      ...s,
      spotify: 'https://open.spotify.com/search/' + encodeURIComponent(`${s.title} ${s.artist}`),
      youtube: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${s.title} ${s.artist}`)
    }));
  }

  // ---------------- Soundtrack synthesis ----------------

  // Chords are scale degrees (0-based) in the mood's scale; 7 = up an octave.
  const STYLES = {
    inspiring: { bpm: 100, root: 60, scale: 'major', prog: [[0, 2, 4], [4, 6, 8], [5, 7, 9], [3, 5, 7]], lead: 'triangle', arp: 8, drums: 'soft', pad: true },
    corporate: { bpm: 112, root: 55, scale: 'major', prog: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]], lead: 'triangle', arp: 8, drums: 'pop', pad: false },
    tech:      { bpm: 122, root: 57, scale: 'minor', prog: [[0, 2, 4], [5, 7, 9], [2, 4, 6], [6, 8, 10]], lead: 'square', arp: 16, drums: 'house', pad: true },
    calm:      { bpm: 72, root: 53, scale: 'major', prog: [[0, 2, 4, 6], [3, 5, 7, 9]], lead: 'sine', arp: 4, drums: 'none', pad: true },
    energetic: { bpm: 128, root: 52, scale: 'minor', prog: [[0, 2, 4], [5, 7, 9], [2, 4, 6], [6, 8, 10]], lead: 'sawtooth', arp: 16, drums: 'house', pad: false },
    serious:   { bpm: 70, root: 50, scale: 'minor', prog: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]], lead: 'sine', arp: 4, drums: 'cinematic', pad: true },
    playful:   { bpm: 118, root: 60, scale: 'major', prog: [[0, 2, 4], [3, 5, 7], [4, 6, 8], [3, 5, 7]], lead: 'triangle', arp: 8, drums: 'claps', pad: false }
  };
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

  const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);
  function degreeToMidi(style, degree) {
    const sc = SCALES[style.scale];
    const oct = Math.floor(degree / 7);
    return style.root + sc[((degree % 7) + 7) % 7] + 12 * oct;
  }

  function noiseBuffer(ctx) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function envNote(ctx, out, { type, freq, t, dur, gain, attack = 0.01, release = 0.2, detune = 0, filter }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function kick(ctx, out, t, gain = 0.9) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
  }

  function noiseHit(ctx, out, noise, t, { gain, dur, type, freq }) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + dur + 0.02);
  }

  /**
   * Schedules `duration` seconds of music for `mood` into `ctx`, routed to `dest`.
   * Works with both AudioContext and OfflineAudioContext. Returns the master gain.
   */
  function schedule(ctx, dest, mood, start, duration) {
    const style = STYLES[mood] || STYLES.inspiring;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime(0.8, start + 1.5);
    master.gain.setValueAtTime(0.8, start + Math.max(1.5, duration - 2.5));
    master.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(dest);

    // Simple feedback delay gives the synths some space.
    const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = (60 / style.bpm) * 0.75; fb.gain.value = 0.28; wet.gain.value = 0.25;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);

    const noise = noiseBuffer(ctx);
    const beat = 60 / style.bpm;
    const bar = beat * 4;
    const bars = Math.ceil(duration / bar);

    for (let b = 0; b < bars; b++) {
      const t0 = start + b * bar;
      const chord = style.prog[b % style.prog.length];
      const notes = chord.map(d => degreeToMidi(style, d));

      // Bass on the root.
      const bassHz = midiToHz(notes[0] - 24);
      const bassHits = style.drums === 'none' || style.drums === 'cinematic' ? [0] : [0, 1.5, 2, 3.5];
      for (const pos of bassHits) {
        const len = style.drums === 'none' || style.drums === 'cinematic' ? bar : beat * 0.45;
        if (t0 + pos * beat < start + duration) envNote(ctx, master, { type: 'sine', freq: bassHz, t: t0 + pos * beat, dur: len, gain: 0.32, attack: 0.02, release: 0.1 });
      }

      // Pad: sustained detuned chord.
      if (style.pad) {
        for (const n of notes) for (const det of [-7, 7]) {
          envNote(ctx, master, { type: 'sawtooth', freq: midiToHz(n), t: t0, dur: bar + 0.1, gain: 0.025, attack: bar * 0.3, release: bar * 0.3, detune: det, filter: 1400 });
        }
      }

      // Arpeggio / lead pattern.
      const steps = style.arp;
      const stepLen = bar / steps;
      for (let k = 0; k < steps; k++) {
        const t = t0 + k * stepLen;
        if (t >= start + duration) break;
        if (style.arp === 4 && k % 2 && mood === 'serious') continue;
        const n = notes[k % notes.length] + (k % (notes.length * 2) >= notes.length ? 12 : 0);
        const out = k % 2 ? delay : master;
        envNote(ctx, master, { type: style.lead, freq: midiToHz(n), t, dur: Math.min(stepLen * 1.6, 0.9), gain: style.lead === 'sine' ? 0.12 : style.lead === 'triangle' ? 0.09 : 0.035, attack: 0.005, release: stepLen * 0.8, filter: style.lead === 'sine' ? null : 2600 });
        if (k % 2 === 0) envNote(ctx, out, { type: style.lead, freq: midiToHz(n), t, dur: Math.min(stepLen, 0.4), gain: 0.03, attack: 0.005, release: 0.1, filter: 2000 });
      }

      // Drums.
      for (let q = 0; q < 16; q++) {
        const t = t0 + q * (beat / 4);
        if (t >= start + duration) break;
        const onBeat = q % 4 === 0;
        switch (style.drums) {
          case 'house':
            if (onBeat) kick(ctx, master, t, 0.8);
            if (q % 4 === 2) noiseHit(ctx, master, noise, t, { gain: 0.12, dur: 0.06, type: 'highpass', freq: 7000 });
            if (q === 4 || q === 12) noiseHit(ctx, master, noise, t, { gain: 0.18, dur: 0.15, type: 'bandpass', freq: 1800 });
            break;
          case 'pop':
            if (q === 0 || q === 10) kick(ctx, master, t, 0.7);
            if (q === 4 || q === 12) noiseHit(ctx, master, noise, t, { gain: 0.16, dur: 0.14, type: 'bandpass', freq: 2000 });
            if (q % 2 === 0) noiseHit(ctx, master, noise, t, { gain: 0.05, dur: 0.04, type: 'highpass', freq: 8000 });
            break;
          case 'soft':
            if (q === 0 || q === 8) kick(ctx, master, t, 0.5);
            if (q % 4 === 2) noiseHit(ctx, master, noise, t, { gain: 0.05, dur: 0.05, type: 'highpass', freq: 8000 });
            break;
          case 'claps':
            if (q === 0 || q === 8) kick(ctx, master, t, 0.6);
            if (q === 4 || q === 12) { noiseHit(ctx, master, noise, t, { gain: 0.2, dur: 0.1, type: 'bandpass', freq: 1200 }); noiseHit(ctx, master, noise, t + 0.012, { gain: 0.14, dur: 0.1, type: 'bandpass', freq: 1300 }); }
            if (q % 2 === 1) noiseHit(ctx, master, noise, t, { gain: 0.04, dur: 0.03, type: 'highpass', freq: 9000 });
            break;
          case 'cinematic':
            if (q === 0 && b % 2 === 0) kick(ctx, master, t, 0.9);
            break;
        }
      }
    }
    return master;
  }

  /** Live preview player. */
  class SoundtrackPlayer {
    constructor() { this.ctx = null; this.master = null; this.timer = null; }
    get playing() { return !!this.master; }
    play(mood, duration, onEnd) {
      this.stop();
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      this.ctx.resume();
      const t = this.ctx.currentTime + 0.05;
      this.master = schedule(this.ctx, this.ctx.destination, mood, t, duration);
      this.timer = setTimeout(() => { this.stop(); onEnd && onEnd(); }, duration * 1000 + 200);
    }
    stop() {
      clearTimeout(this.timer);
      if (this.master) {
        try { this.master.gain.cancelScheduledValues(0); this.master.gain.value = 0; this.master.disconnect(); } catch (e) { /* already stopped */ }
        this.master = null;
      }
    }
  }

  async function renderWav(mood, duration) {
    const sr = 44100;
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * duration), sr);
    schedule(ctx, ctx.destination, mood, 0, duration);
    const buffer = await ctx.startRendering();
    return encodeWav(buffer);
  }

  function encodeWav(buffer) {
    const ch = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate;
    const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true);
    data.setUint16(34, 16, true); str(36, 'data'); data.setUint32(40, len * ch * 2, true);
    const chans = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
    }
    return new Blob([data], { type: 'audio/wav' });
  }

  root.Music = { MOODS, SONGS, STYLES, suggestSongs, schedule, SoundtrackPlayer, renderWav };
})(window);
