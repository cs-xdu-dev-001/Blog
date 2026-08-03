import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';

const postsPrefix = '/uploads/posts/';

export function normalizePostImagePath(value) {
  const source = String(value || '').trim().split(/[?#]/, 1)[0];
  if (!source.startsWith(postsPrefix)) return '';
  const encodedSegments = source.slice(postsPrefix.length).split('/').filter(Boolean);
  if (!encodedSegments.length) return '';
  const normalized = [];
  for (const segment of encodedSegments) {
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return '';
    }
    if (!decoded || decoded === '.' || decoded === '..' || /[\\/]/.test(decoded)) return '';
    normalized.push(encodeURIComponent(decoded));
  }
  return `${postsPrefix}${normalized.join('/')}`;
}

export function collectReferencedPostImagePaths(markdown) {
  const paths = new Set();
  const tree = unified().use(remarkParse).parse(String(markdown || ''));
  visit(tree, 'image', (node) => {
    const normalized = normalizePostImagePath(node.url);
    if (normalized) paths.add(normalized);
  });
  return paths;
}

export function postImageAssetIsReferenced(asset, referencedPaths) {
  return [asset.image_path, asset.small_path, asset.original_path]
    .map(normalizePostImagePath)
    .some((value) => value && referencedPaths.has(value));
}
