import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { createPostRepository } from '../src/lib/server/postRepository.mjs';

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dev-notes-locked-posts-')), 'blog.sqlite');
}

test('locked posts keep metadata public but store body and description encrypted', () => {
  const dbPath = tempDbPath();
  const repo = createPostRepository({ dbPath });

  const created = repo.create({
    title: '弱敏感笔记',
    category: '随记',
    description: '只有解锁后才能看摘要',
    body: '这里是弱敏感正文 secret-local-term',
    published: true,
    visibility: 'locked',
    lockedNoteKey: 'open-sesame',
    tags: ['私密'],
  });

  assert.equal(created.locked, true);
  assert.equal(created.title, '弱敏感笔记');
  assert.equal(created.description, '');
  assert.equal(created.body, '');

  const rawDb = new Database(dbPath, { readonly: true });
  const raw = rawDb.prepare('SELECT description, body, encrypted_description, encrypted_body, visibility FROM blog_posts WHERE id = ?').get(created.id);
  rawDb.close();

  assert.equal(raw.visibility, 'locked');
  assert.equal(raw.description, '');
  assert.equal(raw.body, '');
  assert.notEqual(raw.encrypted_description, '');
  assert.notEqual(raw.encrypted_body, '');
  assert.equal(JSON.stringify(raw).includes('secret-local-term'), false);

  const publicPost = repo.getBySlug(created.slug);
  assert.equal(publicPost.locked, true);
  assert.equal(publicPost.body, '');
  assert.equal(publicPost.data.description, '');

  const unlocked = repo.getBySlug(created.slug, { unlockKey: 'open-sesame' });
  assert.equal(unlocked.body, '这里是弱敏感正文 secret-local-term');
  assert.equal(unlocked.description, '只有解锁后才能看摘要');
  assert.equal(unlocked.data.description, '只有解锁后才能看摘要');
});

test('locked post list can match metadata but never searches encrypted body', () => {
  const repo = createPostRepository({ dbPath: tempDbPath() });
  repo.create({
    title: '可见标题',
    body: 'hidden-body-token',
    published: true,
    visibility: 'locked',
    lockedNoteKey: 'open-sesame',
    tags: ['主线'],
  });

  assert.equal(repo.list({ query: '可见标题', filter: 'published' }).items.length, 1);
  assert.equal(repo.list({ query: '主线', filter: 'published' }).items.length, 1);
  assert.equal(repo.list({ query: 'hidden-body-token', filter: 'published' }).items.length, 0);
});
