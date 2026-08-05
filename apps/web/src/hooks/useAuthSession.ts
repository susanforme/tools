import { api } from '@/lib/api';
import type { AuthUser } from '@tools/api/client';
import { atom, getDefaultStore, useAtomValue } from 'jotai';
import { useEffect } from 'react';

export type AuthSession =
  | { status: 'loading'; user: null }
  | { status: 'guest'; user: null }
  | { status: 'authenticated'; user: AuthUser };

const authSessionAtom = atom<AuthSession>({ status: 'loading', user: null });
const authStore = getDefaultStore();
let pendingRequest: Promise<AuthSession> | null = null;

export function getAuthSession(): AuthSession {
  return authStore.get(authSessionAtom);
}

export function setAuthGuest(): void {
  pendingRequest = null;
  authStore.set(authSessionAtom, { status: 'guest', user: null });
}

export function setAuthAuthenticated(user: AuthUser): void {
  pendingRequest = null;
  authStore.set(authSessionAtom, { status: 'authenticated', user });
}

export async function loadAuthSession(): Promise<AuthSession> {
  const current = getAuthSession();
  if (current.status !== 'loading') return current;
  if (pendingRequest) return pendingRequest;

  const request = api.auth.me
    .$get()
    .then(async (response): Promise<AuthSession> => {
      if (response.status !== 200) return { status: 'guest', user: null };
      const body = await response.json();
      return { status: 'authenticated', user: body.user };
    })
    .catch((): AuthSession => ({ status: 'guest', user: null }));

  pendingRequest = request;
  const session = await request;
  if (pendingRequest !== request) return getAuthSession();

  pendingRequest = null;
  authStore.set(authSessionAtom, session);
  return session;
}

export function useAuthSession(): AuthSession {
  const session = useAtomValue(authSessionAtom);

  useEffect(() => {
    if (session.status === 'loading') void loadAuthSession();
  }, [session.status]);

  return session;
}
