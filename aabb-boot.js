/* =========================================================
   AABB engine loader.
   1) If java/aabb.js (the Java code compiled with TeaVM, see aabb-java/) was loaded, call its main():
      it publishes window.RunMilAABB with engine = "java".
   2) Otherwise use the JavaScript copy below (same functions, same results) so the game always runs.
========================================================= */
(function () {
    "use strict";
    let why = "";                                                  // shown on the pause screen when the Java version is not in use
    try {
        if (!window.RunMilAABB) {
            if (typeof window.main === "function") window.main();
            else why = window.__aabbMissing ? "java/aabb.js was not found next to the game" : "java/aabb.js is only the empty placeholder (the Java was not compiled into this folder)";
        }
    } catch (e) { why = "Java main() failed: " + (e && e.message || e); }

    // ---- JavaScript copy of AABB.java / DropPicker.java ----
    function overlap(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }
    function landsOnTop(pl, pr, bl, br, prevFeetH, feetH, top, edgeTol, fallTol) {
        return pr > bl + edgeTol && pl < br - edgeTol && prevFeetH >= top - fallTol && feetH <= top + 1;
    }
    function split(s, sep) { return String(s || "").split(sep).map(function (t) { return t.trim(); }).filter(function (t) { return t.length > 0; }); }
    function boxes(s) { return split(s, ";").map(function (row) { const n = split(row, ","), v = [0, 0, 0, 0]; for (let i = 0; i < 4 && i < n.length; i++) v[i] = parseFloat(n[i]); return v; }); }
    function pick(poolCsv, missingCsv, r1, r2) {
        const pool = split(poolCsv, ","), missing = split(missingCsv, ","), list = (missing.length && r1 < 0.8) ? missing : pool;
        if (!list.length) return "";
        let i = Math.floor(r2 * list.length); if (i >= list.length) i = list.length - 1; if (i < 0) i = 0;
        return list[i];
    }
    function firstFree(bx, by, bw, bh, obstaclesCsv, offsetsCsv) {
        const obs = boxes(obstaclesCsv), offs = boxes(offsetsCsv);
        for (let i = 0; i < offs.length; i++) {
            const nx = bx + offs[i][0], ny = by + offs[i][1];
            if (!obs.some(function (b) { return overlap(nx, ny, bw, bh, b[0], b[1], b[2], b[3]); })) return i;
        }
        return -1;
    }
    const JS = { overlap: overlap, landsOnTop: landsOnTop, pick: pick, firstFree: firstFree };
    const J = window.RunMilAABB;                                   // set by the Java build, if it was loaded
    if (!J || !J.overlap) {
        window.RunMilAABB = { engine: "js", why: why || "Java did not publish its functions", overlap: overlap, landsOnTop: landsOnTop, pick: pick, firstFree: firstFree };
        console.log("[RUN MIL] collision engine: JavaScript copy (build aabb-java to use the Java version)");
        return;
    }
    // Java is present: self-test every function against the JS copy, and guard each call at run time.
    const tests = {
        overlap: [[0, 0, 10, 10, 5, 5, 10, 10], [0, 0, 10, 10, 10, 0, 5, 5]],
        landsOnTop: [[0, 40, 10, 50, 90, 70, 70, 4, 8], [0, 40, 100, 150, 90, 70, 70, 4, 8]],
        pick: [["a,b,c", "b,c", 0.5, 0.5], ["a,b,c", "", 0.9, 0.1]],
        firstFree: [[0, 0, 44, 44, "0,0,50,50;200,200,10,10", "0,0;100,0"], [0, 0, 44, 44, "", "0,0"]]
    };
    let bad = 0;
    Object.keys(JS).forEach(function (name) {
        const jf = J[name]; let ok = typeof jf === "function";
        if (ok) { try { tests[name].forEach(function (a) { if (jf.apply(null, a) !== JS[name].apply(null, a)) ok = false; }); } catch (e) { ok = false; console.error("[RUN MIL] Java " + name + " failed its self-test:", e); } }
        if (!ok) { bad++; J[name] = JS[name]; console.warn("[RUN MIL] using the JavaScript copy of " + name, "(the Java " + name + " is a \"" + typeof jf + "\", it should be a function)"); return; }
        J[name] = function () {                                    // run-time guard
            try { return jf.apply(null, arguments); }
            catch (e) { console.error("[RUN MIL] Java " + name + " threw, switching to the JS copy:", e); J[name] = JS[name]; return JS[name].apply(null, arguments); }
        };
    });
    if (bad) J.why = "Java self-test failed for " + bad + " function(s), see the browser console";
    J.engine = bad === 0 ? "java" : (bad === 4 ? "js" : "java (" + (4 - bad) + "/4 functions)");
    console.log("[RUN MIL] collision engine: " + J.engine);
})();
