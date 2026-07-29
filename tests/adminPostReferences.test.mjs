import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildReferenceMarkdown,
  findReferenceTrigger,
} from '../src/scripts/admin-post-references.js';

test('buildReferenceMarkdown inserts a standard Markdown link', () => {
  assert.equal(
    buildReferenceMarkdown({ title: 'Agent系统', url: '/topics/agent-system' }),
    '[Agent系统](/topics/agent-system)',
  );
  assert.equal(
    buildReferenceMarkdown({ title: '书名[增订]', url: '/reading/book' }),
    '[书名\\[增订\\]](/reading/book)',
  );
});

test('findReferenceTrigger finds only an unfinished trigger before the caret', () => {
  const active = '引用 [[Agent';
  assert.deepEqual(findReferenceTrigger(active, active.length), {
    from: 3,
    to: active.length,
    query: 'Agent',
  });
  const closed = '引用 [[Agent]]';
  assert.equal(findReferenceTrigger(closed, closed.length), null);
  const multiline = '跨行 [[Agent\n下一行';
  assert.equal(findReferenceTrigger(multiline, multiline.length), null);
});

test('reference picker searches the admin API and supports keyboard selection', async () => {
  const source = await readFile(
    new URL('../src/scripts/admin-post-references.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /\/api\/admin\/references\?q=/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /Escape/);
  assert.match(source, /Enter/);
});

test('Milkdown attaches the reference picker after editor creation', async () => {
  const source = await readFile(
    new URL('../src/scripts/admin-post-milkdown.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /attachPostReferencePicker/);
  assert.match(source, /replaceRange\(markdown/);
});
