import { postRepository } from '../src/lib/server/postRepository.mjs';

const deleteFiles = process.argv.includes('--delete');
const graceArg = process.argv.find((arg) => arg.startsWith('--grace-days='));
const graceDays = Number(graceArg?.split('=', 2)[1] ?? 7);
if (!Number.isFinite(graceDays) || graceDays < 0) {
  throw new Error('--grace-days must be a non-negative number');
}

const before = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
const result = postRepository.cleanupUnreferencedImages({
  before,
  dryRun: !deleteFiles,
});

console.log(`${deleteFiles ? '清理' : '预览'}：发现${result.candidates.length}组未引用图片`);
result.candidates.forEach((asset) => console.log(`- 笔记${asset.post_id}: ${asset.image_path}`));
if (!deleteFiles) {
  console.log('未删除文件；确认后使用 npm run images:cleanup-posts -- --delete');
} else {
  console.log(`已删除${result.removedAssets}组记录、${result.removedFiles}个文件`);
}
