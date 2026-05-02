export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const normalizePagination = (
  options?: PaginationOptions,
  defaults: { defaultLimit?: number; maxLimit?: number } = {},
): NormalizedPagination => {
  const defaultLimit = defaults.defaultLimit || DEFAULT_LIMIT;
  const maxLimit = defaults.maxLimit || MAX_LIMIT;
  const rawPage = Number(options?.page);
  const rawLimit = Number(options?.limit);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, maxLimit)
      : defaultLimit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};
