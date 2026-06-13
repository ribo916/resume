/* ============================================================
   FARM PRESENTATION — how the Stardew-style farming experience
   renders the resume. Resume CONTENT lives in
   ../shared/resume-data.js (the RESUME_DATA global); you should
   not need to edit content here. This file controls only the
   farm world's visuals and feel.

   Load order (see index.html): ../shared/resume-data.js must load
   BEFORE this file, then farm-engine.js after it.

   Per farm (keyed by the role's `id` from RESUME_DATA.roles):
     crop       crop accent color (planted rows + signpost) — CSS hex
     roof       cabin roof color — CSS hex
     position   { x, y } world coordinates in TILES (world is a wide
                strip; farms run west→east in chronological order)
     plot       { w, h } farm plot size in tiles
     decor      optional array of extra props: "tree" | "pond" |
                "scarecrow" | "flowers" | "barn" | "well"
     ...plus optional CONTENT OVERRIDES: any field that also exists
        in RESUME_DATA (e.g. sector, summary) placed here wins for
        the farm only — this is how the farm keeps its own voice
        without forking the shared facts.

   Farm/route order = the order of RESUME_DATA.roles (oldest →
   newest). Add a role there; give it a presentation entry here.

   Tuning the feel: visitRadius below; player walk speed lives in
   farm-engine.js (state.speed).
   ============================================================ */

const FARM_PRESENTATION = {
  // Distance (in tiles) from a farm's signpost at which you can "visit" it
  visitRadius: 2.4,

  // Tagline shown on the title card
  subtitle: "Walk the valley and visit each farm to harvest 18+ years of integration work",

  // Per-farm visuals, keyed by role id. Optional content overrides allowed.
  farms: {
    csus: {
      crop: "#7cb342",
      roof: "#2e7d4f",
      position: { x: 7, y: 9 },
      plot: { w: 7, h: 6 },
      decor: ["tree", "tree", "flowers", "well"],
      // farm flavor — overrides the neutral facts in shared data
      sector: "Where the seeds were sown",
      summary:
        "Bachelor of Science in Computer Science from California State University, Sacramento. The starter farm — every harvest since was planted from this ground.",
    },
    intuit: {
      crop: "#42a5f5",
      roof: "#1565c0",
      position: { x: 22, y: 7 },
      plot: { w: 7, h: 6 },
      decor: ["tree", "scarecrow"],
    },
    fis: {
      crop: "#26a69a",
      roof: "#00695c",
      position: { x: 37, y: 10 },
      plot: { w: 8, h: 7 },
      decor: ["barn", "tree", "pond"],
    },
    trustage: {
      crop: "#ffa726",
      roof: "#ef6c00",
      position: { x: 53, y: 7 },
      plot: { w: 7, h: 6 },
      decor: ["tree", "flowers", "scarecrow"],
    },
    oneinc: {
      crop: "#ab47bc",
      roof: "#6a1b9a",
      position: { x: 68, y: 10 },
      plot: { w: 7, h: 6 },
      decor: ["tree", "well"],
    },
    paynearme: {
      crop: "#ef5350",
      roof: "#c62828",
      position: { x: 83, y: 7 },
      plot: { w: 6, h: 6 },
      decor: ["flowers", "tree"],
    },
    polly: {
      crop: "#ffca28",
      roof: "#f9a825",
      position: { x: 98, y: 9 },
      plot: { w: 8, h: 7 },
      decor: ["barn", "tree", "scarecrow", "flowers"],
    },
  },
};

/* Build the FARM_DATA the engine consumes by merging shared content
   with the presentation above. Spread order: shared content first,
   presentation/overrides last (win). The engine reads only FARM_DATA. */
const FARM_DATA = {
  player: { ...RESUME_DATA.player, subtitle: FARM_PRESENTATION.subtitle },
  visitRadius: FARM_PRESENTATION.visitRadius,
  farms: RESUME_DATA.roles.map((role) => ({
    ...role,
    ...FARM_PRESENTATION.farms[role.id],
  })),
};
