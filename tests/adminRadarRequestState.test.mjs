import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const client = fs.readFileSync(new URL('../public/admin-radar.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../src/pages/admin/radar.astro', import.meta.url), 'utf8');

test('radar index cancels stale requests and keeps the current list while refreshing', () => {
  assert.match(client, /loadController\?\.abort\(\)/);
  assert.match(client, /signal:\s*controller\.signal/);
  assert.match(client, /if \(loadController !== controller\) return/);
  assert.match(client, /error\?\.name === 'AbortError'/);
  assert.match(client, /listEl\.setAttribute\('aria-busy', 'true'\)/);
  assert.doesNotMatch(client, /listEl\.innerHTML = ['"]正在读取/);
});

test('radar index exposes an in-place retry after a real load failure', () => {
  assert.match(page, /data-radar-error/);
  assert.match(page, /data-radar-retry/);
  assert.match(client, /data-radar-retry/);
  assert.match(client, /errorEl\.hidden = false/);
});

test('radar mutations are single-flight and recover their controls after failure', () => {
  assert.match(client, /if \(operationPending\) return/);
  assert.match(client, /setOperationPending\(true\)/);
  assert.match(client, /finally \{\s*setOperationPending\(false\)/);
  assert.match(client, /保存失败（\$\{response\.status\}）/);
  assert.match(client, /删除失败（\$\{response\.status\}）/);
  assert.match(page, /data-save-radar/);
});
