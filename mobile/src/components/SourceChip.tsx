import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Globe,
  Share2,
  Megaphone,
  UserCheck,
  Compass,
  Search,
  MessageSquare,
  Sparkles,
} from 'lucide-react-native';
import { theme } from '../theme';

interface SourceChipProps {
  source?: string;
}

export const SourceChip: React.FC<SourceChipProps> = ({ source = 'Unknown' }) => {
  const normalized = source.toLowerCase();

  const getSourceConfig = () => {
    if (normalized.includes('google')) {
      return {
        icon: Search,
        label: source,
        color: '#2563EB',
        bg: 'rgba(37, 99, 235, 0.08)',
      };
    }
    if (normalized.includes('meta') || normalized.includes('facebook') || normalized.includes('instagram')) {
      return {
        icon: Megaphone,
        label: source,
        color: '#7C3AED',
        bg: 'rgba(124, 58, 237, 0.08)',
      };
    }
    if (normalized.includes('web') || normalized.includes('website') || normalized.includes('form')) {
      return {
        icon: Globe,
        label: source,
        color: '#10B981',
        bg: 'rgba(16, 185, 129, 0.08)',
      };
    }
    if (normalized.includes('referral') || normalized.includes('partner')) {
      return {
        icon: UserCheck,
        label: source,
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.08)',
      };
    }
    if (normalized.includes('social') || normalized.includes('chat') || normalized.includes('whatsapp')) {
      return {
        icon: MessageSquare,
        label: source,
        color: '#06B6D4',
        bg: 'rgba(6, 182, 212, 0.08)',
      };
    }
    return {
      icon: Compass,
      label: source,
      color: theme.colors.text2,
      bg: theme.colors.surfaceMuted,
    };
  };

  const config = getSourceConfig();
  const IconComponent = config.icon;

  return (
    <View style={[styles.container, { backgroundColor: config.bg }]}>
      <IconComponent size={12} color={config.color} style={styles.icon} />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radii.chip,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: theme.typography.families.semiBold,
    fontWeight: '600' as const,
  },
});
