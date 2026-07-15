import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const styles = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const header = fs.readFileSync(new URL('../src/components/Header.astro', import.meta.url), 'utf8');

test('shared public header stays readable and hands off to content without oversized gaps', () => {
  assert.doesNotMatch(header, /\bmb-24\b/);
  assert.doesNotMatch(header, /\btext-sm\b/);
  assert.match(styles, /\.site-header\s*\{[^}]*margin-bottom:\s*32px[^}]*font-size:\s*16px/);
  assert.match(styles, /\.topic-page\s*\{[^}]*padding:\s*24px 0 112px/);
  assert.match(styles, /\.topic-page-heading\s*\{[^}]*margin-top:\s*36px/);
  assert.match(styles, /\.writing-hero\s*\{[^}]*margin:\s*56px 0 72px/);
});

test('public pages define tablet and mobile reflow contracts', () => {
  assert.match(styles, /@media\s*\(max-width:\s*900px\)[\s\S]*\.qzq-nav/);
  assert.match(styles, /@media\s*\(max-width:\s*900px\)[\s\S]*\.qzq-socials\s*\{[^}]*display:\s*flex/);
  assert.match(styles, /@media\s*\(max-width:\s*900px\)[\s\S]*\.writing-row\s*\{[^}]*grid-template-columns:\s*40px minmax\(0, 1fr\)/);
  assert.match(styles, /@media\s*\(max-width:\s*900px\)[\s\S]*\.site-nav\s*\{[^}]*flex-wrap:\s*nowrap/);
  assert.match(styles, /@media\s*\(max-width:\s*900px\)[\s\S]*\.global-search-trigger-minimal\s*\{[^}]*order:\s*-1/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)[\s\S]*\.qzq-nav-links[\s\S]*overflow-x:\s*auto/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)[\s\S]*\.global-search-layout[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(styles, /\.global-search\.is-previewing\s+\.global-search-results[\s\S]*display:\s*none/);
  assert.match(styles, /\.global-search:not\(\.is-previewing\)\s+\.global-search-preview[\s\S]*display:\s*none/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)[\s\S]*\.dn-assistant-panel[\s\S]*resize:\s*none/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)[\s\S]*\.watch-review-header[\s\S]*grid-template-columns:\s*1fr/);
});

test('narrow public layouts keep local scrollers without widening the page', () => {
  assert.match(styles, /@media\s*\(max-width:\s*1100px\)[\s\S]*\.watch-review-quote,[\s\S]*\.watch-review-body\s*\{[^}]*margin-left:\s*0/);
  assert.match(styles, /\.qzq-watch-marquee[\s\S]*max-width:\s*100%/);
  assert.match(styles, /\.qzq-bookshelf[\s\S]*overflow-x:\s*auto/);
  assert.match(styles, /\.article-prose\s+pre[\s\S]*overflow-x:\s*auto/);
});
