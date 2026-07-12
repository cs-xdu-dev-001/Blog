import assert from 'node:assert/strict';
import { createWatchArchiveView } from '../src/lib/server/watchArchiveView.mjs';

const repo = {
  list() {
    return {
      items: [
        { title: 'A', type: '剧集', status: '已看', rating: '', image_path: '', quote: '', comment: '', quote_source: '', progress_text: '', completed_at: '', is_activity_featured: 0 },
        { title: '主角', type: '电影', status: '已看', rating: '', image_path: '/watch/主角.jpg', quote: 'quote', comment: '', quote_source: 'source', progress_text: '', completed_at: '', is_activity_featured: 1 },
        { title: 'C', type: '剧集', status: '想看', rating: '', image_path: '', quote: '', comment: '', quote_source: '', progress_text: '', completed_at: '', is_activity_featured: 0 },
        { title: '大江大河', type: '剧集', status: '在看', rating: '', image_path: '/watch/大江大河.jpg', quote: '', comment: '', quote_source: '', progress_text: '', completed_at: '', is_activity_featured: 1 },
      ],
    };
  },
};

const archive = createWatchArchiveView(repo).getWatchArchiveFromDb();

assert.equal(archive.stats.total, 4);
assert.equal(archive.stats.watched, 2);
assert.equal(archive.stats.wanted, 1);
assert.equal(archive.stats.series, 3);
assert.equal(archive.stats.films, 1);
assert.deepEqual(archive.selected, ['主角']);
assert.equal(archive.activity.watching.title, '大江大河');
assert.equal(archive.activity.watching.image, '/watch/大江大河.jpg');
assert.equal(archive.activity.finished.title, '主角');
assert.equal(archive.activity.finished.image, '/watch/主角.jpg');

const incompleteArchive = createWatchArchiveView({
  list() {
    return {
      items: [
        { title: '大江大河', type: '剧集', status: '在看', image_path: '', is_activity_featured: 1 },
      ],
    };
  },
}).getWatchArchiveFromDb();

assert.equal(incompleteArchive.activity, null);
