import React, { useRef } from 'react';
import { View, StyleSheet, Linking, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Phone, MessageSquare } from 'lucide-react-native';

import { theme } from '../theme';
import { PressableScale } from '../animations/PressableScale';

interface SwipeableRowProps {
  children: React.ReactNode;
  phone?: string;
  onCall?: () => void;
  onSms?: () => void;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  phone,
  onCall,
  onSms,
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const handleCall = () => {
    swipeableRef.current?.close();
    if (onCall) {
      onCall();
    } else if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleSms = () => {
    swipeableRef.current?.close();
    if (onSms) {
      onSms();
    } else if (phone) {
      Linking.openURL(`sms:${phone}`);
    }
  };

  const renderRightActions = () => {
    if (!phone && !onCall && !onSms) return null;

    return (
      <View style={styles.actionsContainer}>
        <PressableScale
          onPress={handleCall}
          style={[styles.actionBtn, styles.callBtn]}
          accessibilityLabel="Call"
        >
          <Phone size={20} color="#FFFFFF" strokeWidth={2.2} />
        </PressableScale>
        <PressableScale
          onPress={handleSms}
          style={[styles.actionBtn, styles.smsBtn]}
          accessibilityLabel="Send SMS"
        >
          <MessageSquare size={20} color="#FFFFFF" strokeWidth={2.2} />
        </PressableScale>
      </View>
    );
  };

  // If on web, render normal content with inline quick buttons if needed or regular children
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        {children}
        {phone ? (
          <View style={styles.webActionOverlay}>
            <PressableScale
              onPress={handleCall}
              style={[styles.webActionPill, styles.callBtn]}
              accessibilityLabel="Call lead"
            >
              <Phone size={13} color="#FFFFFF" />
            </PressableScale>
            <PressableScale
              onPress={handleSms}
              style={[styles.webActionPill, styles.smsBtn]}
              accessibilityLabel="SMS lead"
            >
              <MessageSquare size={13} color="#FFFFFF" />
            </PressableScale>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      overshootRight={false}
      rightThreshold={40}
    >
      {children}
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.listRowGap,
    marginLeft: 8,
    gap: 6,
  },
  actionBtn: {
    width: 48,
    height: '100%',
    minHeight: 56,
    borderRadius: theme.radii.listRow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtn: {
    backgroundColor: theme.colors.green,
  },
  smsBtn: {
    backgroundColor: theme.colors.blue,
  },
  webContainer: {
    position: 'relative',
  },
  webActionOverlay: {
    position: 'absolute',
    right: 32,
    top: 14,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  webActionPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
