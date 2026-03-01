import { useState, useEffect, useRef, useCallback } from 'react';

const PAGE_SIZE = 20;

/**
 * 인피니티 스크롤용 훅.
 * @param { (offset: number) => Promise<any[] | { items: any[], total: number }> } fetchPage - offset 기준 한 페이지 조회. 배열 또는 { items, total } 반환
 * @param { { pageSize?: number, deps?: any[] } } options - pageSize(기본 20), deps 값이 바뀌면 목록 초기화 후 재로드
 * @returns { { list: any[], total: number | null, loading: boolean, hasMore: boolean, sentinelRef: Ref, reset: () => void } }
 */
export function useInfiniteList(fetchPage, options = {}) {
  const { pageSize = PAGE_SIZE, deps = [] } = options;
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  const loadPage = useCallback(
    (atOffset, append = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      fetchPage(atOffset)
        .then((data) => {
          const next = Array.isArray(data) ? data : (data?.items ?? []);
          const totalFromApi = !Array.isArray(data) && data?.total != null ? Number(data.total) : null;
          setList((prev) => (append ? [...prev, ...next] : next));
          setOffset(atOffset + next.length);
          setHasMore(next.length >= pageSize);
          if (atOffset === 0 && totalFromApi != null) setTotal(totalFromApi);
        })
        .catch(() => {
          setHasMore(false);
        })
        .finally(() => {
          setLoading(false);
          loadingRef.current = false;
        });
    },
    [fetchPage, pageSize]
  );

  const reset = useCallback(() => {
    setList([]);
    setTotal(null);
    setOffset(0);
    setHasMore(true);
    loadingRef.current = false;
  }, []);

  // deps 값이 바뀔 때만 초기화 (배열 참조가 매 렌더 바뀌어도 값 비교)
  const depsKey = Array.isArray(deps) && deps.length > 0 ? JSON.stringify(deps) : '';
  useEffect(() => {
    reset();
  }, [depsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 목록이 비었고 hasMore이면 첫 페이지 로드 (초기 또는 reset 후)
  useEffect(() => {
    if (list.length === 0 && hasMore && !loadingRef.current) {
      loadPage(0, false);
    }
  }, [list.length, hasMore, loadPage]);

  // sentinel 교차 감지
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || loading || !hasMore || loadingRef.current) return;
        loadPage(offset, true);
      },
      { root: null, rootMargin: '100px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, hasMore, offset, loadPage]);

  return { list, total, loading, hasMore, sentinelRef, reset, loadPage };
}
