/* RUN MIL! - phone / Android helpers: detects the app, switches on "light mode" for smooth play.
   RUNMIL_NATIVE : running inside the Android app (WebView)      RUNMIL_PERF : light mode (still backgrounds, no canvas filters, no glow animations)
   Override for testing:  localStorage.runmil_perf = "0" (full effects) or "1" (light mode)  */
(function () {
    "use strict";
    const ua = navigator.userAgent || "";
    const native = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) || /; wv\)/.test(ua);
    let perf = native || /Android/i.test(ua);
    try { const o = localStorage.getItem("runmil_perf"); if (o === "0") perf = false; else if (o === "1") perf = true; } catch (e) { /* storage unavailable */ }
    window.RUNMIL_NATIVE = native; window.RUNMIL_PERF = perf;
    const root = document.documentElement;
    if (native) root.classList.add("native");
    if (perf) root.classList.add("perf");
    // a still picture of the first frame of an animated GIF / WebP (an animated 2048 px background costs a phone a lot of time every frame)
    window.RUNMIL_still = function (img, filter, type, q) {
        try {
            const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
            const g = c.getContext("2d"); if (filter) g.filter = filter; g.drawImage(img, 0, 0);
            return c.toDataURL(type || "image/jpeg", q || 0.92);
        } catch (e) { return null; }
    };
})();
