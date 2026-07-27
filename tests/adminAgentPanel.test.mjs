import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  const url = new URL(`../${relativePath}`, import.meta.url);
  return fs.existsSync(url) ? fs.readFileSync(url, 'utf8') : '';
}

test('post editor contains one docked admin agent panel', () => {
  const page = read('src/pages/admin/posts/[id]/edit.astro');

  assert.match(page, /data-admin-agent-toggle/);
  assert.match(page, /data-admin-agent-panel/);
  assert.match(page, /data-admin-agent-messages/);
  assert.match(page, /data-admin-agent-form/);
  assert.match(page, /data-admin-agent-input/);
  assert.match(page, /data-admin-agent-stop/);
  assert.match(page, /data-admin-agent-clear/);
  assert.match(page, /admin-post-agent\.js/);
});

test('admin agent client supports context, cancellation, review, and bounded history', () => {
  const client = read('src/scripts/admin-post-agent.js');

  assert.match(client, /\/api\/admin\/assistant\/agent/);
  assert.match(client, /__postAgentBridge/);
  assert.match(client, /captureContext\?\.\(\)/);
  assert.match(client, /__postAgentBridge\?\.reviewProposal/);
  assert.match(client, /new AbortController/);
  assert.match(client, /\.slice\(-8\)/);
  assert.match(client, /admin-agent:open/);
  assert.match(client, /data-admin-agent-resize/);
});

test('locked notes must be unlocked before the agent reads or edits their body', () => {
  const page = read('src/pages/admin/posts/[id]/edit.astro');
  const client = read('src/scripts/admin-post-agent.js');

  assert.match(page, /data-agent-editor-locked=/);
  assert.match(client, /page\?\.dataset\.agentEditorLocked === 'true'/);
  assert.match(client, /请先解锁笔记/);
});

test('admin agent uses a docked responsive layout without blocking editor scrolling', () => {
  const styles = read('src/styles/global.css');

  assert.match(styles, /--post-agent-width:\s*380px/);
  assert.match(styles, /\.post-editor-agent-panel/);
  assert.match(styles, /\.post-editor-agent-messages\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(styles, /@media\s*\(max-width:\s*900px\)/);
});
