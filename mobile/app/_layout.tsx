import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

// Suppress Reanimated v3.16+ strict mode warnings across web/render passes
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { queryClient } from '../src/api/queryClient';
import { useAuth } from '../src/auth/useAuth';
import { useSessionStore } from '../src/auth/sessionStore';
import { useRealtimeSync } from '../src/realtime/useRealtimeSync';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { BiometricLockModal } from '../src/components/BiometricLockModal';
import { Toast } from '../src/components/Toast';
import { theme } from '../src/theme';
import { initOfflineQueueSync } from '../src/offline/mutationQueue';
import {
  setupPushNotificationListeners,
  handleInitialPushOrDeepLink,
} from '../src/notifications/pushNotifications';
import { setupBiometricTimeoutListener } from '../src/auth/biometrics';

function AppContent() {
  useRealtimeSync();
  const { initializeAuth } = useAuth();
  const { isAuthenticated, isLoading } = useSessionStore();
  const segments = useSegments();
  const router = useRouter();

  // 1. Initialize Auth on Boot
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // 2. Initialize Offline Queue Auto-Sync on Network Reconnect
  useEffect(() => {
    const unsubQueue = initOfflineQueueSync();
    return () => unsubQueue();
  }, []);

  // 3. Initialize Biometric Inactivity Timeout Listener
  useEffect(() => {
    const unsubBiometrics = setupBiometricTimeoutListener();
    return () => unsubBiometrics();
  }, []);

  // 4. Initialize Push Notifications & Deep Link Handlers
  useEffect(() => {
    const unsubPush = setupPushNotificationListeners((route) => {
      try {
        router.push(route as any);
      } catch (err) {
        console.warn('[Navigation] Deep link push failed:', err);
      }
    });

    handleInitialPushOrDeepLink((route) => {
      try {
        router.push(route as any);
      } catch (err) {
        console.warn('[Navigation] Initial deep link failed:', err);
      }
    });

    return () => unsubPush();
  }, [router]);

  // 5. Auth-Guard & Route Redirection
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.orange} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <BiometricLockModal />
      <Toast />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.ink,
  },
});
