# Resume Repo

A landing page at the repo root links out to multiple independent "career
experiences", each in its own subdirectory. Deployed via GitHub Pages at
https://ribo916.github.io/resume/

| Path | What it is |
|------|-----------|
| `index.html` | Landing page — links to all experiences |
| `shared/` | Cross-experience assets. `resume-data.js` = canonical resume content (`RESUME_DATA`) |
| `web/` | Interactive web resume (dark-themed, multi-section; hand-written HTML, legacy) |
| `voyage/` | 3D sailing game resume (documented below) |
| `pdf/` | PDF resume placeholder |
| `tests/` | Playwright e2e specs (dev-only; see Testing & deploy below) |

**Resume content has one source of truth: `shared/resume-data.js`.** It defines a
global `RESUME_DATA` (player + chronological `roles[]`) as a classic script. Every
experience reads from it, so editing a fact once updates all of them. An experience
keeps its own *presentation* (layout, colors, theme) and may override a content
field for its own voice — but never forks the facts. Each experience's mechanics
stay self-contained to its folder; only content is shared.

(Exception: `web/` is a legacy monolith with content baked into its HTML — it does
not yet read `RESUME_DATA`. Retrofitting it is a separate future task.)

**Voyage invariants (always preserve):**
1. Voyage's engine/mechanics stay self-contained in `voyage/` with relative paths
   intact (classic scripts, file://-safe, no build step). Voyage reads shared
   content via `../shared/resume-data.js`; that one external dependency is expected.
2. The published URL `…/resume/voyage/` must keep working (or a redirect added).
   If a task seems to require breaking either, stop and ask.

## Testing & deploy

The site itself has **no build step** — the only Node in the repo is the test
tooling. Playwright e2e specs live in `tests/` (run `npm test`; first time:
`npm install && npx playwright install chromium`). They run against a local HTTP
server across desktop + mobile viewports and cover all four experiences. See the
README "Testing" section for details. `node_modules/` and test artifacts are
gitignored.

Deploy is `.github/workflows/static.yml` (GitHub Pages, on push to `master`). It
serves the repo as static files, but **strips the dev tooling**
(`tests/ node_modules package.json package-lock.json playwright.config.js`) from
the CI copy before upload, so only the real site ships. When adding dev-only files
that shouldn't be published, add them to that `rm -rf` step too.

---

# Career Voyage — 3D Sailing Resume (`voyage/`)

Interactive resume as a Wind Waker-style sailing game. The visitor sails a boat
between islands; each island is a career stop. Docking opens a details panel
with role, highlights, and tech. Live at https://ribo916.github.io/resume/voyage/

## Architecture (the one rule that matters)

**Content, presentation, and engine are strictly separated. Keep it that way.**

| File | Purpose | Edit when |
|------|---------|-----------|
| `../shared/resume-data.js` | Canonical resume CONTENT (`RESUME_DATA`): player + `roles[]` (name, role, dates, sector, summary, highlights, tech). Shared by all experiences. | Resume facts change |
| `voyage-data.js` | Voyage PRESENTATION (`VOYAGE_PRESENTATION`): per-island color, position, size, dockRadius, subtitle, optional content overrides. Merges shared content into the `VOYAGE_DATA` object the engine reads. | Voyage visuals/layout |
| `voyage-engine.js` | All game mechanics: scene, boat physics, docking, minimap, avatar, UI wiring. Reads everything from `VOYAGE_DATA`. | Behavior/visual changes |
| `index.html` | Shell + all CSS (parchment/gold theme). Loads three.min.js → shared data → voyage data → engine as classic scripts. | UI styling changes |
| `three.min.js` | Vendored Three.js r128 (global `THREE`, not modules). CDN fallback exists in index.html. | Never |

`voyage-data.js` builds `VOYAGE_DATA` (unchanged shape) by merging
`RESUME_DATA.roles` with per-island presentation — so the engine is untouched by
the content/presentation split. To change resume facts edit the shared file; to
change how the voyage looks/feels edit `voyage-data.js`.

No build step, no server needed — opens directly via file:// (this is why scripts
are classic, not ES modules; don't convert them). The `../shared/resume-data.js`
relative path is file://-safe. Deploys as static files; GitHub Pages serves it
as-is on push.

## Engine conventions and gotchas (learned the hard way)

- **Boat heading math:** the bow points along local **-Z**. Forward velocity is
  `(-sin(heading), -cos(heading))`. A heading of `-π/2` faces east (+x). If a
  change makes the boat sail backwards, this convention was violated.
- **Z-fighting:** never place mesh faces coplanar (e.g., deck floor flush with
  hull top). Offset by ~0.02. The foam disc under the boat sits at local y=0.3,
  above the wave peak (waves displace water vertices ±0.5).
- **World:** sea bounds ±95 on x/z. Island course runs west→east chronologically
  (CSUS → Intuit → FIS → TruStage → One Inc → PayNearMe → Polly). Piers are on
  each island's **east (+x)** side on purpose: the details panel overlays the
  right side of the screen, so a boat docked east keeps the island and greeter
  visible on the left.
- **Docking rules:** sailing into range only shows the dock prompt (click it or
  press E). Clicking a pier (3D) teleport-docks instantly. Clicking an island
  dot on the minimap sails there and auto-docks. Clicking anywhere outside the
  panel while docked = undock. Don't reintroduce auto-dock on plain arrival.
- **Obstacle avoidance:** click-to-sail steers around islands via per-frame
  waypoint deflection (see the `blocker` logic in the animate loop). Keyboard
  steering is raw, no avoidance.
- **Art style:** toon/cel shading via `toonMat()` helper (MeshToonMaterial +
  3-step gradient map). Water is **unlit** MeshBasicMaterial with a generated
  voronoi+swirl canvas texture. Use `toonMat()` for any new mesh; standard
  materials will look wrong next to everything else.
- **Avatar:** the greeter is a green-tunic adventurer homage (original geometry,
  no Nintendo assets — keep it that way for IP safety). Built in `buildAvatar()`,
  spawned/removed on dock/undock, waves via `activeAvatar` in the animate loop.
- **Camera zoom:** `camZoom` clamped 0.45–2.3, wheel listener is on the canvas
  only (so the panel can still scroll).
- **Minimap:** parchment sea-chart, canvas-drawn every frame in `drawMinimap()`.
  Uniform scale fit-by-height; world→map via `worldToMap()`.

## Testing

`window.__voyage` debug hook (intentionally shipped):
- `__voyage.dock(id)` — teleport-dock at island id
- `__voyage.undock()`
- `__voyage.status()` — `{x, z, sailing, docked}`
- `__voyage.islands` — list of ids
- `__voyage.pierScreen(id)` — screen coords of a pier (for click tests)

Validation approach that worked: headless Chromium (Playwright) against the
file:// URL with `--enable-unsafe-swiftshader` for WebGL; assert on DOM state
(`#panel.open`, `#dock-prompt.show`, panel content) and take screenshots for
visual checks. `node --check` the JS files (`../shared/resume-data.js`,
`voyage-data.js`, `voyage-engine.js`) after every edit.

## Common tasks

- **Update resume content** (role, dates, summary, highlights, tech): edit
  `../shared/resume-data.js` only. Order of `roles[]` = course order, oldest→newest.
  This also updates every other experience.
- **Add an island:** add the role to `RESUME_DATA.roles` (shared), then add a
  matching `VOYAGE_PRESENTATION.islands[<id>]` entry in `voyage-data.js` with a
  `position` continuing the west→east line (~30 units spacing), `color`, `size`.
- **Give the voyage its own wording for a field:** add that field (e.g. `sector`,
  `summary`) to the island's entry in `voyage-data.js` — it overrides shared.
- **Change theme colors:** CSS vars at the top of `index.html`
  (`--parchment`, `--gold`, `--night`, etc.).
- **Tune feel:** `state.maxSpeed`, turn rate (1.8) in `voyage-engine.js`, and
  `dockRadius` (in `voyage-data.js`).