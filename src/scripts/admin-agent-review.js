export function reviewIsCurrent(review, {
  activeReviewId,
  currentDocument,
  documentSize,
}) {
  if (!review || activeReviewId !== review.id) return false;
  if (currentDocument !== review.sourceDocument) return false;
  if (!Number.isInteger(review.from) || !Number.isInteger(review.to)) return false;
  return review.from >= 0 && review.to >= review.from && review.to <= documentSize;
}
