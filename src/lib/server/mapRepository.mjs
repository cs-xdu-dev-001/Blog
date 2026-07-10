import { initializeSchema, openDatabase } from './db.mjs';

const SETTING_KEY = 'travel_map';

const defaultPlaces = [
  { id: 'beijing', label: '北京', x: 72.5, y: 35.4 },
  { id: 'tianjin', label: '天津', x: 73.9, y: 36.5 },
  { id: 'jinan', label: '济南', x: 73.5, y: 41.6 },
  { id: 'qingdao', label: '青岛', x: 78.3, y: 42.6 },
  { id: 'weihai', label: '威海', x: 80.9, y: 40.0 },
  { id: 'rizhao', label: '日照', x: 77.1, y: 43.8 },
  { id: 'gaomi', label: '高密', x: 77.4, y: 42.1 },
  { id: 'heze', label: '菏泽', x: 71.1, y: 44.2 },
  { id: 'puyang', label: '濮阳', x: 70.4, y: 43.2 },
  { id: 'kaifeng', label: '开封', x: 69.3, y: 45.0 },
  { id: 'nanjing', label: '南京', x: 76.0, y: 49.8 },
  { id: 'suzhou', label: '苏州', x: 78.6, y: 51.1 },
  { id: 'shanghai', label: '上海', x: 80.0, y: 51.3 },
  { id: 'hangzhou', label: '杭州', x: 78.0, y: 52.9 },
];

const defaultConfig = {
  map: { x: 0, y: 0, scale: 1 },
  current: { label: "Xi'an", x: 61.4, y: 45.8 },
  label: { x: 8, y: 76 },
  visual: {
    saturation: 0.92,
    contrast: 0.82,
    brightness: 1.08,
    opacity: 0.82,
    overlay: 0.34,
    heatSize: 44,
    heatOpacity: 0.92,
    currentHeatSize: 190,
    currentHeatOpacity: 1,
    showCityLabels: false,
  },
  places: defaultPlaces,
};

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeConfig(input = {}) {
  const places = Array.isArray(input.places) && input.places.length ? input.places : defaultPlaces;
  return {
    map: {
      x: clampNumber(input.map?.x, -100, 100, defaultConfig.map.x),
      y: clampNumber(input.map?.y, -100, 100, defaultConfig.map.y),
      scale: clampNumber(input.map?.scale, 0.6, 2.2, defaultConfig.map.scale),
    },
    current: {
      label: String(input.current?.label || defaultConfig.current.label),
      x: clampNumber(input.current?.x, 0, 100, defaultConfig.current.x),
      y: clampNumber(input.current?.y, 0, 100, defaultConfig.current.y),
    },
    label: {
      x: clampNumber(input.label?.x, 0, 100, defaultConfig.label.x),
      y: clampNumber(input.label?.y, 0, 100, defaultConfig.label.y),
    },
    visual: {
      saturation: clampNumber(input.visual?.saturation, 0.2, 1.8, defaultConfig.visual.saturation),
      contrast: clampNumber(input.visual?.contrast, 0.2, 1.8, defaultConfig.visual.contrast),
      brightness: clampNumber(input.visual?.brightness, 0.5, 1.8, defaultConfig.visual.brightness),
      opacity: clampNumber(input.visual?.opacity, 0.2, 1, defaultConfig.visual.opacity),
      overlay: clampNumber(input.visual?.overlay, 0, 0.85, defaultConfig.visual.overlay),
      heatSize: clampNumber(input.visual?.heatSize, 16, 96, defaultConfig.visual.heatSize),
      heatOpacity: clampNumber(input.visual?.heatOpacity, 0.1, 1, defaultConfig.visual.heatOpacity),
      currentHeatSize: clampNumber(input.visual?.currentHeatSize, 80, 320, defaultConfig.visual.currentHeatSize),
      currentHeatOpacity: clampNumber(input.visual?.currentHeatOpacity, 0, 1, defaultConfig.visual.currentHeatOpacity),
      showCityLabels: Boolean(input.visual?.showCityLabels),
    },
    places: places.map((place, index) => {
      const fallback = defaultPlaces[index] || defaultPlaces[0];
      return {
        id: String(place.id || fallback.id || `place-${index}`),
        label: String(place.label || fallback.label || `Place ${index + 1}`),
        x: clampNumber(place.x, 0, 100, fallback.x),
        y: clampNumber(place.y, 0, 100, fallback.y),
      };
    }),
  };
}

export function createMapRepository({ dbPath } = {}) {
  const db = openDatabase(dbPath);

  function initialize() {
    initializeSchema(db);
    const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(SETTING_KEY);
    if (row) return;
    db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)').run(
      SETTING_KEY,
      JSON.stringify(defaultConfig),
    );
  }

  return {
    getConfig() {
      initialize();
      const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(SETTING_KEY);
      try {
        return normalizeConfig(JSON.parse(row?.value || '{}'));
      } catch {
        return normalizeConfig(defaultConfig);
      }
    },

    saveConfig(input) {
      initialize();
      const config = normalizeConfig(input);
      db.prepare(`
        INSERT INTO site_settings (key, value, updated_at)
        VALUES (@key, @value, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).run({ key: SETTING_KEY, value: JSON.stringify(config) });
      return config;
    },
  };
}

export const mapRepository = createMapRepository();
