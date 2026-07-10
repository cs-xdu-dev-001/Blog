import { initializeSchema, openDatabase } from './db.mjs';

export const defaultSiteConfig = {
  brandName: 'Dev Notes',
  pageTitle: 'Dev Notes | 技术实践与个人知识系统',
  pageDescription: '记录部署、自动化、AI工具链、前端视觉和个人知识系统。',
  heroKicker: 'DEV NOTES',
  heroMeta: 'FIELD INDEX / 2026',
  heroLine: '写代码，搭工具，整理AI笔记，也记录一点影像和书。',
  heroSubline: '有些问题当时解决了，过几个月还会忘。我把过程、判断和踩过的坑放在这里。',
  heroHighlight: '把实践留下来，比把灵感留在脑子里更可靠。',
  orbitTags: 'CINEMA/RAG/UI/NOTION/AGENT/AI/FLOW',
  aboutTitle: '这里不是简历，也不是资料库。',
  aboutBody: '我在西安，平时写代码、搭工具、整理AI笔记，也会把看过的影像和读过的书放进同一张索引里。\n\nDev Notes更像一张长期摊开的工作台：技术问题放一边，影像和阅读放另一边，最后都回到我怎么判断、怎么表达。',
  aboutNow: 'AI工具链、RAG、Agent、前端视觉和个人知识系统。相比追热点，我更关心一套工具能不能真的进入日常工作。',
  aboutMethod: '先把问题跑通，再把过程写下来。代码、截图、失败路径和当时的判断都尽量留下，方便以后回头看。',
  aboutTaste: '喜欢克制、清楚、有秩序的界面。前端是门面，但不是装饰，真正的质感来自排版、比例和交互节奏。',
  social: {
    github: 'https://github.com/cs-xdu-dev-001',
    bilibili: 'https://b23.tv/9JF4Xho',
    qq: '2986934180',
  },
  assistant: {
    enabled: true,
    title: 'Ask Dev Notes',
    welcome: '可以随便问。和博客内容有关时，我会参考站内笔记、阅读和影像档案；其他问题也可以正常聊。',
    placeholder: '随便问点什么...',
    refusal: '这个问题暂时不适合在这里回答。',
    apiBaseUrl: '',
    apiKey: '',
    model: '',
    apiMode: 'chat',
    proxyUrl: '',
    dailyLimit: 200,
    minuteLimit: 20,
    maxQuestionLength: 1000,
    maxAnswerLength: 1200,
    modules: {
      posts: true,
      reading: true,
      watch: true,
      about: true,
    },
  },
};

export const defaultSections = [
  { key: 'topics', title: '主线', eyebrow: 'Stories / Systems / Code', navLabel: '主线', navSmall: '4', sortOrder: 10 },
  { key: 'notes', title: '近期笔记', eyebrow: '写作索引', navLabel: '笔记', navSmall: 'auto', sortOrder: 20 },
  { key: 'watch', title: '影像档案', eyebrow: '影像轨道', navLabel: '影像', navSmall: 'auto', sortOrder: 30 },
  { key: 'reading', title: '阅读书架', eyebrow: 'Reading shelf', navLabel: '书架', navSmall: 'auto', sortOrder: 40 },
  { key: 'statistics', title: '统计', eyebrow: '个人坐标', navLabel: '统计', navSmall: '∞', sortOrder: 50 },
  { key: 'about', title: '关于', eyebrow: 'About', navLabel: '关于', navSmall: 'me', sortOrder: 60 },
];

function parseJson(value, fallback) {
  try {
    return { ...fallback, ...JSON.parse(value || '{}') };
  } catch {
    return { ...fallback };
  }
}

function normalizeSection(row) {
  return {
    key: row.key,
    title: row.title,
    eyebrow: row.eyebrow,
    navLabel: row.nav_label,
    navSmall: row.nav_small,
    enabled: Number(row.enabled || 0),
    sortOrder: Number(row.sort_order || 0),
    settings: parseJson(row.settings, {}),
  };
}

function normalizeSiteConfig(value) {
  const parsed = parseJson(value, defaultSiteConfig);
  return {
    ...defaultSiteConfig,
    ...parsed,
    social: {
      ...defaultSiteConfig.social,
      ...(parsed.social || {}),
    },
    assistant: {
      ...defaultSiteConfig.assistant,
      ...(parsed.assistant || {}),
      modules: {
        ...defaultSiteConfig.assistant.modules,
        ...((parsed.assistant || {}).modules || {}),
      },
    },
  };
}

export function createSiteConfigRepository({ dbPath } = {}) {
  const db = openDatabase(dbPath);

  function initialize() {
    initializeSchema(db);
    db.prepare(`
      INSERT INTO site_settings (key, value)
      VALUES ('site', @value)
      ON CONFLICT(key) DO NOTHING
    `).run({ value: JSON.stringify(defaultSiteConfig) });

    const stmt = db.prepare(`
      INSERT INTO site_sections
        (key, title, eyebrow, nav_label, nav_small, enabled, sort_order, settings)
      VALUES
        (@key, @title, @eyebrow, @navLabel, @navSmall, 1, @sortOrder, '{}')
      ON CONFLICT(key) DO NOTHING
    `);
    const tx = db.transaction((sections) => sections.forEach((section) => stmt.run(section)));
    tx(defaultSections);
  }

  return {
    initialize,

    getSiteConfig() {
      initialize();
      const row = db.prepare("SELECT value FROM site_settings WHERE key = 'site'").get();
      return normalizeSiteConfig(row?.value);
    },

    updateSiteConfig(input = {}) {
      initialize();
      const current = this.getSiteConfig();
      const merged = normalizeSiteConfig(JSON.stringify({
        ...current,
        ...input,
        social: {
          ...current.social,
          ...(input.social || {}),
        },
        assistant: {
          ...current.assistant,
          ...(input.assistant || {}),
          modules: {
            ...current.assistant.modules,
            ...((input.assistant || {}).modules || {}),
          },
        },
      }));
      db.prepare(`
        INSERT INTO site_settings (key, value, updated_at)
        VALUES ('site', @value, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).run({ value: JSON.stringify(merged) });
      return this.getSiteConfig();
    },

    listSections() {
      initialize();
      return db.prepare(`
        SELECT * FROM site_sections
        ORDER BY sort_order ASC, key ASC
      `).all().map(normalizeSection);
    },

    enabledSections() {
      return this.listSections().filter((section) => section.enabled);
    },

    getSection(key) {
      initialize();
      const row = db.prepare('SELECT * FROM site_sections WHERE key = ?').get(key);
      return row ? normalizeSection(row) : null;
    },

    updateSection(key, input = {}) {
      initialize();
      const existing = this.getSection(key);
      if (!existing) return null;
      db.prepare(`
        UPDATE site_sections SET
          title = @title,
          eyebrow = @eyebrow,
          nav_label = @navLabel,
          nav_small = @navSmall,
          enabled = @enabled,
          sort_order = @sortOrder,
          settings = @settings,
          updated_at = CURRENT_TIMESTAMP
        WHERE key = @key
      `).run({
        key,
        title: String(input.title ?? existing.title).trim(),
        eyebrow: String(input.eyebrow ?? existing.eyebrow).trim(),
        navLabel: String(input.navLabel ?? existing.navLabel).trim(),
        navSmall: String(input.navSmall ?? existing.navSmall).trim(),
        enabled: input.enabled === false || input.enabled === 0 ? 0 : 1,
        sortOrder: Number.isFinite(Number(input.sortOrder)) ? Math.round(Number(input.sortOrder)) : existing.sortOrder,
        settings: JSON.stringify(input.settings || existing.settings || {}),
      });
      return this.getSection(key);
    },
  };
}

export const siteConfigRepository = createSiteConfigRepository();

