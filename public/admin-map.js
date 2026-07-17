const state = {
  mode: 'heat',
  config: null,
  drag: null,
};

const surface = document.querySelector('[data-map-surface]');
const pointsEl = document.querySelector('[data-map-points]');
const tiles = document.querySelector('[data-map-tiles]');
const pin = document.querySelector('[data-current-pin]');
const orbitA = document.querySelector('[data-current-orbit-a]');
const orbitB = document.querySelector('[data-current-orbit-b]');
const label = document.querySelector('[data-current-label]');
const readout = document.querySelector('[data-map-readout]');
const saveState = document.querySelector('[data-map-state]');
const modeButtons = [...document.querySelectorAll('[data-map-mode]')];
let pointsRendered = false;

tiles.querySelectorAll('img').forEach((image) => {
  image.draggable = false;
});

surface.addEventListener('dragstart', (event) => {
  event.preventDefault();
});

function getByPath(object, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], object);
}

function setByPath(object, path, value) {
  const keys = path.split('.');
  let target = object;
  while (keys.length > 1) target = target[keys.shift()];
  target[keys[0]] = Number(value);
}

function setBooleanByPath(object, path, value) {
  const keys = path.split('.');
  let target = object;
  while (keys.length > 1) target = target[keys.shift()];
  target[keys[0]] = Boolean(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyConfig() {
  const config = state.config;
  const visual = config.visual;

  tiles.style.setProperty('--map-x', `${config.map.x}%`);
  tiles.style.setProperty('--map-y', `${config.map.y}%`);
  tiles.style.setProperty('--map-scale', config.map.scale);
  tiles.style.setProperty('--map-saturation', visual.saturation);
  tiles.style.setProperty('--map-contrast', visual.contrast);
  tiles.style.setProperty('--map-brightness', visual.brightness);
  tiles.style.setProperty('--map-opacity', visual.opacity);
  surface.style.setProperty('--map-overlay', visual.overlay);
  surface.style.setProperty('--heat-size', `${visual.heatSize}px`);
  surface.style.setProperty('--heat-opacity', visual.heatOpacity);
  surface.style.setProperty('--current-heat-size', `${visual.currentHeatSize}px`);
  surface.style.setProperty('--current-heat-opacity', visual.currentHeatOpacity);
  surface.classList.toggle('show-city-labels', visual.showCityLabels);

  [pin, orbitA, orbitB].forEach((item) => {
    item.style.setProperty('--x', `${config.current.x}%`);
    item.style.setProperty('--y', `${config.current.y}%`);
  });
  label.style.setProperty('--label-x', `${config.label.x}%`);
  label.style.setProperty('--label-y', `${config.label.y}%`);

  if (!pointsRendered) {
    pointsEl.innerHTML = config.places.map((place, index) => `
      <span class="qzq-travel-heat map-admin-point" data-index="${index}" title="${place.label}" style="--x:${place.x}%;--y:${place.y}%;--delay:0ms">
        <span>${place.label}</span>
      </span>
    `).join('');
    pointsRendered = true;
  }

  pointsEl.querySelectorAll('.map-admin-point').forEach((point) => {
    const place = config.places[Number(point.dataset.index)];
    if (!place) return;
    point.title = place.label;
    point.style.setProperty('--x', `${place.x}%`);
    point.style.setProperty('--y', `${place.y}%`);
    point.querySelector('span').textContent = place.label;
  });

  document.querySelectorAll('[data-map-input]').forEach((input) => {
    const path = input.dataset.mapInput;
    const value = getByPath(config, path);
    input.value = Number(value);
  });

  document.querySelectorAll('[data-map-slider]').forEach((input) => {
    const path = input.dataset.mapSlider;
    const value = getByPath(config, path);
    input.value = Number(value);
  });

  document.querySelectorAll('[data-map-checkbox]').forEach((input) => {
    input.checked = Boolean(getByPath(config, input.dataset.mapCheckbox));
  });
}

function setMode(mode) {
  state.mode = mode;
  surface.dataset.mapMode = mode;
  modeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.mapMode === mode);
    button.setAttribute('aria-pressed', String(button.dataset.mapMode === mode));
  });
}

function pointFromEvent(event) {
  const rect = surface.getBoundingClientRect();
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
  };
}

function nearestHeatPoint(event) {
  let nearest = null;
  let nearestDistance = Infinity;
  pointsEl.querySelectorAll('.map-admin-point').forEach((point) => {
    const rect = point.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const distance = Math.hypot(event.clientX - x, event.clientY - y);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  });
  return nearestDistance <= 42 ? nearest : null;
}

function updateReadout(text) {
  readout.textContent = text;
}

async function loadConfig() {
  const res = await fetch('/api/admin/map');
  const data = await res.json();
  state.config = data.config;
  setMode(state.mode);
  applyConfig();
}

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setMode(button.dataset.mapMode);
    updateReadout(`当前模式：${button.textContent}`);
  });
});

surface.addEventListener('pointerdown', (event) => {
  if (!state.config) return;
  const pointNode = event.target.closest('.map-admin-point') || (state.mode === 'heat' ? nearestHeatPoint(event) : null);
  if (event.target.closest('[data-current-pin]')) {
    state.drag = { type: 'pin' };
  } else if (state.mode === 'heat' && pointNode) {
    state.drag = { type: 'heat', index: Number(pointNode.dataset.index) };
  } else if (state.mode === 'label' && event.target.closest('[data-current-label]')) {
    state.drag = { type: 'label' };
  } else {
    updateReadout('没有选中可拖动元素。底图位置请用地图滑轨调整。');
    return;
  }
  surface.classList.add('is-dragging');
  surface.setPointerCapture(event.pointerId);
});

surface.addEventListener('pointermove', (event) => {
  if (!state.drag) return;
  const p = pointFromEvent(event);
  if (state.drag.type === 'heat') {
    const place = state.config.places[state.drag.index];
    place.x = p.x;
    place.y = p.y;
    updateReadout(`${place.label}: x ${p.x.toFixed(2)}%, y ${p.y.toFixed(2)}%`);
  }
  if (state.drag.type === 'pin') {
    state.config.current.x = p.x;
    state.config.current.y = p.y;
    updateReadout(`Xi'an: x ${p.x.toFixed(2)}%, y ${p.y.toFixed(2)}%`);
  }
  if (state.drag.type === 'label') {
    state.config.label.x = p.x;
    state.config.label.y = p.y;
    updateReadout(`地点胶囊: x ${p.x.toFixed(2)}%, y ${p.y.toFixed(2)}%`);
  }
  applyConfig();
});

surface.addEventListener('pointerup', (event) => {
  state.drag = null;
  surface.classList.remove('is-dragging');
  surface.releasePointerCapture(event.pointerId);
});

surface.addEventListener('pointercancel', () => {
  state.drag = null;
  surface.classList.remove('is-dragging');
});

document.querySelectorAll('[data-map-input]').forEach((input) => {
  input.addEventListener('input', () => {
    setByPath(state.config, input.dataset.mapInput, input.value);
    updateReadout('视觉参数已更新，保存后首页生效。');
    applyConfig();
  });
});

document.querySelectorAll('[data-map-slider]').forEach((input) => {
  input.addEventListener('input', () => {
    setByPath(state.config, input.dataset.mapSlider, input.value);
    updateReadout(`地图：x ${state.config.map.x.toFixed(2)}%, y ${state.config.map.y.toFixed(2)}%, scale ${state.config.map.scale.toFixed(2)}`);
    applyConfig();
  });
});

document.querySelectorAll('[data-map-checkbox]').forEach((input) => {
  input.addEventListener('change', () => {
    setBooleanByPath(state.config, input.dataset.mapCheckbox, input.checked);
    updateReadout(input.checked ? '城市标签已显示。' : '城市标签已隐藏。');
    applyConfig();
  });
});

document.querySelector('[data-save-map]').addEventListener('click', async () => {
  saveState.textContent = '正在保存';
  const res = await fetch('/api/admin/map', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state.config),
  });
  const data = await res.json();
  state.config = data.config;
  applyConfig();
  saveState.textContent = '已保存';
  window.setTimeout(() => {
    saveState.textContent = '已就绪';
  }, 1200);
});

loadConfig();
