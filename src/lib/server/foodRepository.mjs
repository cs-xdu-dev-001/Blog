import fs from 'node:fs';
import path from 'node:path';
import { initializeSchema, openDatabase } from './db.mjs';
import { normalizeAdminPagination, publicPagination } from './adminPagination.mjs';
import { safeImageBaseName, saveImageVariants } from './imageVariants.mjs';

const allowedFilters = new Set(['all', 'recent', 'eaten', 'frequent', 'wanted', 'featured', 'draft']);
const allowedStatuses = new Set(['想去', '吃过', '常去']);

export function safeFoodImageBaseName(title) {
  return safeImageBaseName(title, 'food-photo');
}

export function createFoodRepository({ dbPath, uploadDir } = {}) {
  const db = openDatabase(dbPath);
  const finalUploadDir = uploadDir || path.resolve(process.cwd(), 'public', 'uploads', 'food');
  let initialized = false;

  function initialize() {
    if (initialized) return;
    initializeSchema(db);
    fs.mkdirSync(finalUploadDir, { recursive: true });
    initialized = true;
  }

  function normalize(row) {
    return row ? {
      ...row,
      would_revisit: Number(row.would_revisit || 0),
      is_featured: Number(row.is_featured || 0),
      published: Number(row.published ?? 1),
    } : null;
  }

  const repository = {
    initialize,

    create(input = {}) {
      initialize();
      const title = String(input.title || '').trim();
      if (!title) throw new Error('title is required');
      const status = allowedStatuses.has(input.status) ? input.status : '想去';
      const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM food_items').get().n;
      const result = db.prepare(`
        INSERT INTO food_items
          (title, dish, area, status, rating, visit_date, comment, would_revisit, is_featured, published, sort_order)
        VALUES
          (@title, @dish, @area, @status, @rating, @visitDate, @comment, @wouldRevisit, @isFeatured, @published, @sortOrder)
      `).run({
        title,
        dish: String(input.dish || '').trim(),
        area: String(input.area || '').trim(),
        status,
        rating: String(input.rating || '').trim(),
        visitDate: String(input.visit_date || '').trim(),
        comment: String(input.comment || '').trim(),
        wouldRevisit: input.would_revisit ? 1 : 0,
        isFeatured: input.is_featured ? 1 : 0,
        published: input.published === false ? 0 : 1,
        sortOrder: maxSort + 1,
      });
      return this.get(result.lastInsertRowid);
    },

    get(id) {
      initialize();
      return normalize(db.prepare('SELECT * FROM food_items WHERE id = ?').get(id));
    },

    getPublic(id) {
      initialize();
      return normalize(db.prepare('SELECT * FROM food_items WHERE id = ? AND published = 1').get(id));
    },

    list({ query = '', filter = 'all', limit = 500, publishedOnly = false, page, pageSize } = {}) {
      initialize();
      const where = [];
      const params = {};
      const safeFilter = allowedFilters.has(filter) ? filter : 'all';
      const trimmedQuery = String(query || '').trim();

      if (trimmedQuery) {
        where.push('(title LIKE @query OR dish LIKE @query OR area LIKE @query OR comment LIKE @query)');
        params.query = `%${trimmedQuery}%`;
      }
      if (safeFilter === 'eaten') where.push("status = '吃过'");
      if (safeFilter === 'frequent') where.push("status = '常去'");
      if (safeFilter === 'wanted') where.push("status = '想去'");
      if (safeFilter === 'featured') where.push('is_featured = 1');
      if (safeFilter === 'draft') where.push('published = 0');
      if (publishedOnly) where.push('published = 1');

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const paginated = page !== undefined || pageSize !== undefined;
      let pagination = null;
      if (paginated) {
        const total = db.prepare(`SELECT COUNT(*) AS total FROM food_items ${whereSql}`).get(params).total;
        pagination = normalizeAdminPagination({ page, pageSize, total });
      }
      const items = db.prepare(`
        SELECT * FROM food_items
        ${whereSql}
        ORDER BY
          is_featured DESC,
          CASE WHEN visit_date = '' THEN 1 ELSE 0 END,
          visit_date DESC,
          sort_order ASC,
          updated_at DESC,
          id DESC
        LIMIT @limit
        ${paginated ? 'OFFSET @offset' : ''}
      `).all({
        ...params,
        limit: pagination?.pageSize || Math.max(1, Math.min(Number(limit) || 500, 1000)),
        ...(pagination ? { offset: pagination.offset } : {}),
      }).map(normalize);

      return {
        items,
        stats: this.stats(),
        ...(pagination ? { pagination: publicPagination(pagination) } : {}),
      };
    },

    stats() {
      initialize();
      const row = db.prepare(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN published = 1 THEN 1 ELSE 0 END), 0) AS published,
          COALESCE(SUM(CASE WHEN status = '吃过' THEN 1 ELSE 0 END), 0) AS eaten,
          COALESCE(SUM(CASE WHEN status = '常去' THEN 1 ELSE 0 END), 0) AS frequent,
          COALESCE(SUM(CASE WHEN status = '想去' THEN 1 ELSE 0 END), 0) AS wanted,
          COALESCE(SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END), 0) AS featured
        FROM food_items
      `).get();
      return {
        total: row.total,
        published: row.published,
        eaten: row.eaten,
        frequent: row.frequent,
        wanted: row.wanted,
        featured: row.featured,
      };
    },

    update(id, input = {}) {
      initialize();
      const current = this.get(id);
      if (!current) return null;
      const status = input.status === undefined
        ? current.status
        : allowedStatuses.has(input.status) ? input.status : current.status;
      db.prepare(`
        UPDATE food_items SET
          title = @title,
          dish = @dish,
          area = @area,
          status = @status,
          rating = @rating,
          visit_date = @visitDate,
          comment = @comment,
          would_revisit = @wouldRevisit,
          is_featured = @isFeatured,
          published = @published,
          sort_order = @sortOrder,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        id,
        title: String(input.title ?? current.title).trim(),
        dish: String(input.dish ?? current.dish).trim(),
        area: String(input.area ?? current.area).trim(),
        status,
        rating: String(input.rating ?? current.rating).trim(),
        visitDate: String(input.visit_date ?? current.visit_date).trim(),
        comment: String(input.comment ?? current.comment).trim(),
        wouldRevisit: input.would_revisit === undefined ? current.would_revisit : input.would_revisit ? 1 : 0,
        isFeatured: input.is_featured === undefined ? current.is_featured : input.is_featured ? 1 : 0,
        published: input.published === undefined ? current.published : input.published ? 1 : 0,
        sortOrder: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : current.sort_order,
      });
      return this.get(id);
    },

    remove(id) {
      initialize();
      return db.prepare('DELETE FROM food_items WHERE id = ?').run(id).changes > 0;
    },

    async saveImage(id, { originalName, buffer }) {
      initialize();
      const item = this.get(id);
      if (!item) return null;
      const variants = await saveImageVariants({
        baseName: safeFoodImageBaseName(item.title),
        originalName,
        buffer,
        uploadDir: finalUploadDir,
        publicBase: '/uploads/food',
      });
      db.prepare(`
        UPDATE food_items SET
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

export const foodRepository = createFoodRepository();
