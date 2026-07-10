import assert from 'node:assert/strict';
import { createWatchArchiveView } from '../src/lib/server/watchArchiveView.mjs';

const repo = {
  list() {
    return {
      items: [
        { title: 'A', type: '剧集', status: '已看', rating: '', image_path: '', quote: '', comment: '', quote_source: '' },
        { title: 'B', type: '电影', status: '已看', rating: '', image_path: '', quote: 'quote', comment: '', quote_source: 'source' },
        { title: 'C', type: '剧集', status: '想看', rating: '', image_path: '', quote: '', comment: '', quote_source: '' },
      ],
    };
  },
};

const archive = createWatchArchiveView(repo).getWatchArchiveFromDb();

assert.equal(archive.stats.total, 3);
assert.equal(archive.stats.watched, 2);
assert.equal(archive.stats.wanted, 1);
assert.equal(archive.stats.series, 2);
assert.equal(archive.stats.films, 1);
assert.deepEqual(archive.selected, ['B']);
