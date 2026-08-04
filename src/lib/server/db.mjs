import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const initializedSchemas = new WeakSet();
const SCHEMA_VERSION = 3;
let sharedDatabase = null;

export function getDefaultDbPath() {
  return process.env.BLOG_DB_PATH || path.resolve(process.cwd(), 'data', 'blog.sqlite');
}

export function openDatabase(dbPath = getDefaultDbPath()) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  return db;
}

export function openRepositoryDatabase(dbPath) {
  if (dbPath !== undefined) return openDatabase(dbPath);
  if (!sharedDatabase?.open) sharedDatabase = openDatabase();
  return sharedDatabase;
}

export function isSharedDatabase(db) {
  return db === sharedDatabase;
}

export function closeSharedDatabase() {
  if (sharedDatabase?.open) sharedDatabase.close();
  sharedDatabase = null;
}

function ensureColumn(db, table, name, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((column) => column.name === name);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

export function initializeSchema(db) {
  if (initializedSchemas.has(db)) return;
  const currentVersion = Number(db.pragma('user_version', { simple: true }) || 0);
  if (currentVersion >= SCHEMA_VERSION) {
    initializedSchemas.add(db);
    return;
  }

  const migrate = db.transaction(() => {
    if (currentVersion < 1) {
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
      published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS food_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      dish TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '想去',
      rating TEXT NOT NULL DEFAULT '',
      visit_date TEXT NOT NULL DEFAULT '',
      comment TEXT NOT NULL DEFAULT '',
      would_revisit INTEGER NOT NULL DEFAULT 0,
      image_path TEXT NOT NULL DEFAULT '',
      image_small_path TEXT NOT NULL DEFAULT '',
      image_original_path TEXT NOT NULL DEFAULT '',
      image_width INTEGER NOT NULL DEFAULT 0,
      image_height INTEGER NOT NULL DEFAULT 0,
      is_featured INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_food_items_public_order
      ON food_items(published, is_featured DESC, visit_date DESC, sort_order ASC, id DESC);

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      body TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'public',
      encrypted_description TEXT NOT NULL DEFAULT '',
      encrypted_body TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT CURRENT_DATE,
      featured INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_blog_posts_published_date
      ON blog_posts(published, date DESC, id DESC);

    CREATE TABLE IF NOT EXISTS post_topic_links (
      post_id INTEGER NOT NULL,
      topic_slug TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(post_id, topic_slug)
    );

    CREATE INDEX IF NOT EXISTS idx_post_topic_links_topic
      ON post_topic_links(topic_slug, post_id);

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
      ensureColumn(db, 'reading_items', 'published', 'INTEGER NOT NULL DEFAULT 1');
      ensureColumn(db, 'food_items', 'image_small_path', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(db, 'food_items', 'image_original_path', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(db, 'food_items', 'image_width', 'INTEGER NOT NULL DEFAULT 0');
      ensureColumn(db, 'food_items', 'image_height', 'INTEGER NOT NULL DEFAULT 0');
      ensureColumn(db, 'food_items', 'would_revisit', 'INTEGER NOT NULL DEFAULT 0');
      ensureColumn(db, 'food_items', 'is_featured', 'INTEGER NOT NULL DEFAULT 0');
      ensureColumn(db, 'food_items', 'published', 'INTEGER NOT NULL DEFAULT 1');
      ensureColumn(db, 'food_items', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
      ensureColumn(db, 'blog_posts', 'tags', "TEXT NOT NULL DEFAULT '[]'");
      ensureColumn(db, 'blog_posts', 'visibility', "TEXT NOT NULL DEFAULT 'public'");
      ensureColumn(db, 'blog_posts', 'encrypted_description', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(db, 'blog_posts', 'encrypted_body', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(db, 'post_topic_links', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
      db.exec(`
    CREATE INDEX IF NOT EXISTS idx_watch_items_status_order
      ON watch_items(status, is_activity_featured DESC, is_featured DESC, updated_at DESC, id ASC);

    CREATE INDEX IF NOT EXISTS idx_reading_items_public_status_order
      ON reading_items(published, status, is_featured DESC, sort_order ASC, updated_at DESC, id ASC);

    CREATE INDEX IF NOT EXISTS idx_post_topic_links_topic_order
      ON post_topic_links(topic_slug, sort_order, post_id);
      `);
    }

    if (currentVersion < 2) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS post_image_assets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          image_path TEXT NOT NULL UNIQUE,
          small_path TEXT NOT NULL DEFAULT '',
          original_path TEXT NOT NULL DEFAULT '',
          referenced INTEGER NOT NULL DEFAULT 0,
          unreferenced_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_post_image_assets_cleanup
          ON post_image_assets(referenced, unreferenced_at, id);
      `);
    }

    if (currentVersion < 3) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS post_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          slug TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT '',
          tags TEXT NOT NULL DEFAULT '[]',
          body TEXT NOT NULL DEFAULT '',
          visibility TEXT NOT NULL DEFAULT 'public',
          encrypted_description TEXT NOT NULL DEFAULT '',
          encrypted_body TEXT NOT NULL DEFAULT '',
          date TEXT NOT NULL,
          featured INTEGER NOT NULL DEFAULT 0,
          published INTEGER NOT NULL DEFAULT 1,
          topic_slugs TEXT NOT NULL DEFAULT '[]',
          source TEXT NOT NULL DEFAULT 'manual',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_post_versions_post_created
          ON post_versions(post_id, id DESC);
      `);
    }

    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  });
  migrate();
  initializedSchemas.add(db);
}
