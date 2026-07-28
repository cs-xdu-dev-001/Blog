import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const editorUrl = new URL('../src/scripts/admin-post-milkdown.js', import.meta.url);
const editor = fs.readFileSync(editorUrl, 'utf8');
const stylesUrl = new URL('../src/styles/global.css', import.meta.url);
const styles = fs.readFileSync(stylesUrl, 'utf8');

test('Milkdown exposes immutable context and review hooks to the admin agent', () => {
  assert.match(editor, /window\.__postAgentBridge\s*=\s*\{/);
  assert.match(editor, /captureContext/);
  assert.match(editor, /reviewProposal/);
  assert.match(editor, /aiReview\.openResult/);
  assert.match(editor, /data-ai-review-note/);
  assert.match(editor, /reviewProposal:\s*\(target,\s*proposal,\s*message/);
  assert.match(editor, /root\.closest\('\.post-editor-write'\)/);
  assert.match(editor, /coordsAtPos\(review\.from\)/);
  assert.match(editor, /classList\.toggle\('is-selection'/);
  assert.match(editor, /crypto\.randomUUID\(\)/);
  assert.match(editor, /sourceDocument:\s*document/);
  assert.match(editor, /reviewIsCurrent\(review,\s*\{\s*activeReviewId,\s*currentDocument,\s*documentSize\s*\}\)/);
  assert.match(editor, /审阅已过期，请重新生成/);
  assert.match(editor, /aria-label="放弃修改"/);
  assert.match(editor, /aria-label="接纳修改"/);
  assert.match(editor, />✕<\/button>/);
  assert.match(editor, />✓<\/button>/);
  assert.match(editor, /post-ai-review-change/);
  assert.match(editor, /new CustomEvent\('admin-agent:proposal-applied'/);
  assert.match(editor, /listener\.selectionUpdated/);
  assert.match(editor, /new CustomEvent\('admin-agent:selection-change'/);
  assert.match(editor, /length:\s*Array\.from\(selection\)\.length/);
  assert.match(editor, /scope:\s*review\.scope/);
  assert.match(editor, /undoLastChange/);
  assert.match(editor, /undo\(view\.state,\s*view\.dispatch\)/);
  assert.match(styles, /\.post-ai-review-change/);
  assert.match(styles, /\.post-ai-review-removed/);
  assert.match(styles, /\.post-ai-review-added/);
  assert.match(styles, /\.post-editor-ai-review\.is-selection/);
  assert.match(editor, /return\s*\{\s*open,\s*openResult,\s*close\s*\}/);
});

test('editor AI entry points open the agent sidebar instead of a second prompt palette', () => {
  assert.match(editor, /admin-agent:open/);
  assert.doesNotMatch(editor, /createAIPalette/);
  assert.doesNotMatch(editor, /post-editor-ai-palette/);
  assert.doesNotMatch(editor, /\/api\/admin\/assistant\/write/);
});
