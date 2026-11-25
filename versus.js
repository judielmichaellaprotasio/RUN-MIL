/* RUN MIL! - 1 VS 1 (web version).  Two players pick a fighter (the main character or an unlocked heroine) and fight 3 rounds on one keyboard.
   Intro "NAME VS NAME"  ->  ROUND n / FIGHT!  ->  K.O.  ->  ... after round 3 the winner gets a celebration screen.
   Needs: survival-anim.js (the main character's sheets) and duo.js (the heroines).  Heroines show up as soon as their sheets + special are in duo.js. */
(function () {
    "use strict";
    const $ = function (id) { return document.getElementById(id); };
    const W = 960, H = 540, KEY = "runmil_versus", GLITCH_T = 1.4;
    const cv = $("c"), ctx = cv.getContext("2d"), stage = $("stage");
    const PERF = !!window.RUNMIL_PERF;
    function fit() { stage.style.setProperty("--u", stage.clientWidth / 960 + "px"); }
    addEventListener("resize", fit); fit();
    const SFX = function (n, a) { try { if (window.RunMilAudio) window.RunMilAudio.sfx(n, a); } catch (e) { /* audio is optional */ } };

    // ---------- two-device play (Bluetooth / Nearby): the HOST phone runs the fight, the GUEST phone sends its buttons and draws what the host reports ----------
    const NT = window.RunMilNet, NET = { on: false, host: false, slot: 0, q: [], t: 0, seq: 0, last: 0, name: "" };
    const TOUCHY = !!window.RUNMIL_NATIVE || (window.matchMedia && matchMedia("(pointer: coarse)").matches) || /[?&]touch=1/.test(location.search);
    const ONLY_NET = TOUCHY && !!(NT && NT.available());                   // on a phone there is no keyboard: 1 VS 1 is always played over the link
    function nsend(o) { if (NET.on && NT) NT.send(o); }
    function SF(n, a) { SFX(n, a); if (NET.on && NET.host) NET.q.push(["s", n, a || 0]); }            // a sound made by the fight: the guest hears it too
    function rr(v, d) { const k = d === 3 ? 1000 : d === 2 ? 100 : 10; return Math.round(v * k) / k; }

    // ---------- fighters ----------
    const MAIN = { id: "main", name: "MIL", color: "#4a9cff", special: "ring", sp: "SHOCKWAVE", sheets: window.RUNMIL_SV, open: true,
        desc: "The hero of Panabo City. Quick fists, quick feet, and a shockwave that clears the whole street." };
    const SPN = { spikes: "SPIKES", land: "LAND POWER", flames: "FLAMES", wind: "WIND BLAST", water: "TIDAL WAVE" };
    let cleared = {}; try { cleared = (JSON.parse(localStorage.getItem("runmil_save") || "{}").survival || {}).cleared || {}; } catch (e) { cleared = {}; }      // a heroine is playable once her Monster Survival level is cleared
    const CH = [MAIN];
    ((window.RUNMIL_DUO && window.RUNMIL_DUO.heroines) || []).forEach(function (h) {
        CH.push({ id: h.id, name: h.name, color: h.color, special: h.special || null, sp: SPN[h.special] || "", desc: h.desc, sheets: h.sheets, face: h.face, img: h.img, fx: h.fx, open: !!(h.revealed && h.sheets && h.special && cleared[h.level]) });
    });
    function loadImg(src, cb) { const im = new Image(); if (cb) im.onload = cb; im.src = src; return im; }
    // the sheets are about twice as big as they are drawn: shrink each one once after loading (a smaller, cheaper picture; sc / ax / gy are adjusted so nothing changes on screen)
    function shrinkSheet(a) {
        const src = a.img; if (a.shrunk || !src || !src.naturalWidth) return; a.shrunk = 1;
        const r = Math.min(1, a.sc * 1.1); if (r > 0.95) return;
        try {
            const rows = Math.ceil(a.n / a.cols), fw2 = Math.max(1, Math.round(a.fw * r)), fh2 = Math.max(1, Math.round(a.fh * r));
            const c = document.createElement("canvas"); c.width = a.cols * fw2; c.height = rows * fh2;
            const g = c.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
            for (let i = 0; i < a.n; i++) g.drawImage(src, (i % a.cols) * a.fw, Math.floor(i / a.cols) * a.fh, a.fw, a.fh, (i % a.cols) * fw2, Math.floor(i / a.cols) * fh2, fw2, fh2);
            const rx = fw2 / a.fw, ry = fh2 / a.fh; a.ax *= rx; a.gy *= ry; a.sc /= (rx + ry) / 2; a.fw = fw2; a.fh = fh2; a.img = c;
        } catch (e) { /* keep the big picture */ }
    }
    function prep(c) {
        if (c.sv) return c.sv;
        const out = c.sv = {};
        ["run", "punch", "kick", "jump", "crouch"].forEach(function (k) {
            const s = c.sheets && c.sheets[k]; if (!s) return;
            const a = Object.assign({}, s); a.total = a.dur.reduce(function (x, y) { return x + y; }, 0);
            a.img = loadImg(a.src, function () { shrinkSheet(a); }); out[k] = a;
        });
        if (c.fx) c.fxImg = loadImg(c.fx.src);
        return out;
    }
    CH.forEach(function (c) { if (c.open) prep(c); });
    function ready(im) { return im && (im.tagName === "CANVAS" || (im.complete && im.naturalWidth)); }
    function frameAt(a, ms) { ms = ms % a.total; for (let i = 0; i < a.n; i++) { if (ms < a.dur[i]) return i; ms -= a.dur[i]; } return 0; }

    // a square picture of the fighter's face on any canvas (the main character follows the saved outfit)
    function portrait(cnv, c, big) {
        const g = cnv.getContext("2d"), src = big && c.img ? c.img : c.face;
        if (cnv._v) { cnv._v.destroy(); cnv._v = null; }
        function draw(im) { g.clearRect(0, 0, cnv.width, cnv.height); g.fillStyle = c.color; g.fillRect(0, 0, cnv.width, cnv.height); const s = Math.min(im.naturalWidth, im.naturalHeight); g.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, cnv.width, cnv.height); }
        if (src) { c._pi = c._pi || {}; const im = c._pi[src] || (c._pi[src] = loadImg(src)); if (ready(im)) draw(im); else { im.addEventListener("load", function () { draw(im); }); } if (ready(im) || im.complete === false) return; }
        if (c.id === "main" && window.RunMilHero && RunMilHero.view) { cnv._v = RunMilHero.view(cnv, { head: true }); return; }
        const a = prep(c).run;                                           // fallback: the head from her running sheet
        function head() { if (!a || !ready(a.img)) { setTimeout(head, 200); return; } g.clearRect(0, 0, cnv.width, cnv.height); g.fillStyle = c.color; g.fillRect(0, 0, cnv.width, cnv.height); const q = a.fh * 0.27; g.drawImage(a.img, a.ax - q / 2 - a.fw * 0.05, 0, q, q, 0, 0, cnv.width, cnv.height); }
        head();
    }

    // ---------- arenas ----------
    const ARENAS = [
        { n: "THE CONVENIENCE STORE", f: "visuals/survival/level1.webp", t: "visuals/survival/thumb1.jpg", band: [400, 480] },
        { n: "THE CLOWN", f: "visuals/survival/level2.webp", t: "visuals/survival/thumb2.jpg", band: [398, 470] },
        { n: "HAUNTED CINEMA", f: "visuals/survival/level3.webp", t: "visuals/survival/thumb3.jpg", band: [440, 520], px: 1 },
        { n: "CARNIVAL NIGHTMARE", f: "visuals/survival/level4.webp", t: "visuals/survival/thumb4.jpg", band: [462, 522], px: 1 }
    ];
    ARENAS.forEach(function (a) { a.img = loadImg(a.f); });
    let arena = ARENAS[0];

    // ---------- state ----------
    const sv = (function () { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } })();
    const pick = [0, 1], ar = { i: -1 };
    function okIdx(i, other) { return CH[i] && CH[i].open ? i : (other === 0 ? 1 : 0); }
    if (typeof sv.p1 === "number" && CH[sv.p1] && CH[sv.p1].open) pick[0] = sv.p1;
    if (typeof sv.p2 === "number" && CH[sv.p2] && CH[sv.p2].open) pick[1] = sv.p2; else pick[1] = CH.findIndex(function (c, i) { return i > 0 && c.open; }) > 0 ? CH.findIndex(function (c, i) { return i > 0 && c.open; }) : 0;
    if (typeof sv.ar === "number") ar.i = sv.ar;
    function save() { try { localStorage.setItem(KEY, JSON.stringify({ p1: pick[0], p2: pick[1], ar: ar.i })); } catch (e) { /* storage unavailable */ } }

    let F = [], objs = [], parts = [], floats = [], ph = "select", pt = 0, rn = 0, wins = [0, 0], timeLeft = 60, shake = 0, hitStop = 0, slow = 0, paused = false, result = null, rrec = [];
    const ROUNDS = 3, ROUND_T = 60;
    const SPEED = 270, LANE = 150, GRAV = 2300, JUMP_V = 800, AIR = 2 * JUMP_V / GRAV, STAND = 175, DUCK = 100, EN_REGEN = 2.5, FLAME_COST = 10;
    const ATK = { punch: { ms: 290, a: [0.3, 0.7], reach: 100, zlo: 110, zhi: 210, dmg: 7 }, kick: { ms: 370, a: [0.38, 0.75], reach: 128, zlo: 10, zhi: 115, dmg: 11 } };
    const BX = [64, W - 64];

    function mk(i, c) {
        return { i: i, c: c, sv: prep(c), keys: {}, x: i ? 700 : 260, y: (arena.band[0] + arena.band[1]) / 2 + (i ? 10 : 0), z: 0, vz: 0, airT: 0, face: i ? -1 : 1, act: null, duck: false, duckT: 0, runT: 0, moving: false,
            hp: 100, en: 0, stun: 0, kx: 0, inv: 0, flash: 0, dead: 0, deadT: 0, fcd: 0, hc: 100 };
    }
    function newRound() {
        const a = F[0] ? F[0].c : CH[pick[0]], b = F[1] ? F[1].c : CH[pick[1]];
        F = [mk(0, a), mk(1, b)]; objs = []; parts = []; floats = []; timeLeft = ROUND_T; slow = 0; hitStop = 0;
        F.forEach(function (f) { const t = $("s" + (f.i + 1)); t.classList.remove("dead"); });
        hudNames();
    }

    // ---------- input ----------
    const KM = {
        KeyA: [0, "left"], KeyD: [0, "right"], KeyW: [0, "up"], KeyS: [0, "down"], KeyC: [0, "duck"], Space: [0, "jump"], KeyR: [0, "punch"], KeyF: [0, "kick"], KeyE: [0, "special"],
        ArrowLeft: [1, "left"], ArrowRight: [1, "right"], ArrowUp: [1, "up"], ArrowDown: [1, "down"], KeyO: [1, "duck"], KeyM: [1, "jump"], KeyP: [1, "punch"], KeyK: [1, "kick"], KeyL: [1, "special"]
    };
    addEventListener("keydown", function (e) {
        if (ph === "select") {
            if (NET.on) { if (e.code === "KeyA" || e.code === "ArrowLeft") cyc(NET.slot, -1); else if (e.code === "KeyD" || e.code === "ArrowRight") cyc(NET.slot, 1); else if (e.code === "Enter" && NET.host) startMatch(); return; }
            if (e.code === "KeyA") cyc(0, -1); else if (e.code === "KeyD") cyc(0, 1); else if (e.code === "ArrowLeft") cyc(1, -1); else if (e.code === "ArrowRight") cyc(1, 1); else if (e.code === "Enter") startMatch();
            if (/^(Arrow|Space)/.test(e.code)) e.preventDefault(); return;
        }
        if (window.RMX && RMX.vis.key(e) && ph !== "select") return;           // B = AABB vision
        if (e.code === "Escape") { if (!NET.on && (ph === "fight" || ph === "ready")) setPause(!paused); return; }
        if ((ph === "intro") && (e.code === "Enter" || e.code === "Space")) { if (!NET.on || NET.host) pt = Math.max(pt, 3.2); e.preventDefault(); return; }
        const m = KM[e.code]; if (!m) return; e.preventDefault();
        if (NET.on) {                                                   // online: everybody plays with the P1 keys / buttons
            if (m[0] !== 0 || e.repeat) return;
            if (!NET.host) { nsend({ t: "k", n: m[1], d: 1 }); return; }
        }
        const f = F[m[0]]; if (!f) return; f.keys[m[1]] = true;
        if (e.repeat) return;
        press(f, m[1]);
    });
    addEventListener("keyup", function (e) {
        const m = KM[e.code]; if (!m) return;
        if (NET.on) { if (m[0] !== 0) return; if (!NET.host) { nsend({ t: "k", n: m[1], d: 0 }); return; } }
        if (F[m[0]]) F[m[0]].keys[m[1]] = false;
    });
    addEventListener("blur", function () { if (NET.on && !NET.host) { nsend({ t: "clr" }); return; } F.forEach(function (f) { f.keys = {}; }); });

    function startAct(f, k) { if (f.act) return; f.act = { k: k, t: 0, dur: ATK[k].ms / 1000, done: false }; SF("swing", k); }
    function press(f, n) {                                             // one button press (jump, punch, kick, special) for fighter f
        if (paused || ph !== "fight" || f.dead || f.stun > 0) return;
        if (n === "jump" && f.z <= 0 && !f.duck && !f.act) { f.vz = JUMP_V; SF("jump"); }
        else if (n === "punch" || n === "kick") startAct(f, n);
        else if (n === "special") special(f);
    }

    // ---------- combat ----------
    function spark(x, y, col, n, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = (sp || 260) * (0.4 + Math.random()); parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.3 + Math.random() * 0.3, t: 0, col: col, r: 2 + Math.random() * 3 }); } }
    function floatText(t, x, y, col) { floats.push({ t: t, x: x, y: y, c: col || "#fff", a: 0 }); }
    function hitFx(d, dmg, strong) {                           // sparks, number, sound and shake of a hit (the guest phone plays them from a message)
        d.flash = 0.12; spark(d.x, d.y - d.z - 100, strong ? "#ffe27a" : "#fff", strong ? 16 : 8); floatText("-" + dmg, d.x, d.y - d.z - 190, strong ? "#ff9a3a" : "#fff");
        SFX("impact", dmg > 9 ? "kick" : "punch"); hitStop = strong ? 0.1 : 0.05; shake = Math.max(shake, strong ? 0.35 : 0.12);
    }
    function hurt(d, o, dmg, dir, strong) {                  // d = who gets hit, o = who hit
        if (d.dead || d.inv > 0 || ph !== "fight") return false;
        d.hp = Math.max(0, d.hp - dmg); d.flash = 0.12; d.act = null; d.stun = strong ? 0.55 : dmg <= 5 ? 0.16 : 0.3; d.kx = dir * (strong ? 560 : dmg <= 5 ? 90 : 300);
        o.en = Math.min(100, o.en + (strong || dmg <= 5 ? 0 : 13)); d.en = Math.min(100, d.en + 6);
        hitFx(d, dmg, strong); if (NET.on && NET.host) NET.q.push(["h", d.i, dmg, strong ? 1 : 0]);
        if (d.hp <= 0) { d.dead = 1; d.deadT = 0; d.keys = {}; }
        return true;
    }
    // ---------- AABB (the same Java / JS engine as the other two games) ----------
    // every box is { x, y, w, h } with y = height above the lane (up is negative), like Monster Survival. The lane (depth) is checked separately.
    const AB = window.RunMilAABB, HW = 22;
    function overlap(a, b, tag, kind, lane) {
        const r = AB ? AB.overlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h) : (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
        if (r && tag && window.RMX) RMX.vis.hit({ x: a.x, y: a.y + lane, w: a.w, h: a.h }, { x: b.x, y: b.y + lane, w: b.w, h: b.h }, tag, kind || "atk", 0, 0);
        return r;
    }
    function bodyBox(f) { const h = f.duck ? DUCK : STAND; return { x: f.x - HW, y: -(f.z + h), w: HW * 2, h: h }; }       // follows ducking and jumping
    function atkBox(f) { const A = ATK[f.act.k]; return { x: f.face > 0 ? f.x + 8 : f.x - 8 - A.reach, y: -(f.z + A.zhi), w: A.reach, h: A.zhi - A.zlo }; }
    function attackCheck(f, o) {
        const A = ATK[f.act.k], p = f.act.t / f.act.dur; if (f.act.done || p < A.a[0] || p > A.a[1] || o.dead) return;
        if (Math.abs(o.y - f.y) < 34 && overlap(atkBox(f), bodyBox(o), f.act.k === "kick" ? "KICK" : "PUNCH", "atk", o.y)) { f.act.done = true; hurt(o, f, A.dmg, f.face, false); }
    }
    function FT(t, x, y, c) { floatText(t, x, y, c); if (NET.on && NET.host) NET.q.push(["f", t, rr(x), rr(y), c]); }
    function SK(v) { shake = Math.max(shake, v); if (NET.on && NET.host) NET.q.push(["k", v]); }
    function special(f) {
        const o = F[1 - f.i], k = f.c.special;
        if (k === "flames") {
            if (f.fcd > 0) return;
            if (f.en < FLAME_COST) { FT("NO ENERGY", f.x, f.y - 200, "#9ab0ff"); f.fcd = 0.25; return; }
            f.en -= FLAME_COST; f.fcd = 0.12; objs.push({ k: "flame", o: f, x: f.x + f.face * 34, y: f.y, face: f.face, t: 0, hit: false }); SF("boom"); SK(0.05); return;
        }
        if (f.en < 100) return;
        f.en = 0; f.inv = 0.5; SK(0.4); SF("boom"); FT("SPECIAL!", f.x, f.y - 210, f.c.color);
        if (k === "spikes" || k === "land") objs.push({ k: "spikes", o: f, x: f.x, y: f.y, t: 0, hit: false, col: f.c.color, land: k === "land" });
        else if (k === "wind") objs.push({ k: "wind", o: f, x: f.x + f.face * 70, y: f.y, face: f.face, t: 0, hit: false });
        else if (k === "water") objs.push({ k: "water", o: f, x: f.x + f.face * 50, y: f.y, face: f.face, t: 0, hit: false });
        else objs.push({ k: "ring", o: f, x: f.x, y: f.y, t: 0, r: 0, hit: false });
    }
    function updateObjs(dt) {
        objs.forEach(function (s) {
            s.t += dt; const o = F[1 - s.o.i], bb = bodyBox(o);
            if (s.k === "ring") {                                        // the shockwave is a wide box that grows; a jump clears it
                s.r = s.t * 800;
                if (!s.hit && !o.dead && Math.abs(o.y - s.y) < 110 && overlap({ x: s.x - s.r, y: -110, w: s.r * 2, h: 110 }, bb, "SHOCKWAVE", "atk", s.y)) { s.hit = true; hurt(o, s.o, 26, o.x < s.x ? -1 : 1, true); }
                s.dead = s.t > 0.7;
            } else if (s.k === "spikes") {                               // the spike nearest to the other fighter is a tall box (spikes come out in every direction, a jump doesn't help)
                const r = Math.min(1, s.t / 0.6) * 300, step = Math.PI * 2 / (s.land ? 10 : 16), dx = o.x - s.x, dy = (o.y - s.y) / 0.35, rm = Math.hypot(dx, dy);
                if (!s.hit && !o.dead && rm <= r + 20) {
                    const tn = Math.round(Math.atan2(dy, dx) / step) * step, sx = s.x + Math.cos(tn) * rm, sy = s.y + Math.sin(tn) * rm * 0.35;
                    if (Math.abs(o.y - sy) <= 46 && overlap({ x: sx - 30, y: -260, w: 60, h: 260 }, bb, "SPIKE", "atk", sy)) { s.hit = true; hurt(o, s.o, 28, dx < 0 ? -1 : 1, true); }
                }
                s.dead = s.t > (s.land ? 1.7 : 1);
            } else if (s.k === "water") {                                // a tidal wave rolls along the ground (a box 130 x 170): it throws the other fighter back, a jump over it is too late once it is on you
                s.x += s.face * 560 * dt;
                if (!s.hit && !o.dead && Math.abs(o.y - s.y) < 60 && overlap({ x: s.x - 65, y: -170, w: 130, h: 170 }, bb, "WATER", "atk", s.y)) { s.hit = true; hurt(o, s.o, 25, s.face, true); }
                s.dead = s.t > 1.3 || s.x < -150 || s.x > W + 150;
            } else if (s.k === "wind") {                                 // a whirlwind rolls forward (a box 150 x 190); it knocks the other fighter far back
                s.x += s.face * 430 * dt; const kk = Math.min(1, 0.4 + s.t / 0.25 * 0.6);
                if (!s.hit && !o.dead && Math.abs(o.y - s.y) < 60 && overlap({ x: s.x - 75 * kk, y: -190 * kk, w: 150 * kk, h: 190 * kk }, bb, "WIND", "atk", s.y)) { s.hit = true; hurt(o, s.o, 24, s.face, true); }
                s.dead = s.t > 1.5 || s.x < -100 || s.x > W + 100;
            } else {                                                     // a flame is a moving box at hand height
                s.x += s.face * 540 * dt;
                if (!s.hit && !o.dead && Math.abs(o.y - s.y) < 34 && overlap({ x: s.x - 46, y: -150, w: 92, h: 90 }, bb, "FLAME", "atk", s.y)) { s.hit = true; hurt(o, s.o, 5, s.face, false); }
                s.dead = s.t > 0.6 || s.x < 0 || s.x > W;
            }
        });
        objs = objs.filter(function (s) { return !s.dead; });
    }
    function stepF(f, o, dt) {
        f.fcd = Math.max(0, f.fcd - dt); f.inv = Math.max(0, f.inv - dt); f.flash = Math.max(0, f.flash - dt);
        if (f.dead) { f.deadT += dt; return; }
        f.en = Math.min(100, f.en + EN_REGEN * dt);
        const k = f.keys, fight = ph === "fight";
        if (f.kx) { f.x += f.kx * dt; const d = 1500 * dt; f.kx = Math.abs(f.kx) <= d ? 0 : f.kx - Math.sign(f.kx) * d; }
        f.moving = false;
        if (f.stun > 0) { f.stun -= dt; f.act = null; }
        else if (f.act) { f.act.t += dt; if (f.act.t >= f.act.dur) f.act = null; else attackCheck(f, o); }
        if (fight && f.stun <= 0 && !f.act) {
            const dir = (k.right ? 1 : 0) - (k.left ? 1 : 0), vd = (k.down ? 1 : 0) - (k.up ? 1 : 0);
            f.duck = !!k.duck && f.z <= 0;
            if (f.duck) f.duckT += dt * 1000; else { f.duckT = 0; if (dir || vd) { f.x += dir * SPEED * dt; f.y += vd * LANE * dt; f.moving = true; f.runT += dt * 1000; } }
        } else if (f.stun > 0 || f.act) f.duck = f.act ? f.duck && f.z <= 0 : false;
        if (f.z > 0 || f.vz > 0) { f.z += f.vz * dt; f.vz -= GRAV * dt; f.airT += dt; if (f.z <= 0) { f.z = 0; f.vz = 0; f.airT = 0; } }
        f.x = Math.max(BX[0], Math.min(BX[1], f.x)); f.y = Math.max(arena.band[0], Math.min(arena.band[1], f.y));
        if (!f.act && f.stun <= 0 && !f.dead) f.face = o.x > f.x + 4 ? 1 : o.x < f.x - 4 ? -1 : f.face;                // always face the other fighter
    }
    function separate() {                                         // the two fighters can't walk through each other
        const a = F[0], b = F[1]; if (a.dead || b.dead) return;
        const dx = b.x - a.x; if (Math.abs(dx) < 46 && Math.abs(a.y - b.y) < 26 && Math.abs(a.z - b.z) < 100) { const push = (46 - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1); a.x -= push; b.x += push; }
    }

    // ---------- rounds ----------
    function banner(txt, cls, sub) { const b = $("bn"); b.className = cls || ""; b.innerHTML = txt ? "<b>" + txt + "</b>" + (sub ? "<small>" + sub + "</small>" : "") : ""; }
    function names() { return [F[0] ? F[0].c.name : CH[pick[0]].name, F[1] ? F[1].c.name : CH[pick[1]].name]; }
    function startMatch(fa) {
        if (ph !== "select") return; if (NET.on && !NET.host && typeof fa !== "number") return; if (!NET.on) save();
        const ai = typeof fa === "number" ? fa : ar.i >= 0 ? ar.i : Math.floor(Math.random() * ARENAS.length);
        arena = ARENAS[ai]; if (NET.on && NET.host) nsend({ t: "start", p: [CH[pick[0]].id, CH[pick[1]].id], a: ai });
        F = []; newRound(); wins = [0, 0]; rn = 0; rrec = [];
        $("select").hidden = true; $("win").hidden = true; $("hud").hidden = true; banner("");
        const c = [CH[pick[0]], CH[pick[1]]];
        $("vn1").textContent = c[0].name; $("vn2").textContent = c[1].name; $("vsp1").textContent = c[0].sp ? "SPECIAL: " + c[0].sp : ""; $("vsp2").textContent = c[1].sp ? "SPECIAL: " + c[1].sp : ""; $("vsa").textContent = arena.n;
        portrait($("vpf1"), c[0], true); portrait($("vpf2"), c[1], true);
        const vs = $("vs"); vs.hidden = false; vs.querySelectorAll(".vs-l,.vs-r,.vs-x,.vs-flash,.vs-arena").forEach(function (el) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; });
        ph = "intro"; pt = 0; SFX("boom");
        if (window.RunMilAudio) { try { RunMilAudio.stop(); } catch (e) { /* ignore */ } }      // no background music in the fight
    }
    function beginRound() {
        rn++; newRound(); $("vs").hidden = true; $("hud").hidden = false; ph = "ready"; pt = 0; hudKeys();
        banner("ROUND " + (rn > ROUNDS ? "X" : rn), "", rn > ROUNDS ? "SUDDEN DEATH" : rn === ROUNDS ? "FINAL ROUND" : ""); if (rn > ROUNDS) $("bn").querySelector("b").textContent = "FINAL ROUND";
        SFX("item"); hudPips(); if (NET.on && NET.host) nsend({ t: "ev", e: "round" });
    }
    function goFight() { ph = "fight"; pt = 0; banner("FIGHT!", "fight"); SFX("boom"); setTimeout(function () { if (ph === "fight") banner(""); }, 900); if (NET.on && NET.host) nsend({ t: "ev", e: "go" }); }
    function endRound(why) {
        const a = F[0], b = F[1]; let w = -1;
        if (why === "ko") { if (a.dead && !b.dead) w = 1; else if (b.dead && !a.dead) w = 0; }
        else if (a.hp !== b.hp) w = a.hp > b.hp ? 0 : 1;
        if (NET.on && NET.host) { sendSnap(); nsend({ t: "ev", e: "ko", w: w, why: why }); }
        applyKO(w, why);
    }
    function applyKO(w, why) {
        const a = F[0], b = F[1];
        result = { w: w, why: why }; if (w >= 0) wins[w]++; rrec.push(w);
        ph = "ko"; pt = 0; slow = 1.4; shake = 0.6; F.forEach(function (f) { f.keys = {}; f.act = null; });
        banner(why === "ko" ? (a.dead && b.dead ? "DOUBLE K.O." : "K.O.") : "TIME UP", "ko"); SFX("over"); SFX("boom");
        F.forEach(function (f) { if (f.dead) $("s" + (f.i + 1)).classList.add("dead"); });
        hudPips();
    }
    function afterKO() {
        const nm = names(), r = result; let txt, sub = "";
        if (r.w < 0) txt = "DRAW"; else { txt = nm[r.w] + " WINS"; sub = "ROUND " + rrec.length; }
        banner(txt, "", sub); ph = "result"; pt = 0; SFX("item"); if (NET.on && NET.host) nsend({ t: "ev", e: "after" });
    }
    function startGG() { ph = "gg"; pt = 0; banner("GAME!", "ko"); SFX("boom"); if (NET.on && NET.host) nsend({ t: "ev", e: "gg" }); }
    function afterResult() {
        const done = rn >= ROUNDS && wins[0] !== wins[1];
        if (done) startGG(); else beginRound();
    }
    function setPause(p) { paused = p; $("pause").hidden = !p; if (window.RunMilAudio && RunMilAudio.pause) { try { RunMilAudio.pause(p); } catch (e) { /* ignore */ } } }

    // ---------- HUD ----------
    function hudNames() {
        const c = [F[0].c, F[1].c];
        $("n1").textContent = c[0].name; $("n2").textContent = c[1].name;
        $("pf1")._c !== c[0] && (portrait($("pf1"), c[0]), $("pf1")._c = c[0]); $("pf2")._c !== c[1] && (portrait($("pf2"), c[1]), $("pf2")._c = c[1]);
    }
    function hudKeys() { if (NET.on) { $("keys").innerHTML = "<b>A D W S</b> move &bull; <b>SPACE</b> jump &bull; <b>C</b> duck &bull; <b>R</b> punch &bull; <b>F</b> kick &bull; <b>E</b> special"; return; } $("keys").innerHTML = "<b>Esc</b> pause &bull; P1: <b>A D W S</b> move &bull; <b>SPACE</b> jump &bull; <b>C</b> duck &bull; <b>R</b> punch &bull; <b>F</b> kick &bull; <b>E</b> special &nbsp; P2: <b>&#9664; &#9654; &#9650; &#9660;</b> &bull; <b>M</b> jump &bull; <b>O</b> duck &bull; <b>P</b> punch &bull; <b>K</b> kick &bull; <b>L</b> special"; }
    function hudPips() { [1, 2].forEach(function (n) { let h = ""; for (let i = 0; i < ROUNDS; i++) h += '<i class="' + (i < wins[n - 1] ? "w" : "") + '"></i>'; $("pp" + n).innerHTML = h; }); }
    function hud() {
        F.forEach(function (f) {
            const n = f.i + 1, hp = f.hp, need = f.c.special === "flames" ? FLAME_COST : 100, full = !f.dead && f.en >= need;
            $("hf" + n).style.width = hp + "%"; $("hc" + n).style.width = hp + "%"; $("hf" + n).parentNode.classList.toggle("low", hp > 0 && hp <= 25);
            $("ef" + n).style.width = f.en + "%"; $("ef" + n).parentNode.classList.toggle("full", full); $("et" + n).textContent = full ? (NET.on ? "!" : f.i ? "L!" : "E!") : "";
        });
        $("rnd").textContent = rn > ROUNDS ? "SUDDEN DEATH" : "ROUND " + Math.max(1, rn); const t = Math.max(0, Math.ceil(timeLeft)); $("tm").textContent = t; $("tm").classList.toggle("low", t <= 10 && ph === "fight");
    }

    // ---------- update ----------
    function update(dt) {
        if (paused) return;
        if (NET.on && !NET.host) { updateGuest(dt); return; }
        if (hitStop > 0) { hitStop -= dt; dt *= 0.05; } else if (slow > 0) { slow -= dt; dt *= 0.35; }
        shake = Math.max(0, shake - dt * 1.2);
        pt += dt;
        if (ph === "intro") { if (pt > 3.3) beginRound(); }
        else if (ph === "ready") { if (pt > 1.5) goFight(); }
        else if (ph === "fight") {
            timeLeft -= dt;
            if (F[0].dead || F[1].dead) endRound("ko"); else if (timeLeft <= 0) { timeLeft = 0; endRound("time"); }
        } else if (ph === "ko") { if (pt > 2.6) afterKO(); }
        else if (ph === "result") { if (pt > 2) afterResult(); }
        else if (ph === "gg") { if (pt > 1.8) showWin(); }
        if (F.length) { stepF(F[0], F[1], dt); stepF(F[1], F[0], dt); separate(); updateObjs(dt); }
        parts.forEach(function (p) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt; }); parts = parts.filter(function (p) { return p.t < p.life; });
        floats.forEach(function (f) { f.a += dt; f.y -= 50 * dt; }); floats = floats.filter(function (f) { return f.a < 0.9; });
        if (ph !== "select" && F.length) hud();
        if (NET.on && NET.host && F.length && ph !== "intro") { NET.t += dt; if (NET.t >= 1 / 30) { NET.t = 0; sendSnap(); } }
    }

    // ---------- two-device play: what the host phone reports every 1/30 s, and how the guest phone draws it ----------
    function sendSnap() {
        const q = NET.q; NET.q = [];
        nsend({ t: "s", n: ++NET.seq, tm: rr(timeLeft, 2), e: q,
            f: F.map(function (f) { return [rr(f.x), rr(f.y), rr(f.z), f.face, f.duck ? 1 : 0, rr(f.duckT), rr(f.runT), f.moving ? 1 : 0, rr(f.hp), rr(f.en), rr(f.stun, 2), f.dead ? 1 : 0, rr(f.deadT, 2), rr(f.inv, 2), rr(f.airT, 2), rr(f.vz), f.act ? f.act.k : 0, f.act ? rr(f.act.t, 3) : 0]; }),
            o: objs.map(function (s) { return [s.k, rr(s.x), rr(s.y), rr(s.t, 3), s.face || 0, s.land ? 1 : 0, s.o.i]; }) });
    }
    function applySnap(m) {
        if (!F.length || m.n <= NET.last) return; NET.last = m.n; timeLeft = m.tm;
        m.f.forEach(function (a, i) {
            const f = F[i]; if (!f) return;
            f.tx = a[0]; f.ty = a[1]; f.tz = a[2]; if (!f.seen) { f.seen = 1; f.x = a[0]; f.y = a[1]; f.z = a[2]; }
            f.face = a[3]; f.duck = !!a[4]; f.duckT = a[5]; f.runT = a[6]; f.moving = !!a[7]; f.hp = a[8]; f.en = a[9]; f.stun = a[10]; f.dead = a[11]; f.deadT = a[12]; f.inv = a[13]; f.airT = a[14]; f.vz = a[15];
            f.act = a[16] ? { k: a[16], t: a[17], dur: ATK[a[16]].ms / 1000, done: true } : null;
        });
        objs = m.o.map(function (a) { return { k: a[0], x: a[1], y: a[2], t: a[3], face: a[4], land: !!a[5], o: F[a[6]], r: a[3] * 800 }; });
        m.e.forEach(function (e) {
            if (e[0] === "s") SFX(e[1], e[2] || undefined); else if (e[0] === "k") shake = Math.max(shake, e[1]); else if (e[0] === "f") floatText(e[1], e[2], e[3], e[4]);
            else if (e[0] === "h" && F[e[1]]) hitFx(F[e[1]], e[2], !!e[3]);
        });
    }
    function updateGuest(dt) {                                      // the guest does not decide anything: it smooths and animates what the host sent
        shake = Math.max(0, shake - dt * 1.2); pt += dt; if (hitStop > 0) hitStop -= dt;
        F.forEach(function (f) {
            f.flash = Math.max(0, f.flash - dt); f.inv = Math.max(0, f.inv - dt);
            if (f.dead) f.deadT += dt; if (f.moving) f.runT += dt * 1000; if (f.duck) f.duckT += dt * 1000; if (f.z > 0 || f.vz > 0) f.airT += dt; if (f.act) f.act.t = Math.min(f.act.dur, f.act.t + dt);
            if (f.tx != null) { const k = Math.min(1, dt * 24); f.x += (f.tx - f.x) * k; f.y += (f.ty - f.y) * k; f.z += (f.tz - f.z) * k; }
        });
        objs.forEach(function (s) { s.t += dt; if (s.k === "wind") s.x += s.face * 430 * dt; else if (s.k === "water") s.x += s.face * 560 * dt; else if (s.k === "flame") s.x += s.face * 540 * dt; else if (s.k === "ring") s.r = s.t * 800; });
        parts.forEach(function (p) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt; }); parts = parts.filter(function (p) { return p.t < p.life; });
        floats.forEach(function (f) { f.a += dt; f.y -= 50 * dt; }); floats = floats.filter(function (f) { return f.a < 0.9; });
        if (ph !== "select" && F.length) hud();
    }

    // ---------- drawing ----------
    function drawBg() {
        const im = arena.img;
        if (!ready(im)) { ctx.fillStyle = "#0a1030"; ctx.fillRect(0, 0, W, H); return; }
        const s = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
        ctx.imageSmoothingEnabled = !arena.px; ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(0,0,20,.35)"); g.addColorStop(1, "rgba(0,0,20,.1)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    function pickA(f) {
        const V = f.sv;
        if (f.dead) return [V.run, 0];
        if (f.act && V[f.act.k]) { const a = V[f.act.k]; return [a, Math.min(a.n - 1, Math.floor(f.act.t / f.act.dur * a.n))]; }
        if ((f.z > 0 || f.vz > 0) && V.jump) return [V.jump, Math.min(V.jump.n - 1, Math.floor(Math.min(1, f.airT / AIR) * V.jump.n))];
        if (f.duck && V.crouch) return [V.crouch, frameAt(V.crouch, f.duckT)];
        if (f.stun > 0) return [V.run, 0];
        if (f.moving) return [V.run, frameAt(V.run, f.runT)];
        return [V.run, 0];
    }
    function shadow(x, y, w, z) { ctx.fillStyle = "rgba(0,0,0," + (0.4 - Math.min(0.22, z / 500)).toFixed(2) + ")"; ctx.beginPath(); ctx.ellipse(x, y, w * (1 - Math.min(0.3, z / 500)), w * 0.24, 0, 0, 7); ctx.fill(); }
    function glitch(f, a, fr, sc) {
        const k = f.deadT / GLITCH_T, N = 12, sh = a.fh / N, sw = a.fw * sc, col = fr % a.cols * a.fw, row = Math.floor(fr / a.cols) * a.fh;
        ctx.save(); ctx.translate(f.x, f.y - f.z); if (f.face > 0) ctx.scale(-1, 1);
        for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < N; i++) {
                if (Math.random() < 0.18 + k * 0.5) continue;
                const off = (Math.random() - 0.5) * (14 + 70 * k) * (Math.random() < 0.35 ? 2 : 0.4) + (pass ? 8 : 0);
                ctx.globalAlpha = (pass ? 0.35 : 0.5 + Math.random() * 0.5) * (1 - k * 0.6); if (pass) ctx.globalCompositeOperation = "lighter";
                ctx.drawImage(a.img, col, row + i * sh, a.fw, sh, -a.ax * sc + off, (-a.gy + i * sh) * sc, sw, sh * sc + 0.6);
            }
            ctx.globalCompositeOperation = "source-over";
        }
        for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.25 + Math.random() * 0.35; ctx.fillStyle = Math.random() < 0.5 ? "#18f0ff" : "#ff2aa0"; ctx.fillRect(-a.ax * sc * (0.2 + Math.random() * 0.8), -a.gy * sc * Math.random(), sw * (0.2 + Math.random() * 0.7), 2 + Math.random() * 5); }
        ctx.restore();
    }
    function drawF(f) {
        if (f.dead && f.deadT > GLITCH_T) return;
        shadow(f.x, f.y, 46 * (f.dead ? 1 - f.deadT / GLITCH_T : 1), f.z);
        const pk = pickA(f), a = pk[0], fr = pk[1]; if (!a || !ready(a.img)) return;
        const sc = a.sc; if (f.dead) { glitch(f, a, fr, sc); return; }
        ctx.save(); ctx.translate(f.x, f.y - f.z);
        if (f.inv > 0 && f.inv < 0.45 && Math.floor(f.inv * 16) % 2) ctx.globalAlpha = 0.5;
        if (!PERF) { if (f.flash > 0) ctx.filter = "brightness(2.4)"; else if (F[0].c === F[1].c && f.i) ctx.filter = "hue-rotate(150deg) saturate(1.2)"; } else if (f.flash > 0) ctx.globalAlpha = 0.55;
        if (f.face > 0) ctx.scale(-1, 1);
        ctx.drawImage(a.img, (fr % a.cols) * a.fw, Math.floor(fr / a.cols) * a.fh, a.fw, a.fh, -a.ax * sc, -a.gy * sc, a.fw * sc, a.fh * sc);
        ctx.restore();
        if (ph === "fight" || ph === "ready") {                           // P1 / P2 tag above the head
            const col = f.i ? "#ff5aa8" : "#4a9cff", ty = f.y - f.z - (f.duck ? DUCK : STAND) - 16;
            ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = "#0a0a28"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x - 9, ty - 4); ctx.lineTo(f.x + 9, ty - 4); ctx.lineTo(f.x, ty + 8); ctx.closePath(); ctx.stroke(); ctx.fill();
            ctx.font = "700 20px Teko, Impact, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.lineWidth = 4; ctx.fillStyle = "#fff"; ctx.strokeText("P" + (f.i + 1), f.x, ty - 5); ctx.fillText("P" + (f.i + 1), f.x, ty - 5); ctx.restore();
        }
    }
    function drawObjs(front) {
        objs.forEach(function (s) {
            if (s.k === "ring") {
                if (front) return; const al = Math.max(0, 1 - s.t / 0.7);
                ctx.save(); ctx.globalAlpha = al; ctx.strokeStyle = "#ffe27a"; ctx.lineWidth = 10 * al + 2; ctx.beginPath(); ctx.ellipse(s.x, s.y - 6, s.r, s.r * 0.3, 0, 0, 7); ctx.stroke(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
                ctx.globalAlpha = al * 0.25; ctx.fillStyle = "#ffe27a"; ctx.fill(); ctx.restore();
            } else if (s.k === "spikes") {
                if (front) return; const n = s.land ? 10 : PERF ? 12 : 16, step = Math.PI * 2 / n, al = Math.max(0, Math.min(1, 1 - (s.t - 0.7) / 0.3)), L = [];
                const gl = ctx.createRadialGradient(s.x, s.y - 6, 10, s.x, s.y - 6, 300 * Math.min(1, s.t / 0.6)); gl.addColorStop(0, s.land ? "rgba(190,130,70,.35)" : "rgba(220,170,255,.35)"); gl.addColorStop(1, s.land ? "rgba(120,70,30,0)" : "rgba(176,92,255,0)");
                ctx.save(); ctx.globalAlpha = al * 0.6; ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(s.x, s.y - 6, 300, 105, 0, 0, 7); ctx.fill();
                for (let i = 0; i < n; i++) for (let rk = 50; rk <= 300; rk += (s.land ? 120 : 80)) {
                    const tk = s.t - rk / 300 * 0.6; if (tk < 0) continue; const a = i * step, g = Math.min(1, tk / 0.1), h = (48 + 40 * rk / 300) * (g * (2 - g));
                    L.push({ x: s.x + Math.cos(a) * rk, y: s.y + Math.sin(a) * rk * 0.35, h: h, w: 8 + 5 * rk / 300, o: i % 2 ? 4 : -4, tk: tk, rk: rk });
                }
                L.sort(function (p, q) { return p.y - q.y; }); ctx.globalAlpha = al; ctx.lineJoin = "round";
                L.forEach(function (p) {
                    if (s.land) {                                                // an eruption of earth: the 9 pictures of the sprite play once at every spot
                        const fx = s.o.c.fx, im = s.o.c.fxImg, fr = Math.floor(p.tk / (fx.ms / 1000)); if (fr >= fx.n || !ready(im)) return;
                        const k = 0.36 + 0.22 * p.rk / 300; ctx.drawImage(im, fr * fx.fw, 0, fx.fw, fx.fh, p.x - fx.fw * k / 2, p.y - fx.fh * k + 6, fx.fw * k, fx.fh * k); return;
                    }
                    const gr = ctx.createLinearGradient(0, p.y, 0, p.y - p.h); gr.addColorStop(0, "#4a1496"); gr.addColorStop(0.55, "#b05cff"); gr.addColorStop(1, "#f6e4ff");
                    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w * 1.3, p.w * 0.4, 0, 0, 7); ctx.fill();
                    ctx.fillStyle = gr; ctx.strokeStyle = "#1c0640"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - p.w, p.y); ctx.lineTo(p.x + p.o, p.y - p.h); ctx.lineTo(p.x + p.w, p.y); ctx.closePath(); ctx.fill(); ctx.stroke();
                });
                ctx.restore();
            } else if (s.k === "water") {
                if (!front) return; const fx = s.o.c.fx, im = s.o.c.fxImg; if (!fx || !ready(im)) return;
                const x0 = s.x - s.face * 560 * s.t, kk = 0.62, al = Math.max(0, Math.min(1, (1.3 - s.t) / 0.3));
                ctx.save(); ctx.globalAlpha = al;
                for (let i = 0; i * 75 <= 560 * 1.3; i++) {
                    const tk = s.t - i * 75 / 560; if (tk < 0) break; const fr = Math.floor(tk / (fx.ms / 1000)); if (fr >= fx.n) continue;
                    ctx.drawImage(im, fr * fx.fw, 0, fx.fw, fx.fh, x0 + s.face * i * 75 - fx.fw * kk / 2, s.y - fx.fh * kk + 8, fx.fw * kk, fx.fh * kk);
                }
                ctx.restore();
            } else if (s.k === "wind") {
                if (!front) return; const fx = s.o.c.fx, im = s.o.c.fxImg; if (!fx || !ready(im)) return;
                const k = Math.min(1, 0.4 + s.t / 0.25 * 0.6) * 0.95, fr = Math.floor(s.t / (fx.ms / 1000)) % fx.n, al = Math.min(1, (1.5 - s.t) / 0.3);
                ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.translate(s.x, s.y); ctx.drawImage(im, fr * fx.fw, 0, fx.fw, fx.fh, -fx.fw * k / 2, -fx.fh * k - 8, fx.fw * k, fx.fh * k); ctx.restore();
            } else if (front) {
                const fx = s.o.c.fx, im = s.o.c.fxImg; if (!fx || !ready(im)) return;
                const k = Math.min(1, 0.3 + s.t / 0.2 * 0.7), fr = Math.floor(s.t / (fx.ms / 1000)) % fx.n, al = Math.min(1, (0.6 - s.t) / 0.15);
                ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.translate(s.x, s.y - 104); if (s.face < 0) ctx.scale(-1, 1);
                ctx.drawImage(im, fr * fx.fw, 0, fx.fw, fx.fh, 0, -fx.fh * k / 2, fx.fw * k, fx.fh * k); ctx.restore();
            }
        });
    }
    function draw() {
        ctx.save(); ctx.clearRect(0, 0, W, H);
        if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 22, (Math.random() - 0.5) * shake * 22);
        drawBg();
        if (F.length) {
            drawObjs(false);
            F.slice().sort(function (a, b) { return a.y - b.y; }).forEach(drawF);
            drawObjs(true);
        }
        parts.forEach(function (p) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }); ctx.globalAlpha = 1;
        floats.forEach(function (f) { ctx.globalAlpha = Math.min(1, (0.9 - f.a) * 3); ctx.font = "700 34px Teko, Impact, sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 5; ctx.strokeStyle = "#000"; ctx.fillStyle = f.c; ctx.strokeText(f.t, f.x, f.y); ctx.fillText(f.t, f.x, f.y); }); ctx.globalAlpha = 1;
        if (window.RMX && RMX.vis.mode === 1 && F.length) {                  // AABB view: both fighters\' boxes (body + the attack that is out) and the lane lines
            F.forEach(function (f) {
                if (f.dead) return; const b = bodyBox(f), col = f.i ? "#ff5aa8" : "#4a9cff";
                ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.globalAlpha = 0.18; ctx.fillRect(b.x, f.y + b.y, b.w, b.h); ctx.globalAlpha = 1; ctx.strokeRect(b.x, f.y + b.y, b.w, b.h);
                if (f.act) { const a = atkBox(f); ctx.strokeStyle = "#ffb24a"; ctx.setLineDash([6, 4]); ctx.strokeRect(a.x, f.y + a.y, a.w, a.h); }
                ctx.setLineDash([]); ctx.font = "700 16px Teko, Impact, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = col; ctx.fillText("P" + (f.i + 1) + " box", f.x, f.y + b.y - 6); ctx.restore();
            });
            const nowT = performance.now(), vdt = Math.min(0.05, (nowT - (draw.vt || nowT)) / 1000); draw.vt = nowT; RMX.vis.draw(ctx, 0, 0, W, H, paused ? 0 : vdt);
        }
        ctx.restore();
    }

    // ---------- select screen ----------
    function drawPreview(cnv, idx, mirror, now) {
        const c = CH[idx], a = prep(c).run, g = cnv.getContext("2d"); g.clearRect(0, 0, cnv.width, cnv.height);
        if (!a || !ready(a.img)) return;
        const fr = frameAt(a, now), k = Math.min((cnv.height - 14) / a.fh, (cnv.width - 10) / a.fw);
        g.save(); g.translate(cnv.width / 2, cnv.height - 8); if (mirror) g.scale(-1, 1);
        g.drawImage(a.img, (fr % a.cols) * a.fw, Math.floor(fr / a.cols) * a.fh, a.fw, a.fh, -a.ax * k, -a.gy * k, a.fw * k, a.fh * k); g.restore();
    }
    function buildSelect() {
        [1, 2].forEach(function (n) {
            const box = $("cd" + n); box.innerHTML = "";
            for (let i = 0; i < 5; i++) {
                const c = CH[i], b = document.createElement("button"); b.className = "cd" + (c && c.open ? "" : " lock"); b.dataset.i = i;
                const cn = document.createElement("canvas"); cn.width = cn.height = 100; b.appendChild(cn);
                const sp = document.createElement("span"); sp.textContent = c && c.open ? c.name : "???"; b.appendChild(sp); box.appendChild(b);
                if (c && c.open) portrait(cn, c); else { const g = cn.getContext("2d"); g.fillStyle = "#222a5a"; g.fillRect(0, 0, 100, 100); }
            }
            box.onclick = function (e) { const b = e.target.closest(".cd"); if (!b || b.classList.contains("lock")) return; if (NET.on && n - 1 !== NET.slot) return; pick[n - 1] = +b.dataset.i; SFX("item"); sel(); pushSel(); };
        });
        const ab = $("arenas"); ab.innerHTML = "<em>ARENA</em>";
        const r = document.createElement("button"); r.className = "ar rnd"; r.textContent = "?"; r.dataset.i = -1; ab.appendChild(r);
        ARENAS.forEach(function (a, i) { const b = document.createElement("button"); b.className = "ar"; b.dataset.i = i; b.style.backgroundImage = "url(" + a.t + ")"; b.innerHTML = "<span>" + a.n.replace("THE ", "") + "</span>"; ab.appendChild(b); });
        ab.onclick = function (e) { const b = e.target.closest(".ar"); if (!b) return; if (NET.on && !NET.host) return; ar.i = +b.dataset.i; sel(); pushSel(); };
        sel();
    }
    function cyc(p, d) { let i = pick[p]; for (let k = 0; k < CH.length; k++) { i = (i + d + CH.length) % CH.length; if (CH[i].open) break; } pick[p] = i; SFX("item"); sel(); pushSel(); }
    function oneLine(t) { t = (t || "").trim(); const m = t.match(/^.*?[.!?](?=\s|$)/); return m ? m[0] : t; }          // the pick screen shows only the first sentence of a description
    function sel() {
        [1, 2].forEach(function (n) {
            const c = CH[pick[n - 1]];
            [].forEach.call($("cd" + n).children, function (b) { b.classList.toggle("on", +b.dataset.i === pick[n - 1]); });
            $("pnm" + n).textContent = c.name; $("psp" + n).textContent = c.sp ? "SPECIAL: " + c.sp : ""; $("psp" + n).hidden = !c.sp; $("pds" + n).textContent = oneLine(c.desc);
        });
        [].forEach.call($("arenas").querySelectorAll(".ar"), function (b) { b.classList.toggle("on", +b.dataset.i === ar.i); });
    }

    // ---------- winner screen ----------
    let conf = [], fire = [], winT = 0, winner = null;
    function showWin() {
        const w = wins[0] > wins[1] ? 0 : 1, c = F[w].c, l = F[1 - w].c; winner = c;
        ph = "win"; banner(""); $("hud").hidden = true; $("win").hidden = false; winT = 0; conf = []; fire = [];
        $("wname").textContent = c.name; $("wsub").textContent = "PLAYER " + (w + 1) + " • " + wins[w] + " - " + wins[1 - w]; $("lname").textContent = l.name;
        portrait($("wpf"), c, true); portrait($("lpf"), l, false);
        $("win").querySelectorAll(".w-ribbon,.w-card,#wpose,.w-lose,.w-btns").forEach(function (el) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; });
        $("wcard").style.setProperty("--wc", c.color);
        $("wpose").style.display = prep(c).jump ? "" : "none";
        SFX("item"); SFX("boom"); if (NET.on && NET.host) nsend({ t: "ev", e: "win" });
        if (window.RunMilAudio) { try { RunMilAudio.music("victory"); } catch (e) { /* ignore */ } }
        for (let i = 0; i < 140; i++) addConf(true);
    }
    const CC = ["#ffd24a", "#ff4a8a", "#4ac8ff", "#7dff8a", "#b05cff", "#fff", "#ff9a2a"];
    function addConf(init) { conf.push({ x: Math.random() * W, y: init ? -Math.random() * H : -10, vx: (Math.random() - 0.5) * 80, vy: 90 + Math.random() * 160, r: 5 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 9, c: CC[Math.floor(Math.random() * CC.length)], sw: Math.random() * 6 }); }
    function boom(x, y) { const col = CC[Math.floor(Math.random() * CC.length)]; for (let i = 0; i < 46; i++) { const a = i / 46 * 6.28, v = 120 + Math.random() * 160; fire.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 1 + Math.random() * 0.5, c: col }); } SFX("impact", "punch"); }
    function winFrame(dt) {
        winT += dt; const g = $("conf").getContext("2d"); g.clearRect(0, 0, W, H);
        if (conf.length < 170) addConf(false); if (conf.length < 170 && Math.random() < 0.6) addConf(false);
        conf.forEach(function (p) { p.x += (p.vx + Math.sin(winT * 3 + p.sw) * 40) * dt; p.y += p.vy * dt; p.rot += p.vr * dt; });
        conf = conf.filter(function (p) { return p.y < H + 20; });
        conf.forEach(function (p) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.scale(1, Math.abs(Math.sin(p.rot * 2)) * 0.8 + 0.2); g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); });
        if (Math.random() < dt * 1.8) boom(120 + Math.random() * 720, 80 + Math.random() * 200);
        fire.forEach(function (p) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; p.vx *= 0.985; });
        fire = fire.filter(function (p) { return p.t < p.life; });
        fire.forEach(function (p) { g.globalAlpha = Math.max(0, 1 - p.t / p.life); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 3, 0, 7); g.fill(); }); g.globalAlpha = 1;
        const a = winner && prep(winner).jump, pc = $("wpose");                // the winner jumps for joy
        if (a && ready(a.img)) {
            const q = pc.getContext("2d"), t = (winT * 1000) % (a.total + 600), fr = t < a.total ? frameAt(a, t) : a.n - 1, k = Math.min((pc.height - 20) / a.fh, (pc.width - 10) / a.fw);
            q.clearRect(0, 0, pc.width, pc.height); q.save(); q.translate(pc.width / 2, pc.height - 10); q.scale(-1, 1);
            q.drawImage(a.img, (fr % a.cols) * a.fw, Math.floor(fr / a.cols) * a.fh, a.fw, a.fh, -a.ax * k, -a.gy * k, a.fw * k, a.fh * k); q.restore();
        }
    }

    // ---------- buttons ----------
    function goHome() { if (window.parent !== window) parent.postMessage("runmil:home", "*"); else location.href = "index.html?menu"; }
    function toSelect() { ph = "select"; F = []; objs = []; $("win").hidden = true; $("hud").hidden = true; $("vs").hidden = true; $("pause").hidden = true; paused = false; banner(""); $("select").hidden = false; if (window.RunMilAudio) { try { RunMilAudio.stop(); } catch (e) { /* ignore */ } } buildSelect(); netUI(); if (NET.on) { if (NET.host) nsend({ t: "ev", e: "select" }); pushSel(); } }
    $("sel-back").addEventListener("click", function () { if (NET.on) { leaveNet(); return; } if (/[?&]from=sv/.test(location.search)) location.href = "survival.html"; else goHome(); });
    $("fight").addEventListener("click", function () { startMatch(); });
    function doCmd(c) { if (c === "rematch") { if (ph === "win" || ph === "select") { ph = "select"; startMatch(); } } else if (c === "rechoose") toSelect(); }
    function cmd(c) { if (NET.on && !NET.host) nsend({ t: "cmd", c: c }); else doCmd(c); }
    $("rematch").addEventListener("click", function () { cmd("rematch"); });
    $("rechoose").addEventListener("click", function () { cmd("rechoose"); });
    $("tomenu").addEventListener("click", function () { if (NET.on) { leaveNet(true); return; } goHome(); });
    $("resume").addEventListener("click", function () { setPause(false); });
    $("pquit").addEventListener("click", toSelect);
    $("pausebtn").addEventListener("click", function () { if (ph === "fight" || ph === "ready") setPause(true); });
    $("vs").addEventListener("click", function () { if (ph === "intro" && (!NET.on || NET.host)) pt = Math.max(pt, 3.2); });


    // ---------- two-device play: lobby (host / join), messages, leaving ----------
    function idx(id) { return Math.max(0, CH.findIndex(function (c) { return c.id === id; })); }
    function pushSel() { if (NET.on) nsend({ t: "sel", id: CH[pick[NET.slot]].id, a: NET.host ? ar.i : undefined }); }
    function netUI() {                                              // the pick screen while two devices are linked: you choose your own fighter, the host chooses the arena and starts
        const sc = $("select"), me = NET.slot + 1, rem = 3 - me;
        sc.classList.toggle("net", NET.on); sc.classList.toggle("guest", NET.on && !NET.host); sc.classList.remove("rem1", "rem2"); if (NET.on) sc.classList.add("rem" + rem);
        $("stage").classList.toggle("netplay", NET.on);
        const f = $("fight"); f.disabled = NET.on && !NET.host; f.textContent = NET.on && !NET.host ? "WAITING FOR HOST..." : "FIGHT!";
        $("pn-" + me).querySelector("h3").textContent = NET.on ? "YOU" : "PLAYER " + me;
        $("pn-" + rem).querySelector("h3").textContent = NET.on ? (NT.peerName() || "FRIEND") : "PLAYER " + rem;
        $("sel-sub").textContent = NET.on ? (NET.host ? "Pick your fighter and the arena. Press FIGHT when your friend is ready!" : "Pick your fighter. The host chooses the arena and starts the match.") : "Pick your fighters. Best of three rounds. Last one standing wins!";
    }
    function startNet(role) {
        NET.on = true; NET.host = role === "host"; NET.slot = NET.host ? 0 : 1; NET.q = []; NET.seq = 0; NET.last = 0; NET.gotSel = 0; if (window.RunMilLobby) RunMilLobby.hide();
        if (!CH[pick[NET.slot]].open) pick[NET.slot] = 0;
        ph = "select"; F = []; objs = []; $("select").hidden = false; $("win").hidden = true; $("hud").hidden = true; $("vs").hidden = true; $("pause").hidden = true; paused = false; banner("");
        buildSelect(); netUI(); sel(); nsend({ t: "hi" }); toast("CONNECTED TO " + (NT.peerName() || "FRIEND"));
    }
    function leaveNet(home) {
        const was = NET.on; if (NT) NT.close(); NET.on = false; NET.host = false; netUI(); toSelect();
        if (ONLY_NET) { if (home) goHome(); else showLobby(""); } else if (was) toast("DISCONNECTED");
    }
    function lost() {
        if (!NET.on) return; NET.on = false; NET.host = false; toSelect();
        if (ONLY_NET) showLobby("CONNECTION LOST. Check Bluetooth and try again."); else toast("CONNECTION LOST");
    }
    function toast(t) { const el = $("netmsg"); el.textContent = t; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); }
    function onEv(m) {
        if (m.e === "round") beginRound(); else if (m.e === "go") goFight(); else if (m.e === "ko") applyKO(m.w, m.why); else if (m.e === "after") afterKO();
        else if (m.e === "gg") startGG(); else if (m.e === "win") showWin(); else if (m.e === "select") toSelect();
    }
    function onNet(m) {
        if (!NET.on || !m) return;
        if (m.t === "hi") pushSel();
        else if (m.t === "sel") { pick[NET.slot ? 0 : 1] = idx(m.id); if (!NET.host && typeof m.a === "number") ar.i = m.a; if (ph === "select") { sel(); netUI(); } if (!NET.gotSel) { NET.gotSel = 1; pushSel(); } }
        else if (m.t === "start") { if (!NET.host) { ph = "select"; pick[0] = idx(m.p[0]); pick[1] = idx(m.p[1]); startMatch(m.a); } }
        else if (m.t === "ev") { if (!NET.host) onEv(m); }
        else if (m.t === "s") { if (!NET.host) applySnap(m); }
        else if (m.t === "k") { const f = F[1]; if (NET.host && f) { f.keys[m.n] = !!m.d; if (m.d) press(f, m.n); } }
        else if (m.t === "clr") { if (NET.host && F[1]) F[1].keys = {}; }
        else if (m.t === "cmd") { if (NET.host) doCmd(m.c); }
    }
    function showLobby(msg) { $("select").hidden = true; if (window.RunMilLobby) RunMilLobby.show({ msg: msg || "", onOpen: startNet, onBack: function () { if (/[?&]from=sv/.test(location.search)) location.href = "survival.html"; else if (ONLY_NET) goHome(); else { $("select").hidden = false; } } }); }
    if (NT) {
        NT.on("msg", onNet);
        NT.on("close", lost);
        if (NT.available() && !ONLY_NET) { const nb = $("vs-net"); nb.hidden = false; nb.addEventListener("click", function () { showLobby(""); }); }
    }

    // ---------- main loop ----------
    let last = performance.now();
    function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (ph === "select") { drawPreview($("pv1"), pick[0], true, now); drawPreview($("pv2"), pick[1], false, now); }
        else if (ph === "win") winFrame(dt);
        else { update(dt); draw(); }
        requestAnimationFrame(loop);
    }
    $("vs-how").addEventListener("click", function () { if (window.RMX) RMX.mechanics("versus", null, true); });
    buildSelect(); requestAnimationFrame(loop);
    if (ONLY_NET) showLobby("");
    if (window.RMX) RMX.mechanics("versus");                                  // the game mechanics card when 1 VS 1 opens (can be switched off; HOW TO PLAY brings it back)
    window.__vs = { net: NET, snap: sendSnap, state: function () { return { ph: ph, rn: rn, wins: wins.slice(), F: F, objs: objs, time: timeLeft }; }, F: function () { return F; }, pick: pick, start: startMatch, hurt: hurt, kill: function (i) { F[i].hp = 0; F[i].dead = 1; F[i].deadT = 0; }, skip: function () { pt = 99; }, special: special };
})();
