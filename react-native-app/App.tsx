import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, IBMPlexSans_400Regular, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { Loader } from './src/components/ui/Loader';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// The web app loaded 'IBM Plex Sans', 'JetBrains Mono' and 'Space Grotesk'
// via @font-face in theme.css. RN fonts must be loaded natively with
// expo-font (via the @expo-google-fonts packages) before first paint, which
// is the direct equivalent of the original <Suspense fallback={<Loader />}>
// gate around route rendering.
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_600SemiBold,
    JetBrainsMono_400Regular,
    SpaceGrotesk_600SemiBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded && !fontError) {
    return <Loader label="Loading EI-Nexus..." />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={colors.bg} />
        <AppNavigator />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
