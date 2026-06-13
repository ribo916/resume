# Resume Repo

A landing page at the repo root links out to multiple independent "career
experiences", each in its own subdirectory. Deployed via GitHub Pages at
https://ribo916.github.io/resume/

| Path | What it is |
|------|-----------|
| `index.html` | Landing page — links to all experiences |
| `web/` | Interactive web resume (dark-themed, multi-section) |
| `voyage/` | 3D sailing game resume (documented below) |
| `pdf/` | PDF resume placeholder |

Each experience is self-contained — no cross-imports, no shared assets.
Do not apply voyage conventions to other experiences, and vice versa.

**Voyage invariants (always preserve):**
1. The four voyage files stay together in `voyage/` with their relative paths
   intact (classic scripts, file://-safe, no build step).
2. The published URL `…/resume/voyage/` must keep working (or a redirect added).
   If a task seems to require breaking either, stop and ask.

---

# Career Voyage — 3D Sailing Resume (`voyage/`)

Interactive resume as a Wind Waker-style sailing game. The visitor sails a boat
between islands; each island is a career stop. Docking opens a details panel
with role, highlights, and tech. Live at https://ribo916.github.io/resume/voyage/

## Architecture (the one rule that matters)

**Content and engine are strictly separated. Keep it that way.**

| File | Purpose | Edit when |
|------|---------|-----------|
| `voyage-data.js` | ALL resume content: islands, roles, highlights, tech tags, colors, positions, dock radius. Plain JS object (`VOYAGE_DATA`), documented in its header comment. | Resume changes |
| `voyage-engine.js` | All game mechanics: scene, boat physics, docking, minimap, avatar, UI wiring. Reads everything from `VOYAGE_DATA`. | Behavior/visual changes |
| `index.html` | Shell + all CSS (parchment/gold theme). Loads three.min.js → data → engine as classic scripts. | UI styling changes |
| `three.min.js` | Vendored Three.js r128 (global `THREE`, not modules). CDN fallback exists in index.html. | Never |

No build step, no server needed — opens directly via file:// (this is why scripts
are classic, not ES modules; don't convert them). Deploys as static files;
GitHub Pages serves it as-is on push.

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
visual checks. `node --check` both JS files after every edit.

## Common tasks

- **Update resume content:** edit `voyage-data.js` only. Island fields are
  documented in its header. Order of the `islands` array = course order.
- **Add an island:** append to `islands` with a `position` continuing the
  west→east line (keep ~30 units spacing) and a unique `id`.
- **Change theme colors:** CSS vars at the top of `index.html`
  (`--parchment`, `--gold`, `--night`, etc.).
- **Tune feel:** `state.maxSpeed`, turn rate (1.8), and `dockRadius`
  (in voyage-data.js).