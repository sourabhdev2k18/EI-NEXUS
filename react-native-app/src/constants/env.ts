import Constants from 'expo-constants';

// The original web app called relative paths like '/api/fleet' because Vite's
// dev server proxied '/api' to the backend. React Native apps have no such
// proxy and no origin of their own, so every request needs an absolute URL.
// Set this in app.json -> expo.extra.apiBaseUrl (or an EAS/environment secret)
// per build (dev / staging / prod).
const fallback = 'http://localhost:8000/api';

export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? fallback;
