import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Standard reusable hook for Anti-Lag Pagination
 * - Initial view limit: 20 items
 * - Load More step: 20 items per click
 * - Auto-resets to initial limit when any filter, tab, or search dependencies change
 */
export function usePagination(items = [], options = {}) {
  const { initialLimit = 20, step = 20, resetDependencies = [] } = options;
  const [limit, setLimit] = useState(initialLimit);

  // Auto-reset back to initial limit whenever filter or search query changes
  useEffect(() => {
    setLimit(initialLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLimit, ...resetDependencies]);

  const loadMore = useCallback(() => {
    setLimit((prev) => prev + step);
  }, [step]);

  const reset = useCallback(() => {
    setLimit(initialLimit);
  }, [initialLimit]);

  const totalCount = items?.length || 0;

  const displayedItems = useMemo(() => {
    if (!items || !items.length) return [];
    return items.slice(0, limit);
  }, [items, limit]);

  const hasMore = totalCount > limit;
  const remainingCount = Math.max(0, totalCount - limit);

  return {
    limit,
    setLimit,
    displayedItems,
    hasMore,
    remainingCount,
    totalCount,
    loadMore,
    reset,
  };
}

export default usePagination;
