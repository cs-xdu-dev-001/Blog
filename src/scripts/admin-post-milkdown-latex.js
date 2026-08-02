import { latex } from '@milkdown/crepe/feature/latex';
import '@milkdown/crepe/theme/common/latex.css';

export function addLatexFeature(crepe) {
  crepe.addFeature(latex);
}

