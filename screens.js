/* =========================================================
   MENU SCREENS (layout follows the UI collage):
   Player Profile, Character Customization,
   Equipment Shop, Achievements, Daily Missions, Settings, Location Map.
   Plugs into script.js through RunMilMenu.on(...).
========================================================= */
(function () {
    "use strict";
    const M = window.RunMilMenu, P = M.player, C = window.RunMilCharacter, HERO = window.RunMilHero;
    const KEY = "runmil_save";

    // ---- extra save data kept in the same save ----
    function raw() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
    const s0 = raw();
    const today = new Date().toISOString().slice(0, 10);   // same (UTC) day rule as script.js / game.js
    const ex = {
        items: Object.assign({ owned: [], equipped: { head: null, body: null, feet: null, gadget: null } }, s0.items || {}),
        settings: Object.assign({ musicVol: 70, sfxVol: 80, music: true, sfx: true, fullscreen: true, simple: true }, s0.settings || {}),
        ach: Object.assign({ claimed: {} }, s0.ach || {}),
        totals: Object.assign({ runs: 0, distance: 0, coins: 0, monsters: 0, jumps: 0, punches: 0, kicks: 0, ducks: 0, near: 0, weapons: 0, gems: 0, pieces: 0, revives: 0, nights: 0, combo: 0, bestKills: 0, bestCoins: 0, maxDay: 0 }, s0.totals || {}),
        dm: s0.dm && s0.dm.day === today ? Object.assign({ dist: 0, kills: 0, claimed: {}, bonus: false }, s0.dm) : { day: today, dist: 0, kills: 0, claimed: {}, bonus: false },
        cust: Object.assign({ owned: {} }, s0.cust || {}),
        visited: Object.assign({ park: 1 }, s0.visited || {}),
        collect: Object.assign({ have: {}, claimed: {} }, s0.collect || {}),
        locStats: Object.assign({}, s0.locStats || {}),
        name: typeof s0.name === "string" && s0.name ? s0.name : "Player"
    };
    // Power-ups were removed from the Endless shop (they return with Monster Survival): refund anything already bought
    (function () {
        const OLD = { helmet: [400], band: [250], vest: [600], shield: [900], speedb: [700], springb: [700], magnet: [1100], jetpack: [40, "gems"], medkit: [30, "gems"] };
        const P0 = window.RunMilMenu.player; let back = 0;
        if (!ex.items.ammo) { ex.items.ammo = {}; ex.items.owned.forEach(function (id) { const pk = { pencil: 12, ruler: 8, laser: 4, blast: 5 }[id]; if (pk) ex.items.ammo[id] = pk; }); back++; }   // weapons you already own start with a full pack
        ex.items.owned = ex.items.owned.filter(function (id) { const o = OLD[id]; if (!o) return true; if (o[1] === "gems") P0.gems += o[0]; else P0.coins += o[0]; back++; return false; });
        Object.keys(ex.items.equipped).forEach(function (k) { if (OLD[ex.items.equipped[k]]) ex.items.equipped[k] = null; });
        if (back) { window.RunMilMenu.save(); const o = raw(); o.items = ex.items; localStorage.setItem(KEY, JSON.stringify(o)); }   // saved at once, so the refund can never repeat
    })();
    ["hair", "shirt", "pants", "shoes", "skins"].forEach(function (p) { if (!Array.isArray(ex.cust.owned[p])) ex.cust.owned[p] = []; });

    // the game runs in a frame on top of this page: after a run, pull its results (totals, daily progress, places) into the menu
    M.reloadExtra = function () {
        const s = raw();
        Object.assign(ex.totals, { runs: 0, distance: 0, coins: 0, monsters: 0, jumps: 0, punches: 0, kicks: 0, ducks: 0, near: 0, weapons: 0, gems: 0, pieces: 0, revives: 0, nights: 0, combo: 0, bestKills: 0, bestCoins: 0, maxDay: 0 }, s.totals || {});
        ex.dm = s.dm && s.dm.day === today ? Object.assign({ dist: 0, kills: 0, claimed: {}, bonus: false }, s.dm) : { day: today, dist: 0, kills: 0, claimed: {}, bonus: false };
        Object.assign(ex.visited, s.visited || {});
        ex.collect = Object.assign({ have: {}, claimed: {} }, s.collect || {});
        ex.locStats = Object.assign({}, s.locStats || {});
        ex.items.ammo = Object.assign({}, (s.items || {}).ammo || {});
        badge();
    };

    function saveAll() {
        M.save();
        const o = raw(); Object.assign(o, ex); localStorage.setItem(KEY, JSON.stringify(o));
        M.refresh(); badge();
    }

    // ---- game data ----
    const ITEMS = [
        { id: "pencil", name: "Pencil Dart", slot: "wpn_pencil", pack: 12, cost: 300, ic: "\u270F\uFE0F", desc: "Throws a sharp pencil at the nearest monster. Pack of 12." },
        { id: "ruler", name: "Ruler Blade", slot: "wpn_ruler", pack: 8, cost: 500, ic: "\uD83D\uDCCF", desc: "A spinning ruler that slices through every monster in its path. Pack of 8." },
        { id: "laser", name: "Laser Gun", slot: "wpn_laser", pack: 4, cost: 1400, ic: "\uD83D\uDD2B", desc: "Fires a wide beam that clears everything ahead. Pack of 4." },
        { id: "blast", name: "Blast Cannon", slot: "wpn_blast", pack: 5, cost: 45, cur: "gems", ic: "\uD83D\uDCA5", desc: "An explosive shot that wipes out monsters around the impact. Pack of 5." }
    ];
    const SLOTS = { head: "HEAD", body: "BODY", feet: "FEET", gadget: "GADGET" };
    const fmt = (n) => Number(n).toLocaleString("en-US");
    const T = ex.totals;
    const MEDALS = [
        { id: "r1", n: "First Run Complete", d: "Finish your first run.", ic: "\uD83C\uDFC6", v: () => T.runs, g: 1, r: 50 },
        { id: "r10", n: "Regular", d: "Finish 10 runs.", ic: "\uD83C\uDFC3", v: () => T.runs, g: 10, r: 150 },
        { id: "r50", n: "Marathoner", d: "Finish 50 runs.", ic: "\uD83C\uDFC5", v: () => T.runs, g: 50, r: 500 },
        { id: "d500", n: "Warm Up", d: "Run 500 m in total.", ic: "\uD83D\uDD25", v: () => T.distance, g: 500, r: 100 },
        { id: "d5k", n: "Road Runner", d: "Run 5,000 m in total.", ic: "\uD83D\uDCCD", v: () => T.distance, g: 5000, r: 400 },
        { id: "b1k", n: "Distance Runner", d: "Reach 1,000 m in one run.", ic: "\uD83E\uDDED", v: () => P.stats.bestDistance, g: 1000, r: 300 },
        { id: "c100", n: "Coin Collector", d: "Collect 100 coins.", ic: "\uD83E\uDE99", v: () => T.coins, g: 100, r: 100 },
        { id: "c1k", n: "Coin Hoarder", d: "Collect 1,000 coins.", ic: "\uD83D\uDCB0", v: () => T.coins, g: 1000, r: 400 },
        { id: "m10", n: "Monster Bait", d: "Defeat 10 monsters.", ic: "\uD83D\uDC7E", v: () => T.monsters, g: 10, r: 150 },
        { id: "m100", n: "Monster Hunter", d: "Defeat 100 monsters.", ic: "\u2694\uFE0F", v: () => T.monsters, g: 100, r: 600 },
        { id: "s2k", n: "High Scorer", d: "Score 2,000 in one run.", ic: "\u2B50", v: () => P.stats.bestScore, g: 2000, r: 300 },
        { id: "lv5", n: "Rising Star", d: "Reach level 5.", ic: "\uD83C\uDF1F", v: () => P.level, g: 5, r: 400 },
    ];

    // ---- more achievements: every way of playing counts (moves, combos, close calls, nights, collecting, ...) ----
    // [id, name, description, icon, value, goal, coin reward, gem reward]
    const tv = (k) => () => T[k] | 0;
    const dyes = () => Object.keys(ex.cust.owned).reduce((n, k) => n + (Array.isArray(ex.cust.owned[k]) ? ex.cust.owned[k].length : 0), 0);
    [
        ["r100", "Century Club", "Finish 100 runs.", "\uD83D\uDCAF", tv("runs"), 100, 1000, 20],
        ["r250", "Never Stops", "Finish 250 runs.", "\u267E\uFE0F", tv("runs"), 250, 2500, 50],
        ["d25k", "Cross-Country", "Run 25,000 m in total.", "\uD83D\uDE80", tv("distance"), 25000, 900],
        ["d100k", "Around Mindanao", "Run 100,000 m in total.", "\uD83C\uDF0F", tv("distance"), 100000, 3000, 40],
        ["b2k", "Two Thousand Club", "Reach 2,000 m in one run.", "\uD83C\uDFD4\uFE0F", () => P.stats.bestDistance, 2000, 600],
        ["b4k", "Endless Legend", "Reach 4,000 m in one run.", "\uD83C\uDF0C", () => P.stats.bestDistance, 4000, 1500, 30],
        ["c5k", "Coin Tycoon", "Collect 5,000 coins in total.", "\uD83E\uDD11", tv("coins"), 5000, 800],
        ["c20k", "Coin Dragon", "Collect 20,000 coins in total.", "\uD83D\uDC09", tv("coins"), 20000, 2500, 40],
        ["bc50", "Gold Rush", "Collect 50 coins in one run.", "\uD83E\uDDF2", tv("bestCoins"), 50, 200],
        ["bc150", "Pot of Gold", "Collect 150 coins in one run.", "\uD83C\uDF08", tv("bestCoins"), 150, 600],
        ["m500", "Monster Slayer", "Defeat 500 monsters.", "\uD83D\uDDE1\uFE0F", tv("monsters"), 500, 1000],
        ["m2000", "Nightmare Reaper", "Defeat 2,000 monsters.", "\uD83D\uDC80", tv("monsters"), 2000, 3000, 40],
        ["bk10", "Monster Mash", "Defeat 10 monsters in one run.", "\uD83C\uDF83", tv("bestKills"), 10, 250],
        ["bk25", "Rampage", "Defeat 25 monsters in one run.", "\uD83D\uDD25", tv("bestKills"), 25, 700],
        ["bk50", "Unstoppable Force", "Defeat 50 monsters in one run.", "\uD83C\uDF0B", tv("bestKills"), 50, 1500, 25],
        ["s5k", "Score Chaser", "Score 5,000 in one run.", "\uD83C\uDFAF", () => P.stats.bestScore, 5000, 500],
        ["s10k", "Score Master", "Score 10,000 in one run.", "\uD83C\uDF96\uFE0F", () => P.stats.bestScore, 10000, 1200, 20],
        ["s25k", "Score Legend", "Score 25,000 in one run.", "\uD83D\uDC51", () => P.stats.bestScore, 25000, 3000, 50],
        ["lv10", "Veteran", "Reach level 10.", "\uD83D\uDEE1\uFE0F", () => P.level, 10, 800],
        ["lv20", "Hero of Panabo", "Reach level 20.", "\uD83E\uDDB8", () => P.level, 20, 2500, 40],
        ["j100", "Jumping Jack", "Jump 100 times.", "\uD83E\uDD98", tv("jumps"), 100, 150],
        ["j1k", "Pogo Master", "Jump 1,000 times.", "\uD83E\uDE80", tv("jumps"), 1000, 500],
        ["j5k", "Moon Boots", "Jump 5,000 times.", "\uD83C\uDF19", tv("jumps"), 5000, 1500, 20],
        ["p100", "Iron Fist", "Throw 100 punches.", "\uD83D\uDC4A", tv("punches"), 100, 200],
        ["p1k", "Knockout King", "Throw 1,000 punches.", "\uD83E\uDD4A", tv("punches"), 1000, 800],
        ["k100", "Kick Starter", "Throw 100 kicks.", "\uD83E\uDDB5", tv("kicks"), 100, 200],
        ["k1k", "Dragon Kick", "Throw 1,000 kicks.", "\uD83D\uDC32", tv("kicks"), 1000, 800],
        ["du100", "Limbo Champion", "Duck 100 times.", "\uD83E\uDDCE", tv("ducks"), 100, 200],
        ["du500", "Low Rider", "Duck 500 times.", "\uD83D\uDEF9", tv("ducks"), 500, 700],
        ["cb3", "Combo Starter", "Chain a x3 combo (defeat monsters back-to-back).", "\u26A1", tv("combo"), 3, 150],
        ["cb5", "Combo Master", "Chain a x5 combo.", "\uD83D\uDD17", tv("combo"), 5, 400],
        ["cb8", "Combo Fiend", "Chain a x8 combo.", "\uD83D\uDCA5", tv("combo"), 8, 900, 15],
        ["cb12", "Unbreakable Chain", "Chain a x12 combo.", "\u26D3\uFE0F", tv("combo"), 12, 2000, 30],
        ["nr10", "Daredevil", "Make 10 close calls (pass a hazard by a hair).", "\uD83D\uDE2C", tv("near"), 10, 200],
        ["nr100", "Nerves of Steel", "Make 100 close calls.", "\uD83E\uDDCA", tv("near"), 100, 700],
        ["nr500", "Matrix Mode", "Make 500 close calls.", "\uD83D\uDD76\uFE0F", tv("near"), 500, 2000, 30],
        ["g10", "Gem Finder", "Pick up 10 gems on the road.", "\uD83D\uDC8E", tv("gems"), 10, 200],
        ["g50", "Gem Hunter", "Pick up 50 gems on the road.", "\uD83D\uDCA0", tv("gems"), 50, 700, 10],
        ["g200", "Crystal Baron", "Pick up 200 gems on the road.", "\uD83D\uDD2E", tv("gems"), 200, 2000, 30],
        ["pc10", "Curious Collector", "Find 10 collection pieces.", "\uD83E\uDDFA", tv("pieces"), 10, 250],
        ["pc50", "Pack Rat", "Find 50 collection pieces.", "\uD83D\uDC00", tv("pieces"), 50, 900, 15],
        ["pc150", "Museum Curator", "Find 150 collection pieces.", "\uD83C\uDFDB\uFE0F", tv("pieces"), 150, 2500, 30],
        ["st1", "Bookworm", "Claim your first Collection Book set.", "\uD83D\uDCD6", () => Object.keys(ex.collect.claimed).filter((k) => ex.collect.claimed[k]).length, 1, 300],
        ["st5", "Completionist", "Claim all 5 Collection Book sets.", "\uD83E\uDDE9", () => Object.keys(ex.collect.claimed).filter((k) => ex.collect.claimed[k]).length, 5, 2500, 50],
        ["w10", "Armed & Ready", "Fire your weapons 10 times.", "\uD83D\uDD2B", tv("weapons"), 10, 200],
        ["w50", "Arsenal", "Fire your weapons 50 times.", "\uD83D\uDCA3", tv("weapons"), 50, 700],
        ["w200", "Walking Armory", "Fire your weapons 200 times.", "\uD83D\uDE80", tv("weapons"), 200, 1800, 25],
        ["own4", "Weapon Collector", "Own all 4 weapons.", "\uD83E\uDDF0", () => ex.items.owned.length, 4, 600],
        ["rv1", "Second Wind", "Save yourself with gems once.", "\uD83D\uDC96", tv("revives"), 1, 150],
        ["rv10", "Phoenix", "Save yourself 10 times.", "\uD83D\uDD4A\uFE0F", tv("revives"), 10, 800, 10],
        ["n5", "Night Walker", "Survive 5 nights until sunrise.", "\uD83C\uDF19", tv("nights"), 5, 400],
        ["n25", "Moonlight Marathon", "Survive 25 nights until sunrise.", "\uD83E\uDD89", tv("nights"), 25, 1500, 20],
        ["dy5", "Sun Chaser", "Reach Day 5 in one run.", "\u2600\uFE0F", tv("maxDay"), 5, 600],
        ["dy10", "Time Traveler", "Reach Day 10 in one run.", "\u23F3", tv("maxDay"), 10, 2000, 30],
        ["pt10", "Warm-Up Time", "Play for 10 minutes.", "\u23F1\uFE0F", () => Math.floor((P.stats.playSeconds | 0) / 60), 10, 150],
        ["pt60", "Dedicated", "Play for 1 hour.", "\u231B", () => Math.floor((P.stats.playSeconds | 0) / 60), 60, 700],
        ["pt300", "Born to Run", "Play for 5 hours.", "\uD83C\uDFC3", () => Math.floor((P.stats.playSeconds | 0) / 60), 300, 2500, 30],
        ["dye3", "Fresh Look", "Unlock 3 outfit dyes.", "\uD83C\uDFA8", dyes, 3, 300],
        ["dye10", "Fashionista", "Unlock 10 outfit dyes.", "\uD83E\uDDE5", dyes, 10, 900, 10]
    ].forEach(function (a) { MEDALS.push({ id: a[0], n: a[1], d: a[2], ic: a[3], v: a[4], g: a[5], r: a[6], gem: a[7] || 0 }); });
    // ---- achievements of each location (progress is counted from runs played in that place) ----
    const LS = (id) => Object.assign({ runs: 0, dist: 0, score: 0, kills: 0, coins: 0, pieces: 0, day: 0 }, ex.locStats[id] || {});
    const LOC_ACH = {
        park: [["Park Stroller", "Finish 3 runs at Panabo City Park.", "\uD83C\uDF33", "runs", 3, 100], ["Around the Monument", "Run 600 m in one run here.", "\uD83D\uDDFF", "dist", 600, 150], ["Plaza Defender", "Defeat 25 monsters here.", "\uD83D\uDC80", "kills", 25, 200], ["Park Champion", "Score 1,500 in one run here.", "\u2B50", "score", 1500, 250], ["Park Night Owl", "Reach Day 3 here.", "\uD83C\uDF19", "day", 3, 300]],
        dnsc: [["Campus Newbie", "Finish 3 runs at DNSC Campus.", "\uD83C\uDF93", "runs", 3, 120], ["Dean's Lister", "Run 800 m in one run here.", "\uD83D\uDCDA", "dist", 800, 200], ["Ghost of the Library", "Defeat 30 monsters here.", "\uD83D\uDC7B", "kills", 30, 250], ["Honor Roll", "Score 2,500 in one run here.", "\uD83C\uDFC5", "score", 2500, 300], ["Scholarship Fund", "Collect 150 coins here.", "\uD83E\uDE99", "coins", 150, 300]],
        mangrove: [["Mangrove Walker", "Finish 3 runs at the Mangrove Forest.", "\uD83C\uDF3F", "runs", 3, 150], ["Boardwalk Sprint", "Run 1,000 m in one run here.", "\uD83E\uDD86", "dist", 1000, 250], ["Swamp Slayer", "Defeat 40 monsters here.", "\uD83D\uDC0A", "kills", 40, 300], ["Forest Treasure", "Collect 6 collection pieces here.", "\uD83D\uDC9A", "pieces", 6, 350], ["Tide Master", "Reach Day 4 here.", "\uD83C\uDF0A", "day", 4, 400]],
        seawall: [["Seawall Jogger", "Finish 3 runs at Panabo Seawall.", "\uD83C\uDF05", "runs", 3, 180], ["Sea Breeze Dash", "Run 1,200 m in one run here.", "\uD83D\uDCA8", "dist", 1200, 300], ["Harbor Guard", "Defeat 50 monsters here.", "\u2693", "kills", 50, 350], ["Sunset Score", "Score 4,000 in one run here.", "\uD83C\uDFC6", "score", 4000, 400], ["Seawall Legend", "Collect 400 coins here.", "\uD83D\uDC51", "coins", 400, 500]]
    };
    // harder goals for every place
    LOC_ACH.park.push(["Park Regular", "Finish 10 runs at Panabo City Park.", "\uD83E\uDE91", "runs", 10, 300], ["Marathon Loop", "Run 1,500 m in one run here.", "\uD83C\uDFC3", "dist", 1500, 400], ["Monster Mash Park", "Defeat 100 monsters here.", "\uD83C\uDF83", "kills", 100, 500], ["Park Legend", "Score 5,000 in one run here.", "\uD83C\uDFC6", "score", 5000, 600], ["Pocket Full of Pesos", "Collect 300 coins here.", "\uD83E\uDE99", "coins", 300, 400], ["Park Collector", "Collect 5 collection pieces here.", "\uD83E\uDDFA", "pieces", 5, 350]);
    LOC_ACH.dnsc.push(["Campus Regular", "Finish 10 runs at DNSC Campus.", "\uD83C\uDFEB", "runs", 10, 350], ["Cum Laude", "Run 1,600 m in one run here.", "\uD83C\uDF93", "dist", 1600, 450], ["Exam Week Survivor", "Defeat 120 monsters here.", "\uD83D\uDCDD", "kills", 120, 550], ["Valedictorian", "Score 6,000 in one run here.", "\uD83E\uDD47", "score", 6000, 650], ["Book Fair", "Collect 8 collection pieces here.", "\uD83D\uDCDA", "pieces", 8, 450], ["Late-Night Study", "Reach Day 4 here.", "\uD83D\uDD6F\uFE0F", "day", 4, 450]);
    LOC_ACH.mangrove.push(["Mangrove Regular", "Finish 10 runs at the Mangrove Forest.", "\uD83C\uDF34", "runs", 10, 400], ["Root Runner", "Run 2,000 m in one run here.", "\uD83C\uDF31", "dist", 2000, 500], ["Swamp King", "Defeat 150 monsters here.", "\uD83D\uDC38", "kills", 150, 600], ["Canopy Score", "Score 7,000 in one run here.", "\uD83C\uDF43", "score", 7000, 700], ["Mud Gold", "Collect 500 coins here.", "\uD83E\uDE99", "coins", 500, 500], ["Deep Roots", "Reach Day 6 here.", "\uD83C\uDF33", "day", 6, 600]);
    LOC_ACH.seawall.push(["Seawall Regular", "Finish 10 runs at Panabo Seawall.", "\uD83C\uDF05", "runs", 10, 450], ["Pier Pressure", "Run 2,400 m in one run here.", "\uD83C\uDF0A", "dist", 2400, 600], ["Kraken Hunter", "Defeat 200 monsters here.", "\uD83E\uDD91", "kills", 200, 700], ["Lighthouse Score", "Score 9,000 in one run here.", "\uD83D\uDDFC", "score", 9000, 800], ["Treasure Chest", "Collect 12 collection pieces here.", "\uD83D\uDC1A", "pieces", 12, 600], ["Sunset Gold", "Collect 1,000 coins here.", "\uD83D\uDCB0", "coins", 1000, 800]);
    const LOC_NAME = { park: "Panabo City Park", dnsc: "DNSC Campus", mangrove: "Mangrove Forest", seawall: "Panabo Seawall" };
    Object.keys(LOC_ACH).forEach(function (loc) {
        LOC_ACH[loc].forEach(function (a, i) { MEDALS.push({ id: "L_" + loc + "_" + i, n: a[0], d: a[1], ic: a[2], v: () => LS(loc)[a[3]], g: a[4], r: a[5], where: loc }); });
    });
    const LOCS = [
        { id: "park", n: "Panabo City Park", img: "visuals/images/loc-park.png" },
        { id: "dnsc", n: "DNSC Campus", img: "visuals/images/loc-dnsc.png" },
        { id: "mangrove", n: "Mangrove Forest", img: "visuals/images/loc-mangroves.png" },
        { id: "seawall", n: "Panabo Seawall", img: "visuals/images/loc-seawall.png" }
    ];
    const CN = { "#ffffff": "White", "#e63946": "Red", "#ff9a1a": "Orange", "#ffd24a": "Yellow", "#3ddc84": "Green", "#2fa4ff": "Sky Blue", "#8a5cff": "Purple", "#ff6fb5": "Pink", "#222831": "Charcoal",
        "#1c2340": "Navy", "#4a5568": "Slate", "#2f6fdd": "Blue", "#6b4226": "Brown", "#2e7d4f": "Forest", "#8a1c2b": "Maroon", "#d8cfa8": "Khaki", "#2a1d1d": "Dark Brown",
        "#2b1a14": "Espresso", "#000000": "Black", "#c99a4a": "Blonde", "#f2f2f2": "Silver" };

    // ---- overlay ----
    const ov = document.createElement("div");
    ov.id = "screen"; ov.className = "x hidden"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    ov.innerHTML = '<div class="x-in" id="x-in"></div><div class="x-toast" id="x-toast" role="status"></div>';
    document.getElementById("main-menu").appendChild(ov);
    const box = ov.querySelector("#x-in"), toastEl = ov.querySelector("#x-toast");
    let current = null, view = null, toastT = 0;
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const coin = '<img src="visuals/images/icon-coin.png" alt="">', gem = '<img src="visuals/images/icon-gem.png" alt="">';
    const priceTag = (n, cur) => '<span class="x-price">' + (cur === "gems" ? gem : coin) + fmt(n) + "</span>";

    function say(t) {
        toastEl.textContent = t; toastEl.classList.add("on");
        clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 1600);
    }
    function dropView() { if (view) { view.destroy(); view = null; } }
    function open(name) {
        dropView(); box.innerHTML = ""; cu.sel = null; cu.tab = cu.tab || "avatar"; cuHero = HERO.selected();
        if (name === "customize") { cu.sel = cu.tab === "avatar" || cu.tab === "skin" ? null : C.saved()[cu.tab]; cu.sk = C.savedSkin(); }
        current = name; editName = false; wipeAsk = false;
        ov.classList.remove("hidden"); render();
        const b = box.querySelector(".x-back"); if (b) b.focus({ preventScroll: true });
        document.dispatchEvent(new CustomEvent("runmil:screen", { detail: name }));
    }
    function close() {
        dropView(); C.reload();          // drops any un-equipped try-on colour
        ov.classList.add("hidden"); box.innerHTML = ""; current = null;
        M.refresh();
    }
    function head(title) {
        return '<div class="x-head"><button class="x-back" data-a="close" aria-label="Back">&#10094;</button><h2 class="x-title">' + title + "</h2>" +
            '<div class="x-cur"><span>' + coin + fmt(P.coins) + "</span><span>" + gem + fmt(P.gems) + "</span></div></div>";
    }
    function render() {
        dropView();
        const f = R[current]; if (!f) return;
        const old = box.querySelector(".x-body"), top = old ? old.scrollTop : 0;
        box.innerHTML = f();
        const nb = box.querySelector(".x-body"); if (nb) nb.scrollTop = top;
        if (current === "customize" && cu.tab !== "skin") view = HERO.view(document.getElementById("prev-cv"), { id: cuHero });
        if (current === "customize" && cu.tab === "skin") {                       // the skin's artwork, big
            const cv = document.getElementById("prev-cv"), k = C.skin(cu.sk), im = new Image();
            im.onload = function () {
                const g = cv.getContext("2d"), s = Math.min(cv.width * 0.92 / im.width, cv.height * 0.88 / im.height); g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
                g.drawImage(im, (cv.width - im.width * s) / 2, cv.height * 0.93 - im.height * s, im.width * s, im.height * s);
            };
            im.src = "visuals/skins/" + (k ? k.img : "skin_01") + ".png";
        }
        
        if (current === "profile") view = HERO.view(document.getElementById("pf-cv"), { head: true });
        if (editName) { const i = document.getElementById("name-in"); if (i) { i.focus(); i.select(); } }
    }

    // =====================  CHARACTER CUSTOMIZATION  =====================
    const PARTS = [["avatar", "AVATAR"], ["hair", "HAIR"], ["shirt", "SHIRT"], ["pants", "PANTS"], ["shoes", "SHOES"]];
    const PART_WORD = { hair: "Hair", shirt: "Shirt", pants: "Pants", shoes: "Shoes" };
    const cu = { tab: "avatar", sel: null, sk: null };        // sk = the skin shown in the SKINS tab (null = original)
    let cuHero = 1;                                                   // character shown in the preview (equipped only on EQUIP)
    const cuList = (p) => [null].concat(C.OPTIONS[p]);
    const cuPrice = (i) => i < 3 ? 0 : 100 + (i - 3) * 50;           // original + first two colours are free
    const cuOwned = (p, i) => cuPrice(i) === 0 || ex.cust.owned[p].indexOf(cuList(p)[i]) >= 0 || C.saved()[p] === cuList(p)[i];   // anything already worn stays owned
    const skOwned = (k) => !k || ex.cust.owned.skins.indexOf(k.id) >= 0 || C.savedSkin() === k.id;
    const skPlain = () => Object.keys(C.saved()).every((q) => !C.saved()[q]);
    function rCustom() {
        const p = cu.tab, isAv = p === "avatar", isSk = p === "skin";
        const tabs = PARTS.map((t) => '<button class="x-tab' + (t[0] === p ? " on" : "") + '" data-a="tab" data-t="' + t[0] + '" role="tab" aria-selected="' + (t[0] === p) + '">' + t[1] + "</button>").join("");
        let tiles, title, sub, right, eq, canEquip, tcls = "x-tiles", art = "", rar = "";
        if (isAv) {
            const cur = HERO.selected();
            tcls += " av"; eq = cuHero === cur; canEquip = !eq;
            tiles = HERO.list.map((h) => '<button class="x-tile av' + (h.id === cuHero ? " sel" : "") + '" data-a="pickav" data-i="' + h.id + '" aria-label="Avatar ' + h.id + '"><img src="' + h.avatar + '" alt="">' + (h.id === cur ? '<b class="ok">&#10003;</b>' : "") + "</button>").join("");
            title = "Avatar " + cuHero; sub = "Sets your profile picture and the menu character."; right = eq ? '<span class="x-own">In use</span>' : "";
        } else if (isSk) {
            const cur = C.skin(cu.sk), sv = C.savedSkin(), owned = skOwned(cur);
            eq = cur ? sv === cur.id : (!sv && skPlain()); canEquip = owned && !eq; tcls += " sk";
            tiles = [null].concat(C.SKINS).map(function (k) {
                const id = k ? k.id : "", isEq = k ? sv === k.id : (!sv && skPlain());
                return '<button class="x-tile sk r-' + (k ? k.rar : "common") + ((cu.sk || "") === id ? " sel" : "") + '" data-a="pickskin" data-id="' + id + '" aria-label="' + esc(k ? k.name : "School Uniform") + '"><img src="visuals/skins/' + (k ? k.img : "skin_01") + '.png" alt=""><em>' + esc(k ? k.name : "School Uniform") + "</em>" +
                    (isEq ? '<b class="ok">&#10003;</b>' : !skOwned(k) ? "<b>" + k.price + "</b>" : "") + "</button>";
            }).join("");
            title = cur ? cur.name : "School Uniform"; sub = (cur ? cur.note : "Your starting outfit - clears all dyes.") + (cur && !owned ? " Buy it to wear it." : "");
            art = '<img class="sk-art r-' + (cur ? cur.rar : "common") + '" src="visuals/skins/' + (cur ? cur.img : "skin_01") + '.png" alt="">'; rar = cur ? cur.rar.toUpperCase() : "COMMON";
            right = owned ? '<span class="x-own">' + (cur ? "Owned" : "Free") + "</span>" : priceTag(cur.price) + '<button class="x-btn gold" data-a="cubuy">BUY</button>';
        } else {
            const list = cuList(p), saved = C.saved()[p] || null;
            let si = list.indexOf(cu.sel); if (si < 0) si = 0;
            const price = cuPrice(si), owned = cuOwned(p, si);
            eq = saved === (list[si] || null); canEquip = owned && !eq;
            tiles = list.map(function (c, i) {
                const o = cuOwned(p, i), isEq = saved === (c || null);
                return '<button class="x-tile' + (i === si ? " sel" : "") + '" data-a="pick" data-i="' + i + '" aria-label="' + esc(cuName(p, c)) + '">' +
                    (c ? '<i style="background:' + c + '"></i>' : "&#8635;") + (isEq ? '<b class="ok">&#10003;</b>' : !o ? "<b>" + cuPrice(i) + "</b>" : "") + "</button>";
            }).join("");
            title = cuName(p, list[si]); sub = si === 0 ? "Your starting look." : owned ? "Ready to wear." : "Buy this dye to wear it.";
            right = owned ? '<span class="x-own">Owned</span>' : priceTag(price) + '<button class="x-btn gold" data-a="cubuy">BUY</button>';
        }
        return head("CHARACTER CUSTOMIZATION") + '<div class="x-body"><div class="cu">' +
            '<div class="x-pnl cu-prev"><button class="x-arr l" data-a="cunav" data-d="-1" aria-label="Previous">&#10094;</button><canvas id="prev-cv" width="520" height="630" role="img" aria-label="Character preview"></canvas><button class="x-arr r" data-a="cunav" data-d="1" aria-label="Next">&#10095;</button></div>' +
            '<div class="x-pnl cu-side"><div class="x-tabs" role="tablist">' + tabs + '</div><div class="' + tcls + '">' + tiles + "</div>" +
            '<div class="cu-info">' + art + '<div><h3 class="x-h">' + esc(title) + (rar ? ' <small class="rar r-' + rar.toLowerCase() + '">' + rar + "</small>" : "") + '</h3><p class="x-sub">' + sub + "</p></div><div>" + right + "</div></div></div>" +
            "</div></div>" + '<div class="x-foot"><button class="x-btn gold big" data-a="cuequip"' + (canEquip ? "" : " disabled") + ">" + (eq ? "EQUIPPED" : "EQUIP") + "</button></div>";
    }
    function cuName(p, c) { return c ? (CN[c] || "Custom") + " " + PART_WORD[p] : "Original " + PART_WORD[p]; }
    function skPick(id) { cu.sk = id || null; C.reload(); C.trySkin(cu.sk); render(); }
    function cuPick(i) { const l = cuList(cu.tab); cu.sel = l[(i + l.length) % l.length]; C.reload(); C.tryColor(cu.tab, cu.sel); render(); }

    // =====================  COLLECTION BOOK  =====================
    const CO = window.RUNMIL_COLLECT || { items: {}, sets: [] };
    const setDone = (st) => st.items.every((id) => (ex.collect.have[id] || 0) > 0);
    function rColl() {
        const have = ex.collect.have, total = CO.sets.length, got = CO.sets.filter((st) => ex.collect.claimed[st.id]).length;
        const cards = CO.sets.map(function (st) {
            const n = st.items.filter((id) => have[id]).length, done = setDone(st), cl = !!ex.collect.claimed[st.id];
            const places = st.locs.map((l) => (LOCS.find((x) => x.id === l) || { n: l }).n).join(" / ");
            const slots = st.items.map(function (id) {
                const it = CO.items[id] || { n: id, ic: "?" }, c = have[id] || 0;
                return '<div class="cl-slot' + (c ? "" : " miss") + '"><span class="ic">' + it.ic + "</span><small>" + esc(it.n) + "</small>" + (c > 1 ? "<b>x" + c + "</b>" : "") + "</div>";
            }).join("");
            const btn = cl ? '<span class="x-ok">CLAIMED &#10003;</span>' : done ? '<button class="x-btn gold" data-a="cclaim" data-id="' + st.id + '">CLAIM REWARD</button>' : '<div class="x-bar green"><div style="width:' + (n / st.items.length * 100) + '%"></div><span>' + n + " / " + st.items.length + "</span></div>";
            return '<div class="x-pnl cl-set' + (cl ? " done" : "") + '"><div class="cl-head"><span class="big">' + st.ic + "</span><div><h3>" + esc(st.n) + '</h3><p class="cl-rw">' + esc(st.reward.label) + "</p></div></div>" +
                '<div class="cl-slots">' + slots + '</div><p class="cl-where">Found at: ' + esc(places) + "</p>" + btn + "</div>";
        }).join("");
        return head("COLLECTION BOOK") + '<div class="x-body"><div class="x-pnl x-sum"><div class="x-h">&#128214; ' + got + " / " + total + ' Sets</div><p class="x-sub">Pick up glowing pieces while you run. Finish a set to unlock a place or an outfit!</p></div><div class="cl-grid">' + cards + "</div></div>";
    }

    // =====================  EQUIPMENT SHOP  =====================
    let shopSel = ITEMS[0].id;
    function rShop() {
        const sel = ITEMS.find((i) => i.id === shopSel) || ITEMS[0];
        const cards = ITEMS.map(function (it) {
            const n = (ex.items.ammo || {})[it.id] | 0, eq = n > 0;
            const btn = '<span class="x-stock' + (n ? "" : " out") + '">' + (n ? "In stock: " + n : "OUT OF STOCK") + "</span>" + priceTag(it.cost, it.cur) + '<button class="x-btn gold" data-a="buyi" data-id="' + it.id + '">' + (n ? "BUY +" + it.pack : "BUY " + it.pack) + "</button>";
            return '<div class="x-card' + (eq ? " eq" : "") + (it.id === sel.id ? " sel" : "") + '" data-a="ssel" data-id="' + it.id + '"><span class="x-tag">' + (SLOTS[it.slot] || "WEAPON") + '</span><div class="x-ico">' + it.ic + "</div><h3>" + it.name + "</h3>" + btn + "</div>";
        }).join("");
        return head("EQUIPMENT SHOP") + '<div class="x-body"><div class="x-grid shop">' + cards + "</div></div>" +
            '<div class="x-pnl x-desc"><div class="x-ico">' + sel.ic + '</div><div><h3 class="x-h">' + sel.name + '</h3><p class="x-sub">' + sel.desc + "</p></div></div>";
    }

    // =====================  ACHIEVEMENTS  =====================
    const medalDone = (m) => m.v() >= m.g;
    function readyCount() { return MEDALS.filter((m) => medalDone(m) && !ex.ach.claimed[m.id]).length + CO.sets.filter((st) => setDone(st) && !ex.collect.claimed[st.id]).length; }
    function badge() { const b = document.getElementById("ach-badge"); if (b) b.hidden = readyCount() === 0; }
    let acTab = "all";
    function rAch() {
        const list = MEDALS.filter((m) => acTab === "all" ? !m.where : m.where === acTab);
        const n = list.filter(medalDone).length;
        const tabs = [["all", "GENERAL"]].concat(Object.keys(LOC_NAME).map((k) => [k, LOC_NAME[k].toUpperCase()])).map(function (t) {
            const rdy = MEDALS.filter((m) => (t[0] === "all" ? !m.where : m.where === t[0]) && medalDone(m) && !ex.ach.claimed[m.id]).length;
            return '<button class="x-tab' + (acTab === t[0] ? " on" : "") + '" data-a="actab" data-id="' + t[0] + '">' + t[1] + (rdy ? " &#9679;" : "") + "</button>";
        }).join("");
        const note = acTab !== "all" && !P.unlocked[acTab] ? '<p class="x-sub">Unlock this place in the Collection Book to start these achievements.</p>' : "";
        return head("ACHIEVEMENTS") + '<div class="x-body"><div class="x-tabs">' + tabs + '</div><div class="x-pnl x-sum"><div class="x-h">&#127942; ' + n + " / " + list.length + ' Unlocked</div><div class="x-bar"><div style="width:' + (n / Math.max(1, list.length) * 100) + '%"></div></div>' + note + "</div>" +
            '<div class="x-grid ach">' + list.map(function (m) {
                const v = Math.min(m.v(), m.g), done = medalDone(m), cl = ex.ach.claimed[m.id];
                const g2 = m.gem ? " + " + m.gem + " gems" : "", lab = "CLAIM +" + m.r + g2, rew = "Reward +" + m.r + " coins" + g2;
                const b = cl ? '<span class="x-ok">CLAIMED</span>' : done ? '<button class="x-btn gold" data-a="claim" data-id="' + m.id + '">' + lab + "</button>" : '<span class="x-ok dim">' + rew + "</span>";
                return '<div class="x-card ac' + (cl ? " eq" : "") + (done ? "" : " lockd") + '"><div class="x-ico">' + m.ic + '</div><div class="mid"><h3>' + m.n + '</h3><p class="x-sub">' + m.d + '</p></div><div class="x-bar green"><div style="width:' + (v / m.g * 100) + '%"></div><span>' + fmt(v) + " / " + fmt(m.g) + "</span></div>" + b + "</div>";
            }).join("") + "</div></div>";
    }

    // =====================  DAILY MISSIONS  =====================
    function missions() {
        const m = P.mission;
        return [
            { id: "coins", n: "Collect " + m.goal + " Coins", ic: "\uD83E\uDE99", v: m.progress, g: m.goal, r: m.reward, c: !!m.claimed },
            { id: "dist", n: "Travel 500 Meters", ic: "\uD83D\uDC5F", v: ex.dm.dist, g: 500, r: 150, c: !!ex.dm.claimed.dist },
            { id: "kills", n: "Defeat 10 Monsters", ic: "\uD83D\uDC80", v: ex.dm.kills, g: 10, r: 200, c: !!ex.dm.claimed.kills }
        ];
    }
    function refreshIn() {
        const n = new Date(), ms = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n, mins = Math.max(0, Math.floor(ms / 60000));
        return Math.floor(mins / 60) + "h " + (mins % 60) + "m";
    }
    setInterval(function () { const e = document.getElementById("x-refresh"); if (e) e.textContent = refreshIn(); }, 30000);
    function rMis() {
        const list = missions(), all = list.every((m) => m.c);
        const rows = list.map(function (m) {
            const done = m.v >= m.g, v = Math.min(m.v, m.g);
            const btn = m.c ? '<button class="x-btn on" disabled>DONE</button>' : done ? '<button class="x-btn gold" data-a="mclaim" data-id="' + m.id + '">CLAIM</button>' : '<button class="x-btn gold" data-a="go">GO</button>';
            return '<div class="ms-row' + (m.c ? " done" : "") + '"><div class="x-ico">' + m.ic + '</div><div class="mid"><h3>' + m.n + '</h3><div class="x-bar"><div style="width:' + (v / m.g * 100) + '%"></div><span>' + fmt(v) + " / " + fmt(m.g) + '</span></div></div><div class="x-price rw">' + coin + "+" + m.r + "</div>" + btn + "</div>";
        }).join("");
        const gift = ex.dm.bonus ? '<span class="x-ok">BONUS CLAIMED</span>' : all ? '<button class="x-btn gold" data-a="mbonus">CLAIM BONUS</button>' : "";
        return '<div class="x-head"><button class="x-back" data-a="close" aria-label="Back">&#10094;</button><h2 class="x-title">DAILY MISSIONS</h2><div class="x-timer">Refresh in: <b id="x-refresh">' + refreshIn() + "</b></div></div>" +
            '<div class="x-body"><div class="x-pnl ms">' + rows + '<div class="ms-gift"><span class="big">&#127873;</span><span>Complete all missions to get:</span><span class="x-price">' + gem + "50</span>" + gift + "</div></div></div>";
    }

    // =====================  PLAYER PROFILE  =====================
    let editName = false;
    function rProf() {
        const mins = Math.floor(P.stats.playSeconds / 60), trophies = MEDALS.filter(medalDone).length, places = Object.keys(ex.visited).filter((k) => LOCS.some((l) => l.id === k)).length;
        const name = editName ? '<input id="name-in" maxlength="14" value="' + esc(ex.name) + '" aria-label="Player name"><button class="x-btn gold" data-a="namesave" aria-label="Save name">&#10003;</button>'
            : "<span>" + esc(ex.name) + '</span><button class="x-btn" data-a="nameedit" aria-label="Edit name">&#9998;</button>';
        const row = (a, b) => '<div class="pf-row"><span>' + a + "</span><b>" + b + "</b></div>";
        const stat = (ic, n, l) => '<div class="pf-stat"><span>' + ic + "</span><em>" + fmt(n) + "<small>" + l + "</small></em></div>";
        return head("PLAYER PROFILE") + '<div class="x-body"><div class="pf"><div class="x-pnl pf-card"><div class="pf-av"><canvas id="pf-cv" width="240" height="240" role="img" aria-label="Your avatar"></canvas></div>' +
            '<div class="pf-info"><div class="pf-name">' + name + '</div><div class="pf-lv">Lv. ' + P.level + '</div><div class="x-bar blue"><div style="width:' + Math.min(100, P.xp / P.xpNeeded * 100) + '%"></div><span>' + P.xp + " / " + P.xpNeeded + " XP</span></div>" +
            row("Highest Score", fmt(P.stats.bestScore)) + row("Longest Distance", fmt(P.stats.bestDistance) + " m") + row("Total Coins", fmt(P.coins)) + row("Total Play Time", Math.floor(mins / 60) + "h " + (mins % 60) + "m") + "</div></div>" +
            '<div class="x-pnl pf-ov"><h3 class="x-h">STATS OVERVIEW</h3>' + stat("\uD83C\uDFC6", trophies, "trophies") + stat("\uD83D\uDCCD", places, "of " + LOCS.length + " places") + stat("\uD83D\uDC80", T.monsters, "monsters") + "</div></div></div>";
    }

    // =====================  SETTINGS  =====================
    let wipeAsk = false;
    function rSet() {
        const S = ex.settings;
        const sl = (k, n) => '<div class="st-row"><label for="r-' + k + '">' + n + '</label><input type="range" id="r-' + k + '" min="0" max="100" value="' + S[k] + '" data-a="vol" data-k="' + k + '"><output id="o-' + k + '">' + S[k] + "%</output></div>";
        const sw = (k, n) => '<div class="st-row"><span>' + n + '</span><button class="x-sw' + (S[k] ? " on" : "") + '" role="switch" aria-checked="' + !!S[k] + '" aria-label="' + n + '" data-a="tg" data-k="' + k + '"><i></i></button></div>';
        const ck = (k, n) => '<div class="st-row"><span>' + n + '</span><button class="x-chk" role="checkbox" aria-checked="' + !!S[k] + '" aria-label="' + n + '" data-a="tg" data-k="' + k + '">' + (S[k] ? "&#10003;" : "") + "</button></div>";
        return head("SETTINGS") + '<div class="x-body"><div class="x-pnl st-wrap"><div>' + sl("musicVol", "Music Volume") + sl("sfxVol", "SFX Volume") + sw("music", "Music") + sw("sfx", "Sound Effects") + "</div>" +
            "<div>" + ck("fullscreen", "Fullscreen") + ck("simple", "Simple Controls") + "</div></div>" +
            '<div class="x-pnl st-reset"><div><h3 class="x-h">RESET GAME</h3><p class="x-sub">Erase everything: coins, gems, level, scores, outfit, achievements and unlocked places. You start over like a new player.</p></div>' +
            '<button class="x-btn red" data-a="wipe">RESET GAME</button></div></div>' +
            '<div class="x-foot"><button class="x-btn gold big" data-a="savesettings">SAVE SETTINGS</button></div>' +
            (wipeAsk ? '<div class="x-modal" role="alertdialog" aria-modal="true"><div class="x-pnl x-dlg"><h3 class="x-h">RESET THE WHOLE GAME?</h3><p class="x-sub">All your progress will be deleted. This cannot be undone.</p>' +
                '<div class="x-foot"><button class="x-btn" data-a="wipeno">CANCEL</button><button class="x-btn red" data-a="wipeyes">YES, RESET</button></div></div></div>' : "");
    }

    // =====================  LOCATION MAP  =====================
    function rMap() {
        const cards = LOCS.map(function (l) {
            const open = !!P.unlocked[l.id];
            return '<button class="x-loc' + (P.location === l.id ? " sel" : "") + (open ? "" : " lockd") + '" data-a="loc" data-id="' + l.id + '"><img src="' + l.img + '" alt="">' + (P.location === l.id ? "<em>Selected</em>" : "") +
                (open ? "" : '<b class="lkb"><img src="visuals/images/icon-lock.png" alt="Locked"></b>') + "<span>" + l.n + "</span></button>";
        }).join("") +
            '<button class="x-loc lk" data-a="loc" data-id="locked"><img src="visuals/images/icon-lock.png" alt=""><span>???</span></button>';
        return head("LOCATION MAP") + '<div class="x-body"><div class="x-pnl mp"><div class="mp-row">' + cards + '</div></div><p class="x-pnl mp-cap">Explore the different locations in Panabo City! Complete a set in the Collection Book to unlock a new place.</p></div>';
    }

    // =====================  MODE PICKER (after PLAY)  =====================
    function rMode() {
        const loc = LOCS.find((l) => l.id === P.location) || LOCS[0];
        return head("CHOOSE YOUR GAME") + '<div class="x-body"><div class="md">' +
            '<button class="x-pnl md-card" data-a="mode" data-m="endless"><div class="md-ic">\uD83C\uDFC3</div><h3 class="x-h">ENDLESS RUN</h3>' +
            '<p class="x-sub">Run until you get hit! Day: dodge cars, birds and wires. Night: fight monsters with punch and kick.</p>' +
            '<div class="md-loc"><img src="' + loc.img + '" alt=""><span>' + loc.n + '</span></div><span class="x-btn gold big">PLAY</span></button>' +
            '<button class="x-pnl md-card" data-a="mode" data-m="survival"><div class="md-ic">\uD83D\uDC80</div><h3 class="x-h">MONSTER SURVIVAL</h3>' +
            '<p class="x-sub">4 levels, 5 waves each. Move in every direction, fight off the monsters and beat the boss to unlock the next level.</p><span class="x-btn gold big">PLAY</span></button>' +
            '</div></div>';
    }

    // =====================  HEROINES (web version)  =====================
    // a heroine stays a mystery (silhouette + "?") until her  revealed  flag in duo.js is true
    function silhouette(col) {
        const f = col || "#3b4166", e = col ? "#fff" : "#7d85ad";
        return '<svg viewBox="0 0 100 170" role="img" aria-label="Mystery heroine"><g fill="' + f + '" stroke="' + e + '" stroke-width="2.4" stroke-linejoin="round">' +
            '<circle cx="50" cy="26" r="17"/><path d="M33 22c2-14 12-19 20-18 10 1 17 9 14 22-4-7-9-10-16-10-8 0-14 2-18 6z"/>' +
            '<path d="M30 52c6-6 34-6 40 0l6 52H24z"/><path d="M26 56l-9 46 9 2 9-40zM74 56l9 46-9 2-9-40z"/><path d="M32 104h36l-3 56H54l-4-34-4 34H35z"/></g>' +
            '<text x="50" y="96" text-anchor="middle" font-family="Teko, Impact, sans-serif" font-weight="700" font-size="58" fill="#e6e9ff" stroke="#10163c" stroke-width="3" paint-order="stroke">?</text></svg>';
    }
    function rHeroes() {
        const D = window.RUNMIL_DUO || { heroines: [] };
        let cleared = {}; try { cleared = (JSON.parse(localStorage.getItem("runmil_save") || "{}").survival || {}).cleared || {}; } catch (e) { cleared = {}; }
        const cards = D.heroines.map(function (h) {
            const open = !!cleared[h.level], rev = !!h.revealed && open;      // a heroine stays a mystery (silhouette, ??? and a secret) until the player clears her level
            const art = rev && h.img ? '<img src="' + esc(h.img) + '" alt="' + esc(h.name) + '">' : silhouette(rev ? h.color : null);
            const lock = open ? '<span class="x-ok">UNLOCKED &#10003;</span>' : '<span class="hr-lock">&#128274; Clear Level ' + h.level + " in Monster Survival to unlock her</span>";
            return '<div class="x-pnl hr-card' + (rev ? "" : " mystery") + '">' + art + '<h3 class="x-h">' + (rev ? esc(h.name) : "???") + "</h3>" +
                '<p class="x-sub">' + (rev ? esc(h.desc) : "Who is she? Her story is still a secret.") + "</p>" + lock + "</div>";
        }).join("");
        return head("HEROINES") + '<div class="x-body"><div class="x-pnl x-sum"><div class="x-h">&#10067; ' + D.heroines.length + ' Heroines</div><p class="x-sub">Clear a level in Monster Survival to unlock one heroine for each of the 4 levels. Pick one as Player 2 in the 2 PLAYERS mode.</p></div><div class="hr-grid">' + cards + "</div></div>";
    }
    (function () { const b = document.getElementById("heroes-btn"); if (b) b.hidden = false; })();

    const R = { heroines: rHeroes, collection: rColl, mode: rMode, customize: rCustom, shop: rShop, achievements: rAch, missions: rMis, profile: rProf, settings: rSet, map: rMap };

    // =====================  CLICKS  =====================
    let wipeArm = 0;
    function applyFullscreen(on) {
        try {
            if (on && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
            if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
        } catch (e) { /* not supported */ }
    }
    ov.addEventListener("click", function (e) {
        const b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
        const a = b.dataset.a, id = b.dataset.id;
        if (a === "close") { close(); return; }
        // customization
        if (a === "tab") { cu.tab = b.dataset.t; cu.sel = cu.tab === "avatar" || cu.tab === "skin" ? null : C.saved()[cu.tab]; cu.sk = C.savedSkin(); C.reload(); render(); return; }
        if (a === "pickskin") { skPick(b.dataset.id); return; }
        if (a === "pickav") { cuHero = +b.dataset.i; render(); return; }
        if (a === "pick") { cuPick(+b.dataset.i); return; }
        if (a === "cunav" && cu.tab === "avatar") { const n = HERO.count; cuHero = ((cuHero - 1 + +b.dataset.d + n) % n) + 1; render(); return; }
        if (a === "cunav" && cu.tab === "skin") { const l = [""].concat(C.SKINS.map((k) => k.id)), i = l.indexOf(cu.sk || ""); skPick(l[(i + +b.dataset.d + l.length) % l.length]); return; }
        if (a === "cunav") { const l = cuList(cu.tab); cuPick(Math.max(0, l.indexOf(cu.sel)) + +b.dataset.d); return; }
        if (a === "cubuy" && cu.tab === "skin") {
            const k = C.skin(cu.sk); if (!k || skOwned(k)) return;
            if (P.coins < k.price) { say("Not enough coins"); return; }
            P.coins -= k.price; ex.cust.owned.skins.push(k.id); C.setSkin(k.id); say(k.name + " bought & worn!"); saveAll(); render(); return;
        }
        if (a === "cuequip" && cu.tab === "skin") { C.setSkin(cu.sk); say(cu.sk ? "Skin equipped!" : "Original look"); render(); return; }
        if (a === "cubuy") {
            const i = cuList(cu.tab).indexOf(cu.sel), price = cuPrice(Math.max(0, i));
            if (P.coins < price) { say("Not enough coins"); return; }
            P.coins -= price; ex.cust.owned[cu.tab].push(cu.sel); C.setColor(cu.tab, cu.sel); say(cuName(cu.tab, cu.sel) + " bought & worn!"); saveAll(); render(); return;
        }
        if (a === "cuequip" && cu.tab === "avatar") { HERO.select(cuHero); M.refresh(); say("Avatar equipped!"); render(); return; }
        if (a === "cuequip") { C.setColor(cu.tab, cu.sel || null); say("Equipped"); render(); return; }
        // collection
        if (a === "cclaim") {
            const st = CO.sets.find((x) => x.id === id); if (!st || ex.collect.claimed[id] || !setDone(st)) return;
            ex.collect.claimed[id] = 1;
            if (st.reward.type === "loc") { P.unlocked[st.reward.id] = 1; say((LOCS.find((l) => l.id === st.reward.id) || { n: "Place" }).n + " unlocked! Pick it on the map or main menu."); }
            else {
                Object.keys(st.reward.parts).forEach(function (p) { if (ex.cust.owned[p].indexOf(st.reward.parts[p]) < 0) ex.cust.owned[p].push(st.reward.parts[p]); });
                Object.keys(st.reward.parts).forEach(function (p) { C.setColor(p, st.reward.parts[p]); });
                say("Outfit unlocked & worn!");
            }
            saveAll(); render(); return;
        }
        // shop (buy)
        if (a === "buyi") {
            const it = ITEMS.find((x) => x.id === id), cur = it.cur || "coins";
            if (P[cur] < it.cost) { say("Not enough " + cur); return; }
            P[cur] -= it.cost; ex.items.ammo = ex.items.ammo || {}; ex.items.ammo[id] = Math.min(99, (ex.items.ammo[id] | 0) + it.pack);
            if (ex.items.owned.indexOf(id) < 0) ex.items.owned.push(id);
            say(it.name + " x" + it.pack + " bought! Stock: " + ex.items.ammo[id]); saveAll(); render(); return;
        }
        if (a === "actab") { acTab = id; render(); return; }
        if (a === "ssel") { shopSel = id; render(); return; }
        // achievements
        if (a === "claim") {
            const m = MEDALS.find((x) => x.id === id); if (!m || ex.ach.claimed[id] || !medalDone(m)) return;
            ex.ach.claimed[id] = 1;
            P.coins += m.r; if (m.gem) P.gems += m.gem; say("+" + m.r + " coins" + (m.gem ? " & " + m.gem + " gems" : "") + "!");
            try { window.RunMilAudio.sfx("ach"); } catch (e) { /* audio is optional */ }
            saveAll(); render(); return;
        }
        // missions
        if (a === "go") { open("mode"); return; }
        if (a === "mode") { close(); if (window.openGame) window.openGame(b.dataset.m); return; }
        if (a === "mclaim") {
            const m = missions().find((x) => x.id === id);
            if (m.v < m.g || m.c) return;
            if (id === "coins") P.mission.claimed = true; else ex.dm.claimed[id] = 1;
            P.coins += m.r; say("+" + m.r + " coins!"); saveAll(); render(); return;
        }
        if (a === "mbonus") { if (ex.dm.bonus || !missions().every((m) => m.c)) return; ex.dm.bonus = true; P.gems += 50; say("+50 gems!"); saveAll(); render(); return; }
        // profile
        if (a === "nameedit") { editName = true; render(); return; }
        if (a === "namesave") { commitName(); return; }
        // settings
        if (a === "tg") {
            const k = b.dataset.k; ex.settings[k] = !ex.settings[k];
            if (k === "fullscreen") applyFullscreen(ex.settings[k]);
            saveAll(); render(); return;
        }
        if (a === "savesettings") { saveAll(); close(); M.toast("Settings saved"); return; }
        if (a === "wipe") { wipeAsk = true; render(); return; }
        if (a === "wipeno") { wipeAsk = false; render(); return; }
        if (a === "wipeyes") {
            try {
                Object.keys(localStorage).filter((k) => k.indexOf("runmil") === 0).forEach((k) => localStorage.removeItem(k));
            } catch (e) { /* storage unavailable */ }
            location.replace("index.html?menu"); return;
        }
        // map
        if (a === "loc") {
            if (id === "locked") { say("More locations coming soon!"); return; }
            if (!P.unlocked[id]) { const st = M.setForLocation(id); say(st ? "Locked - complete the " + st.n + " set in the Collection Book" : "Locked"); return; }
            P.location = id; saveAll(); say(LOCS.find((l) => l.id === id).n + " selected"); render();
        }
    });
    ov.addEventListener("input", function (e) {
        const t = e.target; if (t.dataset.a !== "vol") return;
        ex.settings[t.dataset.k] = +t.value; document.getElementById("o-" + t.dataset.k).textContent = t.value + "%";
        saveAll();
    });
    function commitName() {
        const i = document.getElementById("name-in");
        if (i) ex.name = i.value.trim().slice(0, 14) || "Player";
        editName = false; saveAll(); render();
    }
    document.addEventListener("keydown", function (e) {
        if (!current) return;
        if (e.key === "Escape") { if (editName) { editName = false; render(); } else close(); }
        if (e.key === "Enter" && editName && e.target.id === "name-in") commitName();
    });

    ["heroines", "collection", "mode", "customize", "shop", "achievements", "missions", "profile", "settings", "map"].forEach(function (n) { M.on(n, function () { open(n); }); });
    M.on("play", function () { if (window.RunMilPlayPick) window.RunMilPlayPick(); });      // PLAY always asks which game (Endless Run / Monster Survival / 1 VS 1)
    badge();
})();
