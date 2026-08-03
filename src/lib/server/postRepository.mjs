import fs from 'node:fs';
import path from 'node:path';
import { initializeSchema, openDatabase } from './db.mjs';
import { normalizeAdminPagination, publicPagination } from './adminPagination.mjs';
import { existingImageVariants, removeImageVariants, storedImagePaths } from './imageVariants.mjs';
import {
  collectReferencedPostImagePaths,
  normalizePostImagePath,
  postImageAssetIsReferenced,
} from './postImageAssets.mjs';
import {
  decryptLockedText,
  encryptLockedText,
  normalizeLockedNoteKey,
  resolveLockedNoteKey,
} from './lockedNoteCrypto.mjs';

const allowedFilters = new Set(['all', 'published', 'draft', 'featured']);

const pinyinSlugMap = new Map([
  ['近期笔记测试', 'recent-note-test'],
]);

export function slugifyPost(value) {
  const text = String(value || '').trim();
  if (pinyinSlugMap.has(text)) return pinyinSlugMap.get(text);
  const ascii = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii;
  const encoded = Array.from(text)
    .map((char) => char.codePointAt(0).toString(36))
    .join('-');
  return encoded || `post-${Date.now().toString(36)}`;
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = text ? new Date(text) : new Date();
  if (Number.isNaN(date.valueOf())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function normalizeTopicSlugs(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(items
    .map((item) => String(item || '')
      .trim()
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, ''))
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function normalizeTags(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
      .replace(/^\s*\[/, '')
      .replace(/\]\s*$/, '')
      .split(/[,，\n]/);
  const seen = new Set();
  const tags = [];
  source.forEach((item) => {
    const tag = String(item || '')
      .trim()
      .replace(/^#+/, '')
      .replace(/^['"]|['"]$/g, '')
      .replace(/\s+/g, ' ');
    const key = tag.toLocaleLowerCase('zh-CN');
    if (!tag || seen.has(key)) return;
    seen.add(key);
    tags.push(tag);
  });
  return tags;
}

function parseTags(value) {
  if (Array.isArray(value)) return normalizeTags(value);
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return normalizeTags(parsed);
  } catch {
    return normalizeTags(text);
  }
}

function normalizePostKind(value, category = '') {
  const kind = String(value || '').trim().toLowerCase();
  if (kind === 'reflection') return 'reflection';
  if (kind === 'technical') return 'technical';

  const legacyCategory = String(category || '').trim().toLowerCase();
  return legacyCategory === '随记' ? 'reflection' : 'technical';
}

function categoryForPostKind(kind) {
  return kind === 'reflection' ? '随记' : 'Notes';
}

function labelForPostKind(kind) {
  return kind === 'reflection' ? '随记' : '技术笔记';
}

function legacyCategoryTag(value) {
  const category = String(value || '').trim();
  const genericCategories = new Set(['', 'notes', '技术', '技术笔记', '随记']);
  return genericCategories.has(category.toLocaleLowerCase('zh-CN')) ? '' : category;
}

function preparePostTaxonomy(input = {}, existing = null) {
  const sourceCategory = Object.hasOwn(input, 'category')
    ? input.category
    : existing?.category;
  const kind = normalizePostKind(input.kind, sourceCategory);
  const sourceTags = Object.hasOwn(input, 'tags') ? input.tags : existing?.tags;
  const legacyTag = legacyCategoryTag(sourceCategory);
  const tags = normalizeTags([
    ...parseTags(sourceTags),
    ...(legacyTag ? [legacyTag] : []),
  ]);

  return {
    kind,
    category: categoryForPostKind(kind),
    tags,
  };
}

function normalizeVisibility(value) {
  return String(value || '').trim().toLowerCase() === 'locked' ? 'locked' : 'public';
}

function preparePostContent(input = {}, existing = null) {
  const visibility = normalizeVisibility(input.visibility || (input.locked ? 'locked' : existing?.visibility));
  const description = String(input.description ?? existing?.description ?? '').trim();
  const body = String(input.body ?? existing?.body ?? '');

  if (visibility !== 'locked') {
    return {
      visibility: 'public',
      description,
      body,
      encryptedDescription: '',
      encryptedBody: '',
    };
  }

  const key = resolveLockedNoteKey(input.lockedNoteKey);
  if (!key) throw new Error('locked note key is required');
  return {
    visibility: 'locked',
    description: '',
    body: '',
    encryptedDescription: encryptLockedText(description, key),
    encryptedBody: encryptLockedText(body, key),
  };
}

function normalize(row, topicSlugs = [], { unlockKey = '' } = {}) {
  if (!row) return null;
  const tags = parseTags(row.tags);
  const kind = normalizePostKind('', row.category);
  const kindLabel = labelForPostKind(kind);
  const visibility = normalizeVisibility(row.visibility);
  const locked = visibility === 'locked';
  const key = normalizeLockedNoteKey(unlockKey);
  let description = String(row.description || '');
  let body = String(row.body || '');
  let lockedContentUnlocked = false;

  if (locked) {
    description = '';
    body = '';
    if (key) {
      description = decryptLockedText(row.encrypted_description || '', key);
      body = decryptLockedText(row.encrypted_body || '', key);
      lockedContentUnlocked = true;
    }
  }

  return {
    ...row,
    description,
    body,
    visibility,
    locked,
    lockedContentUnlocked,
    featured: Number(row.featured || 0),
    published: Number(row.published || 0),
    topicSlugs,
    tags,
    kind,
    kindLabel,
    data: {
      title: row.title,
      description,
      category: kindLabel,
      kind,
      kindLabel,
      date: new Date(row.date),
      featured: Boolean(row.featured),
      tags,
      locked,
    },
  };
}

function parseFrontmatter(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '');
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: text };

  const data = {};
  match[1].split('\n').forEach((line) => {
    const item = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!item) return;
    let value = item[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value === 'true') data[item[1]] = true;
    else if (value === 'false') data[item[1]] = false;
    else if (item[1] === 'tags') data[item[1]] = normalizeTags(value);
    else data[item[1]] = value;
  });

  return { data, body: match[2] };
}

export function createPostRepository({ dbPath, uploadDir } = {}) {
  const db = openDatabase(dbPath);
  const postUploadDir = path.resolve(uploadDir || path.join(process.cwd(), 'public', 'uploads', 'posts'));
  const postPublicBase = '/uploads/posts';
  let initialized = false;

  function migrateLegacyCategories() {
    const rows = db.prepare(`
      SELECT id, category, tags
      FROM blog_posts
      WHERE TRIM(COALESCE(category, '')) NOT IN ('Notes', '随记')
    `).all();
    if (!rows.length) return;
    const update = db.prepare(`
      UPDATE blog_posts
      SET category = @category, tags = @tags
      WHERE id = @id
    `);
    const migrate = db.transaction((items) => {
      items.forEach((row) => {
        const taxonomy = preparePostTaxonomy({}, row);
        const tags = JSON.stringify(taxonomy.tags);
        if (row.category === taxonomy.category && row.tags === tags) return;
        update.run({
          id: row.id,
          category: taxonomy.category,
          tags,
        });
      });
    });
    migrate(rows);
  }

  function initialize() {
    if (initialized) return;
    initializeSchema(db);
    migrateLegacyCategories();
    initialized = true;
  }

  function uniqueSlug(base, id = null) {
    let slug = slugifyPost(base);
    let index = 2;
    while (true) {
      const row = db.prepare('SELECT id FROM blog_posts WHERE slug = ?').get(slug);
      if (!row || row.id === id) return slug;
      slug = `${slugifyPost(base)}-${index}`;
      index += 1;
    }
  }

  function topicSlugsForPost(postId) {
    return db.prepare(`
      SELECT topic_slug
      FROM post_topic_links
      WHERE post_id = ?
      ORDER BY topic_slug ASC
    `).all(postId).map((row) => row.topic_slug);
  }

  function normalizeWithTopics(row, options = {}) {
    return normalize(row, row ? topicSlugsForPost(row.id) : [], options);
  }

  function normalizeRowsWithTopics(rows, options = {}) {
    if (!rows.length) return [];
    const topicMap = new Map(rows.map((row) => [row.id, []]));
    const placeholders = rows.map(() => '?').join(', ');
    db.prepare(`
      SELECT post_id, topic_slug
      FROM post_topic_links
      WHERE post_id IN (${placeholders})
      ORDER BY post_id ASC, topic_slug ASC
    `).all(...rows.map((row) => row.id)).forEach((link) => {
      topicMap.get(link.post_id)?.push(link.topic_slug);
    });
    return rows.map((row) => normalize(row, topicMap.get(row.id) || [], options));
  }

  function setPostTopics(postId, topicSlugs = []) {
    const slugs = normalizeTopicSlugs(topicSlugs);
    const tx = db.transaction((items) => {
      const existingOrders = new Map(db.prepare(`
        SELECT topic_slug, sort_order
        FROM post_topic_links
        WHERE post_id = ?
      `).all(postId).map((row) => [row.topic_slug, Number(row.sort_order || 0)]));
      db.prepare('DELETE FROM post_topic_links WHERE post_id = ?').run(postId);
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO post_topic_links (post_id, topic_slug, sort_order)
        VALUES (@postId, @topicSlug, @sortOrder)
      `);
      const maxOrder = db.prepare(`
        SELECT COALESCE(MAX(sort_order), 0) AS value
        FROM post_topic_links
        WHERE topic_slug = ?
      `);
      items.forEach((topicSlug) => {
        const currentMax = Number(maxOrder.get(topicSlug).value || 0);
        const sortOrder = existingOrders.has(topicSlug)
          ? existingOrders.get(topicSlug)
          : currentMax > 0 ? currentMax + 10 : 0;
        stmt.run({ postId, topicSlug, sortOrder });
      });
    });
    tx(slugs);
    return slugs;
  }

  function setTopicPostOrder(topicSlug, postIds = []) {
    const slug = normalizeTopicSlugs([topicSlug])[0];
    if (!slug) throw new Error('topic slug is required');
    const ids = [...new Set((Array.isArray(postIds) ? postIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0))];
    const exists = db.prepare('SELECT id FROM blog_posts WHERE id = ?');
    const validIds = ids.filter((id) => Boolean(exists.get(id)));
    const tx = db.transaction((orderedIds) => {
      db.prepare('DELETE FROM post_topic_links WHERE topic_slug = ?').run(slug);
      const insert = db.prepare(`
        INSERT INTO post_topic_links (post_id, topic_slug, sort_order)
        VALUES (@postId, @topicSlug, @sortOrder)
      `);
      orderedIds.forEach((postId, index) => insert.run({
        postId,
        topicSlug: slug,
        sortOrder: (index + 1) * 10,
      }));
    });
    tx(validIds);
    return validIds;
  }

  function imageAssetsForPost(postId) {
    return db.prepare(`
      SELECT * FROM post_image_assets
      WHERE post_id = ?
      ORDER BY id ASC
    `).all(postId);
  }

  function syncImageAssets(postId, markdown) {
    const references = collectReferencedPostImagePaths(markdown);
    const assets = imageAssetsForPost(postId);
    const markReferenced = db.prepare(`
      UPDATE post_image_assets
      SET referenced = 1, unreferenced_at = NULL
      WHERE id = ?
    `);
    const markUnreferenced = db.prepare(`
      UPDATE post_image_assets
      SET referenced = 0, unreferenced_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    assets.forEach((asset) => {
      const referenced = postImageAssetIsReferenced(asset, references);
      if (referenced && !asset.referenced) markReferenced.run(asset.id);
      if (!referenced && asset.referenced) markUnreferenced.run(asset.id);
    });
    return { total: assets.length, referenced: assets.filter((asset) => postImageAssetIsReferenced(asset, references)).length };
  }

  return {
    initialize,

    close() {
      if (db.open) db.close();
    },

    create(input = {}) {
      initialize();
      const title = String(input.title || '').trim();
      if (!title) throw new Error('title is required');
      const slug = uniqueSlug(input.slug || title);
      const content = preparePostContent(input);
      const taxonomy = preparePostTaxonomy(input);
      const result = db.prepare(`
        INSERT INTO blog_posts
          (slug, title, description, category, tags, body, visibility, encrypted_description, encrypted_body, date, featured, published)
        VALUES
          (@slug, @title, @description, @category, @tags, @body, @visibility, @encryptedDescription, @encryptedBody, @date, @featured, @published)
      `).run({
        slug,
        title,
        description: content.description,
        category: taxonomy.category,
        tags: JSON.stringify(taxonomy.tags),
        body: content.body,
        visibility: content.visibility,
        encryptedDescription: content.encryptedDescription,
        encryptedBody: content.encryptedBody,
        date: normalizeDate(input.date),
        featured: input.featured ? 1 : 0,
        published: input.published === false ? 0 : 1,
      });
      setPostTopics(result.lastInsertRowid, input.topicSlugs || []);
      return this.get(result.lastInsertRowid);
    },

    upsertBySlug(input = {}) {
      initialize();
      const title = String(input.title || '').trim();
      if (!title) throw new Error('title is required');
      const slug = slugifyPost(input.slug || title);
      const content = preparePostContent(input);
      const taxonomy = preparePostTaxonomy(input);
      db.prepare(`
        INSERT INTO blog_posts
          (slug, title, description, category, tags, body, visibility, encrypted_description, encrypted_body, date, featured, published)
        VALUES
          (@slug, @title, @description, @category, @tags, @body, @visibility, @encryptedDescription, @encryptedBody, @date, @featured, @published)
        ON CONFLICT(slug) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          category = excluded.category,
          tags = excluded.tags,
          body = excluded.body,
          visibility = excluded.visibility,
          encrypted_description = excluded.encrypted_description,
          encrypted_body = excluded.encrypted_body,
          date = excluded.date,
          featured = excluded.featured,
          published = excluded.published,
          updated_at = CURRENT_TIMESTAMP
      `).run({
        slug,
        title,
        description: content.description,
        category: taxonomy.category,
        tags: JSON.stringify(taxonomy.tags),
        body: content.body,
        visibility: content.visibility,
        encryptedDescription: content.encryptedDescription,
        encryptedBody: content.encryptedBody,
        date: normalizeDate(input.date),
        featured: input.featured ? 1 : 0,
        published: input.published === false ? 0 : 1,
      });
      const saved = this.getBySlug(slug, { includeDraft: true });
      if (Object.hasOwn(input, 'topicSlugs')) setPostTopics(saved.id, input.topicSlugs);
      return this.getBySlug(slug);
    },

    importFromDirectory(dir = path.resolve(process.cwd(), 'src', 'content', 'posts')) {
      initialize();
      if (!fs.existsSync(dir)) return { imported: 0 };
      const files = fs.readdirSync(dir).filter((file) => file.endsWith('.md'));
      files.forEach((file) => {
        const { data, body } = parseFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
        this.upsertBySlug({
          slug: path.basename(file, '.md'),
          title: data.title || path.basename(file, '.md'),
          description: data.description || '',
          date: data.date,
          kind: data.kind,
          category: data.category,
          tags: data.tags || [],
          featured: Boolean(data.featured),
          published: true,
          body,
        });
      });
      return { imported: files.length };
    },

    ensureSeededFromContent() {
      initialize();
      const count = db.prepare('SELECT COUNT(*) AS n FROM blog_posts').get().n;
      if (count > 0) return { imported: 0 };
      return this.importFromDirectory();
    },

    get(id, { unlockKey = '' } = {}) {
      initialize();
      return normalizeWithTopics(db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id), { unlockKey });
    },

    getBySlug(slug, { includeDraft = false, unlockKey = '' } = {}) {
      initialize();
      const row = includeDraft
        ? db.prepare('SELECT * FROM blog_posts WHERE slug = ?').get(slug)
        : db.prepare('SELECT * FROM blog_posts WHERE slug = ? AND published = 1').get(slug);
      return normalizeWithTopics(row, { unlockKey });
    },

    list({ query = '', filter = 'published', limit = 500, topicSlug = '', kind = 'all', page, pageSize } = {}) {
      initialize();
      const safeFilter = allowedFilters.has(filter) ? filter : 'published';
      const where = [];
      const params = { limit };
      const normalizedTopicSlug = normalizeTopicSlugs([topicSlug])[0];
      const trimmedQuery = String(query || '').trim();
      if (trimmedQuery) {
        where.push("(p.title LIKE @query OR p.category LIKE @query OR p.tags LIKE @query OR (COALESCE(p.visibility, 'public') <> 'locked' AND (p.description LIKE @query OR p.body LIKE @query)))");
        params.query = `%${trimmedQuery}%`;
      }
      if (normalizedTopicSlug) {
        where.push('pt.topic_slug = @topicSlug');
        params.topicSlug = normalizedTopicSlug;
      }
      if (safeFilter === 'published') where.push('p.published = 1');
      if (safeFilter === 'draft') where.push('p.published = 0');
      if (safeFilter === 'featured') where.push('p.featured = 1');
      if (kind === 'technical' || kind === 'reflection') {
        where.push('p.category = @kindCategory');
        params.kindCategory = categoryForPostKind(kind);
      }
      const join = normalizedTopicSlug ? 'JOIN post_topic_links pt ON pt.post_id = p.id' : '';
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const paginated = page !== undefined || pageSize !== undefined;
      let pagination = null;
      if (paginated) {
        const total = db.prepare(`SELECT COUNT(*) AS total FROM blog_posts p ${join} ${whereSql}`).get(params).total;
        pagination = normalizeAdminPagination({ page, pageSize, total });
        params.limit = pagination.pageSize;
        params.offset = pagination.offset;
      }
      const rows = db.prepare(`
        SELECT p.* FROM blog_posts p
        ${join}
        ${whereSql}
        ORDER BY ${normalizedTopicSlug ? 'pt.sort_order ASC, p.date DESC, p.id DESC' : 'p.date DESC, p.id DESC'}
        LIMIT @limit
        ${paginated ? 'OFFSET @offset' : ''}
      `).all(params);
      const items = normalizeRowsWithTopics(rows);
      return {
        items,
        stats: this.stats(),
        ...(pagination ? { pagination: publicPagination(pagination) } : {}),
      };
    },

    setTopicPostOrder,

    registerImageAsset(postId, image = {}) {
      initialize();
      const id = Number(postId);
      if (!Number.isInteger(id) || id <= 0 || !db.prepare('SELECT id FROM blog_posts WHERE id = ?').get(id)) {
        throw new Error('post not found');
      }
      const imagePath = normalizePostImagePath(image.imagePath ?? image.image_path);
      const smallPath = normalizePostImagePath(image.smallPath ?? image.small_path);
      const originalPath = normalizePostImagePath(image.originalPath ?? image.original_path);
      if (!imagePath) throw new Error('invalid post image path');
      db.prepare(`
        INSERT INTO post_image_assets
          (post_id, image_path, small_path, original_path, referenced, unreferenced_at)
        VALUES
          (@postId, @imagePath, @smallPath, @originalPath, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(image_path) DO UPDATE SET
          post_id = excluded.post_id,
          small_path = excluded.small_path,
          original_path = excluded.original_path
      `).run({ postId: id, imagePath, smallPath, originalPath });
      return db.prepare('SELECT * FROM post_image_assets WHERE image_path = ?').get(imagePath);
    },

    listImageAssets(postId) {
      initialize();
      return imageAssetsForPost(Number(postId));
    },

    syncImageAssets(postId, markdown) {
      initialize();
      return syncImageAssets(Number(postId), markdown);
    },

    cleanupUnreferencedImages({ before = new Date(), dryRun = true } = {}) {
      initialize();
      const beforeDate = before instanceof Date ? before : new Date(before);
      if (Number.isNaN(beforeDate.valueOf())) throw new Error('invalid cleanup cutoff');
      const candidates = db.prepare(`
        SELECT * FROM post_image_assets
        WHERE referenced = 0
          AND unreferenced_at IS NOT NULL
          AND unreferenced_at <= datetime(@before)
        ORDER BY id ASC
      `).all({ before: beforeDate.toISOString() });
      if (dryRun) return { dryRun: true, candidates, removedAssets: 0, removedFiles: 0 };

      let removedAssets = 0;
      let removedFiles = 0;
      candidates.forEach((asset) => {
        const paths = storedImagePaths(asset);
        removedFiles += removeImageVariants(paths, {
          uploadDir: postUploadDir,
          publicBase: postPublicBase,
        });
        if (existingImageVariants(paths, {
          uploadDir: postUploadDir,
          publicBase: postPublicBase,
        }).length) return;
        removedAssets += db.prepare('DELETE FROM post_image_assets WHERE id = ? AND referenced = 0').run(asset.id).changes;
      });
      return { dryRun: false, candidates, removedAssets, removedFiles };
    },

    listTags() {
      initialize();
      const tagMap = new Map();
      db.prepare('SELECT tags FROM blog_posts ORDER BY date DESC, id DESC').all().forEach((row) => {
        parseTags(row.tags).forEach((tag) => {
          const key = tag.toLocaleLowerCase('zh-CN');
          if (!tagMap.has(key)) tagMap.set(key, tag);
        });
      });
      return [...tagMap.values()].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    },

    deleteTag(value) {
      initialize();
      const [target] = normalizeTags(value);
      if (!target) return { ok: false, changedPosts: 0, tags: this.listTags() };

      const targetKey = target.toLocaleLowerCase('zh-CN');
      const rows = db.prepare('SELECT id, tags FROM blog_posts').all();
      let changedPosts = 0;
      const update = db.prepare(`
        UPDATE blog_posts SET
          tags = @tags,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `);
      const tx = db.transaction((items) => {
        items.forEach((row) => {
          const tags = parseTags(row.tags);
          const nextTags = tags.filter((tag) => tag.toLocaleLowerCase('zh-CN') !== targetKey);
          if (nextTags.length === tags.length) return;
          changedPosts += 1;
          update.run({ id: row.id, tags: JSON.stringify(nextTags) });
        });
      });
      tx(rows);

      return { ok: changedPosts > 0, changedPosts, tags: this.listTags() };
    },

    stats() {
      initialize();
      const row = db.prepare(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN published = 1 THEN 1 ELSE 0 END), 0) AS published,
          COALESCE(SUM(CASE WHEN published = 0 THEN 1 ELSE 0 END), 0) AS draft,
          COALESCE(SUM(CASE WHEN featured = 1 THEN 1 ELSE 0 END), 0) AS featured
        FROM blog_posts
      `).get();
      return {
        total: row.total,
        published: row.published,
        draft: row.draft,
        featured: row.featured,
      };
    },

    update(id, input = {}) {
      initialize();
      const existing = this.get(id);
      if (!existing) return null;
      const title = String(input.title || existing.title).trim();
      if (!title) throw new Error('title is required');
      const slug = uniqueSlug(input.slug || existing.slug || title, id);
      const content = preparePostContent(input, existing);
      const taxonomy = preparePostTaxonomy(input, existing);
      db.prepare(`
        UPDATE blog_posts SET
          slug = @slug,
          title = @title,
          description = @description,
          category = @category,
          tags = @tags,
          body = @body,
          visibility = @visibility,
          encrypted_description = @encryptedDescription,
          encrypted_body = @encryptedBody,
          date = @date,
          featured = @featured,
          published = @published,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        id,
        slug,
        title,
        description: content.description,
        category: taxonomy.category,
        tags: JSON.stringify(taxonomy.tags),
        body: content.body,
        visibility: content.visibility,
        encryptedDescription: content.encryptedDescription,
        encryptedBody: content.encryptedBody,
        date: normalizeDate(input.date),
        featured: input.featured ? 1 : 0,
        published: input.published ? 1 : 0,
      });
      if (Object.hasOwn(input, 'topicSlugs')) setPostTopics(id, input.topicSlugs);
      if (Object.hasOwn(input, 'body')) syncImageAssets(id, String(input.body ?? ''));
      return this.get(id);
    },

    remove(id) {
      initialize();
      const assets = imageAssetsForPost(Number(id));
      const tx = db.transaction((postId) => {
        db.prepare('DELETE FROM post_topic_links WHERE post_id = ?').run(postId);
        db.prepare('DELETE FROM post_image_assets WHERE post_id = ?').run(postId);
        return db.prepare('DELETE FROM blog_posts WHERE id = ?').run(postId).changes > 0;
      });
      const removed = tx(id);
      if (removed) {
        removeImageVariants(assets.flatMap(storedImagePaths), {
          uploadDir: postUploadDir,
          publicBase: postPublicBase,
        });
      }
      return removed;
    },
  };
}

export const postRepository = createPostRepository();
