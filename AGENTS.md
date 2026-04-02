# Agent Contract — Notes App
Last Updated: 2026-04-02

---

## Agents

| Agent | Responsibility |
|---|---|
| Agent_Mobile | Mobile-friendly layouts and responsive screen sizes |
| Agent_Photo | Photo editing features within the Notes app |

---

## Ownership

### Agent_Mobile OWNS (can freely modify):
- Any CSS/styling related to breakpoints and screen sizes
- Layout files (grid, flex containers, viewport rules)
- Mobile navigation / hamburger menus
- Responsive typography and spacing

### Agent_Photo OWNS (can freely modify):
- Photo upload, crop, filter, and editing logic
- Photo viewer component internals
- Image processing utilities

---

## ⚠️ Shared / Contested Zone

These components are touched by BOTH agents:
- `PhotoViewer` component — Agent_Photo owns the logic/editing UI,
   Agent_Mobile owns its responsive layout/sizing
- Any modal or overlay that displays photos on mobile

### Conflict Rule for Shared Components:
1. **Agent_Photo** handles all internal photo editing logic & toolbars
2. **Agent_Mobile** handles only the wrapper, sizing, and breakpoints
3. Neither agent restructures a shared component's DOM without
   leaving a comment: `<!-- SHARED: notify other agent before changing -->`

---

## 🚫 Hard Boundaries (Do NOT cross)

| Agent_Mobile must NOT | Agent_Photo must NOT |
|---|---|
| Change photo editing logic or filters | Change layout breakpoints or viewport rules |
| Modify image processing utilities | Modify mobile navigation components |
| Touch photo upload/save logic | Touch screen-size media queries owned by Mobile |

---

## 📁 Suggested Directory Convention
(Update with your actual repo structure)

Agent_Mobile:
  src/styles/responsive/
  src/styles/breakpoints/
  src/components/layout/

Agent_Photo:
  src/features/photo/
  src/utils/imageProcessing/
  src/components/PhotoEditor/

Shared (flag before editing):
  src/components/PhotoViewer/
  src/components/NoteCard/  ← if it shows photo thumbnails

---

## Handoff Notes

Each agent must update their section before closing a session:

### Agent_Mobile Status:
- Completed: Mobile layout for dashboard (< 768px) — hidden sidebar, breadcrumb Top bar 2 (< / Home / Recipe Notes / title / Sign out), fixed fade-in list overlay (ease-in-out opacity transition) with search, new recipe, and delete. Most-recently-opened note stays highlighted. Desktop layout unchanged. Merged to main via `feature/agent-mobile`.
- In Progress:
- Blockers:

### Agent_Photo Status:
- Completed: Resizable images in the Notes editor — click an image to select it, then drag the yellow handle (bottom-right corner) to resize. Width is stored as a `width` attribute (px) on the image node and persists across saves.
- In Progress:
- Blockers:

---

## Git Branch Convention
- Agent_Mobile → branch: feature/agent-mobile
- Agent_Photo  → branch: feature/agent-photo
- Merge to main only after both agents sign off
