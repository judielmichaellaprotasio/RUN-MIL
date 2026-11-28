/* RUN MIL! - 2 PLAYER mode (Monster Survival, WEB version only).
   Player 1 = your main character.  Player 2 = one of the four heroines below. Each heroine is unlocked by clearing one level
   (Level 1 -> heroine 1 ... Level 4 -> heroine 4).

   The ANIMATIONS of each heroine are PLACEHOLDERS for now: the game paints your main character's sheets in her colour.
   When her real GIFs are converted, put the sheet data into her  sheets: { run, punch, kick, jump, crouch }  (same fields as RUNMIL_SV in
   survival-anim.js: src, fw, fh, cols, n, dur, ax, gy, sc). Her GIFs live in  visuals/heroines/<id>/  (see the README.txt in each folder).

   The HEROINES screen in the main menu shows each heroine as a mystery ("???" + a silhouette with a question mark) until her  revealed  is set to true.
   Then it shows her  name,  desc  (her description) and  img  (a picture, optional: the silhouette is used without it).

   On the Android app and touch screens Player 2 is a bot (the computer); with a keyboard two people can play together. */
(function () {
    "use strict";
    const touch = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches) || /[?&]touch=1/.test(location.search);
    const enabled = true;                           // phones too: there Player 2 is played by the computer (a bot)
    const HEROINES = [
        { id: "h1", name: "SHAI", special: "land", level: 1, fx: { src: "visuals/heroines/h1/land.png", fw: 271, fh: 172, n: 9, ms: 110 }, color: "#b05cff", tint: "rgba(255,70,160,.55)", revealed: true, img: "visuals/heroines/h1/portrait.png", face: "visuals/heroines/h1/face.png",
          desc: "Shai never skips a sidequest! Always chasing adventures and trouble, she never backs down. With her earth powers, she summons deadly spikes from the ground to crush her enemies.",
          sheets: {
                      run: { src: "visuals/heroines/h1/run.png", fw: 221, fh: 392, cols: 8, n: 6, dur: [122, 135, 117, 122, 122, 90], ax: 117.3, gy: 375.5, sc: 0.5 },
                      punch: { src: "visuals/heroines/h1/punch.png", fw: 226, fh: 342, cols: 8, n: 6, dur: [230, 240, 230, 200, 230, 200], ax: 140.5, gy: 337.2, sc: 0.5 },
                      kick: { src: "visuals/heroines/h1/kick.png", fw: 240, fh: 318, cols: 8, n: 9, dur: [200, 240, 260, 240, 300, 260, 240, 230, 200], ax: 151.8, gy: 312.8, sc: 0.5 },
                      jump: { src: "visuals/heroines/h1/jump.png", fw: 142, fh: 394, cols: 8, n: 5, dur: [230, 200, 240, 260, 240], ax: 76.4, gy: 383.8, sc: 0.5 },
                      crouch: { src: "visuals/heroines/h1/crouch.png", fw: 175, fh: 306, cols: 8, n: 4, dur: [162, 120, 138, 138], ax: 93.8, gy: 286.2, sc: 0.5 }
                  } },
        { id: "h2", name: "MICHA", special: "flames", level: 2, fx: { src: "visuals/heroines/h2/flame.png", fw: 268, fh: 111, n: 9, ms: 70 }, color: "#ff8a3a", tint: "rgba(150,80,255,.55)", revealed: true, img: "visuals/heroines/h2/portrait.png", face: "visuals/heroines/h2/face.png",
          desc: "Micha is cool in everything she does. Running, fighting or just standing there, she makes it all look effortless. Monsters panic, the street burns, and she never even breaks a sweat.",
          sheets: {
                      run: { src: "visuals/heroines/h2/run.png", fw: 217, fh: 365, cols: 8, n: 7, dur: [104, 108, 90, 90, 104, 90, 90], ax: 109.3, gy: 355.8, sc: 0.5 },
                      punch: { src: "visuals/heroines/h2/punch.png", fw: 198, fh: 375, cols: 8, n: 8, dur: [200, 200, 240, 200, 200, 230, 200, 200], ax: 127.6, gy: 366.8, sc: 0.5 },
                      kick: { src: "visuals/heroines/h2/kick.png", fw: 254, fh: 325, cols: 8, n: 8, dur: [270, 260, 240, 230, 270, 260, 240, 200], ax: 171.3, gy: 310.9, sc: 0.5 },
                      jump: { src: "visuals/heroines/h2/jump.png", fw: 175, fh: 412, cols: 8, n: 10, dur: [270, 230, 270, 230, 230, 200, 240, 200, 230, 200], ax: 113.0, gy: 403.7, sc: 0.5 },
                      crouch: { src: "visuals/heroines/h2/crouch.png", fw: 203, fh: 290, cols: 8, n: 4, dur: [282, 300, 258, 240], ax: 115.6, gy: 256.2, sc: 0.5 }
                  } },
        { id: "h3", name: "MARV", special: "wind", level: 3, fx: { src: "visuals/heroines/h3/wind.png", fw: 273, fh: 177, n: 9, ms: 110 }, color: "#35d6c0", tint: "rgba(30,220,185,.5)", revealed: true, img: "visuals/heroines/h3/portrait.png", face: "visuals/heroines/h3/face.png",
          desc: "A mysterious soul blessed by the skies, she possesses the power to control the wind. She moves like a whisper, strikes like a storm, and turns every breeze into a powerful force. Her greatest strength lies in the freedom of the wind—wild, fearless, and unstoppable.",
          sheets: {
                      run: { src: "visuals/heroines/h3/run.png", fw: 237, fh: 329, cols: 8, n: 6, dur: [120, 138, 120, 120, 120, 102], ax: 156.5, gy: 326.4, sc: 0.5 },
                      punch: { src: "visuals/heroines/h3/punch.png", fw: 200, fh: 381, cols: 8, n: 8, dur: [230, 170, 170, 200, 200, 160, 140, 130], ax: 146.2, gy: 370.1, sc: 0.5 },
                      kick: { src: "visuals/heroines/h3/kick.png", fw: 256, fh: 363, cols: 8, n: 11, dur: [170, 160, 200, 170, 130, 170, 200, 130, 140, 160, 100], ax: 161.7, gy: 350.4, sc: 0.5 },
                      jump: { src: "visuals/heroines/h3/jump.png", fw: 255, fh: 372, cols: 8, n: 9, dur: [230, 200, 240, 200, 200, 260, 240, 200, 230], ax: 141.9, gy: 353.9, sc: 0.5 },
                      crouch: { src: "visuals/heroines/h3/crouch.png", fw: 221, fh: 329, cols: 8, n: 4, dur: [470, 430, 440, 460], ax: 142.6, gy: 323.6, sc: 0.5 }
                  } },
        { id: "h4", name: "CHARM", special: "water", level: 4, fx: { src: "visuals/heroines/h4/water.png", fw: 241, fh: 154, n: 9, ms: 120 }, color: "#2f9bff", tint: "rgba(40,150,255,.5)", revealed: true, img: "visuals/heroines/h4/portrait.png", face: "visuals/heroines/h4/face.png",
          desc: "Don't let her calm waters fool you! Charm is a tidal wave of confidence, power, and pure attitude. She bends, she flows, but she never breaks. Get in her way, and prepare to be washed away!",
          sheets: {
                      run: { src: "visuals/heroines/h4/run.png", fw: 177, fh: 322, cols: 8, n: 6, dur: [150, 115, 120, 115, 115, 85], ax: 96.7, gy: 320.9, sc: 0.5 },
                      punch: { src: "visuals/heroines/h4/punch.png", fw: 236, fh: 329, cols: 8, n: 5, dur: [230, 240, 260, 270, 230], ax: 159.6, gy: 327.7, sc: 0.5 },
                      kick: { src: "visuals/heroines/h4/kick.png", fw: 241, fh: 322, cols: 8, n: 13, dur: [170, 160, 200, 170, 200, 200, 170, 130, 130, 200, 170, 200, 170], ax: 163.7, gy: 320.4, sc: 0.5 },
                      jump: { src: "visuals/heroines/h4/jump.png", fw: 165, fh: 331, cols: 8, n: 8, dur: [270, 200, 200, 230, 240, 160, 200, 170], ax: 78.4, gy: 329.1, sc: 0.5 },
                      crouch: { src: "visuals/heroines/h4/crouch.png", fw: 184, fh: 279, cols: 8, n: 5, dur: [230, 240, 230, 230, 200], ax: 90.6, gy: 277.2, sc: 0.5 }
                  } }
    ];
    window.RUNMIL_DUO = {
        enabled: enabled,
        heroines: HEROINES,
        dir: "visuals/heroines/",
        byId: function (id) { return HEROINES.filter(function (h) { return h.id === id; })[0] || null; },
        forLevel: function (n) { return HEROINES.filter(function (h) { return h.level === n; })[0] || null; }
    };
})();
