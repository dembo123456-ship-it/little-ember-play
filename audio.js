// Little Ember sound: background music per place and short sound effects, all synthesised live with Web Audio
// (no audio files). Music is written as chord progressions + seeded melodies on a 16-step-per-bar sequencer;
// each place has its own key, tempo, instruments and groove. Everything is a no-op where Web Audio is missing.
(function (global) {
  'use strict';
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  const degMidi = (root, scale, d) => { const s = SCALES[scale], o = Math.floor(d / 7), i = ((d % 7) + 7) % 7; return root + o * 12 + s[i]; };
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---- Tracks ------------------------------------------------------------------------------------------------
  // chords: scale-degree roots, one per bar (A section then B section). rhythm: melody note [step,len] per bar,
  // cycling every 4 bars (the 4th is the phrase end). lead/accomp/drums name the instruments used below.
  const TRACKS = {
    title: { name: '작은 불꽃의 아침', bpm: 74, root: 60, scale: 'major', chords: [0, 5, 3, 4, 0, 5, 3, 4, 5, 3, 0, 4, 5, 3, 1, 4], lead: 'bell', leadOct: 12, accomp: 'harpArp', pad: true, drums: 'none',
      rhythm: [[[0, 6], [6, 2], [8, 8]], [[0, 4], [4, 4], [8, 6], [14, 2]], [[0, 6], [6, 2], [8, 4], [12, 4]], [[0, 16]]] },
    village: { name: '초록숲 마을 산책', bpm: 102, root: 67, scale: 'major', chords: [0, 3, 4, 0, 5, 3, 1, 4, 3, 4, 2, 5, 3, 4, 0, 0], lead: 'flute', leadOct: 0, accomp: 'oompah', pad: false, drums: 'shaker',
      rhythm: [[[0, 3], [3, 1], [4, 4], [8, 2], [10, 2], [12, 4]], [[0, 2], [2, 2], [4, 2], [6, 2], [8, 6], [14, 2]], [[0, 3], [3, 1], [4, 2], [6, 2], [8, 4], [12, 4]], [[0, 4], [4, 4], [8, 8]]] },
    forge: { name: '모닥불 곁 대장간', bpm: 88, root: 65, scale: 'major', chords: [0, 4, 5, 3, 0, 3, 4, 0, 5, 2, 3, 4, 5, 3, 4, 0], lead: 'reed', leadOct: 0, accomp: 'luteArp', pad: true, drums: 'hearth',
      rhythm: [[[0, 4], [4, 2], [6, 2], [8, 6], [14, 2]], [[0, 2], [2, 2], [4, 4], [8, 4], [12, 4]], [[0, 4], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]], [[0, 12]]] },
    workshop: { name: '쇠를 두드리는 박자', bpm: 96, root: 62, scale: 'minor', chords: [0, 5, 6, 4, 0, 5, 3, 4, 5, 6, 2, 4, 5, 3, 4, 0], lead: 'pluckLead', leadOct: 12, accomp: 'ostinato', pad: false, drums: 'anvil',
      rhythm: [[[0, 2], [2, 2], [4, 4], [10, 2], [12, 4]], [[0, 3], [3, 3], [6, 2], [8, 4], [12, 4]], [[0, 2], [2, 2], [4, 2], [6, 2], [8, 8]], [[0, 6], [6, 2], [8, 8]]] },
    world: { name: '지도 위의 먼 길', bpm: 80, root: 57, scale: 'dorian', chords: [0, 6, 3, 4, 0, 6, 2, 4, 3, 4, 0, 6, 3, 4, 5, 4], lead: 'horn', leadOct: 12, accomp: 'harpArp', pad: true, drums: 'timpani',
      rhythm: [[[0, 6], [6, 2], [8, 8]], [[0, 4], [4, 4], [8, 4], [12, 4]], [[0, 6], [6, 2], [8, 6], [14, 2]], [[0, 16]]] }
  };

  // Melody per track: chord tones on the strong steps, stepwise motion between, the last bar lands on the tonic.
  function composeMelody(id, tr) {
    const r = rng([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)), notes = [];
    let prev = 7;
    tr.chords.forEach((root, bar) => {
      const shape = tr.rhythm[bar % 4], tones = [root, root + 2, root + 4].flatMap(d => [d, d + 7, d - 7]).filter(d => d >= 3 && d <= 12);
      shape.forEach(([step, len], k) => {
        let d;
        const last = bar === tr.chords.length - 1 || (bar % 8 === 7 && k === shape.length - 1);
        if (last) d = bar === tr.chords.length - 1 ? 7 : root + 7 > 12 ? root : root + 7;
        else if (step === 0 || step === 8 || len >= 6) d = tones.reduce((a, b) => Math.abs(b - prev) < Math.abs(a - prev) || (Math.abs(b - prev) === Math.abs(a - prev) && r() < .5) ? b : a, tones[0]);
        else { const move = r() < .7 ? (r() < .5 ? -1 : 1) : (r() < .5 ? -2 : 2); d = Math.max(3, Math.min(12, prev + move)); }
        notes.push({ bar, step, len, deg: d }); prev = d;
      });
    });
    return notes;
  }

  let meter = null, ctx = null, master = null, musicBus = null, sfxBus = null, reverb = null, comp = null;
  const settings = { music: true, sfx: true, musicVolume: .55, sfxVolume: .75 };
  const state = { track: null, gain: null, start: 0, nextBar: 0, bar: 0, loop: 0, timer: null, melodies: {} };

  function ensure() {
    if (ctx) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext; if (!AC) return null;
    try {
      ctx = new AC();
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ctx.destination);meter = ctx.createAnalyser(); meter.fftSize = 2048; comp.connect(meter);
      master = ctx.createGain(); master.gain.value = .9; master.connect(comp);
      musicBus = ctx.createGain(); sfxBus = ctx.createGain(); musicBus.connect(master); sfxBus.connect(master);
      // Small room reverb shared by everything (generated impulse).
      reverb = ctx.createConvolver(); const len = ctx.sampleRate * 1.8, imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      reverb.buffer = imp; const wet = ctx.createGain(); wet.gain.value = .22; reverb.connect(wet); wet.connect(master);
      applyVolumes();
    } catch (_) { ctx = null; }
    return ctx;
  }
  function applyVolumes() {
    if (!ctx) return; const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(settings.music ? settings.musicVolume * 1.3 : 0, t, .08);
    sfxBus.gain.setTargetAtTime(settings.sfx ? settings.sfxVolume * 1.2 : 0, t, .05);
  }
  let noiseBuf = null;
  function noise() { if (noiseBuf) return noiseBuf; const n = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, n, n); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return noiseBuf; }

  // ---- Instruments (t: start time, f: Hz, d: seconds, v: 0..1, out: destination gain) -----------------------
  function env(out, t, a, peak, d, rel, send) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, d)); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, d) + rel);
    g.connect(out); if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(reverb); }
    return g;
  }
  function osc(type, f, t, end, dest, detune) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o; }
  function lowpass(f, q, dest) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; fl.Q.value = q || .7; fl.connect(dest); return fl; }
  const I = {
    pluck(t, f, d, v, out) { const g = env(out, t, .004, v, .01, Math.min(1.1, .25 + d), .25), fl = lowpass(3200, 1, g); fl.frequency.setValueAtTime(3200, t); fl.frequency.exponentialRampToValueAtTime(700, t + .4); osc('triangle', f, t, t + 1.4, fl); const s = ctx.createGain(); s.gain.value = .3; s.connect(fl); osc('sine', f * 2, t, t + 1.4, s); },
    harp(t, f, d, v, out) { const g = env(out, t, .003, v, .01, 1.4, .45); osc('triangle', f, t, t + 1.6, lowpass(2600, .8, g)); const s = ctx.createGain(); s.gain.value = .25; s.connect(g); osc('sine', f * 3, t, t + .5, s); },
    bell(t, f, d, v, out) { [[1, 1, 1.6], [2.76, .35, .7], [5.4, .15, .35]].forEach(([m, a, dec]) => { const g = env(out, t, .002, v * a, .005, dec, .5); osc('sine', f * m, t, t + dec + .1, g); }); },
    flute(t, f, d, v, out) { const g = env(out, t, .06, v, d * .85, .14, .35), o = osc('sine', f, t, t + d + .3, g); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .007, t + .25); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + .3);
      const b = ctx.createBufferSource(); b.buffer = noise(); const bg = env(out, t, .02, v * .05, .04, .08); const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = f * 2; hp.connect(bg); b.connect(hp); b.start(t); b.stop(t + .2); },
    reed(t, f, d, v, out) { const g = env(out, t, .035, v, d * .85, .16, .3), fl = lowpass(1500, 1.2, g); osc('square', f, t, t + d + .3, fl); const s = ctx.createGain(); s.gain.value = .6; s.connect(g); osc('sine', f, t, t + d + .3, s); },
    pluckLead(t, f, d, v, out) { I.pluck(t, f, d, v, out); I.bell(t, f * 2, d, v * .18, out); },
    horn(t, f, d, v, out) { const g = env(out, t, .09, v, d * .85, .25, .45), fl = lowpass(950, 1, g), o = osc('sawtooth', f * .985, t, t + d + .4, fl); o.frequency.linearRampToValueAtTime(f, t + .08); const s = ctx.createGain(); s.gain.value = .5; s.connect(g); osc('triangle', f, t, t + d + .4, s); },
    pad(t, f, d, v, out) { const g = env(out, t, .7, v, d - .2, .9, .6), fl = lowpass(780, .6, g); osc('sawtooth', f, t, t + d + 1, fl, -7); osc('sawtooth', f, t, t + d + 1, fl, 7); },
    bass(t, f, d, v, out) { const g = env(out, t, .008, v, .02, Math.min(.9, d + .1)); osc('triangle', f, t, t + d + .3, g); const s = ctx.createGain(); s.gain.value = .7; s.connect(g); osc('sine', f / 2, t, t + d + .3, s); },
    shaker(t, v, out) { const b = ctx.createBufferSource(); b.buffer = noise(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500; const g = env(out, t, .004, v, .01, .05); hp.connect(g); b.connect(hp); b.start(t, Math.random() * .5); b.stop(t + .1); },
    kick(t, v, out, f0) { const g = env(out, t, .003, v, .02, .35), o = osc('sine', f0 || 120, t, t + .45, g); o.frequency.exponentialRampToValueAtTime(45, t + .3); },
    tick(t, v, out) { [[1800, 1], [4700, .4]].forEach(([f, a]) => osc('sine', f, t, t + .2, env(out, t, .001, v * a, .002, .12, .3))); },
    anvil(t, v, out) { [[880, 1, .5], [2420, .5, .3], [3700, .3, .2], [5350, .2, .12]].forEach(([f, a, dec]) => osc('sine', f, t, t + dec + .05, env(out, t, .001, v * a, .002, dec, .35)));
      const b = ctx.createBufferSource(); b.buffer = noise(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000; hp.connect(env(out, t, .001, v * .5, .003, .04)); b.connect(hp); b.start(t); b.stop(t + .06); },
    crackle(t, v, out) { const b = ctx.createBufferSource(); b.buffer = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 2000; bp.Q.value = 3; bp.connect(env(out, t, .001, v, .004, .03)); b.connect(bp); b.start(t, Math.random() * .8); b.stop(t + .05); }
  };

  // ---- Sequencer ---------------------------------------------------------------------------------------------
  function scheduleBar(id, tr, out, barStart, bar, loop) {
    const spb = 60 / tr.bpm / 4, stepT = s => barStart + s * spb, root = tr.chords[bar], chordMidi = [0, 2, 4].map(k => degMidi(tr.root, tr.scale, root + k));
    const melody = state.melodies[id] || (state.melodies[id] = composeMelody(id, tr));
    // Every other pass the first half rests the lead, so the loop breathes.
    const rest = loop % 2 === 1 && bar < 4;
    if (tr.pad) I.pad(barStart, midiHz(chordMidi[0] - 12), spb * 16, .07, out), I.pad(barStart, midiHz(chordMidi[2] - 12), spb * 16, .05, out);
    const b = midiHz(degMidi(tr.root, tr.scale, root) - 24);
    if (tr.accomp === 'harpArp') { [0, 2, 4, 7, 9, 7, 4, 2].forEach((k, i) => I.harp(stepT(i * 2), midiHz(degMidi(tr.root, tr.scale, root + k) - 12), spb * 2, .1, out)); I.bass(stepT(0), b, spb * 8, .22, out); I.bass(stepT(8), b, spb * 8, .16, out); }
    if (tr.accomp === 'oompah') { [0, 8].forEach(s => I.bass(stepT(s), s ? midiHz(degMidi(tr.root, tr.scale, root + 4) - 24) : b, spb * 3, .28, out)); [4, 12].forEach(s => chordMidi.forEach(m => I.pluck(stepT(s), midiHz(m - 12), spb * 2, .06, out))); [6, 14].forEach(s => chordMidi.forEach(m => I.pluck(stepT(s), midiHz(m - 12), spb, .035, out))); }
    if (tr.accomp === 'luteArp') { [0, 4, 2, 4, 7, 4, 2, 4].forEach((k, i) => I.pluck(stepT(i * 2), midiHz(degMidi(tr.root, tr.scale, root + k) - 12), spb * 2, .085, out)); I.bass(stepT(0), b, spb * 6, .26, out); I.bass(stepT(10), midiHz(degMidi(tr.root, tr.scale, root + 4) - 24), spb * 4, .18, out); }
    if (tr.accomp === 'ostinato') { [0, 0, 7, 0, 4, 0, 7, 4].forEach((k, i) => I.bass(stepT(i * 2), midiHz(degMidi(tr.root, tr.scale, root + k) - 24), spb * 1.6, i % 2 ? .16 : .24, out)); [4, 12].forEach(s => chordMidi.forEach(m => I.pluck(stepT(s), midiHz(m - 12), spb * 2, .05, out))); }
    // Grooves.
    if (tr.drums === 'shaker') { for (let s = 0; s < 16; s += 2) I.shaker(stepT(s), s % 4 ? .05 : .08, out); I.kick(stepT(0), .22, out, 90); }
    if (tr.drums === 'hearth') { for (let i = 0; i < 6; i++) I.crackle(barStart + Math.random() * spb * 16, .03 + Math.random() * .03, out); I.tick(stepT(12), .035, out); }
    if (tr.drums === 'anvil') { I.kick(stepT(0), .3, out, 110); I.kick(stepT(8), .22, out, 110); I.anvil(stepT(4), .07, out); I.anvil(stepT(12), .07, out); if (bar % 2) I.anvil(stepT(14), .04, out); for (let s = 2; s < 16; s += 4) I.shaker(stepT(s), .035, out); }
    if (tr.drums === 'timpani') { I.kick(stepT(0), .3, out, 75); if (bar % 4 === 3) { I.kick(stepT(12), .18, out, 75); I.kick(stepT(14), .22, out, 75); } }
    if (!rest) for (const n of melody) if (n.bar === bar) I[tr.lead](stepT(n.step), midiHz(degMidi(tr.root, tr.scale, n.deg) + tr.leadOct), n.len * spb, tr.lead === 'bell' ? .16 : tr.lead === 'horn' ? .14 : .13, out);
  }
  function pump() {
    if (!ctx || !state.track) return;
    const tr = TRACKS[state.track], barLen = 60 / tr.bpm * 4;
    // Music switched off: keep time moving without building any notes.
    if (!settings.music) { while (state.nextBar < ctx.currentTime) { state.nextBar += barLen; state.bar = (state.bar + 1) % tr.chords.length; } return; }
    while (state.nextBar < ctx.currentTime + .6) {
      scheduleBar(state.track, tr, state.gain, state.nextBar, state.bar, state.loop);
      state.nextBar += barLen; state.bar++; if (state.bar >= tr.chords.length) { state.bar = 0; state.loop++; }
    }
  }
  let desired = null;
  function play(id) {
    if (!TRACKS[id] || state.track === id || !ensure()) return;
    state.track = id;
    const t = ctx.currentTime;
    if (state.gain) { const old = state.gain; old.gain.cancelScheduledValues(t); old.gain.setValueAtTime(old.gain.value, t); old.gain.linearRampToValueAtTime(0.0001, t + 1.4); setTimeout(() => { try { old.disconnect(); } catch (_) {} }, 1800); }
    state.gain = ctx.createGain(); state.gain.gain.setValueAtTime(0.0001, t); state.gain.gain.linearRampToValueAtTime(1, t + 1.6); state.gain.connect(musicBus);
    state.nextBar = t + .15; state.bar = 0; state.loop = 0;
    if (!state.timer) state.timer = setInterval(pump, 60);
    pump();
  }

  // ---- Sound effects -----------------------------------------------------------------------------------------
  const lastSfx = {};
  const notes = (list, t0, gap, fn, v) => list.forEach((m, i) => fn(t0 + i * gap, midiHz(m), .3, v, sfxBus));
  const SFX = {
    click(t) { I.tick(t, .12, sfxBus); },
    open(t) { notes([79, 84], t, .05, I.bell, .07); },
    close(t) { notes([84, 77], t, .05, I.bell, .05); },
    tab(t) { I.tick(t, .08, sfxBus); },
    error(t) { notes([55, 52], t, .09, I.reed, .12); },
    craftStart(t) { I.anvil(t, .22, sfxBus); I.anvil(t + .22, .16, sfxBus); },
    crafted(t) { I.anvil(t, .25, sfxBus); notes([72, 76, 79, 84], t + .12, .07, I.bell, .1); },
    sale(t) { notes([88, 93], t, .06, I.bell, .12); I.shaker(t + .02, .06, sfxBus); },
    coins(t) { notes([86, 91, 89, 95, 93, 98], t, .05, I.bell, .1); },
    payout(t) { notes([93, 88, 84], t, .07, I.bell, .09); },
    enhanceStart(t) { notes([64, 67, 71], t, .09, I.harp, .14); },
    enhance(t) { notes([72, 76, 79, 84, 88], t, .06, I.bell, .12); notes([60, 64, 67], t, 0, I.harp, .1); },
    enhanceFail(t) { I.kick(t, .35, sfxBus, 90); notes([52, 48], t + .05, .14, I.reed, .14); I.crackle(t + .02, .2, sfxBus); I.crackle(t + .06, .15, sfxBus); },
    fanfare(t) { notes([67, 72, 76], t, .1, I.horn, .16); I.horn(t + .32, midiHz(79), .5, .16, sfxBus); I.horn(t + .32, midiHz(72), .5, .1, sfxBus); I.bell(t + .32, midiHz(91), .5, .08, sfxBus); },
    unlock(t) { notes([76, 79, 83, 88], t, .07, I.bell, .1); },
    doorbell(t) { notes([84, 79], t, .16, I.bell, .1); },
    hire(t) { notes([72, 79], t, .1, I.pluck, .16); I.bell(t + .2, midiHz(84), .3, .07, sfxBus); },
    paper(t) { const b = ctx.createBufferSource(); b.buffer = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = .8; bp.connect(env(sfxBus, t, .02, .1, .06, .1)); b.connect(bp); b.start(t, Math.random() * .5); b.stop(t + .25); },
    order(t) { SFX.paper(t); I.bell(t + .08, midiHz(86), .3, .08, sfxBus); },
    build(t) { [0, .16, .32].forEach((d, i) => I.kick(t + d, .25, sfxBus, 160 - i * 10)); notes([72, 79], t + .45, .08, I.bell, .08); },
    alarm(t) { [0, .4].forEach(d => { I.horn(t + d, midiHz(57), .3, .2, sfxBus); I.horn(t + d + .15, midiHz(60), .22, .18, sfxBus); }); I.kick(t, .35, sfxBus, 80); },
    battle(t) { I.kick(t, .3, sfxBus, 85); I.kick(t + .15, .22, sfxBus, 85); I.anvil(t + .08, .1, sfxBus); },
    victory(t) { notes([67, 71, 74], t, .09, I.horn, .14); I.horn(t + .28, midiHz(79), .6, .16, sfxBus); I.bell(t + .28, midiHz(86), .5, .08, sfxBus); },
    season(t) { notes([72, 76, 79, 83], t, .09, I.harp, .14); I.bell(t + .36, midiHz(88), .4, .07, sfxBus); },
    start(t) { notes([60, 67, 72, 76, 79, 84], t, .07, I.harp, .14); I.bell(t + .42, midiHz(91), .6, .09, sfxBus); }
  };
  function sfx(name) {
    if (!settings.sfx || !SFX[name] || !ensure()) return;
    const now = performance.now(); if (now - (lastSfx[name] || 0) < (name === 'click' || name === 'tab' ? 60 : 140)) return; lastSfx[name] = now;
    try { if (ctx.state === 'suspended') ctx.resume(); SFX[name](ctx.currentTime + .01); } catch (_) {}
  }

  // Browsers only allow sound after the player touches the page: unlock on the first press.
  function unlock() { if (!ensure()) return; const go = () => { if (desired) play(desired); }; if (ctx.state === 'suspended') ctx.resume().then(go, () => {}); else go(); }
  if (global.addEventListener) { ['pointerdown', 'keydown', 'touchstart'].forEach(e => global.addEventListener(e, unlock, { capture: true, passive: true })); }
  if (global.document && global.document.addEventListener) global.document.addEventListener('visibilitychange', () => { if (!ctx) return; if (global.document.hidden) ctx.suspend(); else ctx.resume(); });

  global.ForgeAudio = {
    TRACKS, SFX_NAMES: Object.keys(SFX),
    // Place → music. Unknown or null places keep the current track.
    setPlace(place) { if (!TRACKS[place] || place === desired) return; desired = place; if (ctx && ctx.state === 'running') play(place); },
    sfx,
    configure(next) { Object.assign(settings, next || {}); applyVolumes(); },
    get settings() { return { ...settings }; },
    // For checks: what is playing and how loud the output is right now (peak 0..1).
    debug() { let peak = 0; if (meter) { const a = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(a); for (const x of a) peak = Math.max(peak, Math.abs(x)); } return { state: ctx ? ctx.state : 'none', track: state.track, desired, peak }; },
    composeMelody
  };
})(typeof window !== 'undefined' ? window : globalThis);
