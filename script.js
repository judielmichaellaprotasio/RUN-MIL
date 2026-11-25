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
let gateDone = !needGate, videoReady = loadingVideo.readyState >= 3;

function startLoadingVideo() {
    if (!gateDone || !videoReady) return;
    loadingVideo.play().catch(function (error) {
        console.error("Loading video playback error:", error);
    });
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
startLoadingVideo();

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
