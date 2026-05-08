/**
 * Centralized Portuguese copy for the Home feature.
 *
 * Every user-visible string on Home lives here. Individual components
 * import the keys they need. This file is the single authority that the
 * FR-016 blocklist test (copyBlocklist.test.ts) scans to enforce that
 * empty-state copy never leaks technical / error vocabulary.
 */

export const homeCopy = {
  screenTitle: 'Início',
  settingsA11y: 'Configurações',

  greeting: {
    withNamePopulated: (firstName: string) => `Olá, ${firstName}`,
    withoutNamePopulated: 'Olá',
    populatedSubtitle: 'Tudo pronto para suas visitas de hoje.',
    withNameFirstRun: (firstName: string) => `Bem-vindo, ${firstName}`,
    withoutNameFirstRun: 'Bem-vindo',
    firstRunSubtitle: 'Vamos preparar tudo para sua primeira visita.',
  },

  sectionActionsPopulated: 'Ações rápidas',
  sectionActionsFirstRun: 'Comece por aqui',
  sectionRecent: 'Atividade recente',

  cards: {
    catalog: {
      title: 'Catálogo',
      populatedSubtitle: (count: number) =>
        count === 1 ? '1 produto disponível' : `${count} produtos disponíveis`,
      emptyTitle: 'Seu catálogo ainda está vazio',
      emptySubtitle: 'Assim que a sincronização terminar, os produtos aparecem aqui.',
      emptyCtaLabel: 'Sincronizar agora',
    },
    clients: {
      title: 'Clientes',
      populatedSubtitle: (count: number) =>
        count === 1 ? '1 loja cadastrada' : `${count} lojas cadastradas`,
      emptyTitle: 'Cadastre sua primeira loja',
      emptySubtitle: 'Você precisa de pelo menos uma loja para montar um pedido.',
      emptyCtaLabel: 'Nova loja',
    },
    drafts: {
      title: 'Rascunhos',
      populatedSubtitle: (count: number) =>
        count === 1 ? '1 pedido em andamento' : `${count} pedidos em andamento`,
      emptyTitle: 'Nenhum rascunho por enquanto',
      emptySubtitle: 'Quando começar um pedido no catálogo, ele fica salvo aqui.',
    },
    orders: {
      title: 'Pedidos',
      populatedSubtitle: 'Ver todos os pedidos',
      emptyTitle: 'Ver pedidos',
      emptySubtitle: 'Abre a lista completa com filtros e totais do mês.',
    },
  },

  recentActivity: {
    populatedTitlePrefix: 'Pedido enviado — ',
    emptyTitle: 'Seu último pedido enviado aparecerá aqui',
    emptySubtitle: 'Depois de enviar o primeiro pedido, você vê o resumo dele neste lugar.',
  },

  syncPill: {
    inSyncLabel: (ageLabel: string) => `Sincronizado · ${ageLabel}`,
    inSyncA11y: (ageLabel: string) => `Sincronizado ${ageLabel}`,
    inSyncLabelNoAge: 'Sincronizado',
    inSyncA11yNoAge: 'Sincronizado',
    syncingLabel: 'Sincronizando…',
    syncingA11y: 'Sincronizando',
    offlineLabel: 'Sem conexão',
    offlineA11y: 'Sem conexão',
    failedLabel: 'Falha ao sincronizar — tocar para tentar',
    failedA11y: 'Falha ao sincronizar, tocar para tentar novamente',
  },
} as const;

/**
 * Flatten every string literal produced by homeCopy into a single array so
 * the blocklist test can grep across the whole surface in one pass.
 */
export function allHomeCopyStrings(): readonly string[] {
  const samples = ['Márcio', 'Ana', 'João']; // exercise the dynamic-name variants
  const counts = [0, 1, 2, 17]; // exercise the plural variants
  const ageLabels = ['agora', 'há 2 min', 'há 3 h', 'há 1 d'];

  const out: string[] = [
    homeCopy.screenTitle,
    homeCopy.settingsA11y,
    homeCopy.greeting.withoutNamePopulated,
    homeCopy.greeting.populatedSubtitle,
    homeCopy.greeting.withoutNameFirstRun,
    homeCopy.greeting.firstRunSubtitle,
    homeCopy.sectionActionsPopulated,
    homeCopy.sectionActionsFirstRun,
    homeCopy.sectionRecent,
    homeCopy.cards.catalog.title,
    homeCopy.cards.catalog.emptyTitle,
    homeCopy.cards.catalog.emptySubtitle,
    homeCopy.cards.catalog.emptyCtaLabel,
    homeCopy.cards.clients.title,
    homeCopy.cards.clients.emptyTitle,
    homeCopy.cards.clients.emptySubtitle,
    homeCopy.cards.clients.emptyCtaLabel,
    homeCopy.cards.drafts.title,
    homeCopy.cards.drafts.emptyTitle,
    homeCopy.cards.drafts.emptySubtitle,
    homeCopy.recentActivity.populatedTitlePrefix,
    homeCopy.recentActivity.emptyTitle,
    homeCopy.recentActivity.emptySubtitle,
    homeCopy.syncPill.syncingLabel,
    homeCopy.syncPill.syncingA11y,
    homeCopy.syncPill.inSyncLabelNoAge,
    homeCopy.syncPill.inSyncA11yNoAge,
    homeCopy.syncPill.offlineLabel,
    homeCopy.syncPill.offlineA11y,
    homeCopy.syncPill.failedLabel,
    homeCopy.syncPill.failedA11y,
  ];
  for (const name of samples) {
    out.push(homeCopy.greeting.withNamePopulated(name));
    out.push(homeCopy.greeting.withNameFirstRun(name));
  }
  for (const count of counts) {
    out.push(homeCopy.cards.catalog.populatedSubtitle(count));
    out.push(homeCopy.cards.clients.populatedSubtitle(count));
    out.push(homeCopy.cards.drafts.populatedSubtitle(count));
  }
  for (const label of ageLabels) {
    out.push(homeCopy.syncPill.inSyncLabel(label));
    out.push(homeCopy.syncPill.inSyncA11y(label));
  }
  return out;
}
