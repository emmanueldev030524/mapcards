# Tablet Responsive Design Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make MapCards fully responsive and butter-smooth on tablet devices (iPad portrait/landscape).

**Architecture:** Four-layer approach: (1) lock browser zoom on UI chrome, (2) convert sidebar to overlay drawer on tablet, (3) enlarge all touch targets to 44px, (4) optimize touch gesture smoothness for drawing/dragging.

**Tech Stack:** React 19, Tailwind CSS v4, MapLibre GL JS v5, CSS `touch-action`, `requestAnimationFrame`

---

### Task 1: Create `useMediaQuery` Hook

**Files:**
- Create: `src/hooks/useMediaQuery.ts`

**Step 1: Create the hook**

```typescript
import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    setMatches(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** True when viewport is < 1024px (tablets and smaller) */
export function useIsTablet(): boolean {
  return useMediaQuery('(max-width: 1023px)')
}
```

**Step 2: Verify build**

Run: `cd /Users/emmanueljumelgallardo/Desktop/mapcards && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/hooks/useMediaQuery.ts
git commit -m "feat: add useMediaQuery and useIsTablet hooks for responsive behavior"
```

---

### Task 2: Lock Browser Zoom on UI Chrome

**Files:**
- Modify: `index.html` (line 6)
- Modify: `src/index.css` (add rules at end of `@layer base`)

**Step 1: Update viewport meta tag**

In `index.html`, change line 6 from:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
to:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

This prevents the entire browser viewport from zooming when users pinch on any UI element. MapLibre handles its own pinch-to-zoom via JavaScript, so the map canvas is unaffected.

**Step 2: Add `touch-action` rules to `index.css`**

At the end of `@layer base { ... }`, add:

```css
  /* ── Touch zoom lock ── */
  /* Prevent browser zoom on all UI elements; allow tap + scroll only */
  .touch-lock {
    touch-action: manipulation;
  }

  /* Map canvas: browser must not interfere — MapLibre handles all gestures */
  .maplibregl-canvas-container {
    touch-action: none;
  }
```

**Step 3: Apply `touch-lock` to root container in `App.tsx`**

Change line 154 from:
```tsx
<div className="flex h-dvh w-full">
```
to:
```tsx
<div className="touch-lock flex h-dvh w-full">
```

**Step 4: Verify build**

Run: `cd /Users/emmanueljumelgallardo/Desktop/mapcards && npx tsc --noEmit`
Expected: No type errors

**Step 5: Commit**

```bash
git add index.html src/index.css src/App.tsx
git commit -m "fix: lock browser zoom on UI chrome, allow only MapLibre to handle pinch-to-zoom"
```

---

### Task 3: Sidebar Overlay Drawer on Tablet

**Files:**
- Modify: `src/App.tsx` (lines 24, 69, 153-252)
- Modify: `src/index.css` (add overlay/drawer styles)

**Step 1: Import `useIsTablet` in App.tsx**

Add to imports at top of `src/App.tsx`:
```typescript
import { useIsTablet } from './hooks/useMediaQuery'
```

**Step 2: Add `isTablet` state and auto-close logic**

After `const [sidebarOpen, setSidebarOpen] = useState(true)` (line 69), add:
```typescript
const isTablet = useIsTablet()

// Auto-close sidebar on tablet when entering draw mode
useEffect(() => {
  if (isTablet && (activeDrawMode === 'boundary' || activeDrawMode === 'road')) {
    setSidebarOpen(false)
  }
}, [isTablet, activeDrawMode])

// Start with sidebar closed on tablet
useEffect(() => {
  if (isTablet) setSidebarOpen(false)
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

**Step 3: Update sidebar markup for drawer behavior**

Replace the sidebar `<aside>` block (lines 156-252) with:

```tsx
{/* Backdrop — tablet overlay only */}
{isTablet && sidebarOpen && (
  <div
    className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300"
    onClick={() => setSidebarOpen(false)}
    aria-hidden="true"
  />
)}

{/* Sidebar */}
<aside
  className={[
    'flex shrink-0 flex-col border-r border-divider bg-sidebar-bg',
    // Tablet: fixed overlay drawer
    isTablet
      ? `fixed inset-y-0 left-0 z-40 w-[280px] shadow-[4px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`
      // Desktop: inline with width transition (existing behavior)
      : `transition-[width] duration-300 ease-out ${
          sidebarOpen ? 'w-68' : 'w-0 overflow-hidden border-r-0'
        }`,
    // Drawing fade (desktop only)
    !isTablet && (activeDrawMode === 'boundary' || activeDrawMode === 'road') ? 'sidebar-drawing' : '',
  ].filter(Boolean).join(' ')}
  onMouseEnter={(e) => {
    if (!isTablet && activeDrawMode) e.currentTarget.classList.remove('sidebar-drawing')
  }}
  onMouseLeave={(e) => {
    if (!isTablet && (activeDrawMode === 'boundary' || activeDrawMode === 'road'))
      e.currentTarget.classList.add('sidebar-drawing')
  }}
>
```

Everything inside the `<aside>` (header, sidebar-scroll content, stats) stays exactly the same.

**Step 4: Update sidebar toggle button size for tablet**

Replace the sidebar toggle button (lines 259-265) with:

```tsx
<button
  onClick={() => setSidebarOpen((v) => !v)}
  className={`absolute left-3 top-3 z-10 flex items-center justify-center rounded-xl border border-white/50 bg-white/85 text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-all hover:bg-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:scale-95 ${
    isTablet ? 'h-11 w-11' : 'h-9 w-9'
  }`}
  title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
>
  {sidebarOpen ? <PanelLeftClose size={isTablet ? 20 : 16} strokeWidth={2} /> : <PanelLeftOpen size={isTablet ? 20 : 16} strokeWidth={2} />}
</button>
```

**Step 5: Add drawer CSS for sidebar touch scrolling**

In `src/index.css`, inside `@layer base`, add:

```css
  /* Sidebar drawer overlay — prevent body scroll on tablet */
  aside.fixed {
    overscroll-behavior: contain;
  }
```

**Step 6: Verify build + visually test**

Run: `cd /Users/emmanueljumelgallardo/Desktop/mapcards && npx tsc --noEmit`
Expected: No type errors

**Step 7: Commit**

```bash
git add src/App.tsx src/hooks/useMediaQuery.ts src/index.css
git commit -m "feat: sidebar becomes overlay drawer on tablet — full-width map, backdrop dismiss"
```

---

### Task 4: Enlarge Touch Targets on Tablet

**Files:**
- Modify: `src/components/MapToolbar.tsx` (button sizes)
- Modify: `src/index.css` (MapLibre control sizes)
- Modify: `src/components/BulkFillDialog.tsx` (responsive width)

**Step 1: Import `useIsTablet` in MapToolbar**

Add to imports in `src/components/MapToolbar.tsx`:
```typescript
import { useIsTablet } from '../hooks/useMediaQuery'
```

**Step 2: Make toolbar buttons responsive**

Inside the `MapToolbar` component, add after the existing state:
```typescript
const isTablet = useIsTablet()
```

Change the button size constants (line 57-58) from:
```typescript
const btnSize = 'h-9 w-9'
```
to:
```typescript
const btnSize = isTablet ? 'h-11 w-11' : 'h-9 w-9'
const iconSize = isTablet ? 20 : 17
```

Then update all `<Icon size={17}` references to `<Icon size={iconSize}` and all `size={14}` in Done button to `size={isTablet ? 16 : 14}`.

Update Undo/Redo icons:
```tsx
<Undo2 size={iconSize} strokeWidth={2} />
```
```tsx
<Redo2 size={iconSize} strokeWidth={2} />
```

Update tool icons:
```tsx
<Icon size={iconSize} strokeWidth={isActive ? 2.2 : 2} />
```

Update trash icon:
```tsx
<Trash2 size={iconSize} strokeWidth={2} />
```

**Step 3: Add tablet-responsive MapLibre control sizes in CSS**

In `src/index.css`, after the existing `.maplibregl-ctrl-group button` rules, add:

```css
  /* Tablet: larger map controls for touch */
  @media (max-width: 1023px) {
    .maplibregl-ctrl-group button {
      width: 44px !important;
      height: 44px !important;
    }
    .maplibregl-ctrl-compass {
      width: 44px !important;
      height: 44px !important;
    }
    /* Larger range slider thumbs for touch */
    input[type="range"]::-webkit-slider-thumb {
      width: 22px;
      height: 22px;
    }
    input[type="range"]::-moz-range-thumb {
      width: 22px;
      height: 22px;
    }
  }
```

**Step 4: Make BulkFillDialog width responsive**

In `src/components/BulkFillDialog.tsx`, change line 92 from:
```tsx
<div className="w-80 rounded-xl bg-white p-5 shadow-[0_20px_40px_rgba(0,0,0,0.12),0_8px_16px_rgba(0,0,0,0.06)]">
```
to:
```tsx
<div className="w-full max-w-[20rem] mx-4 rounded-xl bg-white p-5 shadow-[0_20px_40px_rgba(0,0,0,0.12),0_8px_16px_rgba(0,0,0,0.06)]">
```

**Step 5: Verify build**

Run: `cd /Users/emmanueljumelgallardo/Desktop/mapcards && npx tsc --noEmit`
Expected: No type errors

**Step 6: Commit**

```bash
git add src/components/MapToolbar.tsx src/index.css src/components/BulkFillDialog.tsx
git commit -m "feat: enlarge touch targets to 44px on tablet — toolbar, map controls, sliders, dialogs"
```

---

### Task 5: Butter-Smooth Touch Interactions

**Files:**
- Modify: `src/components/MapView.tsx` (touch handlers, ~lines 861-945)
- Modify: `src/index.css` (visual feedback)

**Step 1: Add visual feedback CSS for dragged elements**

In `src/index.css`, inside `@layer base`, add:

```css
  /* Drag feedback: lifted feel during touch drag */
  @keyframes grab-pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.08); }
    100% { transform: scale(1.05); }
  }
```

**Step 2: Optimize touch move handler with requestAnimationFrame**

In `src/components/MapView.tsx`, inside the drag/drop `useEffect` (around line 861), wrap the touch handlers with rAF throttling. Replace the `onTouchMove` handler with:

```typescript
let rafId: number | null = null

const onTouchMove = (e: maplibregl.MapTouchEvent) => {
  if (!pendingId && !dragId) return
  if (e.originalEvent.touches.length !== 1) return

  // Cancel any pending rAF to avoid stacking frames
  if (rafId !== null) cancelAnimationFrame(rafId)

  const touch = e.originalEvent.touches[0]
  const rect = canvas.getBoundingClientRect()
  const point = new maplibregl.Point(touch.clientX - rect.left, touch.clientY - rect.top)

  if (pendingId && startPoint && !dragId) {
    const dx = point.x - startPoint.x
    const dy = point.y - startPoint.y
    if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
      dragId = pendingId
      pendingId = null
    }
    return
  }

  if (!dragId) return

  rafId = requestAnimationFrame(() => {
    rafId = null
    const lngLat = map.unproject(point)
    const snap = useStore.getState().snapToGrid
    const spacing = useStore.getState().gridSpacingMeters
    const [lng, lat] = snap
      ? snapCoord(lngLat.lng, lngLat.lat, spacing)
      : [lngLat.lng, lngLat.lat]

    const bnd = useStore.getState().boundary
    if (bnd && !turf.booleanPointInPolygon([lng, lat], bnd)) return

    moveDragged(dragId!, dragType!, lng, lat)
  })
}
```

Also update `onTouchEnd` to cancel pending rAF:
```typescript
const onTouchEnd = () => {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  pendingId = null
  startPoint = null
  if (dragId) {
    dragId = null
    dragType = null
    useStore.getState()._lastMoveId && useStore.setState({ _lastMoveId: null })
    justDraggedRef.current = true
    setTimeout(() => { justDraggedRef.current = false }, 300)
  }
  map.dragPan.enable()
}
```

And add cleanup in the return function:
```typescript
return () => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  map.off('mousedown', onMouseDown)
  map.off('mousemove', onMouseMove)
  map.off('mouseup', onMouseUp)
  map.off('touchstart', onTouchStart)
  map.off('touchmove', onTouchMove)
  map.off('touchend', onTouchEnd)
}
```

**Step 3: Increase touch hit tolerance**

In the `onTouchStart` handler (around line 862), increase tolerance from 16 to 20 for fatter finger targets:

```typescript
const tolerance = 20
```

**Step 4: Verify build**

Run: `cd /Users/emmanueljumelgallardo/Desktop/mapcards && npx tsc --noEmit`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/components/MapView.tsx src/index.css
git commit -m "feat: butter-smooth touch — rAF throttling, larger hit areas, gesture ownership"
```

---

### Task 6: Compass Control Touch Target Improvement

**Files:**
- Modify: `src/lib/CompassControl.ts` (button size, slider thumb size)

**Step 1: Make compass button larger on tablet**

In `CompassControl.ts`, in the `onAdd` method where the compass button is created, add a tablet media check. Find where `this.compassBtn` sizing is set and update the button to use 44px on viewports under 1024px.

In the `createSliderRow` method, increase the track hit area height from `28px` to `36px` and the slider thumb from current size to 18px diameter on tablet.

Specifically, update the compass button wrapper (in `onAdd`) — after `this.wrapper` creation, add:

```typescript
// Responsive sizing for tablet
const isNarrow = window.matchMedia('(max-width: 1023px)').matches
const btnSize = isNarrow ? '44px' : '36px'
```

Use `btnSize` for the compass button width/height.

Update the slider thumb in `createSliderRow` — change thumb dimensions:

```typescript
const thumbSize = window.matchMedia('(max-width: 1023px)').matches ? '18px' : '14px'
```

**Step 2: Verify build**

Run: `cd /Users/emmanueljumelgallardo/Desktop/mapcards && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/CompassControl.ts
git commit -m "feat: larger compass control and slider thumbs on tablet"
```

---

### Task 7: Final Integration Test

**Step 1: Build the project**

Run: `cd /Users/emmanueljumelgallardo/Desktop/mapcards && npm run build`
Expected: Build succeeds with no errors

**Step 2: Manual verification checklist (Chrome DevTools tablet emulation)**

- [ ] Open Chrome DevTools → Toggle device toolbar → iPad (1024x768)
- [ ] Sidebar opens as overlay drawer with backdrop
- [ ] Tapping backdrop closes sidebar
- [ ] Sidebar auto-closes when entering draw mode
- [ ] Toolbar buttons are 44px on tablet
- [ ] Map controls (zoom +/-) are 44px on tablet
- [ ] Pinch gesture on UI elements does NOT zoom the page
- [ ] Pinch gesture on map DOES zoom the map
- [ ] Dragging a house on touch feels smooth (no stutter)
- [ ] BulkFillDialog is responsive (doesn't overflow on narrow screens)
- [ ] Compass slider is usable with finger

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: tablet responsive design — overlay drawer, 44px touch targets, smooth gestures"
```
