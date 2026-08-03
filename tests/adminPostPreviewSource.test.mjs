import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('admin post editor previews through the frontend markdown renderer', () => {
  const page = read('src/pages/admin/posts/[id]/edit.astro');
  const client = read('public/admin-post-editor.js');
  const milkdownClientPath = new URL('../src/scripts/admin-post-milkdown.js', import.meta.url);
  const milkdownClient = fs.existsSync(milkdownClientPath) ? fs.readFileSync(milkdownClientPath, 'utf8') : '';
  const milkdownLoaderPath = new URL('../src/scripts/admin-post-milkdown-loader.js', import.meta.url);
  const milkdownLoader = fs.existsSync(milkdownLoaderPath) ? fs.readFileSync(milkdownLoaderPath, 'utf8') : '';
  const languageCatalogPath = new URL('../src/scripts/codemirror-language-data.js', import.meta.url);
  const languageCatalog = fs.existsSync(languageCatalogPath) ? fs.readFileSync(languageCatalogPath, 'utf8') : '';
  const codeFeature = read('src/scripts/admin-post-milkdown-code.js');
  const tableFeature = read('src/scripts/admin-post-milkdown-table.js');
  const latexFeature = read('src/scripts/admin-post-milkdown-latex.js');
  const astroConfig = read('astro.config.mjs');
  const apiUrl = new URL('../src/pages/api/admin/posts/preview.ts', import.meta.url);
  const imageApiUrl = new URL('../src/pages/api/admin/posts/image.ts', import.meta.url);
  const api = fs.existsSync(apiUrl) ? fs.readFileSync(apiUrl, 'utf8') : '';
  const imageApi = fs.existsSync(imageApiUrl) ? fs.readFileSync(imageApiUrl, 'utf8') : '';
  const styles = read('src/styles/global.css');

  assert.match(page, /post-editor-preview article-prose/);
  assert.match(page, /post-editor-meta-grid/);
  assert.match(page, /post-editor-content-meta/);
  assert.match(page, /post-editor-properties/);
  assert.match(page, /post-meta-property-list/);
  assert.match(page, /post-description-field/);
  assert.match(page, />摘要</);
  assert.match(page, /post-description-input[^>]*name="description"/);
  assert.match(page, /data-milkdown-editor/);
  assert.match(page, /admin-post-milkdown-loader\.js/);
  assert.doesNotMatch(page, /import '\.\.\/\.\.\/\.\.\/\.\.\/scripts\/admin-post-milkdown\.js'/);
  assert.match(page, /data-markdown-input/);
  assert.doesNotMatch(page, /data-markdown-input[^>]*hidden|hidden[^>]*data-markdown-input/);
  assert.equal(fs.existsSync(milkdownClientPath), true);
  assert.equal(fs.existsSync(milkdownLoaderPath), true);
  assert.equal(fs.existsSync(languageCatalogPath), true);
  assert.equal(fs.existsSync(apiUrl), true);
  assert.equal(fs.existsSync(imageApiUrl), true);
  assert.match(api, /markdownToHtml/);
  assert.match(client, /\/api\/admin\/posts\/preview/);
  assert.match(client, /previewRequestId/);
  assert.match(client, /markdown === lastPreviewMarkdown/);
  assert.match(client, /markdown === previewPendingMarkdown/);
  assert.match(client, /setPreviewState\('loading'\)/);
  assert.match(client, /setPreviewState\('ready'\)/);
  assert.match(client, /setPreviewState\('error'/);
  assert.match(client, /aria-busy/);
  assert.match(client, /PREVIEW_DELAY_MS\s*=\s*400/);
  assert.match(client, /previewIsVisible\(\)/);
  assert.match(client, /attempt\s*<\s*2/);
  assert.match(client, /hasSuccessfulPreview/);
  assert.match(client, /continueMarkdownBlock/);
  assert.match(client, /nextMarkdownPrefix/);
  assert.match(client, /adjustMarkdownIndent/);
  assert.match(client, /Number\(ordered\[2\]\) \+ 1/);
  assert.match(client, /\$\{task\[1\]\}\$\{task\[2\]\} \[ \] /);
  assert.match(client, /handleMarkdownShortcut/);
  assert.match(client, /expandCodeFenceShortcut/);
  assert.match(client, /codeFenceTemplate/);
  assert.match(client, /slashCommandTemplate/);
  assert.match(client, /\/表格/);
  assert.match(client, /\/math/);
  assert.match(client, /\{\{red:/);
  assert.match(client, /uploadPostImage/);
  assert.match(client, /\/api\/admin\/posts\/image/);
  assert.match(client, /findMarkdownTables/);
  assert.match(client, /parseMarkdownTable/);
  assert.match(client, /serializeMarkdownTable/);
  assert.match(client, /enhancePreviewTables/);
  assert.match(client, /openTableEditor/);
  assert.match(client, /applyTableEdit/);
  assert.match(client, /data-preview-table-index/);
  assert.match(client, /tableEditorDrag/);
  assert.match(client, /startTableEditorDrag/);
  assert.match(client, /moveTableEditor/);
  assert.match(client, /clampTableEditorPosition/);
  assert.match(client, /setPointerCapture/);
  assert.doesNotMatch(client, /post-table-editor-backdrop/);
  assert.match(milkdownClient, /@milkdown\/crepe/);
  assert.match(codeFeature, /codemirror-language-data/);
  assert.match(codeFeature, /languages/);
  assert.match(astroConfig, /@codemirror\/language-data/);
  assert.match(astroConfig, /codemirror-language-data\.js/);
  for (const language of [
    '@codemirror/lang-javascript',
    '@codemirror/lang-python',
    '@codemirror/lang-sql',
    '@codemirror/lang-json',
    '@codemirror/lang-html',
    '@codemirror/lang-css',
    '@codemirror/lang-markdown',
    '@codemirror/legacy-modes/mode/shell',
  ]) {
    assert.match(languageCatalog, new RegExp(language.replaceAll('/', '\\/')));
  }
  assert.doesNotMatch(languageCatalog, /legacy-modes\/mode\/apl/);
  assert.match(milkdownClient, /export async function bootMilkdown/);
  assert.doesNotMatch(milkdownClient, /\nbootMilkdown\(\);\s*$/);
  assert.doesNotMatch(milkdownClient, /from\s+'@milkdown\/crepe'/);
  assert.match(milkdownClient, /import\s+\{\s*CrepeBuilder\s*\}\s+from\s+'@milkdown\/crepe\/builder'/);
  assert.match(milkdownClient, /from\s+'@milkdown\/crepe\/feature\/image-block'/);
  assert.doesNotMatch(milkdownClient, /from\s+'@milkdown\/crepe\/feature\/code-mirror'/);
  assert.match(codeFeature, /from\s+'@milkdown\/crepe\/feature\/code-mirror'/);
  assert.match(tableFeature, /from\s+'@milkdown\/crepe\/feature\/table'/);
  assert.match(latexFeature, /from\s+'@milkdown\/crepe\/feature\/latex'/);
  assert.match(milkdownClient, /new CrepeBuilder/);
  assert.match(milkdownClient, /\.addFeature\(imageBlock/);
  assert.match(codeFeature, /\.addFeature\(codeMirror/);
  assert.match(milkdownClient, /defaultValue:\s*input\.value/);
  assert.match(milkdownClient, /markdownUpdated/);
  assert.match(milkdownClient, /input\.dispatchEvent\(new Event\('input'/);
  assert.match(milkdownClient, /import\s+\{[^}]*\binsert\b[^}]*\}\s+from\s+'@milkdown\/utils'/);
  assert.match(milkdownClient, /clipboardData\?\.files/);
  assert.match(milkdownClient, /addEventListener\('paste'/);
  assert.match(milkdownClient, /event\.preventDefault\(\)/);
  assert.match(milkdownClient, /crepe\.editor\.action\(insert\(/);
  assert.match(milkdownClient, /'X-Image-Name':\s*encodeURIComponent/);
  assert.match(milkdownClient, /'X-Post-ID':\s*String\(editorPostId\)/);
  assert.match(milkdownClient, /body:\s*file/);
  assert.match(page, /data-editor-fallback/);
  assert.doesNotMatch(page, /data-markdown-input[^>]*\shidden/);
  assert.match(milkdownLoader, /let editorModulePromise = null/);
  assert.match(milkdownLoader, /editorModulePromise \?\?= import\('\.\/admin-post-milkdown\.js'\)/);
  assert.doesNotMatch(milkdownLoader, /requestIdleCallback|setTimeout\(loadFromInteraction/);
  assert.doesNotMatch(milkdownLoader, /requestAnimationFrame\(loadFromInteraction\)/);
  assert.match(milkdownLoader, /addEventListener\('pointerdown'/);
  assert.match(milkdownLoader, /fallback\?\.addEventListener\('focusin'/);
  assert.match(milkdownLoader, /data-editor-retry/);
  assert.match(milkdownClient, /document\.activeElement === fallback/);
  assert.match(milkdownClient, /ctx\.get\(editorViewCtx\)\.focus\(\)/);
  assert.match(page, /class="post-editor-modebar" role="group"/);
  assert.match(page, /data-editor-mode="edit" aria-pressed="true"/);
  assert.match(client, /setAttribute\('aria-pressed'/);
  assert.match(client, /data-preview-retry/);
  assert.match(client, /正在生成预览/);
  assert.match(page, /data-markdown-preview[^>]*aria-live="polite"/);
  assert.match(milkdownClient, /replaceAll\(input\.value\)/);
  assert.match(milkdownClient, /fallback\.hidden = true/);
  assert.match(client, /'X-Image-Name':\s*encodeURIComponent/);
  assert.match(client, /'X-Post-ID':\s*String\(post\.id \|\| 0\)/);
  assert.match(client, /body:\s*file/);
  assert.match(imageApi, /saveImageVariants/);
  assert.match(imageApi, /context\.request\.arrayBuffer\(\)/);
  assert.match(imageApi, /x-image-name/);
  assert.match(imageApi, /x-post-id/);
  assert.match(imageApi, /registerImageAsset/);
  assert.match(styles, /\.article-prose\s+ul\s*\{[^}]*list-style:\s*disc/s);
  assert.match(styles, /\.article-prose\s+ol\s*\{[^}]*list-style:\s*decimal/s);
  assert.match(styles, /\.article-prose\s+table\s*\{[^}]*border:\s*1px solid var\(--line\)/s);
  assert.match(styles, /\.article-prose\s+\.contains-task-list\s*\{[^}]*list-style:\s*none/s);
  assert.match(styles, /@import "katex\/dist\/katex\.min\.css"/);
  assert.match(styles, /\.article-prose\s+\.article-red/);
  assert.match(styles, /\.article-prose pre\s*\{[^}]*background:\s*#f4f7fa\s*!important/s);
  assert.match(styles, /\.article-prose pre\s*\{[^}]*color:\s*#263548/s);
  assert.doesNotMatch(styles, /\.article-prose pre\s*\{[^}]*background:\s*#151515/s);
  assert.match(styles, /\.post-preview-editable-table/);
  assert.match(styles, /\.post-table-editor/);
  assert.match(styles, /\.post-table-editor\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(styles, /\.post-table-editor-panel\s*\{[^}]*pointer-events:\s*auto/s);
  assert.match(styles, /\.post-table-editor-top\s*\{[^}]*cursor:\s*move/s);
  assert.match(styles, /\.post-table-editor-top\s+button\s*\{[^}]*cursor:\s*pointer/s);
  assert.match(styles, /\.post-table-editor-grid/);
  assert.match(styles, /\.post-table-editor-grid\s+table\s*\{[^}]*display:\s*table/s);
  assert.match(styles, /\.post-editor-wysiwyg/);
  assert.match(styles, /\.post-editor-milkdown/);
  assert.match(styles, /\.post-editor-meta-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+360px/s);
  assert.match(styles, /\.post-editor-properties/);
  assert.match(styles, /\.post-meta-property-list/);
  assert.match(styles, /\.post-description-field/);
  assert.match(styles, /\.post-description-field:focus-within/);
});
