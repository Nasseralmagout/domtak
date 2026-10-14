import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { LilitaOne_400Regular } from '@expo-google-fonts/lilita-one/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useSyncExternalStore } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '../components/ActionSheet';
import { useApp } from '../store/useApp';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const subscribeHydration = (cb: () => void) => useApp.persist.onFinishHydration(cb);
const getHydrated = () => useApp.persist.hasHydrated();

function useHydrated() {
  return useSyncExternalStore(subscribeHydration, getHydrated, getHydrated);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    LilitaOne_400Regular,
  });
  const hydrated = useHydrated();
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="story/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: colors.black } }} />
        <Stack.Screen name="live/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: colors.black } }} />
        <Stack.Screen name="create-menu" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen name="menu" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen name="pro/scan" options={{ contentStyle: { backgroundColor: '#120A24' } }} />
      </Stack>
      <ToastHost />
    </SafeAreaProvider>
  );
}
