import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { showToast } from '../components/Toast';

const STORAGE_KEY_PUSH_TOKEN = 'flowdesk_expo_push_token';

// Configure foreground notification behavior on native platforms
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registers device for push notifications and sends token to server
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Notification permission not granted');
      return null;
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F2711C',
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    const expoPushToken = tokenResponse?.data;
    if (expoPushToken) {
      await AsyncStorage.setItem(STORAGE_KEY_PUSH_TOKEN, expoPushToken);

      // Register device with server
      await apiClient.post('/users/me/devices', {
        expoPushToken,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version || '1.0.0',
      });
      console.log('[Push] Registered push token with server:', expoPushToken);
    }

    return expoPushToken || null;
  } catch (err) {
    console.warn('[Push] Error registering device token:', err);
    return null;
  }
}

/**
 * Unregisters device push token from server on logout
 */
export async function unregisterPushNotificationsAsync(): Promise<void> {
  try {
    const storedToken = await AsyncStorage.getItem(STORAGE_KEY_PUSH_TOKEN);
    if (storedToken) {
      await apiClient.delete(`/users/me/devices/${encodeURIComponent(storedToken)}`).catch(() => {});
      await AsyncStorage.removeItem(STORAGE_KEY_PUSH_TOKEN);
      console.log('[Push] Unregistered device token from server');
    }
  } catch (err) {
    console.warn('[Push] Failed to unregister push token:', err);
  }
}

/**
 * Resolves a notification link or deep link to an internal expo-router path
 */
export function resolveDeepLinkRoute(rawUrl?: string, data?: Record<string, any>): string | null {
  if (!rawUrl && !data) return null;

  let url = rawUrl || '';

  if (!url && data?.link) {
    url = data.link;
  }

  if (url.startsWith('flowdesk://')) {
    const path = url.replace('flowdesk://', '');
    const [section, id] = path.split('/');

    if (section === 'leads' && id) return `/(tabs)/leads/${id}`;
    if (section === 'deals' && id) return `/(tabs)/deals/${id}`;
    if (section === 'tasks') return `/(tabs)/more/tasks`;
    if (section === 'messages' && id) return `/(tabs)/more/messages/thread/${id}`;
    if (section === 'contacts' && id) return `/(tabs)/contacts/${id}`;
  }

  if (url.startsWith('/leads/')) {
    const id = url.replace('/leads/', '');
    return `/(tabs)/leads/${id}`;
  }
  if (url.startsWith('/deals/')) {
    const id = url.replace('/deals/', '');
    return `/(tabs)/deals/${id}`;
  }
  if (url.startsWith('/tasks')) {
    return `/(tabs)/more/tasks`;
  }
  if (url.startsWith('/messages/thread/')) {
    const id = url.replace('/messages/thread/', '');
    return `/(tabs)/more/messages/thread/${id}`;
  }
  if (url.startsWith('/contacts/')) {
    const id = url.replace('/contacts/', '');
    return `/(tabs)/contacts/${id}`;
  }

  if (data?.entityType && data?.entityId) {
    if (data.entityType === 'lead') return `/(tabs)/leads/${data.entityId}`;
    if (data.entityType === 'deal') return `/(tabs)/deals/${data.entityId}`;
    if (data.entityType === 'task') return `/(tabs)/more/tasks`;
    if (data.entityType === 'message') return `/(tabs)/more/messages/thread/${data.entityId}`;
    if (data.entityType === 'contact') return `/(tabs)/contacts/${data.entityId}`;
  }

  return null;
}

/**
 * Initializes foreground push toast and response tap listeners
 */
export function setupPushNotificationListeners(
  onNavigate: (route: string) => void
): () => void {
  try {
    const notificationSubscription = Notifications.addNotificationReceivedListener(
      (notification: any) => {
        const { title, body } = notification.request.content;
        showToast(`${title ? title + ': ' : ''}${body || 'New notification'}`, {
          type: 'info',
        });
      }
    );

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response.notification.request.content.data;
        const targetRoute = resolveDeepLinkRoute(undefined, data);
        if (targetRoute) {
          onNavigate(targetRoute);
        }
      }
    );

    return () => {
      notificationSubscription.remove();
      responseSubscription.remove();
    };
  } catch {
    return () => {};
  }
}

/**
 * Handles cold start initial URL or notification response
 */
export async function handleInitialPushOrDeepLink(
  onNavigate: (route: string) => void
): Promise<void> {
  try {
    const lastResponse = await Notifications.getLastNotificationResponseAsync();
    if (lastResponse) {
      const data = lastResponse.notification.request.content.data;
      const targetRoute = resolveDeepLinkRoute(undefined, data);
      if (targetRoute) {
        onNavigate(targetRoute);
        return;
      }
    }

    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      const targetRoute = resolveDeepLinkRoute(initialUrl);
      if (targetRoute) {
        onNavigate(targetRoute);
      }
    }
  } catch (err) {
    console.warn('[Push] Error handling initial deep link:', err);
  }
}
