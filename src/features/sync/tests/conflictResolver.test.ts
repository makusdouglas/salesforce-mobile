import { conflictResolver } from '../protocol/conflictResolver';

describe('conflictResolver (LWW by updated_at, tiebreaker by server_id)', () => {
  test('remote.updated_at > local.updated_at → returns remote verbatim', () => {
    const local = { updated_at: 100, server_id: 'xxx', name: 'old' };
    const remote = { updated_at: 200, server_id: 'xxx', name: 'new' };
    const resolved = { ...local, name: 'merged' };
    expect(conflictResolver('clients', local, remote, resolved)).toBe(remote);
  });

  test('remote.updated_at < local.updated_at → returns resolved (local wins)', () => {
    const local = { updated_at: 200, server_id: 'xxx', name: 'new-local' };
    const remote = { updated_at: 100, server_id: 'xxx', name: 'old-remote' };
    const resolved = { ...remote, name: local.name };
    expect(conflictResolver('clients', local, remote, resolved)).toBe(resolved);
  });

  test('tie + remote.server_id < local.server_id → returns remote', () => {
    const local = { updated_at: 100, server_id: 'bbb' };
    const remote = { updated_at: 100, server_id: 'aaa' };
    const resolved = { ...remote };
    expect(conflictResolver('orders', local, remote, resolved)).toBe(remote);
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

  test('missing updated_at treated as 0 (defensive)', () => {
    const local = {} as Record<string, unknown>;
    const remote = { updated_at: 1 };
    const resolved = { ...remote };
    expect(conflictResolver('clients', local, remote, resolved)).toBe(remote);
  });
});
