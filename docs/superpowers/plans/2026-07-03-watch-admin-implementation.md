# Watch Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-hosted `/admin` watch archive management workflow for editing comments, quotes, ratings, featured state, and uploading per-title images.

**Architecture:** Convert the Astro site to SSR with a Node adapter, keep the public blog UI intact, and add a small SQLite-backed content layer. Admin pages and API routes are protected by a single administrator session cookie; the homepage reads watch archive data from SQLite on the server and falls back to existing generated data during migration.

**Tech Stack:** Astro 5 SSR, `@astrojs/node`, SQLite via `better-sqlite3`, Node `crypto`, Astro API routes, existing global CSS, Puppeteer for screenshots.

---

## File Structure

- `astro.config.mjs`: enable Node SSR output.
- `package.json`: add server, database, and admin scripts.
- `scripts/init-watch-db.mjs`: create SQLite schema and import existing watch data.
- `src/lib/server/db.mjs`: open SQLite connection and initialize schema.
- `src/lib/server/watchRepository.mjs`: read, filter, update, and image-path logic for watch items.
- `src/lib/server/auth.mjs`: password hashing, login verification, session cookie helpers.
- `src/pages/admin/login.astro`: dark login screen.
- `src/pages/admin/watch.astro`: darkMode watch management UI.
- `src/pages/api/admin/login.ts`: login endpoint.
- `src/pages/api/admin/logout.ts`: logout endpoint.
- `src/pages/api/admin/watch/index.ts`: list/search/filter endpoint.
- `src/pages/api/admin/watch/[id].ts`: update endpoint.
- `src/pages/api/admin/watch/[id]/image.ts`: image upload endpoint.
- `src/data/watchArchive.mjs`: become async-friendly or delegate to a server repository where needed.
- `src/pages/index.astro`: load watch archive from repository.
- `src/styles/global.css`: admin darkMode CSS.
- `tests/watchRepository.test.mjs`: repository behavior tests.
- `tests/auth.test.mjs`: auth/session tests.
- `tests/adminApi.test.mjs`: endpoint-level smoke tests where practical.

## Task 1: Install SSR And Database Dependencies

**Files:**
- Modify: `package.json`
- Modify: `astro.config.mjs`

- [ ] **Step 1: Install dependencies**

Run:

```powershell
npm install @astrojs/node better-sqlite3
```

Expected: `package.json` and `package-lock.json` include `@astrojs/node` and `better-sqlite3`.

- [ ] **Step 2: Enable Astro SSR Node adapter**

Change `astro.config.mjs` to:

```js
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
```

- [ ] **Step 3: Add scripts**

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "start": "node ./dist/server/entry.mjs",
    "db:init": "node scripts/init-watch-db.mjs",
    "astro": "astro"
  }
}
```

- [ ] **Step 4: Verify build still runs**

Run:

```powershell
npm run build
```

Expected: Astro builds server output without route errors.

## Task 2: Build SQLite Schema And Import Script

**Files:**
- Create: `scripts/init-watch-db.mjs`
- Create: `src/lib/server/db.mjs`
- Create: `src/lib/server/watchRepository.mjs`
- Test: `tests/watchRepository.test.mjs`

- [ ] **Step 1: Write repository test**

Create `tests/watchRepository.test.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createWatchRepository } from '../src/lib/server/watchRepository.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-repo-'));
const dbPath = path.join(tmp, 'watch.sqlite');
const uploadDir = path.join(tmp, 'uploads');

const repo = createWatchRepository({ dbPath, uploadDir });
repo.initialize();
repo.upsertMany([
  {
    title: '北平无战事',
    type: '剧集',
    status: '已看',
    rating: '4',
    comment: '',
    quote: '事情我们去做，两个字，稳妥。',
    quote_source: '网络公开台词整理',
    image_path: '',
    is_featured: 1,
  },
  {
    title: '隐入尘烟',
    type: '电影',
    status: '已看',
    rating: '4',
    comment: '',
    quote: '',
    quote_source: '',
    image_path: '',
    is_featured: 0,
  },
]);

assert.equal(repo.stats().total, 2);
assert.equal(repo.stats().missingQuote, 1);
assert.equal(repo.list({ query: '北平' }).items[0].title, '北平无战事');

const item = repo.list({ filter: 'missing_quote' }).items[0];
assert.equal(item.title, '隐入尘烟');

repo.update(item.id, {
  comment: '土地、沉默和人的命运。',
  quote: '啥人有啥人的命数呢，麦子也一样。',
  quote_source: '网络公开台词整理',
  rating: '4',
  status: '已看',
  is_featured: true,
});

const updated = repo.get(item.id);
assert.equal(updated.comment, '土地、沉默和人的命运。');
assert.equal(updated.is_featured, 1);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node tests\watchRepository.test.mjs
```

Expected: FAIL because `src/lib/server/watchRepository.mjs` does not exist.

- [ ] **Step 3: Implement database helper**

Create `src/lib/server/db.mjs`:

```js
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function getDefaultDbPath() {
  return process.env.BLOG_DB_PATH || path.resolve(process.cwd(), 'data', 'blog.sqlite');
}

export function openDatabase(dbPath = getDefaultDbPath()) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export function initializeSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS watch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      rating TEXT,
      comment TEXT NOT NULL DEFAULT '',
      quote TEXT NOT NULL DEFAULT '',
      quote_source TEXT NOT NULL DEFAULT '',
      image_path TEXT NOT NULL DEFAULT '',
      is_featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_items_title_type_status
      ON watch_items(title, type, status);
  `);
}
```

- [ ] **Step 4: Implement watch repository**

Create `src/lib/server/watchRepository.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { initializeSchema, openDatabase } from './db.mjs';

const allowedFilters = new Set([
  'all',
  'missing_image',
  'missing_comment',
  'missing_quote',
  'watched',
  'wanted',
  'featured',
]);

export function safeImageBaseName(title) {
  return title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'watch-image';
}

export function createWatchRepository({ dbPath, uploadDir } = {}) {
  const db = openDatabase(dbPath);
  const finalUploadDir = uploadDir || path.resolve(process.cwd(), 'public', 'uploads', 'watch');

  function initialize() {
    initializeSchema(db);
    fs.mkdirSync(finalUploadDir, { recursive: true });
  }

  function normalize(row) {
    return {
      ...row,
      is_featured: Number(row.is_featured || 0),
    };
  }

  return {
    initialize,

    upsertMany(items) {
      initialize();
      const stmt = db.prepare(`
        INSERT INTO watch_items
          (title, type, status, rating, comment, quote, quote_source, image_path, is_featured)
        VALUES
          (@title, @type, @status, @rating, @comment, @quote, @quote_source, @image_path, @is_featured)
        ON CONFLICT(title, type, status) DO UPDATE SET
          rating = excluded.rating,
          comment = COALESCE(NULLIF(watch_items.comment, ''), excluded.comment),
          quote = COALESCE(NULLIF(watch_items.quote, ''), excluded.quote),
          quote_source = COALESCE(NULLIF(watch_items.quote_source, ''), excluded.quote_source),
          image_path = COALESCE(NULLIF(watch_items.image_path, ''), excluded.image_path),
          is_featured = MAX(watch_items.is_featured, excluded.is_featured),
          updated_at = CURRENT_TIMESTAMP
      `);
      const tx = db.transaction((rows) => rows.forEach((row) => stmt.run({
        title: row.title,
        type: row.type,
        status: row.status,
        rating: row.rating ?? '',
        comment: row.comment ?? '',
        quote: row.quote ?? '',
        quote_source: row.quote_source ?? '',
        image_path: row.image_path ?? '',
        is_featured: row.is_featured ? 1 : 0,
      })));
      tx(items);
    },

    get(id) {
      initialize();
      const row = db.prepare('SELECT * FROM watch_items WHERE id = ?').get(id);
      return row ? normalize(row) : null;
    },

    list({ query = '', filter = 'all', limit = 500 } = {}) {
      initialize();
      const where = [];
      const params = {};
      const trimmedQuery = query.trim();
      const safeFilter = allowedFilters.has(filter) ? filter : 'all';

      if (trimmedQuery) {
        where.push('(title LIKE @query OR quote LIKE @query OR comment LIKE @query)');
        params.query = `%${trimmedQuery}%`;
      }
      if (safeFilter === 'missing_image') where.push("image_path = ''");
      if (safeFilter === 'missing_comment') where.push("comment = ''");
      if (safeFilter === 'missing_quote') where.push("quote = ''");
      if (safeFilter === 'watched') where.push("status = '已看'");
      if (safeFilter === 'wanted') where.push("status = '想看'");
      if (safeFilter === 'featured') where.push('is_featured = 1');

      const sql = `
        SELECT * FROM watch_items
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY is_featured DESC, updated_at DESC, id ASC
        LIMIT @limit
      `;
      const items = db.prepare(sql).all({ ...params, limit }).map(normalize);
      return { items, stats: this.stats() };
    },

    stats() {
      initialize();
      return {
        total: db.prepare('SELECT COUNT(*) AS n FROM watch_items').get().n,
        missingImage: db.prepare("SELECT COUNT(*) AS n FROM watch_items WHERE image_path = ''").get().n,
        missingComment: db.prepare("SELECT COUNT(*) AS n FROM watch_items WHERE comment = ''").get().n,
        missingQuote: db.prepare("SELECT COUNT(*) AS n FROM watch_items WHERE quote = ''").get().n,
      };
    },

    update(id, input) {
      initialize();
      db.prepare(`
        UPDATE watch_items SET
          status = @status,
          rating = @rating,
          comment = @comment,
          quote = @quote,
          quote_source = @quote_source,
          is_featured = @is_featured,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        id,
        status: input.status,
        rating: input.rating ?? '',
        comment: input.comment ?? '',
        quote: input.quote ?? '',
        quote_source: input.quote_source ?? '',
        is_featured: input.is_featured ? 1 : 0,
      });
      return this.get(id);
    },

    saveImage(id, { originalName, buffer }) {
      initialize();
      const item = this.get(id);
      if (!item) return null;
      const ext = path.extname(originalName).toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext) ? ext : '.jpg';
      const fileName = `${safeImageBaseName(item.title)}${safeExt}`;
      fs.mkdirSync(finalUploadDir, { recursive: true });
      fs.writeFileSync(path.join(finalUploadDir, fileName), buffer);
      const publicPath = `/uploads/watch/${encodeURIComponent(fileName).replaceAll('%2F', '/')}`;
      db.prepare("UPDATE watch_items SET image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(publicPath, id);
      return this.get(id);
    },
  };
}

export const watchRepository = createWatchRepository();
```

- [ ] **Step 5: Implement import script**

Create `scripts/init-watch-db.mjs`:

```js
import { watchItems } from '../src/data/watchItems.generated.mjs';
import { watchLines } from '../src/data/watchLines.mjs';
import { watchImages } from '../src/data/watchImages.mjs';
import { watchRepository } from '../src/lib/server/watchRepository.mjs';

const featuredTitles = new Set([
  '北平无战事',
  '隐入尘烟',
  '一九四二',
  '柳如是',
  '南京照相馆',
  '主角',
  '飞驰人生3',
  '一念天堂',
]);

watchRepository.initialize();
watchRepository.upsertMany(watchItems.map((item) => ({
  title: item.title,
  type: item.type,
  status: item.status,
  rating: item.rating ?? '',
  comment: '',
  quote: watchLines[item.title]?.text ?? '',
  quote_source: watchLines[item.title]?.source ?? '',
  image_path: watchImages[item.title] ?? '',
  is_featured: featuredTitles.has(item.title) ? 1 : 0,
})));

console.log(`Imported ${watchItems.length} watch items`);
```

- [ ] **Step 6: Run repository test**

Run:

```powershell
node tests\watchRepository.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Initialize development database**

Run:

```powershell
npm run db:init
```

Expected: `data/blog.sqlite` exists and output says `Imported 362 watch items`.

## Task 3: Add Authentication Helpers And Login

**Files:**
- Create: `src/lib/server/auth.mjs`
- Create: `tests/auth.test.mjs`
- Create: `src/pages/admin/login.astro`
- Create: `src/pages/api/admin/login.ts`
- Create: `src/pages/api/admin/logout.ts`

- [ ] **Step 1: Write auth test**

Create `tests/auth.test.mjs`:

```js
import assert from 'node:assert/strict';
import {
  createPasswordHash,
  createSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../src/lib/server/auth.mjs';

const hash = createPasswordHash('secret-password', 'fixed-salt');
assert.equal(verifyPassword('secret-password', hash), true);
assert.equal(verifyPassword('wrong-password', hash), false);

const token = createSessionToken('admin', 'session-secret');
assert.equal(verifySessionToken(token, 'session-secret')?.username, 'admin');
assert.equal(verifySessionToken(`${token}x`, 'session-secret'), null);
```

- [ ] **Step 2: Run auth test to verify it fails**

Run:

```powershell
node tests\auth.test.mjs
```

Expected: FAIL because `src/lib/server/auth.mjs` does not exist.

- [ ] **Step 3: Implement auth helper**

Create `src/lib/server/auth.mjs`:

```js
import crypto from 'node:crypto';

const SESSION_COOKIE = 'dev_notes_session';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export function createPasswordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [scheme, salt, hash] = String(storedHash || '').split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), candidate);
}

export function createSessionToken(username, secret = process.env.ADMIN_SESSION_SECRET || 'dev-only-session-secret') {
  const payload = base64url(JSON.stringify({ username, createdAt: Date.now() }));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token, secret = process.env.ADMIN_SESSION_SECRET || 'dev-only-session-secret') {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.username === 'string' ? data : null;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function requireAdmin(AstroOrRequest) {
  const cookies = AstroOrRequest.cookies;
  const token = cookies.get(SESSION_COOKIE)?.value;
  return Boolean(verifySessionToken(token));
}
```

- [ ] **Step 4: Create login page**

Create `src/pages/admin/login.astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
---

<BaseLayout title="Dev Notes CMS Login" chrome={false} shell={false}>
  <main class="admin-login-page">
    <form class="admin-login-card" method="post" action="/api/admin/login">
      <span>Dev Notes CMS</span>
      <h1>登录管理端</h1>
      <label>
        用户名
        <input name="username" autocomplete="username" required />
      </label>
      <label>
        密码
        <input name="password" type="password" autocomplete="current-password" required />
      </label>
      <button type="submit">进入控制台</button>
    </form>
  </main>
</BaseLayout>
```

- [ ] **Step 5: Create login API**

Create `src/pages/api/admin/login.ts`:

```ts
import type { APIRoute } from 'astro';
import {
  createSessionToken,
  getSessionCookieName,
  verifyPassword,
} from '../../../lib/server/auth.mjs';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const username = String(form.get('username') || '');
  const password = String(form.get('password') || '');
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminHash = process.env.ADMIN_PASSWORD_HASH || '';

  if (username !== adminUser || !adminHash || !verifyPassword(password, adminHash)) {
    return new Response('Invalid credentials', { status: 401 });
  }

  cookies.set(getSessionCookieName(), createSessionToken(username), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return redirect('/admin/watch');
};
```

- [ ] **Step 6: Create logout API**

Create `src/pages/api/admin/logout.ts`:

```ts
import type { APIRoute } from 'astro';
import { getSessionCookieName } from '../../../lib/server/auth.mjs';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(getSessionCookieName(), { path: '/' });
  return redirect('/admin/login');
};
```

- [ ] **Step 7: Run auth test**

Run:

```powershell
node tests\auth.test.mjs
```

Expected: PASS.

## Task 4: Implement Admin APIs

**Files:**
- Create: `src/pages/api/admin/watch/index.ts`
- Create: `src/pages/api/admin/watch/[id].ts`
- Create: `src/pages/api/admin/watch/[id]/image.ts`

- [ ] **Step 1: Create list endpoint**

Create `src/pages/api/admin/watch/index.ts`:

```ts
import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { watchRepository } from '../../../../lib/server/watchRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });
  const url = new URL(context.request.url);
  const query = url.searchParams.get('query') || '';
  const filter = url.searchParams.get('filter') || 'all';
  return Response.json(watchRepository.list({ query, filter }));
};
```

- [ ] **Step 2: Create update endpoint**

Create `src/pages/api/admin/watch/[id].ts`:

```ts
import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { watchRepository } from '../../../../lib/server/watchRepository.mjs';

export const PUT: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });
  const id = Number(context.params.id);
  const body = await context.request.json();
  const updated = watchRepository.update(id, {
    status: String(body.status || '已看'),
    rating: String(body.rating || ''),
    comment: String(body.comment || ''),
    quote: String(body.quote || ''),
    quote_source: String(body.quote_source || ''),
    is_featured: Boolean(body.is_featured),
  });
  if (!updated) return new Response('Not found', { status: 404 });
  return Response.json({ item: updated, stats: watchRepository.stats() });
};
```

- [ ] **Step 3: Create image upload endpoint**

Create `src/pages/api/admin/watch/[id]/image.ts`:

```ts
import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/server/auth.mjs';
import { watchRepository } from '../../../../../lib/server/watchRepository.mjs';

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });
  const id = Number(context.params.id);
  const form = await context.request.formData();
  const file = form.get('image');
  if (!(file instanceof File)) return new Response('Missing image', { status: 400 });
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
    return new Response('Unsupported image type', { status: 415 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return new Response('Image too large', { status: 413 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const updated = watchRepository.saveImage(id, { originalName: file.name, buffer });
  if (!updated) return new Response('Not found', { status: 404 });
  return Response.json({ item: updated, stats: watchRepository.stats() });
};
```

## Task 5: Build DarkMode Admin UI

**Files:**
- Create: `src/pages/admin/watch.astro`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Create protected admin page**

Create `src/pages/admin/watch.astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { requireAdmin } from '../../lib/server/auth.mjs';

if (!requireAdmin(Astro)) {
  return Astro.redirect('/admin/login');
}
---

<BaseLayout title="Dev Notes CMS" chrome={false} shell={false}>
  <main class="cms-page" data-watch-admin>
    <header class="cms-topbar">
      <a class="cms-brand" href="/admin/watch"><span>DN</span> Dev Notes CMS</a>
      <input class="cms-search" type="search" placeholder="搜索影视名、评论、佳句..." data-watch-search />
      <div class="cms-actions">
        <a href="/" target="_blank" rel="noreferrer">预览前台</a>
        <form method="post" action="/api/admin/logout"><button type="submit">退出</button></form>
      </div>
    </header>

    <div class="cms-layout">
      <aside class="cms-sidebar">
        <span>Content Modules</span>
        <a class="active" href="/admin/watch">影像档案</a>
        <a aria-disabled="true">阅读档案</a>
        <a aria-disabled="true">文章草稿</a>
        <a aria-disabled="true">站点配置</a>
        <span>Quick Actions</span>
        <button data-filter="missing_image">扫描缺图</button>
        <button data-filter="missing_comment">扫描缺评论</button>
        <button data-filter="missing_quote">扫描缺佳句</button>
      </aside>

      <section class="cms-main">
        <div class="cms-hero">
          <div>
            <span>Archive Health</span>
            <h1>影像内容控制台</h1>
            <p>写评论、填佳句、上传影视图。保存后前台即时生效。</p>
          </div>
          <strong data-save-state>ONLINE / DB CONNECTED</strong>
        </div>

        <div class="cms-metrics" data-watch-stats></div>
        <div class="cms-filters">
          <button data-filter="all" class="active">全部</button>
          <button data-filter="missing_image">缺图</button>
          <button data-filter="missing_comment">缺评论</button>
          <button data-filter="missing_quote">缺佳句</button>
          <button data-filter="watched">已看</button>
          <button data-filter="wanted">想看</button>
          <button data-filter="featured">精选</button>
        </div>
        <div class="cms-list" data-watch-list></div>
      </section>

      <aside class="cms-editor" data-watch-editor>
        <p>从左侧选择一个影视条目开始编辑。</p>
      </aside>
    </div>
  </main>

  <script src="/admin-watch.js"></script>
</BaseLayout>
```

- [ ] **Step 2: Add admin CSS**

Append focused darkMode CMS styles to `src/styles/global.css`. Use selectors prefixed with `.cms-` and keep them isolated from the public homepage.

- [ ] **Step 3: Add admin client script**

Create `public/admin-watch.js` with:

```js
const state = {
  items: [],
  stats: null,
  selected: null,
  filter: 'all',
  query: '',
};

const listEl = document.querySelector('[data-watch-list]');
const statsEl = document.querySelector('[data-watch-stats]');
const editorEl = document.querySelector('[data-watch-editor]');
const searchEl = document.querySelector('[data-watch-search]');
const saveStateEl = document.querySelector('[data-save-state]');

async function loadItems() {
  const params = new URLSearchParams({ filter: state.filter, query: state.query });
  const res = await fetch(`/api/admin/watch?${params}`);
  if (!res.ok) throw new Error('Failed to load watch items');
  const data = await res.json();
  state.items = data.items;
  state.stats = data.stats;
  if (!state.selected && state.items[0]) state.selected = state.items[0];
  render();
}

function renderStats() {
  statsEl.innerHTML = [
    ['总条目', state.stats.total, '全部影视档案'],
    ['缺图', state.stats.missingImage, '需要上传图片'],
    ['缺评论', state.stats.missingComment, '等待个人评论'],
    ['缺佳句', state.stats.missingQuote, '等待佳句摘录'],
  ].map(([label, value, hint]) => `
    <article class="cms-metric"><span>${label}</span><strong>${value}</strong><p>${hint}</p></article>
  `).join('');
}

function renderList() {
  listEl.innerHTML = state.items.map((item) => `
    <button class="cms-item ${state.selected?.id === item.id ? 'active' : ''}" data-id="${item.id}">
      <span class="cms-thumb" style="background-image: linear-gradient(180deg, transparent, rgba(0,0,0,.68)), url('${item.image_path || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80'}')"></span>
      <span><small>${item.status} / ${item.type}</small><strong>${item.title}</strong><em>${item.quote || item.comment || '等待补充内容'}</em></span>
      <b>${item.image_path ? '有图' : '缺图'}</b>
    </button>
  `).join('');
  listEl.querySelectorAll('[data-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selected = state.items.find((item) => item.id === Number(button.dataset.id));
      render();
    });
  });
}

function renderEditor() {
  const item = state.selected;
  if (!item) {
    editorEl.innerHTML = '<p>从左侧选择一个影视条目开始编辑。</p>';
    return;
  }
  editorEl.innerHTML = `
    <span>Live Editor</span>
    <div class="cms-preview" style="background-image: linear-gradient(180deg, transparent, rgba(0,0,0,.72)), url('${item.image_path || 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=900&q=80'}')"><strong>${item.title}</strong></div>
    <form data-edit-form>
      <label>状态
        <select name="status">
          <option ${item.status === '已看' ? 'selected' : ''}>已看</option>
          <option ${item.status === '想看' ? 'selected' : ''}>想看</option>
        </select>
      </label>
      <label>评分 <input name="rating" value="${item.rating || ''}" /></label>
      <label>个人评论 <textarea name="comment">${item.comment || ''}</textarea></label>
      <label>佳句 <textarea name="quote">${item.quote || ''}</textarea></label>
      <label>佳句来源 <input name="quote_source" value="${item.quote_source || ''}" /></label>
      <label class="cms-check"><input type="checkbox" name="is_featured" ${item.is_featured ? 'checked' : ''} /> 精选展示</label>
      <button type="submit">保存内容</button>
    </form>
    <form data-image-form>
      <label>上传对应图片 <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
      <button type="submit">上传图片</button>
    </form>
  `;
  editorEl.querySelector('[data-edit-form]').addEventListener('submit', saveSelected);
  editorEl.querySelector('[data-image-form]').addEventListener('submit', uploadImage);
}

function render() {
  renderStats();
  renderList();
  renderEditor();
}

async function saveSelected(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  saveStateEl.textContent = 'SAVING';
  const res = await fetch(`/api/admin/watch/${state.selected.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: form.get('status'),
      rating: form.get('rating'),
      comment: form.get('comment'),
      quote: form.get('quote'),
      quote_source: form.get('quote_source'),
      is_featured: form.get('is_featured') === 'on',
    }),
  });
  const data = await res.json();
  state.selected = data.item;
  saveStateEl.textContent = 'SAVED';
  await loadItems();
}

async function uploadImage(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  saveStateEl.textContent = 'UPLOADING';
  const res = await fetch(`/api/admin/watch/${state.selected.id}/image`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  state.selected = data.item;
  saveStateEl.textContent = 'IMAGE SAVED';
  await loadItems();
}

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((el) => el.classList.toggle('active', el === button));
    loadItems();
  });
});

searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(loadItems, 180);
});

loadItems();
```

## Task 6: Connect Homepage To Database

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/data/watchArchive.mjs` or create `src/lib/server/watchArchiveView.mjs`
- Test: `tests/watchArchive.test.mjs`

- [ ] **Step 1: Create server view adapter**

Create `src/lib/server/watchArchiveView.mjs`:

```js
import { watchRepository } from './watchRepository.mjs';

export function getWatchArchiveFromDb() {
  const { items } = watchRepository.list({ limit: 1000 });
  const mapped = items.map((item) => ({
    title: item.title,
    type: item.type,
    status: item.status,
    rating: item.rating,
    image: item.image_path,
    line: item.quote || item.comment || '已收录到影像档案',
    lineSource: item.quote_source || (item.comment ? '个人评论' : null),
  }));
  const splitIndex = Math.ceil(mapped.length / 2);
  return {
    motion: { durationSeconds: 520 },
    stats: {
      watched: mapped.filter((item) => item.status === '已看').length,
      wanted: mapped.filter((item) => item.status === '想看').length,
      series: mapped.filter((item) => item.type === '剧集').length,
      films: mapped.filter((item) => item.type === '电影').length,
    },
    selected: mapped.filter((item) => item.lineSource).slice(0, 8).map((item) => item.title),
    wantedPreview: mapped.filter((item) => item.status === '想看').slice(0, 12).map((item) => item.title),
    items: mapped,
    rows: [
      { direction: 'normal', items: mapped.slice(0, splitIndex) },
      { direction: 'reverse', items: mapped.slice(splitIndex) },
    ],
  };
}
```

- [ ] **Step 2: Use database archive in homepage**

In `src/pages/index.astro`, replace:

```js
import { watchArchive } from '../data/watchArchive.mjs';
```

with:

```js
import { getWatchArchiveFromDb } from '../lib/server/watchArchiveView.mjs';
const watchArchive = getWatchArchiveFromDb();
```

Keep the existing rendering markup unchanged.

- [ ] **Step 3: Run homepage smoke build**

Run:

```powershell
npm run db:init
npm run build
```

Expected: build passes and homepage renders from SQLite.

## Task 7: Visual Verification

**Files:**
- No source changes unless screenshots reveal defects.

- [ ] **Step 1: Start dev server**

Run:

```powershell
npm run dev -- --host 127.0.0.1
```

Expected: Astro dev server starts.

- [ ] **Step 2: Verify admin requires login**

Open `/admin/watch`.

Expected: redirected to `/admin/login`.

- [ ] **Step 3: Generate admin password hash**

Run:

```powershell
node -e "import('./src/lib/server/auth.mjs').then(({createPasswordHash})=>console.log(createPasswordHash('change-me-now')))"
```

Set environment variables for dev:

```powershell
$env:ADMIN_USERNAME='admin'
$env:ADMIN_PASSWORD_HASH='<printed hash>'
$env:ADMIN_SESSION_SECRET='local-dev-session-secret'
npm run dev -- --host 127.0.0.1
```

Expected: login with `admin` / `change-me-now` succeeds.

- [ ] **Step 4: Screenshot admin desktop and mobile**

Use Puppeteer to capture `/admin/watch` at 1440x1000 and 390x900 after login.

Expected:
- darkMode fills viewport.
- no white brainstorming frame.
- sidebar, list, editor are readable.
- mobile stacks without horizontal page overflow.

- [ ] **Step 5: Verify front page update**

Edit a test item comment or quote in admin, save, refresh `/`.

Expected: the matching watch card uses the new quote/comment.

## Self-Review

- Spec coverage: login, server-side data, comments, quotes, ratings, featured state, image upload, immediate homepage sync, and darkMode admin UI are covered.
- Scope control: reading archive, article editor, and site config are intentionally excluded from implementation tasks.
- Placeholder scan: no `TBD` or open-ended implementation placeholders remain.
