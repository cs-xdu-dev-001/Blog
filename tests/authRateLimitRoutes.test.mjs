import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('login and locked-note unlock routes enforce the shared attempt limiters', () => {
  const login = read('src/pages/api/admin/login.ts');
  const publicUnlock = read('src/pages/api/posts/[slug]/unlock.ts');
  const adminUnlock = read('src/pages/api/admin/posts/[id]/unlock.ts');

  assert.match(login, /adminLoginAttemptLimiter\.consume/);
  assert.match(login, /adminLoginAttemptLimiter\.reset/);
  assert.match(publicUnlock, /lockedNoteAttemptLimiter\.consume/);
  assert.match(publicUnlock, /lockedNoteAttemptLimiter\.reset/);
  assert.match(adminUnlock, /lockedNoteAttemptLimiter\.consume/);
  assert.match(adminUnlock, /lockedNoteAttemptLimiter\.reset/);
  assert.match(adminUnlock, /Retry-After/);
});
