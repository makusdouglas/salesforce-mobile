import { useEffect, useState } from 'react';
import { of, type Subscription } from 'rxjs';

import type Client from '@/data/models/Client';
import { clientsRepository } from '@/data/repositories/clientsRepository';

import type { ClientListItemDTO } from '../types';

const ADDRESS_SNIPPET_LIMIT = 40;
const CONTACT_SNIPPET_LIMIT = 40;

function truncate(value: string | null, limit: number): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, Math.max(0, limit - 1))}…`;
}

function contactSnippet(phone: string | null, email: string | null): string | null {
  const raw = phone ?? email;
  return truncate(raw, CONTACT_SNIPPET_LIMIT);
}

type RawStatus = 'created' | 'updated' | 'synced' | 'deleted';

function readRawStatus(model: Client): RawStatus | null {
  const raw = (model as unknown as { _raw?: { _status?: string } })._raw;
  const status = raw?._status;
  if (
    status === 'created' ||
    status === 'updated' ||
    status === 'synced' ||
    status === 'deleted'
  ) {
    return status;
  }
  return null;
}

export function toClientListItemDTO(model: Client): ClientListItemDTO {
  const rawStatus = readRawStatus(model);
  const isPendingSync = rawStatus !== null && rawStatus !== 'synced';
  return {
    id: model.id,
    name: model.name,
    taxId: model.taxId,
    addressSnippet: truncate(model.addressLine, ADDRESS_SNIPPET_LIMIT),
    contactSnippet: contactSnippet(model.phone, model.email),
    updatedAt: model.updatedAt,
    isPendingSync,
  };
}

type UseClientsResult = {
  readonly clients: readonly ClientListItemDTO[];
  readonly hasAny: boolean;
};

/**
 * Observes the salesperson's clients. When `salespersonId` is null (bootstrap
 * gap), returns an empty list without blocking.
 *
 * Default order is `updatedAt` descending so newly-created offline rows appear
 * at the top of the list immediately (spec US1 independent test).
 */
export function useClients(salespersonId: string | null): UseClientsResult {
  const [clients, setClients] = useState<readonly ClientListItemDTO[]>([]);

  useEffect(() => {
    if (salespersonId === null) {
      setClients([]);
      return;
    }

    let sub: Subscription | undefined;
    sub = (salespersonId
      ? clientsRepository.observeByOwner(salespersonId)
      : of<Client[]>([])
    ).subscribe({
      next: (rows: readonly Client[]) => {
        const dtos = rows.map(toClientListItemDTO);
        const sorted = [...dtos].sort((a, b) => b.updatedAt - a.updatedAt);
        setClients(sorted);
      },
      error: () => setClients([]),
    });

    return () => sub?.unsubscribe();
  }, [salespersonId]);

  return { clients, hasAny: clients.length > 0 };
}
