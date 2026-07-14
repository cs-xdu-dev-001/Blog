import { backfillImageVariants } from '../src/lib/server/imageVariantBackfill.mjs';

const force = process.argv.includes('--force');
const result = await backfillImageVariants({ force });

console.log(JSON.stringify(result, null, 2));

if (result.totalFailed > 0) {
  process.exitCode = 1;
}
