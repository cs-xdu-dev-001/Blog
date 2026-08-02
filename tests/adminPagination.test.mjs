import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeAdminPagination,
  paginateAdminItems,
} from '../src/lib/server/adminPagination.mjs';

test('admin pagination accepts only the supported page sizes and clamps page numbers', () => {
  assert.deepEqual(normalizeAdminPagination({ page: '3', pageSize: '50', total: 126 }), {
    page: 3,
    pageSize: 50,
    total: 126,
    totalPages: 3,
    offset: 100,
  });
  assert.deepEqual(normalizeAdminPagination({ page: '99', pageSize: '20', total: 12 }), {
    page: 1,
    pageSize: 30,
    total: 12,
    totalPages: 1,
    offset: 0,
  });
});

test('admin pagination slices server-owned arrays without leaking the full collection', () => {
  const result = paginateAdminItems(
    Array.from({ length: 35 }, (_, index) => index + 1),
    { page: 2, pageSize: 10 },
  );

  assert.deepEqual(result.items, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.deepEqual(result.pagination, {
    page: 2,
    pageSize: 10,
    total: 35,
    totalPages: 4,
  });
});
