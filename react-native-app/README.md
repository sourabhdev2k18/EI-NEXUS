# EI-Nexus - React Native / Expo port

This is a full React Native + Expo (TypeScript) port of the EI-Nexus React web
dashboard. Every screen, panel, and piece of business logic from the web app
has an equivalent here; nothing was dropped except things that are meaningless
outside a browser (see "Not ported" below).

## Getting started

```bash
npm install
npx expo start
```

Before running against a real backend, set your API's absolute URL in
`app.json` under `expo.extra.apiBaseUrl` (see "API layer" below) - it defaults
to a placeholder.

## Project structure

```
App.tsx                  # font loading, error boundary, navigation root
index.ts                 # Expo entry point
src/
  theme/                 # colors, spacing, typography, shadows, radii (was CSS)
  types/                 # shared TS types for the dashboard domain
  constants/              # SENSOR_META, FAILURE_MODES, USE_CASES, etc. + env.ts
  utils/                  # formatters, sensor severity, RCA trace helpers
  hooks/                  # useDebounce, useFetch, useInterval, useModal
  services/               # axios-based API layer (dashboardService, chatService)
  context/                 # DashboardContext (fleet/telemetry/autonomous state)
  navigation/              # React Navigation stack (replaces react-router)
  screens/                 # DashboardScreen (was DashboardPage + DashboardLayout)
  components/
    common/   ErrorBoundary
    ui/       Loader, Panel, Button, Checkbox, StatusBadge, EmptyState
    layout/   Header, StatusPill
    dashboard/ Hero, UseCaseBadges, FleetPanel, DigitalTwinPanel, TelemetryChart,
               AutonomousPanel, RoiPanel, MetricsPanel, ToolsPanel, RcaPanel
    chat/     AriaChatWidget
```

## Key conversion decisions

- **Navigation.** react-router-dom's single `'/'` route + wildcard redirect
  became a one-screen React Navigation native-stack (`navigation/AppNavigator.tsx`).
  It's already structured so more screens can be added later.
- **Styling.** All CSS/CSS-modules were rewritten as `StyleSheet.create()`
  objects driven by a shared `src/theme` (colors, spacing, typography, shadows,
  radii) - the RN equivalent of the old `:root` CSS variables. CSS gradients
  became `expo-linear-gradient`; `box-shadow` became platform shadow/elevation
  in `theme/shadows.ts`; the `pulse` CSS keyframe (CRITICAL status, busy fleet
  cards) became RN `Animated` loops.
- **Charts.** Chart.js has no React Native build, so `TelemetryChart` was
  rebuilt from scratch on `react-native-svg`, plotting the same 4 scaled
  series (temperature, vibration×10, voltage/2, current) over the last 60
  samples.
- **Cross-component signal.** The web app used
  `window.dispatchEvent(new CustomEvent('ei:run-rca'))` so the twin panel's
  "Analyze Root Cause" button could trigger the (unrelated) RCA panel. RN has
  no `window`/`CustomEvent`, so this became a `rcaTrigger` counter + `triggerRca()`
  in `DashboardContext`, watched with `useEffect`.
- **API layer.** Vite's dev server proxied relative `/api/...` calls to the
  backend. RN apps have no origin/proxy, so `src/constants/env.ts` now reads
  an **absolute** `apiBaseUrl` from `app.json`'s `expo.extra` (or an EAS
  secret) - set this per environment before building.
- **Forms.** The app's only "forms" are single-field inputs (chat message,
  RCA query textarea, a fault-type selector). These are handled with plain
  `useState`, matching the original's `useState`-based approach; React Hook
  Form + Zod are wired into `package.json` and ready to use if more complex
  multi-field forms are added later, but adding them here would be
  boilerplate for no benefit.
- **Mobile UX swaps.**
  - `<select>` (fault type, 4 options) → a horizontal chip/segmented picker.
  - The chat `<aside>` side panel → a bottom-sheet `Modal` with a floating
    action button, the standard mobile chat-assistant pattern.
  - `<table>`-like sensor grid → wrapped flex "cards".
  - Hover states → `Pressable`'s `pressed` state.
- **Not ported (browser-only, no RN equivalent):**
  - `components/common/Seo.jsx` (`document.title` / meta description) - there
    is no `<head>` in a native app; the closest equivalent would be setting
    the stack screen's `title` option, which is already exposed if a header
    is later shown.
  - `localStorage`/`sessionStorage` - not used anywhere in the original code,
    so nothing needed replacing with `AsyncStorage`/`SecureStore`; those
    packages are included in `package.json` for when auth or persisted
    preferences are added.

## Fonts

The web app used `IBM Plex Sans`, `JetBrains Mono`, and `Space Grotesk` via
`@font-face`. `App.tsx` loads the same three families natively with
`@expo-google-fonts/*` and gates rendering behind `useFonts(...)`, mirroring
the original's `<Suspense fallback={<Loader />}>`.
