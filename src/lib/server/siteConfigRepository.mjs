import { initializeSchema, openDatabase } from './db.mjs';

export const defaultTopicCards = [
  {
    title: 'LLM微调',
    slug: 'llm-finetune',
    meta: 'Dataset / LoRA / Eval',
    text: '数据构造、边界负样本、评测集和二次微调。',
    level: 6,
    href: '/topics/llm-finetune',
  },
  {
    title: '前端交互',
    slug: 'frontend-interaction',
    meta: 'Layout / Motion / Taste',
    text: '比例、排版、信息密度和微交互，比单纯炫更重要。',
    level: 5,
    href: '/topics/frontend-interaction',
  },
  {
    title: 'Agent系统',
    slug: 'agent-system',
    meta: 'Memory / Tools / Context',
    text: '记忆、工具调用、任务拆解和长期上下文。',
    level: 5,
    href: '/topics/agent-system',
  },
  {
    title: 'AI Infra',
    slug: 'ai-infra',
    meta: 'API / Stream / Cost',
    text: '模型中转、流式输出、日志、限额和成本控制。',
    level: 6,
    href: '/topics/ai-infra',
  },
  {
    title: 'HTTP抓包',
    slug: 'http-capture',
    meta: 'Proxy / TLS / Replay',
    text: '看请求、证书、代理和重放，理解真实通信路径。',
    level: 5,
    href: '/topics/http-capture',
  },
  {
    title: '个人知识系统',
    slug: 'knowledge-system',
    meta: 'Notion / Markdown / Search',
    text: '把笔记、博客、阅读和影像变成可检索资料层。',
    level: 7,
    href: '/topics/knowledge-system',
  },
  {
    title: 'RAG知识库',
    slug: 'rag-knowledge',
    meta: 'Vector / Citation / Recall',
    text: '回答能回到原文、能引用、能验证，比接入向量库更关键。',
    level: 6,
    href: '/topics/rag-knowledge',
  },
  {
    title: '自动化工作流',
    slug: 'automation-workflow',
    meta: 'Scripts / Sync / Deploy',
    text: '把整理、构建、同步和发布动作收成脚本。',
    level: 5,
    href: '/topics/automation-workflow',
  },
  {
    title: '影像分析',
    slug: 'cinema-analysis',
    meta: 'Narrative / Character / Taste',
    text: '看叙事、人物和镜头，也看作品如何影响判断与表达。',
    level: 4,
    href: '/topics/cinema-analysis',
  },
];

export const defaultTopics = {
  title: '主线',
  body: '',
  cards: defaultTopicCards,
};

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
    monitor: 'https://pulseboard.academicedu.me/',
    ai: 'https://ai.academicedu.me/',
  },
  topics: defaultTopics,
  assistant: {
    enabled: true,
    title: 'Ask Dev Notes',
    welcome: '可以随便问。和博客内容有关时，我会参考站内笔记、阅读和影像档案；其他问题也可以正常聊。',
    placeholder: '在Dev Notes中问任何问题',
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

const defaultTopicSlugMap = new Map(defaultTopicCards.map((card) => [card.title, card.slug]));

function slugifyTopic(value, fallback = 'topic') {
  const text = String(value || '').trim();
  if (defaultTopicSlugMap.has(text)) return defaultTopicSlugMap.get(text);
  const ascii = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || fallback;
}

function normalizeTopicCard(card = {}, index = 0) {
  const level = Number(card.level);
  const title = String(card.title || '').trim();
  const slug = slugifyTopic(card.slug || title, `topic-${index + 1}`);
  return {
    title,
    slug,
    meta: String(card.meta || '').trim(),
    text: String(card.text || '').trim(),
    level: Number.isFinite(level) ? Math.min(8, Math.max(1, Math.round(level))) : 5,
    href: `/topics/${slug}`,
  };
}

function normalizeTopics(input = {}) {
  const rawCards = Array.isArray(input.cards) ? input.cards : defaultTopicCards;
  const seen = new Map();
  const cards = rawCards
    .map((card, index) => normalizeTopicCard(card, index))
    .filter((card) => card.title || card.meta || card.text);
  const dedupedCards = cards.map((card) => {
    const count = seen.get(card.slug) || 0;
    seen.set(card.slug, count + 1);
    if (!count) return card;
    const slug = `${card.slug}-${count + 1}`;
    return { ...card, slug, href: `/topics/${slug}` };
  });

  return {
    ...defaultTopics,
    ...input,
    title: String(input.title || defaultTopics.title).trim(),
    body: '',
    cards: dedupedCards.length ? dedupedCards : defaultTopicCards,
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
    topics: normalizeTopics(parsed.topics || defaultTopics),
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
    db.prepare("DELETE FROM site_sections WHERE key = 'notes'").run();
  }

  function saveNormalizedSiteConfig(config) {
    const normalized = normalizeSiteConfig(JSON.stringify(config));
    db.prepare(`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES ('site', @value, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run({ value: JSON.stringify(normalized) });
    return normalized;
  }

  function uniqueTopicSlug(base, cards, currentSlug = '') {
    const desired = slugifyTopic(base, 'topic');
    const used = new Set(cards.map((card) => card.slug).filter((slug) => slug && slug !== currentSlug));
    if (!used.has(desired)) return desired;
    let index = 2;
    while (used.has(`${desired}-${index}`)) index += 1;
    return `${desired}-${index}`;
  }

  function migrateTopicLinks(fromSlug, toSlug) {
    if (!fromSlug || !toSlug || fromSlug === toSlug) return;
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT OR IGNORE INTO post_topic_links (post_id, topic_slug, sort_order)
        SELECT post_id, @toSlug, sort_order
        FROM post_topic_links
        WHERE topic_slug = @fromSlug
      `).run({ fromSlug, toSlug });
      db.prepare('DELETE FROM post_topic_links WHERE topic_slug = ?').run(fromSlug);
    });
    tx();
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
        topics: {
          ...current.topics,
          ...(input.topics || {}),
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
      saveNormalizedSiteConfig(merged);
      return this.getSiteConfig();
    },

    listTopics() {
      return this.getSiteConfig().topics.cards;
    },

    createTopic(input = {}) {
      initialize();
      const current = this.getSiteConfig();
      const title = String(input.title || '新主线').trim();
      const cards = current.topics.cards || [];
      const slug = uniqueTopicSlug(input.slug || title, cards);
      const nextCard = normalizeTopicCard({ ...input, title, slug }, cards.length);
      const next = saveNormalizedSiteConfig({
        ...current,
        topics: {
          ...current.topics,
          cards: [...cards, nextCard],
        },
      });
      return next.topics.cards.find((card) => card.slug === nextCard.slug);
    },

    updateTopic(slug, input = {}) {
      initialize();
      const current = this.getSiteConfig();
      const cards = current.topics.cards || [];
      const index = cards.findIndex((card) => card.slug === slug);
      if (index < 0) return null;
      const existing = cards[index];
      const title = String(input.title ?? existing.title).trim();
      if (!title) throw new Error('title is required');
      const nextSlug = uniqueTopicSlug(input.slug || existing.slug || title, cards, existing.slug);
      const nextCards = [...cards];
      nextCards[index] = normalizeTopicCard({
        ...existing,
        ...input,
        title,
        slug: nextSlug,
      }, index);
      const next = saveNormalizedSiteConfig({
        ...current,
        topics: {
          ...current.topics,
          cards: nextCards,
        },
      });
      const saved = next.topics.cards[index];
      migrateTopicLinks(existing.slug, saved.slug);
      return saved;
    },

    deleteTopic(slug) {
      initialize();
      const current = this.getSiteConfig();
      const cards = current.topics.cards || [];
      if (!cards.some((card) => card.slug === slug)) return false;
      saveNormalizedSiteConfig({
        ...current,
        topics: {
          ...current.topics,
          cards: cards.filter((card) => card.slug !== slug),
        },
      });
      db.prepare('DELETE FROM post_topic_links WHERE topic_slug = ?').run(slug);
      return true;
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

