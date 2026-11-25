/* RUN MIL! - the "play with a friend" screen (1 VS 1 and 2 player Monster Survival).
   Android: Bluetooth (Nearby). One phone taps HOST A GAME; the friend taps JOIN A GAME and then the host's name.
   RunMilLobby.show({ title, msg, onOpen(role), onBack() })   RunMilLobby.hide() */
(function () {
    "use strict";
    const NT = window.RunMilNet; if (!NT) return;
    const css = '#nlb{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 30%,#1d2a78,#070b26 75%);font-family:Teko,Impact,sans-serif;color:#fff;-webkit-user-select:none;user-select:none}' +
        '#nlb[hidden]{display:none}#nlb .b{width:min(92vw,150vmin);max-height:94vh;overflow:auto;display:flex;flex-direction:column;align-items:center;gap:2.2vmin;text-align:center;padding:3.4vmin 4vmin;border:.6vmin solid #6a8cff;border-radius:2.6vmin;background:rgba(8,14,60,.88);box-shadow:0 0 6vmin rgba(80,120,255,.45)}' +
        '#nlb h2{margin:0;font-size:8vmin;line-height:1;color:#ffd24a;text-shadow:0 .6vmin 0 #5a2a00;font-weight:700}' +
        '#nlb p{margin:0;font:600 3.1vmin/1.3 system-ui,Arial,sans-serif;color:#cfd8ff;min-height:7vmin}' +
        '#nlb button{font:700 4.6vmin/1 Teko,Impact,sans-serif;color:#fff;padding:1.2vmin 5vmin;border:.5vmin solid #9ab0ff;border-radius:1.6vmin;background:linear-gradient(#3a58ff,#1c2fb0);touch-action:manipulation;cursor:pointer}' +
        '#nlb button.gold{background:linear-gradient(#ffd24a,#e08a00);border-color:#7a4a00;color:#3a1a00}#nlb button.sm{font-size:3.6vmin;padding:.8vmin 3.6vmin}' +
        '#nlb .row{display:flex;gap:2vmin;flex-wrap:wrap;justify-content:center;align-items:center}#nlb [hidden]{display:none!important}' +
        '#nlb .code{font-size:11vmin;line-height:1;color:#7dff8a;letter-spacing:.06em;text-shadow:0 0 3vmin rgba(125,255,138,.6)}#nlb small{display:block;font:600 2.7vmin/1.3 system-ui,Arial,sans-serif;color:#9ab0ff;margin-top:.8vmin}' +
        '#nlb .dots::after{content:"";display:block;margin:1.4vmin auto 0;width:5vmin;height:5vmin;border:.7vmin solid #6a8cff;border-top-color:transparent;border-radius:50%;animation:nlbspin 1s linear infinite}@keyframes nlbspin{to{transform:rotate(360deg)}}' +
        '#nlb .devs{display:flex;flex-direction:column;gap:1vmin}#nlb input{font:700 4vmin/1 Teko,Impact,sans-serif;text-align:center;width:46vmin;padding:1vmin 1.4vmin;border-radius:1.4vmin;border:.4vmin solid #6a8cff;background:#050a30;color:#fff}' +
        '#nlb ol{margin:0;padding:0 0 0 4vmin;text-align:left;font:600 2.9vmin/1.35 system-ui,Arial,sans-serif;color:#cfd8ff}';
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const root = document.createElement("div"); root.id = "nlb"; root.hidden = true;
    root.innerHTML = '<div class="b"><h2 id="nlb-t">PLAY WITH A FRIEND</h2><p id="nlb-msg"></p>' +
        '<div class="row" id="nlb-main"><button class="gold" id="nlb-host">HOST A GAME</button><button id="nlb-join">JOIN A GAME</button></div>' +
        '<div id="nlb-wait" hidden><div class="code" id="nlb-code">...</div><small id="nlb-wsub"></small><div class="dots"></div></div>' +
        '<div id="nlb-jn" hidden><div class="devs" id="nlb-devs"></div><small id="nlb-none">Nobody found yet. Make sure your friend taps HOST A GAME.</small>' +
        '<div class="row" id="nlb-ipbox"><input id="nlb-ip" placeholder="Host address (empty = automatic)" inputmode="decimal" autocomplete="off"><button class="gold sm" id="nlb-go">CONNECT</button></div></div>' +
        '<button class="sm" id="nlb-back">BACK</button></div>';
    document.body.appendChild(root);
    const $ = function (id) { return document.getElementById(id); };
    let opts = {}, state = "", busy = 0; const found = {};
    const NATIVE = false, PHONE = !!NT.native;       // the phone link lists nearby hosts just like the browser test
    function setState(s) {
        state = s; busy = 0; $("nlb-main").hidden = s !== ""; $("nlb-wait").hidden = s !== "host"; $("nlb-jn").hidden = s !== "join";
        $("nlb-devs").hidden = NATIVE; $("nlb-none").hidden = NATIVE || !!Object.keys(found).length; $("nlb-ipbox").hidden = !NATIVE;
    }
    function defMsg() {
        return PHONE ? "Uses Bluetooth, no internet needed. Switch Bluetooth ON on both phones and keep them close. One phone taps HOST A GAME, the other taps JOIN A GAME and then the host's name."
            : "Open this page in two tabs. One tab hosts, the other joins.";
    }
    function show(o) { opts = o || {}; $("nlb-t").textContent = opts.title || "PLAY WITH A FRIEND"; root.hidden = false; setState(""); $("nlb-msg").textContent = opts.msg || defMsg(); }
    function hide() { root.hidden = true; }
    $("nlb-host").addEventListener("click", function () {
        setState("host"); $("nlb-code").textContent = "MIL-" + (100 + Math.floor(Math.random() * 900));
        $("nlb-msg").textContent = PHONE ? "Starting Bluetooth... Allow the Bluetooth / Nearby permissions if asked." : "Waiting for your friend...";
        $("nlb-wsub").textContent = "Your friend taps JOIN A GAME and picks this name.";
        NT.host($("nlb-code").textContent);
        if (PHONE) setTimeout(function () { if (state === "host" && NT.diag && !/advertising/.test(NT.diag())) { $("nlb-msg").textContent = "Bluetooth hosting did not start. Allow the permissions, switch Bluetooth ON, then tap BACK and try again."; $("nlb-wsub").textContent = NT.diag(); } }, 9000);
    });
    $("nlb-join").addEventListener("click", function () {
        Object.keys(found).forEach(function (k) { found[k].remove(); delete found[k]; }); setState("join");
        $("nlb-msg").textContent = "Looking for a host nearby...";
        NT.join("FRIEND-" + (100 + Math.floor(Math.random() * 900)));
    });
    $("nlb-go").addEventListener("click", function () {
        if (busy) return; busy = 1; $("nlb-msg").textContent = "Connecting..."; NT.join("", $("nlb-ip").value.trim());
    });
    $("nlb-back").addEventListener("click", function () {
        if (state) { NT.close(); setState(""); $("nlb-msg").textContent = opts.msg || defMsg(); return; }
        hide(); if (opts.onBack) opts.onBack();
    });
    NT.on("hosting", function (d) {
        const ips = (d && d.ips) || [];
        if (!ips.length) { $("nlb-code").textContent = "NO HOTSPOT"; $("nlb-msg").textContent = "Your Hotspot is off. Switch it ON in your phone settings, then tap BACK and HOST A GAME again."; return; }
        $("nlb-code").textContent = ips[0]; $("nlb-wsub").textContent = "This is your address. Your friend joins your hotspot and taps JOIN A GAME (if it does not connect, type this address there).";
    });
    NT.on("found", function (d) {
        if (found[d.id] || NATIVE) return; const b = document.createElement("button"); b.className = "sm"; b.textContent = d.name || "PLAYER"; found[d.id] = b; $("nlb-devs").appendChild(b); $("nlb-none").hidden = true;
        b.addEventListener("click", function () { $("nlb-msg").textContent = "Connecting to " + (d.name || "your friend") + "..."; NT.connect(d.id, "FRIEND"); });
    });
    NT.on("lost", function (d) { const b = found[d.id]; if (b) { b.remove(); delete found[d.id]; } if (!NATIVE && !Object.keys(found).length) $("nlb-none").hidden = false; });
    NT.on("open", function (d) { if (!root.hidden) { hide(); if (opts.onOpen) opts.onOpen(d.role); } });
    NT.on("error", function (d) { if (root.hidden) return; setState(""); $("nlb-msg").textContent = (d && d.message ? d.message : "Could not connect") + (PHONE && !(d && d.fatal) ? ". Check that Bluetooth and Location are ON on both phones and that your friend tapped HOST A GAME first." : ""); });
    window.RunMilLobby = { show: show, hide: hide };
})();
