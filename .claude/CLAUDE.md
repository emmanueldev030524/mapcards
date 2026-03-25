# MapCards — Territory Card Maker

## Project Overview
A local-first web utility for creating S-12-E territory cards. Admin traces streets from vector map data, plots house icons, draws custom streets, defines territory boundaries, and exports clean print-ready cards as PNG/PDF.

## Tech Stack
- **Build**: Vite + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 (use `@tailwindcss/vite` plugin, no PostCSS config needed)
- **Map**: MapLibre GL JS v5
- **Tiles**: OpenFreeMap (primary, free, no API key), MapTiler (fallback)
- **Drawing**: Terra Draw + MapLibre adapter
- **Geo**: Turf.js v7
- **State**: Zustand v5
- **Persistence**: idb-keyval (IndexedDB)
- **Export**: jsPDF + canvas API

## Architecture
- WAT framework: Workflows (markdown SOPs), Agents (Claude), Tools (Python/JS scripts)
- Single-page app, no routing, no backend
- Zustand single store (`src/store.ts`) is the source of truth
- Auto-save to IndexedDB on every state change (500ms debounce)
- One territory at a time workflow

## Key Conventions
- Tailwind v4: Use arbitrary values (`max-w-[42rem]`) instead of named utilities (`max-w-2xl`)
- Never add `* { margin: 0; padding: 0; }` — Tailwind v4 preflight handles resets
- MapLibre style is built at runtime by filtering OpenFreeMap bright style (see `src/lib/mapStyle.ts`)
- Custom roads must use same paint/layout as base map roads (two-layer: casing + fill)
- Export uses offscreen MapLibre instance with `preserveDrawingBuffer: true` — never set this on the interactive map

## File Structure
```
src/
  components/   # React components (MapView, Toolbar, CardSettings, etc.)
  hooks/        # Custom hooks (useMap, useDraw, useProject, useExport)
  lib/          # Pure functions (mapStyle, export, persistence, geo operations)
  types/        # TypeScript interfaces
  store.ts      # Zustand store
```

## Plan Reference
Full implementation plan: `.claude/plans/curious-dazzling-manatee.md`
