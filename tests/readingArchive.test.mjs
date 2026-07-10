import assert from 'node:assert/strict';
import {
  getFeaturedReading,
  getReadingBySlug,
  getReadingGroups,
  readingArchive,
} from '../src/data/readingArchive.mjs';

const requiredStatuses = new Set(['reading', 'read', 'planned']);
const slugs = new Set();

assert.ok(readingArchive.length >= 6, 'reading archive should have enough books for a shelf');

for (const book of readingArchive) {
  assert.ok(book.slug, 'book slug is required');
  assert.ok(!slugs.has(book.slug), `duplicate slug: ${book.slug}`);
  slugs.add(book.slug);
  assert.ok(book.title, `title is required for ${book.slug}`);
  assert.ok(book.author, `author is required for ${book.slug}`);
  assert.ok(requiredStatuses.has(book.status), `invalid status for ${book.slug}`);
  assert.ok(book.spineColor, `spineColor is required for ${book.slug}`);
  assert.ok(book.accentColor, `accentColor is required for ${book.slug}`);
  assert.ok(book.summary.length >= 12, `summary is too short for ${book.slug}`);
  assert.ok(book.quote.length >= 8, `quote is too short for ${book.slug}`);
  assert.ok(book.review.length >= 30, `review is too short for ${book.slug}`);
}

const featured = getFeaturedReading();
assert.ok(featured.length >= 5, 'featured reading should fill the homepage shelf');
assert.equal(featured.length, readingArchive.length, 'homepage shelf should include every configured book by default');
assert.equal(featured[0].featured, true, 'featured books should be ordered first');

const groups = getReadingGroups();
assert.ok(groups.reading.length >= 1, 'reading group should not be empty');
assert.ok(groups.read.length >= 1, 'read group should not be empty');
assert.ok(groups.planned.length >= 1, 'planned group should not be empty');

assert.equal(getReadingBySlug(readingArchive[0].slug)?.title, readingArchive[0].title);
assert.equal(getReadingBySlug('missing-book'), undefined);
