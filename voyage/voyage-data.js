/* ============================================================
   VOYAGE PRESENTATION — how the sailing experience renders the
   resume. Resume CONTENT lives in ../shared/resume-data.js
   (the RESUME_DATA global); you should not need to edit content
   here. This file controls only the voyage's visuals and feel.

   Load order (see index.html): ../shared/resume-data.js must load
   BEFORE this file, then voyage-engine.js after it.

   Per island (keyed by the role's `id` from RESUME_DATA.roles):
     color     island accent color (buildings/sign), any CSS hex
     position  { x, z } world coordinates (sea is roughly -90..90)
     size      island radius multiplier (1 = normal)
     ...plus optional CONTENT OVERRIDES: any field that also exists
        in RESUME_DATA (e.g. sector, summary) placed here wins for
        the voyage only — this is how the voyage keeps its own voice
        without forking the shared facts.

   Island/course order = the order of RESUME_DATA.roles (oldest →
   newest). Add a role there; give it a presentation entry here.

   Tuning the feel: dockRadius below; state.maxSpeed and turn rate
   live in voyage-engine.js.
   ============================================================ */

const VOYAGE_PRESENTATION = {
  // Distance at which the boat is considered "docked" (island radius units)
  dockRadius: 13,

  // Voyage-specific tagline shown on the title card
  subtitle: "Sail the course to explore 18+ years of integration work",

  // Per-island visuals, keyed by role id. Optional content overrides allowed.
  islands: {
    csus: {
      color: "#2e7d4f",
      position: { x: -82, z: 42 },
      size: 0.9,
      // voyage flavor — overrides the neutral facts in shared data
      sector: "Where the voyage began",
      summary:
        "Bachelor of Science in Computer Science from California State University, Sacramento. The home port — every integration journey since has launched from here.",
    },
    intuit:     { color: "#1565c0", position: { x: -54, z: 20 }, size: 1.0  },
    fis:        { color: "#00695c", position: { x: -25, z: 34 }, size: 1.15 },
    trustage:   { color: "#ef6c00", position: { x:   6, z: 12 }, size: 1.05 },
    oneinc:     { color: "#6a1b9a", position: { x:  36, z: 26 }, size: 1.0  },
    paynearme:  { color: "#c62828", position: { x:  60, z:  4 }, size: 0.95 },
    polly:      { color: "#f9a825", position: { x:  84, z: 16 }, size: 1.2  },
  },
};

/* Build the VOYAGE_DATA the engine consumes by merging shared content
   with the presentation above. Shape is unchanged from before, so the
   engine reads it exactly as it always has.
   Spread order: shared content first, presentation/overrides last (win). */
const VOYAGE_DATA = {
  player: { ...RESUME_DATA.player, subtitle: VOYAGE_PRESENTATION.subtitle },
  dockRadius: VOYAGE_PRESENTATION.dockRadius,
  islands: RESUME_DATA.roles.map((role) => ({
    ...role,
    ...VOYAGE_PRESENTATION.islands[role.id],
  })),
};
