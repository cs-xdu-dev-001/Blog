import { codeMirror } from '@milkdown/crepe/feature/code-mirror';
import { languages } from './codemirror-language-data.js';
import '@milkdown/crepe/theme/common/code-mirror.css';

export function addCodeMirrorFeature(crepe) {
  crepe.addFeature(codeMirror, {
    languages,
    copyText: '复制',
    searchPlaceholder: '搜索语言',
    noResultText: '无结果',
    previewToggleText: (previewOnlyMode) => (previewOnlyMode ? '编辑' : '隐藏'),
  });
}

