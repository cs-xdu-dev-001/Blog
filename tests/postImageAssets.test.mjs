import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createPostRepository } from '../src/lib/server/postRepository.mjs';
import {
  collectReferencedPostImagePaths,
  normalizePostImagePath,
} from '../src/lib/server/postImageAssets.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-post-assets-'));
  const uploadDir = path.join(root, 'uploads');
  fs.mkdirSync(path.join(uploadDir, 'original'), { recursive: true });
  return {
    root,
    uploadDir,
    repository: createPostRepository({ dbPath: path.join(root, 'blog.sqlite'), uploadDir }),
  };
}

function createAssetFiles(uploadDir, stem) {
  const files = [`${stem}-960.webp`, `${stem}-480.webp`, `original/${stem}.png`];
  files.forEach((file) => {
    const target = path.join(uploadDir, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'image');
  });
  return {
    imagePath: `/uploads/posts/${stem}-960.webp`,
    smallPath: `/uploads/posts/${stem}-480.webp`,
    originalPath: `/uploads/posts/original/${stem}.png`,
  };
}

test('markdown image references are parsed and normalized safely', () => {
  const refs = collectReferencedPostImagePaths('![图](/uploads/posts/a%20b-960.webp?x=1)\n\n[链接](/uploads/posts/not-image.webp)');
  assert.deepEqual([...refs], ['/uploads/posts/a%20b-960.webp']);
  assert.equal(normalizePostImagePath('/uploads/posts/../secret.png'), '');
  assert.equal(normalizePostImagePath('/uploads/watch/a.png'), '');
});

test('post image assets follow references and are removed after the grace period', () => {
  const { root, uploadDir, repository } = fixture();
  try {
    const post = repository.create({ title: '图片生命周期', body: '' });
    const image = createAssetFiles(uploadDir, 'asset');
    repository.registerImageAsset(post.id, image);
    assert.equal(repository.listImageAssets(post.id)[0].referenced, 0);

    repository.update(post.id, { ...post, body: `![图片](${image.imagePath})` });
    assert.equal(repository.listImageAssets(post.id)[0].referenced, 1);

    repository.update(post.id, { ...post, body: '图片已移除' });
    assert.equal(repository.listImageAssets(post.id)[0].referenced, 0);
    const before = new Date(Date.now() + 60_000);
    const preview = repository.cleanupUnreferencedImages({ before, dryRun: true });
    assert.equal(preview.candidates.length, 1);
    assert.equal(fs.existsSync(path.join(uploadDir, 'asset-960.webp')), true);

    const removed = repository.cleanupUnreferencedImages({ before, dryRun: false });
    assert.equal(removed.removedAssets, 1);
    assert.equal(removed.removedFiles, 3);
    assert.deepEqual(repository.listImageAssets(post.id), []);
  } finally {
    repository.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deleting a post removes all registered image variants', () => {
  const { root, uploadDir, repository } = fixture();
  try {
    const post = repository.create({ title: '删除图片', body: '' });
    const image = createAssetFiles(uploadDir, 'delete-me');
    repository.registerImageAsset(post.id, image);
    assert.equal(repository.remove(post.id), true);
    assert.equal(fs.existsSync(path.join(uploadDir, 'delete-me-960.webp')), false);
    assert.equal(fs.existsSync(path.join(uploadDir, 'delete-me-480.webp')), false);
    assert.equal(fs.existsSync(path.join(uploadDir, 'original', 'delete-me.png')), false);
  } finally {
    repository.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('locked post plaintext updates still keep referenced registered images', () => {
  const { root, uploadDir, repository } = fixture();
  try {
    const key = 'private-key';
    const post = repository.create({ title: '加密图片', visibility: 'locked', lockedNoteKey: key, body: '' });
    const image = createAssetFiles(uploadDir, 'locked');
    repository.registerImageAsset(post.id, image);
    repository.update(post.id, {
      title: post.title,
      visibility: 'locked',
      lockedNoteKey: key,
      body: `![图片](${image.imagePath})`,
      published: true,
    });
    assert.equal(repository.listImageAssets(post.id)[0].referenced, 1);
  } finally {
    repository.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
