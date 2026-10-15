import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { create } from 'zustand';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type?: ToastType;
  duration?: number;
}

interface ToastState {
  currentToast: ToastMessage | null;
  show: (toast: Omit<ToastMessage, 'id'>) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  currentToast: null,
  show: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set({ currentToast: { ...toast, id, duration: toast.duration || 3000 } });
  },
  hide: () => set({ currentToast: null }),
}));

export const showToast = (
  title: string,
  options?: { message?: string; type?: ToastType; duration?: number }
) => {
  useToastStore.getState().show({
    title,
    message: options?.message,
    type: options?.type || 'info',
    duration: options?.duration || 3000,
  });
};

export const Toast: React.FC = () => {
  const currentToast = useToastStore((state) => state.currentToast);
  const hide = useToastStore((state) => state.hide);
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (currentToast) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 200 });

      const timer = setTimeout(() => {
        dismiss();
      }, currentToast.duration || 3000);

      return () => clearTimeout(timer);
    } else {
      translateY.value = 100;
      opacity.value = 0;
    }
  }, [currentToast]);

  const dismiss = () => {
    translateY.value = withTiming(100, { duration: 250 });
    opacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(hide)();
      }
    });
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  if (!currentToast) return null;

  const getIcon = () => {
    switch (currentToast.type) {
      case 'success':
        return <CheckCircle2 size={18} color={theme.colors.green} />;
      case 'error':
        return <AlertCircle size={18} color={theme.colors.ratings.hot.text} />;
      case 'warning':
        return <AlertCircle size={18} color="#F59E0B" />;
      case 'info':
      default:
        return <Info size={18} color={theme.colors.blue} />;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: Math.max(insets.bottom, 16) + 60 },
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.toast}>
        <View style={styles.iconContainer}>{getIcon()}</View>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {currentToast.title}
          </Text>
          {currentToast.message && (
            <Text style={styles.message} numberOfLines={2}>
              {currentToast.message}
            </Text>
          )}
        </View>

        <Pressable onPress={dismiss} hitSlop={8} style={styles.closeBtn}>
          <X size={14} color={theme.colors.muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radii.input,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    maxWidth: 480,
    width: '100%',
  },
  iconContainer: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600' as const,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontFamily: theme.typography.families.regular,
    marginTop: 2,
  },
  closeBtn: {
    marginLeft: 8,
    padding: 2,
  },
});
