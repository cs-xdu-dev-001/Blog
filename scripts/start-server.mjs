import { prepareRuntime } from '../src/lib/server/runtimeStartup.mjs';

const result = await prepareRuntime();
console.log(`[startup] database schema v${result.schemaVersion}; removed ${result.removedStagingEntries} stale upload staging entries`);
await import('../dist/server/entry.mjs');
