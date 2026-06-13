# resume

A collection of interactive ways to explore Rich Boesch's career history,
served from a single GitHub Pages repo.

**Live:** https://ribo916.github.io/resume/

## Structure

```
resume/
├── index.html        ← landing page (choose your experience)
├── web/              ← interactive web resume
├── voyage/           ← 3D sailing game resume
└── pdf/              ← PDF resume (coming soon)
```

Each experience is fully self-contained in its own directory. The landing page
links them together. New experiences can be added as new subdirectories.

## Running locally

No build step required — open directly or serve with Python:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`. Each experience is available at its path
(`/web/`, `/voyage/`, `/pdf/`).

The voyage app also works via `file://` (open `voyage/index.html` directly).

## Deploying

Push to `master`. GitHub Actions deploys the entire repo root to GitHub Pages
automatically via `.github/workflows/static.yml`.

## Experiences

### Interactive Resume (`web/`)
A single-page web resume with timeline, skills, and theme switcher. Pure HTML —
no dependencies, no build step.

### Career Voyage (`voyage/`)
A Wind Waker-style 3D sailing game built with Three.js r128. Sail between
islands; each island is a career stop. Docking opens a details panel.

Resume content lives in `voyage/voyage-data.js`. Game mechanics live in
`voyage/voyage-engine.js`. Keep them separate.

### PDF Resume (`pdf/`)
Placeholder — to be wired up to a hosted PDF.
