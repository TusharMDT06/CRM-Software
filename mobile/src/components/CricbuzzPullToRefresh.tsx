import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ScrollViewProps,
  NativeSyntheticEvent,
  NativeScrollEvent,
  PanResponder,
  Animated,
  Easing,
  Platform,
  RefreshControl,
} from 'react-native';
import { RotateCw, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { queryClient } from '../api/queryClient';
import { theme } from '../theme';

export interface CricbuzzScrollViewProps extends ScrollViewProps {
  onRefresh?: () => Promise<any> | void;
  refreshing?: boolean;
  refreshAll?: boolean; // defaults to true (refreshes entire app)
  children?: React.ReactNode;
}

const BANNER_MAX_HEIGHT = 46;
const TRIGGER_THRESHOLD = 40;

export const CricbuzzScrollView = React.forwardRef<ScrollView, CricbuzzScrollViewProps>(
  (
    {
      onRefresh,
      refreshing = false,
      refreshAll = true,
      children,
      style,
      contentContainerStyle,
      onScroll,
      ...rest
    },
    forwardedRef
  ) => {
    const internalScrollRef = useRef<ScrollView>(null);
    const scrollRef = (forwardedRef as React.RefObject<ScrollView>) || internalScrollRef;

    const [pullState, setPullState] = useState<'idle' | 'pull' | 'release' | 'loading' | 'success'>('idle');
    const scrollYRef = useRef(0);
    const isDraggingRef = useRef(false);
    const hapticFiredRef = useRef(false);

    // Animated height of the banner: Starts at 0 (COMPLETELY HIDDEN when not pulling)
    const bannerHeight = useRef(new Animated.Value(0)).current;

    // Arrow rotation: 0deg when pulling, 180deg when release threshold reached
    const arrowRotate = useRef(new Animated.Value(0)).current;

    // Continuous spinning animation during loading
    const spinAnim = useRef(new Animated.Value(0)).current;
    const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

    // Sync external refreshing prop
    useEffect(() => {
      if (refreshing && pullState !== 'loading') {
        startLoadingAnimation();
        setPullState('loading');
      } else if (!refreshing && pullState === 'loading') {
        stopLoadingAndClose();
      }
    }, [refreshing]);

    const startLoadingAnimation = () => {
      // Expand banner to visible loading height
      Animated.timing(bannerHeight, {
        toValue: BANNER_MAX_HEIGHT,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();

      spinAnim.setValue(0);
      spinLoopRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 850,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      spinLoopRef.current.start();
    };

    const stopLoadingAndClose = () => {
      if (spinLoopRef.current) {
        spinLoopRef.current.stop();
        spinLoopRef.current = null;
      }
      setPullState('success');

      // Briefly show success, then smoothly collapse back to 0 height
      setTimeout(() => {
        Animated.timing(bannerHeight, {
          toValue: 0,
          duration: 220,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }).start(() => {
          setPullState('idle');
          arrowRotate.setValue(0);
          hapticFiredRef.current = false;
        });
      }, 700);
    };

    const triggerRefresh = useCallback(async () => {
      if (pullState === 'loading') return;
      setPullState('loading');
      startLoadingAnimation();

      try {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }

        const promises: Promise<any>[] = [];

        // 1. Invalidate all active queries across the entire app
        if (refreshAll) {
          promises.push(queryClient.invalidateQueries({ type: 'active' }));
        }

        // 2. Call screen-specific onRefresh if provided
        if (onRefresh) {
          const res = onRefresh();
          if (res && typeof res.then === 'function') {
            promises.push(res);
          }
        }

        // Minimum 650ms display time so user sees the Cricbuzz loading state
        promises.push(new Promise((resolve) => setTimeout(resolve, 650)));

        await Promise.all(promises);
      } catch (err) {
        console.warn('[CricbuzzPullToRefresh] Refresh error:', err);
      } finally {
        stopLoadingAndClose();
      }
    }, [onRefresh, refreshAll, pullState]);

    // Handle scroll events: iOS & Web overscroll pull detection
    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      scrollYRef.current = y;

      if (pullState === 'loading' || pullState === 'success') {
        onScroll?.(e);
        return;
      }

      // If user is actively dragging down at the top (overscroll y < 0)
      if (isDraggingRef.current && y < 0) {
        const pull = Math.min(Math.abs(y), BANNER_MAX_HEIGHT + 20);
        bannerHeight.setValue(Math.min(pull, BANNER_MAX_HEIGHT));

        const rot = Math.min(pull / TRIGGER_THRESHOLD, 1);
        arrowRotate.setValue(rot);

        if (pull >= TRIGGER_THRESHOLD) {
          if (!hapticFiredRef.current) {
            hapticFiredRef.current = true;
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
          }
          setPullState('release');
        } else {
          hapticFiredRef.current = false;
          setPullState('pull');
        }
      }

      onScroll?.(e);
    };

    const handleScrollBeginDrag = () => {
      isDraggingRef.current = true;
    };

    const handleScrollEndDrag = () => {
      isDraggingRef.current = false;
      if (pullState === 'release') {
        triggerRefresh();
      } else if (pullState === 'pull') {
        // Collapse back to 0 if not pulled enough
        Animated.timing(bannerHeight, {
          toValue: 0,
          duration: 180,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }).start(() => {
          setPullState('idle');
          arrowRotate.setValue(0);
        });
      }
    };

    // Web window wheel listener for trackpad/mouse wheel scrolling up at the top
    useEffect(() => {
      if (Platform.OS !== 'web') return;
      let acc = 0;
      let timer: any = null;

      const onWinWheel = (e: WheelEvent) => {
        // Only trigger when user is at the top of page and scrolls up (pulls down)
        if (scrollYRef.current <= 2 && e.deltaY < 0 && pullState !== 'loading' && pullState !== 'success') {
          acc += Math.abs(e.deltaY);
          const pull = Math.min(acc * 0.45, BANNER_MAX_HEIGHT);
          bannerHeight.setValue(pull);

          const rot = Math.min(pull / TRIGGER_THRESHOLD, 1);
          arrowRotate.setValue(rot);

          if (pull >= TRIGGER_THRESHOLD) {
            setPullState('release');
          } else {
            setPullState('pull');
          }

          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            const finalPull = Math.min(acc * 0.45, BANNER_MAX_HEIGHT);
            acc = 0;
            if (finalPull >= TRIGGER_THRESHOLD) {
              triggerRefresh();
            } else {
              Animated.timing(bannerHeight, {
                toValue: 0,
                duration: 180,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: false,
              }).start(() => {
                setPullState('idle');
                arrowRotate.setValue(0);
              });
            }
          }, 240);
        }
      };

      const onCustomRefresh = () => {
        triggerRefresh();
      };

      window.addEventListener('wheel', onWinWheel, { passive: true });
      window.addEventListener('flowdesk:refresh', onCustomRefresh);

      return () => {
        window.removeEventListener('wheel', onWinWheel);
        window.removeEventListener('flowdesk:refresh', onCustomRefresh);
        if (timer) clearTimeout(timer);
      };
    }, [triggerRefresh, pullState]);

    // Touch PanResponder for downward pull gesture at scroll top (Android & touch devices)
    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (pullState === 'loading' || pullState === 'success') return false;
          // Only capture when at top and dragging downwards
          return scrollYRef.current <= 1 && gestureState.dy > 12;
        },
        onPanResponderMove: (_, gestureState) => {
          if (pullState === 'loading' || pullState === 'success') return;
          const pull = Math.max(0, Math.min(gestureState.dy * 0.5, BANNER_MAX_HEIGHT + 15));
          bannerHeight.setValue(Math.min(pull, BANNER_MAX_HEIGHT));

          const rot = Math.min(pull / TRIGGER_THRESHOLD, 1);
          arrowRotate.setValue(rot);

          if (pull >= TRIGGER_THRESHOLD) {
            if (!hapticFiredRef.current) {
              hapticFiredRef.current = true;
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
            }
            setPullState('release');
          } else {
            hapticFiredRef.current = false;
            setPullState('pull');
          }
        },
        onPanResponderRelease: () => {
          if (pullState === 'release') {
            triggerRefresh();
          } else if (pullState === 'pull') {
            Animated.timing(bannerHeight, {
              toValue: 0,
              duration: 180,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }).start(() => {
              setPullState('idle');
              arrowRotate.setValue(0);
            });
          }
        },
      })
    ).current;

    const arrowRotationInterpolate = arrowRotate.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });

    const spinInterpolate = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={[styles.outerContainer, style]} {...panResponder.panHandlers}>
        {/* Cricbuzz Style Pull-to-Refresh Banner: COMPLETELY HIDDEN (height: 0) when idle */}
        <Animated.View style={[styles.bannerWrapper, { height: bannerHeight }]}>
          <View
            style={[
              styles.bannerContainer,
              pullState === 'loading' && styles.bannerLoadingBg,
              pullState === 'release' && styles.bannerReleaseBg,
            ]}
          >
            {pullState === 'loading' ? (
              <View style={styles.bannerRow}>
                <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                  <RotateCw size={17} color={theme.colors.orange} />
                </Animated.View>
                <Text style={styles.loadingText}>Loading....</Text>
              </View>
            ) : pullState === 'release' ? (
              <View style={styles.bannerRow}>
                <Animated.View style={{ transform: [{ rotate: arrowRotationInterpolate }] }}>
                  <RotateCw size={17} color={theme.colors.orange} />
                </Animated.View>
                <Text style={styles.releaseText}>Release to Refresh</Text>
              </View>
            ) : pullState === 'success' ? (
              <View style={styles.bannerRow}>
                <Check size={16} color={theme.colors.green} />
                <Text style={styles.successText}>Live Data Updated</Text>
              </View>
            ) : (
              <View style={styles.bannerRow}>
                <Animated.View style={{ transform: [{ rotate: arrowRotationInterpolate }] }}>
                  <RotateCw size={17} color="#64748B" />
                </Animated.View>
                <Text style={styles.pullText}>Pull to Refresh</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Underlying ScrollView */}
        <ScrollView
          ref={scrollRef}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={pullState === 'loading'}
              onRefresh={triggerRefresh}
              tintColor={theme.colors.orange}
              colors={[theme.colors.orange]}
            />
          }
          contentContainerStyle={contentContainerStyle}
          {...rest}
        >
          {children}
        </ScrollView>
      </View>
    );
  }
);

CricbuzzScrollView.displayName = 'CricbuzzScrollView';

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  bannerWrapper: {
    width: '100%',
    overflow: 'hidden',
    zIndex: 10,
  },
  bannerContainer: {
    width: '100%',
    height: BANNER_MAX_HEIGHT,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerReleaseBg: {
    backgroundColor: '#FFF7ED',
    borderBottomColor: '#FED7AA',
  },
  bannerLoadingBg: {
    backgroundColor: '#FFF7ED',
    borderBottomColor: '#FED7AA',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pullText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: theme.typography.families.semiBold,
    letterSpacing: -0.2,
  },
  releaseText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.orange,
    fontFamily: theme.typography.families.bold,
    letterSpacing: -0.2,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.orange,
    fontFamily: theme.typography.families.semiBold,
    letterSpacing: -0.2,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.green,
    fontFamily: theme.typography.families.semiBold,
    letterSpacing: -0.2,
  },
});
