import { syncService } from '../service/syncService';

/**
 * Home-screen pull-to-refresh gesture wrapper.
 *
 * Awaits the in-flight pass (if any) so the host's <RefreshControl> can
 * stop spinning precisely when the pass settles. Never rejects — syncService
 * handles offline skipping and error cases internally.
 */
export async function onPullToRefresh(): Promise<void> {
  await syncService.runSync({ trigger: 'pull-to-refresh' });
}
