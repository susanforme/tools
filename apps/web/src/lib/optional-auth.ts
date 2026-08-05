import { loadAuthSession, setAuthGuest } from '@/hooks/useAuthSession';

export type OptionalAuthResult<T> =
  | { ok: true; source: 'local' | 'remote'; value: T }
  | { ok: false; report: boolean };

export type OptionalAuthOperation<T> = {
  local: () => Promise<T>;
  remote: () => Promise<T>;
};

class SessionExpiredError extends Error {}

export function assertSessionActive(response: { status: number }): void {
  if (response.status === 401) throw new SessionExpiredError();
}

async function runLocal<T>(
  operation: () => Promise<T>,
): Promise<OptionalAuthResult<T>> {
  try {
    return { ok: true, source: 'local', value: await operation() };
  } catch {
    return { ok: false, report: false };
  }
}

export async function runOptionalAuth<T>({
  local,
  remote,
}: OptionalAuthOperation<T>): Promise<OptionalAuthResult<T>> {
  const session = await loadAuthSession();
  if (session.status !== 'authenticated') return runLocal(local);

  try {
    return { ok: true, source: 'remote', value: await remote() };
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      setAuthGuest();
      return runLocal(local);
    }
    return { ok: false, report: true };
  }
}
