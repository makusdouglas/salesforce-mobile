import type { SyncStatusSnapshot } from '@/features/sync';

import { deriveHomeSnapshot } from '../snapshot/deriveHomeSnapshot';
import type { RecentActivityDTO } from '../types';

const NOW = 1_700_000_000_000;

function sync(overrides: Partial<SyncStatusSnapshot> = {}): SyncStatusSnapshot {
  return { status: 'in-sync', lastOkAt: NOW - 2 * 60_000, ...overrides };
}

function baseInput(overrides: Partial<Parameters<typeof deriveHomeSnapshot>[0]> = {}) {
  return {
    email: 'markus@local.dev',
    sync: sync(),
    nowMs: NOW,
    catalog: { count: 324 },
    clients: { count: 48 },
    drafts: { count: 2 },
    recentActivity: null,
    ...overrides,
  } as Parameters<typeof deriveHomeSnapshot>[0];
}

const ORDER: RecentActivityDTO = {
  storeName: 'Mercado São João',
  totalCentsAmount: 128_450,
  sentAtMs: NOW - 38 * 60_000,
};

describe('deriveHomeSnapshot — populated world', () => {
  test('produces populated card DTOs with counts and drafts badge', () => {
    const snap = deriveHomeSnapshot(baseInput({ recentActivity: ORDER }));
    expect(snap.catalog.populated).toEqual({ subtitle: '324 produtos disponíveis' });
    expect(snap.clients.populated).toEqual({ subtitle: '48 lojas cadastradas' });
    expect(snap.drafts.populated).toEqual({
      subtitle: '2 pedidos em andamento',
      badge: 2,
    });
    expect(snap.recentActivity).toEqual(ORDER);
    expect(snap.sectionActionsLabel).toBe('Ações rápidas');
  });

  test('greeting uses populated variant with first name from email', () => {
    const snap = deriveHomeSnapshot(baseInput());
    expect(snap.greeting.title).toBe('Olá, markus');
    expect(snap.greeting.subtitle).toBe('Tudo pronto para suas visitas de hoje.');
  });

  test('sync pill kind is "in-sync" with formatted age label', () => {
    const snap = deriveHomeSnapshot(baseInput());
    expect(snap.sync).toEqual({ kind: 'in-sync', ageLabel: 'há 2 min' });
  });

  test('singular noun agreement: count 1 uses singular phrasing', () => {
    const snap = deriveHomeSnapshot(
      baseInput({ catalog: { count: 1 }, clients: { count: 1 }, drafts: { count: 1 } }),
    );
    expect(snap.catalog.populated?.subtitle).toBe('1 produto disponível');
    expect(snap.clients.populated?.subtitle).toBe('1 loja cadastrada');
    expect(snap.drafts.populated?.subtitle).toBe('1 pedido em andamento');
  });
});

describe('deriveHomeSnapshot — first-run empty world (FR-018)', () => {
  test('syncing + all zero counts + null recent activity → all populateds null AND pill syncing', () => {
    const snap = deriveHomeSnapshot(
      baseInput({
        sync: sync({ status: 'syncing', lastOkAt: null }),
        catalog: { count: 0 },
        clients: { count: 0 },
        drafts: { count: 0 },
        recentActivity: null,
      }),
    );
    expect(snap.sync).toEqual({ kind: 'syncing' });
    expect(snap.catalog.populated).toBeNull();
    expect(snap.clients.populated).toBeNull();
    expect(snap.drafts.populated).toBeNull();
    expect(snap.recentActivity).toBeNull();
  });

  test('first-run greeting uses "Bem-vindo" and first-run subtitle', () => {
    const snap = deriveHomeSnapshot(
      baseInput({
        catalog: { count: 0 },
        clients: { count: 0 },
        drafts: { count: 0 },
        recentActivity: null,
      }),
    );
    expect(snap.greeting.title).toBe('Bem-vindo, markus');
    expect(snap.greeting.subtitle).toBe('Vamos preparar tudo para sua primeira visita.');
    expect(snap.sectionActionsLabel).toBe('Comece por aqui');
  });

  test('catalog empty has primary CTA "Sincronizar agora"', () => {
    const snap = deriveHomeSnapshot(baseInput({ catalog: { count: 0 } }));
    expect(snap.catalog.empty).toEqual({
      variant: 'solid',
      title: 'Seu catálogo ainda está vazio',
      subtitle: 'Assim que a sincronização terminar, os produtos aparecem aqui.',
      cta: { kind: 'primary', label: 'Sincronizar agora' },
    });
  });

  test('clients empty has secondary CTA "Nova loja"', () => {
    const snap = deriveHomeSnapshot(baseInput({ clients: { count: 0 } }));
    expect(snap.clients.empty).toEqual({
      variant: 'solid',
      title: 'Cadastre sua primeira loja',
      subtitle: 'Você precisa de pelo menos uma loja para montar um pedido.',
      cta: { kind: 'secondary', label: 'Nova loja' },
    });
  });

  test('drafts empty has NO CTA and uses dashed variant (FR-014)', () => {
    const snap = deriveHomeSnapshot(baseInput({ drafts: { count: 0 } }));
    expect(snap.drafts.empty).toEqual({
      variant: 'dashed',
      title: 'Nenhum rascunho por enquanto',
      subtitle: 'Quando começar um pedido no catálogo, ele fica salvo aqui.',
    });
    expect(snap.drafts.empty.cta).toBeUndefined();
  });
});

describe('deriveHomeSnapshot — edge cases', () => {
  test('null email → greeting falls back to bare "Olá" (populated)', () => {
    const snap = deriveHomeSnapshot(baseInput({ email: null }));
    expect(snap.greeting.title).toBe('Olá');
  });

  test('null email + first-run → "Bem-vindo"', () => {
    const snap = deriveHomeSnapshot(
      baseInput({
        email: null,
        catalog: { count: 0 },
        clients: { count: 0 },
        drafts: { count: 0 },
        recentActivity: null,
      }),
    );
    expect(snap.greeting.title).toBe('Bem-vindo');
  });

  test('offline with pre-existing counts → pill offline, cards populated', () => {
    const snap = deriveHomeSnapshot(
      baseInput({ sync: sync({ status: 'offline', lastOkAt: NOW - 60_000 }) }),
    );
    expect(snap.sync).toEqual({ kind: 'offline' });
    expect(snap.catalog.populated).not.toBeNull();
  });

  test('failed with zero counts → pill failed AND all empty-state DTOs', () => {
    const snap = deriveHomeSnapshot(
      baseInput({
        sync: sync({ status: 'failed', lastOkAt: NOW - 60_000 }),
        catalog: { count: 0 },
        clients: { count: 0 },
        drafts: { count: 0 },
        recentActivity: null,
      }),
    );
    expect(snap.sync).toEqual({ kind: 'failed' });
    expect(snap.catalog.populated).toBeNull();
    expect(snap.clients.populated).toBeNull();
    expect(snap.drafts.populated).toBeNull();
  });

  test('drafts count 0 → badge absent from DTO entirely (spec FR-010)', () => {
    const snap = deriveHomeSnapshot(baseInput({ drafts: { count: 0 } }));
    expect(snap.drafts.populated).toBeNull();
  });

  test('having a recent activity with all other counts zero is NOT first-run', () => {
    const snap = deriveHomeSnapshot(
      baseInput({
        catalog: { count: 0 },
        clients: { count: 0 },
        drafts: { count: 0 },
        recentActivity: ORDER,
      }),
    );
    expect(snap.greeting.title).toBe('Olá, markus');
    expect(snap.sectionActionsLabel).toBe('Ações rápidas');
  });
});
