import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle, WifiOff, RefreshCw } from 'lucide-react-native';
import { theme } from '../theme';
import { PressableScale } from '../animations/PressableScale';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isOffline?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  onRetry,
  isOffline = false,
}) => {
  const defaultTitle = isOffline ? 'No Internet Connection' : 'Something went wrong';
  const defaultMessage = isOffline
    ? 'Please check your network settings and try again.'
    : 'We encountered an error loading this data. Please try again.';

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isOffline
              ? 'rgba(245, 158, 11, 0.12)'
              : 'rgba(239, 68, 68, 0.12)',
          },
        ]}
      >
        {isOffline ? (
          <WifiOff size={36} color={theme.colors.orange} />
        ) : (
          <AlertTriangle size={36} color={theme.colors.ratings.hot.text} />
        )}
      </View>

      <Text style={styles.title}>{title || defaultTitle}</Text>
      <Text style={styles.description}>{message || defaultMessage}</Text>

      {onRetry && (
        <PressableScale onPress={onRetry} style={styles.retryButton}>
          <RefreshCw size={16} color="#FFFFFF" style={styles.retryIcon} />
          <Text style={styles.retryText}>Try Again</Text>
        </PressableScale>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    ...theme.typography.sectionTitle,
    color: theme.colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.text2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radii.input,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600' as const,
  },
});
