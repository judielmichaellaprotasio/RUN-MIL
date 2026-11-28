/* RUN MIL! - the info card shown when the player taps ENDLESS RUN or MONSTER SURVIVAL on the main menu.
   Each mode gets an animated mini scene (the real game sprites), what the game is about, four key ideas, the keys, and a PLAY button. */
(function () {
    "use strict";
    var stage = document.querySelector("#main-menu .menu-stage");
    if (!stage) return;

    // sprite sheets: file, frame size, columns, rows, frames, ms per frame
    var SHEET = {
        run:   { f: "visuals/player/run.png",            w: 227, h: 383, c: 8, r: 3, n: 19, ms: 65 },
        jump:  { f: "visuals/player/jump.png",           w: 195, h: 421, c: 8, r: 4, n: 26, ms: 65 },
        punch: { f: "visuals/player/punch.png",          w: 231, h: 373, c: 8, r: 5, n: 33, ms: 62 },
        rat:   { f: "visuals/survival/m_rat_walk.png",   w: 229, h: 144, c: 5, r: 2, n: 9,  ms: 110 },
        bat:   { f: "visuals/survival/m_bat_walk.png",   w: 144, h: 173, c: 5, r: 2, n: 8,  ms: 120 },
        clown: { f: "visuals/survival/m_clown_walk.png", w: 365, h: 418, c: 4, r: 3, n: 12, ms: 110 }
    };
    var TOUCH = !!window.RUNMIL_NATIVE || (window.matchMedia && matchMedia("(pointer: coarse)").matches);

    var MODES = {
        endless: {
            cls: "endless", title: "ENDLESS RUN", tag: "How far can you run, Mil?",
            desc: "Sprint through <b>Panabo City</b> with no finish line. The road never ends, the speed keeps climbing, and when the sun sets the <b>monsters come out</b>. Your distance is your score.",
            feats: [["🏃", "RUN FOREVER", "Your distance is your score. Beat your best!"], ["⬆️", "JUMP AND DUCK", "Cars, poles, birds. One hit ends it!"], ["🌙", "DAY TO NIGHT", "Dusk brings rats, pigs and wraiths."], ["💥", "COMBOS", "Chain kills, slip past hazards."]],
            keys: [["SPACE", "jump"], ["C", "duck"], ["P", "punch"], ["K", "kick"], ["1-4", "weapons"]],
            legend: [["+5", "per coin"], ["+25", "per monster"], ["+10", "close call"]],
            go: "PLAY ENDLESS RUN"
        },
        survival: {
            cls: "survival", title: "MONSTER SURVIVAL", tag: "Hold the line. Don't get eaten.",
            desc: "Fight off <b>waves of monsters</b> on a battlefield of lanes. Survive <b>5 waves</b>, defeat the <b>boss</b>, and unlock the next level. Every level you clear also unlocks a <b>new heroine</b> for 2-player mode.",
            feats: [["👊", "PUNCH AND KICK", "Beat back rats, bats and clowns."], ["↔️", "FIGHT IN LANES", "Monsters only hit your lane."], ["⚡", "CHARGE EN", "Hits fill EN. Unleash a shockwave!"], ["🎁", "POWER-UPS", "Shield, rage, freeze, fireballs."]],
            keys: [["A/D", "move"], ["W/S", "lane"], ["P", "punch"], ["K", "kick"], ["L", "special"]],
            legend: [["5", "waves per level"], ["BOSS", "at the end"], ["2P", "web version"]],
            go: "PLAY MONSTER SURVIVAL"
        }
    };

    var ov = document.createElement("div");
    ov.id = "mode-info"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    stage.appendChild(ov);
    var timer = 0, items = [], curMode = null;

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

    // a sprite div that can be stepped through the frames of its sheet
    function sprite(parent, key, css) {
        var s = SHEET[key], el = document.createElement("i");
        el.className = "mi-spr"; el.style.cssText = css + ";aspect-ratio:" + s.w + "/" + s.h + ";background-image:url(" + s.f + ");background-size:" + s.c * 100 + "% " + s.r * 100 + "%";
        parent.appendChild(el);
        var o = { el: el, s: s, last: -1 };
        o.frame = function (f) {
            f = Math.floor(f) % s.n; if (f === o.last) return; o.last = f;
            var col = f % s.c, row = Math.floor(f / s.c);
            el.style.backgroundPosition = (s.c > 1 ? col / (s.c - 1) * 100 : 0) + "% " + (s.r > 1 ? row / (s.r - 1) * 100 : 0) + "%";
        };
        o.frame(0); return o;
    }
    function div(parent, cls, css, html) { var d = document.createElement("div"); d.className = cls; if (css) d.style.cssText = css; if (html != null) d.innerHTML = html; parent.appendChild(d); return d; }

    // ---------- scene 1: the endless run ----------
    function sceneEndless(sc) {
        div(sc, "mi-sky"); div(sc, "mi-sun"); div(sc, "mi-far"); div(sc, "mi-near"); div(sc, "mi-dusk"); div(sc, "mi-road"); div(sc, "mi-lane");
        var hud = div(sc, "mi-hud"); var dist = document.createElement("span"), coins = document.createElement("span"); hud.appendChild(dist); hud.appendChild(coins);
        var bar = div(sc, "mi-barrier"), cs = [0, 1, 2].map(function () { return div(sc, "mi-coin"); });
        var runner = sprite(sc, "run", "left:12%;bottom:20%;height:55%"), jumper = sprite(sc, "jump", "left:12%;bottom:20%;height:60%;display:none");
        var rat = sprite(sc, "rat", "bottom:21%;height:15%;opacity:0"), pop = div(sc, "mi-pop", "left:30%;top:30%", "CLOSE CALL +10");
        var CYC = 3600, got = 0, d0 = 1200;
        return function (t) {
            var p = t % CYC, cyc = Math.floor(t / CYC);
            var barX = 108 - p / CYC * 128;                    // % from the left
            bar.style.left = barX + "%";
            var jumping = p > 1500 && p < 1500 + SHEET.jump.n * SHEET.jump.ms;
            runner.el.style.display = jumping ? "none" : "block"; jumper.el.style.display = jumping ? "block" : "none";
            if (jumping) jumper.frame((p - 1500) / SHEET.jump.ms); else runner.frame(t / SHEET.run.ms);
            cs.forEach(function (c, i) { var x = 120 - ((p + i * 260) % CYC) / CYC * 150; c.style.left = x + "%"; c.style.bottom = (44 + Math.sin(x / 9) * 4) + "%"; c.style.transform = "scaleX(" + Math.abs(Math.cos(t / 160 + i)).toFixed(2) + ")"; });
            dist.innerHTML = "DISTANCE <b>" + (d0 + Math.floor(t / 14)).toLocaleString("en-US") + " m</b>";
            coins.innerHTML = "COINS <b>" + (12 + cyc * 3 + Math.floor(p / 1200)) + "</b>";
            var night = (t % 18000) / 18000; var dark = night > .5 ? 1 : 0;      // the sky fades in CSS; the rat only runs after dusk
            var rx = 110 - ((t * .018) % 140); rat.el.style.left = rx + "%"; rat.el.style.opacity = dark ? 1 : 0; rat.frame(t / SHEET.rat.ms);
            pop.style.opacity = p > 2300 && p < 3100 ? 1 : 0; pop.style.transform = "translateY(" + (-(p - 2300) / 40) + "px) scale(" + (1 + Math.min(1, (p - 2300) / 300) * .2) + ")";
        };
    }

    // ---------- scene 2: the monster wave ----------
    function sceneSurvival(sc) {
        div(sc, "mi-lvl", "background-image:url(visuals/survival/level1.webp)"); div(sc, "mi-vig"); div(sc, "mi-floor");
        var bars = div(sc, "mi-bars", null, '<div>HP<span class="mi-bar mi-hp"><i></i></span></div><div>EN<span class="mi-bar mi-en"><i></i></span></div>');
        var hp = bars.querySelector(".mi-hp i"), en = bars.querySelector(".mi-en i");
        var wave = div(sc, "mi-wave", null, "WAVE <b>3</b> / 5");
        var hero = sprite(sc, "punch", "left:8%;bottom:6%;height:56%");
        var foes = [
            { sp: sprite(sc, "rat", "bottom:8%;height:24%"), off: 0, per: 5200, y: 8 },
            { sp: sprite(sc, "bat", "bottom:34%;height:26%"), off: 1700, per: 6400, y: 34 },
            { sp: sprite(sc, "clown", "bottom:3%;height:48%"), off: 2900, per: 8200, y: 3 }
        ];
        var pops = foes.map(function (f, i) { return div(sc, "mi-pop", "", ["POW!", "WHAM!", "KO!"][i]); });
        return function (t) {
            hero.frame(t / SHEET.punch.ms);
            foes.forEach(function (f, i) {
                var p = ((t + f.off) % f.per) / f.per, x, o = 1, shake = 0, show = false;
                if (p < .74) { x = 112 - p / .74 * 66; }
                else if (p < .92) { x = 46 + (p - .74) / .18 * 14; shake = Math.sin(t / 22) * 1.2; show = true; }   // knocked back
                else { x = 60 + (p - .92) / .08 * 8; o = 1 - (p - .92) / .08; }
                f.sp.el.style.left = (x + shake) + "%"; f.sp.el.style.opacity = o; f.sp.el.style.filter = show ? "brightness(2.2) drop-shadow(0 0 6px #fff)" : "";
                f.sp.frame(t / f.sp.s.ms);
                var pe = pops[i]; pe.style.left = "36%"; pe.style.top = (18 + i * 12) + "%"; pe.style.opacity = show ? 1 : 0; pe.style.transform = "scale(" + (1 + (p - .74) * 3) + ") rotate(" + (-6 + i * 5) + "deg)";
            });
            en.style.width = (((t % 9000) / 9000) * 100) + "%"; hp.style.width = (62 + Math.sin(t / 1400) * 12) + "%";
        };
    }

    function bestLine(m) {
        try {
            if (m === "endless") { var st = (window.RunMilMenu && RunMilMenu.player && RunMilMenu.player.stats) || {}; return "YOUR BEST <span>" + (st.bestScore || 0).toLocaleString("en-US") + " pts</span> <span>" + (st.bestDistance || 0).toLocaleString("en-US") + " m</span>"; }
            var sv = JSON.parse(localStorage.getItem("runmil_save") || "{}").survival || {}, cl = sv.cleared || {}, n = 0; for (var k in cl) if (cl[k]) n++;
            return "LEVELS CLEARED <span>" + n + " / 4</span>";
        } catch (e) { return ""; }
    }

    function open(m) {
        var M = MODES[m]; if (!M) return; curMode = m; close(true);
        ov.className = "on " + M.cls; ov.innerHTML = "";
        var panel = div(ov, "mi-panel"), x = document.createElement("button"); x.className = "mi-x"; x.type = "button"; x.setAttribute("aria-label", "Close"); x.innerHTML = "&times;"; panel.appendChild(x);
        var left = div(panel, "mi-left"), sc = div(left, "mi-scene");
        var legend = div(left, "mi-legend", null, M.legend.map(function (l) { return "<span><b>" + esc(l[0]) + "</b>" + esc(l[1]) + "</span>"; }).join(""));
        var right = div(panel, "mi-right");
        right.innerHTML = '<h2 class="mi-title">' + esc(M.title) + '</h2><p class="mi-tag">' + esc(M.tag) + '</p><p class="mi-desc">' + M.desc + '</p>' +
            '<div class="mi-feats">' + M.feats.map(function (f) { return '<div class="mi-f"><div class="ic">' + f[0] + '</div><div><h4>' + esc(f[1]) + '</h4><p>' + esc(f[2]) + '</p></div></div>'; }).join("") + '</div>' +
            (TOUCH ? "" : '<div class="mi-keys">' + M.keys.map(function (k) { return "<kbd>" + esc(k[0]) + "</kbd><em>" + esc(k[1]) + "</em>"; }).join("") + '</div>') +
            '<div class="mi-best">' + bestLine(m) + '</div>' +
            '<div class="mi-go"><button class="mi-back" type="button">BACK</button></div>';
        var tick = m === "endless" ? sceneEndless(sc) : sceneSurvival(sc), t0 = performance.now();
        function loop() { tick(performance.now() - t0); timer = requestAnimationFrame(loop); }
        loop();
        x.addEventListener("click", function () { close(); });
        right.querySelector(".mi-back").addEventListener("click", function () { close(); });
        right.querySelector(".mi-back").focus();
    }
    function close(quiet) { if (timer) cancelAnimationFrame(timer); timer = 0; if (!quiet) { ov.className = ""; ov.innerHTML = ""; curMode = null; } }
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", function (e) { if (curMode && e.code === "Escape") { close(); e.stopImmediatePropagation(); e.preventDefault(); } }, true);

    // ---------- the PLAY button: pick Endless Run, Monster Survival or 1 VS 1 ----------
    var pp = document.createElement("div"); pp.id = "play-pick"; pp.setAttribute("role", "dialog"); pp.setAttribute("aria-modal", "true"); stage.appendChild(pp);
    var NATIVE = !!window.RUNMIL_NATIVE, NOVS = false;                 // the Android app plays 1 VS 1 between two phones; a phone browser cannot
    var PICKS = [
        { m: "endless", cls: "pk-e", ic: "🏃", t: "ENDLESS RUN", d: "Run through Panabo City. How far can you go?" },
        { m: "survival", cls: "pk-s", ic: "👹", t: "MONSTER SURVIVAL", d: "Survive 5 waves and beat the boss in every level." },
        { m: "versus", cls: "pk-v", ic: "🥊", t: "1 VS 1", d: NOVS ? "Needs a keyboard, or the Android app with 2 phones." : TOUCH ? "Pick a fighter and battle the computer in 3 rounds." : "Pick a fighter and battle a friend in 3 rounds.", off: NOVS }
    ];
    function openPick() {
        close(); pp.className = "on"; pp.innerHTML = "";
        var box = div(pp, "pk-box"); div(box, "pk-title", null, "CHOOSE YOUR GAME");
        var row = div(box, "pk-row");
        PICKS.forEach(function (p) {
            var b = document.createElement("button"); b.type = "button"; b.className = "pk-card " + p.cls + (p.off ? " off" : "");
            b.innerHTML = '<span class="pk-ic">' + p.ic + '</span><b>' + esc(p.t) + '</b><small>' + esc(p.d) + '</small>' + (p.off ? "" : '<em>PLAY &#9654;</em>');
            if (!p.off) b.addEventListener("click", function () { closePick(); if (p.m !== "versus" && window.RunMilSetMode) RunMilSetMode(p.m); if (window.openGame) window.openGame(p.m); });
            row.appendChild(b);
        });
        var bk = document.createElement("button"); bk.type = "button"; bk.className = "pk-back"; bk.textContent = "BACK"; bk.addEventListener("click", closePick); box.appendChild(bk);
    }
    function closePick() { pp.className = ""; pp.innerHTML = ""; }
    pp.addEventListener("click", function (e) { if (e.target === pp) closePick(); });
    document.addEventListener("keydown", function (e) { if (pp.className === "on" && e.code === "Escape") { closePick(); e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    window.RunMilPlayPick = openPick;
    window.RunMilModeInfo = open; window.RunMilModeInfoClose = close;
})();
