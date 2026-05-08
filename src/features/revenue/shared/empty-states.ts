// 017-revenue-dashboard — Portuguese, salesperson-language empty-state
// copy. UX3 mandates we never render a broken chart or "undefined".
// Strings live here so the design pass and code stay in sync.

export const emptyStates = {
  trendNoData: 'Ainda não há dados suficientes para exibir.',
  trendComparisonUnavailable: 'Sem dados do ano anterior para comparar.',
  topClientsNoData: 'Nenhum cliente com pagamentos no período.',
  topProductsNoData: 'Nenhum produto vendido no período.',
  agingNoPending: 'Sem pendências em aberto.',
  rankingNoData: 'Nenhum vendedor com receita neste mês.',
  /** Shown in admin scope when network call fails with no cached snapshot. */
  errorNoConnection: 'Sem conexão. Tente novamente.',
  errorRetryCta: 'Tentar novamente',
  /** Shown in admin scope above the cached snapshot during a stale-fallback render. */
  staleSnapshotPrefix: 'Atualizado em',
} as const;
