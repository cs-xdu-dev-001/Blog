export function escapeSearchHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function safeSearchHref(value) {
  const href = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return href.startsWith('/') && !href.startsWith('//') ? href : '';
}

export function flattenSearchItems(groups = []) {
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((group) => {
    if (!group || !Array.isArray(group.items)) return [];
    return group.items.map((item) => ({
      ...item,
      groupKey: String(group.key || ''),
      groupLabel: String(group.label || ''),
    }));
  });
}
