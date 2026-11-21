/* =========================================================
   RunMilAudio - background music + sound effects, generated live with WebAudio
   (no audio files needed, works offline).

   Music : a small chiptune band (drums, bass, arpeggio, pad, melody) with one theme per place.
           It reacts to the game: faster + more layers as the run speeds up, darker + minor key at night,
           muffled while paused.
   SFX   : jump, double jump, land, duck, punch / kick (swing + impact), coins that climb in pitch,
           gems, collection pieces, monster kills, combos, close calls, weapons, game over, revive,
           day / night / dawn, countdown, victory, achievements, UI clicks.

   Uses the Settings screen: Music, Sound Effects, Music Volume, SFX Volume (saved in "runmil_save").

   MENU   : a calm, sunny groove (strummed guitar, marimba, warm bass, soft kick and shaker, swung and relaxed).
   VICTORY: plays your own song if you drop it in  visuals/audio/victory.mp3  (.m4a / .ogg / .wav also work);
            without that file the built-in party tune plays instead. See visuals/audio/README.txt.

   API  RunMilAudio.music("menu" | "park" | "dnsc" | "mangrove" | "seawall" | "victory")
        RunMilAudio.stop()            fade the music out
        RunMilAudio.sfx(name, arg)    play a sound effect
        RunMilAudio.mood(night, intensity)   both 0..1
        RunMilAudio.pause(true/false) muffle while paused
        RunMilAudio.duck(0..1)        music volume multiplier (e.g. low on game over)
========================================================= */
(function () {
    "use strict";
    const KEY = "runmil_save";
    const S = { music: true, sfx: true, musicVol: 70, sfxVol: 80 };
    let ac = null, out, musicBus, sfxBus, monBus, revIn, dipV = 1, filt, leadBus, echoG, noiseBuf;
    let wantTrack = "", cur = null, curName = "", timer = 0, nextT = 0, step = 0, bar = 0, chordNow = null, melody = [];
    let night = 0, inten = 0.2, duckV = 1, paused = false, lastNight = -1, pollN = 0;
    let vAudio = null, fileOn = false, fileVol0 = 1;       // a music FILE is playing (or about to): the built-in tune stays silent
    const fileMissing = {};
    const lastPlayed = {};

    // ---------- settings (Settings screen writes them to the save) ----------
    function readSettings() {
        try {
            const s = (JSON.parse(localStorage.getItem(KEY) || "{}") || {}).settings || {};
            S.music = s.music !== false; S.sfx = s.sfx !== false;
            S.musicVol = typeof s.musicVol === "number" ? s.musicVol : 70;
            S.sfxVol = typeof s.sfxVol === "number" ? s.sfxVol : 80;
        } catch (e) { /* keep defaults */ }
    }
    function applyVol() {
        if (vAudio) vAudio.volume = fileVolNow();
        if (!ac) return;
        const t = ac.currentTime;
        musicBus.gain.setTargetAtTime(S.music && !fileOn ? (S.musicVol / 100) * 0.5 * duckV * dipV * (paused ? 0.5 : 1) : 0, t, 0.08);
        sfxBus.gain.setTargetAtTime(S.sfx ? (S.sfxVol / 100) * 0.9 : 0, t, 0.03);
        filt.frequency.setTargetAtTime(paused ? 650 : 16000 - night * 5500, t, 0.35);
    }

    // ---------- audio graph ----------
    function ensure() {
        if (!ac) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            try { ac = new AC(); } catch (e) { return false; }
            const comp = ac.createDynamicsCompressor();
            out = ac.createGain(); out.connect(comp); comp.connect(ac.destination);
            filt = ac.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 16000;
            musicBus = ac.createGain(); musicBus.connect(filt); filt.connect(out);
            sfxBus = ac.createGain(); sfxBus.connect(out);
            monBus = ac.createGain(); monBus.gain.value = 2.4; monBus.connect(sfxBus);     // monsters are mixed louder than the other effects
            leadBus = ac.createGain(); leadBus.connect(musicBus);
            // reverb: gives the music space and warmth (instruments send a little signal into it)
            revIn = ac.createGain(); const cv = ac.createConvolver(), rg = ac.createGain(), rl = Math.floor(ac.sampleRate * 2.4), rb = ac.createBuffer(2, rl, ac.sampleRate);
            for (let ch = 0; ch < 2; ch++) { const d = rb.getChannelData(ch); for (let i = 0; i < rl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.8); }
            cv.buffer = rb; rg.gain.value = 0.8; revIn.connect(cv); cv.connect(rg); rg.connect(musicBus);
            const echo = ac.createDelay(1), fb = ac.createGain();
            echo.delayTime.value = 0.29; fb.gain.value = 0.38; echoG = ac.createGain(); echoG.gain.value = 0;
            leadBus.connect(echoG); echoG.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(musicBus);
            noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
            const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            readSettings(); applyVol();
        }
        if (ac.state === "suspended") { try { ac.resume(); } catch (e) { /* needs a gesture */ } }
        return true;
    }
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function tone(f, t, d, type, g, bus, o) {
        o = o || {};
        const os = ac.createOscillator(), ga = ac.createGain();
        os.type = type; os.frequency.setValueAtTime(f, t);
        if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + d);
        const a = o.a || 0.004;
        ga.gain.setValueAtTime(0.0001, t); ga.gain.linearRampToValueAtTime(g, t + a); ga.gain.exponentialRampToValueAtTime(0.0001, t + d);
        os.connect(ga); ga.connect(bus || sfxBus); os.start(t); os.stop(t + d + 0.03);
    }
    function noise(t, d, g, type, f, to, bus) {
        const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), ga = ac.createGain();
        s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + d);
        ga.gain.setValueAtTime(g, t); ga.gain.exponentialRampToValueAtTime(0.0001, t + d);
        s.connect(fl); fl.connect(ga); ga.connect(bus || sfxBus); s.start(t, Math.random() * 0.4, d + 0.02);
    }

    // ---------- music ----------
    // prog = [semitones above root, "M"/"m"] one chord per bar, nprog = the darker night version
    // lead / comp (chord instrument): marimba, bell, epiano, pluck | strum, epiano, arp, none   bass: steps of the bar that play   drums: 0 none, 1 pop groove, 2 hand drums
    const TRACKS = {
        // MENU: relaxed and sunny. fixI = a gentle fixed intensity (it never gets busy or dark), drums 3 = soft kick + brushed snare
        menu:     { bpm: 92,  root: 55, lead: "marimba", comp: "strum",  bass: [0, 6, 10],           drums: 3, pad: 1, shaker: 1, swing: 0.2,  echo: 0.4,  seed: 5,  leadAlways: 1, fixI: 0.3,
                    prog: [[0, "M"], [9, "m"], [5, "M"], [7, "M"], [0, "M"], [4, "m"], [5, "M"], [7, "M"]], nprog: [[0, "M"], [9, "m"], [5, "M"], [7, "M"]] },
        park:     { bpm: 104, root: 48, lead: "marimba", comp: "strum",  bass: [0, 3, 6, 8, 11, 14], drums: 1, pad: 0, shaker: 1, swing: 0.14, echo: 0.2,  seed: 7,
                    prog: [[0, "M"], [7, "M"], [9, "m"], [5, "M"]], nprog: [[9, "m"], [5, "M"], [0, "M"], [7, "M"]] },
        dnsc:     { bpm: 112, root: 50, lead: "epiano",  comp: "epiano", bass: [0, 2, 4, 6, 8, 10, 12, 14], drums: 1, pad: 1, shaker: 1, swing: 0.08, echo: 0.15, seed: 13,
                    prog: [[0, "M"], [5, "M"], [7, "M"], [5, "M"]], nprog: [[0, "m"], [5, "m"], [7, "M"], [3, "M"]] },
        mangrove: { bpm: 90,  root: 43, lead: "marimba", comp: "arp",    bass: [0, 8],               drums: 2, pad: 1, shaker: 1, swing: 0.1,  echo: 0.4,  seed: 21,
                    prog: [[0, "M"], [9, "m"], [2, "m"], [7, "M"]], nprog: [[0, "m"], [8, "M"], [5, "m"], [7, "M"]] },
        seawall:  { bpm: 86,  root: 52, lead: "epiano",  comp: "epiano", bass: [0, 6, 10],           drums: 1, pad: 1, shaker: 1, swing: 0.16, echo: 0.45, seed: 29,
                    prog: [[0, "M"], [4, "m"], [9, "m"], [7, "M"]], nprog: [[0, "m"], [8, "M"], [3, "M"], [10, "M"]] },
        victory:  { bpm: 122, root: 48, lead: "marimba", comp: "strum",  bass: [0, 4, 8, 12],        drums: 1, pad: 1, shaker: 1, swing: 0.06, echo: 0.3,  seed: 41, fixed: 1,
                    prog: [[0, "M"], [7, "M"], [9, "m"], [5, "M"]], nprog: [[0, "M"], [7, "M"], [9, "m"], [5, "M"]] }
    };
    function rnd(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    const PATS = [
        [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0], [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0],
        [1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0]
    ];
    function chordAt(b) {
        const p = (night > 0.5 && !cur.fixed) ? cur.nprog : cur.prog, c = p[b % p.length];
        const m = c[1] === "m"; return { r: cur.root + c[0], m: m, q: m ? [0, 3, 7] : [0, 4, 7], q7: m ? [0, 3, 7, 10] : [0, 4, 7, 11] };
    }
    function makeMelody(b) {
        const rng = rnd(cur.seed * 131 + (b % 8) * 17 + chordNow.r), pent = chordNow.m ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9], pool = [];
        for (let o = 0; o < 2; o++) pent.forEach(function (p) { pool.push(chordNow.r + 12 + p + o * 12); });
        const pat = PATS[Math.floor(rng() * PATS.length)], m = [], moves = [-2, -1, -1, 0, 1, 1, 2];
        let idx = 2 + Math.floor(rng() * 4);
        for (let s = 0; s < 16; s++) if (pat[s] && (s % 4 === 0 || rng() > 0.3)) { idx += moves[Math.floor(rng() * moves.length)]; idx = Math.max(0, Math.min(pool.length - 1, idx)); m[s] = pool[idx]; }
        return m;
    }
    const stepDur = () => 60 / (cur.bpm * (cur.fixI != null ? 1 : 1 + inten * 0.1 + night * 0.06)) / 4;     // night: a little faster

    // ----- instruments: oscillators shaped by a filter + envelope (soft, acoustic-like) -----
    // parts = [wave, frequency multiplier, level, detune cents]; o = { a: attack, lp / lpTo: filter sweep, sus: hold level, bus, send: reverb amount }
    function inst(parts, f, t, d, g, o) {
        o = o || {};
        const fl = ac.createBiquadFilter(), ga = ac.createGain(), a = o.a || 0.005;
        fl.type = "lowpass"; fl.frequency.setValueAtTime(o.lp || 4000, t); if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t + d);
        ga.gain.setValueAtTime(0.0001, t); ga.gain.linearRampToValueAtTime(g, t + a); if (o.sus) ga.gain.setValueAtTime(g, t + d * 0.55); ga.gain.exponentialRampToValueAtTime(0.0001, t + d);
        parts.forEach(function (p) {
            const os = ac.createOscillator(), pg = ac.createGain();
            os.type = p[0]; os.frequency.setValueAtTime(f * p[1], t); if (p[3]) os.detune.value = p[3]; pg.gain.value = p[2];
            os.connect(pg); pg.connect(fl); os.start(t); os.stop(t + d + 0.05);
        });
        fl.connect(ga); ga.connect(o.bus || musicBus);
        if (o.send) { const sg = ac.createGain(); sg.gain.value = o.send; ga.connect(sg); sg.connect(revIn); }
    }
    const I_ = {
        pluck:   (f, t, d, g, b) => inst([["triangle", 1, 1], ["sine", 2, 0.35], ["sine", 3, 0.12]], f, t, d, g, { lp: 3800, lpTo: 600, a: 0.003, send: 0.25, bus: b }),
        marimba: (f, t, d, g, b) => inst([["sine", 1, 1], ["sine", 3.99, 0.26], ["sine", 9.9, 0.05]], f, Math.max(t, 0), Math.max(d, 0.5), g * 1.4, { lp: 7000, a: 0.002, send: 0.3, bus: b }),
        epiano:  (f, t, d, g, b) => inst([["sine", 1, 1], ["sine", 1, 0.5, 7], ["sine", 2, 0.28], ["triangle", 4, 0.06]], f, t, Math.max(d, 0.7), g, { lp: 3600, lpTo: 1400, a: 0.006, send: 0.35, bus: b }),
        bell:    (f, t, d, g, b) => inst([["sine", 1, 1], ["sine", 2.76, 0.32], ["sine", 5.4, 0.16], ["sine", 8.9, 0.07]], f, t, Math.max(d, 1.6), g, { lp: 8000, a: 0.003, send: 0.55, bus: b }),
        pad:     (f, t, d, g) => inst([["sawtooth", 1, 0.4, -9], ["sawtooth", 1, 0.4, 9], ["triangle", 1, 0.6]], f, t, d, g, { lp: 850, a: 0.7, sus: 1, send: 0.5 }),
        cello:   (f, t, d, g) => inst([["sawtooth", 1, 0.5, -6], ["sawtooth", 1, 0.5, 6]], f, t, d, g, { lp: 650, a: 0.15, sus: 1, send: 0.3 }),
        bass:    (f, t, d, g) => inst([["sine", 1, 1], ["triangle", 2, 0.22]], f, t, d, g, { lp: 520, a: 0.012 })
    };
    // ----- drums: soft kick, slap, shaker, hand drum, taiko -----
    function kick(t, g) { tone(118, t, 0.28, "sine", 0.8 * (g || 1), musicBus, { to: 42 }); }
    function slap(t) { noise(t, 0.12, 0.28, "bandpass", 1100, 600, musicBus); tone(240, t, 0.1, "triangle", 0.18, musicBus, { to: 150 }); }
    function shaker(t, g) { noise(t, 0.06, 0.07 * (g || 1), "highpass", 6500, 0, musicBus); }
    function hand(t, hi) { tone(hi ? 230 : 150, t, 0.2, "sine", 0.45, musicBus, { to: hi ? 160 : 90 }); noise(t, 0.05, 0.1, "bandpass", 450, 0, musicBus); }
    function taiko(t, g) { tone(95, t, 0.55, "sine", 0.85 * g, musicBus, { to: 38 }); noise(t, 0.3, 0.35 * g, "lowpass", 650, 90, musicBus); }

    function playStep(s, t0) {
        if (s === 0) { chordNow = chordAt(bar); melody = makeMelody(bar); }
        const c = chordNow, T = cur, nn = (T.fixed || T.fixI != null) ? 0 : night, I = T.fixI != null ? T.fixI : T.fixed ? 1 : Math.min(1, inten + night * 0.4), sd = stepDur();
        const t = t0 + ((s % 2 && T.swing) ? sd * T.swing : 0);           // gentle swing = relaxed, human groove
        // drums
        if (T.drums === 1) {
            if (s === 0 || s === 10 || (I > 0.35 && s === 6) || (I > 0.7 && s === 14)) kick(t);
            if (I > 0.1 && (s === 4 || s === 12)) slap(t);
        } else if (T.drums === 2) {
            if (s === 0 || s === 6 || (I > 0.3 && s === 10) || (I > 0.5 && s === 14)) hand(t, s === 6 || s === 14);
            if (I > 0.2 && s === 12) hand(t, true);
        } else if (T.drums === 3) {                                          // chill: soft kick, brushed snare
            if (s === 0 || s === 10) kick(t, 0.4);
            if (s === 4 || s === 12) noise(t, 0.16, 0.06, "bandpass", 2600, 1500, musicBus);
        }
        if (T.drums && T.shaker && I > 0.05) { if (s % 2 === 0) shaker(t, s % 4 === 0 ? 1.2 : 0.8); else if (I > 0.65) shaker(t, 0.45); }
        // bass: round and soft, follows the pattern of the track
        const bi = T.bass.indexOf(s);
        if (bi >= 0) { const off = s === 0 ? 0 : [0, 7, 12, 7][bi % 4]; I_.bass(mtof(c.r - 12 + off), t, sd * 2.6, 0.42); }
        // chords
        if (T.pad && s === 0) c.q7.forEach(function (q) { I_.pad(mtof(c.r + q + (q > 7 ? 0 : 12)), t, sd * 16, 0.05); });
        if (T.comp === "strum" && (s === 0 || s === 3 || s === 6 || s === 10 || s === 12) && (I > 0.08)) {
            const down = s % 6 === 0; c.q.forEach(function (q, i) { I_.pluck(mtof(c.r + 12 + q + (i === 2 ? 0 : 12 * 0)), t + (down ? i : 2 - i) * 0.012, sd * 3, 0.07); });
        } else if (T.comp === "epiano" && (s === 0 || s === 6 || s === 10) && I > 0.05) {
            c.q7.forEach(function (q, i) { I_.epiano(mtof(c.r + 12 + q), t + i * 0.01, sd * (s === 0 ? 6 : 4), 0.055); });
        } else if (T.comp === "arp" && s % 2 === 0 && (I > 0.05 || T.leadAlways)) {
            const q = c.q7, i = (s / 2) % 4; I_.pluck(mtof(c.r + 12 + q[[0, 2, 1, 3][i]] + (i > 1 ? 12 : 0)), t, sd * 3, 0.06);
        }
        // melody
        if (melody[s] && (I > 0.1 || T.leadAlways)) (I_[(nn > 0.5) ? "bell" : T.lead])(mtof(melody[s] - (nn > 0.5 ? 12 : 0)), t, sd * 3, 0.12 + I * 0.03, leadBus);
        // night: cinematic and tense - low strings, taiko drums, heartbeat, tolling bells, rising swell
        if (nn > 0.35) {
            if (s === 0 || s === 8) I_.cello(mtof(c.r - 12), t, sd * 8, 0.1 * nn);
            if (s === 0) { I_.cello(mtof(c.r - 11), t, sd * 16, 0.06 * nn); taiko(t, nn); }
            if (s === 8 || (s === 14 && bar % 2)) taiko(t, 0.6 * nn);
            if (s === 0 || s === 3) tone(60, t, 0.18, "sine", 0.55 * nn, musicBus, { to: 38 });                // heartbeat
            if (s === 0 && bar % 2 === 0) I_.bell(mtof(c.r + 12), t, 3, 0.1 * nn, leadBus);
            if (s === 14 && bar % 2 === 1) I_.bell(mtof(c.r + 6), t, 2, 0.07 * nn, leadBus);
            if (bar % 4 === 3 && s % 2 === 0) noise(t, sd * 2, 0.04 + 0.1 * (s / 16), "bandpass", 400 + s * 280, 0, musicBus);
        }
    }
    function tick() {
        if (!ac) return;
        if (++pollN % 12 === 0) { readSettings(); applyVol(); }
        if (!cur || ac.state !== "running") return;
        const now = ac.currentTime; if (nextT < now - 0.2) nextT = now + 0.05;
        while (nextT < now + 0.18) { playStep(step, nextT); nextT += stepDur(); step = (step + 1) % 16; if (step === 0) bar++; }
    }
    function startTrack() {
        if (!ac || !wantTrack || !TRACKS[wantTrack] || fileOn) return;
        if (curName === wantTrack && timer) return;
        cur = TRACKS[wantTrack]; curName = wantTrack; step = 0; bar = 0; nextT = ac.currentTime + 0.08;
        echoG.gain.setTargetAtTime(cur.echo || 0, ac.currentTime, 0.1);
        if (!timer) timer = setInterval(tick, 30);
    }

    // ---------- sound effects ----------
    const mt = (f, t, d, type, g, o) => tone(f, t, d, type, g, monBus, o);
    const mn = (t, d, g, type, f, to) => noise(t, d, g, type, f, to, monBus);
    const sc = (base, semis) => base * Math.pow(2, semis / 12);
    const SFX = {
        jump: (t) => tone(260, t, 0.16, "square", 0.15, 0, { to: 620 }),
        jump2: (t) => { tone(420, t, 0.14, "square", 0.14, 0, { to: 980 }); tone(630, t + 0.04, 0.1, "triangle", 0.1, 0, { to: 1400 }); },
        thud: (t) => { noise(t, 0.08, 0.22, "lowpass", 500, 200); tone(120, t, 0.1, "sine", 0.35, 0, { to: 55 }); },
        land: (t) => { noise(t, 0.08, 0.22, "lowpass", 500, 200); tone(120, t, 0.1, "sine", 0.35, 0, { to: 55 }); },
        duck: (t) => noise(t, 0.14, 0.14, "bandpass", 1500, 500),
        swing: (t) => noise(t, 0.14, 0.18, "bandpass", 500, 2400),
        impact: (t, k) => { const kk = k === "kick"; noise(t, 0.1, 0.45, "bandpass", kk ? 900 : 1500, 300); tone(kk ? 150 : 200, t, kk ? 0.18 : 0.12, "sine", 0.7, 0, { to: kk ? 40 : 70 }); tone(kk ? 90 : 300, t, 0.08, "square", 0.14, 0, { to: 60 }); },
        coin: (t, n) => { const f = sc(880, [0, 2, 4, 7, 9, 12, 14, 16, 19, 21][Math.min(n | 0, 9)]); tone(f, t, 0.09, "square", 0.12); tone(f * 1.5, t + 0.06, 0.2, "square", 0.1); },
        gem: (t) => [0, 4, 7, 12, 16].forEach((s, i) => tone(sc(1046, s), t + i * 0.05, 0.25, "triangle", 0.14)),
        item: (t) => { [0, 4, 7, 12].forEach((s, i) => tone(sc(523, s), t + i * 0.07, 0.3, "square", 0.11)); tone(1568, t + 0.3, 0.4, "triangle", 0.1); },
        kill: (t) => { noise(t, 0.18, 0.4, "lowpass", 3000, 300); tone(300, t, 0.2, "sawtooth", 0.2, 0, { to: 60 }); tone(900, t, 0.06, "square", 0.12, 0, { to: 1800 }); },
        combo: (t, n) => { const b = Math.min(n | 0, 12); [0, 4, 7].forEach((s, i) => tone(sc(440, s + b), t + i * 0.05, 0.16, "square", 0.11)); },
        near: (t) => { tone(700, t, 0.2, "sine", 0.2, 0, { to: 1500 }); noise(t, 0.15, 0.09, "highpass", 4000, 8000); },
        over: (t) => { noise(t, 0.5, 0.5, "lowpass", 2000, 100); tone(400, t, 0.9, "sawtooth", 0.28, 0, { to: 50 }); tone(200, t + 0.05, 0.9, "square", 0.18, 0, { to: 35 }); },
        revive: (t) => [0, 4, 7, 12, 16, 19].forEach((s, i) => tone(sc(392, s), t + i * 0.07, 0.35, i % 2 ? "triangle" : "square", 0.11)),
        pencil: (t) => tone(1200, t, 0.1, "square", 0.12, 0, { to: 500 }),
        ruler: (t) => { tone(300, t, 0.45, "sawtooth", 0.1, 0, { to: 900 }); noise(t, 0.4, 0.12, "bandpass", 800, 3000); },
        laser: (t) => { tone(1800, t, 0.4, "sawtooth", 0.18, 0, { to: 150 }); tone(1810, t, 0.4, "square", 0.09, 0, { to: 155 }); noise(t, 0.3, 0.14, "highpass", 3000, 6000); },
        blast: (t) => tone(500, t, 0.2, "square", 0.15, 0, { to: 120 }),
        boom: (t) => { noise(t, 0.6, 0.7, "lowpass", 1800, 60); tone(100, t, 0.5, "sine", 0.8, 0, { to: 30 }); },
        day: (t) => [0, 4, 7, 12].forEach((s, i) => tone(sc(523, s), t + i * 0.09, 0.3, "square", 0.11)),
        night: (t) => { tone(110, t, 1.8, "sawtooth", 0.16, 0, { to: 60 }); tone(116, t, 1.8, "sawtooth", 0.12, 0, { to: 63 }); tone(78, t, 1.2, "sine", 0.7, 0, { to: 30 }); noise(t, 1.4, 0.16, "lowpass", 700, 80); tone(sc(220, 6), t + 0.3, 0.9, "square", 0.07, 0, { to: sc(220, 5) }); },
        dawn: (t) => [0, 7, 12, 16].forEach((s, i) => tone(sc(784, s), t + i * 0.12, 0.6, "triangle", 0.13)),
        tick: (t) => tone(880, t, 0.1, "square", 0.12),
        go: (t) => { tone(1320, t, 0.35, "square", 0.15); tone(1760, t, 0.35, "triangle", 0.11); },
        victory: (t) => [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) => tone(sc(523, s), t + i * 0.1, 0.4, i % 2 ? "triangle" : "square", 0.12)),
        // ---- monsters: spawn cry, ambient sound while on screen (v = volume 0..1), brute grunt when hit, and a death sound per type ----
        // (louder channel + mid-range content so they cut through the music even on small speakers)
        spawn_ghoul: (t) => { [0, 3, 7, 10].forEach((s, i) => { mt(sc(1000, s), t + i * 0.08, 0.09, "square", 0.3, { to: sc(1000, s) * 1.7 }); mt(sc(1000, s) / 2, t + i * 0.08, 0.09, "sawtooth", 0.15, { to: sc(1000, s) }); }); mn(t, 0.35, 0.4, "highpass", 4000, 9000); },
        spawn_brute: (t) => { mt(110, t, 0.8, "sawtooth", 0.4, { to: 62 }); mt(116, t, 0.8, "square", 0.25, { to: 66 }); mt(220, t + 0.05, 0.6, "sawtooth", 0.2, { to: 120 }); mn(t, 0.7, 0.5, "bandpass", 500, 150); mt(60, t, 0.5, "sine", 0.6, { to: 35 }); },
        spawn_wraith: (t) => { mt(440, t, 1.0, "triangle", 0.35, { to: 900 }); mt(448, t + 0.05, 1.0, "sawtooth", 0.14, { to: 910 }); mt(900, t + 0.6, 0.7, "triangle", 0.25, { to: 400 }); mt(1350, t + 0.1, 0.9, "sine", 0.12, { to: 2000 }); mn(t, 1.0, 0.25, "bandpass", 1500, 3800); },
        idle_ghoul: (t, v) => { v = v == null ? 1 : v; for (let i = 0; i < 3; i++) { mn(t + i * 0.09, 0.06, 0.4 * v, "highpass", 4500, 8000); mt(1900 - i * 150, t + i * 0.09, 0.06, "square", 0.16 * v, { to: 1200 }); } },
        idle_brute: (t, v) => { v = v == null ? 1 : v; mt(80, t, 0.25, "sine", 0.8 * v, { to: 40 }); mt(150, t, 0.2, "square", 0.22 * v, { to: 70 }); mn(t, 0.2, 0.5 * v, "bandpass", 300, 100); },
        idle_wraith: (t, v) => { v = v == null ? 1 : v; mn(t, 0.8, 0.28 * v, "bandpass", 1400, 3400); mt(700, t, 0.8, "triangle", 0.14 * v, { to: 520 }); mt(1050, t + 0.1, 0.6, "sine", 0.06 * v, { to: 800 }); },
        brute_hit: (t) => { mt(190, t, 0.2, "sawtooth", 0.4, { to: 85 }); mt(75, t, 0.18, "sine", 0.7, { to: 40 }); mn(t, 0.12, 0.3, "bandpass", 500, 200); },
        kill_ghoul: (t) => { mn(t, 0.25, 0.7, "bandpass", 1000, 200); mt(700, t, 0.16, "square", 0.32, { to: 90 }); mt(1400, t, 0.08, "sine", 0.3, { to: 400 }); },
        kill_brute: (t) => { mt(140, t, 0.7, "sine", 1.0, { to: 28 }); mt(230, t, 0.6, "sawtooth", 0.4, { to: 45 }); mt(236, t + 0.02, 0.6, "square", 0.2, { to: 47 }); mn(t, 0.6, 0.8, "lowpass", 1600, 70); mt(420, t, 0.25, "square", 0.18, { to: 110 }); },
        kill_wraith: (t) => { mt(1500, t, 0.8, "sawtooth", 0.3, { to: 180 }); mt(2200, t, 0.6, "triangle", 0.22, { to: 300 }); mn(t, 0.7, 0.4, "highpass", 6000, 1500); [0, 7, 12].forEach((s, i) => mt(sc(1200, -s), t + 0.1 + i * 0.08, 0.35, "sine", 0.14)); },
        // death sounds for the Monster Survival creatures (used when a monster has no recording of its own)
        die_insect: (t) => { mn(t, 0.16, 0.9, "bandpass", 3200, 900); mn(t + 0.04, 0.2, 0.6, "lowpass", 1000, 200); mt(1900, t, 0.12, "square", 0.16, { to: 700 }); mt(2500, t + 0.07, 0.1, "square", 0.12, { to: 900 }); mt(1500, t + 0.14, 0.12, "square", 0.1, { to: 500 }); },
        die_screech: (t) => { mt(2700, t, 0.4, "sawtooth", 0.2, { to: 850 }); mt(3200, t + 0.02, 0.34, "square", 0.1, { to: 1000 }); mt(1400, t + 0.05, 0.3, "triangle", 0.2, { to: 500 }); mn(t, 0.25, 0.3, "highpass", 5000, 2500); },
        die_beast: (t) => { mt(170, t, 0.6, "sawtooth", 0.5, { to: 52 }); mt(225, t, 0.5, "square", 0.22, { to: 68 }); mn(t, 0.5, 0.55, "lowpass", 1000, 110); mt(90, t + 0.05, 0.5, "sine", 0.6, { to: 40 }); },
        die_dragon: (t) => { mt(115, t, 1.0, "sawtooth", 0.55, { to: 36 }); mt(158, t + 0.05, 0.85, "square", 0.28, { to: 48 }); mn(t, 0.95, 0.7, "lowpass", 1300, 90); mt(70, t, 0.9, "sine", 0.7, { to: 30 }); mn(t + 0.1, 0.5, 0.3, "highpass", 3000, 1200); },
        die_groan: (t) => { mt(215, t, 0.75, "sawtooth", 0.28, { to: 118 }); mt(222, t, 0.75, "sawtooth", 0.22, { to: 122 }); mn(t, 0.6, 0.4, "bandpass", 650, 380); mt(110, t + 0.1, 0.6, "sine", 0.4, { to: 70 }); },
        die_metal: (t) => { mt(950, t, 0.3, "square", 0.18, { to: 320 }); mt(1400, t, 0.45, "triangle", 0.24, { to: 720 }); mt(2100, t, 0.3, "sine", 0.14, { to: 1300 }); mn(t, 0.1, 0.8, "highpass", 5000, 3000); mn(t + 0.05, 0.3, 0.35, "bandpass", 1800, 900); },
        die_squelch: (t) => { mn(t, 0.3, 0.8, "lowpass", 1500, 120); mt(320, t, 0.26, "sine", 0.5, { to: 80 }); mt(520, t + 0.09, 0.12, "sine", 0.3, { to: 190 }); mt(420, t + 0.17, 0.1, "sine", 0.25, { to: 150 }); },
        click: (t) => tone(700, t, 0.04, "square", 0.08, 0, { to: 500 }),
        pause: (t) => tone(500, t, 0.1, "triangle", 0.14, 0, { to: 300 }),
        resume: (t) => tone(300, t, 0.1, "triangle", 0.14, 0, { to: 500 }),
        ach: (t) => [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(sc(659, s), t + i * 0.08, 0.35, "square", 0.1))
    };

    // ---------- your own sound files ----------
    // Put the files in visuals/audio/sfx/<name>.mp3 and visuals/audio/music/<track>.mp3 and list them in
    // visuals/audio/sounds.js (see visuals/audio/README.txt). A listed file replaces the built-in sound; anything
    // not listed, or a file that fails to load, keeps the built-in version.
    SFX.arrive = SFX.spawn_ghoul; SFX.arrive_fly = SFX.spawn_wraith; SFX.arrive_big = SFX.spawn_brute;      // Monster Survival arrivals (the spawn_* names can be replaced by Endless sounds)
    const SFX_DIR = "visuals/audio/sfx/", MUSIC_DIR = "visuals/audio/music/";
    const LEGACY_VICTORY = ["visuals/audio/victory.mp3", "visuals/audio/victory.m4a", "visuals/audio/victory.ogg", "visuals/audio/victory.wav"];
    const bad = {}, tmpl = {};
    function spec(kind, name) {                    // {url, vol, start} for a listed file, or null
        const m = (window.RUNMIL_SOUNDS || {})[kind]; if (!m || !m[name]) return null;
        const v = m[name], o = typeof v === "string" ? { ext: v } : v || {};
        const url = (kind === "sfx" ? SFX_DIR : MUSIC_DIR) + (o.file || name) + "." + (o.ext || "mp3");
        return bad[url] ? null : { url: url, vol: o.vol == null ? 1 : +o.vol, start: +o.start || 0 };
    }
    function fileVolNow() { return S.music ? Math.max(0, Math.min(1, (S.musicVol / 100) * fileVol0 * duckV * (paused ? 0.4 : 1))) : 0; }
    function stopFile() { if (vAudio) { try { vAudio.pause(); } catch (e) { /* ignore */ } vAudio = null; } fileOn = false; }
    function getTmpl(sp) {
        let t = tmpl[sp.url];
        if (!t) { t = tmpl[sp.url] = new Audio(sp.url); t.preload = "auto"; t.addEventListener("error", function () { bad[sp.url] = true; delete tmpl[sp.url]; }); }
        return t;
    }
    function playSfxFile(sp, name) {               // overlapping plays are fine: each one is a copy of the loaded sound
        if (typeof Audio === "undefined") return false;
        const t = getTmpl(sp), a = t.cloneNode(); a.volume = Math.max(0, Math.min(1, (S.sfxVol / 100) * sp.vol));
        const p = a.play(); if (p && p.catch) p.catch(function () { /* blocked until the first click */ });
        return true;
    }
    function playFile(key, urls, o, startNow) {    // loop a music file; urls are tried in order
        if (vAudio || fileMissing[key] || typeof Audio === "undefined") return;
        readSettings();
        const a = new Audio(); let i = 0;
        a.loop = true; a.preload = "auto"; fileVol0 = o.vol == null ? 1 : o.vol; vAudio = a; a.volume = fileVolNow();
        if (startNow) { fileOn = true; applyVol(); }  // a listed file: keep the built-in tune quiet while it loads
        const next = function () {
            if (vAudio !== a) return;
            if (i >= urls.length) {                    // no usable file: the built-in tune plays
                fileMissing[key] = true; vAudio = null; fileOn = false; applyVol();
                if (urls[0] && urls[0].indexOf(MUSIC_DIR) === 0) bad[urls[0]] = true;
                if (wantTrack && ensure()) startTrack(); return;
            }
            a.src = urls[i++]; a.load();
            const p = a.play(); if (p && p.catch) p.catch(function () { /* blocked until a click: the tune keeps playing */ });
        };
        a.addEventListener("error", next);
        a.addEventListener("loadedmetadata", function () { if (o.start > 0) { try { a.currentTime = o.start; } catch (e) { /* ignore */ } } });
        a.addEventListener("playing", function () {  // the song is playing: silence the built-in tune
            if (vAudio !== a) return;
            fileOn = true; applyVol(); clearInterval(timer); timer = 0; cur = null; curName = "";
        });
        next();
    }

    // ---------- public API ----------
    const API = {
        sfx: function (name, arg) {
            if (name === "swing" && arg) {             // your punch_1.. / kick_1.. files: one at random when the punch / kick is thrown
                const c = []; for (let i = 1; i <= 8; i++) if (spec("sfx", arg + "_" + i)) c.push(arg + "_" + i);
                if (c.length) name = c[(Math.random() * c.length) | 0];
            }
            const orig = name, ent = ((window.RUNMIL_SOUNDS || {}).sfx || {})[name];
            if (ent && ent.pick && ent.pick.length) name = ent.pick[(Math.random() * ent.pick.length) | 0];     // { pick: ["rat_1", "rat_2"] }: one of these at random
            const f = SFX[name], sp = spec("sfx", name); if ((!f && !sp) || !S.sfx) return;
            if (sp) {                                  // your own file replaces the built-in sound
                const t = performance.now(); if (lastPlayed[name] && t - lastPlayed[name] < 30) return; lastPlayed[name] = t;
                if (orig.indexOf("spawn_") === 0 || orig.indexOf("kill_") === 0 || orig === "brute_hit") API.dip();
                try { if (playSfxFile(sp, name)) return; } catch (e) { /* fall back to the built-in sound */ }
            }
            if (!f || !ensure() || ac.state !== "running") return;
            const now = ac.currentTime; if (lastPlayed[name] && now - lastPlayed[name] < 0.03) return; lastPlayed[name] = now;
            if (orig.indexOf("spawn_") === 0 || orig.indexOf("kill_") === 0 || orig === "brute_hit") API.dip();
            try { f(now + 0.005, arg); } catch (e) { /* never break the game for a sound */ }
        },
        music: function (name) {
            wantTrack = TRACKS[name] ? name : name.split("_")[0]; duckV = 1; stopFile();      // "park_day" falls back to the built-in "park" tune
            const sp = spec("music", name);
            if (sp) playFile("m:" + name, [sp.url], sp, true);                       // a listed music file
            if (ensure()) { applyVol(); startTrack(); }
            if (!sp && name === "victory") playFile("victory", LEGACY_VICTORY, { vol: 1, start: 0 }, false);   // old way: visuals/audio/victory.mp3
        },
        stop: function () {
            wantTrack = ""; duckV = 0; stopFile(); applyVol();
            setTimeout(function () { if (!wantTrack) { clearInterval(timer); timer = 0; cur = null; curName = ""; } }, 600);
        },
        mood: function (n, i) {
            inten = Math.max(0, Math.min(1, i));
            if (Math.abs(n - lastNight) > 0.02) { night = Math.max(0, Math.min(1, n)); lastNight = n; applyVol(); }
        },
        pause: function (on) { paused = !!on; if (ensure()) { applyVol(); API.sfx(on ? "pause" : "resume"); } },
        dip: function () { dipV = 0.5; applyVol(); clearTimeout(API._d); API._d = setTimeout(function () { dipV = 1; applyVol(); }, 600); },
        duck: function (v) { duckV = v; applyVol(); },
        unlock: function () {
            if (vAudio && vAudio.paused) { const p = vAudio.play(); if (p && p.catch) p.catch(function () { /* still blocked */ }); }      // a music file that was blocked before the first click
            if (ensure()) { applyVol(); startTrack(); }
        },
        ready: function () { return !!ac && ac.state === "running"; },
        has: function (kind, name) { return !!spec(kind, name); },
        names: function () { return { sfx: Object.keys(SFX), music: Object.keys(TRACKS) }; },
        source: function (kind, name) { const m = (window.RUNMIL_SOUNDS || {})[kind]; const v = m && m[name]; if (!v) return "built-in"; const o = typeof v === "string" ? { ext: v } : v; return bad[(kind === "sfx" ? SFX_DIR : MUSIC_DIR) + (o.file || name) + "." + (o.ext || "mp3")] ? "file missing (built-in plays)" : "your file"; },
        info: function () { return { track: curName, file: !!vAudio, filePlaying: !!(vAudio && !vAudio.paused), fileMissing: Object.keys(fileMissing).length > 0, synth: !!timer }; }
    };
    window.RunMilAudio = API;

    // browsers only start audio after a click / key press: the first one unlocks it (and starts any waiting music)
    ["pointerdown", "keydown", "touchend"].forEach(function (n) { addEventListener(n, API.unlock, true); });
    document.addEventListener("visibilitychange", function () {
        if (!ac) return;
        try { if (document.hidden) ac.suspend(); else ac.resume(); } catch (e) { /* ignore */ }
    });
    // little click on every menu / panel button (not the on-screen game controls)
    document.addEventListener("click", function (e) {
        const b = e.target.closest && e.target.closest("button, .loc, .menu-btn");
        if (b && !b.closest("#touch") && b.id !== "pausebtn") API.sfx("click");
    }, true);
    readSettings();
    setTimeout(function () { try { Object.keys((window.RUNMIL_SOUNDS || {}).sfx || {}).forEach(function (n) { const sp = spec("sfx", n); if (sp) getTmpl(sp); }); } catch (e) { /* preload is optional */ } }, 0);   // load the listed sound effects up front
    setInterval(function () { if (!timer) { readSettings(); applyVol(); } }, 700);
})();
