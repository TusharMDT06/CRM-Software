import React from 'react';
import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="accounts" />
      <Stack.Screen name="lead-sources" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="team" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
