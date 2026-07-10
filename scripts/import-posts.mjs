import { postRepository } from '../src/lib/server/postRepository.mjs';

const result = postRepository.importFromDirectory();
const stats = postRepository.stats();

console.log(`Imported or updated ${result.imported} markdown posts.`);
console.log(`Posts in database: ${stats.total} total, ${stats.published} published, ${stats.draft} drafts.`);
