/* =========================================================
   RunMilCharacter - shared by the main menu, the avatar and the game.
   Reads / writes the outfit in localStorage ("runmil_save" -> colors)
   so every page shows the same character.
========================================================= */
(function () {
    const SAVE_KEY = "runmil_save";
    const D = window.RUNMIL_CHAR;

    const OPTIONS = {
        shirt: ["#ffffff", "#e63946", "#ff9a1a", "#ffd24a", "#3ddc84", "#2fa4ff", "#8a5cff", "#ff6fb5", "#222831"],
        pants: ["#1c2340", "#222831", "#4a5568", "#2f6fdd", "#6b4226", "#2e7d4f", "#8a1c2b", "#d8cfa8"],
        shoes: ["#2a1d1d", "#ffffff", "#e63946", "#ff9a1a", "#2fa4ff", "#3ddc84", "#8a5cff", "#ffd24a"],
        hair:  ["#2b1a14", "#000000", "#6b4226", "#c99a4a", "#e63946", "#2fa4ff", "#8a5cff", "#f2f2f2"]
    };
    const PART_ID = { shirt: 1, pants: 2, shoes: 3, hair: 4 };
    let colors = { shirt: null, pants: null, shoes: null, hair: null };   // null = original art
    function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

    // The game art is soft and slightly muted, so picked colours are toned down to sit in the same palette as the monsters:
    // less saturated, and very light / very bright colours are pulled back a little.
    function mute(c) {
        const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
        let h = 0, s = 0;
        if (dl > 1e-6) {
            s = l > 0.5 ? dl / (2 - mx - mn) : dl / (mx + mn);
            h = mx === r ? ((g - b) / dl + (g < b ? 6 : 0)) : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h /= 6;
        }
        s *= 0.74; const l2 = l > 0.55 ? 0.55 + (l - 0.55) * 0.62 : l * 0.97;
        const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s, p = 2 * l2 - q;
        const f = function (t) { t = (t + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); };
        return s === 0 && dl <= 1e-6 ? [l2 * 255, l2 * 255, l2 * 255] : [f(h + 1 / 3), f(h), f(h - 1 / 3)];
    }

    // ---------- SKINS: full outfits (colours + a pattern on the shirt / pants) ----------
    // pat: { shirt: {k, c:[extra colours], n}, pants: {...} }   k = stripesV | stripesH | check | camo | grad | band
    // rarity: common / rare / epic / legendary.  col = the colours, pat = patterns on the shirt / pants,
    // shape = { shorts: where the legs turn into bare skin (0..1 down the body), coat: how far the shirt colour reaches down over the legs },
    // acc = things drawn on the character (helmet, goggles, backpack ...).  img = the artwork shown in the picker.
    const SKINS = [
        { id: "street",  name: "Streetwear Boy",    rar: "common",    price: 250,  note: "Black hoodie, cargo pants and fresh white sneakers.", img: "skin_02", col: { shirt: "#1e1e22", pants: "#35353b", shoes: "#e8e8e8", hair: null }, acc: [{ k: "hood", c: "#1e1e22" }] },
        { id: "weekend", name: "Weekend Outfit",    rar: "common",    price: 250,  note: "Graphic tee and light jeans for a day off.",          img: "skin_03", col: { shirt: "#efe6d0", pants: "#6f8fc0", shoes: "#d9783c", hair: null }, pat: { shirt: { k: "patch", c: ["#3a2a28", "#d9783c"] } } },
        { id: "varsity", name: "Varsity Student",   rar: "common",    price: 300,  note: "Red varsity jacket with a cream trim.",               img: "skin_04", col: { shirt: "#a8283a", pants: "#1f1f24", shoes: "#2b2b30", hair: null }, pat: { shirt: { k: "trim", c: ["#efe6d0"] } } },
        { id: "athlete", name: "Athlete",           rar: "common",    price: 300,  note: "Blue jersey and shorts for the track.",               img: "skin_05", col: { shirt: "#2a56c9", pants: "#2a56c9", shoes: "#e8eef8", hair: null }, shape: { shorts: 0.66 }, pat: { shirt: { k: "trim", c: ["#e8eef8"] } } },
        { id: "late",    name: "Late for Class",    rar: "rare",      price: 500,  note: "Uniform, tie and a backpack - running late!",         img: "skin_06", col: { shirt: null, pants: null, shoes: null, hair: null }, acc: [{ k: "pack", c: "#8a96aa" }] },
        { id: "grad",    name: "Graduate",          rar: "rare",      price: 600,  note: "Black gown and a graduation cap.",                    img: "skin_07", col: { shirt: "#17171c", pants: "#17171c", shoes: "#e4e4ea", hair: null }, shape: { coat: 0.8 }, acc: [{ k: "gradcap", c: "#17171c" }] },
        { id: "science", name: "Science Student",   rar: "rare",      price: 600,  note: "Lab coat, goggles and a head full of ideas.",         img: "skin_08", col: { shirt: "#eef0f2", pants: "#6c86ad", shoes: "#a8644c", hair: null }, shape: { coat: 0.74 }, acc: [{ k: "goggles", c: "#a8c8d8" }] },
        { id: "survivor",name: "The Survivor",      rar: "rare",      price: 650,  note: "Worn leather jacket and a heavy pack.",               img: "skin_09", col: { shirt: "#7a5236", pants: "#2e2b2a", shoes: "#6b4a34", hair: null }, acc: [{ k: "pack", c: "#5a3f2c" }] },
        { id: "urban",   name: "Urban Explorer",    rar: "rare",      price: 700,  note: "Tactical vest built for the city ruins.",             img: "skin_10", col: { shirt: "#3a4048", pants: "#4a4a44", shoes: "#2d2d30", hair: null }, pat: { shirt: { k: "vest", c: ["#23272d"] } }, acc: [{ k: "pack", c: "#33383f" }] },
        { id: "fire",    name: "Firefighter",       rar: "epic",      price: 1100, note: "Heat-proof suit with reflective stripes and a helmet.", img: "skin_11", col: { shirt: "#a8281f", pants: "#a8281f", shoes: "#d9a63a", hair: null }, pat: { shirt: { k: "reflect", c: ["#e0c040"], b: [[0.33, 0.36], [0.40, 0.43]] }, pants: { k: "reflect", c: ["#e0c040"], b: [[0.70, 0.73], [0.80, 0.83]] } }, acc: [{ k: "helmet", c: "#b02a22" }] },
        { id: "apoc",    name: "Apocalypse Survivor", rar: "epic",    price: 1100, note: "Tattered coat from the wasteland.",                   img: "skin_12", col: { shirt: "#6e6a5f", pants: "#2a2a2c", shoes: "#8a7a62", hair: null }, shape: { coat: 0.58 } },
        { id: "cyber",   name: "Cyber Runner",      rar: "epic",      price: 1400, note: "Neon-lined suit and a glowing visor.",                img: "skin_13", col: { shirt: "#14182a", pants: "#14182a", shoes: "#6a4ad0", hair: null }, pat: { shirt: { k: "neon", c: ["#35e0f0"] }, pants: { k: "neon", c: ["#35e0f0"] } }, acc: [{ k: "goggles", c: "#50d8f0", wide: 1 }] },
        { id: "samurai", name: "Samurai",           rar: "epic",      price: 1400, note: "Crimson kimono tied with a golden sash.",             img: "skin_14", col: { shirt: "#8a2a2a", pants: "#3a3030", shoes: "#8a6a4a", hair: null }, pat: { shirt: { k: "band", c: ["#d8b86a"], r: [0.42, 0.5] } }, shape: { coat: 0.66 } },
        { id: "hunter",  name: "Demon Hunter",      rar: "epic",      price: 1600, note: "Long black coat and a blood-red cape.",               img: "skin_15", col: { shirt: "#1c1c22", pants: "#1c1c22", shoes: "#5a2a2a", hair: null }, shape: { coat: 0.76 }, acc: [{ k: "cape", c: "#7a1f2a" }] },
        { id: "golden",  name: "Golden Legend",     rar: "legendary", price: 2500, note: "Shining golden armour fit for a champion.",           img: "skin_16", col: { shirt: "#e8d9a8", pants: "#e8d9a8", shoes: "#f4ecd0", hair: null }, pat: { shirt: { k: "grad", c: ["#d1a63a"] }, pants: { k: "grad", c: ["#d1a63a"] } } },
        { id: "summer",  name: "Summer in Panabo",  rar: "legendary", price: 2500, note: "Flowery shirt, shorts and slippers for the beach.",   img: "skin_17", col: { shirt: "#2a8a6a", pants: "#4a6a8a", shoes: "#b9805a", hair: null }, shape: { shorts: 0.64 }, pat: { shirt: { k: "floral", c: ["#e8803a", "#e8c040"] } } },
        { id: "dnsc",    name: "DNSC Student",      rar: "legendary", price: 2800, note: "The proud DNSC uniform with a blue backpack.",        img: "skin_18", col: { shirt: null, pants: "#1f2a4a", shoes: "#1fa3a0", hair: null }, acc: [{ k: "pack", c: "#2b3f78" }] },
        { id: "farm",    name: "Banana Farm Explorer", rar: "legendary", price: 3200, note: "Straw hat, red neckerchief and farm boots.",       img: "skin_19", col: { shirt: "#eeeadf", pants: "#5a6a3a", shoes: "#e8e2d0", hair: null }, acc: [{ k: "straw", c: "#c9a65a" }, { k: "scarf", c: "#b03a2a" }] },
        { id: "festival",name: "Festival Edition",  rar: "legendary", price: 3800, note: "Colourful festival costume for the big day.",         img: "skin_20", col: { shirt: "#2f8a8a", pants: "#8a4a2a", shoes: "#d8a068", hair: null }, pat: { shirt: { k: "festival", c: ["#e8803a", "#2f8a8a", "#b03a4a", "#e8c040"] }, pants: { k: "festival", c: ["#e8803a", "#2f8a8a", "#b03a4a", "#e8c040"] } } }
    ];
    const SK = {}; SKINS.forEach(function (k) { SK[k.id] = k; });
    let skinId = null;                                                    // the skin being worn (null = plain colours / original)
    const hexCache = {};
    function hx(h) { return hexCache[h] || (hexCache[h] = mute(hex(h))); }
    function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    // nx = 0..1 across the body, ny = 0..1 from the head to the feet; t = the plain colour; returns the colour for that pixel
    function skinPix(part, nx, ny, t) {
        const sk = skinId && SK[skinId], p = sk && sk.pat && sk.pat[part]; if (!p) return t;
        const c = p.c, n = p.n || 6;
        switch (p.k) {
            case "stripesV": return (Math.floor(nx * n) & 1) ? hx(c[0]) : t;
            case "stripesH": return (Math.floor(ny * n * 1.6) & 1) ? hx(c[0]) : t;
            case "check": return ((Math.floor(nx * n) + Math.floor(ny * n * 1.5)) & 1) ? hx(c[0]) : t;
            case "band": { const r = p.r || [0.255, 0.335]; return ny > r[0] && ny < r[1] ? hx(c[0]) : t; }
            case "trim": return ny > 0.43 && ny < 0.5 ? hx(c[0]) : t;
            case "patch": return nx > 0.28 && nx < 0.78 && ny > 0.27 && ny < 0.41 ? ((Math.floor(nx * 14) + Math.floor(ny * 24)) & 1 ? hx(c[1]) : hx(c[0])) : t;
            case "reflect": { for (let q = 0; q < p.b.length; q++) if (ny > p.b[q][0] && ny < p.b[q][1]) return hx(c[0]); return t; }
            case "vest": { const fy = (ny * 11) % 1, fx = (nx * 7) % 1; return fy < 0.16 || fx < 0.1 ? hx(c[0]) : t; }
            case "neon": { const fy = (ny * 9) % 1, fx = (nx * 5) % 1; return fy < 0.1 || (fx < 0.08 && ny < 0.5) ? hx(c[0]) : t; }
            case "floral": { const v = Math.sin(nx * 17 + ny * 5) * Math.sin(ny * 21 - nx * 4) + Math.sin(nx * 9 + ny * 13) * 0.6; return v > 0.62 ? hx(c[0]) : v < -0.72 ? hx(c[1]) : t; }
            case "festival": { const h = Math.sin(Math.floor(nx * 6) * 12.9 + Math.floor(ny * 9) * 78.2) * 43758.5453; const k = Math.floor((h - Math.floor(h)) * c.length); return hx(c[k]); }
            case "grad": { const a = part === "shirt" ? 0.14 : 0.5, b = part === "shirt" ? 0.5 : 0.92; return mix(t, hx(c[0]), Math.max(0, Math.min(1, (ny - a) / (b - a)))); }
            case "camo": { const v = Math.sin(nx * 14 + Math.sin(ny * 9) * 2.2) + Math.sin(ny * 17 + Math.cos(nx * 11) * 2) + Math.sin((nx + ny) * 8); return v > 0.7 ? hx(c[1]) : v < -0.8 ? hx(c[0]) : t; }
        }
        return t;
    }


    // ---------- skin shapes + accessories (shared by the in-game sheets and the menu character) ----------
    // frame geometry from the part labels (1 shirt, 2 pants, 3 shoes, 4 hair, 0 other) of one frame
    function frameGeo(d, L, W, ox, oy, fw, fh) {
        let hx0 = fw, hx1 = -1, hy0 = fh, hy1 = -1, tx0 = fw, tx1 = -1, ty0 = fh, ax0 = fw, ax1 = -1, ay0 = fh, ay1 = -1;
        for (let yy = 0; yy < fh; yy++) for (let xx = 0; xx < fw; xx++) {
            const p = (oy + yy) * W + ox + xx; if (d[p * 4 + 3] < 40) continue;
            if (xx < ax0) ax0 = xx; if (xx > ax1) ax1 = xx; if (yy < ay0) ay0 = yy; if (yy > ay1) ay1 = yy;
            if (L[p] === 4) { if (xx < hx0) hx0 = xx; if (xx > hx1) hx1 = xx; if (yy < hy0) hy0 = yy; if (yy > hy1) hy1 = yy; }
        }
        if (hx1 < 0 || ay1 <= ay0) return null;
        const bh = ay1 - ay0, headBottom = ay0 + bh * 0.2, waist = ay0 + bh * 0.5;
        let sxs = 0, sn = 0, fx0 = fw, fx1 = -1, ty1 = 0; const rmin = [], rmax = [];
        for (let yy = 0; yy < fh; yy++) for (let xx = 0; xx < fw; xx++) {
            const p = (oy + yy) * W + ox + xx, i = p * 4; if (d[i + 3] < 40) continue;
            if (L[p] === 1 && yy < waist) { if (xx < tx0) tx0 = xx; if (xx > tx1) tx1 = xx; if (yy < ty0) ty0 = yy; if (yy > ty1) ty1 = yy; rmin[yy] = rmin[yy] === undefined ? xx : Math.min(rmin[yy], xx); rmax[yy] = rmax[yy] === undefined ? xx : Math.max(rmax[yy], xx); }
            if (!L[p] && yy >= hy0 && yy <= headBottom && d[i] > d[i + 1] && d[i] > d[i + 2] * 1.25) { sxs += xx; sn++; if (xx < fx0) fx0 = xx; if (xx > fx1) fx1 = xx; }
        }
        const hcx = (hx0 + hx1) / 2, fd = sn ? (sxs / sn > hcx ? 1 : -1) : 1;
        if (tx1 < 0) { tx0 = ax0; tx1 = ax1; ty0 = ay0 + bh * 0.12; }
        else {                                                                  // the body's back / front edge: the middle value of every row (arms swinging out do not count)
            const mn = rmin.filter(function (v) { return v !== undefined; }).sort(function (a, b) { return a - b; }), mx = rmax.filter(function (v) { return v !== undefined; }).sort(function (a, b) { return a - b; });
            tx0 = mn[Math.floor(mn.length * 0.35)]; tx1 = mx[Math.floor(mx.length * 0.65)];
        }
        return { hx0: hx0, hx1: hx1, hy0: hy0, hy1: hy1, tx0: tx0, tx1: tx1, ty0: ty0, fx0: sn ? fx0 : hx0, fx1: sn ? fx1 : hx1, fd: fd, y0: ay0, bh: bh, bw: ax1 - ax0, hb: headBottom };
    }
    function drawAcc(d, W, ox, oy, fw, fh, g, list) {
        if (!g || !list) return;
        const fd = g.fd, hcx = (g.hx0 + g.hx1) / 2, hw = g.hx1 - g.hx0 + 1, hh = Math.max(6, g.hy1 - g.hy0 + 1), u = Math.max(1, Math.round(hh / 8));
        const put = function (x, y, c, behind) {
            x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= fw || y >= fh) return;
            const i = ((oy + y) * W + ox + x) * 4; if (behind && d[i + 3] > 40) return;
            d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
        };
        const rect = function (x0, y0, x1, y1, c, b) { for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) put(x, y, c, b); };
        const ell = function (cx, cy, rx, ry, c, b, top) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) { if (top && y > cy) break; for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const a = (x - cx) / rx, e = (y - cy) / ry; if (a * a + e * e <= 1) put(x, y, c, b); } } };
        const sh = function (c, f) { return [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f)]; };
        const back = fd > 0 ? g.tx0 : g.tx1, front = fd > 0 ? g.fx1 : g.fx0;
        list.forEach(function (a) {
            const c = hx(a.c), dk = sh(c, 0.62), lt = sh(c, 1.28);
            if (a.k === "helmet") {
                const by = g.hy0 + hh * 0.5;
                ell(hcx, by, hw * 0.62, hh * 0.85, c, false, true);
                rect(hcx - hw * 0.62 + (fd < 0 ? -2.5 * u : 0), by, hcx + hw * 0.62 + (fd > 0 ? 2.5 * u : 0), by + u * 1.6, dk);
                rect(hcx - hw * 0.34, by - hh * 0.72, hcx + hw * 0.16, by - hh * 0.72 + u * 0.8, lt);
                rect(hcx + fd * hw * 0.26 - u, by - hh * 0.38, hcx + fd * hw * 0.26 + u, by - hh * 0.38 + u * 1.2, hx("#e0c040"));
            } else if (a.k === "gradcap") {
                rect(hcx - hw * 0.84, g.hy0 - hh * 0.3, hcx + hw * 0.84, g.hy0 - hh * 0.3 + u * 1.4, c); rect(hcx - hw * 0.84, g.hy0 - hh * 0.3, hcx + hw * 0.84, g.hy0 - hh * 0.3 + u * 0.5, sh(c, 1.6));
                rect(hcx - hw * 0.46, g.hy0 - hh * 0.3 + u * 1.4, hcx + hw * 0.46, g.hy0 + hh * 0.42, c);
                const tx = hcx - fd * hw * 0.8; rect(tx, g.hy0 - hh * 0.2, tx + Math.max(0, u * 0.6), g.hy0 + hh * 0.7, hx("#d9b13a")); rect(tx - u * 0.5, g.hy0 + hh * 0.62, tx + u * 1.1, g.hy0 + hh * 0.85, hx("#d9b13a"));
            } else if (a.k === "straw") {
                ell(hcx, g.hy0 + hh * 0.42, hw * 0.5, hh * 0.9, c, false, true);
                rect(hcx - hw * 0.5, g.hy0 + hh * 0.28, hcx + hw * 0.5, g.hy0 + hh * 0.28 + u * 1.2, hx("#7a5a2a"));
                ell(hcx + fd * u, g.hy0 + hh * 0.52, hw * 1.0, hh * 0.3, sh(c, 0.92)); ell(hcx + fd * u, g.hy0 + hh * 0.46, hw * 0.96, hh * 0.18, lt);
            } else if (a.k === "goggles") {
                const ey = g.hy0 + (g.hb - g.hy0) * 0.66, wid = (a.wide ? 7 : 3.8) * u, hh2 = (a.wide ? 2.2 : 2.6) * u, bk = fd > 0 ? g.hx0 : g.hx1;
                rect(Math.min(bk, front), ey - u * 0.5, Math.max(bk, front), ey + u * 0.5, hx("#2a2a30"));
                const lx0 = fd > 0 ? front - wid + u * 0.8 : front - u * 0.8, lx1 = lx0 + wid;
                rect(lx0 - 1, ey - hh2 / 2 - 1, lx1 + 1, ey + hh2 / 2 + 1, hx("#2a2a30")); rect(lx0, ey - hh2 / 2, lx1, ey + hh2 / 2, c); rect(lx0, ey - hh2 / 2, lx0 + u, ey - hh2 / 2 + u * 0.8, sh(c, 1.5));
            } else if (a.k === "hood") {
                ell(hcx - fd * hw * 0.3, g.hb - u * 0.5, hw * 0.52, hh * 0.5, c, true); ell(hcx - fd * hw * 0.35, g.hb + u * 2, hw * 0.5, hh * 0.4, dk, true);
            } else if (a.k === "pack") {
                const w = Math.max(3, Math.round(g.bw * 0.17)), y0 = g.ty0 + g.bh * 0.01, y1 = g.ty0 + g.bh * 0.30, o = -fd;
                const bk = back - o * 3;                                              // starts a little inside the body so it looks strapped on
                rect(Math.min(bk, back + o * w), y0, Math.max(bk, back + o * w), y1, c, true);
                rect(Math.min(bk, back + o * w), y0, Math.max(bk, back + o * w), y0 + 1, lt, true);
                rect(Math.min(bk, back + o * w * 0.9), y1 - (y1 - y0) * 0.35, Math.max(bk, back + o * w * 0.9), y1 - 1, dk, true);
            } else if (a.k === "cape") {
                const y1 = g.y0 + g.bh * 0.8, o = -fd;
                for (let y = Math.floor(g.ty0); y <= y1; y++) { const t = (y - g.ty0) / (y1 - g.ty0), w = 2 * u + t * g.bw * 0.22 + Math.sin(y * 0.9) * 0.8; const bk = back - o * 3; rect(Math.min(bk, back + o * w), y, Math.max(bk, back + o * w), y, t > 0.7 ? dk : c, true); }
            } else if (a.k === "scarf") {
                const cx = fd > 0 ? g.tx1 - u * 2.5 : g.tx0 + u * 2.5; rect(cx - u * 2.2, g.ty0 - u * 0.8, cx + u * 2.2, g.ty0 + u * 1.2, c); rect(cx - u * 2.2, g.ty0 + u * 1.2, cx - u * 0.6, g.ty0 + u * 3.2, dk);
            }
        });
    }
    // where the legs turn into bare skin (shorts) / how far the coat reaches over the legs: re-sorts the pants pixels of one frame
    function applyShape(L, W, ox, oy, fw, fh, g, shape) {
        if (!shape || !g) return;
        for (let yy = 0; yy < fh; yy++) for (let xx = 0; xx < fw; xx++) {
            const p = (oy + yy) * W + ox + xx; if (L[p] !== 2) continue; const ny = (yy - g.y0) / g.bh;
            if (shape.coat && ny < shape.coat) L[p] = 7; else if (shape.shorts && ny > shape.shorts) L[p] = 6;
        }
    }

    function readSave() {
        try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") || {}; } catch (e) { return {}; }
    }
    function load() {
        const c = readSave().colors || {};
        Object.keys(colors).forEach(function (k) { colors[k] = typeof c[k] === "string" ? c[k] : null; });
        const sv = readSave().skin; skinId = null; /* skins removed from customization */
    }
    function persist() {
        try {
            const s = readSave();
            s.colors = Object.assign({}, colors); s.skin = skinId;
            localStorage.setItem(SAVE_KEY, JSON.stringify(s));
        } catch (e) { /* storage unavailable */ }
    }
    load();

    // ---------- load the images and build the recoloured sheet ----------
    let srcData = null, maskData = null, sheet = null, ready = false, waiting = [];
    const W = D.cols * D.fw, H = Math.ceil(D.n / D.cols) * D.fh;

    function loadImg(src) {
        return new Promise(function (res) { const i = new Image(); i.onload = function () { res(i); }; i.src = src; });
    }
    Promise.all([loadImg(D.atlas), loadImg(D.mask)]).then(function (im) {
        const c = document.createElement("canvas"); c.width = W; c.height = H;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(im[0], 0, 0); srcData = x.getImageData(0, 0, W, H);
        x.clearRect(0, 0, W, H); x.drawImage(im[1], 0, 0); maskData = x.getImageData(0, 0, W, H);
        sheet = document.createElement("canvas"); sheet.width = W; sheet.height = H;
        ready = true; recolor();
        waiting.forEach(function (f) { f(); }); waiting = [];
    });

    function recolor() {
        if (!ready) return;
        const s = srcData.data, m = maskData.data, out = new ImageData(W, H), o = out.data;
        // average brightness of each original part, so shading is kept
        const sum = [0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0];
        for (let i = 0; i < s.length; i += 4) {
            const k = m[i]; if (!k || s[i + 3] < 60) continue;
            sum[k] += 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]; cnt[k]++;
        }
        const ref = sum.map(function (v, k) { return cnt[k] ? v / cnt[k] : 1; });
        const tg = [null];
        ["shirt", "pants", "shoes", "hair"].forEach(function (p) { tg[PART_ID[p]] = colors[p] ? mute(hex(colors[p])) : null; });
        const sk = skinId && SK[skinId] && SK[skinId].pat ? SK[skinId].pat : null, bbs = sk ? frameBoxes() : null, cols = D.cols;
        for (let i = 0; i < s.length; i += 4) {
            const k = m[i]; let t = k ? tg[k] : null;
            if (t && s[i + 3] > 0) {
                const lum = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2];
                const f = Math.max(0.3, Math.min(1.7, lum / ref[k]));
                if (sk && (k === 1 || k === 2)) { const px = (i >> 2) % W, py = Math.floor((i >> 2) / W), fr = Math.floor(py / D.fh) * cols + Math.floor(px / D.fw), bb = bbs[fr]; if (bb) t = skinPix(k === 1 ? "shirt" : "pants", Math.max(0, Math.min(1, (px % D.fw - bb[0]) / bb[2])), Math.max(0, Math.min(1, (py % D.fh - bb[1]) / bb[3])), t); }
                o[i] = Math.min(255, t[0] * f); o[i + 1] = Math.min(255, t[1] * f); o[i + 2] = Math.min(255, t[2] * f);
            } else { o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; }
            o[i + 3] = s[i + 3];
        }
        sheet.getContext("2d").putImageData(out, 0, 0);
        views.forEach(function (v) { v.draw(); });
    }


    // ---------- paints the saved outfit / skin onto the in-game GIF sheets (Endless + Monster Survival) ----------
    // 1) every pixel is sorted into shirt / pants / shoes / hair, 2) stray pixels are cleaned up (no coloured outlines, eyes stay eyes),
    // 3) each part is recoloured while keeping the artist's own shading, 4) skin patterns follow the body.
    // ---------- skin artwork -> game frames: every frame of the player sheet is refilled with the skin picture, fitted row by row to that frame's pose ----------
    const ART = {};
    function artGet(id, cb) {
        const k = SK[id] && SK[id].img; if (!k) return null;
        let r = ART[k]; if (r) { if (r.ready) return r; if (cb) r.cbs.push(cb); return null; }
        r = ART[k] = { ready: false, cbs: cb ? [cb] : [] };
        const im = new Image();
        im.onload = function () {
            const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
            const x = cv.getContext("2d", { willReadFrequently: true }); x.translate(cv.width, 0); x.scale(-1, 1); x.drawImage(im, 0, 0);   // the sheets face left, the pictures face right
            const d = x.getImageData(0, 0, cv.width, cv.height), W = cv.width, H = cv.height, mn = [], mx = [];
            let y0 = H, y1 = 0;
            for (let y = 0; y < H; y++) { let a = W, b = -1; for (let xx = 0; xx < W; xx++) if (d.data[(y * W + xx) * 4 + 3] > 40) { if (xx < a) a = xx; if (xx > b) b = xx; } mn.push(a); mx.push(b); if (b >= 0) { if (y < y0) y0 = y; y1 = y; } }
            const cen = function (lo, hi) { let sum = 0, n = 0; for (let y = y0 + Math.floor((y1 - y0) * lo); y <= y0 + Math.floor((y1 - y0) * hi); y++) if (mx[y] >= 0) { sum += (mn[y] + mx[y]) / 2; n++; } return n ? sum / n : W / 2; };
            let aw = 0; for (let y = y0; y <= y1; y++) if (mx[y] >= 0) aw = Math.max(aw, mx[y] - mn[y] + 1);
            let ax0 = W, ax1 = 0; for (let y = y0; y <= y1; y++) if (mx[y] >= 0) { if (mn[y] < ax0) ax0 = mn[y]; if (mx[y] > ax1) ax1 = mx[y]; } r.ax0 = ax0; r.ax1 = ax1;
            r.cu = cen(0.05, 0.45); r.cl = cen(0.6, 0.95); r.aw = aw;
            r.d = d.data; r.W = W; r.H = H; r.mn = mn; r.mx = mx; r.y0 = y0; r.y1 = y1; r.ready = true;
            r.cbs.forEach(function (f) { f(); });
        };
        im.onerror = function () { r.cbs = []; };
        im.src = (window.RUNMIL_SKINART && window.RUNMIL_SKINART[k]) || ("visuals/skins/" + k + ".png");
        return null;
    }
    function smooth(arr, n) { const o = arr.slice(); for (let i = 0; i < arr.length; i++) { let s = 0, c = 0; for (let j = -n; j <= n; j++) { const v = arr[i + j]; if (v !== undefined && v >= 0) { s += v; c++; } } o[i] = c ? s / c : -1; } return o; }
    function artSheet(im, a, art) {
        const cv = document.createElement("canvas"), W = cv.width = im.naturalWidth || im.width, H = cv.height = im.naturalHeight || im.height;
        const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(im, 0, 0);
        const id = cx.getImageData(0, 0, W, H), d = id.data, o = new Uint8ClampedArray(d.length);
        const ah = art.y1 - art.y0 + 1, amn = smooth(art.mn, 2), amx = smooth(art.mx, 2);
        for (let fr = 0; fr < a.n; fr++) {
            const ox = (fr % a.cols) * a.fw, oy = Math.floor(fr / a.cols) * a.fh;
            let y0 = a.fh, y1 = -1; const mn = [], mx = [];
            for (let yy = 0; yy < a.fh; yy++) { let lo = a.fw, hi = -1; for (let xx = 0; xx < a.fw; xx++) if (d[((oy + yy) * W + ox + xx) * 4 + 3] > 40) { if (xx < lo) lo = xx; if (xx > hi) hi = xx; } mn.push(lo > hi ? -1 : lo); mx.push(hi); if (hi >= 0) { if (yy < y0) y0 = yy; y1 = yy; } }
            if (y1 < 0) continue;
            const bh = y1 - y0 + 1; let sc = bh / ah, scx = sc;
            let bx0 = a.fw, bx1 = 0; for (let yy = y0; yy <= y1; yy++) if (mn[yy] >= 0) { if (mn[yy] < bx0) bx0 = mn[yy]; if (mx[yy] > bx1) bx1 = mx[yy]; }
            const ratio = (bx1 - bx0 + 1) / bh; if (ratio > 0.6) scx = sc * Math.min(1.35, 1 + (ratio - 0.55) * 1.2);       // a crouch / slide is drawn wider
            if (art.aw * scx > a.fw * 0.94) scx = a.fw * 0.94 / art.aw;                        // never wider than the frame
            // two rigid pieces (upper body, legs): each is moved to where that part of the pose is, so the run still swings without wobbling the picture
            function seg(lo, hi) { let sum = 0, n = 0; for (let yy = y0 + Math.floor(bh * lo); yy <= y0 + Math.floor(bh * hi) && yy <= y1; yy++) if (mn[yy] >= 0) { sum += (mn[yy] + mx[yy]) / 2; n++; } return n ? sum / n : null; }
            const bu = seg(0.05, 0.45), bl = seg(0.6, 0.95), bm = seg(0, 1) || a.fw / 2, cu0 = bu === null ? bm : bu, cl0 = bl === null ? bm : bl;
            let bUp = bm + (cu0 - bm) * 0.55, bLo = bm + (cl0 - bm) * 0.55;
            { const ac0 = (art.cu + art.cl) / 2, bc0 = (bUp + bLo) / 2, L = bc0 - (ac0 - art.ax0) * scx, R = bc0 + (art.ax1 - ac0) * scx; let sh = 0; if (R > a.fw - 1) sh = a.fw - 1 - R; if (L + sh < 0) sh = -L; bUp += sh; bLo += sh; }
            for (let yy = Math.max(0, y0 - 4); yy < a.fh; yy++) {
                const ay = Math.round(art.y1 - (y1 - yy + 0.5) / sc); if (ay < 0 || ay >= art.H) continue;
                const v = (ay - art.y0) / ah, k = Math.min(1, Math.max(0, (v - 0.45) / 0.15)), bc = bUp + (bLo - bUp) * k, ac = art.cu + (art.cl - art.cu) * k;
                for (let xx = 0; xx < a.fw; xx++) {
                    const axp = Math.round(ac + (xx - bc) / scx); if (axp < 0 || axp >= art.W) continue;
                    const q = (ay * art.W + axp) * 4; if (art.d[q + 3] < 90) continue;
                    const pi = ((oy + yy) * W + ox + xx) * 4;
                    o[pi] = art.d[q]; o[pi + 1] = art.d[q + 1]; o[pi + 2] = art.d[q + 2]; o[pi + 3] = 255;
                }
            }
        }
        cx.putImageData(new ImageData(o, W, H), 0, 0);
        return cv;
    }
    function paintSheet(im, a) {
        if (skinId && SK[skinId] && SK[skinId].img && SK[skinId].img !== "skin_01" && a && a.n) {
            const sid = skinId, art = artGet(sid, function () { if (skinId === sid) try { a.img = artSheet(im, a, ART[SK[sid].img]); } catch (e) { /* keep plain */ } });
            if (art) { try { return artSheet(im, a, art); } catch (e) { /* fall through */ } }
        }
        return paintSheet0(im, a);
    }
    function paintSheet0(im, a) {
        const col = colors, SKN = skinId && SK[skinId];
        if (!col.shirt && !col.pants && !col.hair && !col.shoes && !SKN) return im;
        const T = [null, col.shirt && mute(hex(col.shirt)), col.pants && mute(hex(col.pants)), col.shoes && mute(hex(col.shoes)), col.hair && mute(hex(col.hair))];
        const cv = document.createElement("canvas"); cv.width = im.naturalWidth || im.width; cv.height = im.naturalHeight || im.height;
        const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(im, 0, 0);
        const id = cx.getImageData(0, 0, cv.width, cv.height), d = id.data, W = cv.width, H = cv.height;
        const L = new Uint8Array(W * H), sk = skinId && SK[skinId] && SK[skinId].pat ? skinId : null;
        const box = [], geos = [];
        for (let fr = 0; fr < a.n; fr++) {
            const ox = (fr % a.cols) * a.fw, oy = Math.floor(fr / a.cols) * a.fh;
            let y0 = a.fh, y1 = 0, x0 = a.fw, x1 = 0;
            for (let yy = 0; yy < a.fh; yy++) for (let xx = 0; xx < a.fw; xx += 2) if (d[((oy + yy) * W + ox + xx) * 4 + 3] > 40) { if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; }
            const bh = Math.max(1, y1 - y0), headY = y0 + bh * 0.2, feetY = y1 - bh * 0.09, shirtY = y0 + bh * 0.11, waistY = y0 + bh * (a.waist || 0.5);
            box.push([x0, y0, Math.max(1, x1 - x0), bh]);
            // pass 1: sort the pixels
            for (let yy = 0; yy < a.fh; yy++) for (let xx = 0; xx < a.fw; xx++) {
                const p = (oy + yy) * W + ox + xx, i = p * 4; if (d[i + 3] < 40) continue;
                const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, sat = mx ? (mx - mn) / mx : 0;
                if (v > 0.55 && sat < 0.42 && yy > shirtY) L[p] = 1;
                else if (v < 0.5) {
                    if (yy < headY) L[p] = 5;                                              // dark on the head: hair candidate (cleaned below)
                    else if (yy > feetY) L[p] = 3;
                    else if (yy > waistY || (yy > waistY - bh * 0.1 && b > r + 6 && b >= g - 4)) L[p] = 2;                           // pants: dark pixels from the waist down (outlines higher up stay dark)
                }
            }
            // only the biggest connected piece of pants is kept (hand / arm outlines near the hip are not pants)
            (function () {
                const seen = new Uint8Array(a.fw * a.fh), comps = [];
                for (let yy = 0; yy < a.fh; yy++) for (let xx = 0; xx < a.fw; xx++) {
                    const li = yy * a.fw + xx; if (seen[li] || L[(oy + yy) * W + ox + xx] !== 2) continue;
                    const comp = [], st = [xx, yy]; seen[li] = 1;
                    while (st.length) {
                        const y = st.pop(), x = st.pop(); comp.push((oy + y) * W + ox + x);
                        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= a.fw || ny >= a.fh) continue; const q = ny * a.fw + nx; if (!seen[q] && L[(oy + ny) * W + ox + nx] === 2) { seen[q] = 1; st.push(nx, ny); } }
                    }
                    comps.push(comp);
                }
                let big = -1, bs = 0; comps.forEach(function (c, k) { if (c.length > bs) { bs = c.length; big = k; } });
                comps.forEach(function (c, k) { if (k !== big && c.length < bs * 0.12) c.forEach(function (q) { L[q] = 0; }); });
            })();
            // hair = dark head pixels connected to the top of the head (eyes, brows and mouth are separate islands, so they keep their colour)
            const stack = [], top = y0 + bh * 0.09;
            for (let yy = 0; yy < a.fh; yy++) for (let xx = 0; xx < a.fw; xx++) { const p = (oy + yy) * W + ox + xx; if (L[p] === 5 && yy < top) { L[p] = 4; stack.push(p, xx, yy); } }
            while (stack.length) {
                const yy = stack.pop(), xx = stack.pop(); stack.pop();
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    const nx = xx + dx, ny = yy + dy; if (nx < 0 || ny < 0 || nx >= a.fw || ny >= a.fh) continue;
                    const q = (oy + ny) * W + ox + nx; if (L[q] === 5 && ny < y0 + bh * 0.155) { L[q] = 4; stack.push(q, nx, ny); }
                }
            }
            for (let yy = 0; yy < a.fh; yy++) for (let xx = 0; xx < a.fw; xx++) { const p = (oy + yy) * W + ox + xx; if (L[p] === 5) L[p] = 0; }
            // the lavender shade / light edge of the shirt: bluish, bright pixels touching the shirt belong to it too
            for (let it = 0; it < 3; it++) {
                const add = [];
                for (let yy = Math.max(1, Math.floor(shirtY)); yy < a.fh - 1; yy++) for (let xx = 1; xx < a.fw - 1; xx++) {
                    const p = (oy + yy) * W + ox + xx, i = p * 4; if (L[p] || d[i + 3] < 40) continue;
                    const r = d[i], g = d[i + 1], b = d[i + 2]; if (b < r * 0.85 || 0.299 * r + 0.587 * g + 0.114 * b < 70) continue;     // skin is orange (red > blue): leave it
                    let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (L[p + dy * W + dx] === 1) n++;
                    if (n >= 2) add.push(p);
                }
                for (let k = 0; k < add.length; k++) L[add[k]] = 1;
            }
            // pass 2: clean up stray / outline pixels (a pixel whose opaque neighbours mostly belong to another part joins that part)
            for (let it = 0; it < 2; it++) {
                const ch = [];
                for (let yy = 1; yy < a.fh - 1; yy++) for (let xx = 1; xx < a.fw - 1; xx++) {
                    const p = (oy + yy) * W + ox + xx; if (d[p * 4 + 3] < 40 || L[p] === 4) continue;
                    const cnt = [0, 0, 0, 0, 0]; let tot = 0;
                    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dy && !dx) continue; const q = p + dy * W + dx; if (d[q * 4 + 3] >= 40) { cnt[L[q]]++; tot++; } }
                    let best = 0; for (let k = 1; k < 5; k++) if (cnt[k] > cnt[best]) best = k;
                    if (best && best !== L[p] && cnt[best] >= Math.max(3, tot * 0.6) && (L[p] || best !== 4)) ch.push(p, best);
                }
                for (let k = 0; k < ch.length; k += 2) L[ch[k]] = ch[k + 1];
            }
            const g = SKN ? frameGeo(d, L, W, ox, oy, a.fw, a.fh) : null; geos.push(g);
            if (SKN && SKN.shape) applyShape(L, W, ox, oy, a.fw, a.fh, g, SKN.shape);
        }
        // average brightness of each part, so the original shading (folds, highlights, shadows) is kept
        const sum = [0, 0, 0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0, 0, 0];
        let sr = 0, sg = 0, sb = 0, sc = 0;                                                   // average skin tone (for shorts)
        for (let p = 0; p < W * H; p++) { const i = p * 4; if (!L[p] && d[i + 3] > 200 && d[i] > d[i + 1] * 1.05 && d[i] > d[i + 2] * 1.35) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; sc++; } }
        T[6] = sc ? [sr / sc, sg / sc, sb / sc] : [200, 125, 85]; T[7] = T[1];
        for (let p = 0; p < W * H; p++) { const k = L[p]; if (k) { const i = p * 4; sum[k] += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; cnt[k]++; } }
        const ref = sum.map(function (v, k) { return cnt[k] ? v / cnt[k] : 1; });
        for (let p = 0; p < W * H; p++) {
            const k = L[p]; let t = k ? T[k] : null; if (!t) continue;
            const i = p * 4, lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            let f = k >= 6 ? Math.max(0.7, Math.min(1.2, lum / ref[k])) : Math.max(0.4, Math.min(1.6, lum / ref[k]));
            if (sk && (k === 1 || k === 2)) {
                const px = p % W, py = (p - px) / W, fr = Math.floor(py / a.fh) * a.cols + Math.floor(px / a.fw), bb = box[fr];
                if (bb) t = skinPix(k === 1 ? "shirt" : "pants", Math.max(0, Math.min(1, ((px % a.fw) - bb[0]) / bb[2])), Math.max(0, Math.min(1, ((py % a.fh) - bb[1]) / bb[3])), t);
            }
            const lift = f > 1 ? (f - 1) * 22 * (1 - (0.299 * t[0] + 0.587 * t[1] + 0.114 * t[2]) / 255) : 0;      // dark colours (black, navy) still show their highlights
            const cool = f < 1 ? 1 - f : 0;                                                          // shadows lean a little cool, like the rest of the art
            d[i] = Math.min(255, t[0] * f * (1 - cool * 0.10) + lift); d[i + 1] = Math.min(255, t[1] * f + lift); d[i + 2] = Math.min(255, t[2] * f * (1 + cool * 0.14) + lift);
        }
        if (SKN && SKN.acc) for (let fr = 0; fr < a.n; fr++) drawAcc(d, W, (fr % a.cols) * a.fw, Math.floor(fr / a.cols) * a.fh, a.fw, a.fh, geos[fr], SKN.acc);
        cx.putImageData(id, 0, 0); return cv;
    }

    let fboxes = null;
    function frameBoxes() {                                                  // [x0, y0, width, height] of the body in every frame (patterns follow the body)
        if (fboxes) return fboxes; fboxes = [];
        const s = srcData.data;
        for (let fr = 0; fr < D.n; fr++) {
            const ox = (fr % D.cols) * D.fw, oy = Math.floor(fr / D.cols) * D.fh; let x0 = D.fw, x1 = 0, y0 = D.fh, y1 = 0;
            for (let yy = 0; yy < D.fh; yy += 2) for (let xx = 0; xx < D.fw; xx += 2) if (s[((oy + yy) * W + ox + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
            fboxes.push(x1 > x0 ? [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)] : null);
        }
        return fboxes;
    }

    // ---------- drawing ----------
    function frameAt(t) {   // t in ms -> frame index
        const total = D.dur.reduce(function (a, b) { return a + b; }, 0);
        t = t % total;
        for (let i = 0; i < D.n; i++) { if (t < D.dur[i]) return i; t -= D.dur[i]; }
        return 0;
    }
    function drawFrame(ctx, i, x, y, h, flip) {   // x = centre, y = feet, h = height in px
        if (!ready) return;
        const w = h * D.fw / D.fh, sx = (i % D.cols) * D.fw, sy = Math.floor(i / D.cols) * D.fh;
        ctx.save();
        if (flip) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
        ctx.drawImage(sheet, sx, sy, D.fw, D.fh, x - w / 2, y - h, w, h);
        ctx.restore();
    }

    // animated canvas views (hero in the menu, avatar in the profile box)
    const views = [];
    function view(canvas, opts) {
        opts = opts || {};
        const ctx = canvas.getContext("2d");
        const v = {
            frame: 0,
            draw: function () {
                if (!ready) return;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (opts.avatar) {            // zoom on the head, following it as it bobs
                    const hd = D.head[v.frame], size = D.fh * 0.27;
                    const sx = (v.frame % D.cols) * D.fw + hd[0] - size * 0.5 + size * 0.12;
                    const sy = Math.floor(v.frame / D.cols) * D.fh + hd[1] - size * 0.42;
                    ctx.drawImage(sheet, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
                } else {
                    drawFrame(ctx, v.frame, canvas.width / 2, canvas.height, canvas.height);
                }
            }
        };
        views.push(v);
        if (opts.static) { v.frame = opts.frame || 0; }
        return v;
    }
    let startT = performance.now(), running = false;
    function loop(now) {
        if (!document.hidden) {
            const f = frameAt(now - startT);
            views.forEach(function (v) { if (!v.static && v.frame !== f) { v.frame = f; v.draw(); } });
        }
        requestAnimationFrame(loop);
    }
    function start() { if (!running) { running = true; requestAnimationFrame(loop); } }
    start();

    const listeners = [];
    function notify() { listeners.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); }

    window.RunMilCharacter = {
        onChange: function (f) { listeners.push(f); },
        OPTIONS: OPTIONS, data: D,
        ready: function (f) { if (ready) f(); else waiting.push(f); },
        getColors: function () { return Object.assign({}, colors); },
        setColor: function (part, hexv) { colors[part] = hexv; skinId = null; persist(); recolor(); notify(); },
        reset: function () { colors = { shirt: null, pants: null, shoes: null, hair: null }; skinId = null; persist(); recolor(); notify(); },
        // skins
        SKINS: SKINS, skin: function (id) { return SK[id] || null; }, skinId: function () { return skinId; },
        savedSkin: function () { const v = readSave().skin; return typeof v === "string" && SK[v] ? v : null; },
        setSkin: function (id) { if (!SK[id]) { colors = { shirt: null, pants: null, shoes: null, hair: null }; skinId = null; } else { colors = Object.assign({}, SK[id].col); skinId = id; } persist(); recolor(); notify(); },
        trySkin: function (id) { if (!SK[id]) { colors = { shirt: null, pants: null, shoes: null, hair: null }; skinId = null; } else { colors = Object.assign({}, SK[id].col); skinId = id; } recolor(); notify(); },   // preview only
        skinPix: skinPix, paintSheet: paintSheet, mute: mute, frameGeo: frameGeo, drawAcc: drawAcc,
        skinHeadLift: function () { const k = skinId && SK[skinId]; return k && k.acc && k.acc.some(function (a) { return a.k === "helmet" || a.k === "gradcap" || a.k === "straw"; }) ? 0.13 : 0; },
        skinIcon: function (cv, id) {      // a little shirt + pants picture wearing the skin (for the picker)
            const g = cv.getContext("2d"), w = cv.width, h = cv.height, k = SK[id], old = skinId; g.clearRect(0, 0, w, h);
            const col = k ? k.col : { shirt: "#f4efe2", pants: "#1c2340" }; skinId = id;
            const draw = function (part, x0, y0, x1, y1, shape) {
                for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
                    if (!shape(x, y)) continue;
                    const ny = part === "shirt" ? 0.14 + (y - y0) / (y1 - y0) * 0.36 : 0.5 + (y - y0) / (y1 - y0) * 0.42, nx = (x - w * 0.18) / (w * 0.64);
                    const c = k ? skinPix(part, nx, ny, hex(col[part])) : hex(col[part]), sh = 0.82 + 0.18 * Math.sin((x - x0) / (x1 - x0) * 3.14);
                    g.fillStyle = "rgb(" + (c[0] * sh | 0) + "," + (c[1] * sh | 0) + "," + (c[2] * sh | 0) + ")"; g.fillRect(x, y, 1, 1);
                }
            };
            const cx = w / 2, sw = w * 0.32;
            draw("shirt", 0, Math.floor(h * 0.08), w, Math.floor(h * 0.52), function (x, y) { const yy = (y - h * 0.08) / (h * 0.44); return yy < 0.28 ? (x > w * 0.06 && x < w * 0.94) : (Math.abs(x - cx) < sw || (yy < 0.5 && Math.abs(x - cx) < sw + w * 0.16 * (0.5 - yy) * 2 + 0)) ; });
            draw("pants", 0, Math.floor(h * 0.52), w, Math.floor(h * 0.94), function (x, y) { const yy = (y - h * 0.52) / (h * 0.42); return Math.abs(x - cx) < sw && (yy < 0.18 || Math.abs(x - cx) > w * 0.025); });
            skinId = old;
        },
        reload: function () { load(); recolor(); notify(); },
        saved: function () { const c = readSave().colors || {}, o = {}; Object.keys(colors).forEach(function (k) { o[k] = typeof c[k] === "string" ? c[k] : null; }); return o; },
        tryColor: function (part, hexv) { colors[part] = hexv; skinId = null; recolor(); notify(); },   // preview only, not saved
        view: view, removeView: function (v) { const i = views.indexOf(v); if (i >= 0) views.splice(i, 1); }, drawFrame: drawFrame, frameAt: frameAt, frames: D.n,
        sheetReady: function () { return ready; }
    };
})();
