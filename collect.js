/* =========================================================
   COLLECTION BOOK - pieces found while running (shared by the game and the menu).
   Complete a set, then claim it in the menu (COLLECTION BOOK) to unlock its reward:
     reward { type: "loc", id }      -> unlocks a location
     reward { type: "outfit", parts } -> unlocks dyes in Character Customization
   locs = places where the pieces of that set show up more often.
========================================================= */
window.RUNMIL_COLLECT = {
    items: {
        notebook: { n: "Notebook", ic: "📓" },
        backpack: { n: "Backpack", ic: "🎒" },
        triangle: { n: "Triangle Ruler", ic: "📐" },
        bell: { n: "School Bell", ic: "🔔" },
        apple: { n: "Teacher's Apple", ic: "🍎" },

        banana: { n: "Banana Bunch", ic: "🍌" },
        seedling: { n: "Mangrove Seedling", ic: "🌱" },
        salakot: { n: "Salakot Hat", ic: "👒" },
        map: { n: "Panabo Map", ic: "🗺️" },
        mango: { n: "Sweet Mango", ic: "🥭" },

        shell: { n: "Seashell", ic: "🐚" },
        starfish: { n: "Starfish", ic: "⭐" },
        bottle: { n: "Message Bottle", ic: "🍾" },
        boat: { n: "Sailboat", ic: "⛵" },
        crab: { n: "Tiny Crab", ic: "🦀" },

        medal: { n: "Gold Medal", ic: "🏅" },
        trophy: { n: "Trophy", ic: "🏆" },
        whistle: { n: "Coach Whistle", ic: "📣" },
        cert: { n: "Honor Certificate", ic: "📜" },
        sneaker: { n: "Lucky Sneaker", ic: "👟" },

        drum: { n: "Festival Drum", ic: "🥁" },
        mask: { n: "Fiesta Mask", ic: "🎭" },
        firework: { n: "Firework", ic: "🎆" },
        lantern: { n: "Paper Lantern", ic: "🏮" },
        confetti: { n: "Confetti Popper", ic: "🎉" }
    },
    sets: [
        { id: "school", n: "School Days", ic: "🎒", items: ["notebook", "backpack", "triangle", "bell", "apple"], locs: ["dnsc", "park"], reward: { type: "loc", id: "dnsc", label: "Unlocks DNSC Campus" } },
        { id: "souvenir", n: "Panabo Souvenirs", ic: "🍌", items: ["banana", "seedling", "salakot", "map", "mango"], locs: ["park", "mangrove"], reward: { type: "loc", id: "mangrove", label: "Unlocks Mangrove Forest" } },
        { id: "seaside", n: "Seaside Treasures", ic: "🐚", items: ["shell", "starfish", "bottle", "boat", "crab"], locs: ["seawall", "mangrove"], reward: { type: "loc", id: "seawall", label: "Unlocks Panabo Seawall" } },
        { id: "champion", n: "Star Student", ic: "🏆", items: ["medal", "trophy", "whistle", "cert", "sneaker"], locs: ["dnsc", "seawall"],
          reward: { type: "outfit", label: "Unlocks the Gold Outfit", parts: { shirt: "#ffd24a", pants: "#2f6fdd", shoes: "#ffd24a", hair: "#c99a4a" } } },
        { id: "fiesta", n: "Fiesta Night", ic: "🎉", items: ["drum", "mask", "firework", "lantern", "confetti"], locs: ["park", "seawall"],
          reward: { type: "outfit", label: "Unlocks the Fiesta Outfit", parts: { shirt: "#8a5cff", pants: "#8a1c2b", shoes: "#8a5cff", hair: "#2fa4ff" } } }
    ]
};
