# Home Section Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every major home module the same scroll-triggered render feeling as the statistics section.

**Architecture:** Add a shared `data-reveal-section` marker to the home sections, use one IntersectionObserver to toggle `is-visible`, and keep section-specific reveal details in CSS. Existing statistics animations remain, but are triggered by the shared reveal system.

**Tech Stack:** Astro, plain CSS, vanilla browser JavaScript, Puppeteer screenshot verification.

---

### Task 1: Mark Home Sections

**Files:**
- Modify: `src/pages/index.astro`

- [ ] Add `data-reveal-section` to topic, watch, reading, statistics, and notes sections.
- [ ] Keep the existing `data-statistics-panel` attribute so statistics internals still work.

### Task 2: Add Shared Reveal CSS

**Files:**
- Modify: `src/styles/global.css`

- [ ] Add base reveal states without blur: section title, summary blocks, marquee shelves, bookshelves, notes panel.
- [ ] Add staggered delays for child cards and rows.
- [ ] Pause watch and reading carousel animations until the parent section is visible.
- [ ] Respect `prefers-reduced-motion`.

### Task 3: Replace Statistics-Only Observer

**Files:**
- Modify: `src/pages/index.astro`

- [ ] Replace the statistics-only observer with a shared section observer.
- [ ] When a section becomes visible, add `is-visible`.
- [ ] If the visible section contains `data-statistics-panel`, also add `is-visible` to that grid and run counters.

### Task 4: Verify

**Commands:**
- `npm run build`
- Use Puppeteer to screenshot home at desktop and mobile, including before/after scrolling into sections.

