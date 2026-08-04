import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const tempRoot = path.join(root, '.tmp', 'e2e');
await rm(tempRoot, { recursive: true, force: true });

const build = spawnSync('npm run build', {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  shell: true,
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status || 1);

await import('./start-server.mjs');
