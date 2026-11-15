import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

export interface AuthUser {
  displayName: string | null;
  email: string | null;
}

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GisError {
  type: 'popup_failed_to_open' | 'popup_closed' | 'unknown';
  message?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GisTokenResponse) => void;
            error_callback?: (error: GisError) => void;
          }) => GisTokenClient;
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
      ],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app);
  }
})();

const provider = new GoogleAuthProvider();
for (const scope of CALENDAR_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
// Store access token strictly in memory (never localStorage or sessionStorage).
let cachedAccessToken: string | null = null;
let cachedUser: AuthUser | null = null;
let gsiLoadPromise: Promise<boolean> | null = null;

export function isEmbeddedIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function ensureGsiLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.google?.accounts?.oauth2?.initTokenClient) {
    return Promise.resolve(true);
  }
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="accounts.google.com/gsi/client"]'
    );

    const checkReady = () => {
      if (window.google?.accounts?.oauth2?.initTokenClient) {
        resolve(true);
        return true;
      }
      return false;
    };

    if (existing) {
      if (checkReady()) return;
      existing.addEventListener('load', () => resolve(checkReady()), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      setTimeout(() => resolve(checkReady()), 4000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(checkReady());
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
}

async function fetchCalendarUserProfile(accessToken: string): Promise<AuthUser> {
  try {
    const res = await fetch('/api/calendar/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const profile = await res.json();
      const email = typeof profile?.id === 'string' ? profile.id : null;
      const summary = typeof profile?.summary === 'string' ? profile.summary : null;
      return {
        email,
        displayName: summary && summary !== email ? summary : 'Google Calendar',
      };
    }
  } catch {
    // Non-fatal; fallback profile will be enriched on calendar sync
  }
  return { displayName: 'Google Calendar', email: null };
}

export function formatFirebaseAuthError(error: any): {
  message: string;
  code: string;
  suggestNewTab: boolean;
  suggestRedirect: boolean;
} {
  const code = String(error?.code || '');
  const inIframe = isEmbeddedIframe();

  switch (code) {
    case 'auth/popup-blocked':
    case 'gis/popup_failed_to_open':
      return {
        code,
        suggestNewTab: inIframe,
        suggestRedirect: !inIframe,
        message: inIframe
          ? 'Your browser blocked the Google sign-in popup inside the embedded preview. Open the app in a new tab or allow popups for this site.'
          : 'Google sign-in popup was blocked by your browser. Allow popups for this site and click Sign in with Google again.',
      };
    case 'auth/popup-closed-by-user':
    case 'gis/popup_closed':
      return {
        code,
        suggestNewTab: inIframe,
        suggestRedirect: false,
        message: inIframe
          ? 'Google sign-in popup closed before returning your Calendar token. Open the app in a new tab to complete sign-in.'
          : 'The Google sign-in popup was closed before completing consent. Keep the popup open until you finish granting Calendar access.',
      };
    case 'gis/access_denied':
      return {
        code,
        suggestNewTab: false,
        suggestRedirect: false,
        message:
          'Google Calendar access was declined. Approve Calendar permissions on the consent screen to continue.',
      };
    case 'auth/cancelled-popup-request':
      return {
        code,
        suggestNewTab: false,
        suggestRedirect: false,
        message:
          'A previous sign-in popup was interrupted. Click Sign in with Google once and wait for the popup.',
      };
    case 'auth/unauthorized-domain':
      return {
        code,
        suggestNewTab: false,
        suggestRedirect: false,
        message: `This domain (${window.location.hostname}) is not authorized for Google Sign-In on project ${firebaseConfig.projectId}.`,
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        suggestNewTab: false,
        suggestRedirect: false,
        message:
          'Google sign-in provider is not enabled for this project.',
      };
    case 'auth/internal-error':
    case 'auth/web-storage-unsupported':
      return {
        code,
        suggestNewTab: inIframe,
        suggestRedirect: !inIframe,
        message: inIframe
          ? 'Browser third-party cookie or storage partitioning blocked the auth frame here. Open the app in a new tab to sign in.'
          : 'Browser storage restriction prevented sign-in. Try opening the app in a standard browser window.',
      };
    case 'auth/network-request-failed':
      return {
        code,
        suggestNewTab: false,
        suggestRedirect: false,
        message:
          'Network error while contacting Google Authentication. Check your connection and retry.',
      };
    default:
      return {
        code: code || 'unknown',
        suggestNewTab: inIframe && (code.includes('popup') || code.includes('storage')),
        suggestRedirect: false,
        message:
          error?.message ||
          'Google sign-in could not be completed. Please try again.',
      };
  }
}

export const initAuth = (
  onAuthSuccess?: (user: AuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Preload Google Identity Services script so sign-in clicks execute synchronously without popup blocking
  void ensureGsiLoaded();

  if (!isEmbeddedIframe()) {
    void getRedirectResult(auth, browserPopupRedirectResolver)
      .then((result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const fallbackToken = (result as any)?._tokenResponse?.oauthAccessToken as
            | string
            | undefined;
          const token = credential?.accessToken || fallbackToken;
          if (token) {
            cachedAccessToken = token;
            cachedUser = {
              displayName: result.user.displayName,
              email: result.user.email,
            };
            onAuthSuccess?.(cachedUser, token);
          }
        }
      })
      .catch(() => {
        // Ignore stale redirect errors on initial load
      });
  }

  return onAuthStateChanged(auth, (fbUser) => {
    // Preserve an active in-memory GIS OAuth session even when Firebase user is null
    if (cachedAccessToken) {
      const resolvedUser: AuthUser = fbUser
        ? { displayName: fbUser.displayName, email: fbUser.email }
        : cachedUser || { displayName: 'Google Calendar', email: null };
      onAuthSuccess?.(resolvedUser, cachedAccessToken);
      return;
    }

    if (!isSigningIn) {
      cachedAccessToken = null;
      cachedUser = null;
      onAuthFailure?.();
    }
  });
};

function requestGisTokenSync(): Promise<{ user: AuthUser; accessToken: string }> {
  const oauth2 = window.google?.accounts?.oauth2;
  const clientId = firebaseConfig.oAuthClientId;

  if (!oauth2?.initTokenClient || !clientId) {
    return Promise.reject(
      Object.assign(new Error('Google Identity Services is not ready yet.'), {
        code: 'gis/not-ready',
      })
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finishError = (code: string, message: string) => {
      if (settled) return;
      settled = true;
      reject(Object.assign(new Error(message), { code }));
    };

    try {
      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: CALENDAR_SCOPES.join(' '),
        callback: (response: GisTokenResponse) => {
          if (settled) return;
          if (response.error) {
            finishError(
              `gis/${response.error}`,
              response.error_description || `Google sign-in failed (${response.error}).`
            );
            return;
          }
          if (!response.access_token) {
            finishError(
              'gis/no-token',
              'Google sign-in completed, but no Calendar access token was granted.'
            );
            return;
          }

          settled = true;
          const token = response.access_token;
          cachedAccessToken = token;
          void fetchCalendarUserProfile(token).then((profile) => {
            cachedUser = profile;
            resolve({ user: profile, accessToken: token });
          });
        },
        error_callback: (err: GisError) => {
          const code =
            err?.type === 'popup_failed_to_open'
              ? 'gis/popup_failed_to_open'
              : err?.type === 'popup_closed'
                ? 'gis/popup_closed'
                : 'gis/unknown';
          finishError(code, err?.message || 'Google sign-in popup did not complete.');
        },
      });

      // Must be invoked synchronously inside user click handler to satisfy browser popup policies
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err: any) {
      finishError('gis/init-error', err?.message || 'Failed to launch Google sign-in.');
    }
  });
}

async function requestFirebasePopupSignIn(): Promise<{
  user: AuthUser;
  accessToken: string;
}> {
  const result = await signInWithPopup(
    auth,
    provider,
    browserPopupRedirectResolver
  );
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const fallbackToken = (result as any)?._tokenResponse?.oauthAccessToken as
    | string
    | undefined;
  const accessToken = credential?.accessToken || fallbackToken;

  if (!accessToken) {
    throw new Error(
      'Google sign-in succeeded, but no Calendar access token was granted. Please approve Calendar permissions on the Google prompt.'
    );
  }

  const user: AuthUser = {
    displayName: result.user.displayName,
    email: result.user.email,
  };
  cachedAccessToken = accessToken;
  cachedUser = user;
  return { user, accessToken };
}

export const googleSignIn = async (): Promise<{
  user: AuthUser;
  accessToken: string;
}> => {
  if (isSigningIn) {
    throw Object.assign(
      new Error(
        'Sign-in is already in progress. Complete or close the open Google popup.'
      ),
      { code: 'auth/cancelled-popup-request' }
    );
  }

  isSigningIn = true;
  try {
    // Prefer Google Identity Services (storagerelay://) synchronously on click because it bypasses
    // cross-origin firebaseapp.com/__/auth/iframe storage partitioning issues on Cloud Run previews.
    if (
      window.google?.accounts?.oauth2?.initTokenClient &&
      firebaseConfig.oAuthClientId
    ) {
      return await requestGisTokenSync();
    }

    // Fallback to Firebase popup synchronously if GIS script was blocked or has not finished loading
    return await requestFirebasePopupSignIn();
  } finally {
    isSigningIn = false;
  }
};

export const googleSignInRedirect = async (): Promise<void> => {
  if (isEmbeddedIframe()) {
    throw new Error(
      'Redirect sign-in cannot run inside an embedded frame. Open the app in a new tab first.'
    );
  }
  await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
};

export const getAccessToken = (): string | null => cachedAccessToken;

export const clearAccessToken = () => {
  cachedAccessToken = null;
  cachedUser = null;
};

export const logout = async () => {
  const tokenToRevoke = cachedAccessToken;
  cachedAccessToken = null;
  cachedUser = null;

  if (tokenToRevoke && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(tokenToRevoke, () => {});
    } catch {
      // Ignore revoke failures on sign-out
    }
  }

  await auth.signOut().catch(() => {});
};
