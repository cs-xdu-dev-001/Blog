import { createReadingRepository } from '../../src/lib/server/readingRepository.mjs';
import { serveUploadedImage } from '../../src/lib/server/postImageResponse.mjs';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const [mode, dbPath, uploadsRoot, value] = process.argv.slice(2);

if (mode === 'create') {
  const repository = createReadingRepository({
    dbPath,
    uploadDir: `${uploadsRoot}/reading`,
  });
  const item = repository.create({ title: '跨进程图片测试', published: false });
  const updated = await repository.saveImage(item.id, {
    originalName: 'cover.png',
    buffer: tinyPng,
  });
  process.stdout.write(JSON.stringify({ id: item.id, imagePath: updated.image_path }));
} else if (mode === 'read') {
  const relativePath = String(value || '').replace('/uploads/reading/', '');
  const response = await serveUploadedImage('reading', relativePath, { root: uploadsRoot });
  process.stdout.write(JSON.stringify({ status: response.status }));
} else if (mode === 'delete') {
  const repository = createReadingRepository({
    dbPath,
    uploadDir: `${uploadsRoot}/reading`,
  });
  process.stdout.write(JSON.stringify({ removed: repository.remove(Number(value)) }));
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
