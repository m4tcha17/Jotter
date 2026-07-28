import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';

const AUTH_STORAGE_KEY = 'jotter-auth';
const PENDING_REVOCATION_KEY = 'jotter-pending-revocation';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      storageKey: AUTH_STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

async function queuePendingRevocation(accessToken: string) {
  const raw = await AsyncStorage.getItem(PENDING_REVOCATION_KEY);
  const pending: string[] = raw ? JSON.parse(raw) : [];
  pending.push(accessToken);
  await AsyncStorage.setItem(PENDING_REVOCATION_KEY, JSON.stringify(pending));
}

// supabase-js's signOut() always POSTs /logout first and only clears the local
// session afterwards — even at scope: 'local', and even on failure it can skip the
// local clear entirely (see GoTrueClient's _signOut). That makes it a hard
// dependency on connectivity for a core, offline-first flow: field researchers are
// frequently offline, so waiting on (or being blocked by) that request means sign
// out can hang or silently never complete. Clear the local session ourselves,
// immediately and unconditionally, and let the real signOut() run best-effort in
// the background purely for server-side revocation. On failure it resolves with
// an error rather than throwing (network failures don't reject the promise), so
// we queue the token here for flushPendingRevocations() to retry once we're back
// online — otherwise a revocation that fails while offline is just lost forever.
export async function signOutLocally() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  supabase.auth.signOut({ scope: 'local' }).then(({ error }) => {
    if (error && accessToken) queuePendingRevocation(accessToken);
  });

  await supabase.auth.stopAutoRefresh();
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}

// Retries server-side session revocations that couldn't go through while offline
// at sign-out time. Safe to call opportunistically (e.g. on app start) — tokens
// that have since expired or already been revoked are simply dropped from the
// queue rather than retried forever.
export async function flushPendingRevocations() {
  const raw = await AsyncStorage.getItem(PENDING_REVOCATION_KEY);
  if (!raw) return;

  const pending: string[] = JSON.parse(raw);
  const stillPending: string[] = [];

  for (const accessToken of pending) {
    const { error } = await supabase.auth.admin
      .signOut(accessToken, 'local')
      .catch((error) => ({ error }));
    if (error && isAuthRetryableFetchError(error)) {
      stillPending.push(accessToken);
    }
  }

  await AsyncStorage.setItem(PENDING_REVOCATION_KEY, JSON.stringify(stillPending));
}
