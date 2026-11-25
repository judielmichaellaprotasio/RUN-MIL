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
    // phones: a fixed, full-screen picture that cannot be dragged, zoomed or scrolled
    const phone = native || /Android|iPhone|iPad/i.test(ua) || (window.matchMedia && matchMedia("(pointer: coarse)").matches);
    window.RUNMIL_PHONE = phone;
    if (phone) {
        root.classList.add("phone");
        const st = document.createElement("style");
        st.textContent = "html.phone,html.phone body{position:fixed;inset:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;touch-action:manipulation;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%}" +
            "html.phone #loading-screen video,html.phone #title-screen video{object-fit:cover!important}" +
            "html.phone #main-menu:not(.hidden){--u:min(2vw,3.5556vh);--u:min(2vw,3.5556dvh)}" +
            "html.phone #main-menu:not(.hidden) .menu-stage{flex:none;transform:scale(calc(.5 * var(--sx,1)),.5);transform-origin:center}" +
            "video::-webkit-media-controls,video::-webkit-media-controls-start-playback-button,video::-webkit-media-controls-overlay-play-button{display:none!important;-webkit-appearance:none!important}";
        (document.head || root).appendChild(st);
        const mv = document.querySelector('meta[name="viewport"]');
        if (mv) mv.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover");
        ["gesturestart", "gesturechange", "gestureend"].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false }); });
        document.addEventListener("touchmove", function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
        document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
        const fit = function () { const k = innerWidth / (innerHeight * 16 / 9); root.style.setProperty("--sx", String(Math.max(1, Math.min(k, 1.6)))); };   // the 16:9 menu is stretched sideways to fill a longer phone screen
        fit(); addEventListener("resize", fit); addEventListener("orientationchange", fit);
        addEventListener("scroll", function () { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); }, true);
    }
    // a still picture of the first frame of an animated GIF / WebP (an animated 2048 px background costs a phone a lot of time every frame)
    window.RUNMIL_still = function (img, filter, type, q) {
        try {
            const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
            const g = c.getContext("2d"); if (filter) g.filter = filter; g.drawImage(img, 0, 0);
            return c.toDataURL(type || "image/jpeg", q || 0.92);
        } catch (e) { return null; }
    };
})();
