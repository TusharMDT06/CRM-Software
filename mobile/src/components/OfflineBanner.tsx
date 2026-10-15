import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff, CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useOfflineQueueStore } from '../offline/mutationQueue';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const insets = useSafeAreaInsets();
  const heightAnim = useSharedValue(0);

  const { isSyncing, queue, lastSyncedAt } = useOfflineQueueStore();
  const pendingCount = queue.length;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    return () => unsubscribe();
  }, []);

  // Show "All synced" briefly after sync finishes
  useEffect(() => {
    if (lastSyncedAt && !isSyncing && !isOffline && pendingCount === 0) {
      setJustSynced(true);
      const timer = setTimeout(() => {
        setJustSynced(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [lastSyncedAt, isSyncing, isOffline, pendingCount]);

  const shouldShow = isOffline || isSyncing || justSynced;

  useEffect(() => {
    if (shouldShow) {
      setIsRendered(true);
      heightAnim.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      heightAnim.value = withTiming(
        0,
        {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(setIsRendered)(false);
          }
        }
      );
    }
  }, [shouldShow, heightAnim]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      maxHeight: heightAnim.value * 64,
      opacity: heightAnim.value,
      transform: [{ translateY: (1 - heightAnim.value) * -40 }],
    };
  });

  if (!shouldShow && !isRendered) {
    return null;
  }

  const backgroundColor = isOffline
    ? theme.colors.orange
    : isSyncing
    ? theme.colors.blue
    : theme.colors.green;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor,
          paddingTop: Math.max(insets.top, 8),
        },
        animatedStyle,
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.contentRow}>
        {isOffline ? (
          <>
            <WifiOff size={14} color="#FFFFFF" style={styles.icon} />
            <Text style={styles.text}>
              {pendingCount > 0
                ? `Offline · ${pendingCount} change${pendingCount > 1 ? 's' : ''} queued`
                : 'You are offline · Changes will sync when online'}
            </Text>
          </>
        ) : isSyncing ? (
          <>
            <ActivityIndicator size="small" color="#FFFFFF" style={styles.icon} />
            <Text style={styles.text}>Syncing offline changes…</Text>
          </>
        ) : (
          <>
            <CheckCircle2 size={14} color="#FFFFFF" style={styles.icon} />
            <Text style={styles.text}>All changes synced</Text>
          </>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600' as const,
  },
});
