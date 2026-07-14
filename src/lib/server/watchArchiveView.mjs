import { watchArchive as fallbackArchive } from '../../data/watchArchive.mjs';
import { watchRepository } from './watchRepository.mjs';

const fallbackWithActivity = {
  ...fallbackArchive,
  activity: null,
};

function buildRows(items) {
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

  return [
    { direction: 'normal', items: buildRow(0) },
    { direction: 'reverse', items: buildRow(1) },
  ];
}

function isWatched(item) {
  return item.status === '已看' || item.status === '宸茬湅';
}

function isWanted(item) {
  return item.status === '想看' || item.status === '鎯崇湅';
}

function isSeries(item) {
  return item.type === '剧集' || item.type === '鍓ч泦';
}

function isFilm(item) {
  return item.type === '电影' || item.type === '鐢靛奖';
}

export function createWatchArchiveView(repository = watchRepository) {
  return {
    getWatchArchiveFromDb() {
      try {
        const { items } = repository.list({ limit: 1000 });
        if (!items.length) return fallbackWithActivity;

        const mapped = items.map((item) => ({
          id: item.id,
          href: `/watch/${item.id}`,
          title: item.title,
          type: item.type,
          status: item.status,
          rating: item.rating,
          image: item.image_path || null,
          imageSmall: item.image_small_path || item.image_path || null,
          imageOriginal: item.image_original_path || item.image_path || null,
          imageWidth: Number(item.image_width || 0),
          imageHeight: Number(item.image_height || 0),
          line: item.quote || item.comment || '已收录到影像档案',
          lineSource: item.quote_source || (item.comment ? '个人评论' : null),
          progressText: item.progress_text || '',
          completedAt: item.completed_at || '',
          isActivityFeatured: Boolean(item.is_activity_featured),
        }));

        const watching = mapped.find((item) => item.status === '在看' && item.isActivityFeatured);
        const finished = mapped.find((item) => item.status === '已看' && item.isActivityFeatured);

        return {
          motion: fallbackArchive.motion,
          imageConfig: fallbackArchive.imageConfig,
          lineSources: fallbackArchive.lineSources,
          stats: {
            total: mapped.length,
            watched: mapped.filter(isWatched).length,
            wanted: mapped.filter(isWanted).length,
            series: mapped.filter(isSeries).length,
            films: mapped.filter(isFilm).length,
          },
          selected: mapped.filter((item) => item.lineSource).slice(0, 8).map((item) => item.title),
          wantedPreview: mapped.filter(isWanted).slice(0, 12).map((item) => item.title),
          activity: watching && finished ? { watching, finished } : null,
          items: mapped,
          rows: buildRows(mapped),
        };
      } catch {
        return fallbackWithActivity;
      }
    },
  };
}

const defaultView = createWatchArchiveView();

export const getWatchArchiveFromDb = defaultView.getWatchArchiveFromDb;
