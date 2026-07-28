import assert from 'node:assert/strict';
import test from 'node:test';

const reviewModuleUrl = new URL('../src/scripts/admin-agent-review.js', import.meta.url);

test('agent review only accepts the unchanged active snapshot', async () => {
  const { reviewIsCurrent } = await import(reviewModuleUrl);
  const review = {
    id: 'review-1',
    sourceDocument: 'original',
    from: 2,
    to: 8,
  };

  assert.equal(reviewIsCurrent(review, {
    activeReviewId: 'review-1',
    currentDocument: 'original',
    documentSize: 12,
  }), true);
  assert.equal(reviewIsCurrent(review, {
    activeReviewId: 'review-2',
    currentDocument: 'original',
    documentSize: 12,
  }), false);
  assert.equal(reviewIsCurrent(review, {
    activeReviewId: 'review-1',
    currentDocument: 'changed',
    documentSize: 12,
  }), false);
  assert.equal(reviewIsCurrent({ ...review, to: 13 }, {
    activeReviewId: 'review-1',
    currentDocument: 'original',
    documentSize: 12,
  }), false);
});
