import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('nginx serves uploaded media directly with bounded methods and caching', () => {
  const config = fs.readFileSync(path.resolve('deploy', 'nginx-uploads.conf'), 'utf8');
  assert.match(config, /location \^~ \/uploads\//);
  assert.match(config, /alias \/srv\/blog\/public\/uploads\//);
  assert.match(config, /limit_except GET HEAD/);
  assert.match(config, /autoindex off/);
  assert.match(config, /max-age=604800/);
});
