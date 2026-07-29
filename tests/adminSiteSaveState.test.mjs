import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const client = fs.readFileSync(new URL('../public/admin-site.js', import.meta.url), 'utf8');
const pages = ['site', 'home', 'assistant', 'about']
  .map((name) => fs.readFileSync(new URL(`../src/pages/admin/${name}.astro`, import.meta.url), 'utf8'));

test('site settings save one snapshot at a time without overwriting edits made in flight', () => {
  assert.match(client, /if \(!state\.loaded \|\| state\.saving\) return/);
  assert.match(client, /submittedSignature/);
  assert.match(client, /currentPayloadSignature\(\) === submittedSignature/);
  assert.match(client, /有新修改未保存/);
  assert.match(client, /setSaveDisabled\(true\)/);
  assert.match(client, /setSaveDisabled\(false\)/);
});

test('site settings warn before leaving with unsaved or in-flight changes', () => {
  assert.match(client, /beforeunload/);
  assert.match(client, /!state\.dirty && !state\.saving/);
  assert.match(client, /event\.returnValue = ''/);
});

test('assistant connection testing keeps unsaved state visible and handles network failure', () => {
  assert.match(client, /testAssistantButton\.disabled = true/);
  assert.match(client, /测试失败：网络不可用/);
  assert.match(client, /setStatus\(state\.dirty \? '未保存' : '已保存'\)/);
});

test('site settings use the standard save shortcut', () => {
  assert.match(client, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(client, /event\.key\.toLowerCase\(\) !== 's'/);
  assert.match(client, /form\?\.requestSubmit\(\)/);
});

test('site settings expose save state without adding extra explanatory copy', () => {
  assert.match(client, /saveState\.dataset\.state/);
  pages.forEach((page) => assert.match(page, /data-save-state aria-live="polite"/));
});
