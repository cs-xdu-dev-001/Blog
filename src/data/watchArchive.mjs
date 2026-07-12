import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { watchImages } from './watchImages.mjs';
import { watchItems } from './watchItems.generated.mjs';
import { watchLines } from './watchLines.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '../..');
const watchImageDir = path.join(projectRoot, 'public', 'watch');
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const fallbackImages = [
  'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1523207911345-32501502db22?auto=format&fit=crop&w=900&q=80',
];

function findImageByTitle(title) {
  for (const extension of imageExtensions) {
    const fileName = `${title}${extension}`;
    if (fs.existsSync(path.join(watchImageDir, fileName))) {
      return `/watch/${encodeURIComponent(fileName).replaceAll('%2F', '/')}`;
    }
  }
  return null;
}

const items = watchItems.map((item, index) => ({
  ...item,
  image: watchImages[item.title] ?? findImageByTitle(item.title) ?? item.image ?? fallbackImages[index % fallbackImages.length],
  line: watchLines[item.title]?.text ?? 'quote pending',
  lineSource: watchLines[item.title]?.source ?? null,
}));

const sourcedItems = items.filter((item) => item.lineSource);
const unsourcedItems = items.filter((item) => !item.lineSource);

function buildRow(rowIndex) {
  const rowSources = sourcedItems.filter((_, index) => index % 2 === rowIndex);
  const rowItems = unsourcedItems.filter((_, index) => index % 2 === rowIndex);
  const merged = [];
  let sourceIndex = 0;

  for (let index = 0; index < rowItems.length; index += 1) {
    if (index % 6 === 0 && rowSources[sourceIndex]) {
      merged.push(rowSources[sourceIndex]);
      sourceIndex += 1;
    }
    merged.push(rowItems[index]);
  }

  return merged.concat(rowSources.slice(sourceIndex));
}

const rows = [
  {
    direction: 'normal',
    items: buildRow(0),
  },
  {
    direction: 'reverse',
    items: buildRow(1),
  },
];

export const watchArchive = {
  motion: {
    durationSeconds: 520,
  },
  imageConfig: {
    publicDir: '/watch/',
    mode: 'filename',
    file: 'src/data/watchImages.mjs',
    example: 'public/watch/北平无战事.jpg',
  },
  lineSources: watchLines,
  stats: {
    watched: 261,
    wanted: 101,
    series: 168,
    films: 93,
  },
  selected: [
    '北平无战事',
    '隐入尘烟',
    '一九四二',
    '柳如是',
    '南京照相馆',
    '主角',
    '飞驰人生3',
    '一念天堂',
  ],
  wantedPreview: [
    '人间正道是沧桑',
    '山海情',
    '士兵突击',
    '闯关东',
    '福贵',
    '宇宙探索编辑部',
    '窃听风暴',
    '辩护人',
    '帝国的毁灭',
    '首尔之春',
    '教父',
    '肖申克的救赎',
  ],
  items,
  rows,
};
