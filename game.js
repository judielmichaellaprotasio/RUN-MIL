/* =========================================================
   RUN MIL! - ENDLESS RUN
   - day / night cycle with the location's GIF backgrounds (visuals/backgrounds)
   - DAY  : vehicles, dangerous birds, utility poles with wires  -> jump or duck
   - NIGHT: monsters                                              -> jump, duck, punch (P) or kick (K)
   - items bought in the Equipment Shop sit on the left side (keys 1-4)
   - pause button, and "SAVE ME" (25 gems) to keep running after a hit

   YOUR OWN ART: drop PNG files into visuals/obstacles/ using the names in OB below
   (vehicle.png, bird_high.png, bird_low.png, pole_high.png, pole_low.png,
    ghoul.png, brute.png, wraith.png). Missing files use the built-in placeholder art.
   Hit-boxes are the numbers in OB (hw = half width, b / t = bottom / top height above the road).
========================================================= */
(function () {
    "use strict";
    const KEY = "runmil_save";
    const cv = document.getElementById("game"), ctx = cv.getContext("2d");
    const stage = document.getElementById("stage");
    const C = window.RunMilCharacter;
    const $ = (id) => document.getElementById(id);
    const SFX = function (n, a) { try { if (window.RunMilAudio) window.RunMilAudio.sfx(n, a); } catch (e) { /* audio is optional */ } };
    const AUD = function (n, a, b) { try { if (window.RunMilAudio) window.RunMilAudio[n](a, b); } catch (e) { /* audio is optional */ } };
    let W = 960, H = 540, GROUND = 462;

    function readSave() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
    function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ } }
    const save = readSave();
    const eqI = (save.items && save.items.equipped) || {};
    // Endless mode: weapons only (power-ups come back in Monster Survival).
    // Weapons are a stock bought in the shop (save.items.ammo): every shot uses one, across all runs, until it runs out.
    const has = () => false;
    const stock = (id) => (((readSave().items || {}).ammo || {})[id]) | 0;

    // ---------- tuning ----------
    const SPEED0 = 320 * (1 + (has("speedb") ? 0.06 : 0));
    const JUMP = 800 * (1 + (has("springb") ? 0.12 : 0));
    const GRAV = 2300;
    const STAND_H = 160, DUCK_H = 118, HALF_W = 18;
    const DUCK_VISUAL_H = 136;                           // on-screen height (px) of the crouch picture; the hitbox stays DUCK_H, so this is only how big it looks
    const DAY_LEN = 42, NIGHT_LEN = 42, FADE = 4, CYCLE = DAY_LEN + NIGHT_LEN + FADE * 2;
    const REVIVE_COST = 25;
    // pacing: the 1st day+night is slow, every following cycle is a bit faster (smooth, capped)
    const levelMul = (L) => Math.min(1.75, 0.80 + 0.13 * L);
    const PX = 170;                                       // player x

    // ---------- weapons from the shop (left side of the screen) ----------
    const WEAPONS_ALL = [
        { id: "pencil", name: "PENCIL", ammo: 0, cd: 0.30 },
        { id: "ruler", name: "RULER", ammo: 0, cd: 0.70 },
        { id: "laser", name: "LASER", ammo: 0, cd: 1.00 },
        { id: "blast", name: "BLAST", ammo: 0, cd: 1.20 }
    ];
    let WEAPONS = WEAPONS_ALL.filter((w) => stock(w.id) > 0);
    const BTN = { x: 14, y: 128, s: 60, gap: 12 };

    // ---------- obstacles + monsters ----------
    // hw: half width of the hit-box   b / t: bottom / top of the hit-box, in px above the road
    // dw / dh: size the art is drawn at   lift: height of the art's bottom above the road
    const OB = {
        vehicle:   { day: 1, solid: 1, plat: 1, hw: 66, b: 0,  t: 78,  dw: 170, dh: 86, lift: 0 },     // plat: you can land on the roof
        bird_high: { day: 1, fly: 1,   hw: 32, b: 124, t: 184, dw: 84,  dh: 66, lift: 120, vx: 90, anim: "bird", attack: "bird_attack" },
        bird_low:  { day: 1, fly: 1,   hw: 32, b: 18, t: 62,  dw: 84,  dh: 66, lift: 12, vx: 90, anim: "bird", attack: "bird_attack" },
        pole_high: { day: 1, solid: 1, hw: 56, b: 124, t: 700, dw: 160, dh: 340, lift: 0 },
        pole_low:  { day: 1, solid: 1, hw: 56, b: 0,  t: 54,  dw: 170, dh: 90, lift: 0 },
        ghoul:     { mon: 1, hp: 1, hw: 46, b: 0,  t: 80,  dw: 84,  dh: 100, lift: 0,  vx: 70, anim: "rat", attack: "rat_attack" },
        brute:     { mon: 1, hp: 3, hw: 34, b: 0,  t: 116, dw: 120, dh: 140, lift: 0,  vx: 30, anim: "pig" },
        wraith:    { mon: 1, hp: 1, hw: 32, b: 80, t: 128, dw: 78,  dh: 72,  lift: 76, vx: 120, bob: 1, anim: "bird_attack" }
    };
    const ART = {};                                       // optional PNGs
    Object.keys(OB).forEach(function (k) {
        const im = new Image();
        im.onload = function () { ART[k] = im; };
        im.src = "visuals/obstacles/" + k + ".png";
    });
    // animated sprite sheets built from your GIFs (anim.js): player moves + monsters
    const AN = window.RUNMIL_ANIM || { player: {}, mon: {} };
    ["player", "mon"].forEach(function (g) {
        Object.keys(AN[g]).forEach(function (k) { const d = AN[g][k], im = new Image(); im.onload = function () { d.src0 = im; d.img = g === "player" ? outfit(im, d) : im; }; im.src = d.src; });
    });
    // The outfit chosen in Character Customization (saved colours) is painted onto the player sheets:
    // shirt (light parts), pants (dark blue parts), hair (dark pixels on the head) and shoes (dark pixels at the feet).
    function outfit(im, a) {                                     // the outfit / skin saved in Character Customization, painted onto the sheet (shared code in character.js)
        try { return C && C.paintSheet ? C.paintSheet(im, a) : im; } catch (e) { return im; }
    }
    function frameByTime(a, ms) {
        const tot = a.dur.reduce((x, y) => x + y, 0); ms = ms % tot;
        for (let i = 0; i < a.n; i++) { if (ms < a.dur[i]) return i; ms -= a.dur[i]; }
        return 0;
    }
    function putFrame(a, f, x, y, w, h) { ctx.drawImage(a.img, (f % a.cols) * a.fw, Math.floor(f / a.cols) * a.fh, a.fw, a.fh, x, y, w, h); }
    const iconCoin = new Image(); iconCoin.src = "visuals/images/icon-coin.png";
    const iconGem = new Image(); iconGem.src = "visuals/images/icon-gem.png";
    const ok = (im) => im && im.complete && im.naturalWidth > 0;

    // ---------- location backgrounds ----------
    // w / h: size of the GIF   g: y of the top of the grass strip inside the GIF
    const BGDIR = "visuals/backgrounds/";
    const LOCFILE = { park: "park", dnsc: "dnsc", mangrove: "mangroves", seawall: "seawall" };
    const LOCDATA = {
        park:     { day: { w: 553, h: 306, g: 268 }, night: { w: 553, h: 307, g: 270 } },
        dnsc:     { day: { w: 507, h: 337, g: 264 }, night: null },
        mangrove: { day: { w: 508, h: 337, g: 265 }, night: { w: 553, h: 307, g: 272 } },
        seawall:  { day: { w: 553, h: 309, g: 276 }, night: { w: 553, h: 307, g: 277 } }
    };
    const place = (save.unlocked && save.unlocked[save.location]) ? save.location : "park";
    const LD = LOCDATA[place] || LOCDATA.park, LF = LOCFILE[place] || "park";
    const layers = {
        day: { el: $("bgd"), file: "loc-" + LF + "_morning.gif", d: LD.day, nw: LD.day.w, nh: LD.day.h, g: LD.day.g, strip: null, fallback: false },
        night: { el: $("bgn"), file: "loc-" + LF + "_night.gif", d: LD.night, nw: 0, nh: 0, g: 0, strip: null, fallback: false }
    };
    const NIGHT_FILTER = "brightness(.4) contrast(1.2) saturate(.85) hue-rotate(25deg)";
    function initLayer(name) {
        const L = layers[name];
        const g = new Image();
        g.onload = function () {
            L.nw = g.naturalWidth; L.nh = g.naturalHeight;
            if (L.d) L.g = L.d.g; else L.g = Math.round(layers.day.g * L.nh / layers.day.nh);
            L.gimg = g; buildStrip(L); layout();
            if (window.RUNMIL_PERF && !L.still) { const u = RUNMIL_still(g, L.fallback ? NIGHT_FILTER : null); if (u) { L.still = true; L.el.style.filter = "none"; L.el.src = u; } }     // light mode: still background
        };
        g.onerror = function () {
            if (name === "night" && !L.fallback) {         // no night picture for this place: darken the day one
                L.fallback = true; L.file = layers.day.file; L.d = layers.day.d; L.el.style.filter = NIGHT_FILTER; L.el.src = BGDIR + L.file; g.src = BGDIR + L.file;
            }
        };
        L.el.src = BGDIR + L.file; g.src = BGDIR + L.file;
    }
    function buildStrip(L) {     // the grass + soil of the picture, mirrored so it can scroll without a seam
        const cut = L.g + 8, n = Math.max(4, Math.min(36, L.nh - cut));
        const c = document.createElement("canvas"); c.width = L.nw * 2; c.height = n;
        const x = c.getContext("2d");
        x.drawImage(L.gimg, 0, cut, L.nw, n, 0, 0, L.nw, n);
        x.save(); x.translate(L.nw * 2, 0); x.scale(-1, 1); x.drawImage(L.gimg, 0, cut, L.nw, n, 0, 0, L.nw, n); x.restore();
        L.strip = c; L.cut = cut; L.n = n;
    }
    function layout() {          // put each picture so that its grass line sits on GROUND
        ["day", "night"].forEach(function (name) {
            const L = layers[name]; if (!L.nw) return;
            const feet = L.g + 12, s = Math.max(W / L.nw, GROUND / feet);
            const iw = L.nw * s, ih = L.nh * s, left = (W - iw) / 2, top = GROUND - feet * s;
            const e = L.el.style;
            e.left = (left / W * 100) + "%"; e.top = (top / H * 100) + "%"; e.width = (iw / W * 100) + "%"; e.height = (ih / H * 100) + "%";
            L.s = s; L.cutY = GROUND - (feet - L.cut) * s;
        });
        applyNight(true);
    }
    let lastNf = -1;
    function applyNight(force) {
        const nf = st ? st.nf : 0;
        if (!force && Math.abs(nf - lastNf) < 0.004) return;
        lastNf = nf;
        layers.day.el.style.opacity = layers.day.nw ? 1 : 0;
        layers.night.el.style.opacity = layers.night.nw ? nf : 0;
    }
    function drawGround() {
        ["day", "night"].forEach(function (name) {
            const L = layers[name]; if (!L.strip || !L.cutY) return;
            const a = name === "night" ? st.nf : 1; if (a <= 0.003) return;
            const dh = H - L.cutY + 1, sc = dh / L.n, tw = L.nw * 2 * sc;
            ctx.save(); ctx.globalAlpha = a;
            let x = -((st.scroll) % tw);
            while (x < W) { ctx.drawImage(L.strip, 0, 0, L.nw * 2, L.n, Math.floor(x), L.cutY, Math.ceil(tw) + 1, dh); x += tw; }
            if (name === "night" && L.fallback) { ctx.fillStyle = "rgba(8,14,60,.55)"; ctx.fillRect(0, L.cutY, W, dh); }
            ctx.restore();
        });
    }

    // ---------- state ----------
    let st, keys = {}, last = 0, duckHeld = false, touchDuck = false;
    function reset() {
        st = { t: 0, level: 0, prevBest: ((readSave().stats || {}).bestScore | 0), danced: false, found: [], items: [], nextItem: 14, gems: [], nextGem: 30, gemsGot: 0, dist: 0, coins: 0, kills: 0, speed: SPEED0 * levelMul(0), y: GROUND, vy: 0, jumps: 0, over: false, started: false, paused: false, cd: 0,
               obs: [], pick: [], parts: [], shots: [], fx: [], texts: [], ammo: {}, cdt: {}, gap: 520, gapDist: 0, nextCoin: 0.6, revives: 0, committed: false,
               hits: (has("helmet") ? 1 : 0) + (has("shield") ? 1 : 0), inv: 0, scroll: 0, shake: 0, hitstop: 0, act: null, acd: 0, nf: 0, overT: 0,
               banner: null, combo: 0, comboT: 0, bestCombo: 0, bonus: 0, near: 0, jumpsN: 0, punches: 0, kicks: 0, ducks: 0, weaponsN: 0, nights: 0, coinStreak: 0, coinT: 0, wasDuck: false, wasAir: false, curAir: 0, cdLast: 0, lastPhase: "day", duck: false, dust: 0, ct: 0, runT: 0, airT: 0, standing: false };
        WEAPONS = WEAPONS_ALL.filter((w) => stock(w.id) > 0);
        WEAPONS.forEach(function (w) { st.ammo[w.id] = stock(w.id); st.cdt[w.id] = 0; });
        $("over").hidden = true; $("pause").hidden = true;
        $("hint").classList.remove("off");
        AUD("duck", 1); AUD("music", musicFor("day"));
        applyNight(true);
    }
    function fit() {
        const a = innerWidth / Math.max(1, innerHeight), oldG = GROUND;
        if (a >= 16 / 9) { H = 540; W = Math.round(Math.min(1500, 540 * a)); }
        else { W = 960; H = Math.round(Math.min(1500, 960 / a)); }
        GROUND = Math.round(H * 0.855);
        if (cv.width !== W) cv.width = W;
        if (cv.height !== H) cv.height = H;
        const sc = Math.min(innerWidth / W, innerHeight / H);
        stage.style.width = Math.round(W * sc) + "px"; stage.style.height = Math.round(H * sc) + "px";
        if (st && oldG !== GROUND) {
            const d = GROUND - oldG; st.y += d;
            [st.pick, st.shots].forEach(function (l) { l.forEach(function (o) { o.y += d; }); });
        }
        layout();
    }
    st = null; fit(); reset();
    addEventListener("resize", fit); addEventListener("orientationchange", fit);
    if (window.RMX) { RMX.mechanics("endless", function () { try { window.focus(); } catch (e) { /* ok */ } begin(); }); $("howto-pause").addEventListener("click", function () { RMX.openHowTo("endless"); }); }   // the game mechanics card before the run

    // real fullscreen on the first tap / key (only when the game is opened on its own)
    (function () {
        function first(e) {
            if (e.type === "keydown" && e.code === "Escape") return;
            removeEventListener("pointerup", first, true); removeEventListener("keydown", first, true);
            if (window.parent !== window) return;
            if (save.settings && save.settings.fullscreen === false) return;
            const el = document.documentElement;
            if (document.fullscreenElement || document.webkitFullscreenElement) return;
            try { const p = (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el, { navigationUI: "hide" }); if (p && p.catch) p.catch(function () {}); } catch (err) { /* not supported */ }
        }
        addEventListener("pointerup", first, true); addEventListener("keydown", first, true);
    })();

    const touchHint = "Tap to jump &bull; hold DUCK &bull; PUNCH / KICK buttons";
    const keyHint = "SPACE jump &bull; C duck &bull; P punch &bull; K kick" + (WEAPONS.length ? " &bull; " + WEAPONS.map((w, i) => i + 1).join(" / ") + " items" : "") + " &bull; ESC pause";
    function setHint() { $("hint").innerHTML = touchMode ? touchHint : keyHint; }
    let touchMode = false;
    function enableTouch() { if (touchMode) return; touchMode = true; $("touch").hidden = false; setHint(); }
    if (window.matchMedia && matchMedia("(pointer: coarse)").matches) enableTouch();
    setHint();

    // ---------- day / night ----------
    function nightFactor(ct) {
        if (ct < DAY_LEN) return 0;
        if (ct < DAY_LEN + FADE) return (ct - DAY_LEN) / FADE;
        if (ct < DAY_LEN + FADE + NIGHT_LEN) return 1;
        return 1 - (ct - DAY_LEN - FADE - NIGHT_LEN) / FADE;
    }
    function phaseOf(ct) {
        if (ct < DAY_LEN) return "day";
        if (ct < DAY_LEN + FADE) return "dusk";
        if (ct < DAY_LEN + FADE + NIGHT_LEN) return "night";
        return "dawn";
    }
    function spawnKind(ct) {       // a short breather around sunrise / sunset
        if (ct < DAY_LEN - 2) return "day";
        if (ct >= DAY_LEN + FADE + 1 && ct < DAY_LEN + FADE + NIGHT_LEN - 2) return "night";
        return null;
    }

    // ---------- actions ----------
    function musicFor(ph) {                                      // each place has a daytime song (<place>_day) and the night song (night); a missing file keeps the built-in tune
        const RA = window.RunMilAudio, has = function (n) { return !!(RA && RA.has && RA.has("music", n)); };
        if (ph === "dusk" || ph === "night") return has("night") ? "night" : place;
        return has(place + "_day") ? place + "_day" : place;
    }
    function begin() { if (!st.started) { st.started = true; $("hint").classList.add("off"); AUD("music", musicFor(phaseOf(st.ct || 0))); } }
    function jump() {
        if (st.over || st.paused || st.cd > 0) return;
        begin();
        const max = has("jetpack") ? 3 : 2;
        if (st.y >= GROUND - 0.5 || st.standing) { st.vy = -JUMP; st.jumps = 1; st.standing = false; st.jumpsN++; SFX("jump"); }
        else if (st.jumps < max) { st.vy = -JUMP * 0.85; st.jumps++; st.jumpsN++; SFX("jump2"); }
    }
    function attack(k) {
        if (st.over || st.paused || st.cd > 0) return;
        begin();
        if (st.act || st.acd > 0) return;
        const p = k === "punch";
        st.act = { k: k, t: 0, dur: p ? 0.46 : 0.58, w0: p ? 0.12 : 0.25, w1: p ? 0.27 : 0.40, dmg: p ? 1 : 2, hit: [], sparked: false };
        SFX("swing", k); if (p) st.punches++; else st.kicks++;
    }
    function setPause(on) {
        if (st.over || !st.started) return;
        st.paused = on; $("pause").hidden = !on;
        AUD("pause", on); if (!on) st.cd = 3;                                // 3-2-1 before the run goes on
    }
    addEventListener("keydown", function (e) {
        if (window.RMX && RMX.vis.key(e)) return;                  // B = AABB vision
        if (vic) { if (["Space", "Enter", "Escape"].indexOf(e.code) >= 0) { e.preventDefault(); endVictory(); } return; }
        if (e.repeat) { if (["Space", "KeyC"].indexOf(e.code) >= 0) e.preventDefault(); return; }
        const c = e.code;
        if (c === "Space") { e.preventDefault(); jump(); }
        else if (c === "KeyC") { e.preventDefault(); duckHeld = true; if (st.y < GROUND - 0.5 && st.started) { /* fast fall handled in update */ } }
        else if (c === "KeyP") attack("punch");
        else if (c === "KeyK") attack("kick");
        else if (c === "Escape" || c === "Pause") setPause(!st.paused);
        else { const m = /^(?:Digit|Numpad)([1-4])$/.exec(c); if (m) { e.preventDefault(); useWeapon(+m[1] - 1); } }
    });
    addEventListener("keyup", function (e) { if (e.code === "KeyC") duckHeld = false; });
    document.addEventListener("visibilitychange", function () { if (document.hidden) setPause(true); });
    addEventListener("blur", function () { if (st.started && !st.over) setPause(true); });

    function weaponAt(e) {
        const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
        for (let i = 0; i < WEAPONS.length; i++) {
            const by = BTN.y + i * (BTN.s + BTN.gap);
            if (x >= BTN.x - 8 && x <= BTN.x + BTN.s + 8 && y >= by - 6 && y <= by + BTN.s + 6) return i;
        }
        return -1;
    }
    cv.addEventListener("pointerdown", function (e) {
        e.preventDefault(); if (e.pointerType === "touch") enableTouch();
        const i = weaponAt(e); if (i >= 0) useWeapon(i); else jump();
    });
    function hold(id, down, up) {
        const b = $(id);
        b.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); if (e.pointerType === "touch") enableTouch(); try { b.setPointerCapture(e.pointerId); } catch (x) {} down(); });
        ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (n) { b.addEventListener(n, function () { up(); }); });
    }
    hold("t-duck", function () { touchDuck = true; }, function () { touchDuck = false; });
    hold("t-punch", function () { attack("punch"); }, function () {});
    hold("t-kick", function () { attack("kick"); }, function () {});
    $("pausebtn").addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    $("pausebtn").addEventListener("click", function () { setPause(!st.paused); });
    $("resume").onclick = function () { setPause(false); };
    $("restart").onclick = function () { commitRun(); reset(); };
    $("quit").onclick = goHome;
    $("retry").onclick = function () { commitRun(); reset(); };
    $("home").onclick = goHome;
    $("save-btn").onclick = revive;
    function goHome() {
        commitRun(); AUD("stop");
        if (window.parent !== window) parent.postMessage("runmil:home", "*");
        else location.href = "index.html?menu";
    }
    addEventListener("pagehide", commitRun);

    // ---------- collection pieces (see collect.js) ----------
    const CO = window.RUNMIL_COLLECT || { items: {}, sets: [] };
    function dropPool() {
        const ids = [];
        CO.sets.forEach(function (s) { if (s.locs.indexOf(place) >= 0) s.items.forEach(function (i) { if (ids.indexOf(i) < 0) ids.push(i); }); });
        return ids;
    }
    // Which piece drops (Java: DropPicker.pick) and where it can sit without touching an obstacle (Java: DropPicker.firstFree, AABB).
    const SLOTS = [[0, 0], [0, -90], [0, -45], [160, 0], [160, -90], [320, 0], [320, -90]];
    function dropItem(x) {
        const pool = dropPool(); if (!pool.length) return false;
        const have = (readSave().collect || {}).have || {};
        const missing = pool.filter((id) => !have[id] && st.found.indexOf(id) < 0);
        const id = AB.pick(pool.join(","), missing.join(","), Math.random(), Math.random());
        if (!id) return false;
        const by = GROUND - (Math.random() < 0.5 ? 60 : 150) - 22;
        const obs = st.obs.filter((o) => !o.dead).map(function (o) { const r = rectOf(o); return [r.x0 - 24, r.y0 - 24, r.x1 - r.x0 + 48, r.y1 - r.y0 + 48].join(","); }).join(";");
        const i = AB.firstFree(x - 22, by, 44, 44, obs, SLOTS.map((q) => q.join(",")).join(";"));
        if (i < 0) return false;
        st.items.push({ id: id, x: x + SLOTS[i][0], y: by + 22 + SLOTS[i][1], ph: 0 });
        return true;
    }
    function spawnItem() { if (!dropItem(W + 60)) st.nextItem = 1.5; }
    // ---------- spawning ----------
    const pick = (a) => a[Math.random() * a.length | 0];
    function spawnHazard(kind) {
        let k;
        const r = Math.random();
        if (kind === "day") k = r < .20 ? "vehicle" : r < .35 ? "bird_high" : r < .50 ? "bird_low" : r < .75 ? "pole_high" : "pole_low";   // high and fallen poles are equally common (25% each)
        else if (st.level < 1) k = r < .62 ? "ghoul" : "wraith";
        else k = r < .45 ? "ghoul" : r < .8 ? "wraith" : "brute";
        const d = OB[k];
        st.obs.push({ k: k, d: d, x: W + 80, ph: Math.random() * 6, hp: d.hp || 1, hpMax: d.hp || 1, flash: 0, dead: 0, v: Math.random() * 3 | 0, kb: 0 });
        if (d.mon) SFX("spawn_" + k);                          // each monster announces itself in its own voice
    }
    function spawnCoins() {
        const n = 3 + (Math.random() * 4 | 0), hi = Math.random() < 0.5, y = GROUND - 40 - (hi ? 120 + Math.random() * 30 : 0);
        for (let i = 0; i < n; i++) st.pick.push({ x: W + 40 + i * 44, y: y - (hi ? Math.sin(i / Math.max(1, n - 1) * Math.PI) * 30 : 0), ph: i });
    }
    function burst(x, y, col, n) { for (let i = 0; i < n; i++) st.parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 380, vy: -Math.random() * 340, l: 0.55, c: col }); }
    function float(text, x, y, col) { st.texts.push({ s: text, x: x, y: y, l: 0.9, c: col || "#fff" }); }
    function rectOf(o) {
        const d = o.d, bob = (d.bob || d.fly) ? Math.sin(o.ph * (d.bob ? 1.2 : 2)) * (d.bob ? 12 : 5) : 0;
        return { x0: o.x - d.hw, x1: o.x + d.hw, y0: GROUND - d.t - bob, y1: GROUND - d.b - bob, bob: bob };
    }

    // ---------- AABB collision (axis-aligned bounding boxes) ----------
    // A box is { x, y, w, h } = top-left corner + size. Two boxes overlap only if they overlap on BOTH axis.
    // Used for: hazard / monster hits, punch + kick hits, shop-weapon shots, coin / gem / collectible pickups.
    // The test itself lives in Java (aabb-java/, compiled with TeaVM -> java/aabb.js); aabb-boot.js falls back to a JS copy.
    const AB = window.RunMilAABB;
    function aabb(a, b, tag, kind) {                          // tag = what is being tested (shown by the AABB vision when it is a hit)
        const r = AB.overlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h);
        if (r && tag && window.RMX) RMX.vis.hit(a, b, tag, kind, 0, 0);
        return r;
    }
    function playerBox() {                                   // follows ducking and jumping
        const h = st.duck ? DUCK_H : STAND_H;
        return { x: PX - HALF_W, y: st.y - h, w: HALF_W * 2, h: h };
    }
    function hitBox(o) { const r = rectOf(o); return { x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 }; }
    function centreBox(x, y, hw, hh) { return { x: x - hw, y: y - hh, w: hw * 2, h: hh * 2 }; }
    let showBoxes = false;                                   // press H to see every box

    // ---------- hurting things ----------
    function kill(o, quiet) {
        if (o.dead) return; o.dead = 1; st.kills++;
        st.combo++; st.comboT = 2.4; if (st.combo > st.bestCombo) st.bestCombo = st.combo;
        SFX(o.d.mon ? "kill_" + o.k : "kill");               // each monster dies with its own sound
        if (st.combo >= 3) { st.bonus += st.combo * 5; SFX("combo", st.combo); float("COMBO x" + st.combo + "!  +" + st.combo * 5, PX + 70, st.y - 175, "#ff9aff"); }
        const r = rectOf(o), cy = (r.y0 + r.y1) / 2, col = o.d.mon ? (o.k === "ghoul" ? "#58e078" : o.k === "wraith" ? "#b8a0ff" : "#ff5a6a") : "#ffd24a";
        burst(o.x, Math.min(cy, GROUND - 30), col, 16);
        if (!quiet) float("+25", o.x, Math.min(cy, GROUND - 60) - 20, "#ffd24a");
        if (o.d.mon) for (let i = 0; i < 2; i++) st.pick.push({ x: o.x + i * 26, y: GROUND - 70 - i * 10, ph: i });
        if (o.d.mon && Math.random() < 0.15) dropItem(Math.max(PX + 120, o.x));
    }
    function harm(o, dmg) {
        if (o.dead) return; o.hp -= dmg; o.flash = 0.14; o.kb = 120; if (o.hp > 0 && o.k === "brute") SFX("brute_hit");
        if (o.hp <= 0) kill(o);
    }
    function attackHits() {
        const a = st.act, p = a.k === "punch", fh = GROUND - st.y;
        const x0 = PX + (p ? 8 : 0), x1 = PX + (p ? 128 : 150);
        const h0 = fh + (p ? 28 : -6), h1 = fh + (p ? 132 : 108);
        const atk = { x: x0, y: GROUND - h1, w: x1 - x0, h: h1 - h0 };       // punch / kick box
        st.atkBox = atk;
        st.obs.forEach(function (o) {
            if (o.dead || !o.d.mon || a.hit.indexOf(o) >= 0) return;
            const r = rectOf(o), b = GROUND - r.y1, t = GROUND - r.y0;
            if (aabb(atk, hitBox(o), a.k === "kick" ? "KICK" : "PUNCH", "atk")) {
                a.hit.push(o); harm(o, a.dmg); SFX("impact", a.k); st.hitstop = 0.05; st.shake = Math.max(st.shake, 0.08);
                st.parts.push({ x: Math.max(o.x - o.d.hw, x1 - 20), y: (r.y0 + r.y1) / 2, vx: 0, vy: 0, l: 0.12, c: "#fff", big: 1 });
                float(a.k === "kick" ? "KICK!" : "PUNCH!", o.x, r.y0 - 14, a.k === "kick" ? "#7affc0" : "#ffb24a");
            }
        });
    }
    function useWeapon(i) {
        const w = WEAPONS[i]; if (!w || !st.started || st.over || st.paused || st.cd > 0) return;
        if (st.ammo[w.id] <= 0 || st.cdt[w.id] > 0) return;
        st.ammo[w.id]--; st.cdt[w.id] = w.cd; st.weaponsN++; SFX(w.id);
        { const s = readSave(); s.items = Object.assign({}, s.items); s.items.ammo = Object.assign({}, s.items.ammo); s.items.ammo[w.id] = st.ammo[w.id]; writeSave(s); }   // the stock is kept between runs
        const mx = PX + 40, my = st.y - 62;
        if (w.id === "pencil") {
            const d = aim(mx, my);
            st.shots.push({ k: "pencil", x: mx, y: my, vx: d[0] * 1000, vy: d[1] * 1000, a: Math.atan2(d[1], d[0]), r: 12, life: 1.5, dmg: 1 });
        } else if (w.id === "ruler") {
            st.shots.push({ k: "ruler", x: mx, y: st.y - 55, vx: 700, vy: 0, a: 0, r: 34, life: 2, hit: [], maxX: mx + 560, dmg: 2 });
        } else if (w.id === "laser") {
            const y0 = st.y - 195, y1 = st.y + 4;
            st.obs.forEach(function (o) { const r = rectOf(o); if (!o.dead && r.x1 > PX && r.x0 < W + 40 && r.y1 > y0 && r.y0 < y1) kill(o); });
            st.fx.push({ k: "laser", y: st.y - 70, x0: mx, t: 0.32, T: 0.32 }); st.shake = 0.1;
        } else {
            const d = aim(mx, my);
            st.shots.push({ k: "blast", x: mx, y: my, vx: d[0] * 640, vy: d[1] * 640, r: 18, life: 2 });
        }
    }
    function nearestTarget() {
        let best = null;
        st.obs.forEach(function (o) { if (!o.dead && (o.d.mon || o.d.fly) && o.x > PX + 20 && o.x < W + 30 && (!best || o.x < best.x)) best = o; });
        return best;
    }
    function aim(mx, my) {
        const t = nearestTarget(); if (!t) return [1, 0];
        const r = rectOf(t), dx = t.x - mx, dy = (r.y0 + r.y1) / 2 - my, d = Math.hypot(dx, dy) || 1;
        return [dx / d, dy / d];
    }
    function explode(x, y) {
        SFX("boom");
        st.fx.push({ k: "boom", x: x, y: y, t: 0.35, T: 0.35 }); st.shake = 0.18; burst(x, y, "#ffb040", 22);
        st.obs.forEach(function (o) { const r = rectOf(o); if (!o.dead && Math.hypot(o.x - x, (r.y0 + r.y1) / 2 - y) < 150) kill(o); });
    }
    function updateShots(dt) {
        WEAPONS.forEach(function (w) { if (st.cdt[w.id] > 0) st.cdt[w.id] -= dt; });
        st.fx.forEach(function (f) { f.t -= dt; }); st.fx = st.fx.filter((f) => f.t > 0);
        st.shots.forEach(function (sh) {
            sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt; if (sh.k === "ruler") sh.a += dt * 22;
            for (let n = 0; n < st.obs.length; n++) {
                const o = st.obs[n]; if (o.dead || (sh.hit && sh.hit.indexOf(o) >= 0)) continue;
                const r = rectOf(o);
                if (aabb(centreBox(sh.x, sh.y, sh.r, sh.r), hitBox(o), "WEAPON SHOT", "atk")) {
                    if (sh.k === "blast") { sh.life = 0; explode(sh.x, sh.y); break; }
                    if (o.d.solid) { if (sh.k === "pencil") { sh.life = 0; burst(sh.x, sh.y, "#ffd24a", 5); break; } continue; }   // pencil / ruler can't break cars or poles
                    harm(o, sh.dmg);
                    if (sh.k === "ruler") sh.hit.push(o); else { sh.life = 0; break; }
                }
            }
            if (sh.k === "blast" && sh.life > 0 && sh.x > W - 60) { sh.life = 0; explode(sh.x, sh.y); }
        });
        st.shots = st.shots.filter((sh) => sh.life > 0 && sh.x < W + 60 && sh.x > -60 && sh.y > -60 && sh.y < H + 60 && !(sh.k === "ruler" && sh.x > sh.maxX));
    }

    // ---------- update ----------
    function update(dt) {
        if (st.paused) return;
        if (st.over) {                                    // fall-over + keep particles moving
            st.overT += dt;
            st.parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.l -= dt; });
            st.parts = st.parts.filter((p) => p.l > 0);
            return;
        }
        if (st.cd > 0) { const c = Math.ceil(st.cd); if (c !== st.cdLast) { st.cdLast = c; SFX("tick"); } st.cd -= dt; if (st.cd <= 0) { st.cdLast = 0; SFX("go"); } return; }
        if (!st.started) { applyNight(); return; }
        if (st.hitstop > 0) { st.hitstop -= dt; return; }

        st.t += dt; st.ct = st.t % CYCLE; st.nf = nightFactor(st.ct);
        AUD("mood", st.nf, Math.min(1, 0.22 + (st.speed / SPEED0 - 0.8) * 0.5 + st.level * 0.08 + (st.combo >= 3 ? 0.1 : 0)));
        const ph = phaseOf(st.ct);
        if (ph !== st.lastPhase) {
            if (ph === "dusk") { st.banner = { s: "NIGHT FALLS - MONSTERS AHEAD!", t: 3, c: "#b8a0ff" }; SFX("night"); }
            if (ph === "dawn") { st.banner = { s: "SUNRISE - WATCH THE ROAD!", t: 3, c: "#ffd24a" }; SFX("dawn"); st.nights++; }
            if (st.started && (ph === "dusk" || ph === "dawn")) AUD("music", musicFor(ph));      // night song at dusk, day song at sunrise
            st.lastPhase = ph;
        }
        if (st.banner && (st.banner.t -= dt) <= 0) st.banner = null;
        applyNight();

        const L = Math.floor(st.t / CYCLE);
        if (L !== st.level) { st.level = L; st.banner = { s: "DAY " + (L + 1) + " - THE PACE PICKS UP!", t: 3, c: "#7affc0" }; SFX("day"); }
        const target = SPEED0 * levelMul(L) * (1 + 0.03 * (st.ct / CYCLE));
        st.speed += (target - st.speed) * Math.min(1, dt * 0.4);
        st.dist += st.speed * dt / 10; st.scroll += st.speed * dt;
        const onGround = st.y >= GROUND - 0.5 || st.standing;
        // down: duck on the ground, dive in the air
        const down = duckHeld || touchDuck;
        if (!onGround && down) st.vy += GRAV * 1.6 * dt;
        const prevFH = GROUND - st.y;
        st.vy += GRAV * dt; st.y += st.vy * dt;
        if (st.y >= GROUND) { st.y = GROUND; st.vy = 0; st.jumps = 0; }
        // land on the roof of a vehicle (falling onto it from above is safe)
        st.standing = false;
        if (st.vy >= 0) {
            let top = -1;
            st.obs.forEach(function (o) {
                if (o.dead || !o.d.plat) return;
                const r = rectOf(o), tp = o.d.t;
                if (tp > top && AB.landsOnTop(PX - HALF_W, PX + HALF_W, r.x0, r.x1, prevFH, GROUND - st.y, tp, 4, 8)) top = tp;
            });
            if (top >= 0) { st.y = GROUND - top; st.vy = 0; st.jumps = 0; st.standing = true; }
        }
        const grounded = st.y >= GROUND - 0.5 || st.standing;
        st.airT = grounded ? 0 : st.airT + dt;
        st.runT += dt * 1000 * (st.speed / SPEED0);
        st.duck = down && grounded && !st.act;
        st.duckT = st.duck ? (st.duckT || 0) + dt * 1000 : 0;                 // time spent crouching (drives the crouch animation)
        if (st.duck && !st.wasDuck) { st.ducks++; SFX("duck"); } st.wasDuck = st.duck;
        if (!grounded) st.curAir = st.airT; else { if (st.wasAir && st.curAir > 0.22) SFX("land"); st.curAir = 0; } st.wasAir = !grounded;
        if (st.inv > 0) st.inv -= dt;
        if (st.comboT > 0 && (st.comboT -= dt) <= 0) st.combo = 0;
        if (st.coinT > 0 && (st.coinT -= dt) <= 0) st.coinStreak = 0;
        if (st.shake > 0) st.shake -= dt;

        // attacks
        if (st.acd > 0) st.acd -= dt;
        if (st.act) {
            const a = st.act; a.t += dt;
            if (a.t >= a.w0 && a.t <= a.w1) attackHits();
            if (a.t >= a.dur) { st.acd = a.k === "punch" ? 0.08 : 0.14; st.act = null; }
        }

        // spawning (by distance, so it stays fair as the run speeds up)
        const kind = spawnKind(st.ct);
        st.gapDist += st.speed * dt;
        if (kind && st.gapDist >= st.gap) {
            spawnHazard(kind); st.gapDist = 0;
            st.gap = Math.max(450, 880 - st.level * 60) + Math.random() * 380;
        }
        if (!kind && st.gapDist > st.gap) st.gapDist = st.gap * 0.7;
        st.nextItem -= dt; if (st.nextItem <= 0 && kind) { st.nextItem = 22 + Math.random() * 16; spawnItem(); }
        st.nextGem -= dt; if (st.nextGem <= 0) { st.nextGem = 35 + Math.random() * 30; st.gems.push({ x: W + 60, y: GROUND - 110 - Math.random() * 40, ph: 0 }); }
        st.nextCoin -= dt;
        if (st.nextCoin <= 0) { spawnCoins(); st.nextCoin = 1.4 + Math.random() * 1.6; }

        // hazards
        const fh = GROUND - st.y, ph0 = fh, ph1 = fh + (st.duck ? DUCK_H : STAND_H);
        st.obs.forEach(function (o) {
            const d = o.d;
            o.x -= (st.speed + (d.vx || 0)) * dt - o.kb * dt; o.kb *= Math.max(0, 1 - dt * 8); o.ph += dt * 8; if (o.flash > 0) o.flash -= dt;
            if (o.dead) { o.dead += dt * 6; return; }
            if (d.mon) {                                       // ambient sound of each monster type while it is on screen
                if (o.snd === undefined) o.snd = 0.6 + Math.random();
                if ((o.snd -= dt) <= 0) { o.snd = (o.k === "brute" ? 1.0 : o.k === "ghoul" ? 1.4 : 2.0) + Math.random() * 0.8; const dx = o.x - PX; if (dx > -40 && dx < W) SFX("idle_" + o.k, Math.max(0.25, 1 - dx / (W * 1.2))); }
            }
            const r = rectOf(o), hb = hitBox(o); hb.y += 4; hb.h -= 4;      // 4 px of forgiveness on top (so a roof landing never clips)
            if (st.inv <= 0 && aabb(playerBox(), hb, "YOU vs " + (NICE[o.k] || o.k).toUpperCase(), "hit")) {
                if (st.hits > 0) { st.hits--; st.inv = 1.2; st.shake = 0.2; o.dead = 1; burst(o.x, Math.min(GROUND - 40, (r.y0 + r.y1) / 2), "#7affff", 16); }
                else {
                    const pbx = playerBox();                                         // keep the exact numbers of the fatal check for the game-over screen
                    st.hitRec = { A: { x: pbx.x, y: pbx.y, w: pbx.w, h: pbx.h }, B: { x: hb.x, y: hb.y, w: hb.w, h: hb.h }, an: "You (" + (st.duck ? "ducking" : "standing") + ")", bn: NICE[o.k] || o.k, ground: GROUND,
                        note: "Boxes are in screen pixels, y grows downward. The top of the hazard's box is trimmed by 4 px so landing on a roof never counts as a hit." };
                    gameOver(o);
                }
            }
            if (!o.dead && !st.over && !d.plat) {            // close call: you passed it within a hair
                const pb = playerBox();
                if (!o.near && aabb({ x: pb.x - 26, y: pb.y - 26, w: pb.w + 52, h: pb.h + 52 }, hb)) o.near = 1;
                if (o.near && !o.counted && r.x1 < PX - HALF_W) { o.counted = 1; st.near++; st.bonus += 10; float("CLOSE CALL! +10", PX + 70, st.y - 150, "#7affff"); SFX("near"); }
            }
        });
        updateShots(dt);
        st.obs = st.obs.filter((o) => o.x > -220 && !(o.dead && o.dead > 4));

        const mag = has("magnet") ? 170 : 0, cb = has("band") ? 2 : 1;
        st.pick.forEach(function (c) {
            c.x -= st.speed * dt; c.ph += dt * 6;
            const dx = PX - c.x, dy = (st.y - 70) - c.y;
            if (mag && dx * dx + dy * dy < mag * mag && c.x > PX - 200) { c.x += dx * dt * 6; c.y += dy * dt * 6; }
            if (aabb(playerBox(), centreBox(c.x, c.y, 14, 14), "COIN", "pick")) { c.got = 1; st.coins += cb; burst(c.x, c.y, "#ffd24a", 5); st.coinStreak++; st.coinT = 0.9; SFX("coin", st.coinStreak - 1); }
        });
        st.pick = st.pick.filter((c) => !c.got && c.x > -40);
        st.items.forEach(function (c) {
            c.x -= st.speed * dt; c.ph += dt * 4;
            if (aabb(playerBox(), centreBox(c.x, c.y, 22, 22), "COLLECTIBLE", "pick")) {
                c.got = 1; st.found.push(c.id); SFX("item"); const it = CO.items[c.id] || { n: c.id, ic: "?" };
                burst(c.x, c.y, "#fff3a0", 14); float(it.ic + " " + it.n, PX + 20, c.y - 30, "#fff3a0");
                st.banner = { s: "COLLECTED: " + it.n.toUpperCase() + "!", t: 2.2, c: "#fff3a0" };
            }
        });
        st.items = st.items.filter((c) => !c.got && c.x > -60);
        st.gems.forEach(function (g) {
            g.x -= st.speed * dt; g.ph += dt * 4;
            if (aabb(playerBox(), centreBox(g.x, g.y, 16, 16), "GEM", "pick")) {
                g.got = 1; const s = readSave(); s.gems = (s.gems == null ? 50 : s.gems) + 1; writeSave(s); st.gemsGot++; gemT = 0;
                burst(g.x, g.y, "#7affff", 12); float("+1 GEM", PX + 20, g.y - 30, "#7affff"); SFX("gem");
            }
        });
        st.gems = st.gems.filter((g) => !g.got && g.x > -40);
        // dust under the feet
        st.dust -= dt;
        if (st.dust <= 0 && st.y >= GROUND - 0.5) { st.dust = 0.07; st.parts.push({ x: PX - 24, y: GROUND + 2, vx: -st.speed * 0.5, vy: -60 - Math.random() * 50, l: 0.3, c: "rgba(235,235,210,.7)" }); }
        st.parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.l -= dt; });
        st.parts = st.parts.filter((p) => p.l > 0);
        st.texts.forEach(function (f) { f.y -= 50 * dt; f.l -= dt; }); st.texts = st.texts.filter((f) => f.l > 0);
    }

    // ---------- run result / save me ----------
    function score() { return Math.floor(st.dist) + st.coins * 5 + st.kills * 25 + (st.bonus | 0); }
    const NICE = { vehicle: "Vehicle", bird_high: "Bird (high)", bird_low: "Bird (low)", pole_high: "High pole", pole_low: "Low pole", ghoul: "Rat monster", brute: "Pig monster", wraith: "Bird wraith" };
    function gameOver(by) {
        st.over = true; st.overT = 0; st.act = null; st.shake = 0.25; SFX("over"); AUD("duck", 0.25);
        st.diedBy = by ? by.k : "";
        const r = rectOf(by); burst(PX, st.y - 70, "#ff6a6a", 18);
        const night = st.nf > 0.5;
        $("over-title").textContent = night ? "THE MONSTERS GOT YOU!" : "YOU GOT HIT!";
        refreshOver();
        if (window.RMX) RMX.calc($("aabb-calc"), st.hitRec);                // the AABB numbers of the hit that ended the run
        setTimeout(function () {
            if (!st.over) return;
            if (!st.danced && score() > 0 && score() >= st.prevBest) { st.danced = true; showVictory(); }
            else $("over").hidden = false;
        }, 650);
    }
    function refreshOver() {
        const gems = readSave().gems == null ? 50 : readSave().gems;
        $("sum").innerHTML = "Score <b>" + score().toLocaleString() + "</b> &bull; " + Math.floor(st.dist).toLocaleString() + " m<br>" + st.coins + " coins &bull; " + st.kills + " monsters" + (st.bestCombo >= 3 ? " &bull; best combo x" + st.bestCombo : "") + (st.near ? " &bull; " + st.near + " close calls" : "") +
            (st.gemsGot ? " &bull; " + st.gemsGot + " gems" : "") + (st.found.length ? "<br>Found: " + st.found.map((id) => (CO.items[id] || {}).ic || "").join(" ") : "") +
            (score() >= st.prevBest && score() > 0 ? "<br><span style='color:#7dff8a'>New best score!</span>" : "");
        $("save-btn").disabled = gems < REVIVE_COST;
        $("gem-line").textContent = gems < REVIVE_COST ? "Not enough gems - you have " + gems : "You have " + gems + " gems";
    }
    function revive() {
        if (!st.over) return;
        const s = readSave(), gems = s.gems == null ? 50 : s.gems;
        if (gems < REVIVE_COST) return;
        s.gems = gems - REVIVE_COST; writeSave(s);
        st.revives++; SFX("revive"); AUD("duck", 1); st.over = false; st.inv = 3; st.vy = 0; st.y = GROUND; st.cd = 3; st.act = null; st.duck = false;
        st.obs = st.obs.filter((o) => o.x > PX + 650);     // clear the road around you
        st.shots = []; st.gapDist = 0; st.gap = 700;
        $("over").hidden = true;
        burst(PX, GROUND - 80, "#7affff", 20); float("SAVED!", PX, GROUND - 190, "#7affff");
    }
    // ---------- victory dance (new high score) ----------
    let VMIN = 5, vic = null;
    function showVictory() {
        SFX("victory"); AUD("music", "victory");
        const v = $("victory"), img = $("v-dancer"), src = img.getAttribute("src");
        v.hidden = false; v.classList.remove("ready"); $("v-skip").className = ""; $("v-skip").textContent = "";
        $("v-emoji").hidden = true; img.style.display = "";
        img.onerror = function () { img.style.display = "none"; $("v-emoji").hidden = false; };
        img.removeAttribute("src"); img.src = src;                       // restart the GIF from its first frame
        const fin = score(), prev = st.prevBest;
        $("v-sub").innerHTML = (prev > 0 ? "Old best " + prev.toLocaleString() + " &bull; " : "First record! &bull; ") + Math.floor(st.dist).toLocaleString() + " m";
        vic = { t: 0, last: performance.now(), conf: [], fw: [], sp: [], fin: fin, ready: false, nextFw: 0.2 };
        const cv2 = $("v-fx"); vsize(cv2);
        for (let i = 0; i < 90; i++) vic.conf.push(newConf(true));
        vicLoop();
    }
    function vsize(c) { const d = Math.min(2, devicePixelRatio || 1); c.width = Math.round(innerWidth * d); c.height = Math.round(innerHeight * d); }
    const CONF = ["#ff4a9a", "#ffd24a", "#4aff9a", "#4ac8ff", "#b04aff", "#ff7a3a", "#ffffff"];
    function newConf(init) { return { x: Math.random(), y: init ? Math.random() : -0.05, vy: 0.12 + Math.random() * 0.22, ph: Math.random() * 6, w: 6 + Math.random() * 8, c: CONF[Math.random() * CONF.length | 0], sp: 2 + Math.random() * 4 }; }
    function vicLoop() {
        if (!vic) return;
        const now = performance.now(), dt = Math.min(0.05, (now - vic.last) / 1000); vic.last = now; vic.t += dt;
        const c = $("v-fx"), x = c.getContext("2d"), w = c.width, h = c.height, u = Math.min(w, h) / 540;
        x.clearRect(0, 0, w, h);
        // fireworks
        vic.nextFw -= dt;
        if (vic.nextFw <= 0) {
            vic.nextFw = 0.45 + Math.random() * 0.6;
            const cx = (0.1 + Math.random() * 0.8) * w, cy = (0.12 + Math.random() * 0.38) * h, col = CONF[Math.random() * 6 | 0], n = 34;
            for (let i = 0; i < n; i++) { const a = i / n * 6.283, sp = (110 + Math.random() * 110) * u; vic.fw.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: 1.1, c: col }); }
        }
        vic.fw.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * u * dt; p.vx *= 0.985; p.l -= dt; });
        vic.fw = vic.fw.filter((p) => p.l > 0);
        x.globalCompositeOperation = "lighter";
        vic.fw.forEach(function (p) { x.globalAlpha = Math.max(0, p.l); x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, 3.2 * u, 0, 7); x.fill(); });
        x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
        // confetti
        vic.conf.forEach(function (q, i) {
            q.y += q.vy * dt; q.ph += q.sp * dt;
            if (q.y > 1.05) vic.conf[i] = newConf(false);
            x.save(); x.translate(q.x * w + Math.sin(q.ph * 0.7) * 20 * u, q.y * h); x.rotate(q.ph); x.scale(1, Math.cos(q.ph * 1.3));
            x.fillStyle = q.c; x.fillRect(-q.w * u / 2, -q.w * u / 4, q.w * u, q.w * u / 2); x.restore();
        });
        // score counts up, then the skip prompt appears
        const k = Math.min(1, vic.t / 2.4), e = 1 - Math.pow(1 - k, 3);
        $("v-score").textContent = Math.round(vic.fin * e).toLocaleString() + " PTS";
        const left = VMIN - vic.t;
        if (left > 0) $("v-skip").textContent = "Enjoy your record!";
        else if (!vic.ready) { vic.ready = true; $("v-skip").textContent = "CLICK ANYWHERE TO GO BACK TO THE MAIN MENU"; $("v-skip").className = "ready"; $("victory").classList.add("ready"); }
        requestAnimationFrame(vicLoop);
    }
    function endVictory() {
        if (!vic || !vic.ready) return;
        vic = null; $("victory").hidden = true; $("v-dancer").removeAttribute("src");
        $("v-dancer").src = "visuals/victory/victory_dance.gif";
        AUD("music", musicFor(phaseOf(st.ct || 0))); AUD("duck", 0.25);
        refreshOver(); $("over").hidden = false;                          // after the dance: the result screen, with the AABB calculation of the hit that ended the run
    }
    $("victory").addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); endVictory(); });
    addEventListener("resize", function () { if (vic) vsize($("v-fx")); });

    function commitRun() {
        if (st.committed || !st.started) return;
        st.committed = true;
        const sc = score(), d = Math.floor(st.dist);
        const s = readSave();
        s.coins = (s.coins == null ? 1250 : s.coins) + st.coins;
        s.stats = Object.assign({ bestScore: 0, bestDistance: 0, playSeconds: 0 }, s.stats || {});
        s.stats.bestScore = Math.max(s.stats.bestScore, sc); s.stats.bestDistance = Math.max(s.stats.bestDistance, d); s.stats.playSeconds += Math.round(st.t);
        const lvl = { level: s.level || 1, xp: s.xp || 0, xpNeeded: s.xpNeeded || 100 };
        lvl.xp += Math.round(d / 10) + st.kills * 2;
        while (lvl.xp >= lvl.xpNeeded) { lvl.xp -= lvl.xpNeeded; lvl.level++; lvl.xpNeeded = Math.round(lvl.xpNeeded * 1.25); }
        Object.assign(s, lvl);
        const today = new Date().toISOString().slice(0, 10);
        s.mission = Object.assign({ day: today, progress: 0, goal: 50, reward: 100, claimed: false }, s.mission || {});
        if (s.mission.day !== today) s.mission = { day: today, progress: 0, goal: 50, reward: 100, claimed: false };
        s.mission.progress += st.coins;
        s.dm = Object.assign({ day: today, dist: 0, kills: 0, claimed: {}, bonus: false }, s.dm || {});
        if (s.dm.day !== today) s.dm = { day: today, dist: 0, kills: 0, claimed: {}, bonus: false };
        s.dm.dist += d; s.dm.kills += st.kills;
        s.visited = Object.assign({}, s.visited || {}); s.visited[place] = 1;
        if (st.found.length) {
            const co = Object.assign({ have: {}, claimed: {} }, s.collect || {}); co.have = Object.assign({}, co.have);
            st.found.forEach(function (id) { co.have[id] = (co.have[id] || 0) + 1; });
            s.collect = co;
        }
        s.locStats = Object.assign({}, s.locStats); const L = Object.assign({ runs: 0, dist: 0, score: 0, kills: 0, coins: 0, pieces: 0, day: 0 }, s.locStats[place]);
        L.runs++; L.dist = Math.max(L.dist, d); L.score = Math.max(L.score, sc); L.kills += st.kills; L.coins += st.coins; L.pieces += st.found.length; L.day = Math.max(L.day, st.level + 1);
        s.locStats[place] = L;
        s.totals = Object.assign({ runs: 0, distance: 0, coins: 0, monsters: 0 }, s.totals || {});
        s.totals.runs++; s.totals.distance += d; s.totals.coins += st.coins; s.totals.monsters += st.kills;
        { const T2 = s.totals, add = function (k, v) { T2[k] = (T2[k] | 0) + v; }, mx = function (k, v) { T2[k] = Math.max(T2[k] | 0, v); };
          add("jumps", st.jumpsN); add("punches", st.punches); add("kicks", st.kicks); add("ducks", st.ducks); add("near", st.near); add("weapons", st.weaponsN);
          add("gems", st.gemsGot); add("pieces", st.found.length); add("revives", st.revives); add("nights", st.nights);
          mx("combo", st.bestCombo); mx("bestKills", st.kills); mx("bestCoins", st.coins); mx("maxDay", st.level + 1); }
        writeSave(s);
    }

    // ---------- drawing: helpers ----------
    function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
    function glow(x, y, r, col) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }

    // ---------- drawing: placeholder art (origin = bottom centre, y goes up as negative) ----------
    function artVehicle(o) {
        const col = ["#e0383e", "#2f7bff", "#f2b630"][o.v], dk = ["#9a1a22", "#1a4cb0", "#b07a10"][o.v];
        ctx.fillStyle = col; rr(-84, -50, 168, 34, 10); ctx.fill();
        ctx.fillStyle = dk; ctx.beginPath(); ctx.moveTo(-46, -50); ctx.lineTo(-28, -82); ctx.lineTo(38, -82); ctx.lineTo(58, -50); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#bfe8ff"; ctx.beginPath(); ctx.moveTo(-38, -54); ctx.lineTo(-24, -77); ctx.lineTo(-2, -77); ctx.lineTo(-2, -54); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(4, -54); ctx.lineTo(4, -77); ctx.lineTo(34, -77); ctx.lineTo(50, -54); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#ffe27a"; ctx.fillRect(-84, -44, 8, 10); ctx.fillStyle = "#ff3a3a"; ctx.fillRect(76, -44, 8, 10);
        [-50, 50].forEach(function (x) { ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(x, -16, 17, 0, 7); ctx.fill(); ctx.fillStyle = "#9aa"; ctx.beginPath(); ctx.arc(x, -16, 7, 0, 7); ctx.fill(); });
    }
    function artBird(o) {
        const f = Math.sin(o.ph * 1.4) * 22;
        ctx.save(); ctx.translate(0, -30);
        ctx.fillStyle = "#1f1a30"; ctx.beginPath(); ctx.moveTo(8, -4); ctx.quadraticCurveTo(20, -50 - f, 46, -34 - f * .6); ctx.lineTo(18, 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#2c2444"; ctx.beginPath(); ctx.ellipse(2, 0, 28, 14, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(24, -2); ctx.lineTo(46, 8); ctx.lineTo(24, 8); ctx.fill();
        ctx.fillStyle = "#3a2e58"; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.quadraticCurveTo(-8, -48 + f, -42, -30 + f * .6); ctx.lineTo(-18, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#2c2444"; ctx.beginPath(); ctx.arc(-26, -6, 11, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffb020"; ctx.beginPath(); ctx.moveTo(-34, -8); ctx.lineTo(-52, -2); ctx.lineTo(-34, 0); ctx.fill();
        ctx.fillStyle = "#ff3a3a"; ctx.beginPath(); ctx.arc(-29, -9, 3, 0, 7); ctx.fill();
        ctx.restore();
    }
    function wire(x0, y0, x1, y1, mid, col) { ctx.strokeStyle = col || "#14141c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, 2 * mid - (y0 + y1) / 2, x1, y1); ctx.stroke(); }
    function artPoleHigh(o) {
        ctx.fillStyle = "#6a4528"; ctx.fillRect(-7, -330, 14, 330); ctx.fillStyle = "#553620"; ctx.fillRect(-1, -330, 4, 330);
        ctx.fillRect(-50, -318, 100, 8); ctx.fillRect(-38, -290, 76, 6);
        ctx.fillStyle = "#cfe8e0"; [-44, -22, 22, 44].forEach(function (x) { ctx.fillRect(x - 3, -330, 6, 12); });
        [[-90, -92], [-100, -104], [-110, -118], [-122, -134], [-130, -150]].forEach(function (a, i) { wire(-110, -322 + i * 6, 110, -322 + i * 6, a[0] === -90 ? -130 : -130 - i * 8); });
        ctx.strokeStyle = "#14141c"; ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-26 + i * 13, -316); ctx.lineTo(-30 + i * 14 + Math.sin(o.ph + i) * 2, -134 - (i % 2) * 14); ctx.stroke(); }
        if (Math.sin(o.ph * 1.5) > 0.2) { ctx.fillStyle = "#ffe27a"; ctx.fillRect(-4, -136, 8, 8); ctx.fillStyle = "#fff"; ctx.fillRect(-1, -134, 3, 3); }
    }
    function artPoleLow(o) {
        ctx.save(); ctx.rotate(-0.16); ctx.fillStyle = "#6a4528"; ctx.fillRect(-80, -40, 150, 14); ctx.fillStyle = "#553620"; ctx.fillRect(-80, -30, 150, 4); ctx.fillStyle = "#cfe8e0"; ctx.fillRect(-50, -48, 6, 10); ctx.fillRect(10, -48, 6, 10); ctx.restore();
        for (let i = 0; i < 5; i++) wire(-90, -4 - i * 2, 90, -6, -40 - i * 5 + Math.sin(o.ph + i) * 2);
        if (Math.sin(o.ph * 1.7) > 0) { ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.arc(-20 + Math.sin(o.ph) * 30, -26, 6, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-20 + Math.sin(o.ph) * 30, -26, 2.5, 0, 7); ctx.fill(); }
    }
    function artGhoul(o) {
        const b = Math.sin(o.ph) * 3;
        ctx.fillStyle = "#2a8a4a"; rr(-24, -66 - b, 48, 54, 14); ctx.fill();
        ctx.fillStyle = "#3ad06a"; ctx.beginPath(); ctx.arc(0, -70 - b, 24, 0, 7); ctx.fill();
        ctx.fillStyle = "#2a8a4a"; ctx.fillRect(-18, -14, 12, 14 + Math.sin(o.ph * 1.3) * 4); ctx.fillRect(6, -14, 12, 14 - Math.sin(o.ph * 1.3) * 4);
        ctx.strokeStyle = "#2a8a4a"; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-18, -50 - b); ctx.lineTo(-48, -56 + Math.sin(o.ph) * 5); ctx.stroke();
        ctx.fillStyle = "#ff3030"; ctx.fillRect(-16, -78 - b, 9, 9); ctx.fillRect(4, -78 - b, 9, 9);
        ctx.fillStyle = "#1a2a1a"; ctx.beginPath(); ctx.moveTo(-14, -58 - b); ctx.lineTo(-7, -52 - b); ctx.lineTo(0, -58 - b); ctx.lineTo(7, -52 - b); ctx.lineTo(14, -58 - b); ctx.lineTo(14, -50 - b); ctx.lineTo(-14, -50 - b); ctx.fill();
    }
    function artBrute(o) {
        const b = Math.sin(o.ph * 0.7) * 3;
        ctx.fillStyle = "#6a2a8a"; rr(-34, -92 - b, 68, 74, 18); ctx.fill();
        ctx.fillStyle = "#8a3aae"; ctx.beginPath(); ctx.arc(0, -98 - b, 28, 0, 7); ctx.fill();
        ctx.fillStyle = "#e8e0c0"; ctx.beginPath(); ctx.moveTo(-24, -112 - b); ctx.lineTo(-34, -138 - b); ctx.lineTo(-12, -120 - b); ctx.fill(); ctx.beginPath(); ctx.moveTo(24, -112 - b); ctx.lineTo(34, -138 - b); ctx.lineTo(12, -120 - b); ctx.fill();
        ctx.fillStyle = "#4a1a66"; ctx.fillRect(-26, -20, 18, 20 + Math.sin(o.ph) * 4); ctx.fillRect(8, -20, 18, 20 - Math.sin(o.ph) * 4);
        ctx.strokeStyle = "#6a2a8a"; ctx.lineWidth = 16; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-28, -76 - b); ctx.lineTo(-58, -60 + Math.sin(o.ph) * 6); ctx.stroke();
        ctx.fillStyle = "#ff2a2a"; ctx.fillRect(-16, -104 - b, 10, 8); ctx.fillRect(6, -104 - b, 10, 8);
        ctx.fillStyle = "#fff"; for (let i = -12; i <= 8; i += 8) ctx.fillRect(i, -84 - b, 5, 8);
    }
    function artWraith(o) {
        const f = Math.sin(o.ph * 0.8) * 5;
        glow(0, -38, 56, "rgba(160,120,255,.45)");
        ctx.fillStyle = "rgba(205,190,255,.92)";
        ctx.beginPath(); ctx.arc(0, -46, 26, Math.PI, 0); ctx.lineTo(26, -4 + f);
        for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(26 - i * 13 - 6.5, 8 - f, 26 - i * 13 - 13, -4 + f);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#2a1a5a"; ctx.beginPath(); ctx.ellipse(-9, -46, 5, 8, 0, 0, 7); ctx.ellipse(9, -46, 5, 8, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -30, 6, 9, 0, 0, 7); ctx.fill();
    }
    const DRAWERS = { vehicle: artVehicle, bird_high: artBird, bird_low: artBird, pole_high: artPoleHigh, pole_low: artPoleLow, ghoul: artGhoul, brute: artBrute, wraith: artWraith };
    function drawObs(o) {
        const d = o.d, r = rectOf(o);
        ctx.save(); ctx.translate(o.x, GROUND - d.lift - (r.bob || 0));
        if (o.dead) { ctx.globalAlpha = Math.max(0, 1 - (o.dead - 1) / 3); ctx.scale(1, Math.max(.15, 1 - (o.dead - 1) * .3)); }
        if (o.flash > 0) { if (window.RUNMIL_PERF) ctx.globalAlpha = 0.55; else ctx.filter = "brightness(2.2)"; }
        const im = ART[o.k];
        let sa = null;
        if (d.anim) {
            const key = (d.attack && o.x < PX + (d.mon ? 320 : 440)) ? d.attack : d.anim;
            sa = AN.mon[key]; if (sa && !sa.img) sa = null;
        }
        if (sa) { const h = d.dh * sa.fh / 260, w = h * sa.fw / sa.fh, f = Math.floor((o.ph / 8) * 1000 / sa.fms) % sa.n; putFrame(sa, f, -w / 2, -h, w, h); }
        else if (ok(im)) { const h = d.dh, w = h * im.naturalWidth / im.naturalHeight; ctx.drawImage(im, -w / 2, -h, w, h); }
        else DRAWERS[o.k](o);
        ctx.restore();
        if (d.mon && o.hpMax > 1 && !o.dead) {       // health pips
            const w = 12 * o.hpMax, x = o.x - w / 2, y = GROUND - d.t - 20;
            for (let i = 0; i < o.hpMax; i++) { ctx.fillStyle = i < o.hp ? "#ff4a5a" : "#333"; ctx.fillRect(x + i * 12, y, 10, 6); }
        }
    }

    // ---------- drawing: player ----------
    function skin() { return "#e98c58"; }
    function drawPlayer() {
        const P = AN.player;
        if (!(P.run && P.run.img && P.punch && P.punch.img && P.kick && P.kick.img && P.jump && P.jump.img)) { drawPlayerOld(); return; }
        const fy = st.y + 4;
        ctx.fillStyle = "rgba(0,0,30,.35)"; ctx.beginPath(); ctx.ellipse(PX, GROUND + 10, 52 - (GROUND - st.y) * .1, 8, 0, 0, 7); ctx.fill();
        if (st.inv > 0 && Math.floor(st.inv * 14) % 2) return;
        const act = st.act, air = st.y < GROUND - 0.5 && !st.standing;
        let a = P.run, f = st.started ? frameByTime(P.run, st.runT) : 0;
        if (act) { a = act.k === "punch" ? P.punch : P.kick; f = Math.min(a.n - 1, Math.floor(act.t / act.dur * a.n)); }
        else if (air) { a = P.jump; f = Math.min(a.n - 1, 3 + Math.floor(Math.min(1, st.airT / 0.8) * (a.n - 9))); }
        ctx.save();
        if (st.over) { const k = Math.min(1, st.overT * 3); ctx.translate(PX, fy); ctx.rotate(-1.45 * k); ctx.translate(-PX, -fy); a = P.run; f = 0; }
        else if (st.duck && P.duck && P.duck.img) { a = P.duck; f = frameByTime(P.duck, st.duckT); }        // your crouch GIF
        else if (st.duck) { ctx.translate(PX + 6, fy); ctx.rotate(0.42); ctx.scale(1, 0.6); ctx.translate(-PX - 6, -fy); a = P.run; f = 2; }
        const dk = a === P.duck && !st.over, sc = dk ? DUCK_VISUAL_H / a.fh : a.sc;      // the crouch is drawn small enough to pass under hazards
        putFrame(a, f, PX - a.ax * sc, fy - a.gy * sc, a.fw * sc, a.fh * sc);
        ctx.restore();
    }
    function drawPlayerOld() {
        const col = C && C.getColors ? C.getColors() : {};
        const shirt = col.shirt || "#f6f0da", pants = col.pants || "#1f2540", shoes = col.shoes || "#2a1d1d";
        const air = st.y < GROUND - 0.5, fy = st.y + 6;
        ctx.fillStyle = "rgba(0,0,30,.35)"; ctx.beginPath(); ctx.ellipse(PX, GROUND + 10, 52 - (GROUND - st.y) * .1, 8, 0, 0, 7); ctx.fill();
        if (st.inv > 0 && Math.floor(st.inv * 14) % 2) return;
        const act = st.act, e = act ? Math.sin(Math.min(1, act.t / act.dur) * Math.PI) : 0;
        ctx.save();
        if (st.over) {                                        // knocked over
            const k = Math.min(1, st.overT * 3);
            ctx.translate(PX, fy); ctx.rotate(-1.45 * k); ctx.translate(-PX, -fy);
            C.drawFrame(ctx, 3, PX, fy, 190, false); ctx.restore(); return;
        }
        if (st.duck) {                                        // bow down
            ctx.translate(PX + 6, fy); ctx.rotate(0.38); ctx.scale(1, 0.62); ctx.translate(-PX - 6, -fy);
            C.drawFrame(ctx, 6, PX, fy, 190, false); ctx.restore(); return;
        }
        const fi = !st.started ? 0 : act ? (act.k === "kick" ? 6 : 12) : air ? 9 : C.frameAt(st.t * 1000);
        if (act && act.k === "punch") { ctx.translate(PX, fy); ctx.rotate(0.07 * e); ctx.translate(-PX, -fy); }
        if (act && act.k === "kick") { ctx.translate(PX, fy); ctx.rotate(-0.13 * e); ctx.translate(-PX, -fy); }
        C.drawFrame(ctx, fi % C.frames, PX, fy, 190, false);
        ctx.lineCap = "round";
        if (act && act.k === "punch") {                       // jab: arm shoots forward from the shoulder
            const sx = PX + 26, sy = fy - 112, ext = 14 + 62 * e, ex = sx + ext, ey = sy + 6;
            ctx.strokeStyle = "#1a0e08"; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.strokeStyle = skin(); ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(sx + 12, sy + 1); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.strokeStyle = shirt; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(sx - 2, sy); ctx.lineTo(sx + 10, sy + 1); ctx.stroke();
            ctx.fillStyle = "#1a0e08"; ctx.beginPath(); ctx.arc(ex + 3, ey, 11, 0, 7); ctx.fill(); ctx.fillStyle = skin(); ctx.beginPath(); ctx.arc(ex + 3, ey, 8.5, 0, 7); ctx.fill();
            ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(ex + 1, ey - 8, 2, 16); ctx.fillRect(ex + 7, ey - 8, 2, 16);
            if (act.t >= act.w0 && act.t <= act.w1 + 0.05) {
                ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 4;
                for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(ex + 22, ey + i * 14); ctx.lineTo(ex + 52, ey + i * 22); ctx.stroke(); }
                glow(ex + 22, ey, 30, "rgba(255,200,90,.7)");
            }
        } else if (act && act.k === "kick") {                 // kick: leg swings out from the hip
            const hx = PX + 4, hy = fy - 80, ext = 14 + 66 * e, ang = -0.1 - 0.3 * (1 - e), lx = hx + Math.cos(ang) * ext, ly = hy + Math.sin(ang) * ext - 10 * e;
            ctx.strokeStyle = "#0b0b18"; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lx, ly); ctx.stroke();
            ctx.strokeStyle = pants; ctx.lineWidth = 17; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lx, ly); ctx.stroke();
            ctx.save(); ctx.translate(lx, ly); ctx.rotate(-0.15); ctx.fillStyle = "#fff"; ctx.fillRect(-4, -9, 10, 16); ctx.fillStyle = shoes; rr(-2, -9, 26, 18, 6); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.fillRect(4, -9, 18, 4); ctx.restore();
            if (act.t >= act.w0 && act.t <= act.w1 + 0.06) {
                ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(hx + 8, hy, ext + 28, -0.75, 0.3); ctx.stroke();
                ctx.strokeStyle = "rgba(122,255,192,.7)"; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(hx + 8, hy, ext + 38, -0.65, 0.2); ctx.stroke();
            }
        }
        ctx.restore();
    }

    // ---------- drawing: shop weapons ----------
    function artPencil() {
        ctx.fillStyle = "#ffd24a"; ctx.fillRect(-24, -5, 44, 10); ctx.fillStyle = "#e0a000"; ctx.fillRect(-24, -1, 44, 2);
        ctx.fillStyle = "#f0c890"; ctx.beginPath(); ctx.moveTo(20, -5); ctx.lineTo(33, 0); ctx.lineTo(20, 5); ctx.fill();
        ctx.fillStyle = "#2a2a3a"; ctx.beginPath(); ctx.moveTo(28, -1.8); ctx.lineTo(33, 0); ctx.lineTo(28, 1.8); ctx.fill();
        ctx.fillStyle = "#c8c8d8"; ctx.fillRect(-27, -5, 4, 10); ctx.fillStyle = "#ff8fb0"; ctx.fillRect(-34, -5, 7, 10);
    }
    function artRuler() {
        ctx.fillStyle = "#f4e3b0"; ctx.fillRect(-40, -9, 80, 18); ctx.strokeStyle = "#8a6a20"; ctx.lineWidth = 2; ctx.strokeRect(-40, -9, 80, 18);
        ctx.fillStyle = "#5a4010"; for (let i = -36; i <= 36; i += 8) ctx.fillRect(i, -9, 1.6, i % 16 === 0 ? 9 : 5);
    }
    function artLaser() {
        ctx.fillStyle = "#3a3f66"; ctx.fillRect(-26, -8, 34, 18); ctx.fillRect(-20, 6, 12, 18);
        ctx.fillStyle = "#6a72b0"; ctx.fillRect(8, -5, 24, 10); ctx.fillStyle = "#7affff"; ctx.fillRect(30, -3, 6, 6);
        ctx.fillStyle = "#ff4a5a"; ctx.fillRect(-16, -4, 8, 6);
    }
    function artBlast() {
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22); g.addColorStop(0, "#fff"); g.addColorStop(.4, "#ffd24a"); g.addColorStop(1, "rgba(255,90,20,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill();
    }
    const WART = { pencil: artPencil, ruler: artRuler, laser: artLaser, blast: artBlast };
    function drawShots() {
        st.fx.forEach(function (f) {
            const k = f.t / f.T;
            ctx.save();
            if (f.k === "laser") {
                ctx.globalAlpha = 0.2 * k; ctx.fillStyle = "#7affff"; ctx.fillRect(f.x0, st.y - 195, W - f.x0, 199);
                ctx.globalAlpha = Math.min(1, k * 1.6);
                const g = ctx.createLinearGradient(0, f.y - 16, 0, f.y + 16); g.addColorStop(0, "rgba(120,255,255,0)"); g.addColorStop(.5, "#9affff"); g.addColorStop(1, "rgba(120,255,255,0)");
                ctx.fillStyle = g; ctx.fillRect(f.x0, f.y - 16, W - f.x0, 32); ctx.fillStyle = "#fff"; ctx.fillRect(f.x0, f.y - 3, W - f.x0, 6);
            } else {
                const r = 30 + 120 * (1 - k), g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
                ctx.globalAlpha = Math.min(1, k * 1.4); g.addColorStop(0, "#fff"); g.addColorStop(.35, "#ffd24a"); g.addColorStop(.7, "rgba(255,110,30,.7)"); g.addColorStop(1, "rgba(255,60,0,0)");
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill();
            }
            ctx.restore();
        });
        st.shots.forEach(function (sh) {
            ctx.save(); ctx.translate(sh.x, sh.y);
            if (sh.k === "blast") { ctx.globalAlpha = .35; ctx.translate(-26, 0); artBlast(); ctx.translate(13, 0); ctx.globalAlpha = .6; artBlast(); ctx.translate(13, 0); ctx.globalAlpha = 1; artBlast(); }
            else { ctx.rotate(sh.a); WART[sh.k](); }
            ctx.restore();
        });
    }
    function drawWeaponHud() {
        WEAPONS.forEach(function (w, i) {
            const x = BTN.x, y = BTN.y + i * (BTN.s + BTN.gap), s = BTN.s, a = st.ammo[w.id], cd = st.cdt[w.id] > 0 ? st.cdt[w.id] / w.cd : 0;
            ctx.save();
            rr(x, y, s, s, 10);
            ctx.fillStyle = "rgba(8,12,44,.82)"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = a > 0 ? "#4a6cff" : "#555"; ctx.stroke(); ctx.clip();
            ctx.save(); ctx.translate(x + s / 2, y + s / 2 - 2); ctx.scale(a > 0 ? .8 : .7, a > 0 ? .8 : .7); ctx.globalAlpha = a > 0 ? 1 : .35; WART[w.id](); ctx.restore();
            if (cd > 0) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x, y, s, s * cd); }
            ctx.font = "700 17px Teko, Impact, sans-serif"; ctx.textBaseline = "top"; ctx.lineWidth = 4; ctx.strokeStyle = "#0a0a28";
            ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.strokeText(String(i + 1), x + 6, y + 3); ctx.fillText(String(i + 1), x + 6, y + 3);
            ctx.font = "700 22px Teko, Impact, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillStyle = a > 0 ? "#ffd24a" : "#ff6a6a";
            ctx.strokeText(String(a), x + s - 5, y + s + 1); ctx.fillText(String(a), x + s - 5, y + s + 1);
            ctx.restore();
        });
    }

    // ---------- drawing: HUD ----------
    function txt(s, x, y, al, size, col) {
        ctx.font = "700 " + (size || 34) + "px Teko, Impact, sans-serif"; ctx.textAlign = al || "left"; ctx.lineWidth = 5; ctx.strokeStyle = "#0a0a28"; ctx.lineJoin = "round";
        ctx.strokeText(s, x, y); ctx.fillStyle = col || "#fff"; ctx.fillText(s, x, y);
    }
    function hud() {
        ctx.textBaseline = "top";
        txt("SCORE " + score().toLocaleString(), 24, 14, "left", 34);
        // day / night chip
        const night = st.nf > 0.5, ct = st.ct, ph = phaseOf(ct);
        const left = ph === "day" ? DAY_LEN - ct : ph === "night" ? DAY_LEN + FADE + NIGHT_LEN - ct : ph === "dusk" ? DAY_LEN + FADE - ct : CYCLE - ct;
        ctx.save();
        rr(22, 54, 196, 30, 8); ctx.fillStyle = "rgba(8,12,44,.78)"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = night ? "#8a7aff" : "#ffb41f"; ctx.stroke();
        const ix = 40, iy = 69;
        if (night) { ctx.fillStyle = "#f4ecc0"; ctx.beginPath(); ctx.arc(ix, iy, 9, 0, 7); ctx.fill(); ctx.fillStyle = "#1a1f58"; ctx.beginPath(); ctx.arc(ix + 5, iy - 3, 8, 0, 7); ctx.fill(); }
        else { ctx.fillStyle = "#ffd24a"; ctx.beginPath(); ctx.arc(ix, iy, 8, 0, 7); ctx.fill(); ctx.strokeStyle = "#ffd24a"; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * 11, iy + Math.sin(a) * 11); ctx.lineTo(ix + Math.cos(a) * 15, iy + Math.sin(a) * 15); ctx.stroke(); } }
        ctx.restore();
        txt(ph === "day" ? "DAY" : ph === "night" ? "NIGHT" : ph === "dusk" ? "DUSK" : "DAWN", 62, 56, "left", 24, night ? "#c8baff" : "#ffd24a");
        txt(Math.max(0, Math.ceil(left)) + "s", 208, 56, "right", 24, "#cfd6ff");
        if (st.hits > 0) txt("SHIELD x" + st.hits, 24, 90, "left", 26, "#7affff");
        // coins + gems
        const gems = readGems();
        const cw = (ok(iconCoin) ? 30 : 0);
        if (ok(iconCoin)) ctx.drawImage(iconCoin, W / 2 - 62, 12, 30, 30); else { ctx.fillStyle = "#ffd24a"; ctx.beginPath(); ctx.arc(W / 2 - 48, 28, 12, 0, 7); ctx.fill(); }
        txt(String(st.coins), W / 2 - 26, 14, "left", 34, "#ffd24a");
        if (ok(iconGem)) ctx.drawImage(iconGem, W / 2 - 62, 50, 28, 28); else { ctx.fillStyle = "#6ad8ff"; ctx.beginPath(); ctx.moveTo(W / 2 - 48, 52); ctx.lineTo(W / 2 - 36, 64); ctx.lineTo(W / 2 - 48, 76); ctx.lineTo(W / 2 - 60, 64); ctx.fill(); }
        txt(String(gems), W / 2 - 26, 50, "left", 28, "#7affff");
        txt(Math.floor(st.dist) + " m", W - 80, 14, "right", 34);
        if (st.combo >= 2) { ctx.globalAlpha = Math.min(1, st.comboT / 0.6); txt("COMBO x" + st.combo, W / 2, 96, "center", 36, "#ff9aff"); ctx.globalAlpha = 1; }
        drawWeaponHud();
    }
    let gemCache = 0, gemT = 0;
    function readGems() { const n = performance.now(); if (n - gemT > 500) { gemT = n; const g = readSave().gems; gemCache = g == null ? 50 : g; } return gemCache; }

    // ---------- frame ----------
    function frame(now) {
        requestAnimationFrame(frame);                      // schedule first, so one bad frame can never stop the game
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        try { update(dt); } catch (err) { if (!frame.warned) { frame.warned = 1; console.error("[RUN MIL] update error:", err); } }
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        if (st.shake > 0) ctx.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8);
        drawGround();
        // speed streaks
        if (st.started && !st.over) { ctx.fillStyle = "rgba(255,255,255,.14)"; for (let i = 0; i < 7; i++) { const x = ((i * 241 - st.scroll * 1.5) % (W + 200) + W + 200) % (W + 200) - 100; ctx.fillRect(x, GROUND + 18 + (i * 37) % 70, 60 + (i * 13) % 50, 2); } }
        st.pick.forEach(function (c) {
            const w = Math.abs(Math.cos(c.ph)) * 11 + 3; ctx.fillStyle = "#ffd24a"; ctx.beginPath(); ctx.ellipse(c.x, c.y, w, 13, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#ff9a10"; ctx.beginPath(); ctx.ellipse(c.x, c.y, w * .5, 8, 0, 0, 7); ctx.fill();
        });
        st.gems.forEach(function (g) {
            const bob = Math.sin(g.ph) * 5; glow(g.x, g.y + bob, 34, "rgba(122,255,255,.55)");
            ctx.fillStyle = "#4de8ff"; ctx.beginPath(); ctx.moveTo(g.x, g.y + bob - 16); ctx.lineTo(g.x + 13, g.y + bob); ctx.lineTo(g.x, g.y + bob + 16); ctx.lineTo(g.x - 13, g.y + bob); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.moveTo(g.x, g.y + bob - 16); ctx.lineTo(g.x + 13, g.y + bob); ctx.lineTo(g.x, g.y + bob); ctx.closePath(); ctx.fill();
        });
        st.items.forEach(function (c) {
            const it = CO.items[c.id]; if (!it) return;
            const bob = Math.sin(c.ph) * 6, pulse = 0.5 + 0.5 * Math.sin(c.ph * 1.6);
            glow(c.x, c.y + bob, 40 + pulse * 8, "rgba(255,243,160," + (0.5 + pulse * 0.25) + ")");
            ctx.save(); ctx.font = "40px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(it.ic, c.x, c.y + bob + 2); ctx.restore();
        });
        st.obs.forEach(drawObs);
        drawPlayer();
        drawShots();
        if (window.RMX && RMX.vis.mode === 1 && st.started) {                  // X-RAY: every invisible box, live
            const xl = [];
            st.obs.forEach(function (o) { if (!o.dead) xl.push({ B: hitBox(o) }); });
            st.pick.forEach(function (c) { xl.push({ B: centreBox(c.x, c.y, 14, 14) }); }); st.items.forEach(function (c) { xl.push({ B: centreBox(c.x, c.y, 22, 22) }); }); st.gems.forEach(function (c) { xl.push({ B: centreBox(c.x, c.y, 16, 16) }); });
            RMX.vis.xray(ctx, playerBox(), xl, 0, 0, W, H);
            if (st.act && st.atkBox) { const ab = st.atkBox; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeStyle = "#ffb24a"; ctx.strokeRect(ab.x, ab.y, ab.w, ab.h); ctx.setLineDash([]); }
        }
        if (window.RMX) RMX.vis.draw(ctx, 0, 0, W, H, st.paused ? 0 : dt);
        st.parts.forEach(function (p) {
            if (p.big) { glow(p.x, p.y, 34, "rgba(255,255,255,.95)"); return; }
            ctx.globalAlpha = Math.max(0, p.l * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 6, 6);
        }); ctx.globalAlpha = 1;
        ctx.restore();
        hud();
        st.texts.forEach(function (f) { ctx.globalAlpha = Math.min(1, f.l * 2); txt(f.s, f.x, f.y, "center", 30, f.c); }); ctx.globalAlpha = 1;
        ctx.textBaseline = "alphabetic";
        if (st.banner) { ctx.globalAlpha = Math.min(1, st.banner.t); txt(st.banner.s, W / 2, 128, "center", 44, st.banner.c); ctx.globalAlpha = 1; }
        if (!st.started) txt(touchMode ? "TAP TO START" : "PRESS SPACE TO START", W / 2, 170, "center", 46);
        if (st.cd > 0 && st.started && !st.paused) txt(String(Math.ceil(st.cd)), W / 2, H / 2 - 10, "center", 120);
    }
    initLayer("day"); initLayer("night");
    requestAnimationFrame(function (n) { last = n; frame(n); });

    // handy for testing / future modes
    window.RunMilGame = { setVictoryMin: function (n) { VMIN = n; }, state: function () { return st; }, spawn: spawnHazard, OB: OB };
})();
