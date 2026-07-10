# Watch Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chinese “影像档案” module to the homepage using the user's watched and want-to-watch CSV data.

**Architecture:** Keep the module static and small. Store curated watch archive stats and title samples in one local data module, import it into the Astro homepage, and style it with the existing qzq-inspired marquee and tilt interaction system.

**Tech Stack:** Astro, plain JavaScript data module, global CSS, Puppeteer screenshot verification.

---

### Task 1: Watch Archive Data

**Files:**
- Create: `tests/watchArchive.test.mjs`
- Create: `src/data/watchArchive.mjs`

- [ ] **Step 1: Write a failing data contract test**

```js
import assert from 'node:assert/strict';
import { watchArchive } from '../src/data/watchArchive.mjs';

assert.equal(watchArchive.stats.watched, 261);
assert.equal(watchArchive.stats.wanted, 101);
assert.equal(watchArchive.stats.series, 168);
assert.equal(watchArchive.stats.films, 93);
assert.ok(watchArchive.selected.length >= 8);
assert.ok(watchArchive.wantedPreview.length >= 10);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/watchArchive.test.mjs`
Expected: FAIL because `src/data/watchArchive.mjs` does not exist.

- [ ] **Step 3: Add the data module**

Create `src/data/watchArchive.mjs` with real aggregate counts and curated title samples from the CSV.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/watchArchive.test.mjs`
Expected: PASS.

### Task 2: Homepage Module

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Import `watchArchive` into the homepage**

Use the existing homepage data pattern and add a new section between topics and latest writing.

- [ ] **Step 2: Build the Chinese “影像档案” section**

Render stats, selected watched titles, and wantlist preview as moving cards.

- [ ] **Step 3: Style with the existing qzq visual language**

Reuse warm gray canvas, orange accent, horizontal motion, hover pause, and mouse tilt.

- [ ] **Step 4: Verify build and screenshots**

Run: `npm run build`
Run Puppeteer screenshots at 1440px and 390px.
Expected: no build errors, no horizontal overflow, module looks coherent on desktop and mobile.
