# Reading Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reading management page that mirrors the watch CMS: edit book metadata, quotes, reviews, featured state, and upload covers.

**Architecture:** Store reading items in SQLite beside watch items. Frontend reading pages read from DB first and fall back to `src/data/readingArchive.mjs` if the DB is empty or unavailable. Admin APIs reuse the existing auth/session guard.

**Tech Stack:** Astro SSR, `better-sqlite3`, native browser JS, existing CMS CSS.

---

### Task 1: Reading Repository

**Files:**
- Modify: `src/lib/server/db.mjs`
- Create: `src/lib/server/readingRepository.mjs`
- Test: `tests/readingRepository.test.mjs`

- [ ] Write a failing test covering insert, list, filters, update, and cover upload.
- [ ] Add `reading_items` schema to `initializeSchema`.
- [ ] Implement `createReadingRepository`.
- [ ] Run `node tests\readingRepository.test.mjs`.

### Task 2: Frontend DB View

**Files:**
- Create: `src/lib/server/readingArchiveView.mjs`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/reading.astro`
- Modify: `src/pages/reading/[slug].astro`

- [ ] Add server view helpers for featured books, groups, and slug lookup with local fallback.
- [ ] Switch pages to read from server view helpers.
- [ ] Make reading detail SSR dynamic so admin edits appear without rebuild.
- [ ] Run `npm run build`.

### Task 3: Admin APIs and UI

**Files:**
- Create: `src/pages/admin/reading.astro`
- Create: `src/pages/api/admin/reading/index.ts`
- Create: `src/pages/api/admin/reading/[id].ts`
- Create: `src/pages/api/admin/reading/[id]/image.ts`
- Create: `public/admin-reading.js`
- Modify: `src/pages/admin/watch.astro`
- Modify: `src/styles/global.css` only if the existing CMS styles need one small reusable class.

- [ ] Build `/admin/reading` using the existing CMS shell.
- [ ] Add list/filter/search/edit/upload behavior in `admin-reading.js`.
- [ ] Add authenticated CRUD-like update APIs.
- [ ] Run browser checks for login redirect, list rendering, save, and upload form presence.

### Task 4: Seed and Verification

**Files:**
- Modify: `scripts/init-watch-db.mjs`
- Test: `tests/readingArchive.test.mjs`

- [ ] Seed reading DB from `readingArchive`.
- [ ] Run `npm run db:init`.
- [ ] Run reading/watch repository and archive tests.
- [ ] Run `npm run build`.
