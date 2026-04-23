import { conflictResolver } from '../protocol/conflictResolver';

describe('conflictResolver (LWW by updated_at, tiebreaker by server_id)', () => {
  test('remote.updated_at > local.updated_at → merges remote over resolved and forces synced', () => {
    const local = {
      updated_at: 100,
      server_id: 'xxx',
      name: 'old',
      _status: 'created',
      _changed: 'name',
    };
    const remote = { updated_at: 200, server_id: 'xxx', name: 'new' };
    const resolved = { ...local, name: 'merged' };
    const out = conflictResolver('clients', local, remote, resolved);
    // Remote fields applied on top of resolved.
    expect(out).toMatchObject({ name: 'new', updated_at: 200, server_id: 'xxx' });
    // Sync metadata is FORCED to synced — remote is the source of truth now.
    expect(out).toMatchObject({ _status: 'synced', _changed: '' });
  });

  test('remote.updated_at < local.updated_at → returns resolved (local wins)', () => {
    const local = { updated_at: 200, server_id: 'xxx', name: 'new-local' };
    const remote = { updated_at: 100, server_id: 'xxx', name: 'old-remote' };
    const resolved = { ...remote, name: local.name };
    expect(conflictResolver('clients', local, remote, resolved)).toBe(resolved);
  });

  test('tie + remote.server_id < local.server_id → merges remote over resolved and forces synced', () => {
    const local = { updated_at: 100, server_id: 'bbb', _status: 'updated', _changed: 'x' };
    const remote = { updated_at: 100, server_id: 'aaa' };
    const resolved = { ...local, ...remote };
    const out = conflictResolver('orders', local, remote, resolved);
    expect(out).toMatchObject({ server_id: 'aaa', _status: 'synced', _changed: '' });
  });

  test('tie + remote.server_id >= local.server_id → returns resolved', () => {
    const local = { updated_at: 100, server_id: 'aaa' };
    const remote = { updated_at: 100, server_id: 'bbb' };
    const resolved = { ...remote };
    expect(conflictResolver('orders', local, remote, resolved)).toBe(resolved);
  });

  test('tie + both server_ids null → returns resolved (null-safety branch)', () => {
    const local = { updated_at: 100, server_id: null };
    const remote = { updated_at: 100, server_id: null };
    const resolved = { ...remote };
    expect(conflictResolver('orders', local, remote, resolved)).toBe(resolved);
  });

  test('missing updated_at treated as 0 (defensive) → merges remote over resolved and forces synced', () => {
    const local = { _status: 'created' } as Record<string, unknown>;
    const remote = { updated_at: 1 };
    const resolved = { ...local, ...remote };
    const out = conflictResolver('clients', local, remote, resolved);
    expect(out).toMatchObject({ updated_at: 1, _status: 'synced', _changed: '' });
  });
});
