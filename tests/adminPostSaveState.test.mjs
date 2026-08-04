import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { adminStyles as styles } from './helpers/styleSources.mjs';

const source = fs.readFileSync(new URL('../public/admin-post-editor.js', import.meta.url), 'utf8');
const milkdownSource = fs.readFileSync(new URL('../src/scripts/admin-post-milkdown.js', import.meta.url), 'utf8');

test('post editor exposes reliable save states and never leaves a failed request locked', () => {
  assert.match(source, /AUTO_SAVE_DELAY_MS\s*=\s*2500/);
  assert.match(source, /setSaveState\('saving'/);
  assert.match(source, /setSaveState\(isDirty \? 'dirty' : 'saved'\)/);
  assert.match(source, /catch \(error\)[\s\S]*setSaveState\('error'/);
  assert.match(source, /finally[\s\S]*isSaving = false[\s\S]*saveButton\.disabled = false/);
  assert.match(source, /savingSignature/);
  assert.match(source, /lastSavedSignature = payloadSignature\(\{ \.\.\.payload, slug: data\.item\.slug \}\)/);
  assert.match(source, /slugChangedDuringSave/);
  assert.match(source, /slugInput && !slugChangedDuringSave/);
  assert.match(source, /payloadSignature\(\) !== lastSavedSignature/);
  assert.match(styles, /data-state="dirty"/);
  assert.match(styles, /data-state="error"/);
  assert.match(styles, /\.post-editor-page\s*\{[\s\S]*--cms-warning:/);
});

test('post editor autosaves real fields, supports Ctrl+S, and warns before leaving dirty content', () => {
  assert.match(source, /if \(!target\?\.name\) return/);
  assert.match(source, /savePost\(\{ automatic: true \}\)/);
  assert.match(source, /const key = event\.key\.toLowerCase\(\)/);
  assert.match(source, /key === 's'/);
  assert.match(source, /key === 'p'/);
  assert.match(source, /event\.shiftKey && key === 'p'/);
  assert.match(source, /event\.key === '\\\\'/);
  assert.match(source, /beforeunload/);
  assert.match(source, /event\.returnValue = ''/);
  assert.match(source, /agentEditorLocked === 'true'/);
  assert.match(source, /autoSavePaused = true/);
  assert.match(source, /isDirty && !autoSavePaused/);
});

test('post editor keeps a short-lived local recovery draft without persisting locked note content', () => {
  assert.match(source, /LOCAL_DRAFT_STORAGE_PREFIX\s*=\s*'dev-notes-post-draft-v1'/);
  assert.match(source, /LOCAL_DRAFT_TTL_MS\s*=\s*7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(source, /payload\.visibility === 'locked'\) return null/);
  assert.match(source, /lockedNoteKey: _lockedNoteKey/);
  assert.match(source, /function offerLocalDraftRecovery\(\)/);
  assert.match(source, /function applyLocalDraft\(draft\)/);
  assert.match(source, /window\.addEventListener\('pagehide'/);
  assert.match(source, /clearLocalDraft\(\)/);
});

test('version history shows metadata changes and collapses unchanged body blocks', () => {
  assert.match(source, /post-history-metadata/);
  assert.match(source, /\['标题', 'title'\]/);
  assert.match(source, /\['标签', 'tags'\]/);
  assert.match(source, /未修改 \$\{Number\(change\.count \|\| 0\)\} 行/);
  assert.match(styles, /\.post-history-metadata/);
  assert.match(styles, /\.post-history-change\.is-omitted/);
});

test('Milkdown and the fallback editor share the same Chinese save state vocabulary', () => {
  const milkdown = fs.readFileSync(new URL('../src/scripts/admin-post-milkdown.js', import.meta.url), 'utf8');
  assert.match(milkdown, /UNSAVED:\s*\['有未保存修改', 'dirty'\]/);
  assert.match(milkdown, /READY:\s*\['已保存', 'saved'\]/);
  assert.doesNotMatch(source, /setStatus\('UNSAVED'\)/);
});

test('save and delete requests are mutually exclusive and recover after network failures', () => {
  assert.match(source, /if \(isSaving \|\| isDeleting \|\| Number\(window\.__postImageUploads/);
  assert.match(source, /window\.clearTimeout\(autoSaveTimer\)[\s\S]*autoSavePaused = true[\s\S]*isDeleting = true/);
  assert.match(source, /method: 'DELETE'[\s\S]*credentials: 'same-origin'/);
  assert.match(source, /catch \(error\)[\s\S]*删除失败[\s\S]*scheduleAutoSave\(\)/);
  assert.match(source, /finally[\s\S]*isDeleting = false/);
});

test('frontend preview saves dirty content before opening its public URL', () => {
  assert.match(source, /async function openFrontendPreview\(\)/);
  assert.match(source, /window\.open\('about:blank', '_blank'\)/);
  assert.match(source, /isDirty && !await savePost\(\)/);
  assert.match(source, /previewWindow\.close\(\)/);
  assert.match(source, /previewWindow\.location\.replace\(`\/posts\/\$\{slug\}`\)/);
  assert.match(source, /previewButton\?\.addEventListener\('click', \(\) => void openFrontendPreview\(\)\)/);
});

test('post image uploads block destructive navigation and expose useful validation errors', () => {
  for (const client of [source, milkdownSource]) {
    assert.match(client, /window\.__postImageUploads/);
    assert.match(client, /图片不能超过8MB/);
    assert.match(client, /仅支持JPG、PNG、WebP和AVIF/);
  }
  assert.match(source, /deletePost[\s\S]*__postImageUploads/);
  assert.match(source, /图片仍在上传，请稍候/);
  assert.match(source, /beforeunload[\s\S]*__postImageUploads/);
});
