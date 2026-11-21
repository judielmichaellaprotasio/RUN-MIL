/* RUN MIL! - on-screen touch controls for phones (Monster Survival full pad, Endless: weapon buttons).
   Every button sends the same keyboard events the game already understands, so no game logic changes. */
(function () {
    "use strict";
    const SURV = /survival/i.test(location.pathname);
    const coarse = (window.matchMedia && matchMedia("(pointer: coarse)").matches) || /[?&]touch=1/.test(location.search);
    if (!coarse) { addEventListener("touchstart", function f() { removeEventListener("touchstart", f, true); build(); }, true); return; }
    build();

    function send(type, code, key) { try { window.dispatchEvent(new KeyboardEvent(type, { code: code, key: key || code, bubbles: true, cancelable: true })); } catch (e) { /* ignore */ } }
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
        const wp = document.createElement("div"); wp.className = "tc-w";
        for (let i = 1; i <= 4; i++) wp.appendChild(btn("w", String(i), "", "Digit" + i, String(i), false));
        wp.appendChild(btn("w v", "B", "AABB", "KeyB", "b", false));
        root.appendChild(wp);
        if (SURV) {
            const dp = document.createElement("div"); dp.className = "tc-dp";
            dp.appendChild(btn("l", "&#9664;", "", "KeyA", "a", true)); dp.appendChild(btn("r", "&#9654;", "", "KeyD", "d", true));
            dp.appendChild(btn("u", "&#9650;", "", "KeyW", "w", true)); dp.appendChild(btn("d", "&#9660;", "", "KeyS", "s", true));
            root.appendChild(dp);
            const ac = document.createElement("div"); ac.className = "tc-ac";
            ac.appendChild(btn("jump", "JUMP", "", "Space", " ", false)); ac.appendChild(btn("pu", "P", "PUNCH", "KeyP", "p", false)); ac.appendChild(btn("ki", "K", "KICK", "KeyK", "k", false));
            ac.appendChild(btn("sp", "L", "SPECIAL", "KeyL", "l", false)); ac.appendChild(btn("du", "&#9660;", "DUCK", "KeyC", "c", true));
            root.appendChild(ac);
        }
        document.body.appendChild(root);
        document.documentElement.classList.add("has-touch");
        // hide the pad while a menu / pause / game-over panel is open
        const sel = "#pause:not([hidden]), #over:not([hidden]), #clear:not([hidden]), #victory:not([hidden]), .rmx-mech, #rmx:not([hidden])";
        function vis() { let hide = !!document.querySelector(sel); const s = document.getElementById("select"); if (s && getComputedStyle(s).display !== "none") hide = true; const h = document.getElementById("hud"); if (SURV && h && h.hidden) hide = true; root.classList.toggle("off", hide); }
        setInterval(vis, 250); vis();
        document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    }
})();
