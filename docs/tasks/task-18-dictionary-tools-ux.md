# TASK-18 — Clarify dictionary CRUD vs tools UX

**Status:** Done  
**Priority:** low  
**Area:** frontend UX

## Context

Dictionary CRUD screens and the Media Library tools screen should have a clear responsibility split:
CRUD stays in dedicated dictionary tabs, while import/export/schema/example/clear actions live in the
Tools tab. The UI should not show implementation notes such as dated `@todo(...)` text to users.

## Implementation checklist

- [x] Review dictionary-related pages/components:
  - `client/src/pages/DictionaryManagement.tsx`;
  - `client/src/pages/DictionaryToolsPage.tsx`;
  - dictionary CRUD tabs/pages under `client/src/pages/` and `client/src/components/`.
- [x] Keep CRUD in dedicated dictionary tabs.
- [x] Keep import/export/schema/example/clear actions in the tools page/tab.
- [x] Remove the visible `@todo(2026-05-14)` paragraph from the UI.
- [x] Consolidate duplicate tool actions so import/export/template controls are exposed from the routed tools page.
- [x] Add Playwright coverage for dictionary navigation and tools placement.

## Acceptance criteria

- The Media Library Tools tab exposes import, schema, example, and export actions.
- CRUD tabs do not expose the import/export tools controls.
- No visible dated `@todo(2026-05-14)` paragraph remains in the frontend.

← back to [TODO](../../TODO.md)
