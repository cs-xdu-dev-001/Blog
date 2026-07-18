import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';

function slugifyHeading(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    || 'section';
}

function textFromNode(node) {
  if (!node) return '';
  if (typeof node.value === 'string') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(textFromNode).join('');
}

function headingPlugin(headings) {
  return () => (tree) => {
    visit(tree, 'heading', (node) => {
      const text = textFromNode(node).trim();
      if (!text) return;
      const slug = slugifyHeading(text);
      headings.push({ depth: node.depth, slug, text });
      node.data ||= {};
      node.data.hProperties ||= {};
      node.data.hProperties.id = slug;
    });
  };
}

function externalLinkPlugin() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a') return;
      const href = String(node.properties?.href || '');
      if (!/^https?:\/\//i.test(href)) return;
      node.properties.target = '_blank';
      node.properties.rel = 'noreferrer';
    });
  };
}

export function markdownToHtml(markdown = '') {
  const headings = [];
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(headingPlugin(headings))
    .use(remarkRehype)
    .use(externalLinkPlugin)
    .use(rehypeStringify)
    .processSync(String(markdown || ''));

  return { html: String(file), headings };
}

export function readingTimeForMarkdown(markdown = '') {
  const text = String(markdown || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`[\]()\-|~]/g, '');
  return Math.max(1, Math.ceil(text.length / 650));
}
