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
  assert.match(page, /data-admin-agent-empty/);
  assert.match(page, /data-admin-agent-empty-title/);
  assert.match(page, /data-admin-agent-context/);
  assert.match(page, /data-admin-agent-form/);
  assert.match(page, /data-admin-agent-input/);
  assert.match(page, /data-admin-agent-stop/);
  assert.match(page, /data-admin-agent-clear/);
  assert.match(page, /data-admin-agent-command="polish"/);
  assert.match(page, /data-admin-agent-command="continue"/);
  assert.match(page, /data-admin-agent-command="shorten"/);
  assert.match(page, /data-admin-agent-command="rewrite"/);
  assert.match(page, /data-admin-agent-command="structure"/);
  assert.match(page, /data-admin-agent-scope/);
  assert.match(page, /admin-post-agent-loader\.js/);
  assert.doesNotMatch(page, /import '\.\.\/\.\.\/\.\.\/\.\.\/scripts\/admin-post-agent\.js'/);
});

test('admin agent is loaded on intent instead of with the editor shell', () => {
  const loader = read('src/scripts/admin-post-agent-loader.js');

  assert.match(loader, /import\('\.\/admin-post-agent\.js'\)/);
  assert.match(loader, /pointerenter/);
  assert.match(loader, /focusin/);
  assert.match(loader, /admin-agent:open/);
  assert.match(loader, /data-agent-load-error/);
  assert.match(loader, /重新加载/);
  assert.match(loader, /aria-busy/);
  assert.doesNotMatch(loader, /requestIdleCallback|setTimeout/);
});

test('admin agent client supports context, cancellation, review, and bounded history', () => {
  const client = read('src/scripts/admin-post-agent.js');

  assert.match(client, /\/api\/admin\/assistant\/agent/);
  assert.match(client, /__postAgentBridge/);
  assert.match(client, /captureContext\?\.\(\)/);
  assert.match(client, /__postAgentBridge\?\.reviewProposal/);
  assert.match(client, /new AbortController/);
  assert.match(client, /\.slice\(-4\)/);
  assert.match(client, /admin-agent:open/);
  assert.match(client, /data-admin-agent-resize/);
  assert.match(client, /scopePreference:\s*scopeSelect\?\.value/);
  assert.match(client, /admin-agent:proposal-applied/);
  assert.match(client, /已接纳修改/);
  assert.match(client, /data-agent-undo/);
  assert.match(client, /__postAgentBridge\?\.undoLastChange/);
  assert.match(client, /response\.body\?\.getReader\(\)/);
  assert.match(client, /eventType === 'phase'/);
  assert.match(client, /eventType === 'result'/);
  assert.match(client, /eventType === 'delta'/);
  assert.match(client, /data-admin-agent-trace/);
  assert.match(client, /reviewProposal\(target,\s*result\.proposal,\s*result\.message\)/);
  assert.match(client, /admin-agent:selection-change/);
  assert.match(client, /已选内容 · \$\{length\}字/);
  assert.match(client, /想对选中内容做什么？/);
  assert.match(client, /询问或修改选中内容/);
  assert.match(client, /data-agent-retry/);
  assert.match(client, /重试/);
  assert.doesNotMatch(client, /action\.textContent = '查看修改'/);
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
