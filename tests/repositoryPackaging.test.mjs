import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredSources = [
  'src/data/readingArchive.mjs',
  'src/data/watchArchive.mjs',
  'src/data/watchImages.mjs',
  'src/data/watchItems.generated.mjs',
  'src/data/watchLines.mjs',
];

test('runtime data modules are tracked and not excluded by repository ignore rules', () => {
  for (const source of requiredSources) {
    const ignored = spawnSync('git', ['check-ignore', '--no-index', '-q', '--', source], {
      cwd: projectRoot,
    });
    assert.notEqual(ignored.status, 0, `${source} must not be ignored by .gitignore`);

    const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '--', source], {
      cwd: projectRoot,
    });
    assert.equal(tracked.status, 0, `${source} must be tracked by git`);
  }
});
