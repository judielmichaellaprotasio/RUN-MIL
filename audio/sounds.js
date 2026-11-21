/* ------------------------------------------------------------------
   YOUR SOUND FILES for RUN MIL!
   Every sound listed here plays your file instead of the built-in sound.
   Anything NOT listed (or a file that cannot be loaded) keeps the built-in sound.

   Sound effects : put the file in  visuals/audio/sfx/<name>.<ext>
   Music         : put the file in  visuals/audio/music/<track>.<ext>

   Write each entry as  name: "ext"   or, to also set loudness / start point,
                        name: { ext: "mp3", vol: 0.8 }            (vol 0 to 1, 1 = as recorded)
                        track: { ext: "mp3", vol: 0.9, start: 12 }  (start = seconds to skip at the beginning)

   Example (remove the // to turn a line on):
       sfx:   { coin: "mp3", jump: { ext: "wav", vol: 0.7 } },
       music: { park: "mp3", menu: { ext: "ogg", start: 4 } }

   Sound effect names : jump jump2 land duck swing impact coin gem item kill combo near over revive
                        pencil ruler laser blast boom day night dawn tick go victory click pause resume ach
                        spawn_ghoul spawn_brute spawn_wraith idle_ghoul idle_brute idle_wraith
                        brute_hit kill_ghoul kill_brute kill_wraith
                        boss_warn  (Monster Survival boss alarm; plays instead of the siren)
   Monster voices     : <monster>_1, <monster>_2 ... (up to _8), e.g. frog_1 rat_1 spider_1 roach_1 bat_1
                        a random one plays when that monster attacks, is hit or dies.  <monster>_arrive plays when it appears.
                        monster_1..8 is the general sound for monsters with no sound of their own.
                        Monster names: rat roach spider frog bat boss art claw mask saw clown eye blob gang zomb fur eyeboss
                                       pigt pigf pigk girl birdy drag cow
                        Add  { ext: "mp3", file: "other_name" }  to reuse another file, e.g. gang_1: { file: "l3_groan_1" }
   Character          : jump jump2 land punch_1.. kick_1.. (random one of the numbered files on each hit)
   Disasters          : dis_tornado dis_landspikes dis_fireball dis_acidrain dis_shockwave
   Music tracks       : menu park dnsc mangrove seawall victory survival  (+ <place>_day = daytime song of a place, night = night song for all places)
   Open soundtest.html to listen to every slot and see which ones use your file.
------------------------------------------------------------------- */
window.RUNMIL_SOUNDS = {
    sfx: {
        // ---- the character: male jump voice, landing, punches and kicks (a random one of the numbered files plays)
        jump: "mp3", jump2: "mp3", land: "mp3",
        punch_1: "mp3", punch_2: "mp3", punch_3: "mp3", kick_1: "mp3", kick_2: "mp3", kick_3: "mp3", kick_4: "mp3",
        // ---- Monster Survival disasters + the shockwave / special ability
        dis_tornado: "mp3", dis_landspikes: "mp3", dis_fireball: "mp3", dis_acidrain: "mp3", dis_shockwave: "mp3",
        // ---- monster voices: <monster>_1, _2 ... = attack / hit / death.  <monster>_arrive = when it shows up.
        //      { file: "name" } uses a file with a different name, so one recording can serve several monsters.
        // Level 1
        frog_1: "mp3", frog_2: "mp3", frog_3: "mp3", frog_4: "mp3", frog_5: "mp3",
        rat_1: "mp3", rat_2: "mp3", rat_3: "mp3",                                            // the rat sounds are also used by the Level 1 boss
        // Level 2  (monster 3 = chainsaw killer; boss = the clown)
        saw_1: "mp3", saw_2: "mp3", saw_3: "mp3", saw_4: "mp3",
        clown_arrive: "mp3", clown_1: "mp3", clown_2: "mp3",
        // killer clown, claw killer, ghost mask: this sound on their ATTACK only (no hit / death voice)
        art_attack: { file: "l2_attack" }, claw_attack: { file: "l2_attack" }, mask_attack: { file: "l2_attack" },
        // Level 3  (eye, blob and purple beast: arrival sound only; zombie gang and zombie: groans; boss = the eye king)
        eye_arrive: { file: "l3_arrive" }, blob_arrive: { file: "l3_arrive" }, fur_arrive: { file: "l3_arrive" }, eyeboss_arrive: "mp3",
        eyeboss_1: { file: "l3_arrive" }, eyeboss_2: { file: "l3_arrive" },       // the eye king attacks / gets hit / dies with the same alien sound (no rat sound)
        gang_1: { file: "l3_groan_1" }, gang_2: { file: "l3_groan_2" }, gang_3: { file: "l3_groan_3" },
        zomb_1: { file: "l3_groan_1" }, zomb_2: { file: "l3_groan_2" }, zomb_3: { file: "l3_groan_3" },
        // Level 4  (monster 1 = scout pig, monster 2 = doll girl, dragon, boss = the cowgirl)
        // pigs (scout, brawler, fork pig) use the pig sound; the harpy uses the bird sound
        pig_1: "mp3", pig_2: "mp3", pig_3: "mp3", bird_1: "mp3", bird_2: "mp3", bird_3: "mp3",
        pigt_1: { file: "pig_1" }, pigt_2: { file: "pig_2" }, pigt_3: { file: "pig_3" },
        pigf_1: { file: "pig_1" }, pigf_2: { file: "pig_2" }, pigf_3: { file: "pig_3" },
        pigk_1: { file: "pig_1" }, pigk_2: { file: "pig_2" }, pigk_3: { file: "pig_3" },
        birdy_1: { file: "bird_1" }, birdy_2: { file: "bird_2" }, birdy_3: { file: "bird_3" },
        girl_1: { file: "pig_grunt_1" }, girl_2: { file: "pig_grunt_2" }, girl_3: { file: "pig_grunt_3" },   // doll girl
        drag_1: "mp3", drag_2: "mp3", drag_3: "mp3",
        cow_arrive: "mp3", cow_1: "mp3", cow_2: "mp3", cow_3: "mp3",
        // the general monster sound: attack / hit sound for every monster that has no sound of its own
        monster_1: "mp3", monster_2: "mp3", monster_3: "mp3",
        // ---- Endless night monsters use the sounds of their kind (the same as Monster Survival):
        //      ghoul = rat, brute = pig, wraith = bird.  Appearing / idle / hit / dying all use them.
        spawn_ghoul: { pick: ["rat_1", "rat_2", "rat_3"] }, idle_ghoul: { pick: ["rat_1", "rat_2", "rat_3"] }, kill_ghoul: { pick: ["rat_1", "rat_2", "rat_3"] },
        spawn_brute: { pick: ["pig_1", "pig_2", "pig_3"] }, idle_brute: { pick: ["pig_1", "pig_2", "pig_3"] }, brute_hit: { pick: ["pig_1", "pig_2", "pig_3"] }, kill_brute: { pick: ["pig_1", "pig_2", "pig_3"] },
        spawn_wraith: { pick: ["bird_1", "bird_2", "bird_3"] }, idle_wraith: { pick: ["bird_1", "bird_2", "bird_3"] }, kill_wraith: { pick: ["bird_1", "bird_2", "bird_3"] },
        // coin: "mp3",
    },
    music: {
        park_day: "mp3", seawall_day: "mp3", mangrove_day: "mp3",
        dnsc_day: "mp3",          // school ambience (made for you: crowd, birds, a bell, a ball bouncing)
        night: "mp3",             // the night song for every place
    }
};
