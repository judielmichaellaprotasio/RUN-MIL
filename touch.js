/* RUN MIL! - on-screen touch controls for phones (Monster Survival full pad, Endless: weapon buttons).
   Every button sends the same keyboard events the game already understands, so no game logic changes. */
(function () {
    "use strict";
    const SURV = /survival/i.test(location.pathname), VS = /versus/i.test(location.pathname);       // 1 VS 1 uses the P1 keys (R punch, F kick, E special)
    const coarse = (window.matchMedia && matchMedia("(pointer: coarse)").matches) || /[?&]touch=1/.test(location.search);
    if (!coarse) { addEventListener("touchstart", function f() { removeEventListener("touchstart", f, true); build(); }, true); return; }
    build();

    function send(type, code, key) { try { window.dispatchEvent(new KeyboardEvent(type, { code: code, key: key || code, bubbles: true, cancelable: true })); } catch (e) { /* ignore */ } }
    // a cross-shaped pad (like a game console): slide your thumb over it - left / right run, up / down change lane, two arms together go diagonally
    function cross() {
        const dp = document.createElement("div"); dp.className = "tc-dp";
        dp.innerHTML = '<i class="u">&#9650;</i><i class="l">&#9664;</i><i class="c"></i><i class="r">&#9654;</i><i class="d">&#9660;</i>';
        const K = { l: ["KeyA", "a"], r: ["KeyD", "d"], u: ["KeyW", "w"], d: ["KeyS", "s"] }, st = { l: 0, r: 0, u: 0, d: 0 }; let pid = null;
        function set(k, on) { if (!!st[k] === on) return; st[k] = on ? 1 : 0; dp.querySelector("." + k).classList.toggle("on", on); send(on ? "keydown" : "keyup", K[k][0], K[k][1]); }
        function aim(e) { const r = dp.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5, dz = 0.1; set("l", x < -dz); set("r", x > dz); set("u", y < -dz); set("d", y > dz); }
        function rel() { pid = null; set("l", false); set("r", false); set("u", false); set("d", false); }
        dp.addEventListener("pointerdown", function (e) { e.preventDefault(); if (pid !== null) return; pid = e.pointerId; try { dp.setPointerCapture(pid); } catch (x) { /* ok */ } aim(e); });
        dp.addEventListener("pointermove", function (e) { if (e.pointerId === pid) { e.preventDefault(); aim(e); } });
        dp.addEventListener("pointerup", function (e) { if (e.pointerId === pid) rel(); }); dp.addEventListener("pointercancel", function (e) { if (e.pointerId === pid) rel(); }); dp.addEventListener("lostpointercapture", function (e) { if (e.pointerId === pid) rel(); });
        dp.addEventListener("contextmenu", function (e) { e.preventDefault(); });
        return dp;
    }
    function build() {
        if (document.getElementById("tc")) return;
        const root = document.createElement("div"); root.id = "tc";
        const down = {};
        function btn(cls, label, sub, code, key, hold) {
            const b = document.createElement("button"); b.type = "button"; b.className = "tb " + cls; b.innerHTML = label + (sub ? "<small>" + sub + "</small>" : "");
            b.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } if (down[e.pointerId]) return; down[e.pointerId] = 1; b.classList.add("on"); send("keydown", code, key); if (!hold) setTimeout(function () { send("keyup", code, key); }, 60); });
            function up(e) { e.preventDefault(); if (!down[e.pointerId]) return; delete down[e.pointerId]; b.classList.remove("on"); if (hold) send("keyup", code, key); }
            b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
            b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
            return b;
        }
        if (!VS) {
            const wp = document.createElement("div"); wp.className = "tc-w";
            for (let i = 1; i <= 4; i++) wp.appendChild(btn("w", String(i), "", "Digit" + i, String(i), false));
            wp.appendChild(btn("w v", "B", "AABB", "KeyB", "b", false));
            root.appendChild(wp);
            if (SURV) setInterval(function () {                       // ammo of every weapon shown on its button
                const am = window.RunMilAmmo ? window.RunMilAmmo() : null; if (!am) return;
                [].forEach.call(wp.querySelectorAll(".tb.w:not(.v)"), function (b, i) { let e = b.querySelector(".am"); if (!e) { e = document.createElement("i"); e.className = "am"; b.appendChild(e); } const v = am[i] | 0; if (e.textContent !== String(v)) e.textContent = v; b.classList.toggle("empty", !v); });
            }, 300);
        }
        if (SURV || VS) {
            root.appendChild(cross());
            const ac = document.createElement("div"); ac.className = "tc-ac";
            ac.appendChild(btn("jump", "JUMP", "", "Space", " ", false));
            if (VS) { ac.appendChild(btn("pu", "R", "PUNCH", "KeyR", "r", false)); ac.appendChild(btn("ki", "F", "KICK", "KeyF", "f", false)); ac.appendChild(btn("sp", "E", "SPECIAL", "KeyE", "e", false)); }
            else { ac.appendChild(btn("pu", "P", "PUNCH", "KeyP", "p", false)); ac.appendChild(btn("ki", "K", "KICK", "KeyK", "k", false)); ac.appendChild(btn("sp", "L", "SPECIAL", "KeyL", "l", false)); }
            ac.appendChild(btn("du", "&#9660;", "DUCK", "KeyC", "c", true));
            root.appendChild(ac);
        }
        document.body.appendChild(root);
        document.documentElement.classList.add("has-touch");
        // hide the pad while a menu / pause / game-over panel is open
        const sel = "#pause:not([hidden]), #over:not([hidden]), #clear:not([hidden]), #victory:not([hidden]), .rmx-mech, #rmx:not([hidden]), #win:not([hidden]), #nlb:not([hidden]), #vs:not([hidden])";
        function vis() { let hide = !!document.querySelector(sel); const s = document.getElementById("select"); if (s && getComputedStyle(s).display !== "none") hide = true; const h = document.getElementById("hud"); if ((SURV || VS) && h && h.hidden) hide = true; root.classList.toggle("off", hide); }
        setInterval(vis, 250); vis();
        document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    }
})();
