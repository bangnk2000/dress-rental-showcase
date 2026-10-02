'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { styleFilterKeys, type StyleFilter } from '../lib/filters';

const DEBOUNCE_MS = 300;
type SearchState = { draftQuery: string; query: string; style: StyleFilter };

/** Client URL state keeps the collection's server render independent of searchParams. */
export function useCatalogSearch() {
  const [state, setState] = useState<SearchState>({ draftQuery: '', query: '', style: 'all' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    const restore = () => {
      cancel();
      const params = new URLSearchParams(window.location.search);
      const query = params.get('q') ?? '';
      const style = styleFilterKeys.find((key) => key === params.get('style')) ?? 'all';
      setState({ draftQuery: query, query, style });
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => {
      cancel();
      window.removeEventListener('popstate', restore);
    };
  }, [cancel]);

  const apply = useCallback((query: string, style: StyleFilter, push = false) => {
    cancel();
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    if (style === 'all') url.searchParams.delete('style');
    else url.searchParams.set('style', style);
    const href = `${url.pathname}${url.search}${url.hash}`;
    if (href !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      // Preserve Next's history state; native history updates do not request a new RSC tree.
      if (push) window.history.pushState(window.history.state, '', href);
      else window.history.replaceState(window.history.state, '', href);
    }
    setState({ draftQuery: query, query, style });
  }, [cancel]);

  const changeQuery = (draftQuery: string) => {
    cancel();
    setState((current) => ({ ...current, draftQuery }));
    timer.current = setTimeout(() => apply(draftQuery, state.style), DEBOUNCE_MS);
  };

  return {
    ...state,
    changeQuery,
    submit: () => apply(state.draftQuery, state.style),
    changeStyle: (style: StyleFilter) => apply(state.draftQuery, style, true),
    clear: () => apply('', state.style),
    reset: () => apply('', 'all', true),
  };
}
