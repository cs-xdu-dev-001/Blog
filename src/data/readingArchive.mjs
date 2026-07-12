export const readingArchive = [
  {
    slug: 'all-quiet-in-peking',
    title: '北平无战事',
    author: '刘和平',
    status: 'reading',
    statusLabel: '在读',
    featured: true,
    progress: '在读',
    spineColor: '#263548',
    accentColor: '#ff9138',
    tone: 'ink',
    summary: '一部关于时代、制度、信念和个人命运的长篇叙事，适合慢慢读。',
    quote: '风雨如晦，鸡鸣不已。',
    review:
      '这本先放在正在阅读里。它吸引我的不是单纯的情节推进，而是复杂局势里每个人的选择、沉默和代价。',
  },
  {
    slug: 'ming-dynasty-1566',
    title: '大明王朝1566',
    author: '刘和平',
    status: 'reading',
    statusLabel: '在读',
    featured: true,
    progress: '在读',
    spineColor: '#7a3d20',
    accentColor: '#f3b36a',
    tone: 'clay',
    summary: '从权力、财政、士大夫和民生之间的拉扯里，看见一套系统如何运转。',
    quote: '天变不足畏，祖宗不足法，人言不足恤。',
    review:
      '我会把它当成政治叙事和系统观察来读。真正有意思的地方，是每个人都在自己的位置上做“合理”的事，最后却共同推向更大的困局。',
  },
  {
    slug: 'liu-heping-talks-on-art',
    title: '六经责我开生面',
    author: '刘和平',
    status: 'read',
    statusLabel: '已读',
    featured: true,
    progress: '已完成',
    spineColor: '#1f5f5a',
    accentColor: '#84c9b7',
    tone: 'green',
    summary: '刘和平谈创作、历史、人物和戏剧结构，也适合反过来理解他的作品。',
    quote: '六经责我开生面，七尺从天乞活埋。',
    review:
      '这本适合和《北平无战事》《大明王朝1566》一起看。它更像一份创作方法的旁白，能看到作者如何处理历史、人物和时代压力。',
  },
  {
    slug: 'on-top-of-tides',
    title: '浪潮之巅',
    author: '吴军',
    status: 'read',
    statusLabel: '已读',
    featured: true,
    progress: '已完成',
    spineColor: '#d86618',
    accentColor: '#263548',
    tone: 'orange',
    summary: '从科技公司兴衰里看产业周期、技术路线和商业判断。',
    quote: '科技的发展不是匀速前进，而是一浪接一浪。',
    review:
      '它适合放在技术视野这一类。读它不是为了记住哪个公司赢了，而是观察平台、周期、组织和技术路线如何彼此塑造。',
  },
  {
    slug: 'selected-works-of-mao-zedong',
    title: '毛泽东选集',
    author: '毛泽东',
    status: 'planned',
    statusLabel: '待读',
    featured: true,
    progress: '待读',
    spineColor: '#8a2f24',
    accentColor: '#f7d7a7',
    tone: 'red',
    summary: '一套需要结合历史语境来读的文本，重点是问题意识、组织判断和实践方法。',
    quote: '没有调查，没有发言权。',
    review:
      '这套书会慢慢读，不适合赶进度。我的关注点会放在分析问题的方法、语言的力量，以及文本背后的历史处境。',
  },
  {
    slug: 'the-protagonist',
    title: '主角',
    author: '陈彦',
    status: 'planned',
    statusLabel: '待读',
    featured: true,
    progress: '待读',
    spineColor: '#5b4a3b',
    accentColor: '#ffbd72',
    tone: 'brown',
    summary: '从戏台、命运和时代变化里，看一个人成为“主角”的漫长过程。',
    quote: '人生如戏，戏如人生。',
    review:
      '这本先放在待读。它和前面几本不太一样，更偏文学和人物命运，适合给书架增加一点厚度和人味。',
  },
  {
    slug: 'the-three-body-problem',
    title: '三体',
    author: '刘慈欣',
    status: 'planned',
    statusLabel: '待读',
    featured: true,
    progress: '待读',
    spineColor: '#334155',
    accentColor: '#d9a6bb',
    tone: 'slate',
    summary: '把宇宙尺度、文明选择和技术想象放进一个足够冷峻的故事里。',
    quote: '给岁月以文明，而不是给文明以岁月。',
    review:
      '这本适合单独开一篇认真写。它不只是科幻设定，更重要的是宏大尺度下，人和文明如何面对不确定性。',
  },
];

export function getFeaturedReading(limit = readingArchive.length) {
  return readingArchive
    .filter((book) => book.featured)
    .slice(0, limit);
}

export function getReadingBySlug(slug) {
  return readingArchive.find((book) => book.slug === slug);
}

export function getReadingGroups() {
  return {
    reading: readingArchive.filter((book) => book.status === 'reading'),
    read: readingArchive.filter((book) => book.status === 'read'),
    planned: readingArchive.filter((book) => book.status === 'planned'),
  };
}
