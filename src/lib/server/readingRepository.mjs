import fs from 'node:fs';
import path from 'node:path';
import { initializeSchema, openDatabase } from './db.mjs';

const allowedFilters = new Set([
  'all',
  'missing_image',
  'missing_review',
  'missing_quote',
  'reading',
  'read',
  'planned',
  'featured',
]);

const statusLabels = {
  reading: '在读',
  read: '已读',
  planned: '待读',
};

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `book-${Date.now().toString(36)}`;
}

export function safeReadingImageBaseName(title) {
  return title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'reading-cover';
}

export function createReadingRepository({ dbPath, uploadDir } = {}) {
  const db = openDatabase(dbPath);
  const finalUploadDir = uploadDir || path.resolve(process.cwd(), 'public', 'uploads', 'reading');

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

  const repository = {
    initialize,

    insertMany(items) {
      initialize();
      const stmt = db.prepare(`
        INSERT INTO reading_items
          (slug, title, author, status, status_label, progress, summary, quote, review, spine_color, accent_color, image_path, is_featured, sort_order)
        VALUES
          (@slug, @title, @author, @status, @status_label, @progress, @summary, @quote, @review, @spine_color, @accent_color, @image_path, @is_featured, @sort_order)
      `);
      const tx = db.transaction((rows) => rows.forEach((row, index) => stmt.run({
        slug: row.slug,
        title: row.title,
        author: row.author ?? '',
        status: row.status,
        status_label: row.status_label ?? row.statusLabel ?? '',
        progress: row.progress ?? '',
        summary: row.summary ?? '',
        quote: row.quote ?? '',
        review: row.review ?? '',
        spine_color: row.spine_color ?? row.spineColor ?? '#263548',
        accent_color: row.accent_color ?? row.accentColor ?? '#ff9138',
        image_path: row.image_path ?? row.imagePath ?? '',
        is_featured: row.is_featured ?? row.featured ? 1 : 0,
        sort_order: row.sort_order ?? index + 1,
      })));
      tx(items);
    },

    replaceAll(items) {
      initialize();
      const tx = db.transaction((rows) => {
        db.prepare('DELETE FROM reading_items').run();
        db.prepare("DELETE FROM sqlite_sequence WHERE name = 'reading_items'").run();
        this.insertMany(rows);
      });
      tx(items);
    },

    upsertMany(items) {
      initialize();
      const stmt = db.prepare(`
        INSERT INTO reading_items
          (slug, title, author, status, status_label, progress, summary, quote, review, spine_color, accent_color, image_path, is_featured, sort_order)
        VALUES
          (@slug, @title, @author, @status, @status_label, @progress, @summary, @quote, @review, @spine_color, @accent_color, @image_path, @is_featured, @sort_order)
        ON CONFLICT(slug) DO UPDATE SET
          title = excluded.title,
          author = excluded.author,
          status = excluded.status,
          status_label = excluded.status_label,
          progress = excluded.progress,
          summary = excluded.summary,
          quote = excluded.quote,
          review = excluded.review,
          spine_color = excluded.spine_color,
          accent_color = excluded.accent_color,
          is_featured = excluded.is_featured,
          sort_order = excluded.sort_order,
          updated_at = CURRENT_TIMESTAMP
      `);
      const tx = db.transaction((rows) => rows.forEach((row, index) => stmt.run({
        slug: row.slug,
        title: row.title,
        author: row.author ?? '',
        status: row.status,
        status_label: row.status_label ?? row.statusLabel ?? '',
        progress: row.progress ?? '',
        summary: row.summary ?? '',
        quote: row.quote ?? '',
        review: row.review ?? '',
        spine_color: row.spine_color ?? row.spineColor ?? '#263548',
        accent_color: row.accent_color ?? row.accentColor ?? '#ff9138',
        image_path: row.image_path ?? row.imagePath ?? '',
        is_featured: row.is_featured ?? row.featured ? 1 : 0,
        sort_order: row.sort_order ?? index + 1,
      })));
      tx(items);
    },

    create(input) {
      initialize();
      const title = String(input.title || '').trim();
      if (!title) throw new Error('title is required');

      const status = ['reading', 'read', 'planned'].includes(input.status) ? input.status : 'planned';
      const baseSlug = slugify(title);
      let slug = baseSlug;
      let index = 2;
      while (this.getBySlug(slug)) {
        slug = `${baseSlug}-${index}`;
        index += 1;
      }

      const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM reading_items').get().n;
      const statusLabel = statusLabels[status];
      const result = db.prepare(`
        INSERT INTO reading_items
          (slug, title, author, status, status_label, progress, summary, quote, review, spine_color, accent_color, image_path, is_featured, sort_order)
        VALUES
          (@slug, @title, @author, @status, @status_label, @progress, '', '', '', '#263548', '#ff9138', '', 0, @sort_order)
      `).run({
        slug,
        title,
        author: String(input.author || '').trim(),
        status,
        status_label: statusLabel,
        progress: statusLabel,
        sort_order: maxSort + 1,
      });

      return this.get(result.lastInsertRowid);
    },

    get(id) {
      initialize();
      const row = db.prepare('SELECT * FROM reading_items WHERE id = ?').get(id);
      return row ? normalize(row) : null;
    },

    getBySlug(slug) {
      initialize();
      const row = db.prepare('SELECT * FROM reading_items WHERE slug = ?').get(slug);
      return row ? normalize(row) : null;
    },

    list({ query = '', filter = 'all', limit = 500 } = {}) {
      initialize();
      const where = [];
      const params = {};
      const trimmedQuery = query.trim();
      const safeFilter = allowedFilters.has(filter) ? filter : 'all';

      if (trimmedQuery) {
        where.push('(title LIKE @query OR author LIKE @query OR quote LIKE @query OR review LIKE @query OR summary LIKE @query)');
        params.query = `%${trimmedQuery}%`;
      }
      if (safeFilter === 'missing_image') where.push("image_path = ''");
      if (safeFilter === 'missing_review') where.push("review = ''");
      if (safeFilter === 'missing_quote') where.push("quote = ''");
      if (['reading', 'read', 'planned'].includes(safeFilter)) where.push('status = @status');
      if (safeFilter === 'featured') where.push('is_featured = 1');
      if (['reading', 'read', 'planned'].includes(safeFilter)) params.status = safeFilter;

      const sql = `
        SELECT * FROM reading_items
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY is_featured DESC, sort_order ASC, updated_at DESC, id ASC
        LIMIT @limit
      `;
      const items = db.prepare(sql).all({ ...params, limit }).map(normalize);
      return { items, stats: this.stats() };
    },

    stats() {
      initialize();
      return {
        total: db.prepare('SELECT COUNT(*) AS n FROM reading_items').get().n,
        missingImage: db.prepare("SELECT COUNT(*) AS n FROM reading_items WHERE image_path = ''").get().n,
        missingReview: db.prepare("SELECT COUNT(*) AS n FROM reading_items WHERE review = ''").get().n,
        missingQuote: db.prepare("SELECT COUNT(*) AS n FROM reading_items WHERE quote = ''").get().n,
      };
    },

    update(id, input) {
      initialize();
      db.prepare(`
        UPDATE reading_items SET
          author = @author,
          status = @status,
          status_label = @status_label,
          progress = @progress,
          summary = @summary,
          quote = @quote,
          review = @review,
          spine_color = @spine_color,
          accent_color = @accent_color,
          is_featured = @is_featured,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        id,
        author: input.author ?? '',
        status: input.status,
        status_label: input.status_label ?? '',
        progress: input.progress ?? '',
        summary: input.summary ?? '',
        quote: input.quote ?? '',
        review: input.review ?? '',
        spine_color: input.spine_color ?? '#263548',
        accent_color: input.accent_color ?? '#ff9138',
        is_featured: input.is_featured ? 1 : 0,
      });
      return this.get(id);
    },

    remove(id) {
      initialize();
      const result = db.prepare('DELETE FROM reading_items WHERE id = ?').run(id);
      return result.changes > 0;
    },

    saveImage(id, { originalName, buffer }) {
      initialize();
      const item = this.get(id);
      if (!item) return null;
      const ext = path.extname(originalName).toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext) ? ext : '.jpg';
      const fileName = `${safeReadingImageBaseName(item.title)}${safeExt}`;
      fs.mkdirSync(finalUploadDir, { recursive: true });
      fs.writeFileSync(path.join(finalUploadDir, fileName), buffer);
      const publicPath = `/uploads/reading/${encodeURIComponent(fileName).replaceAll('%2F', '/')}`;
      db.prepare('UPDATE reading_items SET image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(publicPath, id);
      return this.get(id);
    },
  };

  return repository;
}

export const readingRepository = createReadingRepository();
