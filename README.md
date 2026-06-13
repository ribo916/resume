# resume

A collection of interactive ways to explore Rich Boesch's career history,
served from a single GitHub Pages repo.

**Live:** https://ribo916.github.io/resume/

## Structure

```
resume/
├── index.html        ← landing page (choose your experience)
├── shared/           ← cross-experience assets
│   └── resume-data.js  ← canonical resume content (single source of truth)
├── web/              ← interactive web resume
├── voyage/           ← 3D sailing game resume
└── pdf/              ← PDF resume (coming soon)
```

Each experience's mechanics live in its own directory. **Resume content is
shared** — it lives once in `shared/resume-data.js` and every experience reads
from it, so editing a fact there updates all experiences at once. New experiences
are added as new subdirectories that consume the same shared data.

## Shared resume data

`shared/resume-data.js` is the single source of truth. It defines a global
`RESUME_DATA` (the person + a chronological list of roles) as a plain classic
script — no build step, no modules, works over `file://`.

- **Change a job title, date, highlight, or tech tag:** edit `shared/resume-data.js`.
  The change flows to every experience that consumes it.
- **Each experience keeps its own presentation** (layout, theme, colors) separate
  from the shared facts, and may override a field for its own voice without
  forking the data.

> Note: `web/` is a legacy hand-written page and does not yet read `RESUME_DATA`.
> The landing page and the voyage do.

## Running locally

No build step required. Serve the repo root with Python:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`. Each experience is available at its path
(`/web/`, `/voyage/`, `/pdf/`). Edit a file and refresh the browser to see changes.

Use a server rather than opening files directly: the landing page and voyage load
`shared/resume-data.js` over a relative path, which serves cleanly over HTTP.
(The voyage still also works opened directly via `file://`, but the local server
is the simplest way to run everything.)

## Testing

End-to-end tests live in `tests/` and run with [Playwright](https://playwright.dev/)
against a real local HTTP server (so they exercise the actual deployed paths,
including the shared-data loads). WebGL is enabled for the voyage's 3D scene.

First-time setup:

```bash
npm install
npx playwright install chromium
```

Run the suite (desktop + mobile viewports):

```bash
npm test                 # all tests
npx playwright test --headed          # watch them run in a browser
npx playwright show-report            # open the HTML report after a run
```

What's covered: landing page (load, shared-data wiring, responsive layout,
no JS errors), the voyage (WebGL boot, all 7 islands, docking + panel content
matching the data), the web resume (content, theme switcher, navigation), and
the PDF placeholder. The test tooling (`node_modules`, `package.json`,
`playwright.config.js`) is the only Node in the repo — the site itself still has
no build step.

## Deploying

Push to `master`. GitHub Actions publishes to GitHub Pages automatically via
`.github/workflows/static.yml`. There is no build step — Pages just serves the
static HTML/JS as-is.

The workflow strips the dev-only tooling (`tests/`, `node_modules/`,
`package.json`, `package-lock.json`, `playwright.config.js`) from the CI copy
right before upload, so only the real site is published. That cleanup runs
against the ephemeral CI checkout — your repo is untouched, and `npm test` keeps
working locally.

## Experiences

### Interactive Resume (`web/`)
A single-page web resume with timeline, skills, and theme switcher. Pure HTML —
no dependencies, no build step.

### Career Voyage (`voyage/`)
A Wind Waker-style 3D sailing game built with Three.js r128. Sail between
islands; each island is a career stop. Docking opens a details panel.

- **Content** comes from `shared/resume-data.js`.
- **Presentation** (island colors, positions, sizes, dock feel) lives in
  `voyage/voyage-data.js`, which merges the shared content into what the engine reads.
- **Mechanics** live in `voyage/voyage-engine.js`.

Keep these layers separate.

### PDF Resume (`pdf/`)
Placeholder — to be wired up to a hosted PDF.
