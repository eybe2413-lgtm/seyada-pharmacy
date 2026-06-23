import { useState, useEffect, useCallback, useRef } from 'react';

// fetchPage(cursor) -> { items, lastDoc, hasMore }
export function usePaginatedCollection(fetchPage, deps = []) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    cursorRef.current = null;
    try {
      const res = await fetchPage(null);
      setItems(res.items);
      cursorRef.current = res.lastDoc;
      setHasMore(res.hasMore);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!hasMore || loadingMore || !cursorRef.current) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(cursorRef.current);
      setItems((prev) => [...prev, ...res.items]);
      cursorRef.current = res.lastDoc;
      setHasMore(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  return { items, loading, loadingMore, hasMore, refresh: load, loadMore };
}
