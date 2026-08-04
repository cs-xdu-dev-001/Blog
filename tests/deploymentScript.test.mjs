import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../deploy/deploy-blog.sh', import.meta.url), 'utf8');

test('production deployment script uses the blog user and guards restarts with readiness checks', () => {
  assert.match(source, /BLOG_USER="\$\{BLOG_USER:-blog\}"/);
  assert.match(source, /git_blog status --short/);
  assert.match(source, /git_blog merge --ff-only/);
  assert.match(source, /npm_blog run build/);
  assert.match(source, /systemctl restart "\$\{SERVICE_NAME\}"/);
  assert.match(source, /READY_URL="\$\{READY_URL:-http:\/\/127\.0\.0\.1:4321\/ready\}"/);
  assert.match(source, /rollback_service "\$\{old_commit\}"/);
  assert.match(source, /构建失败，服务未重启/);
  assert.doesNotMatch(source, /\.env|public\/uploads|nginx|certbot/);
});
