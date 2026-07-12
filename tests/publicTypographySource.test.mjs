import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('public typography audit enforces a fifteen pixel floor without touching admin styles', () => {
  const auditUrl = new URL('../scripts/audit-public-font-sizes.mjs', import.meta.url);
  assert.equal(fs.existsSync(auditUrl), true);

  const audit = fs.readFileSync(auditUrl, 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const activityStart = styles.indexOf('.qzq-watch-activity {');
  const activityEnd = styles.indexOf('.qzq-watch-marquee {', activityStart);
  const activityStyles = styles.slice(activityStart, activityEnd);

  assert.match(audit, /const MIN_PUBLIC_FONT_SIZE = 15/);
  assert.match(audit, /const groupedViolations = new Map\(\)/);
  assert.match(audit, /count:\s*1/);
  assert.match(audit, /existing\.count \+= 1/);
  assert.match(audit, /element\.parentElement/);
  assert.match(audit, /parts\.join\(' > '\)/);
  assert.match(audit, /\.cms-page/);
  assert.match(audit, /\.dn-assistant/);
  assert.doesNotMatch(activityStyles, /font-size:\s*(?:[0-9](?:\.[0-9]+)?|1[0-4](?:\.[0-9]+)?)px/);
});
