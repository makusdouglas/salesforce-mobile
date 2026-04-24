import { useCallback, useMemo, useReducer } from 'react';

import { currentMonthKey, shiftMonth } from '../selectors/monthRange';
import type {
  OrdersOverviewFilter,
  OrdersOverviewStatusFilter,
} from '../types';

type FilterAction =
  | { type: 'setMonth'; month: string }
  | { type: 'nextMonth' }
  | { type: 'prevMonth' }
  | { type: 'setStatus'; status: OrdersOverviewStatusFilter }
  | { type: 'setQuery'; query: string };

function reducer(
  state: OrdersOverviewFilter,
  action: FilterAction,
): OrdersOverviewFilter {
  switch (action.type) {
    case 'setMonth':
      return state.month === action.month ? state : { ...state, month: action.month };
    case 'nextMonth':
      return { ...state, month: shiftMonth(state.month, 1) };
    case 'prevMonth':
      return { ...state, month: shiftMonth(state.month, -1) };
    case 'setStatus':
      return state.status === action.status
        ? state
        : { ...state, status: action.status };
    case 'setQuery':
      return state.query === action.query ? state : { ...state, query: action.query };
  }
}

export type UseOrdersOverviewFiltersResult = {
  readonly filter: OrdersOverviewFilter;
  readonly setMonth: (month: string) => void;
  readonly nextMonth: () => void;
  readonly prevMonth: () => void;
  readonly setStatus: (status: OrdersOverviewStatusFilter) => void;
  readonly setQuery: (query: string) => void;
};

/**
 * 013-orders-overview: owns the in-screen filter state. Not persisted.
 * Default month is the current local month; default status is 'all';
 * default query is ''.
 */
export function useOrdersOverviewFilters(): UseOrdersOverviewFiltersResult {
  const [filter, dispatch] = useReducer(reducer, undefined as never, () => ({
    month: currentMonthKey(),
    status: 'all' as const,
    query: '',
  }));

  const setMonth = useCallback((month: string) => dispatch({ type: 'setMonth', month }), []);
  const nextMonth = useCallback(() => dispatch({ type: 'nextMonth' }), []);
  const prevMonth = useCallback(() => dispatch({ type: 'prevMonth' }), []);
  const setStatus = useCallback(
    (status: OrdersOverviewStatusFilter) => dispatch({ type: 'setStatus', status }),
    [],
  );
  const setQuery = useCallback((query: string) => dispatch({ type: 'setQuery', query }), []);

  return useMemo(
    () => ({ filter, setMonth, nextMonth, prevMonth, setStatus, setQuery }),
    [filter, setMonth, nextMonth, prevMonth, setStatus, setQuery],
  );
}
