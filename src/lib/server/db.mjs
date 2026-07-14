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

function ensureColumn(db, table, name, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((column) => column.name === name);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

export function initializeSchema(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_watch_items_title_type_status;

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
      image_small_path TEXT NOT NULL DEFAULT '',
      image_original_path TEXT NOT NULL DEFAULT '',
      image_width INTEGER NOT NULL DEFAULT 0,
      image_height INTEGER NOT NULL DEFAULT 0,
      is_featured INTEGER NOT NULL DEFAULT 0,
      progress_text TEXT NOT NULL DEFAULT '',
      completed_at TEXT NOT NULL DEFAULT '',
      is_activity_featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reading_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      status_label TEXT NOT NULL DEFAULT '',
      progress TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      quote TEXT NOT NULL DEFAULT '',
      review TEXT NOT NULL DEFAULT '',
      spine_color TEXT NOT NULL DEFAULT '#263548',
      accent_color TEXT NOT NULL DEFAULT '#ff9138',
      image_path TEXT NOT NULL DEFAULT '',
      image_small_path TEXT NOT NULL DEFAULT '',
      image_original_path TEXT NOT NULL DEFAULT '',
      image_width INTEGER NOT NULL DEFAULT 0,
      image_height INTEGER NOT NULL DEFAULT 0,
      is_featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT CURRENT_DATE,
      featured INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_blog_posts_published_date
      ON blog_posts(published, date DESC, id DESC);

    CREATE TABLE IF NOT EXISTS radar_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      label TEXT NOT NULL,
      zh TEXT NOT NULL DEFAULT '',
      count INTEGER NOT NULL DEFAULT 0,
      value INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_radar_tags_scope_order
      ON radar_tags(scope, sort_order, id);

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_sections (
      key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      eyebrow TEXT NOT NULL DEFAULT '',
      nav_label TEXT NOT NULL DEFAULT '',
      nav_small TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      settings TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assistant_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ip_hash, day)
    );

    CREATE INDEX IF NOT EXISTS idx_assistant_usage_day
      ON assistant_usage(day, ip_hash);
  `);

  ensureColumn(db, 'watch_items', 'progress_text', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'watch_items', 'completed_at', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'watch_items', 'is_activity_featured', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'watch_items', 'image_small_path', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'watch_items', 'image_original_path', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'watch_items', 'image_width', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'watch_items', 'image_height', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'reading_items', 'image_small_path', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'reading_items', 'image_original_path', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'reading_items', 'image_width', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'reading_items', 'image_height', 'INTEGER NOT NULL DEFAULT 0');
}
