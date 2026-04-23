import type { SyncStatusSnapshot } from '@/features/sync';

import { homeCopy } from '../copy/copy';
import { deriveGreetingName } from '../greeting/deriveGreetingName';
import { deriveSyncPillState, type SyncPillStateDTO } from '../sync/deriveSyncPillState';
import type { RecentActivityDTO } from '../types';

/**
 * Pure composition of the HomeSnapshotDTO from session + sync + local
 * counts + last-sent-order. Called once per render by HomeScreen; tests
 * target this function directly without rendering any React.
 *
 * Per plan.md Structure Decision point 5: this is the single source of
 * shape truth for Home. FR-018 (sync-state / empty-state independence) is
 * enforced here — a syncing snapshot with zero counts produces BOTH a
 * `sync: {kind: 'syncing'}` AND `populated: null` across every card.
 */

export type GreetingDTO = {
  readonly title: string;
  readonly subtitle: string;
};

export type QuickActionCardKind = 'catalog' | 'clients' | 'drafts';

export type QuickActionPopulated = {
  readonly subtitle: string;
  readonly badge?: number;
};

export type QuickActionEmpty = {
  readonly variant: 'solid' | 'dashed';
  readonly title: string;
  readonly subtitle: string;
  readonly cta?: {
    readonly kind: 'primary' | 'secondary';
    readonly label: string;
  };
};

export type QuickActionCardDTO = {
  readonly kind: QuickActionCardKind;
  readonly title: string;
  readonly populated: QuickActionPopulated | null;
  readonly empty: QuickActionEmpty;
};

export type RecentActivityEmptyDTO = {
  readonly title: string;
  readonly subtitle: string;
};

export type HomeSnapshotDTO = {
  readonly screenTitle: string;
  readonly greeting: GreetingDTO;
  readonly sectionActionsLabel: string;
  readonly sectionRecentLabel: string;
  readonly sync: SyncPillStateDTO;
  readonly catalog: QuickActionCardDTO;
  readonly clients: QuickActionCardDTO;
  readonly drafts: QuickActionCardDTO;
  readonly recentActivity: RecentActivityDTO | null;
  readonly recentActivityEmpty: RecentActivityEmptyDTO;
};

export type DeriveHomeSnapshotInput = {
  /** Salesperson's real name (from the salespeople table). Preferred over email. */
  readonly name: string | null;
  readonly email: string | null;
  readonly sync: SyncStatusSnapshot;
  readonly nowMs: number;
  readonly catalog: { readonly count: number };
  readonly clients: { readonly count: number };
  readonly drafts: { readonly count: number };
  readonly recentActivity: RecentActivityDTO | null;
};

function buildGreeting(firstName: string | null, isFirstRun: boolean): GreetingDTO {
  const g = homeCopy.greeting;
  if (isFirstRun) {
    return {
      title: firstName === null ? g.withoutNameFirstRun : g.withNameFirstRun(firstName),
      subtitle: g.firstRunSubtitle,
    };
  }
  return {
    title: firstName === null ? g.withoutNamePopulated : g.withNamePopulated(firstName),
    subtitle: g.populatedSubtitle,
  };
}

function buildCatalogCard(count: number): QuickActionCardDTO {
  const c = homeCopy.cards.catalog;
  return {
    kind: 'catalog',
    title: c.title,
    populated: count > 0 ? { subtitle: c.populatedSubtitle(count) } : null,
    empty: {
      variant: 'solid',
      title: c.emptyTitle,
      subtitle: c.emptySubtitle,
      cta: { kind: 'primary', label: c.emptyCtaLabel },
    },
  };
}

function buildClientsCard(count: number): QuickActionCardDTO {
  const c = homeCopy.cards.clients;
  return {
    kind: 'clients',
    title: c.title,
    populated: count > 0 ? { subtitle: c.populatedSubtitle(count) } : null,
    empty: {
      variant: 'solid',
      title: c.emptyTitle,
      subtitle: c.emptySubtitle,
      cta: { kind: 'secondary', label: c.emptyCtaLabel },
    },
  };
}

function buildDraftsCard(count: number): QuickActionCardDTO {
  const c = homeCopy.cards.drafts;
  return {
    kind: 'drafts',
    title: c.title,
    populated: count > 0 ? { subtitle: c.populatedSubtitle(count), badge: count } : null,
    empty: {
      variant: 'dashed',
      title: c.emptyTitle,
      subtitle: c.emptySubtitle,
    },
  };
}

export function deriveHomeSnapshot(input: DeriveHomeSnapshotInput): HomeSnapshotDTO {
  const { name, email, sync, nowMs, catalog, clients, drafts, recentActivity } = input;

  const firstName = deriveGreetingName({ name, email });
  const isFirstRun =
    catalog.count === 0 && clients.count === 0 && drafts.count === 0 && recentActivity === null;

  const syncPill = deriveSyncPillState({
    status: sync.status,
    lastOkAt: sync.lastOkAt,
    nowMs,
  });

  return {
    screenTitle: homeCopy.screenTitle,
    greeting: buildGreeting(firstName, isFirstRun),
    sectionActionsLabel: isFirstRun
      ? homeCopy.sectionActionsFirstRun
      : homeCopy.sectionActionsPopulated,
    sectionRecentLabel: homeCopy.sectionRecent,
    sync: syncPill,
    catalog: buildCatalogCard(catalog.count),
    clients: buildClientsCard(clients.count),
    drafts: buildDraftsCard(drafts.count),
    recentActivity,
    recentActivityEmpty: {
      title: homeCopy.recentActivity.emptyTitle,
      subtitle: homeCopy.recentActivity.emptySubtitle,
    },
  };
}
