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

  const repository = {
    initialize,

    insertMany(items) {
      initialize();
      const stmt = db.prepare(`
        INSERT INTO watch_items
          (title, type, status, rating, comment, quote, quote_source, image_path, is_featured)
        VALUES
          (@title, @type, @status, @rating, @comment, @quote, @quote_source, @image_path, @is_featured)
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

    replaceAll(items) {
      initialize();
      const tx = db.transaction((rows) => {
        db.prepare('DELETE FROM watch_items').run();
        db.prepare("DELETE FROM sqlite_sequence WHERE name = 'watch_items'").run();
        this.insertMany(rows);
      });
      tx(items);
    },

    upsertMany(items) {
      this.insertMany(items);
    },

    create(input) {
      initialize();
      const title = String(input.title || '').trim();
      if (!title) throw new Error('title is required');

      const result = db.prepare(`
        INSERT INTO watch_items
          (title, type, status, rating, comment, quote, quote_source, image_path, is_featured)
        VALUES
          (@title, @type, @status, '', '', '', '', '', 0)
      `).run({
        title,
        type: String(input.type || '电影').trim() || '电影',
        status: String(input.status || '想看').trim() || '想看',
      });

      return this.get(result.lastInsertRowid);
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

    remove(id) {
      initialize();
      const result = db.prepare('DELETE FROM watch_items WHERE id = ?').run(id);
      return result.changes > 0;
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

  return repository;
}

export const watchRepository = createWatchRepository();
