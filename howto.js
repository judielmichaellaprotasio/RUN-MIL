/* =========================================================
   RUN MIL!  -  HOW TO PLAY, game mechanics and the AABB lessons
   Shared by index.html (menu button), game.html (Endless) and survival.html (Monster Survival).

   window.RMX.openHowTo(tab)        full tutorial: keys of both games + live AABB lessons
   window.RMX.mechanics(mode, cb)   the "game mechanics" card shown before a game starts ("endless" | "survival")
   window.RMX.calc(el, rec, opts)   the AABB calculation shown when the player loses
   window.RMX.conds(A, B)           the four conditions of the AABB test, with numbers
========================================================= */
(function () {
    "use strict";
    if (window.RMX) return;
    const RMX = window.RMX = {};
    const COL = { a: "#6f99ff", b: "#ffa23f", hit: "#3ddc97", miss: "#ff6b6e" };

    // ---------- small helpers ----------
    function r1(v) { return +(+v).toFixed(1); }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function h(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
    const IMG = {};
    function img(src) { if (IMG[src]) return IMG[src]; const i = new Image(); i.src = src; IMG[src] = i; return i; }
    function ready(i) { return i && i.complete && i.naturalWidth > 0; }

    // ---------- the AABB test itself (the same four comparisons the game's Java / JS engine makes) ----------
    RMX.conds = function (A, B) {
        const aL = A.x, aR = A.x + A.w, aT = A.y, aB = A.y + A.h, bL = B.x, bR = B.x + B.w, bT = B.y, bB = B.y + B.h;
        return [
            { axis: "x", f: "A.left < B.right", n: r1(aL) + " < " + r1(bR), ok: aL < bR, say: "A starts before B ends" },
            { axis: "x", f: "A.right > B.left", n: r1(aR) + " > " + r1(bL), ok: aR > bL, say: "A ends after B starts" },
            { axis: "y", f: "A.top < B.bottom", n: r1(aT) + " < " + r1(bB), ok: aT < bB, say: "A starts above where B ends" },
            { axis: "y", f: "A.bottom > B.top", n: r1(aB) + " > " + r1(bT), ok: aB > bT, say: "A ends below where B starts" }
        ];
    };
    function condsHTML(A, B, opt) {
        opt = opt || {};
        const cs = RMX.conds(A, B), all = cs.every(function (c) { return c.ok; });
        let first = -1; cs.forEach(function (c, i) { if (!c.ok && first < 0) first = i; });
        let o = '<div class="rmx-conds">';
        cs.forEach(function (c, i) {
            if (i === 0) o += '<div class="rmx-axis">X AXIS (left - right)</div>'; if (i === 2) o += '<div class="rmx-axis">Y AXIS (up - down)</div>';
            o += '<div class="rmx-c ' + (c.ok ? "ok" : "no2") + '"><span class="no">' + (i + 1) + '</span><span class="f">' + c.f + '</span><span class="pill">' + (c.ok ? "TRUE" : "FALSE") + '</span>' +
                '<span class="nf"><span class="n">' + c.n + '</span></span><span class="say">' + c.say + '</span></div>';
        });
        o += "</div>";
        o += '<div class="rmx-verdict ' + (all ? "hit" : "miss") + '"><strong>' + (all ? "COLLISION!" : "NO COLLISION") + "</strong><span>" +
            (all ? "All 4 are TRUE, so the boxes overlap on both axis." : "Condition " + (first + 1) + " is FALSE, so there is a gap on the " + cs[first].axis + " axis.") + "</span></div>";
        return o;
    }
    function boxNumsHTML(A, B, an, bn, compact) {
        function row(cls, nm, X) { return '<div class="' + cls + '"><b>' + (compact ? nm.split(" ")[0] : esc(nm)) + "</b>  x " + r1(X.x) + ", y " + r1(X.y) + ", w " + r1(X.w) + ", h " + r1(X.h) + (compact ? "" : "  (left " + r1(X.x) + " | right " + r1(X.x + X.w) + " | top " + r1(X.y) + " | bottom " + r1(X.y + X.h) + ")") + "</div>"; }
        return '<div class="rmx-boxnums">' + row("a", "A = " + an, A) + row("b", "B = " + bn, B) + "</div>";
    }
    function codeHTML(A, B) {
        const ok = RMX.conds(A, B).every(function (c) { return c.ok; });
        return '<div class="rmx-code">RunMilAABB.overlap(<s>' + [A.x, A.y, A.w, A.h].map(r1).join(", ") + "</s>,   <s>" + [B.x, B.y, B.w, B.h].map(r1).join(", ") + "</s>)  ->  " + (ok ? "<em>true</em>" : "<u>false</u>") + "</div>";
    }

    // ---------- drawing a scene: sprites, the invisible boxes, the "shadows" on both axis ----------
    function drawScene(cv, cfg) {
        const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, v = cfg.view || { ox: 0, oy: 0, s: 1 };
        const X = function (x) { return (x - v.ox) * v.s; }, Y = function (y) { return (y - v.oy) * v.s; };
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1a2a82"); g.addColorStop(1, "#080e3c"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(120,150,255,.10)"; ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
        if (cfg.ground != null) { const gy = Y(cfg.ground); ctx.fillStyle = "rgba(10,16,60,.9)"; ctx.fillRect(0, gy, W, H - gy); ctx.strokeStyle = "#5c78ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
        ctx.imageSmoothingEnabled = true;
        (cfg.sprites || []).forEach(function (sp) {
            ctx.save(); ctx.globalAlpha = sp.alpha == null ? 1 : sp.alpha;
            if (sp.fn) sp.fn(ctx, X, Y, v.s);
            else if (ready(sp.img)) ctx.drawImage(sp.img, sp.sx, sp.sy, sp.sw, sp.sh, X(sp.x), Y(sp.y), sp.w * v.s, sp.h * v.s);
            ctx.restore();
        });
        (cfg.refs || []).forEach(function (r) { ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = "rgba(200,210,255,.55)"; ctx.lineWidth = 1.5; ctx.strokeRect(X(r.x), Y(r.y), r.w * v.s, r.h * v.s); ctx.fillStyle = "rgba(200,210,255,.75)"; ctx.font = "700 12px Teko, sans-serif"; ctx.fillText(r.label || "", X(r.x) + 3, Y(r.y) + 12); ctx.restore(); });
        const A = cfg.A, B = cfg.B, aL = X(A.x), aR = X(A.x + A.w), aT = Y(A.y), aB = Y(A.y + A.h), bL = X(B.x), bR = X(B.x + B.w), bT = Y(B.y), bB = Y(B.y + B.h);
        const barAy = H - 40, barBy = H - 25, barAx = W - 40, barBx = W - 25, bt = 9;
        // guide lines from every edge to the shadows
        ctx.save(); ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
        [[aL, COL.a], [aR, COL.a], [bL, COL.b], [bR, COL.b]].forEach(function (e) { ctx.strokeStyle = e[1]; ctx.globalAlpha = .5; ctx.beginPath(); ctx.moveTo(e[0], 0); ctx.lineTo(e[0], barAy - 4); ctx.stroke(); });
        [[aT, COL.a], [aB, COL.a], [bT, COL.b], [bB, COL.b]].forEach(function (e) { ctx.strokeStyle = e[1]; ctx.globalAlpha = .5; ctx.beginPath(); ctx.moveTo(0, e[0]); ctx.lineTo(barAx - 4, e[0]); ctx.stroke(); });
        ctx.restore();
        // the two boxes
        const ox0 = Math.max(aL, bL), ox1 = Math.min(aR, bR), oy0 = Math.max(aT, bT), oy1 = Math.min(aB, bB), both = ox0 < ox1 && oy0 < oy1;
        function box(x, y, w, hh, c) { ctx.fillStyle = c + "33"; ctx.fillRect(x, y, w, hh); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, w, hh); }
        box(aL, aT, aR - aL, aB - aT, COL.a); box(bL, bT, bR - bL, bB - bT, COL.b);
        if (both) { ctx.fillStyle = "rgba(61,220,151,.55)"; ctx.fillRect(ox0, oy0, ox1 - ox0, oy1 - oy0); ctx.strokeStyle = COL.hit; ctx.lineWidth = 2; ctx.strokeRect(ox0, oy0, ox1 - ox0, oy1 - oy0); }
        ctx.font = "700 15px Teko, sans-serif"; ctx.textBaseline = "alphabetic";
        function tag(txt, x, y, c) { ctx.lineWidth = 4; ctx.strokeStyle = "#050a2c"; ctx.strokeText(txt, x, y); ctx.fillStyle = c; ctx.fillText(txt, x, y); }
        tag("A", aL + 4, Math.max(14, aT - 5), COL.a); tag("B", bL + 4, Math.max(14, bT - 5) + (Math.abs(aL - bL) < 18 && Math.abs(aT - bT) < 16 ? 14 : 0), COL.b);
        // shadows on the x axis (bottom) and the y axis (right)
        function strip(a0, a1, b0, b1, horiz) {
            const lo = Math.max(a0, b0), hi = Math.min(a1, b1), shared = lo < hi, s0 = shared ? lo : Math.min(a1, b1), s1 = shared ? hi : Math.max(a0, b0);
            ctx.save();
            if (horiz) { ctx.fillStyle = shared ? "rgba(61,220,151,.45)" : "rgba(255,107,110,.28)"; ctx.fillRect(s0, barAy - 3, Math.max(s1 - s0, 2), barBy + bt - barAy + 6); ctx.fillStyle = COL.a; ctx.fillRect(a0, barAy, a1 - a0, bt); ctx.fillStyle = COL.b; ctx.fillRect(b0, barBy, b1 - b0, bt); }
            else { ctx.fillStyle = shared ? "rgba(61,220,151,.45)" : "rgba(255,107,110,.28)"; ctx.fillRect(barAx - 3, s0, barBx + bt - barAx + 6, Math.max(s1 - s0, 2)); ctx.fillStyle = COL.a; ctx.fillRect(barAx, a0, bt, a1 - a0); ctx.fillStyle = COL.b; ctx.fillRect(barBx, b0, bt, b1 - b0); }
            if (!shared) { ctx.strokeStyle = COL.miss; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; if (horiz) ctx.strokeRect(s0, barAy - 3, Math.max(s1 - s0, 2), barBy + bt - barAy + 6); else ctx.strokeRect(barAx - 3, s0, barBx + bt - barAx + 6, Math.max(s1 - s0, 2)); }
            ctx.restore();
        }
        strip(aL, aR, bL, bR, true); strip(aT, aB, bT, bB, false);
        ctx.font = "700 12px Teko, sans-serif"; ctx.fillStyle = "#9fb0e8"; ctx.textAlign = "right"; ctx.fillText("x axis", 40, barAy + 8); ctx.textAlign = "center"; ctx.fillText("y axis", barAx + 12, 12); ctx.textAlign = "start";
    }
    function fitView(A, B, W, H, extra) {          // scale + offset so both boxes (and anything in extra) fit with room for the shadow bars
        const bs = [A, B].concat(extra || []), x0 = Math.min.apply(null, bs.map(function (b) { return b.x; })), x1 = Math.max.apply(null, bs.map(function (b) { return b.x + b.w; }));
        const y0 = Math.min.apply(null, bs.map(function (b) { return b.y; })), y1 = Math.max.apply(null, bs.map(function (b) { return b.y + b.h; }));
        const aw = W - 62, ah = H - 62, pad = 18, s = Math.min(3, Math.min((aw - pad * 2) / Math.max(1, x1 - x0), (ah - pad * 2) / Math.max(1, y1 - y0)));
        return { s: s, ox: x0 - (aw - (x1 - x0) * s) / 2 / s, oy: y0 - (ah - (y1 - y0) * s) / 2 / s };
    }

    // ---------- the characters (real game art) ----------
    const PLAYER = "visuals/skins/skin_01.png", RAT = "visuals/survival/m_rat_walk.png", GY = 250, LABVIEW = { ox: 0, oy: -30, s: 0.85 };
    function playerSprite(cx, h, jh) { const w = h * 161 / 212; return { img: img(PLAYER), sx: 0, sy: 0, sw: 161, sh: 212, x: cx - w * 0.47, y: GY - (jh || 0) - h, w: w, h: h }; }
    function ratSprite(box) { const w = 158, hh = 99; return { img: img(RAT), sx: 0, sy: 0, sw: 229, sh: 144, x: box.x + box.w / 2 - w * 0.507, y: box.y + box.h - hh * 0.972, w: w, h: hh }; }
    function coinSprite(box) { return { fn: function (ctx, X, Y, s) { const cx = X(box.x + box.w / 2), cy = Y(box.y + box.h / 2), r = 17 * s; ctx.fillStyle = "#ffcf3a"; ctx.strokeStyle = "#9a5a00"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = "#fff2a8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r * .62, 0, 7); ctx.stroke(); } }; }
    function powerSprite(box) { return { fn: function (ctx, X, Y, s) { const x = X(box.x) - 2 * s, y = Y(box.y) - 2 * s, w = (box.w + 4) * s, c = X(box.x + box.w / 2), d = Y(box.y + box.h / 2); ctx.fillStyle = "#f4fff6"; ctx.strokeStyle = "#1f9d6b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, w, 8 * s) : ctx.rect(x, y, w, w); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#e03040"; ctx.fillRect(c - 4 * s, d - 15 * s, 8 * s, 30 * s); ctx.fillRect(c - 15 * s, d - 4 * s, 30 * s, 8 * s); } }; }


    // little pictures drawn inside the weapon / disaster boxes
    function boxFn(box, draw) { return { fn: function (ctx, X, Y, sc) { ctx.save(); const x = X(box.x), y = Y(box.y), w = box.w * sc, hh = box.h * sc; ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip(); draw(ctx, x, y, w, hh, sc); ctx.restore(); } }; }
    const DECO = {
        pencil: function (b) { return boxFn(b, function (c, x, y, w, h) { c.fillStyle = "#ffd24a"; c.fillRect(x, y + h * .15, w * .78, h * .7); c.fillStyle = "#f4c8a0"; c.beginPath(); c.moveTo(x + w * .78, y + h * .15); c.lineTo(x + w, y + h / 2); c.lineTo(x + w * .78, y + h * .85); c.fill(); c.fillStyle = "#333"; c.fillRect(x + w * .95, y + h * .42, w * .05, h * .16); }); },
        ruler: function (b) { return boxFn(b, function (c, x, y, w, h) { c.fillStyle = "#e8c070"; c.fillRect(x, y + h * .1, w, h * .8); c.strokeStyle = "#7a4a10"; c.lineWidth = 1.5; for (let i = 1; i < 12; i++) { c.beginPath(); c.moveTo(x + w * i / 12, y + h * .1); c.lineTo(x + w * i / 12, y + h * (i % 3 ? .3 : .45)); c.stroke(); } }); },
        blast: function (b) { return boxFn(b, function (c, x, y, w, h) { const g = c.createRadialGradient(x + w / 2, y + h / 2, 1, x + w / 2, y + h / 2, w / 2); g.addColorStop(0, "#fff6b0"); g.addColorStop(.5, "#ff9a2a"); g.addColorStop(1, "rgba(255,60,0,0)"); c.fillStyle = g; c.fillRect(x, y, w, h); }); },
        laser: function (b) { return boxFn(b, function (c, x, y, w, h) { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "rgba(90,255,255,0)"); g.addColorStop(.5, "rgba(190,255,255,.95)"); g.addColorStop(1, "rgba(90,255,255,0)"); c.fillStyle = g; c.fillRect(x, y, w, h); }); },
        tor: function (b) { return boxFn(b, function (c, x, y, w, h) { c.strokeStyle = "rgba(210,235,255,.9)"; c.lineWidth = 3; for (let i = 0; i < 9; i++) { const f = i / 8, ww = w * (.25 + .75 * f), cy = y + h * (.06 + .88 * f); c.beginPath(); c.ellipse(x + w / 2, cy, ww / 2, h * .03, 0, 0, 7); c.stroke(); } }); },
        spk: function (b) { return boxFn(b, function (c, x, y, w, h) { c.fillStyle = "#c8a070"; c.strokeStyle = "#5a3a10"; c.lineWidth = 2; const n = 9; for (let i = 0; i < n; i++) { c.beginPath(); c.moveTo(x + w * i / n + 2, y + h); c.lineTo(x + w * (i + .5) / n, y + h * .08); c.lineTo(x + w * (i + 1) / n - 2, y + h); c.closePath(); c.fill(); c.stroke(); } }); },
        fire: function (b) { return boxFn(b, function (c, x, y, w, h) { for (let i = 0; i < 26; i++) { const fx = x + (i * 97 % 100) / 100 * w, fy = y + (i * 53 % 100) / 100 * h; c.fillStyle = i % 2 ? "rgba(255,140,30,.9)" : "rgba(255,220,90,.9)"; c.beginPath(); c.arc(fx, fy, 6, 0, 7); c.fill(); c.strokeStyle = "rgba(255,120,20,.5)"; c.lineWidth = 3; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx - 14, fy - 30); c.stroke(); } }); },
        acid: function (b) { return boxFn(b, function (c, x, y, w, h) { c.strokeStyle = "rgba(150,255,70,.85)"; c.lineWidth = 2; for (let i = 0; i < 60; i++) { const fx = x + (i * 137 % 100) / 100 * w, fy = y + (i * 71 % 100) / 100 * h; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx - 4, fy + 16); c.stroke(); } }); },
        shock: function (b) { return boxFn(b, function (c, x, y, w, h) { c.strokeStyle = "rgba(255,230,120,.95)"; c.lineWidth = 4; c.beginPath(); c.ellipse(x + w / 2, y + h - 6, Math.max(2, w / 2 - 3), h * .16, 0, 0, 7); c.stroke(); c.strokeStyle = "rgba(255,230,120,.45)"; c.beginPath(); c.ellipse(x + w / 2, y + h - 6, Math.max(2, w / 2 - 14), h * .1, 0, 0, 7); c.stroke(); }); }
    };

    // player / monster boxes with the numbers the game really uses (Endless: 36 x 160 standing, 36 x 118 ducking)
    const PX = 150, P_W = 36, P_STAND = 160, P_DUCK = 118;
    function playerBox(duck, jh) { const hh = duck ? P_DUCK : P_STAND; return { x: PX - P_W / 2, y: GY - (jh || 0) - hh, w: P_W, h: hh }; }
    function playerSprites(duck, jh) { return playerSprite(PX, duck ? 130 : 178, jh); }

    // ---------- scenarios (each one is a live scene + the four conditions) ----------
    const SCEN = {
        atk: {
            tab: "PUNCH / KICK", auto: "bx", init: { atk: "punch", bx: 470, bh: 0 },
            say: "Press <i>P</i> or <i>K</i> and the game creates an invisible <b>attack box</b> in front of you (A). Every monster has an invisible <b>body box</b> (B). The hit counts only while the box touches the monster's box. Drag the sliders to move the monster.",
            ctl: [{ t: "seg", key: "atk", opts: [["punch", "PUNCH (P)"], ["kick", "KICK (K)"]] }, { t: "range", key: "bx", label: "Monster position (x)", min: 220, max: 560 }, { t: "range", key: "bh", label: "Monster height above ground", min: 0, max: 170 }],
            build: function (s) {
                const p = s.atk === "punch", A = p ? { x: PX + 8, y: GY - 132, w: 120, h: 104 } : { x: PX, y: GY - 108, w: 150, h: 114 };
                const B = { x: s.bx - 45, y: GY - s.bh - 76, w: 90, h: 76 };
                return { A: A, B: B, an: p ? "Punch box" : "Kick box", bn: "Monster body box", refs: [Object.assign(playerBox(false, 0), { label: "your body box" })], sprites: [playerSprites(false, 0), ratSprite(B)],
                    note: (p ? "Punch: 120 x 104, 1 damage." : "Kick: 150 x 114, 2 damage, reaches lower and further.") + " A monster that is high up (jumping / flying) can be out of range on the y axis." };
            }
        },
        mon: {
            tab: "MONSTER ATTACK", auto: "bx", init: { kind: "high", duck: false, jh: 0, bx: 470 },
            say: "When a monster swings, it creates an <b>attack box</b> (A) in front of it. If that box touches <b>your body box</b> (B), you are hit. Try <i>DUCK</i> against a high swing, or <i>jump</i> over a low one: your box moves, and the y-axis conditions turn FALSE.",
            ctl: [{ t: "seg", key: "kind", opts: [["high", "HIGH SWING"], ["low", "LOW SWIPE"]] }, { t: "chk", key: "duck", label: "Duck (C)" }, { t: "range", key: "jh", label: "Your jump height", min: 0, max: 120 }, { t: "range", key: "bx", label: "Monster position (x)", min: 240, max: 560 }],
            build: function (s) {
                const hi = s.kind === "high", zlo = hi ? 122 : 0, zhi = hi ? 178 : 54, reach = 100, mb = { x: s.bx - 45, y: GY - 76, w: 90, h: 76 };
                const A = { x: s.bx - 6 - reach, y: GY - zhi, w: reach, h: zhi - zlo }, B = playerBox(s.duck, s.jh);
                return { A: A, B: B, an: "Monster attack box", bn: "Your body box", sprites: [playerSprites(s.duck, s.jh), ratSprite(mb)],
                    note: hi ? "A high swing covers heights 122 - 178. Standing (160 tall) you are inside it; ducking (118 tall) you are under it." : "A low swipe only covers heights 0 - 54. Jump higher than 54 and your bottom edge is above it." };
            }
        },
        coin: {
            tab: "COINS", auto: "bx", init: { bx: 460, ch: 60, duck: false, jh: 0 },
            say: "Coins are <b>28 x 28</b> boxes (B). You collect one when your body box (A) touches it. A coin floating high needs a jump, a low one is picked up while running. Same four conditions.",
            ctl: [{ t: "range", key: "bx", label: "Coin position (x)", min: 200, max: 560 }, { t: "range", key: "ch", label: "Coin height above ground", min: 0, max: 230 }, { t: "range", key: "jh", label: "Your jump height", min: 0, max: 120 }],
            build: function (s) { const B = { x: s.bx - 14, y: GY - s.ch - 28, w: 28, h: 28 }; return { A: playerBox(false, s.jh), B: B, an: "Your body box", bn: "Coin box", sprites: [playerSprites(false, s.jh), coinSprite(B)], note: "Coin box = 28 x 28 (a gem is 32 x 32). The picture is a little bigger than the box." }; }
        },
        pu: {
            tab: "POWER-UPS", auto: "bx", init: { bx: 460, ch: 70, jh: 0 },
            say: "Power-ups and collectibles use <b>bigger boxes (44 x 44)</b>, so they are easier to grab. Your body box (A) just has to touch the pickup box (B) on both axis.",
            ctl: [{ t: "range", key: "bx", label: "Power-up position (x)", min: 200, max: 560 }, { t: "range", key: "ch", label: "Power-up height above ground", min: 0, max: 230 }, { t: "range", key: "jh", label: "Your jump height", min: 0, max: 120 }],
            build: function (s) { const B = { x: s.bx - 22, y: GY - s.ch - 44, w: 44, h: 44 }; return { A: playerBox(false, s.jh), B: B, an: "Your body box", bn: "Power-up box", sprites: [playerSprites(false, s.jh), powerSprite(B)], note: "Power-up box = 44 x 44. Shield, health pack, rage, freeze... all work the same way." }; }
        },
        wpn: {
            tab: "WEAPONS", auto: function (s) { return s.w === "laser" ? "bx" : "sx"; }, init: { w: "pencil", sx: 215, bx: 470, bh: 0 },
            say: "Shop weapons (keys <i>1-4</i>) fire their own boxes. A pencil, ruler or blast <b>flies across the screen</b>, so its box (A) moves a little every frame and the game runs the test again each time. The laser is one instant beam. A weapon hits the moment its box touches the monster's box (B).",
            ctl: [{ t: "seg", key: "w", opts: [["pencil", "PENCIL (1)"], ["ruler", "RULER (2)"], ["laser", "LASER (3)"], ["blast", "BLAST (4)"]] }, { t: "range", key: "sx", label: "How far the shot has flown (x)", min: 200, max: 560 }, { t: "range", key: "bx", label: "Monster position (x)", min: 260, max: 600 }, { t: "range", key: "bh", label: "Monster height above ground", min: 0, max: 170 }],
            build: function (s) {
                const W = { pencil: { w: 40, h: 18, top: 101, nm: "Pencil shot box", note: "Pencil: 40 x 18, 2 damage. It stops at the first monster it touches. (Endless: a 24 x 24 box.)" },
                    ruler: { w: 80, h: 36, top: 100, nm: "Ruler box", note: "Ruler: 80 x 36, 3 damage. It flies through and hits every monster once. (Endless: a 68 x 68 box.)" },
                    blast: { w: 40, h: 40, top: 112, nm: "Blast shot box", note: "Blast: 40 x 40, 8 damage. On contact it explodes: a second box of 300 x 220 hits everything around it. (Endless: a 36 x 36 box.)" },
                    laser: { w: 900, h: 120, top: 135, nm: "Laser beam box", note: "Laser: one instant beam, 900 x 120, 7 damage to every monster in your lane. (Endless: it clears every hazard in a 199 px tall band.)" } }[s.w];
                const A = s.w === "laser" ? { x: PX, y: GY - W.top, w: W.w, h: W.h } : { x: s.sx - W.w / 2, y: GY - W.top, w: W.w, h: W.h };
                const B = { x: s.bx - 45, y: GY - s.bh - 76, w: 90, h: 76 }, on = RMX.conds(A, B).every(function (c) { return c.ok; }), refs = [];
                if (s.w === "blast" && on) { const cx = A.x + A.w / 2; refs.push({ x: cx - 150, y: GY - 202, w: 300, h: 220, label: "explosion box 300 x 220" }); }
                return { A: A, B: B, an: W.nm, bn: "Monster body box", refs: refs, sprites: [playerSprites(false, 0), ratSprite(B), DECO[s.w](A)], note: W.note };
            }
        },
        dis: {
            tab: "DISASTERS", auto: function (s) { return s.k === "shock" ? "r" : "bx"; }, init: { k: "tor", bx: 430, bh: 0, r: 0 },
            say: "Disasters are power-ups that hurt the <b>monsters</b>, never you. Each one is a big invisible box (A). Every few ticks the game tests it against each monster's body box (B). Monsters must also be in the same lane (depth) as the disaster.",
            ctl: [{ t: "seg", key: "k", opts: [["tor", "TORNADO"], ["spk", "LAND SPIKES"], ["fire", "FIREBALL"], ["acid", "ACID RAIN"], ["shock", "SHOCKWAVE (L)"]] }, { t: "range", key: "bx", label: "Monster position (x)", min: 200, max: 640 }, { t: "range", key: "bh", label: "Monster height above ground", min: 0, max: 170 }, { t: "range", key: "r", label: "Shockwave radius", min: 0, max: 380 }],
            build: function (s) {
                const T = 420, K = {
                    tor: { A: { x: T - 55, y: GY - 230, w: 110, h: 230 }, nm: "Tornado box", note: "Tornado: 110 x 230, 1 damage every 0.35 s. It also pulls small monsters within 300 px toward it. There are three of them." },
                    spk: { A: { x: T - 160, y: GY - 110, w: 320, h: 110 }, nm: "Land spikes box", note: "Land spikes: 320 x 110, 3 damage every 0.7 s. The game scatters seven patches around you." },
                    fire: { A: { x: 0, y: GY - 500, w: 850, h: 500 }, nm: "Fireball box (whole screen)", note: "Fireball: a box as wide as the screen and 500 tall, 2 damage every 0.6 s. Every monster on screen is inside it." },
                    acid: { A: { x: 0, y: GY - 500, w: 850, h: 500 }, nm: "Acid rain box (whole screen)", note: "Acid rain: the same whole-screen box, 1 damage every 0.5 s, and it slows the monsters it touches." },
                    shock: { A: { x: PX - s.r, y: GY - 220, w: Math.max(2, s.r * 2), h: 220 }, nm: "Shockwave box (grows)", note: "Shockwave: the box is as wide as the ring (2 x radius, up to 380 or 520) and 220 tall. Each monster is hit once and knocked back." } }[s.k];
                const B = { x: s.bx - 45, y: GY - s.bh - 76, w: 90, h: 76 };
                return { A: K.A, B: B, an: K.nm, bn: "Monster body box", sprites: [playerSprites(false, 0), ratSprite(B), DECO[s.k](K.A)], note: K.note };
            }
        }
    };

    // a live lab: canvas + sliders + the conditions panel. cfgFn(state) -> {A,B,an,bn,sprites,refs,note}
    function makeLab(sc, canvasW, canvasH) {
        const s = Object.assign({ auto: true }, sc.init), root = h("div", "rmx-split");
        const left = h("div"), right = h("div");
        const cv = h("canvas", "rmx-scene"); cv.width = canvasW || 720; cv.height = canvasH || 310;
        const legend = h("div", "rmx-legend"), ctl = h("div", "rmx-ctl"), note = h("p", "rmx-say"), panel = h("div"), nums = h("div"), code = h("div");
        left.appendChild(cv); left.appendChild(legend); left.appendChild(ctl); left.appendChild(note); right.appendChild(panel); right.appendChild(code); right.appendChild(nums); root.appendChild(left); root.appendChild(right);
        const ranges = {}, segs = {};
        function autoKeyOf() { return typeof sc.auto === "function" ? sc.auto(s) : sc.auto; }
        function autoDefOf() { const k = autoKeyOf(); return sc.ctl.filter(function (c) { return c.key === k; })[0]; }
        const autoDef = autoDefOf();
        sc.ctl.forEach(function (c) {
            if (c.t === "seg") { const d = h("div", "rmx-pills"); c.opts.forEach(function (o) { const b = h("button", "rmx-btn", o[1]); b.type = "button"; b.addEventListener("click", function () { s[c.key] = o[0]; sync(); }); d.appendChild(b); segs[c.key + ":" + o[0]] = b; }); ctl.appendChild(d); }
            else if (c.t === "chk") { const l = h("label", "chk"), i = h("input"); i.type = "checkbox"; i.addEventListener("input", function () { s[c.key] = i.checked; sync(); }); l.appendChild(i); l.appendChild(document.createTextNode(c.label)); ctl.appendChild(l); ranges[c.key] = i; }
            else { const l = h("label"), t = h("span"), i = h("input"); i.type = "range"; i.min = c.min; i.max = c.max; i.value = s[c.key]; t.innerHTML = c.label + " <b></b>"; i.addEventListener("input", function () { s[c.key] = +i.value; if (c.key === autoKeyOf()) { s.auto = false; if (ranges.__auto) ranges.__auto.checked = false; } sync(); }); l.appendChild(t); l.appendChild(i); ctl.appendChild(l); ranges[c.key] = i; c.span = t.querySelector("b"); }
        });
        if (autoDef) { const l = h("label", "chk"), i = h("input"); i.type = "checkbox"; i.checked = true; i.addEventListener("input", function () { s.auto = i.checked; }); l.appendChild(i); l.appendChild(document.createTextNode("Auto-play")); ctl.appendChild(l); ranges.__auto = i; }
        let lastHTML = "", t0 = 0;
        function sync() {
            const o = sc.build(s);
            sc.ctl.forEach(function (c) { if (c.t === "seg") c.opts.forEach(function (op) { segs[c.key + ":" + op[0]].classList.toggle("on", s[c.key] === op[0]); }); else if (c.t === "chk") ranges[c.key].checked = !!s[c.key]; else { ranges[c.key].value = s[c.key]; c.span.textContent = Math.round(s[c.key]); } });
            drawScene(cv, { A: o.A, B: o.B, ground: GY, sprites: o.sprites, refs: o.refs, view: LABVIEW });
            const hh = condsHTML(o.A, o.B) + "|" + o.an + o.bn;
            if (hh !== lastHTML) {
                lastHTML = hh; panel.innerHTML = condsHTML(o.A, o.B); code.innerHTML = codeHTML(o.A, o.B); nums.innerHTML = boxNumsHTML(o.A, o.B, o.an, o.bn);
                legend.innerHTML = '<span><i style="background:' + COL.a + '"></i>A = ' + esc(o.an) + '</span><span><i style="background:' + COL.b + '"></i>B = ' + esc(o.bn) + '</span><span><i style="background:' + COL.hit + '"></i>shared part</span><span><i style="background:' + COL.miss + '"></i>gap</span>';
                note.innerHTML = o.note;
            }
        }
        function tick(dt) { const ad = autoDefOf(); if (!s.auto || !ad) return; t0 += dt; const mid = (ad.min + ad.max) / 2, amp = (ad.max - ad.min) / 2 * 0.98; s[ad.key] = Math.round(mid + amp * Math.cos(t0 * 0.8)); sync(); }
        sync();
        return { el: root, tick: tick, draw: sync };
    }

    // the free "drag the boxes" lab of the basics tab
    function makeDragLab() {
        const root = h("div", "rmx-split"), left = h("div"), right = h("div"), cv = h("canvas", "rmx-scene drag"); cv.width = 720; cv.height = 310;
        const legend = h("div", "rmx-legend"), tip = h("p", "rmx-say", "<b>Drag the runner or the rat</b> around the scene. The two boxes are the invisible rectangles the game checks. The coloured bars under and beside the scene are each box's \"shadow\" on the x axis and on the y axis."), panel = h("div"), code = h("div"), nums = h("div");
        left.appendChild(cv); left.appendChild(legend); left.appendChild(tip); right.appendChild(panel); right.appendChild(code); right.appendChild(nums); root.appendChild(left); root.appendChild(right);
        const A = { x: 120, y: GY - 160, w: 36, h: 160 }, B = { x: 330, y: GY - 76, w: 90, h: 76 };
        legend.innerHTML = '<span><i style="background:' + COL.a + '"></i>A = the runner\'s body box</span><span><i style="background:' + COL.b + '"></i>B = the rat\'s body box</span><span><i style="background:' + COL.hit + '"></i>shared part</span><span><i style="background:' + COL.miss + '"></i>gap</span>';
        let drag = null, last = "";
        function sprites() { return [playerSprite(A.x + A.w / 2, 178, GY - (A.y + A.h)), ratSprite(B)]; }
        function draw() {
            drawScene(cv, { A: A, B: B, ground: GY, sprites: sprites(), view: LABVIEW });
            const k = condsHTML(A, B); if (k !== last) { last = k; panel.innerHTML = k; code.innerHTML = codeHTML(A, B); nums.innerHTML = boxNumsHTML(A, B, "Runner", "Rat"); }
        }
        function pt(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width / LABVIEW.s + LABVIEW.ox, y: (e.clientY - r.top) * cv.height / r.height / LABVIEW.s + LABVIEW.oy }; }
        function inside(b, p, pad) { return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad; }
        cv.addEventListener("pointerdown", function (e) { const p = pt(e); drag = inside(B, p, 14) && !(inside(A, p, 0) && !inside(B, p, 0)) ? B : (inside(A, p, 14) ? A : (inside(B, p, 40) ? B : A)); drag.dx = p.x - drag.x; drag.dy = p.y - drag.y; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } });
        cv.addEventListener("pointermove", function (e) { if (!drag) return; const p = pt(e); drag.x = Math.max(8, Math.min(cv.width / LABVIEW.s - 70 - drag.w, p.x - drag.dx)); drag.y = Math.max(-20, Math.min(GY - drag.h, p.y - drag.dy)); draw(); });
        ["pointerup", "pointercancel"].forEach(function (n) { cv.addEventListener(n, function () { drag = null; }); });
        draw();
        return { el: root, tick: function () {}, draw: draw };
    }

    // ---------- the key lists ----------
    function keyRow(keys, title, text) { return '<div class="rmx-k"><div class="rmx-kc">' + keys.map(function (k) { return "<b" + (k.length > 3 ? ' class="wide"' : "") + ">" + k + "</b>"; }).join("") + '</div><div class="rmx-kt"><strong>' + title + "</strong><span>" + text + "</span></div></div>"; }
    const ENDLESS_KEYS = [
        keyRow(["SPACE"], "JUMP", "Press again in the air for a double jump (a triple jump with the Jetpack). Click or tap also jumps."),
        keyRow(["C"], "DUCK", "Hold to duck under high hazards. In the air it makes you fall faster."),
        keyRow(["P"], "PUNCH", "Quick, 1 damage, short reach. Hits monsters that touch the punch box."),
        keyRow(["K"], "KICK", "Slower, 2 damage, longer reach and lower box."),
        keyRow(["1", "2", "3", "4"], "SHOP WEAPONS", "Fires the weapons you bought (pencil, ruler, laser, blast). Each has ammo and a cooldown."),
        keyRow(["B"], "AABB VISION", "Turns the AABB view on or off: the invisible boxes, the x and y axis bars, and the COLLISION! text with its colors."),
        keyRow(["ESC"], "PAUSE", "Pause and resume (a 3-2-1 countdown follows). The game also pauses if you leave the window.")
    ].join("");
    const SURV_KEYS = [
        keyRow(["A", "D"], "RUN LEFT / RIGHT", "Move along the level."),
        keyRow(["W", "S"], "UP / DOWN THE PATH", "The level has depth. Monsters can only hit you when they are in your lane."),
        keyRow(["SPACE"], "JUMP", "Jump over low attacks."),
        keyRow(["C"], "DUCK", "Duck under high attacks (your body box gets shorter)."),
        keyRow(["P"], "PUNCH", "Fast, 1 damage, 100 reach."),
        keyRow(["K"], "KICK", "Slower, 2 damage, 125 reach. Knocks small monsters down."),
        keyRow(["L"], "SPECIAL", "Unleashes a shockwave when the EN bar is full. Hitting monsters fills it."),
        keyRow(["1", "2", "3", "4"], "SHOP WEAPONS", "Use the weapons you bought in the shop."),
        keyRow(["B"], "AABB VISION", "Turns the AABB view on or off: the invisible boxes, the x and y axis bars, and the COLLISION! text with its colors."),
        keyRow(["ESC"], "PAUSE", "Pause the fight.")
    ].concat(window.RUNMIL_DUO && RUNMIL_DUO.enabled ? [
        keyRow(["2 PLAYERS"], "WEB VERSION ONLY", "Clear Level 1, 2 or 3 to unlock a heroine, then pick 2 PLAYERS on the level screen. <b>Player 1:</b> A D W S move, SPACE jump, C crouch, R punch, F kick, E special, number row 1-4 weapons. <b>Player 2:</b> arrow keys move, M jump, O crouch, P punch, K kick, L special, number pad 1-4 weapons.")
    ] : []).join("");

    // ---------- the full HOW TO PLAY overlay ----------
    let ov = null, panes = {}, curTab = "endless", loopOn = false, lastT = 0;
    const tickers = [];
    function loop(t) {
        if (!tickers.length) { loopOn = false; return; }
        const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
        tickers.slice().forEach(function (f) { f(dt); });
        requestAnimationFrame(loop);
    }
    function addTicker(f) { if (tickers.indexOf(f) < 0) tickers.push(f); if (!loopOn) { loopOn = true; lastT = performance.now(); requestAnimationFrame(loop); } }
    function removeTicker(f) { const i = tickers.indexOf(f); if (i >= 0) tickers.splice(i, 1); }
    // images arrive late: draw everything again when one has loaded
    [PLAYER, RAT].forEach(function (s) { const i = img(s); i.addEventListener("load", function () { Object.keys(panes).forEach(function (k) { if (panes[k].draw) panes[k].draw(); }); }); });

    function buildOverlay() {
        ov = h("div"); ov.id = "rmx"; ov.hidden = true; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "How to play");
        const card = h("div", "rmx-card"), head = h("div", "rmx-head", "<h2>HOW TO PLAY</h2>"), x = h("button", "rmx-x", "&times;"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.addEventListener("click", RMX.closeHowTo); head.appendChild(x);
        const tabs = h("div", "rmx-tabs"), body = h("div", "rmx-body");
        const defs = [["endless", "ENDLESS RUN"], ["survival", "MONSTER SURVIVAL"], ["basics", "WHAT IS AABB?"], ["game", "AABB IN THE GAME"]];
        defs.forEach(function (d) { const b = h("button", "rmx-tab", d[1]); b.type = "button"; b.dataset.tab = d[0]; b.addEventListener("click", function () { showTab(d[0]); }); tabs.appendChild(b); });
        // endless
        const pe = h("div", "rmx-pane"); pe.dataset.pane = "endless";
        pe.innerHTML = '<p class="rmx-lead"><b>ENDLESS RUN:</b> your runner keeps moving by itself. Jump, duck and fight to get as far as you can through Panabo. By day you dodge cars, poles and birds. At night monsters come out.</p><div class="rmx-keys">' + ENDLESS_KEYS + "</div>" +
            '<ul class="rmx-tips"><li><b>Touch screens:</b> tap to jump, and use the on-screen DUCK, PUNCH and KICK buttons.</li><li><b>Roofs:</b> you can land on top of a car and run along it.</li><li><b>Score</b> = distance + 5 per coin + 25 per monster + combo and close-call bonuses.</li><li><b>Hits:</b> one hit ends the run, unless a helmet or shield takes it. SAVE ME brings you back for 25 gems.</li></ul>';
        // survival
        const ps = h("div", "rmx-pane"); ps.dataset.pane = "survival";
        ps.innerHTML = '<p class="rmx-lead"><b>MONSTER SURVIVAL:</b> a side-scrolling fighter. Survive 5 waves in each level, then beat the boss to unlock the next level.</p><div class="rmx-keys">' + SURV_KEYS + "</div>" +
            '<ul class="rmx-tips"><li><b>HP</b> is your health. <b>EN</b> is your energy: it fills when you hit monsters, and a full bar powers the L shockwave.</li><li><b>Drops:</b> monsters drop coins and power-ups (shield, health pack, rage, freeze, magnet and more). Walk into them to collect.</li><li><b>Disasters</b> (tornado, fireballs, acid rain, land spikes) are power-ups that hurt the monsters, not you.</li><li>After a hit you are briefly invincible, so you can escape a crowd.</li></ul>';
        // basics
        const pb = h("div", "rmx-pane"); pb.dataset.pane = "basics";
        pb.innerHTML = '<p class="rmx-lead"><b>AABB</b> means <b>Axis-Aligned Bounding Box</b>. It is the algorithm RUN MIL! uses to decide whether a punch landed, a monster hit you, or you picked up a coin.</p>' +
            '<div class="rmx-3col"><div><h4>1. BOUNDING BOX</h4><p>Around every character, monster, coin and power-up the game keeps an invisible rectangle, stored as <b>x, y, width, height</b> (top-left corner plus size). It is usually a little smaller than the picture.</p></div>' +
            '<div><h4>2. AXIS-ALIGNED</h4><p>The sides are always straight: parallel to the <b>x axis</b> (left - right) and the <b>y axis</b> (up - down). The box never rotates, even if the picture does.</p></div>' +
            '<div><h4>3. THE TEST</h4><p>Two boxes collide only if their "shadows" overlap on <b>both</b> axis. That is four true / false conditions. All four true = collision. One false = no collision.</p></div></div><div class="rmx-m rmx-tint" style="margin:.7em 0"><div><h4>WATCH IT LIVE: PRESS B IN THE GAME</h4>' + LABEL_HTML + '</div></div><div style="height:.8em"></div>';
        const dl = makeDragLab(); pb.appendChild(dl.el); panes.basics = dl;
        // in the game
        const pg = h("div", "rmx-pane"); pg.dataset.pane = "game";
        pg.innerHTML = '';
        const pills = h("div", "rmx-pills"), holder = h("div"); pg.appendChild(pills); pg.appendChild(holder);
        const lab = {};
        Object.keys(SCEN).forEach(function (k, i) {
            const sc = SCEN[k]; const b = h("button", "rmx-btn", (i + 1) + ". " + sc.tab); b.type = "button"; b.dataset.sc = k; b.addEventListener("click", function () { showScene(k); }); pills.appendChild(b);
            const wrap = h("div"); wrap.hidden = true; const say = h("p", "rmx-say", sc.say + " <b>A</b> is the box that does the hitting, <b>B</b> the box that gets hit."); const L = makeLab(sc); wrap.appendChild(say); wrap.appendChild(L.el); holder.appendChild(wrap); lab[k] = { wrap: wrap, L: L, btn: b };
        });
        function showScene(k) { k = k || curScene; Object.keys(lab).forEach(function (n) { lab[n].wrap.hidden = n !== k; lab[n].btn.classList.toggle("on", n === k); }); curScene = k; panes.game = { tick: lab[k].L.tick, draw: lab[k].L.draw }; lab[k].L.draw(); if (curTab === "game") { tickers.length = 0; addTicker(lab[k].L.tick); } }
        let curScene = "atk"; RMX._scene = showScene;
        [pe, ps, pb, pg].forEach(function (p) { p.classList.add("rmx-pane"); body.appendChild(p); });
        card.appendChild(head); card.appendChild(tabs); card.appendChild(body); ov.appendChild(card); document.body.appendChild(ov);
        showScene("atk");
        ov.addEventListener("pointerdown", function (e) { if (e.target === ov) RMX.closeHowTo(); });
    }
    function showTab(t) {
        curTab = t;
        ov.querySelectorAll(".rmx-tab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === t); });
        ov.querySelectorAll(".rmx-pane").forEach(function (p) { p.hidden = p.dataset.pane !== t; });
        tickers.length = 0;
        if (t === "game" && RMX._scene) RMX._scene();
        if (t === "basics" && panes.basics) panes.basics.draw();
        ov.querySelector(".rmx-body").scrollTop = 0;
    }
    let blocker = null;
    RMX.openHowTo = function (tab) {
        if (!ov) buildOverlay();
        ov.hidden = false; showTab(tab || curTab || "endless");
        if (!blocker) {
            blocker = function (e) {
                if (!ov || ov.hidden) return;
                const tag = e.target && e.target.tagName;
                if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); RMX.closeHowTo(); return; }
                if (e.code === "ArrowRight" || e.code === "ArrowLeft") { const ids = ["endless", "survival", "basics", "game"], i = ids.indexOf(curTab) + (e.code === "ArrowRight" ? 1 : -1); showTab(ids[(i + ids.length) % ids.length]); e.preventDefault(); e.stopImmediatePropagation(); return; }
                if (tag === "BUTTON" || tag === "INPUT") { e.stopImmediatePropagation(); return; }       // let a focused button / slider work, hide the key from the game
                e.stopImmediatePropagation(); if (e.code === "Space" || e.code.indexOf("Arrow") === 0) e.preventDefault();
            };
            addEventListener("keydown", blocker, true); addEventListener("keyup", function (e) { if (ov && !ov.hidden) e.stopImmediatePropagation(); }, true);
        }
        const b = ov.querySelector(".rmx-x"); if (b) b.focus();
    };
    RMX.closeHowTo = function () { if (!ov) return; ov.hidden = true; tickers.length = 0; if (RMX._onClose) { const f = RMX._onClose; RMX._onClose = null; f(); } };

    // ---------- the "game mechanics" card shown before a game starts ----------
    const MECH = {
        endless: {
            title: "GAME MECHANICS - ENDLESS RUN",
            items: [
                ["GOAL", "Run as far as you can through Panabo City. <b>Score</b> = distance + <b>5</b> per coin + <b>25</b> per monster + bonuses."],
                ["DAY AND NIGHT", "By day you dodge <b>cars, poles and birds</b>. At dusk the <b>monsters</b> come: rats, pigs and flying wraiths. Dawn brings the hazards back."],
                ["HITS", "<b>One hit ends the run</b>. A helmet or a shield can take one hit for you. <b>SAVE ME</b> revives you for 25 gems."],
                ["COMBOS", "Chain 3 or more kills for a <b>combo bonus</b>. Slip past a hazard by a hair for a <b>CLOSE CALL +10</b>."]
            ],
            keys: "<b>SPACE</b> jump &bull; <b>C</b> duck &bull; <b>P</b> punch &bull; <b>K</b> kick &bull; <b>1-4</b> weapons &bull; <b>B</b> AABB vision &bull; <b>ESC</b> pause"
        },
        versus: {
            title: "GAME MECHANICS - 1 VS 1",
            items: [
                ["GOAL", "Two players: one keyboard, or <b>two phones</b> linked through a hotspot in the Android app. Pick a fighter each and win <b>more rounds</b> than your rival over <b>3 rounds</b>. The winner gets the trophy screen."],
                ["ROUNDS", "A round lasts <b>60 seconds</b>. Win it by a <b>K.O.</b>, or by having more HP when time runs out. Equal HP is a draw. If the 3 rounds end level, a <b>sudden-death</b> round decides."],
                ["HP AND EN", "Each fighter has their own <b>HP</b> and <b>EN</b>. EN fills as you land hits (and a little when you are hit). When it is full, press your <b>special</b> key."],
                ["DODGING", "<b>Duck</b> to slip under a punch (kicks still hit you). <b>Jump</b> to clear a kick or a shockwave. Use <b>W / S</b> (or the up and down arrows) to change lane: attacks only hit in <b>your lane</b>."]
            ],
            keys: "<b>P1:</b> <b>A D W S</b> move &bull; <b>SPACE</b> jump &bull; <b>C</b> duck &bull; <b>R</b> punch &bull; <b>F</b> kick &bull; <b>E</b> special<br><b>P2:</b> <b>Arrows</b> move &bull; <b>M</b> jump &bull; <b>O</b> duck &bull; <b>P</b> punch &bull; <b>K</b> kick &bull; <b>L</b> special<br><b>B</b> AABB vision &bull; <b>ESC</b> pause"
        },
        survival: {
            title: "GAME MECHANICS - MONSTER SURVIVAL",
            items: [
                ["GOAL", "Survive <b>5 waves</b> in every level, then <b>beat the boss</b> to unlock the next level."],
                ["HP AND EN", "<b>HP</b> is your health. <b>EN</b> fills as you hit monsters. When it is full, press <b>L</b> for a shockwave."],
                ["LANES", "Use <b>W / S</b> to move up and down the path. A monster can only hit you when it is in <b>your lane</b>."],
                ["DROPS", "Monsters drop <b>coins and power-ups</b>: shield, health pack, rage, freeze, and disasters like tornado and fireballs."]
            ],
            keys: "<b>A/D</b> move &bull; <b>W/S</b> up/down &bull; <b>SPACE</b> jump &bull; <b>C</b> duck &bull; <b>P</b> punch &bull; <b>K</b> kick &bull; <b>L</b> special &bull; <b>B</b> AABB vision &bull; <b>ESC</b> pause"
        }
    };
    let mechEl = null, mechKey = null;
    // what the live labels of the AABB view (key B) say; used by the mechanics card and by HOW TO PLAY
    const LABEL_HTML = '<div class="tl"><span class="sw l">x OK<br>y OK</span><p>The label under each box checks <b>your body box</b> against it. <b>x OK</b> = the two boxes overlap on the x axis (conditions 1 and 2 are true). <b>x NO</b> = there is a gap left - right. <b>y OK</b> / <b>y NO</b> is the same for up - down (conditions 3 and 4). When both say OK, the box turns solid red: that is a collision.</p></div>' +
        '<div class="tl"><span class="sw l">NO<br>(lane)</span><p>In Monster Survival, <b>NO (lane)</b> means the monster is on another lane (W / S), so it cannot touch you even if the boxes line up on screen.</p></div>' +
        '<div class="tl"><span class="sw l">COLL.</span><p>Your punch, kick and weapons have their own boxes. So <b>COLLISION!</b> can appear for an attack that lands while the label still says <b>NO</b>, because the label only compares your body.</p></div>';
    const LABEL_SHORT = '<div class="tl"><span class="sw l">x OK<br>y OK</span><p><b>Labels</b> under each box = your body vs that box: <b>OK</b> = they overlap on that axis, <b>NO</b> = a gap. Both OK = the box turns solid red = collision. (Attacks have their own boxes, so COLLISION! can show while a label says NO. HOW TO PLAY explains more.)</p></div>';
    RMX.mechanics = function (mode, cb, force) {
        try { if (!force && localStorage.getItem("runmil_mech_off") === "1") { if (cb) cb(); return; } } catch (e) { /* storage blocked */ }
        const M = MECH[mode] || MECH.endless;
        if (mechEl) mechEl.remove();
        mechEl = h("div", "rmx-mech"); mechEl.setAttribute("role", "dialog");
        const card = h("div", "rmx-card"), head = h("div", "rmx-head", "<h2>" + M.title + "</h2>");
        // the card is a carousel: one topic per page
        const pages = [], titles = ["THE GAME", "HOW HITS ARE DECIDED", "COLORS", "AABB VIEW (KEY B)", "CONTROLS"];
        const p1 = h("div", "rmx-mech-grid"); M.items.forEach(function (it) { p1.appendChild(h("div", "rmx-m big", "<h4>" + it[0] + "</h4><p>" + it[1] + "</p>")); }); pages.push(p1);
        const p2 = h("div", "rmx-mech-grid"), wide = h("div", "rmx-m wide"), txt = h("div", null, "<h4>HOW EVERY HIT IS DECIDED: AABB COLLISION</h4><p>Every punch, monster attack and pickup is a <b>rectangle against rectangle</b> test. Your body, each monster, each attack and each coin has an <b>invisible box</b>. If the boxes overlap on <b>both</b> the x and the y axis (4 conditions, all true) it counts as a hit. When you lose, the game shows you the exact numbers.</p>");
        const mini = h("canvas", "rmx-scene"); mini.width = 480; mini.height = 250; wide.appendChild(txt); wide.appendChild(mini); p2.appendChild(wide); pages.push(p2);
        const p3 = h("div", "rmx-mech-grid"), tint = h("div", "rmx-m wide rmx-tint", "<div><h4>WHAT THE COLORS MEAN WHEN YOU COLLIDE</h4>" +
            '<div class="tl"><span class="sw c"></span><p><b>Cyan tint</b> = <b>your box (A)</b>, the invisible rectangle around you or your attack.</p></div>' +
            '<div class="tl"><span class="sw r"></span><p><b>Red tint</b> = <b>the other box (B)</b>: the monster, hazard, coin, power-up or shot you touched.</p></div>' +
            '<div class="tl"><span class="sw y"></span><p><b>Flashing yellow</b> = <b>the overlap</b>, where A and B cross. It only appears when all 4 conditions are true.</p></div>' +
            '<div class="tl"><span class="sw t">COLLISION!</span><p>The text pops up at the same moment. Red = a hit or attack, gold = a pickup.</p></div></div>');
        tint.style.gridTemplateColumns = "1fr"; p3.appendChild(tint); pages.push(p3);
        const p4 = h("div", "rmx-mech-grid"), view = h("div", "rmx-m wide rmx-tint", "<div><h4>PRESS B IN THE GAME TO SEE THE AABB</h4>" +
            '<div class="tl"><span class="sw d"></span><p>The colors on the previous page, and everything here, show only while the AABB view is <b>ON</b>. Press <b>B</b> again to turn it off. <b>Dashed outlines</b> are the invisible boxes. The <b>bars</b> along the bottom (x axis) and the right side (y axis) are the boxes\' shadows. Where the A and B shadows cross, the bar turns yellow.</p></div>' + LABEL_HTML + "</div>");
        view.style.gridTemplateColumns = "1fr"; p4.appendChild(view); pages.push(p4);
        const p5 = h("div", "rmx-mech-grid"), keys = h("div", "rmx-m wide big", "<div><h4>CONTROLS</h4><p>" + M.keys + "</p></div>"); keys.style.gridTemplateColumns = "1fr"; p5.appendChild(keys); pages.push(p5);
        if (window.RUNMIL_DUO && RUNMIL_DUO.enabled && /SURVIVAL/i.test(M.title)) {                  // 2 players: web version only
            titles.push("2 PLAYERS");
            const p6 = h("div", "rmx-mech-grid");
            [["UNLOCKING HEROINES", "Clear <b>Level 1, 2 or 3</b> to unlock one heroine each. Then choose <b>2 PLAYERS</b> on the level screen and pick who plays as Player 2 with <b>PLAYER 2 CHARACTERS</b>."],
             ["PLAYER 1 (YOU)", "<b>A D W S</b> move &bull; <b>SPACE</b> jump &bull; <b>C</b> crouch &bull; <b>R</b> punch &bull; <b>F</b> kick &bull; <b>E</b> special &bull; <b>1-4</b> weapons (the number row)."],
             ["PLAYER 2 (HEROINE)", "<b>Arrow keys</b> move &bull; <b>M</b> jump &bull; <b>O</b> crouch &bull; <b>P</b> punch &bull; <b>K</b> kick &bull; <b>L</b> special &bull; <b>1-4</b> weapons (the number pad)."],
             ["TEAM RULES", "You share the waves, coins, EN bar and weapon ammo. Each player has their own HP. A knocked-out partner comes back between waves. The game ends when both are down."]
            ].forEach(function (it) { p6.appendChild(h("div", "rmx-m big", "<h4>" + it[0] + "</h4><p>" + it[1] + "</p>")); });
            pages.push(p6);
        }
        if (mode === "versus") {                                                                     // the four special abilities
            titles.push("SPECIAL ABILITIES");
            const p7 = h("div", "rmx-mech-grid");
            [["MIL: SHOCKWAVE", "A wide ring of force rolls out along the ground. <b>Jump over it</b> to be safe. Needs a full EN bar."],
             ["SHAI: LAND POWER", "The earth erupts around her in <b>every direction</b>, and jumping does not help. Needs a full EN bar."],
             ["MICHA: FLAMES", "A stream of fire from her hand in the direction she faces. Each press costs only <b>10 EN</b>, so hold your nerve and spam it."],
             ["MARV: WIND BLAST", "A big whirlwind rolls forward and <b>throws</b> the other fighter back. Needs a full EN bar."],
             ["CHARM: TIDAL WAVE", "Waves of water burst out of the ground in front of her and <b>wash</b> the other fighter away. Needs a full EN bar."]
            ].forEach(function (it) { p7.appendChild(h("div", "rmx-m big", "<h4>" + it[0] + "</h4><p>" + it[1] + "</p>")); });
            pages.push(p7);
            titles.push("TWO PHONES");
            const p8 = h("div", "rmx-mech-grid");
            [["LINK THE PHONES", "No internet needed. The <b>host</b> switches on the phone's <b>Hotspot</b>; the other phone joins that Wi-Fi. The host taps <b>HOST A GAME</b>, the other taps <b>JOIN A GAME</b> then <b>CONNECT</b>."],
             ["PICK AND FIGHT", "Each player picks their <b>own fighter</b> on their own phone. The host picks the arena and presses <b>FIGHT</b>. A heroine can be used by a friend even if you have not unlocked her yet."],
             ["TOUCH CONTROLS", "A <b>cross pad</b> on the left (slide your thumb: left / right run, up / down change lane) and the <b>JUMP, PUNCH, KICK, SPECIAL and DUCK</b> buttons on the right."],
             ["STAY CLOSE", "Keep the phones within a few metres. If the link drops, the match ends and you can connect again from the same screen. Pause is off while playing over the link."]
            ].forEach(function (it) { p8.appendChild(h("div", "rmx-m big", "<h4>" + it[0] + "</h4><p>" + it[1] + "</p>")); });
            pages.push(p8);
        }
        const stage = h("div", "rmx-stage"), dots = h("div", "rmx-dots"), ptitle = h("div", "rmx-ptitle");
        let cur = 0;
        pages.forEach(function (p, n) { p.hidden = n !== 0; stage.appendChild(p); const d = h("button", "dot"); d.type = "button"; d.setAttribute("aria-label", titles[n]); d.addEventListener("click", function () { goPage(n); }); dots.appendChild(d); });
        function goPage(n) {
            cur = Math.max(0, Math.min(pages.length - 1, n));
            pages.forEach(function (p, k) { p.hidden = k !== cur; }); [].forEach.call(dots.children, function (d, k) { d.className = "dot" + (k === cur ? " on" : ""); });
            ptitle.textContent = (cur + 1) + " / " + pages.length + "  " + titles[cur]; back.disabled = cur === 0; next.disabled = cur === pages.length - 1;
        }
        const back = h("button", "rmx-btn", "&lsaquo; BACK"), next = h("button", "rmx-btn", "NEXT &rsaquo;"); back.type = next.type = "button";
        back.addEventListener("click", function () { goPage(cur - 1); }); next.addEventListener("click", function () { goPage(cur + 1); });
        const nav = h("div", "rmx-mnav"); nav.appendChild(back); nav.appendChild(ptitle); nav.appendChild(dots); nav.appendChild(next);
        const grid = h("div", "rmx-mech-pages"); grid.appendChild(nav); grid.appendChild(stage);
        const foot = h("div", "rmx-mech-foot"), lab = h("label"), chk = h("input"); chk.type = "checkbox"; lab.appendChild(chk); lab.appendChild(document.createTextNode("Do not show this again (the HOW TO PLAY button in the main menu stays)"));
        const btns = h("div", "btns2"), more = h("button", "rmx-btn", "HOW TO PLAY"), go = h("button", "rmx-btn go", "START"); more.type = go.type = "button"; btns.appendChild(more); btns.appendChild(go); foot.appendChild(lab); foot.appendChild(btns);
        card.appendChild(head); card.appendChild(grid); card.appendChild(foot); mechEl.appendChild(card); document.body.appendChild(mechEl);
        // the little animated diagram: a punch box meets the rat's box
        const s = { atk: "punch", bx: 470, bh: 0 }; let t0 = 0;
        function drawMini() { const o = SCEN.atk.build(s); drawScene(mini, { A: o.A, B: o.B, ground: GY, sprites: o.sprites, refs: o.refs, view: { ox: 70, oy: 60, s: 0.82 } }); }
        const tk = function (dt) { t0 += dt; s.bx = Math.round(395 + 105 * Math.cos(t0 * 0.9)); drawMini(); };
        goPage(0); drawMini(); addTicker(tk);
        [PLAYER, RAT].forEach(function (p) { img(p).addEventListener("load", drawMini); });
        let closed = false;
        function done() { if (closed) return; closed = true; try { if (chk.checked) localStorage.setItem("runmil_mech_off", "1"); } catch (e) { /* ok */ } removeTicker(tk); removeEventListener("keydown", mechKey, true); mechEl.remove(); mechEl = null; if (cb) cb(); }
        go.addEventListener("click", done);
        more.addEventListener("click", function () { RMX.openHowTo("endless"); });
        mechKey = function (e) {
            if (ov && !ov.hidden) return;                                                  // the full tutorial has its own keys
            if ((e.code === "Enter" || e.code === "Space") && e.target && e.target.tagName === "BUTTON" && e.target !== go) { e.stopImmediatePropagation(); return; }     // NEXT / BACK / dots / HOW TO PLAY act as buttons
            if (e.code === "ArrowRight" || e.code === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === "keydown") goPage(cur + (e.code === "ArrowRight" ? 1 : -1)); return; }
            if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === "keydown" && !e.repeat) { if (cur < pages.length - 1) goPage(cur + 1); else done(); } return; }
            if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === "keydown" && !e.repeat) done(); return; }
            const tag = e.target && e.target.tagName; if (tag !== "BUTTON" && tag !== "INPUT") e.stopImmediatePropagation();
        };
        addEventListener("keydown", mechKey, true);
        mechEl.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
        goPage(0); next.focus();
    };

    // ---------- the calculation shown when the player loses ----------
    // rec = { A:{x,y,w,h}, B:{x,y,w,h}, an, bn, extra:[{t, ok}], note }
    function clip(B, A) { const t = Math.max(B.y, A.y - 150), b = Math.min(B.y + B.h, A.y + A.h + 150); return { x: B.x, w: B.w, y: t, h: Math.max(10, b - t) }; }       // a very tall hazard (a pole) must not shrink the picture
    RMX.calc = function (el, rec) {
        if (!el) return;
        if (!rec || !rec.A || !rec.B) { el.innerHTML = ""; return; }
        const k = el._cv || (el._cv = h("canvas")); k.width = 520; k.height = 170;
        let ex = ""; (rec.extra || []).forEach(function (x) { ex += "<div>" + (x.ok ? "&#10003; " : "&#10007; ") + x.t + "</div>"; });
        el.innerHTML = '<div class="rmx-calc"><h3>WHY DID I LOSE? THE AABB CHECK</h3><p class="sub"><span class="a"><b>A</b> = ' + esc(rec.an) + '</span> &nbsp;vs&nbsp; <span class="b"><b>B</b> = ' + esc(rec.bn) + '</span></p><div class="cvhold"></div>' + condsHTML(rec.A, rec.B) +
            '<div class="extra">' + boxNumsHTML(rec.A, rec.B, "A", "B", true) + (ex ? '<div style="margin-top:.3em">' + ex + "</div>" : "") + (rec.note ? "<div style='margin-top:.3em'>" + rec.note + "</div>" : "") + "</div></div>";
        el.querySelector(".cvhold").appendChild(k);
        drawScene(k, { A: rec.A, B: rec.B, ground: rec.ground == null ? null : rec.ground, view: fitView(rec.A, clip(rec.B, rec.A), k.width, k.height, rec.ground != null ? [{ x: rec.A.x, y: rec.ground, w: 1, h: 1 }] : null) });
    };
    // ---------- LIVE AABB VISION inside the games ----------
    // Mode 0 = HIT FLASH (default): every real collision pops up its two boxes, the overlap and the 4 checks.
    // Mode 1 = X-RAY: also shows all the invisible boxes live, with an x / y check above everything near you.
    // Mode 2 = OFF.  Press B to change.
    const VIS = RMX.vis = { mode: 0, ev: [], tagT: 0 };          // mode 0 = off (default), 1 = AABB view on (press B)
    const V_NAMES = ["AABB VIEW: OFF", "AABB VIEW: ON"], V_SUB = ["press B to show the boxes again", "boxes, x / y axis and collisions are shown"];
    function vTag() {
        let t = document.getElementById("rmx-vtag");
        if (!t) { t = h("div"); t.id = "rmx-vtag"; document.body.appendChild(t); }
        t.innerHTML = "<b>" + V_NAMES[VIS.mode] + "</b><span>" + V_SUB[VIS.mode] + "</span>"; t.className = "show"; clearTimeout(vTag.t); vTag.t = setTimeout(function () { t.className = ""; }, 2200);
    }
    VIS.cycle = function () { VIS.mode = VIS.mode ? 0 : 1; VIS.ev.length = 0; vTag(); };
    // A / B are world boxes {x,y,w,h}; cx, cy = how far the camera was (numbers are shown in screen pixels)
    VIS.hit = function (A, B, tag, kind, cx, cy) {
        if (VIS.mode !== 1) return;
        cx = cx || 0; cy = cy || 0;
        for (let i = 0; i < VIS.ev.length; i++) if (VIS.ev[i].tag === tag && VIS.ev[i].t < 0.18) return;     // one pop-up per event, not one per frame
        VIS.ev.push({ A: { x: A.x, y: A.y, w: A.w, h: A.h }, B: { x: B.x, y: B.y, w: B.w, h: B.h }, tag: tag, kind: kind || "hit", cx: cx, cy: cy, t: 0 });
        if (VIS.ev.length > 4) VIS.ev.shift();
    };
    function rr(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function vBox(g, b, col, lw, dash, fill) { if (fill) { g.fillStyle = fill; g.fillRect(b.x, b.y, b.w, b.h); } g.setLineDash(dash || []); g.lineWidth = lw; g.strokeStyle = col; g.strokeRect(b.x, b.y, b.w, b.h); g.setLineDash([]); }
    const KCOL = { hit: "#ff4d5e", atk: "#ffb24a", pick: "#ffd24a" };
    VIS.draw = function (g, camx, camy, vw, vh, dt) {
        const E = VIS.ev; if (VIS.mode !== 1 || !E.length) { E.length = 0; return; }
        for (let i = E.length - 1; i >= 0; i--) { E[i].t += dt; if (E[i].t > 1.5) E.splice(i, 1); }
        E.forEach(function (e) {
            const k = e.t / 1.5, al = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, bc = KCOL[e.kind] || KCOL.hit;
            const A = { x: e.A.x - camx, y: e.A.y - camy, w: e.A.w, h: e.A.h }, B = { x: e.B.x - camx, y: e.B.y - camy, w: e.B.w, h: e.B.h };
            g.save(); g.globalAlpha = al;
            g.fillStyle = "rgba(77,232,255,.16)"; g.fillRect(A.x, A.y, A.w, A.h); g.fillStyle = "rgba(255,77,94,.16)"; g.fillRect(B.x, B.y, B.w, B.h);
            const l = Math.max(A.x, B.x), r = Math.min(A.x + A.w, B.x + B.w), t = Math.max(A.y, B.y), b = Math.min(A.y + A.h, B.y + B.h);
            if (r > l && b > t) { const f = 0.55 + 0.4 * Math.sin(e.t * 26); g.fillStyle = "rgba(255,240,90," + f.toFixed(2) + ")"; g.fillRect(l, t, r - l, b - t); }
            // plain text, no numbers
            const ux = Math.min(A.x, B.x), ux2 = Math.max(A.x + A.w, B.x + B.w), uy = Math.min(A.y, B.y);
            const pop = Math.min(1, e.t / 0.12), tx = Math.max(90, Math.min(vw - 90, (ux + ux2) / 2)), ty = Math.max(30, uy - 14) - e.t * 18;
            g.translate(tx, ty); g.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
            g.font = "bold 34px Teko, Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
            g.lineWidth = 6; g.strokeStyle = "rgba(10,14,34,.95)"; g.strokeText("COLLISION!", 0, 0); g.fillStyle = bc === KCOL.pick ? "#ffe14a" : "#ff6a78"; g.fillText("COLLISION!", 0, 0);
            g.restore();
        });
    };
    // X-RAY: A = the player's box, list = [{B, kind, name, far}] ; draws every box and the live x / y verdict
    VIS.xray = function (g, A, list, camx, camy, vw, vh) {
        if (VIS.mode !== 1) return;
        const sA = { x: A.x - camx, y: A.y - camy, w: A.w, h: A.h };
        g.save(); g.font = "bold 15px Consolas, monospace"; g.textAlign = "center"; g.textBaseline = "bottom";
        list.forEach(function (o) {
            const B = { x: o.B.x - camx, y: o.B.y - camy, w: o.B.w, h: o.B.h };
            if (B.x > vw + 40 || B.x + B.w < -40) return;
            const xo = A.x < o.B.x + o.B.w && A.x + A.w > o.B.x, yo = A.y < o.B.y + o.B.h && A.y + A.h > o.B.y && !o.far, both = xo && yo, near = Math.abs((B.x + B.w / 2) - (sA.x + sA.w / 2)) < 330;
            const col = both ? "#ff4d5e" : (xo || yo) && near ? "#ffc84a" : "rgba(160,255,190,.55)";
            vBox(g, B, col, both ? 3 : 1.5, both ? [] : [5, 4], both ? "rgba(255,77,94,.28)" : null);
            if (near && (xo || yo)) { g.textBaseline = "top"; g.lineJoin = "round"; g.lineWidth = 4; g.strokeStyle = "rgba(5,8,24,.95)"; g.strokeText("x " + (xo ? "OK" : "NO") + "  y " + (o.far ? "NO (lane)" : yo ? "OK" : "NO"), B.x + B.w / 2, B.y + B.h + 4); g.fillStyle = col; g.fillText("x " + (xo ? "OK" : "NO") + "  y " + (o.far ? "NO (lane)" : yo ? "OK" : "NO"), B.x + B.w / 2, B.y + B.h + 4); }
        });
        // the x and y axis: guide lines + "shadow" bars for the nearest boxes
        const near2 = list.filter(function (o) { return !o.far && Math.abs((o.B.x + o.B.w / 2 - camx) - (sA.x + sA.w / 2)) < 330; })
            .sort(function (a, b) { return Math.abs(a.B.x - A.x) - Math.abs(b.B.x - A.x); }).slice(0, 2);
        g.lineWidth = 1; g.setLineDash([3, 5]);
        g.strokeStyle = "rgba(77,232,255,.55)"; g.beginPath(); [sA.x, sA.x + sA.w].forEach(function (x) { g.moveTo(x, 0); g.lineTo(x, vh); }); [sA.y, sA.y + sA.h].forEach(function (y) { g.moveTo(0, y); g.lineTo(vw, y); }); g.stroke();
        near2.forEach(function (o) {
            const B = { x: o.B.x - camx, y: o.B.y - camy, w: o.B.w, h: o.B.h };
            g.strokeStyle = "rgba(255,200,90,.5)"; g.beginPath(); [B.x, B.x + B.w].forEach(function (x) { g.moveTo(x, 0); g.lineTo(x, vh); }); [B.y, B.y + B.h].forEach(function (y) { g.moveTo(0, y); g.lineTo(vw, y); }); g.stroke();
        });
        g.setLineDash([]);
        g.fillStyle = "rgba(5,8,24,.6)"; g.fillRect(0, vh - 52, vw, 52); g.fillRect(vw - 52, 0, 52, vh - 52);
        g.fillStyle = "#4de8ff"; g.fillRect(sA.x, vh - 44, sA.w, 7); g.fillRect(vw - 44, sA.y, 7, sA.h);
        near2.forEach(function (o, i) {
            const B = { x: o.B.x - camx, y: o.B.y - camy, w: o.B.w, h: o.B.h };
            g.fillStyle = "rgba(255,200,90,.9)"; g.fillRect(B.x, vh - 34 + i * 12, B.w, 7); g.fillRect(vw - 34 + i * 12, B.y, 7, B.h);
            const l = Math.max(sA.x, B.x), r = Math.min(sA.x + sA.w, B.x + B.w), t = Math.max(sA.y, B.y), b = Math.min(sA.y + sA.h, B.y + B.h);
            g.fillStyle = "#ffe85a"; if (r > l) g.fillRect(l, vh - 34 + i * 12, r - l, 7); if (b > t) g.fillRect(vw - 34 + i * 12, t, 7, b - t);
        });
        g.font = "bold 12px Consolas, monospace"; g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillStyle = "#fff";
        g.fillText("X AXIS (left - right)", 8, vh - 8); g.save(); g.translate(vw - 8, 12); g.rotate(Math.PI / 2); g.fillText("Y AXIS (up - down)", 0, 0); g.restore();
        g.textAlign = "center"; g.textBaseline = "bottom";
        vBox(g, sA, "#4de8ff", 2.5, [], "rgba(77,232,255,.12)");
        g.lineJoin = "round"; g.lineWidth = 4; g.strokeStyle = "rgba(5,8,24,.95)"; const yl = VIS.two ? "P1  (A)" : "YOU  (A)"; g.strokeText(yl, sA.x + sA.w / 2, sA.y - 3); g.fillStyle = "#4de8ff"; g.fillText(yl, sA.x + sA.w / 2, sA.y - 3);
        g.restore();
    };
    // the other player(s): their box, the guide lines and the verdict against every monster box (same colours as the main player's X-RAY, in pink)
    VIS.xrayP = function (g, A, list, label, camx, camy, vw, vh) {
        if (VIS.mode !== 1) return;
        const sA = { x: A.x - camx, y: A.y - camy, w: A.w, h: A.h };
        g.save(); g.font = "bold 15px Consolas, monospace"; g.textAlign = "center"; g.textBaseline = "bottom";
        list.forEach(function (o) {
            const B = { x: o.B.x - camx, y: o.B.y - camy, w: o.B.w, h: o.B.h };
            if (B.x > vw + 40 || B.x + B.w < -40 || Math.abs((B.x + B.w / 2) - (sA.x + sA.w / 2)) > 330) return;
            const xo = A.x < o.B.x + o.B.w && A.x + A.w > o.B.x, yo = A.y < o.B.y + o.B.h && A.y + A.h > o.B.y && !o.far;
            if (xo && yo) vBox(g, B, "#ff4d5e", 3, [], "rgba(255,77,94,.28)");
            else if (xo || yo) { vBox(g, B, "#ffc84a", 1.5, [5, 4]); g.textBaseline = "top"; g.lineJoin = "round"; g.lineWidth = 4; g.strokeStyle = "rgba(5,8,24,.95)"; g.fillStyle = "#fff"; const t = "x " + (xo ? "OK" : "NO") + "  y " + (o.far ? "NO (lane)" : yo ? "OK" : "NO"); g.strokeText(t, B.x + B.w / 2, B.y + B.h + 2); g.fillText(t, B.x + B.w / 2, B.y + B.h + 2); g.textBaseline = "bottom"; }
        });
        g.lineWidth = 1; g.setLineDash([3, 5]); g.strokeStyle = "rgba(255,120,200,.6)"; g.beginPath();
        [sA.x, sA.x + sA.w].forEach(function (x) { g.moveTo(x, 0); g.lineTo(x, vh); }); [sA.y, sA.y + sA.h].forEach(function (y) { g.moveTo(0, y); g.lineTo(vw, y); }); g.stroke(); g.setLineDash([]);
        g.fillStyle = "#ff78c8"; g.fillRect(sA.x, vh - 26, sA.w, 7); g.fillRect(vw - 26, sA.y, 7, sA.h);
        vBox(g, sA, "#ff78c8", 2.5, [], "rgba(255,120,200,.14)");
        g.lineJoin = "round"; g.lineWidth = 4; g.strokeStyle = "rgba(5,8,24,.95)"; g.strokeText(label, sA.x + sA.w / 2, sA.y - 3); g.fillStyle = "#ff78c8"; g.fillText(label, sA.x + sA.w / 2, sA.y - 3);
        g.restore();
    };
    VIS.key = function (e) { if (e.code === "KeyB" && !e.repeat && !e.ctrlKey && !e.metaKey) { VIS.cycle(); return true; } return false; };
    // the HOW TO PLAY button of the main menu
    const mb = document.getElementById("howto-btn"); if (mb) mb.addEventListener("click", function () { RMX.openHowTo("endless"); });
})();
