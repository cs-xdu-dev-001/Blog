import { getReadingBySlug, getReadingGroups, readingArchive } from '../../data/readingArchive.mjs';
import { readingRepository } from './readingRepository.mjs';

function fromDb(row) {
  return {
    slug: row.slug,
    title: row.title,
    author: row.author,
    status: row.status,
    statusLabel: row.status_label,
    featured: Boolean(row.is_featured),
    progress: row.progress,
    spineColor: row.spine_color,
    accentColor: row.accent_color,
    summary: row.summary,
    quote: row.quote,
    review: row.review,
    cover: row.image_path || '',
  };
}

function fallbackGroups() {
  return getReadingGroups();
}

export function createReadingArchiveView(repository = readingRepository) {
  function listDbItems(options = {}) {
    try {
      const { items } = repository.list(options);
      return items.map(fromDb);
    } catch {
      return [];
    }
  }

  return {
    getFeaturedReadingFromDb(limit = readingArchive.length) {
      const dbItems = listDbItems({ filter: 'featured', limit });
      if (dbItems.length) return dbItems.slice(0, limit);
      return readingArchive.filter((book) => book.featured).slice(0, limit);
    },

    getReadingGroupsFromDb() {
      const dbItems = listDbItems({ limit: 1000 });
      if (!dbItems.length) return fallbackGroups();
      return {
        reading: dbItems.filter((book) => book.status === 'reading'),
        read: dbItems.filter((book) => book.status === 'read'),
        planned: dbItems.filter((book) => book.status === 'planned'),
      };
    },

    getReadingBySlugFromDb(slug) {
      try {
        const item = repository.getBySlug(slug);
        return item ? fromDb(item) : getReadingBySlug(slug);
      } catch {
        return getReadingBySlug(slug);
      }
    },

    getAllReadingFromDb() {
      const dbItems = listDbItems({ limit: 1000 });
      return dbItems.length ? dbItems : readingArchive;
    },
  };
}

const defaultView = createReadingArchiveView();

export const getFeaturedReadingFromDb = defaultView.getFeaturedReadingFromDb;
export const getReadingGroupsFromDb = defaultView.getReadingGroupsFromDb;
export const getReadingBySlugFromDb = defaultView.getReadingBySlugFromDb;
export const getAllReadingFromDb = defaultView.getAllReadingFromDb;
