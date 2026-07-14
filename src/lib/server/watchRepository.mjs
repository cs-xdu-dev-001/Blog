import fs from 'node:fs';
import path from 'node:path';
import { initializeSchema, openDatabase } from './db.mjs';
import { safeImageBaseName as safeUploadImageBaseName, saveImageVariants } from './imageVariants.mjs';

const allowedFilters = new Set([
  'all',
  'missing_image',
  'missing_comment',
  'missing_quote',
  'watched',
  'wanted',
  'watching',
  'activity',
  'featured',
]);

export function safeImageBaseName(title) {
  return safeUploadImageBaseName(title, 'watch-image');
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
      is_activity_featured: Number(row.is_activity_featured || 0),
    };
  }

  const repository = {
    initialize,

    insertMany(items) {
      initialize();
      const stmt = db.prepare(`
        INSERT INTO watch_items
          (title, type, status, rating, comment, quote, quote_source, image_path, is_featured, progress_text, completed_at, is_activity_featured)
        VALUES
          (@title, @type, @status, @rating, @comment, @quote, @quote_source, @image_path, @is_featured, @progress_text, @completed_at, @is_activity_featured)
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
        progress_text: row.progress_text ?? '',
        completed_at: row.completed_at ?? '',
        is_activity_featured: row.is_activity_featured ? 1 : 0,
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
      if (safeFilter === 'watching') where.push("status = '在看'");
      if (safeFilter === 'activity') where.push('is_activity_featured = 1');
      if (safeFilter === 'featured') where.push('is_featured = 1');

      const sql = `
        SELECT * FROM watch_items
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY is_activity_featured DESC, is_featured DESC, updated_at DESC, id ASC
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
      const current = this.get(id);
      if (!current) return null;
      const values = {
        id,
        status: input.status ?? current.status,
        rating: input.rating ?? current.rating ?? '',
        comment: input.comment ?? current.comment ?? '',
        quote: input.quote ?? current.quote ?? '',
        quote_source: input.quote_source ?? current.quote_source ?? '',
        is_featured: input.is_featured === undefined ? current.is_featured : input.is_featured ? 1 : 0,
        progress_text: input.progress_text ?? current.progress_text ?? '',
        completed_at: input.completed_at ?? current.completed_at ?? '',
        is_activity_featured: input.is_activity_featured === undefined
          ? current.is_activity_featured
          : input.is_activity_featured ? 1 : 0,
      };

      const updateItem = db.prepare(`
          UPDATE watch_items SET
            status = @status,
            rating = @rating,
            comment = @comment,
            quote = @quote,
            quote_source = @quote_source,
            is_featured = @is_featured,
            progress_text = @progress_text,
            completed_at = @completed_at,
            is_activity_featured = @is_activity_featured,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = @id
        `);
      const clearActivity = db.prepare(`
        UPDATE watch_items
        SET is_activity_featured = 0, updated_at = CURRENT_TIMESTAMP
        WHERE status = @status AND id <> @id AND is_activity_featured = 1
      `);
      const tx = db.transaction(() => {
        if (values.is_activity_featured) clearActivity.run({ status: values.status, id });
        updateItem.run(values);
      });
      tx();
      return this.get(id);
    },

    remove(id) {
      initialize();
      const result = db.prepare('DELETE FROM watch_items WHERE id = ?').run(id);
      return result.changes > 0;
    },

    async saveImage(id, { originalName, buffer }) {
      initialize();
      const item = this.get(id);
      if (!item) return null;
      const variants = await saveImageVariants({
        baseName: safeImageBaseName(item.title),
        originalName,
        buffer,
        uploadDir: finalUploadDir,
        publicBase: '/uploads/watch',
      });
      db.prepare(`
        UPDATE watch_items SET
          image_path = @imagePath,
          image_small_path = @smallPath,
          image_original_path = @originalPath,
          image_width = @width,
          image_height = @height,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({ id, ...variants });
      return this.get(id);
    },
  };

  return repository;
}

export const watchRepository = createWatchRepository();
