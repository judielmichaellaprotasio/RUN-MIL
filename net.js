/* RUN MIL! - two-device link for 1 VS 1 (and later 2 player Monster Survival).
   Android app : uses the native "RunMilNearby" plugin (Google Nearby Connections over Bluetooth / Wi-Fi Direct, no internet needed).
   Testing     : add  ?nettest=1  to the page address and open the page in TWO tabs of the same browser: they link through a BroadcastChannel.
   API : RunMilNet.available()  RunMilNet.host(name)  RunMilNet.join()  RunMilNet.connect(id)  RunMilNet.send(obj)  RunMilNet.close()  RunMilNet.on(type, fn)
   events : found {id,name}   lost {id}   open {role,peer}   msg {...}   close {}   error {message}   */
(function () {
    "use strict";
    const H = {};
    // ---- link quality: a ping every second + a small on-screen read-out (so a slow link is visible, and the game slows its updates down when it must)
    const Q = { rtt: 0, rx: 0, rate: 0, last: 0, timer: 0, el: null };
    function qShow() {
        if (!Q.el) { Q.el = document.createElement("div"); Q.el.style.cssText = "position:fixed;left:6px;bottom:4px;z-index:2147483000;font:700 11px/1 monospace;padding:2px 5px;border-radius:4px;background:rgba(0,0,0,.55);pointer-events:none"; if (document.body) document.body.appendChild(Q.el); }
        const bad = !Q.rtt || Q.rtt > 250 || Q.rate < 5; Q.el.style.color = bad ? "#ff7b7b" : "#7dffa0";
        Q.el.textContent = "LINK " + (Q.rtt ? Q.rtt + "ms" : "...") + "  " + Q.rate + "/s";
    }
    function qStart() {
        qStop(); Q.rtt = 0; Q.rx = 0; Q.rate = 0; qShow();
        Q.timer = setInterval(function () { Q.rate = Q.rx; Q.rx = 0; qShow(); if (window.RunMilNet) RunMilNet.send({ t: "~p", ts: Date.now() }); }, 1000);
    }
    function qStop() { clearInterval(Q.timer); Q.timer = 0; if (Q.el && Q.el.parentNode) Q.el.parentNode.removeChild(Q.el); Q.el = null; }
    function emit(t, a) {
        if (t === "open") qStart(); else if (t === "close") qStop();
        else if (t === "msg" && a && typeof a.t === "string" && a.t.charAt(0) === "~") {
            if (a.t === "~p") RunMilNet.send({ t: "~q", ts: a.ts }); else if (a.t === "~q") { const r = Date.now() - a.ts; Q.rtt = Q.rtt ? Math.round(Q.rtt * 0.6 + r * 0.4) : r; }
            return;
        } else if (t === "msg") Q.rx++;
        (H[t] || []).slice().forEach(function (f) { try { f(a); } catch (e) { if (window.console) console.error(e); } }); }
    const TEST = /[?&]nettest=1/.test(location.search);
    // the game page runs inside a frame of the menu: the Android bridge only answers the TOP window, so always talk to its Capacitor
    function CAP() { try { if (window.top && window.top !== window && window.top.Capacitor) return window.top.Capacitor; } catch (e) { /* other origin */ } return window.Capacitor; }
    // two ways to link the phones: "lan" = the host's hotspot (fast, a few ms) or "bt" = Bluetooth / Nearby (slower). The player picks one in the lobby.
    const PLUGIN = { lan: "RunMilLan", bt: "RunMilNearby" };
    let MODE = "lan"; try { MODE = localStorage.getItem("runmil_link") === "bt" ? "bt" : "lan"; } catch (e) { /* none */ }
    function plug(name) {
        const C = CAP(); if (!C) return null; name = name || PLUGIN[MODE];
        try { return (C.Plugins && C.Plugins[name]) || (C.registerPlugin ? C.registerPlugin(name) : null); } catch (e) { return null; }
    }
    const NATIVE = !!(CAP() && CAP().isNativePlatform && CAP().isNativePlatform() && plug()) && !TEST;
    const NET = { role: "", peer: null, open: false, handles: { lan: [], bt: [] } };

    // ---------- Android: Bluetooth (Google Nearby Connections: finds the other phone, connects over Bluetooth, moves to Wi-Fi Direct by itself for speed) ----------
    function haveNative(name) { name = name || PLUGIN[MODE]; try { const C = CAP(); if (C && C.PluginHeaders && C.PluginHeaders.length !== undefined) return C.PluginHeaders.some(function (h) { return h && h.name === name; }); return !!(C && C.Plugins && C.Plugins[name]); } catch (e) { return false; } }
    function lan(method, args) {                       // call a plugin method; if the JS proxy has no such method, go straight to the native bridge
        const P = plug(), C = CAP();
        if (P && typeof P[method] === "function") return Promise.resolve(P[method](args));
        if (C && typeof C.nativePromise === "function") return C.nativePromise(PLUGIN[MODE], method, args || {});
        return Promise.reject(new Error("no way to call " + method));
    }
    function nativeStart(role, name, ip) {
        const P = plug(), mode = MODE; NET.role = role; NET.step = "start";
        if (!haveNative()) { emit("error", { fatal: 1, message: "This app was built without the " + (mode === "lan" ? "hotspot" : "Bluetooth") + " link part. Upload the Android files, wait for Build Android APK to finish, then install the NEW apk." }); return Promise.resolve(); }
        try {
            if (!NET.handles[mode].length) {
                ["found", "lost", "connected", "message", "closed", "failure"].forEach(function (ev) {
                    const h = P.addListener(ev, function (d) {
                        if (mode !== MODE) return; d = d || {};
                        if (ev === "found") emit("found", { id: d.id, name: d.name });
                        else if (ev === "lost") emit("lost", { id: d.id });
                        else if (ev === "connected") { NET.open = true; NET.peer = d.name || "FRIEND"; emit("open", { role: NET.role, peer: NET.peer }); }
                        else if (ev === "message") { let o = null; try { o = JSON.parse(d.data); } catch (e) { /* not ours */ } if (o) emit("msg", o); }
                        else if (ev === "closed") { const was = NET.open; NET.open = false; if (was) emit("close", {}); }
                        else emit("error", { message: d.message || "Connection failed" });
                    });
                    NET.handles[mode].push(h);
                });
            }
        } catch (e) { NET.step = "listen failed: " + (e && e.message || e); emit("error", { fatal: 1, message: "Link failed to start: " + (e && e.message || e) }); return Promise.resolve(); }
        NET.step = "calling";
        let call;
        try {
            if (mode === "lan") call = (role === "host" ? lan("host", {}).then(function (r) { NET.step = "advertising"; emit("hosting", { ips: (r && r.ips) || [] }); }) : lan("join", { ip: ip || "" }).then(function () { NET.step = "joined"; }));
            else call = lan("start", { role: role, name: name || "" }).then(function () { NET.step = role === "host" ? "advertising" : "searching"; });
        } catch (e) { NET.step = "threw: " + (e && e.message || e); emit("error", { fatal: 1, message: "Link failed: " + (e && e.message || e) }); return Promise.resolve(); }
        return call.catch(function (e) { NET.step = "rejected"; emit("error", { message: (e && (e.message || e.errorMessage)) || "Could not start" }); });
    }

    // ---------- browser test link (two tabs) ----------
    let bc = null, myId = "t" + Math.random().toString(36).slice(2, 8), advTimer = 0, other = null, myName = "";
    function bcStart(role, name) {
        NET.role = role; myName = name || ""; if (!bc) { bc = new BroadcastChannel("runmil-net-test"); bc.onmessage = function (e) { bcIn(e.data || {}); }; }
        if (role === "host") { const adv = function () { if (!NET.open) bc.postMessage({ k: "adv", id: myId, name: myName }); }; clearInterval(advTimer); advTimer = setInterval(adv, 700); adv(); }
        else { bc.postMessage({ k: "who" }); }
        addEventListener("pagehide", function () { if (NET.open && other) bc.postMessage({ k: "bye", to: other, from: myId }); });
        return Promise.resolve();
    }
    function bcIn(m) {
        if (m.k === "who" && NET.role === "host" && !NET.open) bc.postMessage({ k: "adv", id: myId, name: myName });
        else if (m.k === "adv" && NET.role === "guest" && !NET.open) emit("found", { id: m.id, name: m.name });
        else if (m.k === "req" && m.to === myId && NET.role === "host" && !NET.open) { other = m.from; NET.open = true; NET.peer = m.name || "FRIEND"; clearInterval(advTimer); bc.postMessage({ k: "acc", to: m.from, from: myId, name: myName }); emit("open", { role: "host", peer: NET.peer }); }
        else if (m.k === "acc" && m.to === myId && NET.role === "guest") { other = m.from; NET.open = true; NET.peer = m.name || "HOST"; emit("open", { role: "guest", peer: NET.peer }); }
        else if (m.k === "d" && m.to === myId && NET.open && m.from === other) emit("msg", m.d);
        else if (m.k === "bye" && m.to === myId && NET.open) { NET.open = false; emit("close", {}); }
    }

    window.RunMilNet = {
        available: function () { return NATIVE || TEST; },
        interval: function () { if (!NATIVE || MODE === "lan") return 1 / 30; return Q.rtt > 400 ? 1 / 6 : Q.rtt > 200 ? 1 / 10 : 1 / 15; },       // Bluetooth is slow: fewer, newer pictures of the game
        diag: function () { try { const C = CAP() || {}; return "link-v5 " + MODE + " | top=" + (window.top !== window) + "  | native=" + NATIVE + " | plugins=" + (C.PluginHeaders ? C.PluginHeaders.map(function (h) { return h.name; }).join(",") : "n/a") + " | have=" + haveNative() + " | step=" + (NET.step || "-"); } catch (e) { return "diag failed"; } },
        native: NATIVE,
        isOpen: function () { return NET.open; },
        role: function () { return NET.role; },
        peerName: function () { return NET.peer; },
        host: function (name) { return NATIVE ? nativeStart("host", name) : bcStart("host", name); },
        mode: function () { return MODE; },
        setMode: function (m) { MODE = m === "bt" ? "bt" : "lan"; try { localStorage.setItem("runmil_link", MODE); } catch (e) { /* none */ } },
        hasMode: function (m) { return haveNative(PLUGIN[m]); },
        join: function (name, ip) { return NATIVE ? nativeStart("guest", name, ip) : bcStart("guest", name); },
        connect: function (id, name) {
            if (NATIVE) return lan("connect", { id: id }).catch(function (e) { emit("error", { message: (e && (e.message || e.errorMessage)) || "Could not connect" }); });
            bc.postMessage({ k: "req", to: id, from: myId, name: name || "FRIEND" }); return Promise.resolve();
        },
        send: function (o) {
            if (!NET.open) return;
            if (NATIVE) { lan("send", { data: JSON.stringify(o), lossy: MODE === "bt" && o && o.t === "s" }).catch(function () { /* the link closed */ }); }
            else bc.postMessage({ k: "d", to: other, from: myId, d: JSON.parse(JSON.stringify(o)) });
        },
        close: function () {
            const was = NET.open; NET.open = false; clearInterval(advTimer);
            if (NATIVE) { try { lan("stop", {}).catch(function () { }); } catch (e) { /* ignore */ } }
            else if (bc) { if (was && other) bc.postMessage({ k: "bye", to: other, from: myId }); }
            other = null; NET.role = "";
        },
        on: function (t, f) { (H[t] = H[t] || []).push(f); }
    };
})();
