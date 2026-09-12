# Admin UX Restoration Report

## Source and target

- Source: fix/remaining-layout-issues
- Source SHA: d51b11d1784df7866e0531453bec14ff1a6786a6
- Target branch: fix/admin-ux-restoration
- Backend files and API contracts were not changed.

## Root cause

The breakage was a frontend cascade/layout issue rather than an Admin API problem:

1. AdminApp imported a very small admin.css after the global game styles, but that stylesheet did not implement the layout classes already used by the Admin pages (form grids, cards, KPI blocks, chart container, modal, table wrapper, etc.).
2. The resulting elements fell back to browser defaults. In particular, labels remained inline and inputs kept intrinsic/narrow widths, which made fields appear on one line and caused action controls to collapse.
3. The login view was rendered without an Admin root, so even scoped Admin rules could not apply to it.

The fix adds a complete Admin-only design system and always mounts Admin views below .admin-app.

## CSS isolation

- Admin root: .admin-app
- Scoped reset: box-sizing, typography, controls, focus rings and disabled states are applied only below .admin-app.
- Generic global selectors were not added. Tables, cards, forms, tooltips, charts and navigation all use .admin-* selectors.
- User frontend affected: No (the pre-existing user stylesheet changes in the worktree were preserved).

## UX changes

- 1360px max-width centered page container with responsive horizontal padding.
- Sticky top navigation with active tab, hover/focus states and mobile overflow.
- Structured page header, revision badge and status messaging.
- Spaced action toolbar with primary/secondary/destructive hierarchy.
- Responsive form grids (minmax(220px, 1fr)), labels above controls and full-width inputs.
- Read-only metadata/authoritative fields are visually distinct and receive a Только чтение badge when metadata marks them immutable.
- Field-level validation text is rendered below the corresponding input with aria-invalid/aria-describedby.
- Tooltips are compact, keyboard accessible popovers and do not alter row sizing.
- Crash math is split into model parameters, runtime/read-only fields, KPI probability chips and a responsive chart panel.
- Overview, Simulation, History/Versions and Journal share the same cards, table wrappers and responsive spacing.
- Narrow tables scroll inside .admin-table-wrap rather than expanding the page.

## Verification

- npm run typecheck — PASS
- npm run lint — PASS
- npm test -- --run — PASS (21 files, 110 tests)
- npm run build — PASS
- npm run validate:assets — PASS (32 references, 0 broken)
- Browser smoke — Admin login page opened at 127.0.0.1 and visually verified at the available viewport. Authenticated Config/Overview/Simulation/History/Journal screenshots are blocked in this environment because no admin credentials/backend session were available; no visual PASS is claimed for those pages.

## Files changed

- frontend/src/admin/admin.css
- frontend/src/admin/AdminApp.tsx
- frontend/src/admin/pages/ConfigEditor.tsx
- frontend/src/admin/pages/Overview.tsx
- frontend/src/admin/pages/Versions.tsx
- frontend/src/admin/pages/Audit.tsx

