import { watchImages } from '../src/data/watchImages.mjs';
import { watchItems } from '../src/data/watchItems.generated.mjs';
import { watchLines } from '../src/data/watchLines.mjs';
import { readingArchive } from '../src/data/readingArchive.mjs';
import { readingRepository } from '../src/lib/server/readingRepository.mjs';
import { watchRepository } from '../src/lib/server/watchRepository.mjs';

const featuredTitles = new Set([
  '北平无战事',
  '隐入尘烟',
  '一九四二',
  '柳如是',
  '南京照相馆',
  '主角',
  '飞驰人生3',
  '一念天堂',
]);

const activityByTitle = {
  '大江大河': { status: '在看', is_activity_featured: 1 },
  '主角': { status: '已看', is_activity_featured: 1 },
};

watchRepository.initialize();
watchRepository.replaceAll(watchItems.map((item) => {
  const activity = activityByTitle[item.title];
  return {
    title: item.title,
    type: item.type,
    status: activity?.status ?? item.status,
    rating: item.rating ?? '',
    comment: '',
    quote: watchLines[item.title]?.text ?? '',
    quote_source: watchLines[item.title]?.source ?? '',
    image_path: watchImages[item.title] ?? '',
    is_featured: featuredTitles.has(item.title) ? 1 : 0,
    progress_text: '',
    completed_at: '',
    is_activity_featured: activity?.is_activity_featured ?? 0,
  };
}));

console.log(`Imported ${watchItems.length} watch items`);

readingRepository.initialize();
readingRepository.replaceAll(readingArchive.map((book, index) => ({
  slug: book.slug,
  title: book.title,
  author: book.author,
  status: book.status,
  status_label: book.statusLabel,
  progress: book.progress,
  summary: book.summary,
  quote: book.quote,
  review: book.review,
  spine_color: book.spineColor,
  accent_color: book.accentColor,
  image_path: book.cover ?? '',
  is_featured: book.featured ? 1 : 0,
  sort_order: index + 1,
})));

console.log(`Imported ${readingArchive.length} reading items`);
