/* RUN MIL! - two-device link for 1 VS 1 (and later 2 player Monster Survival).
   Android app : uses the native "RunMilLan" plugin: the HOST phone turns its Hotspot on, the other phone joins that Wi-Fi and connects to it (plain TCP, no internet needed).
   Testing     : add  ?nettest=1  to the page address and open the page in TWO tabs of the same browser: they link through a BroadcastChannel.
   API : RunMilNet.available()  RunMilNet.host(name)  RunMilNet.join()  RunMilNet.connect(id)  RunMilNet.send(obj)  RunMilNet.close()  RunMilNet.on(type, fn)
   events : hosting {ips}   found {id,name}   lost {id}   open {role,peer}   msg {...}   close {}   error {message}   */
(function () {
    "use strict";
    const H = {};
    function emit(t, a) { (H[t] || []).slice().forEach(function (f) { try { f(a); } catch (e) { if (window.console) console.error(e); } }); }
    const TEST = /[?&]nettest=1/.test(location.search);
    function plug() {
        const C = window.Capacitor; if (!C) return null;
        try { return (C.Plugins && C.Plugins.RunMilLan) || (C.registerPlugin ? C.registerPlugin("RunMilLan") : null); } catch (e) { return null; }
    }
    const NATIVE = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && plug()) && !TEST;
    const NET = { role: "", peer: null, open: false, handles: [] };

    // ---------- Android: the host's hotspot (Wi-Fi).  The HOST phone turns its Hotspot on and listens; the other phone joins that Wi-Fi and connects to the host ----------
    function nativeStart(role, ip) {
        const P = plug(); NET.role = role;
        if (!NET.handles.length) {
            ["connected", "message", "closed", "failure"].forEach(function (ev) {
                const h = P.addListener(ev, function (d) {
                    d = d || {};
                    if (ev === "connected") { NET.open = true; NET.peer = d.ip || "FRIEND"; emit("open", { role: NET.role, peer: NET.peer }); }
                    else if (ev === "message") { let o = null; try { o = JSON.parse(d.data); } catch (e) { /* not ours */ } if (o) emit("msg", o); }
                    else if (ev === "closed") { const was = NET.open; NET.open = false; if (was) emit("close", {}); }
                    else emit("error", { message: d.message || "Connection failed" });
                });
                NET.handles.push(h);
            });
        }
        const call = role === "host" ? P.host().then(function (r) { emit("hosting", { ips: (r && r.ips) || [] }); }) : P.join({ ip: ip || "" });
        return call.catch(function (e) { emit("error", { message: (e && (e.message || e.errorMessage)) || "Could not start" }); });
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
        native: NATIVE,
        isOpen: function () { return NET.open; },
        role: function () { return NET.role; },
        peerName: function () { return NET.peer; },
        host: function (name) { return NATIVE ? nativeStart("host") : bcStart("host", name); },
        join: function (name, ip) { return NATIVE ? nativeStart("guest", ip) : bcStart("guest", name); },
        connect: function (id, name) {
            if (NATIVE) return plug().connect({ id: id }).catch(function (e) { emit("error", { message: (e && (e.message || e.errorMessage)) || "Could not connect" }); });
            bc.postMessage({ k: "req", to: id, from: myId, name: name || "FRIEND" }); return Promise.resolve();
        },
        send: function (o) {
            if (!NET.open) return;
            if (NATIVE) { plug().send({ data: JSON.stringify(o) }).catch(function () { /* the link closed */ }); }
            else bc.postMessage({ k: "d", to: other, from: myId, d: JSON.parse(JSON.stringify(o)) });
        },
        close: function () {
            const was = NET.open; NET.open = false; clearInterval(advTimer);
            if (NATIVE) { try { plug().stop(); } catch (e) { /* ignore */ } }
            else if (bc) { if (was && other) bc.postMessage({ k: "bye", to: other, from: myId }); }
            other = null; NET.role = "";
        },
        on: function (t, f) { (H[t] = H[t] || []).push(f); }
    };
})();
