/* =========================================================
   FULLSCREEN
   Browsers only allow fullscreen after a click / key press, so a "click to start" screen
   comes first: that one click takes over the whole desktop screen, then the loading video plays.
   The game opens inside this same page (see openGame) so fullscreen is never lost.
   Turn it off in Settings > Fullscreen.
========================================================= */
function fsWanted() {
    try { const s = JSON.parse(localStorage.getItem("runmil_save") || "{}") || {}; return !(s.settings && s.settings.fullscreen === false); }
    catch (e) { return true; }
}
function fsSupported() { if (window.RUNMIL_NATIVE || window.RUNMIL_PHONE || /Android|iPhone|iPad/i.test(navigator.userAgent || "")) return false;                    // the Android app is already full screen (no tap-to-start gate)
    const el = document.documentElement; return !!(el.requestFullscreen || el.webkitRequestFullscreen); }
function enterFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    try {
        const p = (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el, { navigationUI: "hide" });
        if (p && p.catch) p.catch(function () { /* not allowed here */ });
    } catch (e) { /* not supported */ }
}

const loadingScreen = document.getElementById("loading-screen");
const loadingVideo = document.getElementById("loading-video");

const titleScreen = document.getElementById("title-screen");
const titleVideo = document.getElementById("title-video");

const mainMenu = document.getElementById("main-menu");
// no grey "play" picture while a video loads: a video stays invisible until it really plays
[loadingVideo, titleVideo].forEach(function (v) {
    v.controls = false; v.style.opacity = "0";
    v.setAttribute("poster", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
    v.addEventListener("playing", function () { v.style.opacity = "1"; });
});

// ---- start gate: first click / key enters fullscreen, then the loading video starts ----
const startGate = document.getElementById("start-gate");
const returning = /[?&]menu\b/.test(location.search);          // coming back to the menu: no videos, no gate
const needGate = !returning && fsWanted() && fsSupported() && !document.fullscreenElement;
const INTRO_KEY = "runmil_skip_intro";
const introScreen = document.getElementById("intro-screen"), introVideo = document.getElementById("intro-video");
let introSkipped = false; try { introSkipped = localStorage.getItem(INTRO_KEY) === "1"; } catch (e) { /* no storage */ }
if (/[?&]intro\b/.test(location.search)) introSkipped = false;      // index.html?intro always plays it again
let introDone = returning || introSkipped;
let goalDone = returning, loadingStarted = false;
const goalScreen = document.getElementById("goal-screen");
let gateDone = !needGate, videoReady = loadingVideo.readyState >= 3;

function finishIntro() {
    if (introDone) return; introDone = true;
    try { if (document.getElementById("intro-never").checked) localStorage.setItem(INTRO_KEY, "1"); } catch (e) { /* ignore */ }
    introVideo.pause(); introScreen.classList.add("hidden"); document.getElementById("intro-snd").hidden = true;
    // free the phone's video decoder: with the intro still loaded, the loading video can stay black on Android
    try { introVideo.removeAttribute("src"); Array.prototype.forEach.call(introVideo.querySelectorAll("source"), function (n) { n.remove(); }); introVideo.load(); } catch (e) { /* ignore */ }
    startLoadingVideo();
}
function startIntro() {
    if (introDone || !gateDone || !introScreen.classList.contains("hidden")) return;
    introScreen.classList.remove("hidden"); introVideo.currentTime = 0;
    introVideo.muted = false;
    introVideo.play().catch(function () {
        // the browser only allows sound after a tap: play it silent now, and switch the sound on at the first tap / key
        introVideo.muted = true; document.getElementById("intro-snd").hidden = false;
        const unmute = function () {
            document.removeEventListener("pointerdown", unmute, true); document.removeEventListener("keydown", unmute, true);
            introVideo.muted = false; introVideo.volume = 1; document.getElementById("intro-snd").hidden = true;
            if (introVideo.paused && !introDone) introVideo.play().catch(function () { });
        };
        document.addEventListener("pointerdown", unmute, true); document.addEventListener("keydown", unmute, true);
        introVideo.play().catch(function () { introProblem("blocked from playing"); });
    });   // blocked with sound? play it silent rather than skip
}
// ---- little synthesized sound effects for the mission screen (no files needed; follow the SFX setting) ----
const GSND = (function () {
    let ac = null;
    function vol() { try { const st = (JSON.parse(localStorage.getItem("runmil_save") || "{}").settings) || {}; return st.sfx === false ? 0 : (st.sfxVol === undefined ? 80 : st.sfxVol) / 100; } catch (e) { return .8; } }
    function ctx() {
        if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
        if (ac.state === "suspended") ac.resume().catch(function () { });
        return ac;
    }
    function tone(type, f0, f1, dur, gain, delay) {
        const c = ctx(), v = vol(); if (!c || !v) return;
        const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * v), t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, gain, hp, delay) {
        const c = ctx(), v = vol(); if (!c || !v) return;
        const t = c.currentTime + (delay || 0), n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        src.buffer = buf; f.type = "highpass"; f.frequency.value = hp || 300; g.gain.value = gain * v;
        src.connect(f); f.connect(g); g.connect(c.destination); src.start(t);
    }
    return {
        unlock: ctx,
        pop: function () { tone("sine", 160, 45, .35, .7); noise(.18, .35, 1200); tone("square", 420, 900, .12, .12, .05); },          // the card slams in
        tick: function () { tone("square", 880 + Math.random() * 380, 0, .03, .05); },
        friends: function () { [660, 880, 1320].forEach(function (f, i) { tone("triangle", f, f, .22, .18, i * .07); }); },          // sparkle
        monsters: function () { tone("sawtooth", 110, 55, .5, .22); tone("sawtooth", 117, 58, .5, .16); noise(.35, .12, 90); },       // growl
        exit: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone("square", f, f, .16, .1, i * .06); }); },            // bright ding
        ready: function () { [392, 523, 659, 784].forEach(function (f, i) { tone("triangle", f, f, .28, .2, i * .09); }); },          // button appears
        ok: function () { tone("square", 700, 260, .12, .2); tone("triangle", 1046, 1568, .25, .18, .06); noise(.08, .15, 2000); }    // button pressed
    };
})();
document.addEventListener("pointerdown", function () { GSND.unlock(); }, true);

// the mission message types itself out; the exit / monster / friend icons light up when their word appears
const GOAL = [["Help Mil find his ", ""], ["companions", "c-f"], [" and beat ", ""], ["monsters", "c-m"], [" to win the game and ", ""], ["escape", "c-e"], [" this place.", ""]];
const GOAL_ICON = { companions: "gi-friends", monsters: "gi-monsters", escape: "gi-exit" };
let goalTimer = 0, goalShown = false;
function showGoal() {
    if (goalShown) return; goalShown = true;
    goalScreen.classList.remove("hidden"); GSND.unlock(); setTimeout(GSND.pop, 120);
    const box = document.getElementById("goal-text"), ok = document.getElementById("goal-ok"), em = document.getElementById("goal-embers");
    for (let i = 0; i < 22; i++) { const e = document.createElement("i"); e.style.left = Math.random() * 100 + "%"; e.style.setProperty("--dx", (Math.random() * 14 - 7) + "vw"); e.style.animationDuration = 5 + Math.random() * 6 + "s"; e.style.animationDelay = -Math.random() * 8 + "s"; em.appendChild(e); }
    let seg = 0, ch = 0, cur = null; box.textContent = ""; box.classList.add("typing");
    const finish = function () {
        clearInterval(goalTimer); box.classList.remove("typing"); box.innerHTML = ""; 
        GOAL.forEach(function (g) { const sp = document.createElement("span"); if (g[1]) sp.className = g[1]; sp.textContent = g[0]; box.appendChild(sp); });
        ["gi-friends", "gi-monsters", "gi-exit"].forEach(function (id) { document.getElementById(id).classList.add("on"); });
        if (!ok.classList.contains("show")) GSND.ready();
        ok.classList.add("show");
    };
    goalTimer = setInterval(function () {
        if (seg >= GOAL.length) { finish(); return; }
        if (ch === 0) { cur = document.createElement("span"); if (GOAL[seg][1]) cur.className = GOAL[seg][1]; box.appendChild(cur); const id = GOAL_ICON[GOAL[seg][0]]; if (id) { document.getElementById(id).classList.add("on"); GSND[{ "gi-friends": "friends", "gi-monsters": "monsters", "gi-exit": "exit" }[id]](); } }
        cur.textContent = GOAL[seg][0].slice(0, ++ch); if (GOAL[seg][0].charAt(ch - 1) !== " " && ch % 2) GSND.tick(); if (ch >= GOAL[seg][0].length) { seg++; ch = 0; }
    }, 38);
    goalScreen.querySelector(".goal-card").addEventListener("click", function (e) { if (e.target === ok) return; if (!ok.classList.contains("show")) finish(); });
}
const goalOk = document.getElementById("goal-ok");
if (goalOk) goalOk.addEventListener("click", function () { GSND.ok(); goalDone = true; goalScreen.classList.add("hidden"); startLoadingVideo(); });
if (introVideo) introVideo.addEventListener("ended", finishIntro);
// a broken intro is no longer skipped silently: retry once, then say why for a few seconds
let introRetried = false, introPlayed = false;
introVideo.addEventListener("playing", function () { introPlayed = true; });
function introProblem(why) {
    if (introDone) return;
    let m = document.getElementById("intro-msg");
    if (!m) { m = document.createElement("div"); m.id = "intro-msg"; m.style.cssText = "position:absolute;left:0;right:0;top:40%;text-align:center;color:#fff;font:700 20px/1.3 sans-serif;padding:0 20px;text-shadow:0 2px 4px #000"; introScreen.appendChild(m); }
    m.textContent = "Intro video problem: " + why; setTimeout(finishIntro, 4000);
}
const introSrc = introVideo.querySelector("source");
if (introSrc) introSrc.addEventListener("error", function () { introVideo.dispatchEvent(new Event("error")); });   // errors of a <source> do not reach the video itself
introVideo.addEventListener("error", function () {
    if (introDone) return;
    const e = introVideo.error;
    if (!introRetried) { introRetried = true; try { introVideo.src = "visuals/videos/INTRO.mp4?r=" + Date.now(); introVideo.load(); introVideo.play().catch(function () { }); return; } catch (x) { /* fall through */ } }
    introProblem("code " + (e ? e.code : "?") + (e && e.code === 4 ? " (file missing or format not supported)" : ""));
});
// started but never plays (e.g. stuck loading): look again after 6 s
setTimeout(function () {
    if (introDone || introPlayed || introScreen.classList.contains("hidden")) return;
    introVideo.muted = true; introVideo.play().catch(function () { });
    setTimeout(function () { if (!introDone && !introPlayed) introProblem("did not start (ready " + introVideo.readyState + ", network " + introVideo.networkState + ")"); }, 4000);
}, 6000);
document.getElementById("intro-skip").addEventListener("click", finishIntro);


function startLoadingVideo() {
    if (!gateDone) return;
    if (!introDone) { startIntro(); return; }
    if (!goalDone) { try { showGoal(); return; } catch (e) { console.error("mission screen failed", e); goalDone = true; goalScreen.classList.add("hidden"); } }
    if (loadingStarted) return; loadingStarted = true;
    // do not wait for "canplay": Android WebView often never loads a video before play() is called
    const tryPlay = function () { return loadingVideo.play().catch(function (error) { console.error("Loading video playback error:", error); }); };
    loadingVideo.muted = true;
    try { if (loadingVideo.readyState === 0) loadingVideo.load(); } catch (e) { /* ignore */ }
    tryPlay();
    setTimeout(function () { if (loadingVideo.paused && !loadingScreen.classList.contains("hidden")) tryPlay(); }, 1200);
    // safety net: never sit on a black screen - if the video has not started after 6 s, go on to the title
    setTimeout(function () { if (loadingVideo.currentTime === 0 && !loadingScreen.classList.contains("hidden")) loadingVideo.dispatchEvent(new Event("ended")); }, 6000);
}

if (needGate) {
    startGate.classList.remove("hidden");
    const release = function (e) {
        if (e.type === "keydown" && e.key === "Escape") return;
        document.removeEventListener("pointerup", release, true);
        document.removeEventListener("keydown", release, true);
        enterFullscreen();
        startGate.classList.add("hidden");
        gateDone = true;
        startLoadingVideo();
    };
    document.addEventListener("pointerup", release, true);
    document.addEventListener("keydown", release, true);
} else {
    startGate.classList.add("hidden");
    if (returning && fsWanted() && fsSupported()) {            // reloaded straight into the menu: go fullscreen on the first click
        const once = function (e) {
            if (e.type === "keydown" && e.key === "Escape") return;
            document.removeEventListener("pointerup", once, true);
            document.removeEventListener("keydown", once, true);
            enterFullscreen();
        };
        document.addEventListener("pointerup", once, true);
        document.addEventListener("keydown", once, true);
    }
}

// Start loading video when the browser is ready (and the gate has been passed)
loadingVideo.addEventListener("canplay", function () { videoReady = true; startLoadingVideo(); });
loadingVideo.addEventListener("loadeddata", function () { videoReady = true; startLoadingVideo(); });
setTimeout(startLoadingVideo, 0);          // after the whole file has run (the mission screen code is further down)

// When loading video finishes
loadingVideo.addEventListener("ended", function() {

    loadingScreen.classList.add("hidden");
    titleScreen.classList.remove("hidden");

    titleVideo.currentTime = 0;

    titleVideo.play().catch(function(error) {
        console.error("Title video playback error:", error);
    });

});

// If loading video cannot load
loadingVideo.addEventListener("error", function() {
    console.error("Loading video failed:", loadingVideo.error);
});

// Click title screen to enter main menu
titleScreen.addEventListener("click", function() {

    titleVideo.pause();

    titleScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");

});

/* =========================================================
   MAIN MENU
   - fills the numbers from the saved player data
   - hooks up every button (so your game screens can plug in)
========================================================= */

const SAVE_KEY = "runmil_save";   // same key the game uses, so coins / scores carry over

function defaultSave() {
    return {
        coins: 1250,
        gems: 50,
        level: 1,
        xp: 0,
        xpNeeded: 100,
        location: "park",
        unlocked: { park: 1 },
        stats: { bestScore: 0, bestDistance: 0, playSeconds: 0 },
        mission: { day: "", progress: 0, goal: 50, reward: 100, claimed: false }
    };
}

function loadSave() {
    const data = defaultSave();
    try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
        if (s) {
            ["coins", "gems", "level", "xp", "xpNeeded", "location"].forEach(function (k) {
                if (s[k] !== undefined) data[k] = s[k];
            });
            Object.assign(data.stats, s.stats || {});
            if (s.unlocked) Object.assign(data.unlocked, s.unlocked);
            Object.assign(data.mission, s.mission || {});
        }
    } catch (e) { /* ignore broken data */ }

    data.unlocked.park = 1;
    if (!data.unlocked[data.location]) data.location = "park";   // never stay on a locked place

    // new day = new daily mission
    const today = new Date().toISOString().slice(0, 10);
    if (data.mission.day !== today) {
        data.mission = { day: today, progress: 0, goal: 50, reward: 100, claimed: false };
    }
    return data;
}

const player = loadSave();

function savePlayer() {
    try {
        // merge into whatever else is stored (e.g. the game's upgrades) instead of overwriting it
        const old = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") || {};
        const merged = Object.assign(old, player);
        merged.stats = Object.assign(old.stats || {}, player.stats);
        localStorage.setItem(SAVE_KEY, JSON.stringify(merged));
    } catch (e) { /* storage not available */ }
}

const fmt = function (n) { return Number(n).toLocaleString("en-US"); };
const $ = function (id) { return document.getElementById(id); };

function refreshMenu() {
    $("coin-count").textContent = fmt(player.coins);
    $("gem-count").textContent = fmt(player.gems);


    $("level-text").textContent = "Lv. " + player.level;
    $("xp-text").textContent = player.xp + " / " + player.xpNeeded + " XP";
    $("xp-fill").style.width = Math.min(100, player.xp / player.xpNeeded * 100) + "%";

    const m = player.mission;
    $("mission-text").textContent = "Collect " + m.goal + " Coins";
    $("mission-count").textContent = Math.min(m.progress, m.goal) + " / " + m.goal;
    $("mission-fill").style.width = Math.min(100, m.progress / m.goal * 100) + "%";
    const ready = m.progress >= m.goal && !m.claimed;
    $("missions-btn").classList.toggle("ready", ready);                       // red dot on the left button
    document.querySelector(".m-reward b").textContent = m.claimed ? "Done" : "+" + m.reward;

    $("stat-best").textContent = ": " + fmt(player.stats.bestScore);
    $("stat-run").textContent = ": " + fmt(player.stats.bestDistance) + " m";
    $("stat-coins").textContent = ": " + fmt(player.coins);
    const mins = Math.floor(player.stats.playSeconds / 60);
    $("stat-time").textContent = ": " + Math.floor(mins / 60) + "h " + (mins % 60) + "m";

    document.querySelectorAll(".loc[data-loc]").forEach(function (b) {
        const id = b.dataset.loc, open = !!player.unlocked[id];
        b.classList.toggle("selected", id === player.location);
        if (id !== "locked") { b.classList.toggle("locked", !open); b.classList.toggle("open", open); b.setAttribute("aria-label", b.textContent.trim() + (open ? "" : " (locked)")); }
    });
}

// Places are unlocked only by completing a set in the COLLECTION BOOK (see collect.js)
function setForLocation(id) {
    const CO = window.RUNMIL_COLLECT;
    return CO && CO.sets.find(function (s) { return s.reward && s.reward.type === "loc" && s.reward.id === id; });
}

// small pop-up message
let toastTimer = 0;
function menuToast(text) {
    const t = $("menu-toast");
    t.textContent = text;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("on"); }, 1600);
}

/*
   Hook your own screens in here. Example:
       RunMilMenu.on("play", openGame);
   Names: play, customize, shop, achievements, settings, missions, map, profile
*/
const menuHandlers = {};
const menuLabels = {
    play: "Game", customize: "Character Customization", shop: "Equipment Shop",
    achievements: "Achievements", settings: "Settings", missions: "Daily Missions", map: "Location Map",
    profile: "Profile", collection: "Collection Book", heroines: "Heroines"
};

function openFeature(name) {
    document.dispatchEvent(new CustomEvent("runmil:open", { detail: name }));
    if (menuHandlers[name]) { menuHandlers[name](player); return; }
    menuToast(menuLabels[name] + " - coming soon");
}

[
    ["play-btn", "play"], ["customize-btn", "customize"], ["shop-btn", "shop"], ["collect-btn", "collection"], ["heroes-btn", "heroines"],
    ["achievements-btn", "achievements"], ["settings-btn", "settings"], ["stats-btn", "profile"], ["missions-btn", "missions"], ["map-btn", "map"],
    ["profile-btn", "profile"]
].forEach(function (pair) {
    $(pair[0]).addEventListener("click", function () { if (pair[1] === "play" && window.RunMilPlayPick) { window.RunMilPlayPick(); return; } openFeature(pair[1]); });      // PLAY always asks which game
});

// choose a location
document.querySelectorAll(".loc[data-loc]").forEach(function (b) {
    b.addEventListener("click", function () {
        const id = b.dataset.loc;
        if (id === "locked") { menuToast("More locations coming soon!"); return; }
        if (!player.unlocked[id]) {
            const st = setForLocation(id);
            menuToast(st ? "Locked - complete the " + st.n + " set in the Collection Book" : "Locked");
            if (st) setTimeout(function () { openFeature("collection"); }, 900);
            return;
        }
        player.location = id;
        savePlayer();
        refreshMenu();

        menuToast(b.textContent.trim() + " selected");
    });
});

// Tools for the game to use
window.RunMilMenu = {
    player: player,
    on: function (name, fn) { menuHandlers[name] = fn; },
    refresh: refreshMenu,
    save: savePlayer,
    // call when the player picks up coins during a run
    addCoins: function (n) {
        player.coins += n;
        player.mission.progress += n;
        savePlayer();
        refreshMenu();
    },
    // call when a run ends: RunMilMenu.endRun({ score: 1234, distance: 560, seconds: 75 })
    endRun: function (r) {
        player.stats.bestScore = Math.max(player.stats.bestScore, r.score | 0);
        player.stats.bestDistance = Math.max(player.stats.bestDistance, r.distance | 0);
        player.stats.playSeconds += r.seconds | 0;
        player.xp += Math.round((r.distance | 0) / 10);
        while (player.xp >= player.xpNeeded) { player.xp -= player.xpNeeded; player.level++; player.xpNeeded = Math.round(player.xpNeeded * 1.25); }
        savePlayer();
        refreshMenu();
    },
    toast: menuToast,
    setForLocation: setForLocation
};

refreshMenu();

// ---- character: the chosen hero (animated) + its avatar, drawn with the saved outfit ----
const heroView = RunMilHero.view($("hero"));
RunMilHero.view($("avatar-img"), { head: true });
window.addEventListener("pageshow", function () { RunMilCharacter.reload(); });


// ---- the game opens in a full-window frame on top of the menu, so fullscreen is never lost ----
const gameFrame = document.getElementById("game-frame");
function openGame(mode) {
    savePlayer();
    if (window.RunMilAudio) RunMilAudio.stop();                 // the game has its own music
    gameFrame.hidden = false;
    gameFrame.onload = function () { try { gameFrame.contentWindow.focus(); } catch (e) { /* ignore */ } };
    gameFrame.src = (mode === "versus" ? "versus.html" : mode === "survival" ? "survival.html" : "game.html?mode=endless") + (mode === "endless" ? "&" : "?") + "t=" + Date.now();            // fresh load = latest equipment / outfit
}
function closeGame() {
    gameFrame.hidden = true;
    gameFrame.onload = null;
    gameFrame.src = "about:blank";
    // the run wrote its results to the save: pull them into the menu
    Object.assign(player, loadSave());
    refreshMenu();
    if (RunMilMenu.reloadExtra) RunMilMenu.reloadExtra();
    RunMilCharacter.reload();
}
window.addEventListener("message", function (e) {
    if (e.source === gameFrame.contentWindow && e.data === "runmil:home") closeGame();
});

// MODE CARDS (Endless Run / Monster Survival): pick one, then press PLAY. Pressing the picked card again also starts it.
let menuMode = "endless";
try { localStorage.removeItem("runmil_menu_mode"); } catch (e) { /* storage unavailable */ }      // the last picked game is no longer remembered
function setMenuMode(m) {
    menuMode = m === "survival" ? "survival" : "endless";
    document.querySelectorAll(".mode-card").forEach(function (b) { const on = b.dataset.mode === menuMode; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
}
document.querySelectorAll(".mode-card").forEach(function (b) {
    b.addEventListener("click", function () { if (window.RunMilModeInfo) RunMilModeInfo(b.dataset.mode); });      // the cards only show what the game is about; PLAY opens the "choose your game" screen
});
document.querySelectorAll(".mode-card").forEach(function (b) { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); });      // nothing is pre-selected
window.RunMilMenuMode = function () { return menuMode; };
window.RunMilSetMode = function () { };
$("gem-plus").addEventListener("click", function () { menuToast("Earn gems from missions and achievements"); });

// PLAY starts the picked mode (see screens.js)
window.openGame = openGame;

// coming back from the game (game.html -> index.html?menu) skips the videos
if (/[?&]menu\b/.test(location.search)) {
    loadingVideo.pause();
    loadingScreen.classList.add("hidden");
    titleScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");
}
