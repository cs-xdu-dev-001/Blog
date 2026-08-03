import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexPage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

test('homepage SSR output is deterministic for the same archive data', () => {
  const frontmatterEnd = indexPage.indexOf('\n---', 4);
  const serverFrontmatter = indexPage.slice(0, frontmatterEnd);

  assert.doesNotMatch(serverFrontmatter, /Math\.random/);
  assert.match(serverFrontmatter, /stableWatchOffset/);
});

test('homepage generic containers do not expose ineffective aria labels', () => {
  const labeledDivs = [...indexPage.matchAll(/<div\b[^>]*\baria-label=[^>]*>/g)].map(([tag]) => tag);
  assert.ok(labeledDivs.length > 0);
  labeledDivs.forEach((tag) => assert.match(tag, /\brole=/));
});

test('homepage watch archive renders a fixed card pool instead of the full duplicated archive', () => {
  assert.doesNotMatch(indexPage, /\[\.\.\.row\.items,\s*\.\.\.row\.items\]/);
  assert.match(indexPage, /const WATCH_TRACK_BATCH_SIZE = 12/);
  assert.match(indexPage, /const WATCH_TRACK_CATALOG_SIZE = 48/);
  assert.match(indexPage, /takeWatchBatch\(fullCatalog, catalogStart, WATCH_TRACK_CATALOG_SIZE\)/);
  assert.match(indexPage, /data-watch-catalog/);
  assert.match(indexPage, /decoding="async"/);
  assert.match(indexPage, /fetchpriority="low"/);
});

test('homepage motion uses delegated interactions and pauses work outside the visible foreground', () => {
  assert.doesNotMatch(indexPage, /querySelectorAll\('\[data-watch-detail\]'\)\.forEach/);
  assert.match(indexPage, /const finePointer = window\.matchMedia\('\(hover: hover\) and \(pointer: fine\)'\)/);
  assert.match(indexPage, /watchSection\?\.addEventListener\('dblclick'/);
  assert.match(indexPage, /animationiteration/);
  assert.match(indexPage, /document\.addEventListener\('visibilitychange'/);
  assert.match(indexPage, /new ResizeObserver/);
  assert.doesNotMatch(indexPage, /orbitStage\?\.getBoundingClientRect\(\)\.width/);
});

test('touch users can open topic and watch cards with one tap', () => {
  assert.match(indexPage, /const coarsePointer = window\.matchMedia/);
  assert.match(indexPage, /if \(coarsePointer\.matches\) \{\s*openTopicHref\(card\)/);
  assert.match(indexPage, /watchMarquee\?\.addEventListener\('click'/);
});

test('mobile watch tracks keep lightweight motion and expose a shared pause state', () => {
  assert.doesNotMatch(
    styles,
    /@media\s*\(max-width:\s*760px\)[\s\S]*?\.qzq-watch-track\s*\{[^}]*animation:\s*none/,
  );
  assert.match(
    styles,
    /\.qzq-watch-marquee\.is-motion-paused\s+\.qzq-watch-track\s*\{[^}]*animation-play-state:\s*paused/,
  );
  assert.match(
    styles,
    /\.qzq-orbit-stage\.is-motion-paused\s+\.qzq-orbit\s*\{[^}]*animation-play-state:\s*paused/,
  );
});
