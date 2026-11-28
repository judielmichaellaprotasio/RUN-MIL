/* =========================================================
   MONSTER SURVIVAL  (part 2: waves, monsters, health, boss  -  Level 1)
   - 4 levels: only level 1 is open; a level opens when the one before it is cleared
   - the background is a big picture and the screen is a window onto it that follows the player
   - the player walks only on the pathway of each level
   Keys: A / D run, W / S up / down, SPACE jump, C duck, P punch, K kick (same key for left and right)
========================================================= */
(function () {
    "use strict";
    const KEY = "runmil_save";
    let Z = 1, WW = 960, WH = 540;                               // Z: zoom of the world (below 1 = zoomed out, characters smaller); WW/WH = the part of the level that is visible
    const VW = 960, VH = 540;                                    // size of the window onto the level (game units)
    const $ = (id) => document.getElementById(id) || document.createElement("div");      // a missing page element never stops the game
    const cv = $("game"), ctx = cv.getContext("2d"), stage = $("stage"), bgimg = $("bgimg");
    const C = window.RunMilCharacter;
    const AUD = function (n, a, b) { try { if (window.RunMilAudio) window.RunMilAudio[n](a, b); } catch (e) { /* audio is optional */ } };
    const NQ = { on: false, host: false, q: [] };                 // two-device play: what the host sees and hears is queued here and sent to the guest
    const SFX = function (n, a) { if (NQ.on && NQ.host) NQ.q.push(["s", n, a === undefined ? 0 : a]); try { if (window.RunMilAudio) window.RunMilAudio.sfx(n, a); } catch (e) { /* audio is optional */ } };

    // ---------- levels ----------
    // w / h: size of the whole level in game units.  band: top / bottom of the pathway (where the FEET may stand) as a share of h.
    // ps: size of the character on that level.  difficulty: 1 easy ... 4 hardest (used by the waves in the next step).
    const LEVELS = [
        { n: 1, name: "The Convenience Store", diff: "EASY",       cls: "d1", file: "level1.webp", thumb: "thumb1.jpg", w: 1700, h: 638,  band: [0.73, 0.89], cm: 0.6, dm: 0.6, hm: 1.5, ps: 1.0, zoom: 0.85,
          // waves: [seconds after the wave starts, [monsters that appear together]]. A few come one or two at a time, then a bunch. Wave 5 = the boss.
          waves: null },
        { n: 2, name: "The Clown", diff: "HARD-ISH",   cls: "d2", file: "level2.webp", thumb: "thumb2.jpg", w: 1440, h: 810,  band: [0.735, 0.835], cm: 0.55, dm: 0.5, hm: 1.1, ps: 1.0, zoom: 0.85 },
        { n: 3, name: "Haunted Cinema",    diff: "HARD",       cls: "d3", file: "level3.webp", thumb: "thumb3.jpg", w: 1174, h: 772,  band: [0.77, 0.925], cm: 0.4, dm: 0.42, hm: 0.85, ps: 1.0, zoom: 0.85, px: 1 },
        { n: 4, name: "Carnival Nightmare", diff: "HARDEST",   cls: "d4", file: "level4.webp", thumb: "thumb4.jpg", w: 1174, h: 654,  band: [0.885, 0.965], cm: 0.35, dm: 0.4, hm: 0.8, ps: 1.0, zoom: 0.85, px: 1 }
    ];
    const WAVES = 5, DIR = "visuals/survival/";

    // ---------- save ----------
    function rawSave() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
    const UNLOCK_ALL = false;                                  // TESTING: every level is open. Set to false to go back to unlocking them one by one (your real progress is kept either way).
    const LOCK_FROM = 5;                                       // 2 = lock levels 2-4 completely, 5 = normal: a level opens when the one before it is cleared
    function getProg() {
        const s = rawSave().survival || {}, cleared = s.cleared || {};
        let u = 1; while (u < 4 && cleared[u]) u++;                      // level N+1 is open only when level N is cleared
        return { unlocked: Math.min(LOCK_FROM - 1, u), cleared: cleared };
    }
    function setProg(p) {
        const s = rawSave();
        if (UNLOCK_ALL) { const real = (s.survival || {}).unlocked | 0 || 1, top = Math.max.apply(null, [0].concat(Object.keys(p.cleared).map(Number))); p = { unlocked: Math.max(real, Math.min(4, top + 1)), cleared: p.cleared }; }
        s.survival = p; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
    }

    // ---------- sizing: everything scales with the window ----------
    let K = 1;                                                   // screen pixels per game unit
    function resize() { K = stage.clientWidth / VW; stage.style.setProperty("--u", K + "px"); layoutBg(); }
    addEventListener("resize", resize);

    // ---------- the player's sheets (the GIFs are drawn facing left; facing right is a mirror) ----------
    const SV = window.RUNMIL_SV || {};
    // Light mode (phones): the sprite sheets are about twice as big as they are ever drawn (~300 MB of pictures in memory, which is what makes a phone stutter).
    // Each sheet is shrunk once, right after loading, to its on-screen size; sc / ax / gy are adjusted so nothing moves or changes size.
    function shrink(a, src, force) {
        if ((!window.RUNMIL_PERF && !force) || !src || !a.cols || !a.fw) return src;
        const r = Math.min(1, a.sc * 1.1); if (r > 0.95) return src;
        try {
            const rows = Math.ceil(a.n / a.cols), fw2 = Math.max(1, Math.round(a.fw * r)), fh2 = Math.max(1, Math.round(a.fh * r));
            const c = document.createElement("canvas"); c.width = a.cols * fw2; c.height = rows * fh2;
            const g = c.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
            for (let i = 0; i < a.n; i++) g.drawImage(src, (i % a.cols) * a.fw, Math.floor(i / a.cols) * a.fh, a.fw, a.fh, (i % a.cols) * fw2, Math.floor(i / a.cols) * fh2, fw2, fh2);
            const rx = fw2 / a.fw, ry = fh2 / a.fh; a.ax *= rx; a.gy *= ry; a.sc /= (rx + ry) / 2; a.fw = fw2; a.fh = fh2;
            return c;
        } catch (e) { return src; }
    }
    function outfit(im, a) {                                     // the outfit / skin saved in Character Customization, painted onto the sheet (shared code in character.js)
        try { return C && C.paintSheet ? C.paintSheet(im, a) : im; } catch (e) { return im; }
    }
    Object.keys(SV).forEach(function (k) { const a = SV[k], im = new Image(); a.orig = { fw: a.fw, fh: a.fh, ax: a.ax, gy: a.gy, sc: a.sc }; im.onload = function () { a.img = shrink(a, outfit(im, a)); }; im.src = a.src; a.total = a.dur.reduce((x, y) => x + y, 0); });
    function frameAt(a, ms) { ms = ms % a.total; for (let i = 0; i < a.n; i++) { if (ms < a.dur[i]) return i; ms -= a.dur[i]; } return 0; }

    // ---------- monsters ----------
    // hw: half width of the body box  h: height of the body box  reach: how far in front the attack box reaches
    // aggro: how close the player must be before it attacks  strike: attack frames that can hurt  lane: how far apart (up/down) it can still hit
    const SVM = window.RUNMIL_SVM || {};
    SVM.pigt = SVM.tan; SVM.pigf = SVM.fist; SVM.pigk = SVM.fork; SVM.birdy = SVM.bird;                     // Level 4 monster names -> their sheets
    // builds a long wave: it starts with 1 or 2 monsters, builds up, and ends with a big surge (like the video). total = how many monsters, span = seconds
    function mkWave(total, span, batShare, boss, tp) {
        tp = tp || ["rat", "bat", "boss"]; const ch = function (x) { return Array.isArray(x) ? x[Math.floor(Math.random() * x.length)] : x; };
        const g = [], pick = function (n) { const a = []; for (let i = 0; i < n; i++) a.push(ch(Math.random() < batShare ? tp[1] : tp[0])); return a; };
        const sizes = [1, 2, 2]; let left = total - 5; const surge = Math.ceil(total * 0.3); left -= surge - 0; while (left > 0) { const n = Math.min(left, 2 + Math.floor(Math.random() * 3)); sizes.push(n); left -= n; } sizes.push(surge);
        const step = span / sizes.length;
        sizes.forEach(function (n, i) { g.push([Math.round(i * step), pick(n)]); });
        if (boss) g.unshift([0, [ch(tp[2])]]);
        return g;
    }
    LEVELS[1].waves = [mkWave(22, 46, 0, 0, [["art"], "art", "clown"]), mkWave(30, 54, 0, 0, [["art", "claw"], "art", "clown"]), mkWave(40, 64, 0, 0, [["art", "claw", "mask"], "art", "clown"]), mkWave(50, 74, 0, 0, [["art", "claw", "mask", "saw"], "art", "clown"]), mkWave(48, 120, 0, 1, [["art", "claw", "mask", "saw"], "art", "clown"])];
    LEVELS[2].waves = [mkWave(26, 46, 0, 0, [["eye", "blob"], "eye", "eyeboss"]), mkWave(36, 54, 0, 0, [["eye", "blob", "gang"], "eye", "eyeboss"]), mkWave(46, 64, 0, 0, [["eye", "blob", "gang"], "eye", "eyeboss"]), mkWave(58, 74, 0, 0, [["eye", "blob", "gang"], "eye", "eyeboss"]), mkWave(52, 120, 0, 1, [["eye", "blob", "gang"], "eye", "eyeboss"])];
    LEVELS[3].waves = [mkWave(30, 46, 0.15, 0, [["pigt", "pigf"], "birdy", "cow"]), mkWave(40, 54, 0.2, 0, [["pigt", "pigf", "pigk"], "birdy", "cow"]), mkWave(52, 64, 0.2, 0, [["pigt", "pigf", "pigk", "girl"], "birdy", "cow"]), mkWave(64, 74, 0.2, 0, [["pigt", "pigf", "pigk", "girl"], "birdy", "cow"]), mkWave(56, 120, 0.2, 1, [["pigt", "pigf", "pigk", "girl"], "birdy", "cow"])];
    LEVELS[0].waves = [mkWave(14, 44, 0.25), mkWave(20, 54, 0.3, 0, [["rat", "roach"], "bat", "boss"]), mkWave(28, 64, 0.25, 0, [["rat", "roach", "spider"], "bat", "boss"]), mkWave(36, 74, 0.2, 0, [["rat", "roach", "spider", "frog"], "bat", "boss"]), mkWave(40, 110, 0.2, true, [["rat", "roach", "spider", "frog"], "bat", "boss"])];
    LEVELS[0].types = ["rat", "roach", "spider", "frog", "bat"]; LEVELS[1].types = ["art", "claw", "mask", "saw"]; LEVELS[2].types = ["eye", "blob", "gang", "zomb", "fur"]; LEVELS[3].types = ["pigt", "pigf", "pigk", "girl", "birdy", "drag"];
    const MD = {
        rat:  { hp: 3,  speed: 105, hw: 52,  h: 78,  fly: 0,  dmg: 8,  reach: 100, atkMs: 720,  strike: [3, 5], cd: 1.5, aggro: 140, lane: 42, zlo: 0,  zhi: 80,  score: 1 },
        bat:  { hp: 2,  speed: 140, hw: 40,  h: 66,  fly: 1,  dmg: 7,  reach: 85,  atkMs: 760,  strike: [3, 4], cd: 1.7, aggro: 130, lane: 42, zlo: 105, zhi: 165, score: 1 },
        eye:   { hp: 5,  speed: 110, hw: 44, h: 150, fly: 0, dmg: 12, reach: 125, atkMs: 750,  strike: [3, 5], cd: 1.3, aggro: 160, lane: 42, zlo: 0, zhi: 125, score: 2, sh: 56 },
        blob:  { hp: 8,  speed: 70,  hw: 54, h: 120, fly: 0, dmg: 14, reach: 120, atkMs: 750,  strike: [2, 4], cd: 1.5, aggro: 150, lane: 44, zlo: 0, zhi: 105, score: 3, sh: 62 },
        gang:  { hp: 7,  speed: 125, hw: 66, h: 140, fly: 0, dmg: 13, reach: 115, atkMs: 950,  strike: [4, 8], cd: 1.4, aggro: 150, lane: 46, zlo: 0, zhi: 125, score: 3, sh: 70 },
        eyeboss: { hp: 80,  speed: 72, hw: 90, h: 240, fly: 0, dmg: 28, reach: 230, atkMs: 1100, strike: [3, 6], cd: 1.6, aggro: 240, lane: 90, zlo: 0, zhi: 170, score: 8, boss: 1 },
        claw:  { hp: 5, speed: 100, hw: 38, h: 135, fly: 0, dmg: 11, reach: 115, atkMs: 900,  strike: [6, 10], cd: 1.3, aggro: 155, lane: 42, zlo: 0, zhi: 125, score: 2, sh: 52 },
        saw:   { hp: 8, speed: 80,  hw: 44, h: 133, fly: 0, dmg: 16, reach: 135, atkMs: 1000, strike: [6, 9],  cd: 1.6, aggro: 165, lane: 44, zlo: 0, zhi: 125, score: 3, sh: 58 },
        mask:  { hp: 4, speed: 122, hw: 38, h: 135, fly: 0, dmg: 10, reach: 120, atkMs: 850,  strike: [6, 10], cd: 1.2, aggro: 155, lane: 42, zlo: 0, zhi: 125, score: 2, sh: 54 },
        pigt:  { hp: 7, speed: 118, hw: 50, h: 130, fly: 0, dmg: 14, reach: 120, atkMs: 800,  strike: [5, 9],  cd: 1.3, aggro: 170, lane: 44, zlo: 0, zhi: 125, score: 3, sh: 56 },
        pigf:  { hp: 8, speed: 100, hw: 46, h: 133, fly: 0, dmg: 15, reach: 115, atkMs: 700,  strike: [3, 5],  cd: 1.3, aggro: 150, lane: 44, zlo: 0, zhi: 125, score: 3, sh: 56 },
        pigk:  { hp: 7, speed: 95,  hw: 50, h: 135, fly: 0, dmg: 13, reach: 125, atkMs: 850,  strike: [4, 8],  cd: 1.4, aggro: 160, lane: 44, zlo: 0, zhi: 125, score: 3, sh: 58 },
        girl:  { hp: 6, speed: 82,  hw: 36, h: 137, fly: 0, dmg: 16, reach: 110, atkMs: 1000, strike: [6, 10], cd: 1.5, aggro: 150, lane: 42, zlo: 0, zhi: 125, score: 3, sh: 46 },
        birdy: { hp: 4, speed: 150, hw: 62, h: 90,  fly: 1, dmg: 12, reach: 105, atkMs: 800,  strike: [4, 6],  cd: 1.6, aggro: 150, lane: 44, zlo: 95, zhi: 175, score: 3, sh: 36 },
        cow:   { hp: 85,  speed: 70, hw: 80, h: 250, fly: 0, dmg: 30, reach: 210, atkMs: 1250, strike: [6, 10], cd: 1.6, aggro: 240, lane: 90, zlo: 0, zhi: 170, score: 8, boss: 1 },
        drag:  { hp: 12, speed: 88, hw: 70, h: 175, fly: 0, dmg: 17, reach: 160, atkMs: 1250, strike: [6, 9], cd: 1.7, aggro: 190, lane: 46, zlo: 0, zhi: 150, score: 4, sh: 82 },
        zomb:  { hp: 6, speed: 96, hw: 34, h: 140, fly: 0, dmg: 11, reach: 125, atkMs: 1100, strike: [4, 7], cd: 1.4, aggro: 155, lane: 42, zlo: 0, zhi: 125, score: 2, sh: 48 },
        fur:   { hp: 9, speed: 84, hw: 56, h: 150, fly: 0, dmg: 14, reach: 130, atkMs: 800, strike: [2, 4], cd: 1.5, aggro: 160, lane: 44, zlo: 0, zhi: 130, score: 3, sh: 66 },
        spider: { hp: 4, speed: 92,  hw: 62, h: 92, fly: 0, dmg: 10, reach: 118, atkMs: 900, strike: [7, 10], cd: 1.4, aggro: 150, lane: 44, zlo: 0, zhi: 90, score: 2, sh: 64 },
        roach:  { hp: 3, speed: 128, hw: 56, h: 84, fly: 0, dmg: 7,  reach: 105, atkMs: 800, strike: [7, 10], cd: 1.3, aggro: 140, lane: 42, zlo: 0, zhi: 84, score: 1, sh: 58 },
        frog:   { hp: 6, speed: 78,  hw: 58, h: 90, fly: 0, dmg: 12, reach: 125, atkMs: 900, strike: [8, 11], cd: 1.6, aggro: 150, lane: 44, zlo: 0, zhi: 90, score: 2, sh: 60 },
        art:   { hp: 5,  speed: 98,  hw: 40,  h: 150, fly: 0,  dmg: 12, reach: 105, atkMs: 960,  strike: [3, 5], cd: 1.3, aggro: 150, lane: 42, zlo: 0,  zhi: 120, score: 2, sh: 52 },
        clown: { hp: 75,  speed: 74, hw: 90,  h: 260, fly: 0,  dmg: 26, reach: 200, atkMs: 1120, strike: [3, 5], cd: 1.5, aggro: 230, lane: 90, zlo: 0,  zhi: 170, score: 6, boss: 1 },
        boss: { hp: 70,  speed: 64,  hw: 96,  h: 230, fly: 0,  dmg: 20, reach: 210, atkMs: 1300, strike: [2, 5], cd: 1.9, aggro: 230, lane: 90, zlo: 0,  zhi: 150, score: 5, boss: 1 }
    };
    Object.keys(SVM).forEach(function (k) {
        ["walk", "atk"].forEach(function (w) {
            const a = SVM[k] && SVM[k][w]; if (!a) return;
            const im = new Image(); im.onload = function () { a.img = shrink(a, im); }; im.src = a.src;
            a.total = a.dur.reduce((x, y) => x + y, 0);
        });
    });
    const AB = window.RunMilAABB;                               // the Java hit-check engine (aabb-java), with a JS copy as a fallback
    const hit = (ax, ay, aw, ah, bx, by, bw, bh, tag, kind, lane) => {      // tag = what is tested (shown by the AABB vision on a hit); y values are heights above the lane
        const r = AB.overlap(ax, ay, aw, ah, bx, by, bw, bh);
        if (r && tag && window.RMX) { const ly = lane == null ? me.y : lane; RMX.vis.hit({ x: ax, y: ay + ly, w: aw, h: ah }, { x: bx, y: by + ly, w: bw, h: bh }, tag, kind, cam.x, cam.y); }
        return r;
    };

    // ---------- drops + power-ups ----------
    const PU = window.RUNMIL_PU || { icons: {}, fx: {} };
    const iconCoin = new Image(); iconCoin.src = "visuals/images/icon-coin.png";
    const iconGem = new Image(); iconGem.src = "visuals/images/icon-gem.png";
    const okImg = (im) => im && im.complete && im.naturalWidth > 0;
    Object.keys(PU.icons).forEach(function (k) { const a = PU.icons[k], im = new Image(); im.onload = function () { a.img = im; }; im.src = a.src; a.total = a.dur.reduce((x, y) => x + y, 0); });
    Object.keys(PU.fx).forEach(function (k) { const a = PU.fx[k], im = new Image(); im.onload = function () { a.img = im; }; im.src = a.src; a.total = a.dur.reduce((x, y) => x + y, 0); });
    if (PU.fx.tornado) { PU.fx.tornado.ax = 190; PU.fx.tornado.gy = 292; }             // the tornado's own middle / base inside its picture
    // weights: how often each power-up drops.  secs: how long it lasts (0 = instant, -1 = kept until used)
    const PUS = {
        health_pack:   { n: "HEALTH PACK",   w: 16, secs: 0,  d: "+35 HP" },
        shield:        { n: "SHIELD",        w: 12, secs: 8,  d: "blocks every hit" },
        shockwave:     { n: "SHOCKWAVE",     w: 12, secs: 0,  d: "blasts everything around you" },
        freeze_time:   { n: "FREEZE TIME",   w: 10, secs: 5,  d: "monsters freeze" },
        mango_rage:    { n: "MANGO RAGE",    w: 10, secs: 15,  d: "double damage, faster hits" },
        banana_magnet: { n: "BANANA MAGNET", w: 9,  secs: 15, d: "drops fly to you" },
        lucky_charm:   { n: "LUCKY CHARM",   w: 9,  secs: 20, d: "more and richer drops" },
        second_wind:   { n: "SECOND WIND",   w: 6,  secs: -1, d: "a free comeback when you fall" },
        free_ammo:     { n: "FREE AMMO",     w: 8,  secs: 0,  d: "weapon packs added to your shop stock" },
        tornado:       { n: "TORNADO",       w: 5,  secs: 0,  d: "sweeps the monsters away", dis: 1 },
        fireball:      { n: "FIREBALLS",     w: 5,  secs: 0,  d: "fire from the sky", dis: 1 },
        acidrain:      { n: "ACID RAIN",     w: 5,  secs: 0,  d: "burns and slows them", dis: 1 },
        landspikes:    { n: "LAND SPIKES",   w: 5,  secs: 0,  d: "spikes burst from the ground", dis: 1 }
    };

    // ---------- hand-drawn disaster icons (drawn once, used on the pickups) ----------
    const DIS_ICON = {};
    function mkDisIcon(k) {
        const c = document.createElement("canvas"); c.width = c.height = 96; const g = c.getContext("2d"); g.translate(48, 48); g.lineJoin = "round"; g.lineCap = "round";
        const cloud = function (col) { g.fillStyle = col; g.strokeStyle = "#111"; g.lineWidth = 3; g.beginPath(); g.arc(-16, -4, 13, Math.PI * 0.5, Math.PI * 1.5); g.arc(-2, -18, 15, Math.PI, 0); g.arc(17, -6, 12, Math.PI * 1.5, Math.PI * 0.5); g.closePath(); g.fill(); g.stroke(); };
        if (k === "acidrain") {
            cloud("#7a8f6a");
            g.fillStyle = "#9cff3a"; g.strokeStyle = "#2a6a00"; g.lineWidth = 2.5;
            [[-20, 16], [-4, 24], [12, 14], [24, 26]].forEach(function (p) { g.beginPath(); g.moveTo(p[0], p[1] - 9); g.quadraticCurveTo(p[0] + 8, p[1] + 3, p[0], p[1] + 8); g.quadraticCurveTo(p[0] - 8, p[1] + 3, p[0], p[1] - 9); g.fill(); g.stroke(); });
        } else if (k === "landspikes") {
            g.fillStyle = "#5a3a1a"; g.fillRect(-38, 24, 76, 12); g.strokeStyle = "#111"; g.lineWidth = 3; g.strokeRect(-38, 24, 76, 12);
            [[-26, 36], [-6, 52], [16, 42], [30, 30]].forEach(function (p) { const x = p[0], t = 24 - p[1] * 0 - (p[1] - 20); g.fillStyle = "#cfd6dc"; g.beginPath(); g.moveTo(x - 9, 24); g.lineTo(x, 24 - p[1] * 0.9); g.lineTo(x + 9, 24); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(x - 2, 24); g.lineTo(x, 24 - p[1] * 0.9); g.lineTo(x + 3, 24); g.closePath(); g.globalAlpha = 0.6; g.fill(); g.globalAlpha = 1; });
        } else if (k === "fireball") {
            g.fillStyle = "#ff6a00"; g.strokeStyle = "#7a1a00"; g.lineWidth = 3; g.beginPath(); g.moveTo(-34, -30); g.quadraticCurveTo(-8, -14, -4, -6); g.arc(8, 8, 22, Math.PI * 1.15, Math.PI * 0.95, true); g.quadraticCurveTo(-4, 28, -34, -30); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = "#ffb41a"; g.beginPath(); g.arc(8, 8, 15, 0, 7); g.fill(); g.fillStyle = "#fff3a0"; g.beginPath(); g.arc(11, 10, 8, 0, 7); g.fill();
        } else if (k === "tornado") {
            g.strokeStyle = "#111"; g.lineWidth = 3; [[-30, -28, 30, 7], [-24, -14, 24, 7], [-18, 0, 18, 7], [-12, 14, 12, 6], [-6, 28, 6, 5]].forEach(function (r, i) { g.fillStyle = i % 2 ? "#b8cde0" : "#8aa4bf"; g.beginPath(); g.ellipse((r[0] + r[2]) / 2 + (i % 2 ? 3 : -3), r[1], (r[2] - r[0]) / 2, r[3], 0, 0, 7); g.fill(); g.stroke(); });
        }
        return c;
    }
    ["acidrain", "landspikes", "fireball", "tornado"].forEach(function (k) { DIS_ICON[k] = mkDisIcon(k); });
    function rollPU() { const ks = Object.keys(PUS), tot = ks.reduce((a, k) => a + PUS[k].w, 0); let r = Math.random() * tot; for (const k of ks) { r -= PUS[k].w; if (r <= 0) return k; } return ks[0]; }

    // ---------- state ----------
    let lv = null, running = false, paused = false, ended = false, last = 0, keys = {}, cam = { x: 0, y: 0 };
    let me = null, PL = [], MODE = 1, mons = [], fx = [], wv = null, S = null, shake = 0, hitStop = 0, slowT = 0, pks = [], dis = [], ring = null, spk = [], flm = [], wnd = [];
    const SPEED = 250, GRAV = 2300, JUMP_V = 800, AIR = 2 * JUMP_V / GRAV, HP_MAX = 100, HALF_W = 22, STAND = 175, DUCK = 100;
    const ATK = { punch: { ms: 290, w: [120, 280], reach: 100, zlo: 55, zhi: 150, dmg: 1 }, kick: { ms: 370, w: [250, 420], reach: 125, zlo: 10, zhi: 115, dmg: 2 } };   // same quick timing as Endless
    function newPlayer(i, sv) {
        const y0 = lv.h * lv.band[0], y1 = lv.h * lv.band[1];
        return { pid: i || 0, sv: sv || SV, keys: {}, wcd: {}, x: lv.w * 0.28 + (i ? 80 : 0), y: (y0 + y1) / 2 + (i ? 12 : 0), z: 0, vz: 0, airT: 0, face: 1, act: null, duck: false, duckT: 0, runT: 0, moving: false, hp: HP_MAX, en: 0, deadT: 0, fcd: 0, inv: 0, kx: 0, dead: 0 };
    }
    // run something as a given player: `me`, `keys` and the weapon cool-downs are swapped for the time of the call (all the single-player code keeps working as it is)
    function as(p, fn) { const sm = me, sk = keys, sw = wcd; me = p; keys = p.keys; wcd = p.wcd; try { return fn(); } finally { me = sm; keys = sk; wcd = sw; } }
    function resetKeys() { PL.forEach(function (p) { p.keys = {}; }); if (PL[0]) keys = PL[0].keys; else keys = {}; }
    const twoP = function () { return PL.length > 1; };
    // on a phone nobody shares the keyboard: Player 2 is played by the computer (a bot)
    const BOT = (!!window.RUNMIL_NATIVE || (window.matchMedia && matchMedia("(pointer: coarse)").matches) || /[?&]touch=1/.test(location.search)) && !/[?&]nettest=1/.test(location.search);
    function botThink(p, dt) {
        const k = p.keys, b = p.bot || (p.bot = { t: 0, cd: 0.5, sp: 0 });
        b.cd -= dt; b.t -= dt; b.sp -= dt;
        if (p.dead || ended || !running) { k.KeyA = k.KeyD = k.KeyW = k.KeyS = k.KeyC = false; return; }
        if (p.act || b.t > 0) return;
        b.t = 0.2 + Math.random() * 0.25;                          // slow reactions: Player 2 is weaker than you
        if (Math.random() < 0.15) return;                            // sometimes it hesitates
        k.KeyA = k.KeyD = k.KeyW = k.KeyS = k.KeyC = false;
        let tg = null, bd = 1e9, near = 0;
        mons.forEach(function (m) { if (m.st === "die") return; const d = Math.abs(m.x - p.x) + Math.abs(m.y - p.y) * 1.5; if (d < 300) near++; if (d < bd) { bd = d; tg = m; } });
        const lead = PL[0];
        if (!tg || bd > 950) {                                     // nothing to fight: stay close to Player 1
            const dx = lead.x - p.x - (lead.face > 0 ? -90 : 90), dy = lead.y + 14 - p.y;
            if (Math.abs(dx) > 40) { if (dx > 0) k.KeyD = true; else k.KeyA = true; }
            if (Math.abs(dy) > 16) { if (dy > 0) k.KeyS = true; else k.KeyW = true; }
            return;
        }
        const dx = tg.x - p.x, dy = tg.y - p.y, ax = Math.abs(dx), lane = (tg.d && tg.d.lane) || 30;
        if (Math.abs(dy) > Math.max(10, lane * 0.45)) { if (dy > 0) k.KeyS = true; else k.KeyW = true; }
        if (ax > 100) { if (dx > 0) k.KeyD = true; else k.KeyA = true; }
        else if (ax < 40 && Math.random() < 0.4) { if (dx > 0) k.KeyA = true; else k.KeyD = true; }
        else p.face = dx > 0 ? 1 : -1;
        if (ax <= 118 && Math.abs(dy) <= lane && b.cd <= 0 && p.z <= 0) { as(p, function () { attack(ax > 100 || Math.random() < 0.4 ? "kick" : "punch"); }); b.cd = 0.9 + Math.random() * 0.8; }
        if (b.sp <= 0 && Math.random() < 0.5 && (near >= 2 || (tg.d && tg.d.boss)) && p.en >= (p.h && p.h.special === "flames" ? 30 : 100) && ax < 320) { as(p, function () { special(); }); b.sp = 6; }
    }
    const nearest = function (m) { let b = null, bd = 1e9; PL.forEach(function (p) { if (p.dead) return; const d = Math.abs(p.x - m.x) + Math.abs(p.y - m.y) * 1.5; if (d < bd) { bd = d; b = p; } }); return b || PL[0]; };

    // ---------- 2 players: the heroines (web version only) ----------
    const DUO = window.RUNMIL_DUO && window.RUNMIL_DUO.enabled ? window.RUNMIL_DUO : null;
    function duoSave() { return rawSave().duo || {}; }
    function setDuo(patch) { const sv = rawSave(); sv.duo = Object.assign({}, sv.duo, patch); try { localStorage.setItem(KEY, JSON.stringify(sv)); } catch (e) { /* storage unavailable */ } }
    function heroineOpen(h) { return !!(h && getProg().cleared[h.level]); }                    // she is unlocked by clearing her level
    function openHeroines() { return DUO ? DUO.heroines.filter(heroineOpen) : []; }
    function curHeroine() { if (!DUO) return null; const o = openHeroines(), h = DUO.byId(duoSave().p2); return heroineOpen(h) ? h : (o[0] || null); }
    function heroSheets(h, only) {
        const out = h.sv || (h.sv = {});
        (only || Object.keys(SV)).forEach(function (k) {
            if (out[k]) return;
            const real = h.sheets && h.sheets[k], a = Object.assign({}, real || SV[k], real ? {} : SV[k].orig || {}); a.total = a.dur.reduce(function (x, y) { return x + y; }, 0); out[k] = a;
            const im = new Image();
            im.onload = function () {
                let src = im;
                if (!real) {                                           // PLACEHOLDER: the main character's sheet painted in her colour, until her own GIFs are in
                    const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
                    const g = c.getContext("2d"); g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = h.tint; g.fillRect(0, 0, c.width, c.height); src = c;
                }
                a.img = shrink(a, src, !!real);                         // the heroines' own sheets are about twice as big as they are drawn: shrink them once so the game stays smooth
            };
            im.src = a.src;
        });
        return out;
    }
    function makePlayers() {
        const h = NQ.on ? NQ.hero : MODE === 2 ? curHeroine() : null, l = [newPlayer(0, SV)];
        if (h) { const p2 = newPlayer(1, heroSheets(h)); p2.h = h; l.push(p2); }
        return l;
    }

    // ---------- level select ----------
    function showSelect() {
        if (netSelect()) return;
        running = false; paused = false; ended = false;
        ["hud", "pause", "over", "clear"].forEach(function (id) { $(id).hidden = true; });
        $("select").hidden = false; bgimg.style.display = "none"; ctx.clearRect(0, 0, VW, VH);
        const p = getProg();
        $("cards").innerHTML = LEVELS.map(function (L) {
            const open = L.n <= p.unlocked, done = !!p.cleared[L.n];
            const st = done ? "&#10003; CLEARED" : open ? "5 waves + boss" : "";
            return '<button class="lc ' + L.cls + (open ? "" : " locked") + (done ? " cleared" : "") + '" data-n="' + L.n + '">' +
                '<div class="th" style="background-image:url(' + DIR + L.thumb + ')"></div>' +
                (open ? "" : '<div class="lock">&#128274;</div><div class="lockt">' + (L.n >= LOCK_FROM ? "LOCKED - coming soon" : "Clear Level " + (L.n - 1) + " to unlock") + '</div>') +
                '<div class="tx"><div class="nm">LEVEL ' + L.n + '</div><h3>' + L.name + '</h3><span class="df">' + L.diff + '</span><div class="st">' + st + '</div></div></button>';
        }).join("");
        AUD("stop");                                              // no background music in Monster Survival (the sound effects stay)
        duoBar();
    }
    // ---------- level select: 1 player / 2 players + the Player 2 character picker ----------
    function duoBar() {
        const bar = $("duo"); if (!DUO) { bar.hidden = true; $("duo-panel").hidden = true; return; }
        const open = openHeroines(), h = curHeroine(), mode = duoSave().mode === 2 && open.length ? 2 : 1, two = $("duo-2");
        bar.hidden = false; two.classList.toggle("locked", !open.length); two.innerHTML = open.length ? "2 PLAYERS" : "&#128274; 2 PLAYERS";
        $("duo-1").classList.toggle("on", mode === 1); two.classList.toggle("on", mode === 2);
        $("duo-chars").textContent = "PLAYER 2 CHARACTERS (" + open.length + "/" + DUO.heroines.length + ")";
        $("duo-note").textContent = !open.length ? "Clear Level 1 to unlock your first Player 2 character." : mode === 2 ? "Player 2: " + h.name + (BOT ? " (played by the computer)" : "") : "";
    }
    let duoAnim = 0;
    function duoPanel() {
        const cur = curHeroine();
        $("duo-cards").innerHTML = DUO.heroines.map(function (h) {
            const open = heroineOpen(h), sel = open && cur === h;
            return '<button class="hc' + (open ? "" : " locked") + (sel ? " sel" : "") + '" data-id="' + h.id + '" style="--c:' + h.color + '"><canvas width="200" height="276"></canvas><div class="hn">' + (open ? h.name : "???") + '</div><div class="hs">' +
                (open ? (sel ? "&#10003; PLAYER 2" : "TAP TO SELECT") : "&#128274; Clear Level " + h.level + " to unlock") + "</div></button>";
        }).join("");
        $("duo-panel").hidden = false;
        cancelAnimationFrame(duoAnim);
        const cards = [].slice.call($("duo-cards").children);
        (function tick(t) {
            if ($("duo-panel").hidden) return;
            cards.forEach(function (b) {
                const h = DUO.byId(b.dataset.id), a = heroSheets(h, ["run"]).run, c = b.firstChild, g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
                if (!a || !a.img) return;
                const f = frameAt(a, t), k = (c.height - 16) / (a.fh * 0.95);
                g.save(); g.translate(c.width / 2, c.height - 8); g.scale(-k, k); g.drawImage(a.img, (f % a.cols) * a.fw, Math.floor(f / a.cols) * a.fh, a.fw, a.fh, -a.ax, -a.gy, a.fw, a.fh);
                if (b.classList.contains("locked")) { g.globalCompositeOperation = "source-atop"; g.fillStyle = "#0b1030"; g.fillRect(-c.width, -c.height * 2, c.width * 2, c.height * 3); }          // locked: only her silhouette
                g.restore();
            });
            duoAnim = requestAnimationFrame(tick);
        })(0);
    }
    if (DUO) {
        $("duo-1").addEventListener("click", function () { setDuo({ mode: 1 }); duoBar(); });
        $("duo-2").addEventListener("click", function () {
            if (!openHeroines().length) { SFX("deny"); $("duo-2").animate([{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 220 }); return; }
            setDuo({ mode: 2, p2: curHeroine().id }); duoBar();
        });
        $("duo-chars").addEventListener("click", duoPanel);
        $("duo-close").addEventListener("click", function () { $("duo-panel").hidden = true; cancelAnimationFrame(duoAnim); duoBar(); });
        $("duo-cards").addEventListener("click", function (e) {
            const b = e.target.closest(".hc"); if (!b) return; const h = DUO.byId(b.dataset.id);
            if (!heroineOpen(h)) { SFX("deny"); b.animate([{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 220 }); return; }
            setDuo({ p2: h.id }); SFX("item"); duoPanel();
        });
    }
    $("cards").addEventListener("click", function (e) {
        const b = e.target.closest(".lc"); if (!b) return;
        const n = +b.dataset.n;
        if (n > getProg().unlocked) { SFX("deny"); b.animate([{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 220 }); return; }
        if (NQ.on && NQ.host && !NQ.hero) { toast("WAITING FOR PLAYER 2...", 1500); return; }
        startLevel(n);
    });
    $("sel-back").addEventListener("click", goHome);
    if (DUO) { $("vs-btn").hidden = false; $("vs-btn").addEventListener("click", function () { location.href = "versus.html?from=sv"; }); }       // 1 VS 1 (web version only)

    // ---------- the level ----------
    function layoutBg() {
        if (!lv) return;
        bgimg.style.width = lv.w * K * Z + "px"; bgimg.style.height = lv.h * K * Z + "px"; bgimg.style.imageRendering = lv.px ? "pixelated" : "auto";
        bgimg.style.transform = "translate(" + (-cam.x * K * Z) + "px," + (-cam.y * K * Z) + "px)";
    }
    function setProgress(wave, frac) {                          // wave 1..5, frac 0..1 inside that wave
        const f = Math.max(0, Math.min(1, ((wave - 1) + (frac || 0)) / WAVES));
        $("wfill").style.width = f * 100 + "%";
        $("wtext").textContent = "WAVE " + wave + " / " + WAVES + (wave === WAVES ? "  •  BOSS" : "");
        [].forEach.call($("wnodes").children, function (n, i) { n.classList.toggle("on", f >= (i + 1) / WAVES - 1e-6); });
    }
    function toast(t, ms) { if (NQ.on && NQ.host) NQ.q.push(["m", t, ms || 0]); const el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove("on"); }, ms || 1800); }
    function setHp(p) {
        p = p || me; const f = Math.max(0, p.hp) / HP_MAX, two = p.pid === 1;
        $(two ? "hpfill2" : "hpfill").style.width = f * 100 + "%"; $(two ? "hptxt2" : "hptxt").textContent = p.dead ? "DEAD" : Math.max(0, Math.ceil(p.hp)); $(two ? "hp2" : "hp").classList.toggle("low", f < 0.3 && !p.dead); $(two ? "hp2" : "hp").classList.toggle("dead", !!p.dead);
    }
    function startLevel(n) {
        lv = LEVELS[n - 1]; MODE = NQ.on || (DUO && duoSave().mode === 2 && curHeroine()) ? 2 : 1; PL = makePlayers(); NQ.q = []; netStart(n); me = PL[0]; keys = me.keys; paused = false; ended = false; mons = []; fx = []; shake = 0; hitStop = 0; slowT = 0; pks = []; dis = []; ring = null; spk = []; flm = []; wnd = []; shots = []; wfx = []; wcd = me.wcd;
        S = { kills: 0, t: 0, hurt: 0, coins: 0, gems: 0, combo: 0, comboT: 0, best: 0, tgt: null, tgtT: 0, f: { shield: 0, rage: 0, lucky: 0, freeze: 0, magnet: 0, wind: 0 } };
        refreshAmmo(); $("hud").classList.toggle("duo", twoP()); $("hp2").hidden = !twoP(); if (window.RMX) RMX.vis.two = twoP(); $("keys").innerHTML = keyHint(); $("lcoin").textContent = 0; $("lgem").textContent = 0; $("combo").hidden = true; $("target").hidden = true; $("warn").classList.remove("on"); $("shock").hidden = true; clearTimeout(bossWarn.t); $("bw").hidden = true; PL.forEach(function (q) { setEn(q); }); setTimeout(drawPortrait, 60); setTimeout(drawPortrait, 600);
        $("select").hidden = true; ["pause", "over", "clear"].forEach(function (id) { $(id).hidden = true; }); $("hud").hidden = false; $("boss").hidden = true;
        AUD("music", "survival");                                 // silent unless you add visuals/audio/music/survival.* (see sounds.js)
        bgimg.style.display = "block";
        if (window.RUNMIL_PERF) bgimg.onload = function () {            // light mode: an animated 2048 px background is too heavy for phones, use a still of it
            if (bgimg.dataset.still === "1") return; const u = RUNMIL_still(bgimg); if (u) { bgimg.dataset.still = "1"; bgimg.src = u; }
        };
        bgimg.dataset.still = ""; bgimg.src = DIR + lv.file;
        $("lvname").innerHTML = "LEVEL " + lv.n + "<small>" + lv.name + " &bull; " + lv.diff + "</small>";
        $("wnodes").innerHTML = [1, 2, 3, 4, 5].map(function (i) { return '<b class="' + (i === WAVES ? "boss" : "") + '" style="left:' + (i / WAVES * 100) + '%">' + (i === WAVES ? "&#128128;" : i) + "</b>"; }).join("");
        setProgress(1, 0); PL.forEach(function (p) { setHp(p); }); setTimeout(drawPortrait2, 80); setTimeout(drawPortrait2, 700);
        $("keys").style.opacity = 1; clearTimeout(startLevel.kt); startLevel.kt = setTimeout(function () { $("keys").style.opacity = 0.35; }, 6000);
        Z = lv.zoom || 1; WW = VW / Z; WH = VH / Z; layoutBg();
        const cx0 = PL.reduce(function (a, p) { return a + p.x; }, 0) / PL.length, cy0 = PL.reduce(function (a, p) { return a + p.y; }, 0) / PL.length;
        cam.x = Math.max(0, Math.min(lv.w - WW, cx0 - WW / 2)); cam.y = Math.max(0, Math.min(lv.h - WH, cy0 - WH * 0.7));
        resize();
        wv = NQ.on && !NQ.host ? { n: 1, st: "run", t: 0, q: [], total: 1, killed: 0 } : lv.waves ? { n: 0, st: "intro", t: 1.6, q: [], total: 1, killed: 0 } : null;                   // levels without monsters yet = free roam
        if (lv.waves) toast("LEVEL " + lv.n, 1500); else toast("Monsters for this level are coming soon!", 2600);

        running = true; last = performance.now(); requestAnimationFrame(loop);
    }

    // ---------- waves ----------
    function beginWave(n) {
        wv.n = n; wv.st = "run"; wv.t = 0; wv.killed = 0; wv.boss = null;
        const cm = lv.cm || 1;                                                    // cm: share of the planned monsters that really come (difficulty tuning)
        wv.q = lv.waves[n - 1].map(function (g) { const ty = g[1].filter(function (t, i) { return MD[t].boss || i === 0 || Math.random() < (n === WAVES ? cm * 0.6 : cm); }); return { at: g[0], types: ty }; });
        const bag = [], nxt = function () { if (!bag.length) { const a = lv.types.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } Array.prototype.push.apply(bag, a); } return bag.pop(); };
        wv.q.forEach(function (g) { g.types = g.types.map(function (t) { return MD[t].boss ? t : nxt(); }); });   // every monster of the level shows up in every wave, in equal shares (a shuffled bag is dealt out)
        wv.total = 0; wv.q.forEach(function (g) { wv.total += g.types.length; });
        setProgress(n, 0);
        if (n !== WAVES) toast("WAVE " + n, 1700); if (n === WAVES) { let bt = "boss"; lv.waves[n - 1].forEach(function (g) { g[1].forEach(function (t) { if (MD[t].boss) bt = t; }); }); bossWarn(NAMES[bt] || "THE BOSS", 3600); wv.t = -3.4; }          // the boss steps in after the alarm
    }
    function spawn(type) {
        const d = MD[type], y0 = lv.h * lv.band[0], y1 = lv.h * lv.band[1], dir = Math.random() < 0.5 ? 1 : -1;     // dir: which way it walks across
        const x = dir > 0 ? Math.max(-80, cam.x - 90 - Math.random() * 60) : Math.min(lv.w + 80, cam.x + WW + 90 + Math.random() * 60);
        const hp0 = d.boss ? d.hp : Math.max(1, Math.round(d.hp * (lv.hm || 1)));
        const m = { t: type, d: d, x: x, y: y0 + Math.random() * (y1 - y0), dir: dir, face: dir, hp: hp0, max: hp0, st: "walk", at: 0, cd: 0.6 + Math.random(), wt: Math.random() * 500, kb: 0, flash: 0, dieT: 0, z: d.fly ? 80 : 0, ph: Math.random() * 6, hitP: false, id: ++spawn.n };
        mons.push(m);
        if (d.boss) { wv.boss = m; const nm = $("boss").querySelector("span"); if (nm) nm.innerHTML = "&#128128; " + (NAMES[type] || "THE BOSS"); $("boss").hidden = false; $("bossfill").style.width = "100%"; if (!monArrive(m)) SFX("arrive_big"); }
        else if (!monArrive(m)) SFX(type === "bat" || type === "birdy" ? "arrive_fly" : "arrive");
        return m;
    }
    spawn.n = 0;
    const alive = () => mons.filter(function (m) { return m.st !== "die"; });
    function updateWaves(dt) {
        if (!wv) return;
        if (wv.st === "intro") { wv.t -= dt; if (wv.t <= 0) beginWave(1); return; }
        if (wv.st === "pause") { wv.t -= dt; if (wv.t <= 0) beginWave(wv.n + 1); return; }
        if (wv.st !== "run") return;
        wv.t += dt;
        mons.forEach(function (m) { if (m.hp <= 0 && m.st !== "die") kill(m); });                                   // nothing with 0 life stays standing
        const al = alive();
        if (wv.q.length) {
            const nxt = wv.q[0];
            if (!al.length && wv.n < WAVES && nxt.at - wv.t > 2.5) wv.t = nxt.at - 2.5;                             // nothing left on the field: the next group comes sooner
            if (nxt.at <= wv.t) { wv.q.shift(); nxt.types.forEach(spawn); if (nxt.types.length >= 4 && wv.n < WAVES) warn("A HUGE WAVE OF MONSTERS IS APPROACHING!", 2800); }
        }
        if (wv.n === WAVES && wv.boss) setProgress(WAVES, 1 - Math.max(0, wv.boss.hp) / wv.boss.max);
        else setProgress(wv.n, wv.killed / wv.total);
        const bossDone = wv.n === WAVES && wv.boss && (wv.boss.hp <= 0 || wv.boss.st === "die");
        if (bossDone) mons.forEach(function (m) { if (m.st !== "die" && !m.d.boss) kill(m, true); });
        if (bossDone || (wv.n < WAVES && !wv.q.length && !alive().length)) {
            if (wv.n >= WAVES) { levelClear(); return; }
            PL.forEach(function (p) {                                          // a breather between waves (a fallen partner stands up again)
                if (p.dead && twoP()) { p.dead = 0; p.deadT = 0; p.hp = 40; p.inv = 2; p.act = null; setHp(p); floatText("BACK UP!", p.x, p.y - 190, "#7dff8a"); SFX("item"); }
                else if (p.hp > 0) { p.hp = Math.min(HP_MAX, p.hp + 25); setHp(p); floatText("+25 HP", p.x, p.y - 190, "#7dff8a"); }
            });
            wv.st = "pause"; wv.t = 2.4; setProgress(wv.n, 1); toast("WAVE " + wv.n + " CLEARED!", 1900); SFX("victory");
        }
    }

    // ---------- input ----------
    // every key -> [player, the key name the movement code already knows]. 1 player: the keys you know. 2 players: the layouts below.
    const KM1 = { KeyA: [0, "KeyA"], KeyD: [0, "KeyD"], KeyW: [0, "KeyW"], KeyS: [0, "KeyS"], KeyC: [0, "KeyC"], Space: [0, "Space"], KeyP: [0, "KeyP"], KeyK: [0, "KeyK"], KeyL: [0, "KeyL"] };
    const KM2 = {
        KeyA: [0, "KeyA"], KeyD: [0, "KeyD"], KeyW: [0, "KeyW"], KeyS: [0, "KeyS"], KeyC: [0, "KeyC"], Space: [0, "Space"], KeyR: [0, "KeyP"], KeyF: [0, "KeyK"], KeyE: [0, "KeyL"],            // player 1
        ArrowLeft: [1, "KeyA"], ArrowRight: [1, "KeyD"], ArrowUp: [1, "KeyW"], ArrowDown: [1, "KeyS"], KeyO: [1, "KeyC"], KeyM: [1, "Space"], KeyP: [1, "KeyP"], KeyK: [1, "KeyK"], KeyL: [1, "KeyL"]   // player 2
    };
    const KMN = Object.assign({}, KM1, { KeyR: [0, "KeyP"], KeyF: [0, "KeyK"], KeyE: [0, "KeyL"] });     // two devices: every phone / keyboard drives its own character
    function KMAP() { return NQ.on ? KMN : BOT ? KM1 : twoP() ? KM2 : KM1; }
    function keyHint() {
        if (BOT) return "";
        if (!twoP()) return '<b>A</b><b>D</b> run &bull; <b>W</b><b>S</b> up / down &bull; <b>SPACE</b> jump &bull; <b>C</b> duck &bull; <b>P</b> punch &bull; <b>K</b> kick &bull; <b>L</b> special &bull; <b>1</b>-<b>4</b> weapons &bull; <b>B</b> aabb';
        return '<div><i class="p1">P1</i> <b>A</b><b>D</b><b>W</b><b>S</b> move &bull; <b>SPACE</b> jump &bull; <b>C</b> duck &bull; <b>R</b> punch &bull; <b>F</b> kick &bull; <b>E</b> special &bull; <b>1-4</b> weapons</div>' +
            '<div><i class="p2">P2</i> <b>&#9664;</b><b>&#9654;</b><b>&#9650;</b><b>&#9660;</b> move &bull; <b>M</b> jump &bull; <b>O</b> duck &bull; <b>P</b> punch &bull; <b>K</b> kick &bull; <b>L</b> special &bull; <b>NUM 1-4</b> weapons &bull; <b>B</b> aabb</div>';
    }
    addEventListener("keydown", function (e) {
        if (window.RMX && running && !ended && RMX.vis.key(e)) return;          // B = AABB vision
        if (e.code === "Escape") { if (running && !ended) { e.preventDefault(); togglePause(); } return; }
        if (!running || paused || ended) return;
        if (NQ.on && !NQ.host) { const g = KMN[e.code], w = /^(Digit|Numpad)[1-4]$/.test(e.code); if (g || w) e.preventDefault(); if (e.repeat) return; if (g) nsend({ t: "k", c: g[1], d: 1 }); else if (w) nsend({ t: "k", c: "Digit" + e.code.slice(-1), d: 1 }); return; }
        const m = KMAP()[e.code], wk = /^(Digit|Numpad)[1-4]$/.test(e.code);
        if (m || wk) e.preventDefault();
        if (e.repeat) return;
        if (m) {
            const p = PL[m[0]]; if (!p) return;
            p.keys[m[1]] = true;
            as(p, function () { if (m[1] === "Space") jump(); else if (m[1] === "KeyP") attack("punch"); else if (m[1] === "KeyK") attack("kick"); else if (m[1] === "KeyL") special(); });
        } else if (wk) {                                                           // number row = player 1, number pad = player 2 (alone: both work for you)
            const p = !NQ.on && twoP() && e.code.slice(0, 6) === "Numpad" ? PL[1] : PL[0];
            as(p, function () { useWeapon(+e.code.slice(-1) - 1); });
        }
    });
    addEventListener("keyup", function (e) { if (NQ.on && !NQ.host) { const g = KMN[e.code]; if (g) nsend({ t: "k", c: g[1], d: 0 }); return; } const m = KMAP()[e.code]; if (m && PL[m[0]]) PL[m[0]].keys[m[1]] = false; });
    addEventListener("blur", function () { if (NQ.on && !NQ.host) nsend({ t: "clr" }); resetKeys(); });
    function jump() { if (me.z <= 0 && !me.act && !keys.KeyC && !me.dead) { me.vz = JUMP_V; me.airT = 0; SFX("jump"); } }
    function attack(k) {
        if (me.act || me.z > 0 || me.duck || me.dead) return;
        if (!me.sv[k]) return;
        me.act = { k: k, t: 0, dur: ATK[k].ms * (S.f.rage > 0 ? 0.72 : 1), hit: [] }; SFX("swing", k);
    }

    // ---------- pause / home ----------
    function togglePause() { if (NQ.on) { $("pause").hidden = !$("pause").hidden; return; } paused = !paused; $("pause").hidden = !paused; if (!paused) { last = performance.now(); resetKeys(); } }
    $("pausebtn").addEventListener("click", togglePause);
    $("resume").addEventListener("click", togglePause);
    $("tolevels").addEventListener("click", function () { if (NQ.on && !NQ.host) { $("pause").hidden = true; toast("THE HOST PICKS THE LEVEL", 1500); return; } showSelect(); });
    function goHome() { netLeave(); if (window.parent !== window) parent.postMessage("runmil:home", "*"); else location.href = "index.html?menu"; }
    $("quit").addEventListener("click", goHome);
    $("retry").addEventListener("click", function () { if (NQ.on && !NQ.host) return; startLevel(lv.n); });
    $("over-levels").addEventListener("click", function () { if (NQ.on && !NQ.host) return; showSelect(); });
    $("over-home").addEventListener("click", goHome);
    $("clear-levels").addEventListener("click", function () { if (NQ.on && !NQ.host) return; showSelect(); });
    $("clear-home").addEventListener("click", goHome);
    $("next").addEventListener("click", function () { if (NQ.on && !NQ.host) return; startLevel(Math.min(4, lv.n + 1)); });


    // ---------- fighter HUD: portrait, energy, target bar, combo, warning banner ----------
    let heroPv = null;
    function drawPortrait() {
        const c = $("portrait"); if (!c.getContext) return;
        if (window.RunMilHero && RunMilHero.view) {                // the same avatar as in Character Customization / the main menu (follows the chosen character + outfit)
            if (!heroPv) heroPv = RunMilHero.view(c, { head: true }); else heroPv.draw(); return;
        } const g = c.getContext("2d"), a = SV.run;
        g.clearRect(0, 0, 60, 60); g.fillStyle = "#24388c"; g.fillRect(0, 0, 60, 60);
        if (a && a.img) { const q = a.fh * 0.27; g.imageSmoothingEnabled = false; g.drawImage(a.img, a.ax - q / 2 - a.fw * 0.05, 0, q, q, 0, 0, 60, 60); }       // the head of the character (with the saved outfit)
    }
    function drawPortrait2() {
        const c = $("portrait2"), p = PL[1]; if (!p || !c.getContext) return;
        const g = c.getContext("2d"), a = p.sv.run; g.clearRect(0, 0, 120, 120); g.fillStyle = p.h ? p.h.color : "#a03a7a"; g.fillRect(0, 0, 120, 120);
        if (p.h && p.h.face) {                                      // a heroine with a profile picture shows her face here
            if (!p.h._faceImg) { p.h._faceImg = new Image(); p.h._faceImg.onload = drawPortrait2; p.h._faceImg.src = p.h.face; }
            if (p.h._faceImg.complete && p.h._faceImg.naturalWidth) { g.drawImage(p.h._faceImg, 0, 0, 120, 120); return; }
        }
        if (a && a.img) { const q = a.fh * 0.27; g.imageSmoothingEnabled = false; g.drawImage(a.img, a.ax - q / 2 - a.fw * 0.05, 0, q, q, 0, 0, 120, 120); }
    }
    function drawTargetPortrait(m) {
        const c = $("tport"), g = c.getContext("2d"), a = SVM[m.t] && SVM[m.t].walk; g.clearRect(0, 0, 44, 44);
        if (a && a.img) { const k = Math.min(40 / a.fw, 40 / a.fh); g.drawImage(a.img, 0, 0, a.fw, a.fh, 22 - a.fw * k / 2, 22 - a.fh * k / 2, a.fw * k, a.fh * k); }
    }
    const NAMES = { rat: "RAT", bat: "BAT", boss: "THE BOSS", art: "KILLER CLOWN", spider: "SPIDER", pigt: "SCOUT PIG", claw: "CLAW KILLER", eye: "EYE STALKER", blob: "BLOB", gang: "ZOMBIE GANG", eyeboss: "THE EYE KING", saw: "CHAINSAW KILLER", mask: "GHOST MASK", pigf: "BRAWLER PIG", pigk: "FORK PIG", girl: "DOLL GIRL", birdy: "HARPY", cow: "THE COWGIRL", roach: "ROACH", drag: "DRAGON", zomb: "ZOMBIE", fur: "PURPLE BEAST", frog: "FROG", clown: "THE CLOWN" };
    function target(m) { if (m.d.boss) return; if (S.tgt !== m) { S.tgt = m; drawTargetPortrait(m); $("tname").textContent = NAMES[m.t] || m.t; } S.tgtT = 3; $("target").hidden = false; }
    function setEn(p) {                                           // every player has their own energy bar (P1 top left, P2 under the P2 portrait)
        p = p || me; const f = Math.max(0, Math.min(100, p.en || 0)), two = p.pid === 1, k = two ? "2" : "", rdy = !p.dead && f >= (p.h && p.h.special === "flames" ? 10 : 100);
        $("enfill" + k).style.width = f + "%"; $("enbar" + k).classList.toggle("full", rdy); $("entxt" + k).textContent = rdy ? (two ? "L!" : twoP() ? "E!" : "L!") : "";
    }
    function addEn(n) { me.en = Math.min(100, (me.en || 0) + n); setEn(me); }
    function addCombo() {
        S.combo++; S.comboT = 2.2; S.best = Math.max(S.best, S.combo);
        const el = $("combo"); if (S.combo >= 2) { el.hidden = false; $("cnum").textContent = S.combo; el.className = (S.combo >= 20 ? "t3" : S.combo >= 10 ? "t2" : "t1"); void el.offsetWidth; el.classList.add("pop"); }
        if (S.combo % 10 === 0) { addEn(25); floatText(S.combo + " HITS!", me.x, me.y - 215, "#ff9a2a"); }
    }
    // the boss alarm: siren lights, hazard bars, the shocked face and the boss name, with a siren sound and a screen shake
    function bossWarn(name, ms) {
        const el = $("bw"); if (!el) return;
        const tk = "\u26A0 WARNING \u26A0 BOSS INCOMING ".repeat(8); el.querySelectorAll(".bw-tick span").forEach(function (s) { s.textContent = tk; });
        $("bw-name").textContent = name; el.style.setProperty("--d", (ms / 1000) + "s");
        el.hidden = true; void el.offsetWidth; el.hidden = false;
        shake = Math.max(shake, 0.45); clearTimeout(bossWarn.s); bossWarn.s = setTimeout(function () { shake = Math.max(shake, 0.4); if (!(window.RunMilAudio && RunMilAudio.has("sfx", "boss_warn"))) SFX("boom"); }, 650);
        if (window.RunMilAudio && RunMilAudio.has("sfx", "boss_warn")) SFX("boss_warn"); else { SFX("boom"); siren(ms / 1000); }        // your own alarm sound, if you added one
        clearTimeout(bossWarn.t); bossWarn.t = setTimeout(function () { el.hidden = true; }, ms);
    }
    function siren(sec) {                                         // a rising/falling alarm made with WebAudio (stays silent if the browser blocks audio)
        try {
            const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; siren.c = siren.c || new AC(); const c = siren.c; if (c.state === "suspended") c.resume();
            const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime; o.type = "sawtooth"; o.connect(g); g.connect(c.destination);
            g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.1); g.gain.setValueAtTime(0.07, t0 + sec - 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t0 + sec - 0.05);
            for (let t = 0; t < sec; t += 0.6) { o.frequency.setValueAtTime(520, t0 + t); o.frequency.linearRampToValueAtTime(900, t0 + t + 0.3); o.frequency.linearRampToValueAtTime(520, t0 + t + 0.6); }
            o.start(t0); o.stop(t0 + sec);
        } catch (e) { /* audio is optional */ }
    }
    function warn(t, ms, boss) {
        if (NQ.on && NQ.host) NQ.q.push(["w", t, ms || 0, boss ? 1 : 0]);
        if (boss) { bossWarn(t, ms); return; }
        const el = $("warn"), sh = $("shock"); el.textContent = t; el.classList.add("on"); el.classList.toggle("boss", !!boss);
        if (boss) { sh.hidden = false; sh.src = "visuals/survival/shock.webp?" + Date.now(); } else sh.hidden = true;                 // the shocked face pops up with the boss warning
        clearTimeout(warn.t); warn.t = setTimeout(function () { el.classList.remove("on"); sh.hidden = true; }, ms || 2600);
    }
    function disSfx(k) { const n = "dis_" + k, RA = window.RunMilAudio; return RA && RA.has && RA.has("sfx", n) ? n : "boom"; }       // your disaster sound if you added one
    const FLAME_COST = 10;
    function flameImg(h) { if (!h.fx._img) { h.fx._img = new Image(); h.fx._img.src = h.fx.src; } return h.fx._img; }
    function flameBlast() {
        if (me.fcd > 0) return;
        if ((me.en || 0) < FLAME_COST) { floatText("NO ENERGY", me.x, me.y - 200, "#9ab0ff"); me.fcd = 0.25; return; }
        me.en = Math.max(0, me.en - FLAME_COST); setEn(me); me.fcd = 0.12; shake = Math.max(shake, 0.07);
        flm.push({ x: me.x + me.face * 34, y: me.y, z: 104, face: me.face, t: 0, hit: [], h: me.h }); SFX(disSfx("fireball"));
    }
    function updateFlames(dt) {                                  // each blast is a stream of fire from her hand; it is a moving AABB and kills what it touches
        if (!flm.length) return;
        flm.forEach(function (f) {
            f.t += dt; const fx = f.h.fx, k = Math.min(1, 0.3 + f.t / 0.2 * 0.7), w = fx.fw * k * 0.9;
            mons.forEach(function (m) {
                if (m.st === "die" || f.hit.indexOf(m.id) >= 0 || Math.abs(m.y - f.y) > 46) return;
                const b = bodyBox(m), bx = f.face > 0 ? f.x : f.x - w; if (!hit(bx, -(f.z + 52), w, 104, b[0], b[1], b[2], b[3], "FLAME", "atk", f.y)) return;
                f.hit.push(m.id); if (!m.d.boss) { m.kb = f.face * 300; m.down = 0.8; m.dn = f.face; } hurtMon(m, spDmg(m), "#ff9a3a"); spark(m.x, m.y - 60 - m.z, "#ffb84a", 8);
            });
        });
        flm = flm.filter(function (f) { return f.t < 0.6; });
    }
    const WIND_LIFE = 1.5, WIND_SPEED = 430, WATER_LIFE = 1.3, WATER_SPEED = 560, WATER_GAP = 75;
    function updateWind(dt) {                                    // the whirlwind is a moving AABB: everything it touches is killed (a boss only loses life)
        if (!wnd.length) return;
        wnd.forEach(function (w) {
            w.t += dt; w.x += w.face * (w.water ? WATER_SPEED : WIND_SPEED) * dt; const k = w.water ? 1 : Math.min(1, 0.4 + w.t / 0.25 * 0.6), bw = (w.water ? 130 : 150) * k, bh = (w.water ? 170 : 190) * k;
            mons.forEach(function (m) {
                if (m.st === "die" || w.hit.indexOf(m.id) >= 0 || Math.abs(m.y - w.y) > 90) return;
                const b = bodyBox(m); if (!hit(w.x - bw / 2, -bh, bw, bh, b[0], b[1], b[2], b[3], w.water ? "WATER" : "WIND", "atk", w.y)) return;
                w.hit.push(m.id); if (!m.d.boss) { m.kb = w.face * (w.water ? 330 : 460); m.down = w.water ? 0.7 : 0.8; m.dn = w.face; } hurtMon(m, spDmg(m), w.water ? "#6ec3ff" : "#bfe8ff"); spark(m.x, m.y - 60 - m.z, w.water ? "#9fd8ff" : "#d8f4ff", 8);
            });
        });
        wnd = wnd.filter(function (w) { return w.t < (w.water ? WATER_LIFE : WIND_LIFE); });
    }
    function drawWind() {
        wnd.forEach(function (w) {
            const fx = w.h.fx, im = flameImg(w.h); if (!im.complete || !im.naturalWidth) return;
            if (w.water) {                                           // CHARM: a tidal wave - the splash of the sprite bursts out of the ground one after another along the way
                const x0 = w.x - w.face * WATER_SPEED * w.t, kk = 0.62, al = Math.min(1, (WATER_LIFE - w.t) / 0.3);
                ctx.save(); ctx.globalAlpha = Math.max(0, al);
                for (let i = 0; i * WATER_GAP <= WATER_SPEED * WATER_LIFE; i++) {
                    const tk = w.t - i * WATER_GAP / WATER_SPEED; if (tk < 0) break; const fr = Math.floor(tk / (fx.ms / 1000)); if (fr >= fx.n) continue;
                    ctx.drawImage(im, fr * fx.fw, 0, fx.fw, fx.fh, x0 + w.face * i * WATER_GAP - cam.x - fx.fw * kk / 2, w.y - cam.y - fx.fh * kk + 8, fx.fw * kk, fx.fh * kk);
                }
                ctx.restore(); return;
            }
            const k = Math.min(1, 0.4 + w.t / 0.25 * 0.6) * 0.95, fr = Math.floor(w.t / (fx.ms / 1000)) % fx.n, al = Math.min(1, (WIND_LIFE - w.t) / 0.3);
            ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.translate(w.x - cam.x, w.y - cam.y);
            ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, 70 * k, 14 * k, 0, 0, 7); ctx.fill();
            ctx.drawImage(im, fr * fx.fw, 0, fx.fw, fx.fh, -fx.fw * k / 2, -fx.fh * k - 8, fx.fw * k, fx.fh * k); ctx.restore();
        });
    }
    function drawFlames() {
        flm.forEach(function (f) {
            const fx = f.h.fx, im = flameImg(f.h); if (!im.complete || !im.naturalWidth) return;
            const k = Math.min(1, 0.3 + f.t / 0.2 * 0.7), fr = Math.floor(f.t / (fx.ms / 1000)) % fx.n, al = Math.min(1, (0.6 - f.t) / 0.15);
            ctx.save(); ctx.globalAlpha = al; ctx.translate(f.x - cam.x, f.y - cam.y - f.z); if (f.face < 0) ctx.scale(-1, 1);
            ctx.drawImage(im, fr * fx.fw, 0, fx.fw, fx.fh, 0, -fx.fh * k / 2, fx.fw * k, fx.fh * k); ctx.restore();
        });
    }
    function special() {                                          // the blue bar is full: a heroine uses her own special, everybody else (the main character) a big burst around them
        if (me.dead || ended || paused) return;
        if (me.h && me.h.special === "flames") { flameBlast(); return; }              // MICHA: a blast of fire per key press, each press uses a little energy
        if ((me.en || 0) < 100) return;
        me.en = 0; setEn(me); shake = 0.35; me.inv = Math.max(me.inv, 0.8);
        if (me.h && me.h.special === "wind") {                    // MARV: a big whirlwind rolls out in front of her and blows every monster it touches away
            wnd.push({ x: me.x + me.face * 70, y: me.y, face: me.face, t: 0, hit: [], h: me.h }); toast("WIND BLAST!", 1000); SFX(disSfx("tornado")); return;
        }
        if (me.h && me.h.special === "water") {                   // CHARM: a tidal wave rolls out along the ground in front of her and washes every monster it touches away
            wnd.push({ x: me.x + me.face * 50, y: me.y, face: me.face, t: 0, hit: [], h: me.h, water: 1 }); toast("TIDAL WAVE!", 1000); SFX(disSfx("tornado")); return;
        }
        if (me.h && (me.h.special === "land" || me.h.special === "spikes")) {                  // SHAI: LAND POWER - the earth erupts from the ground in every direction
            spk.push({ x: me.x, y: me.y, t: 0, hit: [], dmg: 5, n: me.h.special === "land" ? 10 : window.RUNMIL_PERF ? 12 : 16, col: me.h.color, land: me.h.special === "land", h: me.h }); toast(me.h.special === "land" ? "LAND POWER!" : "SPIKES!", 1000); SFX(disSfx("tornado")); return;
        }
        ring = { x: me.x, y: me.y, r: 0, t: 0, hit: [], dmg: 4, big: 1, kill: 1 }; toast("SPECIAL!", 1000); SFX(disSfx("shockwave"));      // a SPECIAL kills every monster it touches (a boss only loses life)
    }

    // ---------- combat ----------
    // a monster's own sound: visuals/audio/sfx/<monster>_1.mp3, _2 ... (bosses use the rat's sounds). Returns true when one played.
    const DIE = { roach: "die_insect", spider: "die_insect", bat: "die_screech", birdy: "die_screech", art: "die_beast", claw: "die_beast", fur: "die_beast", pigt: "die_beast", pigf: "die_beast", pigk: "die_beast", drag: "die_dragon", mask: "die_groan", gang: "die_groan", zomb: "die_groan", girl: "die_groan", saw: "die_metal", eye: "die_squelch", blob: "die_squelch" };
    function voiceList(key) { const RA = window.RunMilAudio, l = []; if (RA && RA.has) for (let i = 1; i <= 8; i++) if (RA.has("sfx", key + "_" + i)) l.push(i); return l; }
    function monVoice(m, force, own) {                           // own = only the monster's own recording (no fallback)
        const RA = window.RunMilAudio; if (!RA || !RA.has) return false;
        let key = m.t, list = voiceList(key);
        if (!list.length) { if (own && !m.d.boss) return false; if (!m.d.boss && (LEVELS[0].types.indexOf(m.t) >= 0 || RA.has("sfx", m.t + "_attack"))) return false;   // Level 1 monsters keep their built-in sounds, not the general monster sound
            key = m.d.boss ? "rat" : "monster"; list = voiceList(key); }      // bosses: the rat's sounds; others: the general monster sound
        if (!list.length) return false;
        const cd = m.d.boss ? 0.8 : key === "monster" ? 0.3 : 0.45; S.vt = S.vt || {};
        if (!force && (S.vt[key] || -9) > S.t - cd) return false;
        S.vt[key] = S.t; SFX(key + "_" + list[(Math.random() * list.length) | 0]); return true;
    }
    function monAttack(m) {                                      // <monster>_attack: plays only when the monster starts its attack
        const RA = window.RunMilAudio, nm = m.t + "_attack"; if (!RA || !RA.has || !RA.has("sfx", nm)) return monVoice(m);
        S.vt = S.vt || {}; if ((S.vt[nm] || -9) > S.t - 0.45) return true; S.vt[nm] = S.t; SFX(nm); return true;
    }
    function monArrive(m) {                                      // the sound a monster makes when it shows up (<monster>_arrive); true if it has one
        const RA = window.RunMilAudio, nm = m.t + "_arrive"; if (!RA || !RA.has || !RA.has("sfx", nm)) return false;
        S.vt = S.vt || {}; if ((S.vt[nm] || -9) > S.t - 2.5) return true; S.vt[nm] = S.t; SFX(nm); return true;
    }
    function spark(x, y, col, n, sz) { if (NQ.on && NQ.host) NQ.q.push(["p", Math.round(x), Math.round(y), col, n, sz || 0]); for (let i = 0; i < n; i++) fx.push({ k: "p", x: x, y: y, vx: (Math.random() - 0.5) * 380, vy: -Math.random() * 300, l: 0.5, c: col, sz: sz || 5 }); }
    function blood(x, y, n, dir) { if (NQ.on && NQ.host) NQ.q.push(["b", Math.round(x), Math.round(y), n, dir || 0]); for (let i = 0; i < n; i++) fx.push({ k: "p", x: x, y: y, vx: (dir || 0) * (80 + Math.random() * 220) + (Math.random() - 0.5) * 240, vy: -Math.random() * 380, l: 0.45 + Math.random() * 0.4, c: Math.random() < 0.5 ? "#b3121f" : "#6e0a14", sz: 4 + Math.random() * 5 }); }
    function burst(x, y, r) { if (NQ.on && NQ.host) NQ.q.push(["x", Math.round(x), Math.round(y), r || 0]); fx.push({ k: "b", x: x, y: y, a: Math.random() * 3, l: 0.17, max: 0.17, r: r || 46 }); }       // star-shaped impact flash
    function slash(x, y, ang) { if (NQ.on && NQ.host) NQ.q.push(["l", Math.round(x), Math.round(y), Math.round(ang * 100) / 100]); fx.push({ k: "s", x: x, y: y, a: ang, l: 0.16 }); }
    function floatText(t, x, y, col) { if (NQ.on && NQ.host) NQ.q.push(["t", t, Math.round(x), Math.round(y), col || ""]); fx.push({ k: "t", s: t, x: x, y: y, l: 0.9, c: col || "#fff" }); }
    function bodyBox(m) { const d = m.d; return [m.x - d.hw, -(m.z + d.h), d.hw * 2, d.h]; }            // x, y(up is negative), w, h  (y is height above the ground)
    function kill(m, quiet) {
        if (m.st === "die") return;
        m.st = "die"; m.dieT = 0; S.kills++; if (wv && !m.d.boss) wv.killed++;
        if (m.d.boss) { slowT = 0.9; burst(m.x, m.y - m.d.h * 0.5 - m.z, 150); }
        else {                                                    // the monster is launched away from the player, spinning, and bounces once
            const dir = m.x < me.x ? -1 : 1; m.flash = 0.2; m.stun = 0; m.down = 0;
            m.dvx = dir * (250 + Math.random() * 140); m.dvz = 430 + Math.random() * 170; m.dvr = dir * (9 + Math.random() * 5); m.rot = 0; m.bn = 0; m.kb = 0;
            burst(m.x, m.y - m.d.h * 0.5 - m.z, 70); shake = Math.max(shake, 0.12);
        }
        spark(m.x, m.y - 50, m.d.boss ? "#b6ff4a" : "#ff4a5a", m.d.boss ? 30 : 6); blood(m.x, m.y - 50 - m.z, m.d.boss ? 40 : 18, 0);
        if (!quiet) SFX(m.d.boss ? "boom" : "kill");
        if (!quiet && !monVoice(m, true, true) && !m.d.boss && DIE[m.t]) SFX(DIE[m.t]);           // its own recording, otherwise a death sound that fits its kind
        if (m.d.boss) shake = 0.5;
        if (!quiet) drop(m);
        try { const s = rawSave(); s.totals = s.totals || {}; s.totals.monsters = (s.totals.monsters | 0) + 1; localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
    }
    function playerHits(dt) {                                    // the punch / kick box against every monster body box (Java AABB)
        const a = me.act; if (!a) return;
        const A = ATK[a.k], sc = a.dur / A.ms; if (a.t < A.w[0] * sc || a.t > A.w[1] * sc) return;
        const ax = me.face > 0 ? me.x + 8 : me.x - 8 - A.reach, ay = -(me.z + A.zhi), aw = A.reach, ah = A.zhi - A.zlo;
        mons.forEach(function (m) {
            if (m.st === "die" || a.hit.indexOf(m.id) >= 0 || Math.abs(m.y - me.y) > m.d.lane) return;
            const b = bodyBox(m);
            if (!hit(ax, ay, aw, ah, b[0], b[1], b[2], b[3], a.k === "kick" ? "KICK" : "PUNCH", "atk", m.y)) return;
            const dmg = A.dmg * (S.f.rage > 0 ? 2 : 1); a.hit.push(m.id); m.hp -= dmg; m.flash = 0.12; if (!m.d.boss) { m.kb = (m.x < me.x ? -1 : 1) * 320; if (m.st === "atk") { m.st = "walk"; m.cd = 0.8; } }
            const dir = m.x < me.x ? -1 : 1;
            hitStop = Math.max(hitStop, a.k === "kick" ? 0.075 : 0.05); shake = Math.max(shake, a.k === "kick" ? 0.12 : 0.06); burst(m.x, m.y - m.d.h * 0.55 - m.z, a.k === "kick" ? 62 : 46);
            m.hitT = 0.28; m.hd = dir; monVoice(m); if (!m.d.boss) m.stun = a.k === "kick" ? 0.35 : 0.24;
            spark(m.x, m.y - 60 - m.z, "#ffd24a", 5); blood(m.x, m.y - 60 - m.z, m.d.boss ? 6 : 9, dir); slash(m.x, m.y - 60 - m.z, a.k === "kick" ? -0.5 * dir : 0.4 * dir);
            floatText("-" + dmg, m.x, m.y - m.d.h - m.z - 6, S.f.rage > 0 ? "#ff7a3a" : "#ffd24a"); SFX("impact", a.k);
            if (a.k === "kick" && !m.d.boss) { m.down = 0.6; m.dn = dir; m.st = "walk"; m.cd = 0.9; }                 // a kick knocks small monsters down
            addCombo(); addEn(a.k === "kick" ? 9 : 6); target(m); m.hurtT = 3;
            if (m.hp <= 0) kill(m);
        });
    }
    function hurtPlayer(m) {
        if (me.inv > 0 || me.dead) return;
        if (S.f.shield > 0) { me.inv = 0.5; spark(me.x, me.y - 90 - me.z, "#7ad8ff", 8); floatText("BLOCKED", me.x, me.y - 190, "#7ad8ff"); SFX("impact", "punch"); return; }
        S.combo = 0; S.comboT = 0; $("combo").hidden = true; addEn(4);
        me.lastHit = strikeRec; me.hp -= Math.max(1, Math.round(m.d.dmg * (lv.dm || 1) * (m.d.boss ? 0.8 : 1))); me.inv = 1.0; me.kx = (me.x < m.x ? -1 : 1) * 320; me.act = null; S.hurt++; shake = Math.max(shake, 0.22);
        spark(me.x, me.y - 90 - me.z, "#ff4a5a", 8); floatText("-" + m.d.dmg, me.x, me.y - 190, "#ff6a6a"); SFX("impact", "kick"); setHp();
        const f = $("flash"); f.classList.add("on"); setTimeout(function () { f.classList.remove("on"); }, 90);
        if (me.hp <= 0 && S.f.wind) { S.f.wind = 0; me.hp = HP_MAX * 0.5; me.inv = 2.5; setHp(); toast("SECOND WIND!", 1600); spark(me.x, me.y - 90, "#7dff8a", 24); SFX("item"); }
        else if (me.hp <= 0) { me.hp = 0; me.dead = 1; setHp(); if (twoP() && !PL.every(function (q) { return q.dead; })) { toast((me.pid ? "PLAYER 2" : "PLAYER 1") + " IS NOW DEAD", 1600); SFX("over"); } else { toast("YOU ARE NOW DEAD", 1500); setTimeout(function () { if (PL.every(function (q) { return q.dead; })) gameOver(); }, 1600); SFX("over"); } }
    }
    let strikeRec = null;
    function monsterStrike(m) {                                  // the monster's attack box against the player's body box (Java AABB)
        const d = m.d, bx = m.face > 0 ? m.x + 6 : m.x - 6 - d.reach, by = -d.zhi, bw = d.reach, bh = d.zhi - d.zlo;
        const ph = me.duck ? DUCK : STAND;
        if (Math.abs(m.y - me.y) > d.lane + 8) return;
        const px = me.x - HALF_W, py = -(me.z + ph), pw = HALF_W * 2;
        if (hit(bx, by, bw, bh, px, py, pw, ph, (NAMES[m.t] || m.t).toUpperCase() + " ATTACK", "hit", m.y)) {
            strikeRec = { A: { x: bx, y: by, w: bw, h: bh }, B: { x: px, y: py, w: pw, h: ph }, ground: 0, an: (NAMES[m.t] || m.t) + " attack box", bn: "You (" + (me.duck ? "ducking" : "standing") + ")",
                extra: [{ t: "Same lane: |monster y - your y| = <b>" + Math.round(Math.abs(m.y - me.y)) + "</b> is within the monster's lane size (" + Math.round(d.lane + 8) + ")", ok: true }],
                note: "Heights are measured from the ground (0), so up is negative. The attack box only exists during the monster's strike frames." };
            hurtPlayer(m);
        }
    }
    function updateMon(m, dt) {
        const d = m.d;
        m.flash = Math.max(0, m.flash - dt); m.cd -= dt; m.ph += dt; m.hitT = Math.max(0, (m.hitT || 0) - dt);
        if (m.st === "die") {
            m.dieT += dt;
            if (!m.d.boss) {                                      // flying away: gravity, one bounce, then it lies still and fades
                m.x += m.dvx * dt; m.z += m.dvz * dt; m.dvz -= 1700 * dt; m.rot += m.dvr * dt;
                if (m.z <= 0 && m.dvz < 0) {
                    m.z = 0;
                    if (m.bn < 1) { m.bn++; m.dvz = -m.dvz * 0.38; m.dvx *= 0.6; m.dvr *= 0.5; spark(m.x, m.y - 6, "#c9c2b0", 7); SFX("thud"); }
                    else { m.dvz = 0; m.dvx *= Math.pow(0.02, dt); m.dvr = 0; }
                }
            }
            return;
        }
        if (S.f.freeze > 0) return;                              // frozen in time
        m.slow = Math.max(0, (m.slow || 0) - dt); const sp = m.slow > 0 ? 0.5 : 1; dt *= sp;
        if (d.fly) m.z = 80 + Math.sin(m.ph * 3) * 16;
        if (m.kb) { m.x += m.kb * dt; m.kb *= Math.pow(0.002, dt); if (Math.abs(m.kb) < 8) m.kb = 0; }
        if (m.stun > 0) { m.stun -= dt; if (m.st === "atk") { m.st = "walk"; m.cd = 0.6; } return; }      // staggered by a hit
        if (m.down > 0) { m.down -= dt; return; }                  // knocked down: out of the fight for a moment
        const dx = me.x - m.x, dy = me.y - m.y;
        if (m.st === "walk") {
            m.wt += dt * 1000;
            if (d.boss) {                                        // the boss walks up to you
                m.face = dx > 0 ? 1 : -1;
                if (Math.abs(dx) > d.aggro * 0.62) m.x += Math.sign(dx) * d.speed * dt;
                if (Math.abs(dy) > 14) m.y += Math.sign(dy) * d.speed * 0.8 * dt;
            } else {                                             // the others just keep passing by, drifting a little towards your lane
                m.x += m.dir * d.speed * dt; m.face = m.dir;
                if (Math.abs(dx) < 560 && Math.abs(dy) > 8) m.y += Math.sign(dy) * 32 * dt;
                if (m.x < -110 && m.dir < 0) m.dir = 1; else if (m.x > lv.w + 110 && m.dir > 0) m.dir = -1;
            }
            m.y = Math.max(lv.h * lv.band[0], Math.min(lv.h * lv.band[1], m.y));
            if (m.cd <= 0 && !me.dead && Math.abs(dx) <= d.aggro && Math.abs(dy) <= d.lane) {           // the player is near: attack!
                m.st = "atk"; m.at = 0; m.hitP = false; monAttack(m); m.face = dx > 0 ? 1 : -1;
            }
        } else if (m.st === "atk") {
            m.at += dt * 1000;
            const A = SVM[m.t].atk, f = Math.min(A.n - 1, Math.floor(m.at / d.atkMs * A.n));
            if (f >= d.strike[0] && f <= d.strike[1]) { if (!d.boss) m.x += m.face * 90 * dt; monsterStrike(m); }
            if (m.at >= d.atkMs) { m.st = "walk"; m.cd = d.cd + Math.random() * 0.6; }
        }
    }


    // ---------- drops: nothing / coin / gem / sack of coins / power-up ----------
    function bank(c, g) {                                        // coins + gems go straight into the save, so the menu shows them
        if (NQ.on && NQ.host) NQ.q.push(["k", c, g]);
        S.coins += c; S.gems += g; $("lcoin").textContent = S.coins; $("lgem").textContent = S.gems;
        try { const sv = rawSave(); if (c) sv.coins = (sv.coins == null ? 1250 : sv.coins) + c; if (g) sv.gems = (sv.gems == null ? 50 : sv.gems) + g; localStorage.setItem(KEY, JSON.stringify(sv)); } catch (e) { /* storage unavailable */ }
    }
    function addPk(k, x, y, pu) {
        const y0 = lv.h * lv.band[0], y1 = lv.h * lv.band[1];
        pks.push({ k: k, pu: pu, x: Math.max(60, Math.min(lv.w - 60, x)), y: Math.max(y0, Math.min(y1, y)), age: 0, life: 15, ph: Math.random() * 6, z0: 18 });
    }
    function drop(m) {
        if (m.d.boss) { addPk("sack", m.x - 60, m.y); addPk("gem", m.x, m.y + 14); addPk("gem", m.x + 40, m.y - 12); addPk("pu", m.x + 90, m.y, rollPU()); addPk("pu", m.x - 110, m.y + 8, rollPU()); return; }
        if (PL.some(function (p) { return !p.dead && p.hp < HP_MAX * 0.5; }) && Math.random() < 0.2) { addPk("pu", m.x, m.y, "health_pack"); return; }               // hurt? a health pack drops more often
        const L = S.f.lucky > 0, r = Math.random(), cut = L ? [0.08, 0.38, 0.46, 0.60] : [0.22, 0.55, 0.60, 0.70];    // none | coin | gem | sack | power-up
        if (r < cut[0]) return;
        if (r < cut[1]) addPk("coin", m.x, m.y); else if (r < cut[2]) addPk("gem", m.x, m.y); else if (r < cut[3]) addPk("sack", m.x, m.y); else addPk("pu", m.x, m.y, rollPU());
    }
    function collect(p) {
        const L = S.f.lucky > 0 ? 2 : 1;
        if (p.k === "coin") { bank(5 * L, 0); floatText("+" + 5 * L, p.x, p.y - 70, "#ffd24a"); SFX("coin", 0); }
        else if (p.k === "gem") { bank(0, 1); floatText("+1 gem", p.x, p.y - 70, "#7ad8ff"); SFX("gem"); }
        else if (p.k === "sack") { bank(30 * L, 0); floatText("+" + 30 * L, p.x, p.y - 70, "#ffd24a"); SFX("coin", 6); }
        else applyPU(p.pu);
        spark(p.x, p.y - 40, "#fff", 6);
    }
    function updatePicks(dt) {
        pks.forEach(function (p) { p.age += dt; p.life -= dt; });
        PL.forEach(function (pl) {
            if (pl.dead && twoP()) return;
            as(pl, function () {
                const pb = [me.x - HALF_W - 16, -(me.z + STAND), (HALF_W + 16) * 2, STAND];
                pks.forEach(function (p) {
                    if (p.life <= 0) return;
                    if (S.f.magnet > 0) { const dx = me.x - p.x, dy = me.y - p.y, d = Math.hypot(dx, dy); if (d < 520 && d > 4) { p.x += dx / d * 560 * dt; p.y += dy / d * 560 * dt; } }
                    if (Math.abs(p.y - me.y) <= 40 && hit(pb[0], pb[1], pb[2], pb[3], p.x - 26, -(p.z0 + 54), 52, 54, "POWER-UP", "pick")) { p.life = -1; p.got = 1; collect(p); }
                });
            });
        });
        pks = pks.filter(function (p) { return p.life > 0; });
    }
    pks.f = 0;


    // ---------- shop weapons (the stock you bought in the equipment shop; every shot uses one, and Free Ammo adds more) ----------
    const WEAPONS = [{ id: "pencil", cd: 0.30, code: "Digit1" }, { id: "ruler", cd: 0.70, code: "Digit2" }, { id: "laser", cd: 1.00, code: "Digit3" }, { id: "blast", cd: 1.20, code: "Digit4" }];
    let shots = [], wfx = [], wcd = {}, wam = {};
    function refreshAmmo() { const a = (rawSave().items || {}).ammo || {}; WEAPONS.forEach(function (w) { wam[w.id] = a[w.id] | 0; }); }
    function useWeapon(i) {
        const w = WEAPONS[i]; if (!w || !S || me.dead || ended || paused || !lv.waves) return;
        if (wam[w.id] <= 0 || wcd[w.id] > 0) return;
        wam[w.id]--; wcd[w.id] = w.cd; SFX(w.id);
        try { const sv = rawSave(); sv.items = sv.items || {}; sv.items.ammo = Object.assign({}, sv.items.ammo); sv.items.ammo[w.id] = wam[w.id]; sv.totals = sv.totals || {}; sv.totals.weapons = (sv.totals.weapons | 0) + 1; localStorage.setItem(KEY, JSON.stringify(sv)); } catch (e) { /* storage unavailable */ }
        const f = me.face, x = me.x + f * 44, h = me.z + 92;
        if (w.id === "pencil") shots.push({ k: "pencil", x: x, y: me.y, h: h, vx: 950 * f, a: f > 0 ? 0 : Math.PI, w: 40, hh: 18, life: 1.2, dmg: 2, hit: [] });
        else if (w.id === "ruler") shots.push({ k: "ruler", x: x, y: me.y, h: h - 10, vx: 640 * f, a: 0, w: 80, hh: 36, life: 0.95, dmg: 3, hit: [] });
        else if (w.id === "blast") shots.push({ k: "blast", x: x, y: me.y, h: h, vx: 560 * f, a: 0, w: 40, hh: 40, life: 1.3, dmg: 8, hit: [] });
        else {                                                    // laser: an instant beam across the lane in front of you
            const L = 900, ax = f > 0 ? me.x : me.x - L; wfx.push({ k: "laser", x: me.x, y: me.y, h: me.z + 92, f: f, t: 0.32, T: 0.32 }); shake = Math.max(shake, 0.1);
            mons.forEach(function (m) { if (m.st === "die" || Math.abs(m.y - me.y) > m.d.lane) return; const b = bodyBox(m); if (hit(ax, -(me.z + 135), L, 120, b[0], b[1], b[2], b[3], "LASER BEAM", "atk")) hurtMon(m, 7, "#7affff"); });
        }
    }
    function explode(x, y, h) {
        SFX("boom"); shake = Math.max(shake, 0.25); wfx.push({ k: "boom", x: x, y: y, h: h, t: 0.35, T: 0.35 }); spark(x, y - h, "#ffb040", 22, 6);
        mons.forEach(function (m) { if (m.st === "die" || Math.abs(m.y - y) > 110) return; const b = bodyBox(m); if (hit(x - 150, -(h + 110), 300, 220, b[0], b[1], b[2], b[3])) { if (!m.d.boss) { m.kb = (m.x < x ? -1 : 1) * 420; } hurtMon(m, 8, "#ffb040"); } });
    }
    function updateShots(dt) {
        PL.forEach(function (p) { WEAPONS.forEach(function (w) { if (p.wcd[w.id] > 0) p.wcd[w.id] -= dt; }); });
        wfx.forEach(function (f) { f.t -= dt; }); wfx = wfx.filter(function (f) { return f.t > 0; });
        shots.forEach(function (sh) {
            sh.x += sh.vx * dt; sh.life -= dt; if (sh.k === "ruler") sh.a += dt * 22;
            for (let n = 0; n < mons.length && sh.life > 0; n++) {
                const m = mons[n]; if (m.st === "die" || sh.hit.indexOf(m.id) >= 0 || Math.abs(m.y - sh.y) > m.d.lane + 8) continue;
                const b = bodyBox(m); if (!hit(sh.x - sh.w / 2, -(sh.h + sh.hh / 2), sh.w, sh.hh, b[0], b[1], b[2], b[3], sh.k.toUpperCase() + " SHOT", "atk", sh.y)) continue;
                if (sh.k === "blast") { sh.life = 0; sh.done = 1; explode(sh.x, sh.y, sh.h); break; }
                sh.hit.push(m.id); if (!m.d.boss) m.kb = (sh.vx > 0 ? 1 : -1) * 200; hurtMon(m, sh.dmg, sh.k === "ruler" ? "#ffe9a0" : "#ffd24a"); SFX("impact", "punch");
                if (sh.k === "pencil") sh.life = 0;
            }
            if (sh.k === "blast" && sh.life <= 0 && !sh.done) { sh.done = 1; if (!sh.exp) explode(sh.x, sh.y, sh.h); }          // flew out of range: explodes at the end
            if (sh.x < -60 || sh.x > lv.w + 60) { sh.life = 0; sh.done = 1; }
        });
        shots = shots.filter(function (sh) { return sh.life > 0; });
    }
    function wArt(k) {
        if (k === "pencil") { ctx.fillStyle = "#ffd24a"; ctx.fillRect(-24, -5, 44, 10); ctx.fillStyle = "#e0a000"; ctx.fillRect(-24, -1, 44, 2); ctx.fillStyle = "#f0c890"; ctx.beginPath(); ctx.moveTo(20, -5); ctx.lineTo(33, 0); ctx.lineTo(20, 5); ctx.fill(); ctx.fillStyle = "#2a2a3a"; ctx.beginPath(); ctx.moveTo(28, -1.8); ctx.lineTo(33, 0); ctx.lineTo(28, 1.8); ctx.fill(); ctx.fillStyle = "#c8c8d8"; ctx.fillRect(-27, -5, 4, 10); ctx.fillStyle = "#ff8fb0"; ctx.fillRect(-34, -5, 7, 10); }
        else if (k === "ruler") { ctx.fillStyle = "#f4e3b0"; ctx.fillRect(-40, -9, 80, 18); ctx.strokeStyle = "#8a6a20"; ctx.lineWidth = 2; ctx.strokeRect(-40, -9, 80, 18); ctx.fillStyle = "#5a4010"; for (let i = -36; i <= 36; i += 8) ctx.fillRect(i, -9, 1.6, i % 16 === 0 ? 9 : 5); }
        else if (k === "laser") { ctx.fillStyle = "#3a3f66"; ctx.fillRect(-26, -8, 34, 18); ctx.fillRect(-20, 6, 12, 18); ctx.fillStyle = "#6a72b0"; ctx.fillRect(8, -5, 24, 10); ctx.fillStyle = "#7affff"; ctx.fillRect(30, -3, 6, 6); ctx.fillStyle = "#ff4a5a"; ctx.fillRect(-16, -4, 8, 6); }
        else { const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22); g.addColorStop(0, "#fff"); g.addColorStop(0.4, "#ffd24a"); g.addColorStop(1, "rgba(255,90,20,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill(); }
    }
    function drawShots() {
        wfx.forEach(function (f) {
            const k = f.t / f.T, sx = f.x - cam.x, sy = f.y - cam.y - f.h;
            ctx.save();
            if (f.k === "laser") {
                const x0 = f.f > 0 ? sx : sx - 900, g = ctx.createLinearGradient(0, sy - 18, 0, sy + 18);
                ctx.globalAlpha = Math.min(1, k * 1.6); g.addColorStop(0, "rgba(120,255,255,0)"); g.addColorStop(0.5, "#9affff"); g.addColorStop(1, "rgba(120,255,255,0)");
                ctx.fillStyle = g; ctx.fillRect(x0, sy - 18, 900, 36); ctx.fillStyle = "#fff"; ctx.fillRect(x0, sy - 3, 900, 6);
            } else {
                const r = 30 + 130 * (1 - k), g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
                ctx.globalAlpha = Math.min(1, k * 1.4); g.addColorStop(0, "#fff"); g.addColorStop(0.35, "#ffd24a"); g.addColorStop(0.7, "rgba(255,110,30,.7)"); g.addColorStop(1, "rgba(255,60,0,0)");
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
            }
            ctx.restore();
        });
        shots.forEach(function (sh) {
            ctx.save(); ctx.translate(sh.x - cam.x, sh.y - cam.y - sh.h);
            if (sh.k === "blast") { const d = sh.vx > 0 ? -1 : 1; ctx.globalAlpha = 0.35; ctx.translate(26 * d, 0); wArt("blast"); ctx.translate(-13 * d, 0); ctx.globalAlpha = 0.6; wArt("blast"); ctx.translate(-13 * d, 0); ctx.globalAlpha = 1; wArt("blast"); }
            else { ctx.rotate(sh.a); wArt(sh.k); }
            ctx.restore();
        });
    }
    const TOUCHUI = !!window.RUNMIL_NATIVE || (window.matchMedia && matchMedia("(pointer: coarse)").matches) || /[?&]touch=1/.test(location.search);
    function drawWeaponHud(p2) {
        const s = 50, gap = 8, x = p2 ? VW - 14 - s : 14, W = p2 ? PL[1].wcd : PL[0].wcd;
        WEAPONS.forEach(function (w, i) {
            const y = 196 + i * (s + gap), a = wam[w.id] | 0, cd = W[w.id] > 0 ? W[w.id] / w.cd : 0;
            ctx.save(); ctx.beginPath(); ctx.rect(x, y, s, s); ctx.fillStyle = "rgba(8,12,44,.82)"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = a > 0 ? "#4a6cff" : "#555"; ctx.stroke(); ctx.clip();
            ctx.save(); ctx.translate(x + s / 2, y + s / 2 - 2); ctx.scale(a > 0 ? 0.65 : 0.55, a > 0 ? 0.65 : 0.55); ctx.globalAlpha = a > 0 ? 1 : 0.35; wArt(w.id); ctx.restore();
            if (cd > 0) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x, y, s, s * cd); }
            ctx.font = "700 15px Teko, Impact, sans-serif"; ctx.textBaseline = "top"; ctx.lineWidth = 4; ctx.strokeStyle = "#0a0a28"; ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.strokeText((p2 ? "N" : "") + String(i + 1), x + 5, y + 2); ctx.fillText((p2 ? "N" : "") + String(i + 1), x + 5, y + 2);
            ctx.font = "700 20px Teko, Impact, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillStyle = a > 0 ? "#ffd24a" : "#ff6a6a"; ctx.strokeText(String(a), x + s - 4, y + s); ctx.fillText(String(a), x + s - 4, y + s);
            ctx.restore();
        });
    }

    // ---------- power-ups ----------
    // a SPECIAL kills every normal monster outright, but a boss only loses a part of its life (a quarter of its max, at least 8)
    function spDmg(m) { return m.d.boss ? Math.max(8, Math.ceil(m.max * 0.25)) : Math.max(1, Math.ceil(m.hp)); }
    function hurtMon(m, n, col) {                                // damage from a power-up (the hit itself is checked with the Java AABB below)
        if (m.st === "die") return;
        m.hp -= n; m.flash = 0.12; m.hitT = 0.28; monVoice(m); m.hd = m.x < me.x ? -1 : 1; burst(m.x, m.y - m.d.h * 0.55 - m.z, 36); spark(m.x, m.y - 50 - m.z, col || "#ffd24a", 4); floatText("-" + n, m.x, m.y - m.d.h - m.z - 6, col || "#ffd24a");
        if (m.hp <= 0) kill(m);
    }
    function applyPU(k) {
        const d = PUS[k]; toast(d.n + "!", 1400); SFX(d.dis || k === "shockwave" ? disSfx(k) : "item");
        if (k === "health_pack") { me.hp = Math.min(HP_MAX, me.hp + 35); setHp(); floatText("+35", me.x, me.y - 190, "#7dff8a"); }
        else if (k === "shield") S.f.shield = 8;
        else if (k === "mango_rage") S.f.rage = 15;
        else if (k === "lucky_charm") S.f.lucky = 20;
        else if (k === "freeze_time") S.f.freeze = 5;
        else if (k === "banana_magnet") S.f.magnet = 15;
        else if (k === "second_wind") S.f.wind = 1;
        else if (k === "shockwave") { ring = { x: me.x, y: me.y, r: 0, t: 0, hit: [] }; shake = 0.3; }
        else if (k === "free_ammo") {
            try { const sv = rawSave(); sv.items = sv.items || {}; sv.items.ammo = sv.items.ammo || {}; [["pencil", 6], ["ruler", 4], ["laser", 2], ["blast", 2]].forEach(function (a) { sv.items.ammo[a[0]] = (sv.items.ammo[a[0]] | 0) + a[1]; }); localStorage.setItem(KEY, JSON.stringify(sv)); } catch (e) { /* storage unavailable */ }
            refreshAmmo(); floatText("weapons restocked!", me.x, me.y - 190, "#7dff8a");
        }
        else if (k === "tornado") {                                  // three tornadoes, spread over the pathway, drifting different ways
            const yl = lv.h * lv.band[0], yh = lv.h * lv.band[1], cy = function (v) { return Math.max(yl, Math.min(yh, v)); };
            [[90, 0, 1, 0], [-330, -85, -1, 0.35], [520, 85, 1, 0.7]].forEach(function (o) {
                dis.push({ k: k, t: 5, tick: 0, x: Math.max(80, Math.min(lv.w - 80, me.x + me.face * o[0])), y: cy(me.y + o[1]), dir: me.face * o[2], age: o[3], sc: 0.95 });
            });
        }
        else if (k === "landspikes") {                               // many spike patches, scattered around the player
            const yl = lv.h * lv.band[0], yh = lv.h * lv.band[1];
            for (let i = 0; i < 7; i++) {
                const side = i % 2 ? -1 : 1, dist = 170 + Math.floor(i / 2) * 230 + Math.random() * 60;
                dis.push({ k: k, t: 3.2 + i * 0.05, tick: 0.05 + i * 0.09, x: Math.max(120, Math.min(lv.w - 120, me.x + me.face * side * dist)), y: yl + (yh - yl) * ((i * 0.37 + 0.1) % 1), age: i * 0.12, sc: 0.62 });
            }
        }
        else if (k === "fireball") dis.push({ k: k, t: 4.5, tick: 0.3, age: 0 });
        else if (k === "acidrain") dis.push({ k: k, t: 5, tick: 0.2, age: 0 });
    }
    function updateDis(dt) {
        dis.forEach(function (d) {
            d.t -= dt; d.age += dt; d.tick -= dt;
            const tick = d.tick <= 0;
            if (d.k === "tornado") {
                d.x = Math.max(60, Math.min(lv.w - 60, d.x + d.dir * 190 * dt)); if (d.x <= 60 || d.x >= lv.w - 60) d.dir *= -1;
                mons.forEach(function (m) { if (m.st !== "die" && Math.abs(m.y - d.y) <= 80 && Math.abs(m.x - d.x) < 300 && !m.d.boss) m.x += Math.sign(d.x - m.x) * 140 * dt; });          // pulls the small ones in
                if (tick) { d.tick = 0.35; mons.forEach(function (m) { const b = bodyBox(m); if (Math.abs(m.y - d.y) <= 80 && hit(d.x - 55, -230, 110, 230, b[0], b[1], b[2], b[3])) hurtMon(m, 1, "#9ad0ff"); }); }
            } else if (d.k === "landspikes") {
                if (tick) { d.tick = 0.7; mons.forEach(function (m) { const b = bodyBox(m); if (Math.abs(m.y - d.y) <= 80 && hit(d.x - 160, -110, 320, 110, b[0], b[1], b[2], b[3])) hurtMon(m, 3, "#c8a070"); }); shake = Math.max(shake, 0.12); }
            } else if (d.k === "fireball" || d.k === "acidrain") {
                const fire = d.k === "fireball";
                if (tick) { d.tick = fire ? 0.6 : 0.5; mons.forEach(function (m) { const b = bodyBox(m); if (hit(cam.x, -500, WW, 500, b[0], b[1], b[2], b[3])) { hurtMon(m, fire ? 2 : 1, fire ? "#ff9a2a" : "#9cff4a"); if (!fire) m.slow = 1.0; } }); }
            }
        });
        dis = dis.filter(function (d) { return d.t > 0; });
        updateSpikes(dt); updateFlames(dt); updateWind(dt);
        if (ring) {
            ring.t += dt; ring.r = Math.min(1, ring.t / 0.55) * (ring.big ? 520 : 380);
            mons.forEach(function (m) {
                if (m.st === "die" || ring.hit.indexOf(m.id) >= 0 || Math.abs(m.y - ring.y) > 90) return;
                const b = bodyBox(m); if (!hit(ring.x - ring.r, -220, ring.r * 2, 220, b[0], b[1], b[2], b[3])) return;
                ring.hit.push(m.id); if (!m.d.boss) { m.kb = (m.x < ring.x ? -1 : 1) * 520; m.down = 0.7; m.dn = m.x < ring.x ? -1 : 1; } hurtMon(m, ring.kill ? spDmg(m) : ring.dmg || 3, "#ffe27a");
            });
            if (ring.t > 0.7) ring = null;
        }
    }

    // ---------- update + draw ----------
    function stepPlayer(p, dt) {
        p.inv = Math.max(0, p.inv - dt); p.fcd = Math.max(0, p.fcd - dt); p.deadT = p.dead ? p.deadT + dt : 0;
        if (p.act) { p.act.t += dt * 1000; if (p.act.t >= p.act.dur) p.act = null; }
        p.duck = !p.dead && !!keys.KeyC && p.z <= 0 && !p.act;
        p.duckT = p.duck ? p.duckT + dt * 1000 : 0;
        let dx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), dy = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
        const can = !p.act && !p.duck && !p.dead;
        p.moving = can && (dx || dy);
        if (can && dx) p.face = dx > 0 ? 1 : -1;
        if (p.moving) { const n = Math.hypot(dx, dy); p.x += dx / n * SPEED * dt; p.y += dy / n * SPEED * dt; p.runT += dt * 1000; } else p.runT = 0;
        if (p.kx) { p.x += p.kx * dt; p.kx *= Math.pow(0.003, dt); if (Math.abs(p.kx) < 8) p.kx = 0; }
        p.x = Math.max(70, Math.min(lv.w - 70, p.x));
        p.y = Math.max(lv.h * lv.band[0], Math.min(lv.h * lv.band[1], p.y));          // the pathway only
        if (p.z > 0 || p.vz > 0) { p.airT += dt; p.vz -= GRAV * dt; p.z += p.vz * dt; if (p.z <= 0) { if (p.airT > 0.22) SFX("land"); p.z = 0; p.vz = 0; } }
    }
    function update(dt) {
        if (hitStop > 0) { hitStop -= dt; dt *= 0.04; } else if (slowT > 0) { slowT -= dt; dt *= 0.3; }      // impact freeze / boss slow-motion
        S.t += dt;
        if (BOT && !NQ.on && PL[1]) botThink(PL[1], dt);
        PL.forEach(function (p) { as(p, function () { stepPlayer(p, dt); }); });
        ['shield', 'rage', 'lucky', 'freeze', 'magnet'].forEach(function (k) { S.f[k] = Math.max(0, S.f[k] - dt); });
        PL.forEach(function (p) { as(p, function () { playerHits(dt); }); });
        mons.forEach(function (m) { const keep = me; me = nearest(m); try { updateMon(m, dt); } finally { me = keep; } });          // a monster goes for the player closest to it
        updateShots(dt);
        updatePicks(dt); updateDis(dt);
        mons = mons.filter(function (m) { return !(m.st === "die" && m.dieT > 1.1); });
        updateWaves(dt);
        fx.forEach(function (f) { f.l -= dt; if (f.k === "p") { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 900 * dt; } else if (f.k === "t") f.y -= 40 * dt; });
        fx = fx.filter(function (f) { return f.l > 0; });
        shake = Math.max(0, shake - dt);
        if (S.combo > 0) { S.comboT -= dt; if (S.comboT <= 0) { S.combo = 0; $("combo").hidden = true; } else $("combo").classList.toggle("fade", S.comboT < 0.7); }
        if (S.tgt) { const m = S.tgt; S.tgtT -= dt; $("tfill").style.width = Math.max(0, m.hp / m.max) * 100 + "%"; if (S.tgtT <= 0 || (m.st === "die" && m.dieT > 0.5)) { S.tgt = null; $("target").hidden = true; } }
        const fol = PL.filter(function (q) { return !q.dead; }), F = fol.length ? fol : PL;
        const mx = F.reduce(function (a, q) { return a + q.x; }, 0) / F.length, my = F.reduce(function (a, q) { return a + q.y; }, 0) / F.length;
        const tx = Math.max(0, Math.min(lv.w - WW, mx - WW / 2)), ty = Math.max(0, Math.min(lv.h - WH, my - WH * 0.7)), k = 1 - Math.pow(0.001, dt);
        cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
        if (twoP()) PL.forEach(function (q) { q.x = Math.max(cam.x + 50, Math.min(cam.x + WW - 50, q.x)); });
        if (wv && wv.boss && wv.boss.st !== "die") $("bossfill").style.width = Math.max(wv.boss.hp > 0 ? 2 : 0, wv.boss.hp / wv.boss.max * 100) + "%";
        else if (wv && wv.boss) { $("bossfill").style.width = "0%"; }
        if (wv && wv.boss) { const bt = document.getElementById("bosshp"); if (bt) bt.textContent = Math.max(0, Math.ceil(wv.boss.hp)) + " / " + wv.boss.max; }
    }
    function pick(p) {
        const SV = p.sv || window.RUNMIL_SV || {};
        if (p.dead) return [SV.run, 0];
        if (p.act && SV[p.act.k]) { const a = SV[p.act.k]; return [a, Math.min(a.n - 1, Math.floor(p.act.t / p.act.dur * a.n))]; }   // the whole move is squeezed into the fast attack time
        if ((p.z > 0 || p.vz > 0) && SV.jump) return [SV.jump, Math.min(SV.jump.n - 1, Math.floor(Math.min(1, p.airT / AIR) * SV.jump.n))];
        if (p.duck && SV.crouch) return [SV.crouch, frameAt(SV.crouch, p.duckT)];
        if (p.moving) return [SV.run, frameAt(SV.run, p.runT)];
        return [SV.run, 0];
    }
    function drawShadow(sx, sy, w, z) { ctx.fillStyle = "rgba(0,0,0," + (0.38 - Math.min(0.22, z / 500)).toFixed(2) + ")"; ctx.beginPath(); ctx.ellipse(sx, sy, w * (1 - Math.min(0.3, z / 500)), w * 0.24, 0, 0, 7); ctx.fill(); }
    const GLITCH_T = 1.4;
    function drawGlitch(p, a, f, sc, sx, sy) {                   // a dead character glitches (torn slices, colour ghosts, flicker) for a moment and then vanishes
        const k = p.deadT / GLITCH_T, N = 12, sh = a.fh / N, sw = a.fw * sc, col = f % a.cols * a.fw, row = Math.floor(f / a.cols) * a.fh;
        ctx.save(); ctx.translate(sx, sy - p.z); if (p.face > 0) ctx.scale(-1, 1);
        for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < N; i++) {
                if (Math.random() < 0.18 + k * 0.5) continue;                                              // slices drop out more and more
                const off = (Math.random() - 0.5) * (14 + 70 * k) * (Math.random() < 0.35 ? 2 : 0.4) + (pass ? 8 : 0);
                ctx.globalAlpha = (pass ? 0.35 : 0.5 + Math.random() * 0.5) * (1 - k * 0.6);
                if (pass) ctx.globalCompositeOperation = "lighter";
                ctx.drawImage(a.img, col, row + i * sh, a.fw, sh, -a.ax * sc + off, (-a.gy + i * sh) * sc, sw, sh * sc + 0.6);
            }
            ctx.globalCompositeOperation = "source-over";
        }
        for (let i = 0; i < 5; i++) {                                                                          // random colour bars
            ctx.globalAlpha = 0.25 + Math.random() * 0.35; ctx.fillStyle = Math.random() < 0.5 ? "#18f0ff" : "#ff2aa0";
            ctx.fillRect(-a.ax * sc * (0.2 + Math.random() * 0.8), -a.gy * sc * Math.random(), sw * (0.2 + Math.random() * 0.7), 2 + Math.random() * 5);
        }
        ctx.restore();
    }
    function drawPlayer(p) {
        const sx = p.x - cam.x, sy = p.y - cam.y, ps = lv.ps;
        if (p.dead && p.deadT > GLITCH_T) return;                                                           // dead and gone: nothing is drawn any more
        drawShadow(sx, sy, 46 * ps * (p.dead ? 1 - p.deadT / GLITCH_T : 1), p.z);
        const pk = pick(p), a = pk[0], f = pk[1];
        if (!a || !a.img) return;
        const sc = a.sc * ps;
        if (p.dead) { drawGlitch(p, a, f, sc, sx, sy); return; }
        ctx.save(); ctx.translate(sx, sy - p.z);
        if (p.inv > 0 && Math.floor(p.inv * 16) % 2) ctx.globalAlpha = 0.45;                          // blinks while it can't be hurt
        if (S.f.shield > 0) { const g = ctx.createRadialGradient(0, -90, 20, 0, -90, 105); g.addColorStop(0, "rgba(120,200,255,.05)"); g.addColorStop(1, "rgba(120,200,255,.45)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -90, 105, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(180,230,255,.8)"; ctx.lineWidth = 3; ctx.stroke(); }
        if (S.f.rage > 0 && !window.RUNMIL_PERF) ctx.filter = "saturate(1.8) brightness(1.15) hue-rotate(-12deg)";
        if (p.face > 0) ctx.scale(-1, 1);                                                                  // the GIFs face left
        ctx.drawImage(a.img, (f % a.cols) * a.fw, Math.floor(f / a.cols) * a.fh, a.fw, a.fh, -a.ax * sc, -a.gy * sc, a.fw * sc, a.fh * sc);
        ctx.restore();
        if (twoP() && !p.dead) {                                                                            // P1 / P2 tag above the head
            const col = p.pid ? (p.h ? p.h.color : "#ff5aa8") : "#4a9cff", ty = sy - p.z - (p.duck ? DUCK : STAND) * ps - 16;
            ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = "#0a0a28"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx - 9, ty - 4); ctx.lineTo(sx + 9, ty - 4); ctx.lineTo(sx, ty + 8); ctx.closePath(); ctx.stroke(); ctx.fill();
            ctx.font = "700 20px Teko, Impact, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.lineWidth = 4; ctx.fillStyle = "#fff"; ctx.strokeText("P" + (p.pid + 1), sx, ty - 5); ctx.fillText("P" + (p.pid + 1), sx, ty - 5); ctx.restore();
        }
    }
    function drawMon(m) {
        const S2 = SVM[m.t]; if (!S2) return;
        const atk = m.st === "atk", a = atk ? S2.atk : S2.walk; if (!a || !a.img) return;
        const f = atk ? Math.min(a.n - 1, Math.floor(m.at / m.d.atkMs * a.n)) : (function () { let t = m.wt % a.total; for (let i = 0; i < a.n; i++) { if (t < a.dur[i]) return i; t -= a.dur[i]; } return 0; })();
        const sx = m.x - cam.x, sy = m.y - cam.y, sc = a.sc, dy = m.st === "die" ? Math.min(1, m.dieT / 0.7) : 0;
        drawShadow(sx, sy, m.d.boss ? 120 : m.d.sh || (m.t === "bat" ? 30 : 56), m.z);
        ctx.save(); ctx.translate(sx, sy - m.z);
        if (m.down > 0 && m.st !== "die") { const k = Math.min(1, (0.6 - m.down) / 0.14), up = Math.min(1, m.down / 0.2); ctx.rotate((m.dn || 1) * 1.25 * Math.min(1, Math.max(0, k)) * up); }      // falls back, then gets up
        if (m.st === "die") {
            if (m.d.boss) { ctx.globalAlpha = 1 - dy; ctx.scale(1, 1 - dy * 0.35); }
            else { const mid = m.d.h * 0.5; ctx.translate(0, -mid); ctx.rotate(m.rot || 0); ctx.translate(0, mid); ctx.globalAlpha = m.dieT < 0.6 ? 1 : Math.max(0, (1.1 - m.dieT) / 0.5); }
        } else if (m.hitT > 0) { const k = m.hitT / 0.28; ctx.rotate((m.hd || 1) * 0.2 * k); ctx.scale(1 + 0.14 * k, 1 - 0.12 * k); }      // recoil: lean back and squash
        if (window.RUNMIL_PERF) { if (m.flash > 0) ctx.globalAlpha = 0.55; }                                       // light mode: no slow canvas filters, a hit just blinks
        else if (m.flash > 0) ctx.filter = "brightness(2.4)"; else if (S.f.freeze > 0) ctx.filter = "saturate(.5) brightness(1.25) hue-rotate(150deg)"; else if (m.slow > 0) ctx.filter = "hue-rotate(60deg) saturate(1.4)";
        if (m.face > 0) ctx.scale(-1, 1);
        ctx.drawImage(a.img, (f % a.cols) * a.fw, Math.floor(f / a.cols) * a.fh, a.fw, a.fh, -a.ax * sc, -a.gy * sc, a.fw * sc, a.fh * sc);
        ctx.restore();
        if (!m.d.boss && m.st !== "die" && m.max > 1) {                                                    // small health bar over the monster
            const w = 46; ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(sx - w / 2, sy - m.z - m.d.h - 14, w, 6);
            ctx.fillStyle = "#ff4a5a"; ctx.fillRect(sx - w / 2, sy - m.z - m.d.h - 14, w * Math.max(0, m.hp) / m.max, 6);
        }
    }


    function sheetFrame(a, sec) { let t = (sec * 1000) % a.total; for (let i = 0; i < a.n; i++) { if (t < a.dur[i]) return i; t -= a.dur[i]; } return 0; }
    function drawPk(p) {
        const sx = p.x - cam.x, sy = p.y - cam.y, bob = Math.sin(p.ph + p.age * 3.2) * 6, z = 34 + bob, pop = Math.min(1, p.age * 5);
        if (p.life < 4 && Math.floor(p.life * 8) % 2) ctx.globalAlpha = 0.35;                                  // blinks when it is about to disappear
        drawShadow(sx, sy, 20, z);
        ctx.save(); ctx.translate(sx, sy - z); ctx.scale(pop, pop);
        const pu = p.k === "pu", ic = pu ? PU.icons[p.pu] : null, dis_ = pu && PUS[p.pu].dis;
        if (pu) {                                                                                           // glowing badge behind the power-up
            const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 42); g.addColorStop(0, dis_ ? "rgba(255,140,40,.85)" : "rgba(120,220,255,.8)"); g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 42, 0, 7); ctx.fill();
            ctx.fillStyle = "rgba(8,12,40,.85)"; ctx.beginPath(); ctx.arc(0, 0, 31, 0, 7); ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = dis_ ? "#ff9a1a" : "#7ad8ff"; ctx.stroke();
            if (dis_ && DIS_ICON[p.pu]) ctx.drawImage(DIS_ICON[p.pu], -29, -29, 58, 58);
            else if (ic && ic.img) { const k = 46 / Math.max(ic.fw, ic.fh), f = ic.n > 1 ? sheetFrame(ic, p.age) : 0; ctx.imageSmoothingEnabled = false; ctx.drawImage(ic.img, (f % ic.cols) * ic.fw, Math.floor(f / ic.cols) * ic.fh, ic.fw, ic.fh, -ic.fw * k / 2, -ic.fh * k / 2, ic.fw * k, ic.fh * k); }
        } else if (p.k === "coin") {
            if (okImg(iconCoin)) ctx.drawImage(iconCoin, -17, -17, 34, 34); else { ctx.fillStyle = "#ffd24a"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill(); ctx.strokeStyle = "#a86a00"; ctx.lineWidth = 3; ctx.stroke(); }
        } else if (p.k === "gem") {
            if (okImg(iconGem)) ctx.drawImage(iconGem, -17, -17, 34, 34); else { ctx.fillStyle = "#5ad0ff"; ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(15, 0); ctx.lineTo(0, 17); ctx.lineTo(-15, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#0a4a8a"; ctx.lineWidth = 3; ctx.stroke(); }
        } else {                                                                                            // sack of coins
            ctx.fillStyle = "#b9761a"; ctx.beginPath(); ctx.ellipse(0, 4, 21, 19, 0, 0, 7); ctx.fill(); ctx.strokeStyle = "#5a3408"; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = "#d9962a"; ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(0, -22); ctx.lineTo(9, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#ffe27a"; ctx.font = "bold 22px Teko, Impact, sans-serif"; ctx.textAlign = "center"; ctx.fillText("$", 0, 12);
            if (okImg(iconCoin)) { ctx.drawImage(iconCoin, 8, -22, 16, 16); }
        }
        ctx.restore();
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(sx, sy - z, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, p.life) / 15); ctx.stroke();     // time left (15 s)
        ctx.globalAlpha = 1;
    }
    function drawDisasters() {
        ctx.imageSmoothingEnabled = false;
        dis.slice().sort(function (p, q) { return p.y - q.y; }).forEach(function (d) {
            const a = PU.fx[d.k]; if (!a || !a.img) return;
            const f = sheetFrame(a, d.age), fade = Math.min(1, d.t * 2, d.age * 3), sxm = (f % a.cols) * a.fw, sym = Math.floor(f / a.cols) * a.fh;
            ctx.globalAlpha = fade * 0.95;
            if (d.k === "fireball" || d.k === "acidrain") { ctx.drawImage(a.img, sxm, sym, a.fw, a.fh, 0, 0, WW, WH); }         // rain over the whole screen (inside the zoomed world)
            else if (d.k === "tornado") { const k = d.sc || 1.05; ctx.drawImage(a.img, sxm, sym, a.fw, a.fh, d.x - cam.x - a.ax * k, d.y - cam.y - a.gy * k, a.fw * k, a.fh * k); }
            else { const k = d.sc || 1.0; ctx.drawImage(a.img, sxm, sym, a.fw, a.fh, d.x - cam.x - a.ax * k, d.y - cam.y - a.gy * k + 8, a.fw * k, a.fh * k); }
            ctx.globalAlpha = 1;
        });
        drawSpikes();
        if (ring) {
            const k = ring.t / 0.7, sx = ring.x - cam.x, sy = ring.y - cam.y;
            [1, 0.72].forEach(function (m, i) { ctx.strokeStyle = i ? "rgba(255,255,255," + (0.8 * (1 - k)) + ")" : "rgba(255,210,74," + (0.95 * (1 - k)) + ")"; ctx.lineWidth = (i ? 5 : 10) * (1 - k * 0.6); ctx.beginPath(); ctx.ellipse(sx, sy - 14, ring.r * m, ring.r * m * 0.3, 0, 0, 7); ctx.stroke(); });
        }
        ctx.imageSmoothingEnabled = true;
    }
    const SPK_R = 470;
    function updateSpikes(dt) {                                  // the spike burst: it grows outward along 16 rays; each spike is a box checked against the monsters (Java AABB)
        if (!spk.length) return;
        spk.forEach(function (s) {
            s.t += dt; const r = Math.min(1, s.t / 0.6) * SPK_R, step = Math.PI * 2 / s.n;
            mons.forEach(function (m) {
                if (m.st === "die" || s.hit.indexOf(m.id) >= 0) return;
                const dx = m.x - s.x, dy = (m.y - s.y) / 0.35, rm = Math.hypot(dx, dy); if (rm > r + 20) return;
                const tn = Math.round(Math.atan2(dy, dx) / step) * step, sx = s.x + Math.cos(tn) * rm, sy = s.y + Math.sin(tn) * rm * 0.35;      // the spike that is nearest to this monster
                if (Math.abs(m.y - sy) > 46) return;
                const b = bodyBox(m); if (!hit(sx - 30, -120, 60, 120, b[0], b[1], b[2], b[3], "SPIKE", "atk", sy)) return;
                s.hit.push(m.id); if (!m.d.boss) { m.kb = (m.x < s.x ? -1 : 1) * 380; m.down = 0.8; m.dn = m.x < s.x ? -1 : 1; } hurtMon(m, spDmg(m), s.kind === "flames" ? "#ff9a3a" : "#d08aff"); spark(m.x, m.y - 60 - m.z, s.kind === "flames" ? "#ffb84a" : "#d9a8ff", 6);
            });
        });
        spk = spk.filter(function (s) { return s.t < (s.land ? 1.7 : 1); });
    }
    function drawFlame(p, t) {                                   // one tongue of fire: a flickering teardrop, red at the bottom, yellow at the tip
        const w = p.w * 1.5, fk = Math.sin(t * 22 + p.ph) * 0.12, hh = p.h * (1 + fk), sw = Math.sin(t * 17 + p.ph * 1.3) * w * 0.45;
        const gr = ctx.createLinearGradient(0, p.y, 0, p.y - hh); gr.addColorStop(0, "#c81a05"); gr.addColorStop(0.4, "#ff6a10"); gr.addColorStop(0.75, "#ffb52a"); gr.addColorStop(1, "#fff0a0");
        ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, w * 1.2, w * 0.38, 0, 0, 7); ctx.fill();
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(p.x - w, p.y);
        ctx.bezierCurveTo(p.x - w * 1.25, p.y - hh * 0.45, p.x - w * 0.3 + sw * 0.5, p.y - hh * 0.65, p.x + sw, p.y - hh);
        ctx.bezierCurveTo(p.x + w * 0.4 + sw * 0.5, p.y - hh * 0.62, p.x + w * 1.25, p.y - hh * 0.4, p.x + w, p.y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,245,170,.85)"; ctx.beginPath(); ctx.moveTo(p.x - w * 0.42, p.y);
        ctx.quadraticCurveTo(p.x - w * 0.5, p.y - hh * 0.38, p.x + sw * 0.45, p.y - hh * 0.62); ctx.quadraticCurveTo(p.x + w * 0.55, p.y - hh * 0.36, p.x + w * 0.42, p.y); ctx.closePath(); ctx.fill();
    }
    function drawSpikes() {
        spk.forEach(function (s) {
            const step = Math.PI * 2 / s.n, al = Math.max(0, Math.min(1, 1 - (s.t - 0.7) / 0.3)), L = [], fl = s.kind === "flames";
            const gl = ctx.createRadialGradient(s.x - cam.x, s.y - cam.y - 6, 10, s.x - cam.x, s.y - cam.y - 6, SPK_R * Math.min(1, s.t / 0.6));
            ctx.save(); ctx.globalAlpha = al * 0.5; ctx.fillStyle = "rgba(176,92,255,.0)"; gl.addColorStop(0, fl ? "rgba(255,200,90,.45)" : s.land ? "rgba(190,130,70,.35)" : "rgba(220,170,255,.35)"); gl.addColorStop(1, fl ? "rgba(255,90,20,0)" : s.land ? "rgba(120,70,30,0)" : "rgba(176,92,255,0)"); ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(s.x - cam.x, s.y - cam.y - 6, SPK_R * Math.min(1, s.t / 0.6), SPK_R * 0.35 * Math.min(1, s.t / 0.6), 0, 0, 7); ctx.fill(); ctx.restore();
            for (let i = 0; i < s.n; i++) for (let rk = 50; rk <= SPK_R; rk += (fl ? 66 : s.land ? 120 : 80)) {
                const tk = s.t - rk / SPK_R * 0.6; if (tk < 0) continue;
                const a = i * step, g = Math.min(1, tk / 0.1), h = (fl ? 74 + 62 * rk / SPK_R : 48 + 40 * rk / SPK_R) * (g * (2 - g));
                L.push({ x: s.x + Math.cos(a) * rk - cam.x, y: s.y + Math.sin(a) * rk * 0.35 - cam.y, h: h, w: 8 + 5 * rk / SPK_R, o: (i % 2 ? 4 : -4), ph: i * 1.7 + rk * 0.05, tk: tk, rk: rk });
            }
            L.sort(function (p, q) { return p.y - q.y; });
            ctx.save(); ctx.globalAlpha = al; ctx.lineJoin = "round";
            L.forEach(function (p) {
                if (fl) { drawFlame(p, s.t); return; }
                if (s.land) {                                                 // an eruption of earth (the 9 pictures of the sprite play once at every spot)
                    const fx = s.h.fx, im = flameImg(s.h), fr = Math.floor(p.tk / (fx.ms / 1000)); if (fr >= fx.n || !im.complete || !im.naturalWidth) return;
                    const k = 0.36 + 0.22 * p.rk / SPK_R; ctx.drawImage(im, fr * fx.fw, 0, fx.fw, fx.fh, p.x - fx.fw * k / 2, p.y - fx.fh * k + 6, fx.fw * k, fx.fh * k); return;
                }
                const gr = ctx.createLinearGradient(0, p.y, 0, p.y - p.h); gr.addColorStop(0, "#4a1496"); gr.addColorStop(0.55, "#b05cff"); gr.addColorStop(1, "#f6e4ff");
                ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w * 1.3, p.w * 0.4, 0, 0, 7); ctx.fill();
                ctx.fillStyle = gr; ctx.strokeStyle = "#1c0640"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - p.w, p.y); ctx.lineTo(p.x + p.o, p.y - p.h); ctx.lineTo(p.x + p.w, p.y); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x - p.w * 0.35, p.y - 3); ctx.lineTo(p.x + p.o * 0.8, p.y - p.h * 0.85); ctx.stroke();
            });
            ctx.restore();
        });
    }
    function drawBuffs() {
        let x = 16; const y = 128;
        const list = [["shield", S.f.shield, 8], ["mango_rage", S.f.rage, 15], ["lucky_charm", S.f.lucky, 20], ["freeze_time", S.f.freeze, 5], ["banana_magnet", S.f.magnet, 15], ["second_wind", S.f.wind ? 1 : 0, 0]];
        list.forEach(function (b) {
            if (b[1] <= 0) return; const ic = PU.icons[b[0]]; if (!ic || !ic.img) return;
            const f = ic.n > 1 ? sheetFrame(ic, S.t) : 0, k = 38 / Math.max(ic.fw, ic.fh);
            ctx.fillStyle = "rgba(5,8,28,.7)"; ctx.fillRect(x - 3, y - 3, 46, 52);
            ctx.drawImage(ic.img, (f % ic.cols) * ic.fw, Math.floor(f / ic.cols) * ic.fh, ic.fw, ic.fh, x + 21 - ic.fw * k / 2, y + 19 - ic.fh * k / 2, ic.fw * k, ic.fh * k);
            if (b[2]) { ctx.fillStyle = "#0a0f30"; ctx.fillRect(x, y + 41, 40, 5); ctx.fillStyle = "#7dff8a"; ctx.fillRect(x, y + 41, 40 * b[1] / b[2], 5); }
            else { ctx.fillStyle = "#7dff8a"; ctx.fillRect(x, y + 41, 40, 5); }
            x += 52;
        });
    }
    let RS = 1;                                                  // render scale (light mode lowers it by itself when the phone cannot keep ~40 fps)
    function draw() {
        ctx.setTransform(RS, 0, 0, RS, 0, 0);
        ctx.clearRect(0, 0, VW, VH);
        ctx.save();
        if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 22, (Math.random() - 0.5) * shake * 22);
        ctx.scale(Z, Z);
        const list = PL.map(function (p) { return { y: p.y, f: function () { drawPlayer(p); } }; });
        pks.forEach(function (p) { list.push({ y: p.y - 1, f: function () { drawPk(p); } }); });
        mons.forEach(function (m) { list.push({ y: m.y, f: function () { drawMon(m); } }); });
        list.sort(function (a, b) { return a.y - b.y; }).forEach(function (o) { o.f(); });                  // whoever is lower on the path is drawn in front
        drawFlames(); drawWind();
        fx.forEach(function (f) {
            if (f.k === "p") { ctx.fillStyle = f.c; ctx.globalAlpha = Math.max(0, Math.min(1, f.l * 2)); ctx.fillRect(f.x - cam.x, f.y - cam.y, f.sz || 5, f.sz || 5); ctx.globalAlpha = 1; }
            else if (f.k === "b") { const k = Math.max(0, f.l / f.max), R = f.r * (1.15 - k * 0.55); ctx.save(); ctx.translate(f.x - cam.x, f.y - cam.y); ctx.rotate(f.a); ctx.globalAlpha = Math.min(1, k * 1.6); ctx.fillStyle = "#fff6c8"; ctx.strokeStyle = "#ff9a1f"; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 16; i++) { const rr = i % 2 ? R * 0.42 : R, an = i * Math.PI / 8; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
            else if (f.k === "s") { const k = f.l / 0.16, L = 60 + (1 - k) * 40; ctx.save(); ctx.translate(f.x - cam.x, f.y - cam.y); ctx.rotate(f.a); ctx.globalAlpha = k; ctx.strokeStyle = "#fff"; ctx.lineWidth = 5 * k + 1; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke(); ctx.strokeStyle = "#ff3a3a"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1; }
            else { ctx.font = "30px Teko, Impact, sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "#000"; ctx.fillStyle = f.c; ctx.globalAlpha = Math.min(1, f.l * 2); ctx.strokeText(f.s, f.x - cam.x, f.y - cam.y); ctx.fillText(f.s, f.x - cam.x, f.y - cam.y); ctx.globalAlpha = 1; }
        });
        if (window.RMX) {
            const nowT = performance.now(), vdt = Math.min(0.05, (nowT - (draw.vt || nowT)) / 1000); draw.vt = nowT;
            if (RMX.vis.mode === 1 && me && !me.dead) {                                  // X-RAY: every invisible box, live
                const ph = me.duck ? DUCK : STAND, xl = [];
                mons.forEach(function (m) { if (m.st === "die") return; const b = bodyBox(m); xl.push({ B: { x: b[0], y: m.y + b[1], w: b[2], h: b[3] }, far: Math.abs(m.y - me.y) > m.d.lane + 8 }); });
                pks.forEach(function (p) { xl.push({ B: { x: p.x - 26, y: p.y - (p.z0 + 54), w: 52, h: 54 }, far: Math.abs(p.y - me.y) > 40 }); });
                RMX.vis.xray(ctx, { x: me.x - HALF_W, y: me.y - (me.z + ph), w: HALF_W * 2, h: ph }, xl, cam.x, cam.y, WW, WH);
            }
            if (RMX.vis.mode === 1 && RMX.vis.xrayP) PL.forEach(function (q) {            // the other player(s) get their box, guide lines and verdicts too
                if (q === me || q.dead) return; const ph2 = q.duck ? DUCK : STAND, xl2 = [];
                mons.forEach(function (m) { if (m.st === "die") return; const b = bodyBox(m); xl2.push({ B: { x: b[0], y: m.y + b[1], w: b[2], h: b[3] }, far: Math.abs(m.y - q.y) > m.d.lane + 8 }); });
                RMX.vis.xrayP(ctx, { x: q.x - HALF_W, y: q.y - (q.z + ph2), w: HALF_W * 2, h: ph2 }, xl2, "P2  (A2)", cam.x, cam.y, WW, WH);
            });
            RMX.vis.draw(ctx, cam.x, cam.y, WW, WH, paused ? 0 : vdt);
        }
        ctx.restore();
        ctx.save(); ctx.scale(Z, Z); drawDisasters(); ctx.restore();
        if (S.f.freeze > 0) { ctx.fillStyle = "rgba(140,210,255," + (0.10 + 0.04 * Math.sin(S.t * 6)) + ")"; ctx.fillRect(0, 0, VW, VH); }
        drawBuffs(); ctx.save(); ctx.scale(Z, Z); drawShots(); ctx.restore(); if (!TOUCHUI) { drawWeaponHud(false); if (twoP()) drawWeaponHud(true); }
        bgimg.style.transform = "translate(" + (-cam.x * K * Z) + "px," + (-cam.y * K * Z) + "px)";
    }
    let fpsN = 0, fpsSum = 0;
    function loop(t) {
        if (!running) return;
        const raw = t - last;
        if (window.RUNMIL_PERF && !paused && !ended && raw < 250 && RS > 0.56) {            // light mode: if the phone is slow, draw the game at a lower resolution
            fpsSum += raw; if (++fpsN >= 90) { if (fpsSum / fpsN > 25) { RS = Math.max(0.56, RS * 0.78); cv.width = Math.round(VW * RS); cv.height = Math.round(VH * RS); } fpsN = 0; fpsSum = 0; }
        }
        const dt = Math.min(0.05, raw / 1000); last = t;
        if (!paused && !ended) { try { if (NQ.on && !NQ.host) updateGuest(dt); else if (NQ.on && NQ.hold) { /* host waits until the friend's phone is in the level */ } else { update(dt); if (NQ.on) netTick(dt); } } catch (e) { console.error(e); } }
        else if (NQ.on && !NQ.host) { try { updateGuest(dt); } catch (e) { console.error(e); } }
        else if (NQ.on && ended) { try { netTick(dt); } catch (e) { console.error(e); } }
        if (!paused) { try { draw(); } catch (e) { console.error(e); } }
        requestAnimationFrame(loop);
    }

    // ---------- the end of a level ----------
    function sum() { return S.kills + " monsters beaten &bull; " + Math.floor(S.t / 60) + ":" + String(Math.floor(S.t % 60)).padStart(2, "0") + " &bull; hit " + S.hurt + " times &bull; best combo " + S.best; }
    function gameOver() { if (ended) return; ended = true; netEnd("over"); if (window.RMX) RMX.calc($("aabb-calc"), (PL.map(function (q) { return q.lastHit; }).filter(Boolean).pop()) || (me && me.lastHit)); $("over-sum").innerHTML = "Wave " + (wv ? Math.max(1, wv.n) : 1) + " of " + WAVES + "<br>" + sum(); $("over").hidden = false; }
    function levelClear() {
        if (ended) return; ended = true; netEnd("clear");
        const p = getProg(), first = !p.cleared[lv.n], newH = DUO && first ? DUO.forLevel(lv.n) : null; p.cleared[lv.n] = 1; p.unlocked = Math.max(p.unlocked, Math.min(4, lv.n + 1)); setProg(p);
        if (newH && !duoSave().p2) setDuo({ p2: newH.id });
        SFX("victory");
        $("clear-sum").innerHTML = sum() + (lv.n + 1 < LOCK_FROM ? "<br>Level " + (lv.n + 1) + " is unlocked!" : "<br>More levels are coming soon!") + (newH ? '<br><b class="newh" style="color:' + newH.color + '">NEW CHARACTER: ' + newH.name + '!</b><br><span style="font-size:.72em;color:#cfd8ff">Choose her as Player 2 on the level screen.</span>' : "");
        $("next").hidden = lv.n + 1 >= LOCK_FROM || lv.n >= 4;
        if (newH && newH.revealed && newH.img) setTimeout(function () { showUnlock(newH, function () { $("clear").hidden = false; }); }, 900);
        else setTimeout(function () { $("clear").hidden = false; }, 900);
    }
    // a new heroine: the screen flashes, she pops in, and the text says who was unlocked
    function showUnlock(h, done) {
        const el = $("unlock"); if (!el) { done(); return; }
        $("ul-img").src = h.img; $("ul-name").textContent = h.name; $("ul-name").style.color = h.color; el.style.setProperty("--hc", h.color);
        el.hidden = false; el.classList.remove("go"); void el.offsetWidth; el.classList.add("go"); SFX("item"); SFX("boom"); shake = 0.4;
        let fin = false;
        function end() { if (fin) return; fin = true; clearTimeout(t); el.removeEventListener("click", end); removeEventListener("keydown", key, true); el.hidden = true; el.classList.remove("go"); done(); }
        function key(e) { if (e.code === "Enter" || e.code === "Space" || e.code === "Escape") { e.preventDefault(); e.stopPropagation(); end(); } }
        const t = setTimeout(end, 7000);
        setTimeout(function () { if (!fin) { el.addEventListener("click", end); addEventListener("keydown", key, true); } }, 1600);          // a short moment before it can be skipped
    }

    // ---------- two devices (Bluetooth): the HOST phone plays the whole level, the GUEST phone sends its buttons and draws what the host reports ----------
    // Player 1 (main character) = host.  Player 2 (a heroine) = guest.  Coins and gems are shared: both phones bank them.
    const NT = window.RunMilNet, DD = window.RUNMIL_DUO, NETOK = !!(NT && NT.available && NT.available() && DD) && !BOT;
    let nseq = 0, ntT = 0, lastKey = "";
    function nsend(o) { if (NQ.on && NT) NT.send(o); }
    function myHero() { const open = DD.heroines.filter(function (h) { return getProg().cleared[h.level]; }), cur = DD.byId(duoSave().p2); return cur && getProg().cleared[cur.level] ? cur : open[0] || DD.heroines[0]; }
    function nwaitEl() {
        let el = document.getElementById("nwait"); if (el) return el;
        el = document.createElement("div"); el.id = "nwait"; el.hidden = true;
        el.style.cssText = "position:fixed;inset:0;z-index:150;background:radial-gradient(ellipse at 50% 30%,#1d2a78,#070b26 75%);color:#fff;font:700 7vmin/1.1 Teko,Impact,sans-serif;text-align:center;padding:4vmin";
        el.innerHTML = '<div id="nwait-t" style="color:#ffd24a">WAITING FOR THE HOST TO PICK A LEVEL...</div><button id="nwait-b" style="font:700 4.4vmin Teko,Impact,sans-serif;color:#fff;padding:1vmin 5vmin;border:.5vmin solid #9ab0ff;border-radius:1.6vmin;background:linear-gradient(#3a58ff,#1c2fb0)">LEAVE</button>';
        const st = document.createElement("style"); st.textContent = "#nwait:not([hidden]){display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3vmin}"; document.head.appendChild(st);
        document.body.appendChild(el); document.getElementById("nwait-b").addEventListener("click", goHome); return el;
    }
    function netLobby() { $("select").hidden = true; if (window.RunMilLobby) RunMilLobby.show({ title: "2 PLAYERS", msg: "", onOpen: netOpen, onBack: function () { $("select").hidden = false; } }); }
    function netOpen(role) {
        NQ.on = true; NQ.host = role === "host"; NQ.hero = null; NQ.am = null; nseq = 0; ntT = 0; $("net-btn").hidden = true;
        if (!NQ.host) { NQ.hero = myHero(); heroSheets(NQ.hero); nsend({ t: "hi", hero: NQ.hero.id }); showSelect(); }
        else {
            $("select").hidden = false; toast("PLAYER 2 CONNECTED. PICK A LEVEL!", 2600);
            let tries = 0; clearInterval(helloTimer); helloTimer = setInterval(function () { if (!NQ.on || ++tries > 14) { clearInterval(helloTimer); return; } nsend({ t: "hello" }); }, 700);   // makes sure the friend's phone knows it is connected
        }
    }
    function netSelect() {                                          // the guest does not pick levels: it waits for the host
        if (!NQ.on) { $("net-btn").hidden = !NETOK; return false; }
        $("net-btn").hidden = true;
        if (NQ.host) { nsend({ t: "ev", e: "select" }); return false; }
        running = false; paused = false; ended = false;
        ["hud", "pause", "over", "clear", "select"].forEach(function (id) { $(id).hidden = true; }); bgimg.style.display = "none"; ctx.clearRect(0, 0, VW, VH);
        nwaitEl().hidden = false; return true;
    }
    function netStart(n) {
        const w = document.getElementById("nwait"); if (w) w.hidden = true;
        ["retry", "over-levels", "clear-levels"].forEach(function (id) { $(id).hidden = false; });
        if (NQ.on && NQ.host) {
            // do not play (and do not flood the link) until the friend's phone says it is in the level; keep sending "start" until it does
            const id = ++startId, t0 = Date.now(); NQ.hold = id; clearInterval(holdTimer);
            const w2 = nwaitEl(), tt = document.getElementById("nwait-t"); if (tt) tt.textContent = "WAITING FOR YOUR FRIEND'S PHONE..."; w2.hidden = false;
            const go = function () { nsend({ t: "start", n: n, id: id }); };
            go(); holdTimer = setInterval(function () {
                if (NQ.hold !== id) { clearInterval(holdTimer); return; }
                if (Date.now() - t0 > 12000) { netRelease(id); return; }      // give up waiting: play anyway
                go();
            }, 700);
        }
    }
    let startId = 0, holdTimer = 0, lastStartId = 0, helloTimer = 0;
    function netRelease(id) { if (id && NQ.hold !== id) return; NQ.hold = 0; clearInterval(holdTimer); const w = document.getElementById("nwait"); if (w) w.hidden = true; last = performance.now(); }
    function netEnd(kind) { if (NQ.on && NQ.host) { netSnap(); nsend({ t: "ev", e: kind }); } }
    function netLeave() { NQ.hold = 0; clearInterval(holdTimer); if (NQ.on) { NQ.on = false; NQ.host = false; if (NT) NT.close(); } }
    function netLost() {
        if (!NQ.on) return; NQ.on = false; NQ.host = false; NQ.hold = 0; clearInterval(holdTimer); const w = document.getElementById("nwait"); if (w) w.hidden = true;
        showSelect(); toast("CONNECTION LOST. Check Bluetooth and try again.", 3500);
    }
    function remoteKey(c, d) {                                      // the guest's buttons drive Player 2
        const p = PL[1]; if (!p || !running || ended || p.dead) { if (p && !d) p.keys[c] = false; return; }
        if (/^Digit[1-4]$/.test(c)) { if (d) as(p, function () { useWeapon(+c.slice(-1) - 1); }); return; }
        p.keys[c] = !!d; if (!d) return;
        as(p, function () { if (c === "Space") jump(); else if (c === "KeyP") attack("punch"); else if (c === "KeyK") attack("kick"); else if (c === "KeyL") special(); });
    }
    const R1 = function (v) { return Math.round(v * 10) / 10; }, R2 = function (v) { return Math.round((v || 0) * 100) / 100; };
    function clean(o) { return JSON.parse(JSON.stringify(o, function (k, v) { return k === "hit" || k === "d" || k === "keys" || k === "wcd" || k === "sv" || (k === "h" && v && typeof v === "object") ? undefined : v; })); }
    function withHero(a) { return a.map(function (o) { const c = clean(o); c.hid = o.h ? o.h.id : ""; return c; }); }
    function netSnap() {
        const b = wv && wv.boss;
        nsend({
            t: "s", n: ++nseq, e: NQ.q.splice(0),
            p: PL.map(function (p) { return { x: R1(p.x), y: R1(p.y), z: R1(p.z), f: p.face, c: p.act ? [p.act.k, R2(p.act.t), R2(p.act.dur)] : 0, d: p.duck ? 1 : 0, mv: p.moving ? 1 : 0, hp: Math.ceil(p.hp), en: Math.round(p.en || 0), dd: p.dead ? 1 : 0, dT: R2(p.deadT), inv: R2(p.inv), vz: Math.round(p.vz), aT: R2(p.airT), rT: R2(p.runT), uT: R2(p.duckT) }; }),
            m: mons.map(function (m) { return [m.id, m.t, R1(m.x), R1(m.y), R1(m.z), m.face, m.st, R2(m.at), R2(m.wt), R2(m.dieT), Math.ceil(m.hp), m.max, R2(m.down), m.dn || 0, R2(m.hitT), m.hd || 0, R2(m.flash), R2(m.slow), R2(m.rot)]; }),
            k: pks.map(function (p) { return [p.k, p.pu || "", R1(p.x), R1(p.y), R2(p.age), R2(p.life), R2(p.ph), p.z0]; }),
            dis: clean(dis), ring: ring ? clean(ring) : null, spk: withHero(spk), flm: withHero(flm), wnd: withHero(wnd), sh: clean(shots), wf: clean(wfx),
            S: { t: R1(S.t), kills: S.kills, hurt: S.hurt, coins: S.coins, gems: S.gems, combo: S.combo, best: S.best, f: S.f },
            w: wv ? { n: wv.n, st: wv.st, total: wv.total, killed: wv.killed, b: b ? b.id : 0 } : null,
            cam: { x: R1(cam.x), y: R1(cam.y) }, shk: R2(shake), am: WEAPONS.map(function (w) { return wam[w.id] | 0; })
        });
    }
    function netTick(dt) { ntT += dt; if (ntT >= (NT && NT.interval ? NT.interval() : 0.033)) { ntT = 0; netSnap(); } }
    function evReplay(e) {
        e.forEach(function (v) {
            const k = v[0];
            if (k === "s") SFX(v[1], v[2] || undefined); else if (k === "p") spark(v[1], v[2], v[3], v[4], v[5] || undefined); else if (k === "b") blood(v[1], v[2], v[3], v[4]);
            else if (k === "x") burst(v[1], v[2], v[3] || undefined); else if (k === "l") slash(v[1], v[2], v[3]); else if (k === "t") floatText(v[1], v[2], v[3], v[4] || undefined);
            else if (k === "m") toast(v[1], v[2] || undefined); else if (k === "w") warn(v[1], v[2] || undefined, !!v[3]); else if (k === "k") bank(v[1], v[2]);
        });
    }
    function applySnap(o) {
        if (!S || !lv) return;
        o.p.forEach(function (q, i) {
            const p = PL[i]; if (!p) return; const first = p.tx === undefined;
            p.tx = q.x; p.ty = q.y; p.tz = q.z; if (first) { p.x = q.x; p.y = q.y; p.z = q.z; }
            p.face = q.f; p.act = q.c ? { k: q.c[0], t: q.c[1], dur: q.c[2], hit: [] } : null; p.duck = !!q.d; p.moving = !!q.mv; p.dead = q.dd; p.deadT = q.dT; p.inv = q.inv; p.vz = q.vz; p.airT = q.aT; p.runT = q.rT; p.duckT = q.uT;
            if (p.hp !== q.hp || p.dead !== p._dd) { p.hp = q.hp; p._dd = p.dead; setHp(p); } if (p.en !== q.en || p._edd !== q.dd) { p.en = q.en; p._edd = q.dd; setEn(p); }
        });
        const old = {}; mons.forEach(function (m) { old[m.id] = m; });
        mons = o.m.map(function (a) {
            let m = old[a[0]]; const first = !m; if (first) m = { id: a[0], t: a[1], d: MD[a[1]] || MD.rat || {} };
            m.tx = a[2]; m.ty = a[3]; m.tz = a[4]; if (first) { m.x = a[2]; m.y = a[3]; m.z = a[4]; }
            m.face = a[5]; m.st = a[6]; m.at = a[7]; m.wt = a[8]; m.dieT = a[9]; m.hp = a[10]; m.max = a[11]; m.down = a[12]; m.dn = a[13]; m.hitT = a[14]; m.hd = a[15]; m.flash = a[16]; m.slow = a[17]; m.rot = a[18]; return m;
        });
        pks = o.k.map(function (a) { return { k: a[0], pu: a[1] || undefined, x: a[2], y: a[3], age: a[4], life: a[5], ph: a[6], z0: a[7] }; });
        dis = o.dis; ring = o.ring; shots = o.sh; wfx = o.wf;
        const hy = function (a) { return a.map(function (c) { c.h = DD.byId(c.hid); c.hit = []; return c; }); }; spk = hy(o.spk); flm = hy(o.flm); wnd = hy(o.wnd);
        Object.assign(S, o.S); NQ.am = o.am; shake = Math.max(shake, o.shk);
        $("lcoin").textContent = S.coins; $("lgem").textContent = S.gems;
        const ce = $("combo"); if (S.combo >= 2) { ce.hidden = false; $("cnum").textContent = S.combo; ce.className = S.combo >= 20 ? "t3" : S.combo >= 10 ? "t2" : "t1"; } else ce.hidden = true;
        if (o.w) {
            if (!wv) wv = {}; const b = o.w.b ? mons.filter(function (m) { return m.id === o.w.b; })[0] : null; Object.assign(wv, o.w); wv.boss = b || null;
            const key = o.w.n + "/" + o.w.killed + "/" + o.w.total + "/" + (b ? Math.round(b.hp) : "");
            if (key !== lastKey) { lastKey = key; if (wv.n === WAVES && b) setProgress(WAVES, 1 - Math.max(0, b.hp) / b.max); else setProgress(Math.max(1, wv.n), wv.total ? wv.killed / wv.total : 0); }
            if (b) {
                if ($("boss").hidden) { const nm = $("boss").querySelector("span"); if (nm) nm.innerHTML = "&#128128; " + (NAMES[b.t] || "THE BOSS"); $("boss").hidden = false; }
                $("bossfill").style.width = Math.max(b.hp > 0 ? 2 : 0, b.hp / b.max * 100) + "%"; $("bosshp").textContent = Math.max(0, Math.ceil(b.hp)) + " / " + b.max;
            }
        }
        evReplay(o.e);
        cam.tx = o.cam.x; cam.ty = o.cam.y;
    }
    function updateGuest(dt) {                                      // between two reports from the host: keep everything moving smoothly
        const k = 1 - Math.pow(0.0005, dt);
        PL.forEach(function (p) {
            if (p.tx === undefined) return; p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k;
            if (p.moving) p.runT += dt; if (p.duck) p.duckT += dt; if (p.z > 1) p.airT += dt; if (p.act) p.act.t += dt; if (p.dead) p.deadT += dt; if (p.inv > 0) p.inv -= dt;
        });
        mons.forEach(function (m) {
            if (m.tx === undefined) return; m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k; m.z += (m.tz - m.z) * k; m.wt += dt; if (m.st === "atk") m.at += dt; if (m.st === "die") m.dieT += dt;
            if (m.hitT > 0) m.hitT -= dt; if (m.flash > 0) m.flash -= dt; if (m.down > 0) m.down -= dt;
        });
        pks.forEach(function (p) { p.age += dt; p.life -= dt; });
        shots.forEach(function (s) { s.x += (s.vx || 0) * dt; s.life -= dt; });
        [spk, flm, wnd].forEach(function (a) { a.forEach(function (o) { o.t += dt; }); });
        wfx.forEach(function (f) { f.t -= dt; });
        fx.forEach(function (f) { f.l -= dt; if (f.k === "p") { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 900 * dt; } else if (f.k === "t") f.y -= 40 * dt; });
        fx = fx.filter(function (f) { return f.l > 0; });
        shake = Math.max(0, shake - dt);
        if (cam.tx !== undefined) { cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; }
    }
    if (NT && DD) {
        NT.on("msg", function (m) {
            if (!NQ.on || !m) return;
            if (m.t === "hi" && NQ.host) { clearInterval(helloTimer); NQ.hero = DD.byId(m.hero) || DD.heroines[0]; heroSheets(NQ.hero); }
            else if (m.t === "start" && !NQ.host) { if (m.id !== lastStartId) { lastStartId = m.id; startLevel(m.n); } nsend({ t: "rdy", id: m.id }); setTimeout(function () { nsend({ t: "rdy", id: m.id }); }, 400); }
            else if (m.t === "rdy" && NQ.host) netRelease(m.id);
            else if (m.t === "hello" && !NQ.host) { nsend({ t: "hi", hero: NQ.hero ? NQ.hero.id : "" }); }
            else if (m.t === "s" && !NQ.host) { if (running) applySnap(m); }
            else if (m.t === "ev" && !NQ.host) {
                if (m.e === "over" || m.e === "clear") { if (m.e === "over") gameOver(); else levelClear(); ["retry", "next", "over-levels", "clear-levels"].forEach(function (id) { $(id).hidden = true; }); $("over-sum").innerHTML += "<br>Waiting for the host..."; $("clear-sum").innerHTML += "<br>Waiting for the host..."; }
                else if (m.e === "select") showSelect();
            }
            else if (m.t === "k" && NQ.host) remoteKey(m.c, m.d);
            else if (m.t === "clr" && NQ.host && PL[1]) PL[1].keys = {};
        });
        NT.on("close", netLost);
        if (NETOK) { $("net-btn").hidden = false; $("net-btn").addEventListener("click", netLobby); }
    }

    // handy for the next steps + testing
    window.RunMilAmmo = function () { return WEAPONS.map(function (w) { return (NQ.on && !NQ.host && NQ.am ? NQ.am[WEAPONS.indexOf(w)] : wam[w.id]) | 0; }); };          // the touch buttons show these numbers
    window.RunMilSurvival = {
        levels: LEVELS, setProgress: setProgress, toast: toast, state: function () { return me; }, players: function () { return PL; }, setHp: function (i) { setHp(PL[i]); }, setEn: function (i, v) { PL[i].en = v; setEn(PL[i]); }, spikes: function () { return spk; }, levelClear: function () { levelClear(); }, mode: function () { return MODE; }, cam: function () { return cam; }, start: startLevel,
        monsters: function () { return mons; }, pickups: function () { return pks; }, addPk: addPk, applyPU: applyPU, fxState: function () { return S.f; },  wave: function () { return wv; }, spawn: function (t) { return spawn(t); }, hurt: function (n) { hurtPlayer({ d: { dmg: n || 10 }, x: me.x + 10 }); },
        step: function (dt) { update(dt); }, over: function () { gameOver(); }, win: function () { levelClear(); }, beginWave: function (n) { beginWave(n); }, kill: function (m, q) { kill(m, q); }, ended: function () { return ended; },
        showUnlock: function (id, f) { showUnlock(DUO.byId(id), f || function () {}); },
        clear: function (n) { const p = getProg(); p.cleared[n] = 1; p.unlocked = Math.max(p.unlocked, Math.min(4, n + 1)); setProg(p); }
    };
    resize(); showSelect();
    if (window.RMX) { RMX.mechanics("survival"); $("howto-pause").addEventListener("click", function () { RMX.openHowTo("survival"); }); }   // the game mechanics card before the first level
})();
