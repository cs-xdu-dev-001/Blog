import fs from 'node:fs';
import path from 'node:path';
import { initializeSchema, openDatabase } from './db.mjs';

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

function normalize(row) {
  if (!row) return null;
  return {
    ...row,
    featured: Number(row.featured || 0),
    published: Number(row.published || 0),
    data: {
      title: row.title,
      description: row.description,
      category: row.category,
      date: new Date(row.date),
      featured: Boolean(row.featured),
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
    else data[item[1]] = value;
  });

  return { data, body: match[2] };
}

export function createPostRepository({ dbPath } = {}) {
  const db = openDatabase(dbPath);

  function initialize() {
    initializeSchema(db);
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

  return {
    initialize,

    create(input = {}) {
      initialize();
      const title = String(input.title || '').trim();
      if (!title) throw new Error('title is required');
      const slug = uniqueSlug(input.slug || title);
      const result = db.prepare(`
        INSERT INTO blog_posts
          (slug, title, description, category, body, date, featured, published)
        VALUES
          (@slug, @title, @description, @category, @body, @date, @featured, @published)
      `).run({
        slug,
        title,
        description: String(input.description || '').trim(),
        category: String(input.category || 'Notes').trim(),
        body: String(input.body || ''),
        date: normalizeDate(input.date),
        featured: input.featured ? 1 : 0,
        published: input.published === false ? 0 : 1,
      });
      return this.get(result.lastInsertRowid);
    },

    upsertBySlug(input = {}) {
      initialize();
      const title = String(input.title || '').trim();
      if (!title) throw new Error('title is required');
      const slug = slugifyPost(input.slug || title);
      db.prepare(`
        INSERT INTO blog_posts
          (slug, title, description, category, body, date, featured, published)
        VALUES
          (@slug, @title, @description, @category, @body, @date, @featured, @published)
        ON CONFLICT(slug) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          category = excluded.category,
          body = excluded.body,
          date = excluded.date,
          featured = excluded.featured,
          published = excluded.published,
          updated_at = CURRENT_TIMESTAMP
      `).run({
        slug,
        title,
        description: String(input.description || '').trim(),
        category: String(input.category || 'Notes').trim(),
        body: String(input.body || ''),
        date: normalizeDate(input.date),
        featured: input.featured ? 1 : 0,
        published: input.published === false ? 0 : 1,
      });
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
          category: data.category || 'Notes',
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

    get(id) {
      initialize();
      return normalize(db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id));
    },

    getBySlug(slug, { includeDraft = false } = {}) {
      initialize();
      const row = includeDraft
        ? db.prepare('SELECT * FROM blog_posts WHERE slug = ?').get(slug)
        : db.prepare('SELECT * FROM blog_posts WHERE slug = ? AND published = 1').get(slug);
      return normalize(row);
    },

    list({ query = '', filter = 'published', limit = 500 } = {}) {
      initialize();
      const safeFilter = allowedFilters.has(filter) ? filter : 'published';
      const where = [];
      const params = { limit };
      const trimmedQuery = String(query || '').trim();
      if (trimmedQuery) {
        where.push('(title LIKE @query OR description LIKE @query OR category LIKE @query OR body LIKE @query)');
        params.query = `%${trimmedQuery}%`;
      }
      if (safeFilter === 'published') where.push('published = 1');
      if (safeFilter === 'draft') where.push('published = 0');
      if (safeFilter === 'featured') where.push('featured = 1');
      const items = db.prepare(`
        SELECT * FROM blog_posts
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY date DESC, id DESC
        LIMIT @limit
      `).all(params).map(normalize);
      return { items, stats: this.stats() };
    },

    stats() {
      initialize();
      return {
        total: db.prepare('SELECT COUNT(*) AS n FROM blog_posts').get().n,
        published: db.prepare('SELECT COUNT(*) AS n FROM blog_posts WHERE published = 1').get().n,
        draft: db.prepare('SELECT COUNT(*) AS n FROM blog_posts WHERE published = 0').get().n,
        featured: db.prepare('SELECT COUNT(*) AS n FROM blog_posts WHERE featured = 1').get().n,
      };
    },

    update(id, input = {}) {
      initialize();
      const existing = this.get(id);
      if (!existing) return null;
      const title = String(input.title || existing.title).trim();
      if (!title) throw new Error('title is required');
      const slug = uniqueSlug(input.slug || existing.slug || title, id);
      db.prepare(`
        UPDATE blog_posts SET
          slug = @slug,
          title = @title,
          description = @description,
          category = @category,
          body = @body,
          date = @date,
          featured = @featured,
          published = @published,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        id,
        slug,
        title,
        description: String(input.description || '').trim(),
        category: String(input.category || 'Notes').trim(),
        body: String(input.body || ''),
        date: normalizeDate(input.date),
        featured: input.featured ? 1 : 0,
        published: input.published ? 1 : 0,
      });
      return this.get(id);
    },

    remove(id) {
      initialize();
      return db.prepare('DELETE FROM blog_posts WHERE id = ?').run(id).changes > 0;
    },
  };
}

export const postRepository = createPostRepository();
