import { Redirect, usePathname } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '../../components/TabBar';
import { useApp } from '../../store/useApp';
import { colors } from '../../theme';

export default function TabsLayout() {
  const authed = useApp((s) => s.authed);
  const path = usePathname();
  // An expired session returns to the same tab after signing in again (login checks the path with safeNext).
  if (!authed) return <Redirect href={path && path !== '/' ? `/login?next=${encodeURIComponent(path)}` : '/login'} />;
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="artists" options={{ title: 'Artists' }} />
      <Tabs.Screen name="create" options={{ title: 'Create' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
    </Tabs>
  );
}
