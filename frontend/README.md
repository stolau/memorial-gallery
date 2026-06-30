# Frontend

React + TypeScript single-page app (Vite) for the memorial gallery. It talks to
the existing Flask backend over a single origin.

## Dev workflow

1. Start Flask on port 5000 (e.g. `flask --app app run`, or the project's runner).
2. In a second terminal:

   ```sh
   cd frontend
   npm install   # first time only
   npm run dev    # Vite dev server on http://localhost:5173
   ```

The Vite dev server proxies `/api`, `/media`, and `/event-media` to Flask on
`:5000` (see `vite.config.ts`). Because everything is served from the single
`:5173` origin in dev, the Flask cookie session works without CORS workarounds.

## Compile checks

- `npm run build` — type-checks (`tsc -b`) and bundles with Vite. This is the
  real compile proof.
- `npm run typecheck` — `tsc -b --noEmit`, type-only check.

## Production (later)

`npm run build` emits `frontend/dist/`. In a future migration slice Flask will
serve that build directly; this is not wired up in this PR.
