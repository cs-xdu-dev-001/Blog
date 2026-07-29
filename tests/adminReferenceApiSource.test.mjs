import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routePath = new URL('../src/pages/api/admin/references.ts', import.meta.url);

test('admin reference search is authenticated and bounded', async () => {
  const source = await readFile(routePath, 'utf8');
  assert.match(source, /requireAdmin\(context\)/);
  assert.match(source, /contentReferenceService\.search\(query/);
  assert.match(source, /query\.length > 100/);
  assert.match(source, /Cache-Control': 'no-store/);
});
