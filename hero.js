/* =========================================================
   RunMilHero - the menu characters (character1..5) and their avatars.
   - draws the chosen character as an animation (menu centre + customization preview)
   - repaints hair / shirt / pants / shoes with the outfit saved by RunMilCharacter
   - remembers which character (and matching avatar) the player picked ("hero" in runmil_save)
   Data comes from characters.js (window.RUNMIL_HEROES).
========================================================= */
(function () {
    "use strict";
    const LIST = window.RUNMIL_HEROES || [];
    const C = window.RunMilCharacter;
    const KEY = "runmil_save";
    const PART_ID = { shirt: 1, pants: 2, shoes: 3, hair: 4 };
    const HEAD_FRAME = 20;                                   // a frame where the face is clear (profile picture)
    const byId = {};
    LIST.forEach(function (h) { byId[h.id] = h; });

    function readSave() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
    function clampId(n) { return byId[n] ? +n : (LIST.length ? LIST[0].id : 1); }
    let selected = clampId(+readSave().hero || 1);
    const selListeners = [];

    function select(id) {
        selected = clampId(id);
        try { const s = readSave(); s.hero = selected; localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
        selListeners.forEach(function (f) { f(selected); });
        redrawAll();
    }

    // ---------- sprite sets (loaded on demand) ----------
    const sets = {};
    function loadImg(src) { return new Promise(function (res) { const i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
    function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

    function getSet(id) {
        if (sets[id]) return sets[id];
        const h = byId[id], S = sets[id] = { h: h, ready: false, key: null, total: h ? h.dur.reduce(function (a, b) { return a + b; }, 0) : 1 };
        if (!h) return S;
        Promise.all([loadImg(h.atlas), loadImg(h.mask)]).then(function (im) {
            if (!im[0] || !im[1]) return;
            const W = h.cols * h.fw, H = Math.ceil(h.n / h.cols) * h.fh;
            const c = document.createElement("canvas"); c.width = W; c.height = H;
            const x = c.getContext("2d", { willReadFrequently: true });
            x.drawImage(im[0], 0, 0); const src = x.getImageData(0, 0, W, H);
            x.clearRect(0, 0, W, H); x.drawImage(im[1], 0, 0); const md = x.getImageData(0, 0, W, H).data;
            const s = src.data, idx = [], kind = [], sum = [0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0];
            for (let i = 0; i < s.length; i += 4) {                 // only the painted pixels are touched when recolouring
                const k = md[i]; if (!k || k > 4 || s[i + 3] === 0) continue;
                const lum = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2];
                idx.push(i); kind.push(k);
                if (s[i + 3] >= 60) { sum[k] += lum; cnt[k]++; }
            }
            const ref = sum.map(function (v, k) { return cnt[k] ? v / cnt[k] : 1; });
            S.f = new Float32Array(idx.length);
            for (let j = 0; j < idx.length; j++) {                  // keeps the original shading
                const i = idx[j], lum = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2];
                S.f[j] = Math.max(0.3, Math.min(1.7, lum / ref[kind[j]]));
            }
            S.bb = null;                                            // head-and-shoulders box of frame 0 (for the profile picture)
            (function () {
                let x0 = h.fw, x1 = 0, y0 = h.fh;
                const fx = (HEAD_FRAME % h.cols) * h.fw, fy = Math.floor(HEAD_FRAME / h.cols) * h.fh;
                for (let yy = 0; yy < h.fh; yy++) for (let xx = 0; xx < h.fw; xx++) if (s[((fy + yy) * W + fx + xx) * 4 + 3] > 60) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; }
                if (x1 > x0) S.bb = { x0: x0, x1: x1, y0: y0 };
            })();
            S.nx = new Float32Array(idx.length); S.ny = new Float32Array(idx.length);       // where each painted pixel sits on the body (for skin patterns)
            (function () {
                const bbs = [];
                for (let fr = 0; fr < h.n; fr++) {
                    const ox = (fr % h.cols) * h.fw, oy = Math.floor(fr / h.cols) * h.fh; let x0 = h.fw, x1 = 0, y0 = h.fh, y1 = 0;
                    for (let yy = 0; yy < h.fh; yy += 2) for (let xx = 0; xx < h.fw; xx += 2) if (s[((oy + yy) * W + ox + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
                    bbs.push(x1 > x0 ? [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)] : [0, 0, h.fw, h.fh]);
                }
                for (let j = 0; j < idx.length; j++) {
                    const p = idx[j] >> 2, px = p % W, py = Math.floor(p / W), bb = bbs[Math.floor(py / h.fh) * h.cols + Math.floor(px / h.fw)];
                    S.nx[j] = Math.max(0, Math.min(1, (px % h.fw - bb[0]) / bb[2])); S.ny[j] = Math.max(0, Math.min(1, (py % h.fh - bb[1]) / bb[3]));
                }
            })();
            S.L = new Uint8Array(W * H); for (let j = 0; j < idx.length; j++) S.L[idx[j] >> 2] = kind[j];       // part labels (1 shirt, 2 pants, 3 shoes, 4 hair)
            S.geo = []; if (C && C.frameGeo) for (let fr = 0; fr < h.n; fr++) S.geo.push(C.frameGeo(s, S.L, W, (fr % h.cols) * h.fw, Math.floor(fr / h.cols) * h.fh, h.fw, h.fh));
            (function () { let sr = 0, sg = 0, sb = 0, sc = 0; for (let p = 0; p < W * H; p++) { const i = p * 4; if (!S.L[p] && s[i + 3] > 200 && s[i] > s[i + 1] * 1.05 && s[i] > s[i + 2] * 1.35) { sr += s[i]; sg += s[i + 1]; sb += s[i + 2]; sc++; } } S.tone = sc ? [sr / sc, sg / sc, sb / sc] : [200, 125, 85]; })();
            S.idx = Int32Array.from(idx); S.kind = Uint8Array.from(kind); S.src = s;
            S.out = new ImageData(new Uint8ClampedArray(s), W, H);
            S.sheet = document.createElement("canvas"); S.sheet.width = W; S.sheet.height = H;
            S.ctx = S.sheet.getContext("2d");
            S.ready = true; redrawAll();
        });
        return S;
    }

    function ensureColors(S) {
        const cols = C ? C.getColors() : {};
        const sid = C && C.skinId ? C.skinId() : null, key = ["shirt", "pants", "shoes", "hair"].map(function (p) { return cols[p] || "-"; }).join("|") + "|" + (sid || "");
        if (S.key === key) return;
        const tg = [null, null, null, null, null, null, null, null], skn = sid && C.skin ? C.skin(sid) : null, shp = skn && skn.shape;
        ["shirt", "pants", "shoes", "hair"].forEach(function (p) { tg[PART_ID[p]] = cols[p] ? (C.mute ? C.mute(hex(cols[p])) : hex(cols[p])) : null; });
        tg[6] = S.tone; tg[7] = tg[1];
        const o = S.out.data, s = S.src, n = S.idx.length;
        if (skn) o.set(s);                                                    // start again from the plain picture (accessories are drawn on top below)
        for (let j = 0; j < n; j++) {
            const i = S.idx[j]; let kd = S.kind[j];
            if (shp && kd === 2) { if (shp.coat && S.ny[j] < shp.coat) kd = 7; else if (shp.shorts && S.ny[j] > shp.shorts) kd = 6; }
            let t = tg[kd];
            if (t) { let f = S.f[j]; if (kd >= 6) f = Math.max(0.75, Math.min(1.15, f)); if (sid && (kd === 1 || kd === 2)) t = C.skinPix(kd === 1 ? "shirt" : "pants", S.nx[j], S.ny[j], t); o[i] = Math.min(255, t[0] * f); o[i + 1] = Math.min(255, t[1] * f); o[i + 2] = Math.min(255, t[2] * f); }
            else { o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; }
        }
        S.ctx.putImageData(S.out, 0, 0);
        S.key = key;
    }

    function frameAt(S, t) {
        const h = S.h; t = t % S.total;
        for (let i = 0; i < h.n; i++) { if (t < h.dur[i]) return i; t -= h.dur[i]; }
        return 0;
    }

    // ---------- animated canvas views ----------
    const views = [];
    function view(canvas, opts) {
        opts = opts || {};
        const ctx = canvas.getContext("2d");
        const v = {
            id: opts.id ? clampId(opts.id) : null, frame: -1,
            curId: function () { return v.id || selected; },
            setId: function (id) { v.id = clampId(id); v.frame = -1; getSet(v.id); v.draw(); },
            follow: function () { v.id = null; v.frame = -1; v.draw(); },
            draw: function () {
                const S = getSet(v.curId()); if (!S.ready) return;
                ensureColors(S);
                const h = S.h, i = opts.head ? HEAD_FRAME : Math.max(0, v.frame) % h.n;
                if (opts.head) {                                  // profile picture: head and shoulders, wearing the saved outfit
                    const bb = S.bb || { x0: 0, x1: h.fw, y0: 0 }, size = Math.max(40, (bb.x1 - bb.x0) * 1.05), cx = (bb.x0 + bb.x1) / 2;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    const fx = (i % h.cols) * h.fw, fy = Math.floor(i / h.cols) * h.fh;
                    ctx.drawImage(S.sheet, fx + cx - size / 2, fy + bb.y0 - size * 0.04, size, size, 0, 0, canvas.width, canvas.height);
                    return;
                }
                const sx = (i % h.cols) * h.fw, sy = Math.floor(i / h.cols) * h.fh;
                let ch = canvas.height, w = ch * h.fw / h.fh;
                if (w > canvas.width) { w = canvas.width; ch = w * h.fh / h.fw; }
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(S.sheet, sx, sy, h.fw, h.fh, (canvas.width - w) / 2, canvas.height - ch, w, ch);
            },
            destroy: function () { const k = views.indexOf(v); if (k >= 0) views.splice(k, 1); }
        };
        views.push(v); getSet(v.curId()); v.draw();
        return v;
    }
    function redrawAll() { views.forEach(function (v) { v.frame = -1; v.draw(); }); }

    const t0 = performance.now();
    function loop(now) {
        if (!document.hidden) {
            views.forEach(function (v) {
                const S = getSet(v.curId()); if (!S.ready) return;
                const f = frameAt(S, now - t0);
                if (v.frame !== f) { v.frame = f; v.draw(); }
            });
        }
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    if (C && C.onChange) C.onChange(function () { views.forEach(function (v) { v.draw(); }); });

    window.RunMilHero = {
        list: LIST, count: LIST.length,
        selected: function () { return selected; },
        select: select,
        onSelect: function (f) { selListeners.push(f); },
        avatarSrc: function (id) { const h = byId[id] || byId[selected]; return h ? h.avatar : ""; },
        view: view
    };
})();
