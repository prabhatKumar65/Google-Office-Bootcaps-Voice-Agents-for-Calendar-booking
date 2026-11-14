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
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

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

export function isEmbeddedIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
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
      return {
        code,
        suggestNewTab: inIframe,
        suggestRedirect: !inIframe,
        message: inIframe
          ? 'The browser blocked the sign-in popup inside the embedded preview. Open the app in a new tab or allow popups for this site.'
          : 'Sign-in popup was blocked by your browser. Allow popups or use redirect sign-in below.',
      };
    case 'auth/popup-closed-by-user':
      return {
        code,
        suggestNewTab: inIframe,
        suggestRedirect: !inIframe,
        message: inIframe
          ? 'Sign-in popup closed before delivering the Google token back to this embedded frame (often caused by browser third-party cookie/storage partitioning). Open the app in a new tab to complete Google sign-in.'
          : 'Sign-in popup was closed before completing authentication. Finish the Google consent prompt without closing the window, or use redirect sign-in below.',
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
        message: `This domain (${window.location.hostname}) is not authorized in Firebase Authentication for project ${firebaseConfig.projectId}.`,
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        suggestNewTab: false,
        suggestRedirect: false,
        message:
          'Google sign-in provider is not enabled in Firebase Authentication for this project.',
      };
    case 'auth/internal-error':
    case 'auth/web-storage-unsupported':
      return {
        code,
        suggestNewTab: inIframe,
        suggestRedirect: !inIframe,
        message: inIframe
          ? 'Browser third-party cookie or storage partitioning blocked the popup relay in this embedded frame. Open the app in a new tab to sign in.'
          : 'Browser storage restriction prevented popup sign-in. Try redirect sign-in below.',
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
        suggestRedirect: !inIframe && code.includes('popup'),
        message:
          error?.message ||
          'Google sign-in could not be completed. Please try again.',
      };
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Handle redirect completion only when running in a top-level tab
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
            onAuthSuccess?.(result.user, token);
          }
        }
      })
      .catch(() => {
        // Ignore stale redirect errors on initial load
      });
  }

  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  if (isSigningIn) {
    throw new Error(
      'Sign-in is already in progress. Complete or close the open Google popup.'
    );
  }
  try {
    isSigningIn = true;
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

    cachedAccessToken = accessToken;
    return { user: result.user, accessToken };
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
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
