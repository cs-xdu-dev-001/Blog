import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const page = fs.readFileSync(new URL('../src/pages/admin/login.astro', import.meta.url), 'utf8');
const endpoint = fs.readFileSync(new URL('../src/pages/api/admin/login.ts', import.meta.url), 'utf8');

test('invalid credentials return to the login form', () => {
  assert.match(endpoint, /redirect\('\/admin\/login\?error=credentials'/);
  assert.doesNotMatch(endpoint, /new Response\('Invalid credentials'/);
});

test('login form exposes an inline authentication error', () => {
  assert.match(page, /Astro\.url\.searchParams\.get\('error'\)/);
  assert.match(page, /用户名或密码不正确/);
  assert.match(page, /role="alert"/);
});

test('login form prevents duplicate submissions', () => {
  assert.match(page, /data-admin-login/);
  assert.match(page, /submitButton\.disabled = true/);
  assert.match(page, /submitButton\.textContent = '正在登录'/);
});
