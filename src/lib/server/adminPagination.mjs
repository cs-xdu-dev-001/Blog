export const ADMIN_PAGE_SIZES = Object.freeze([10, 30, 50, 100]);
export const DEFAULT_ADMIN_PAGE_SIZE = 30;

function positiveInteger(value, fallback) {
  const number = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function normalizeAdminPagination({ page = 1, pageSize = DEFAULT_ADMIN_PAGE_SIZE, total = 0 } = {}) {
  const normalizedTotal = Math.max(0, Number.parseInt(String(total ?? 0), 10) || 0);
  const normalizedPageSize = ADMIN_PAGE_SIZES.includes(Number(pageSize))
    ? Number(pageSize)
    : DEFAULT_ADMIN_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(normalizedTotal / normalizedPageSize));
  const normalizedPage = Math.min(positiveInteger(page, 1), totalPages);

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    total: normalizedTotal,
    totalPages,
    offset: (normalizedPage - 1) * normalizedPageSize,
  };
}

export function publicPagination(pagination) {
  const { offset: _offset, ...result } = pagination;
  return result;
}

export function paginateAdminItems(items, options = {}) {
  const source = Array.isArray(items) ? items : [];
  const pagination = normalizeAdminPagination({ ...options, total: source.length });
  return {
    items: source.slice(pagination.offset, pagination.offset + pagination.pageSize),
    pagination: publicPagination(pagination),
  };
}
