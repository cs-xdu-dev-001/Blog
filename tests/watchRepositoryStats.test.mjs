import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const source = fs.readFileSync(new URL('../src/lib/server/watchRepository.mjs', import.meta.url), 'utf8');

test('watch statistics use one aggregate query instead of four table scans', () => {
  const statsSource = source.match(/stats\(\) \{([\s\S]*?)\n    \},\n\n    update/)?.[1] || '';
  assert.match(statsSource, /COUNT\(\*\) AS total/);
  assert.match(statsSource, /SUM\(CASE WHEN image_path = ''/);
  assert.match(statsSource, /SUM\(CASE WHEN comment = ''/);
  assert.match(statsSource, /SUM\(CASE WHEN quote = ''/);
  assert.equal((statsSource.match(/db\.prepare\(/g) || []).length, 1);
});
