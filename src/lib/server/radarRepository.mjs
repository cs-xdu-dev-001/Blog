import { initializeSchema, openDatabase } from './db.mjs';

const allowedScopes = new Set(['movie', 'code']);

const defaultTags = [
  { scope: 'movie', label: 'Drama', zh: '剧情', count: 327, value: 100, sort_order: 10 },
  { scope: 'movie', label: 'Comedy', zh: '喜剧', count: 138, value: 42, sort_order: 20 },
  { scope: 'movie', label: 'Animation', zh: '动画', count: 132, value: 40, sort_order: 30 },
  { scope: 'movie', label: 'Fantasy', zh: '奇幻', count: 115, value: 35, sort_order: 40 },
  { scope: 'movie', label: 'Action', zh: '动作', count: 113, value: 35, sort_order: 50 },
  { scope: 'movie', label: 'Science Fiction', zh: '科幻', count: 80, value: 24, sort_order: 60 },
  { scope: 'movie', label: 'Romance', zh: '爱情', count: 78, value: 24, sort_order: 70 },
  { scope: 'code', label: 'AI Knowledge', zh: 'AI知识', count: 88, value: 88, sort_order: 10 },
  { scope: 'code', label: 'Automation', zh: '自动化', count: 78, value: 78, sort_order: 20 },
  { scope: 'code', label: 'Frontend', zh: '前端', count: 82, value: 82, sort_order: 30 },
  { scope: 'code', label: 'Deploy', zh: '部署', count: 70, value: 70, sort_order: 40 },
  { scope: 'code', label: 'Scripts', zh: '脚本', count: 66, value: 66, sort_order: 50 },
  { scope: 'code', label: 'Writing', zh: '写作', count: 58, value: 58, sort_order: 60 },
];

function normalize(row) {
  return {
    ...row,
    count: Number(row.count || 0),
    value: Number(row.value || 0),
    sort_order: Number(row.sort_order || 0),
    is_enabled: Number(row.is_enabled || 0),
  };
}

function sanitizeScope(scope) {
  return allowedScopes.has(scope) ? scope : 'movie';
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function createRadarRepository({ dbPath } = {}) {
  const db = openDatabase(dbPath);

  function initialize() {
    initializeSchema(db);
    const existing = db.prepare('SELECT COUNT(*) AS n FROM radar_tags').get().n;
    if (existing) return;
    const stmt = db.prepare(`
      INSERT INTO radar_tags
        (scope, label, zh, count, value, sort_order, is_enabled)
      VALUES
        (@scope, @label, @zh, @count, @value, @sort_order, 1)
    `);
    const tx = db.transaction((rows) => rows.forEach((row) => stmt.run(row)));
    tx(defaultTags);
  }

  return {
    initialize,

    list({ scope = 'all', enabledOnly = false } = {}) {
      initialize();
      const params = {};
      const where = [];
      if (allowedScopes.has(scope)) {
        where.push('scope = @scope');
        params.scope = scope;
      }
      if (enabledOnly) where.push('is_enabled = 1');
      const items = db.prepare(`
        SELECT * FROM radar_tags
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY scope ASC, sort_order ASC, id ASC
      `).all(params).map(normalize);
      return { items, stats: this.stats() };
    },

    byScope(scope) {
      return this.list({ scope: sanitizeScope(scope), enabledOnly: true }).items;
    },

    stats() {
      initialize();
      return {
        total: db.prepare('SELECT COUNT(*) AS n FROM radar_tags').get().n,
        movie: db.prepare("SELECT COUNT(*) AS n FROM radar_tags WHERE scope = 'movie'").get().n,
        code: db.prepare("SELECT COUNT(*) AS n FROM radar_tags WHERE scope = 'code'").get().n,
        disabled: db.prepare('SELECT COUNT(*) AS n FROM radar_tags WHERE is_enabled = 0').get().n,
      };
    },

    get(id) {
      initialize();
      const row = db.prepare('SELECT * FROM radar_tags WHERE id = ?').get(id);
      return row ? normalize(row) : null;
    },

    create(input) {
      initialize();
      const label = String(input.label || '').trim();
      if (!label) throw new Error('label is required');
      const scope = sanitizeScope(String(input.scope || 'movie'));
      const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM radar_tags WHERE scope = ?').get(scope).n;
      const result = db.prepare(`
        INSERT INTO radar_tags
          (scope, label, zh, count, value, sort_order, is_enabled)
        VALUES
          (@scope, @label, @zh, @count, @value, @sort_order, @is_enabled)
      `).run({
        scope,
        label,
        zh: String(input.zh || '').trim(),
        count: clampNumber(input.count, 0, 9999),
        value: clampNumber(input.value, 0, 100),
        sort_order: input.sort_order == null ? maxSort + 10 : clampNumber(input.sort_order, 0, 9999),
        is_enabled: input.is_enabled === false ? 0 : 1,
      });
      return this.get(result.lastInsertRowid);
    },

    update(id, input) {
      initialize();
      db.prepare(`
        UPDATE radar_tags SET
          scope = @scope,
          label = @label,
          zh = @zh,
          count = @count,
          value = @value,
          sort_order = @sort_order,
          is_enabled = @is_enabled,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        id,
        scope: sanitizeScope(String(input.scope || 'movie')),
        label: String(input.label || '').trim(),
        zh: String(input.zh || '').trim(),
        count: clampNumber(input.count, 0, 9999),
        value: clampNumber(input.value, 0, 100),
        sort_order: clampNumber(input.sort_order, 0, 9999),
        is_enabled: input.is_enabled ? 1 : 0,
      });
      return this.get(id);
    },

    remove(id) {
      initialize();
      const result = db.prepare('DELETE FROM radar_tags WHERE id = ?').run(id);
      return result.changes > 0;
    },
  };
}

export const radarRepository = createRadarRepository();
