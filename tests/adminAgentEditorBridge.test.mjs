import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const editorUrl = new URL('../src/scripts/admin-post-milkdown.js', import.meta.url);
const editor = fs.readFileSync(editorUrl, 'utf8');

test('Milkdown exposes immutable context and review hooks to the admin agent', () => {
  assert.match(editor, /window\.__postAgentBridge\s*=\s*\{/);
  assert.match(editor, /captureContext/);
  assert.match(editor, /reviewProposal/);
  assert.match(editor, /aiReview\.openResult/);
  assert.match(editor, /return\s*\{\s*open,\s*openResult,\s*close\s*\}/);
});

test('editor AI entry points open the agent sidebar instead of a second prompt palette', () => {
  assert.match(editor, /admin-agent:open/);
  assert.doesNotMatch(editor, /createAIPalette/);
  assert.doesNotMatch(editor, /post-editor-ai-palette/);
  assert.doesNotMatch(editor, /\/api\/admin\/assistant\/write/);
});
