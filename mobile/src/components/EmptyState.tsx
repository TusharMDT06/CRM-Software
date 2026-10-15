import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { theme } from '../theme';
import { PressableScale } from '../animations/PressableScale';

interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon size={36} color={theme.colors.blue} />
      </View>

      <Text style={styles.title}>{title}</Text>

      {description && <Text style={styles.description}>{description}</Text>}

      {actionLabel && onAction && (
        <PressableScale onPress={onAction} style={styles.actionButton}>
          <Text style={styles.actionText}>{actionLabel}</Text>
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
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
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
  actionButton: {
    backgroundColor: theme.colors.blue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radii.input,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600' as const,
  },
});
