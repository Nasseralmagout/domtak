import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';
import { Icon, type IconName } from './ui';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home-variant-outline', label: 'Home' },
  artists: { icon: 'account-music-outline', label: 'Artists' },
  create: { icon: 'plus-circle-outline', label: 'Create' },
  events: { icon: 'party-popper', label: 'Events' },
  calendar: { icon: 'calendar-month-outline', label: 'Calendar' },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.nav, paddingBottom: insets.bottom, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
      <View accessibilityRole="tablist" style={{ height: 64, flexDirection: 'row', alignItems: 'center' }}>
        {state.routes.map((route, index) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          const onPress = () => {
            if (route.name === 'create') {
              router.push('/create-menu');
              return;
            }
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={meta.label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={{ flex: 1, height: 64, alignItems: 'center', justifyContent: 'center' }}
            >
              {focused ? (
                <View style={{ width: 62, height: 62, marginTop: -26, borderRadius: 31, backgroundColor: colors.nav, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={meta.icon} size={28} color={colors.gold} />
                </View>
              ) : (
                <Icon name={meta.icon} size={route.name === 'create' ? 30 : 27} color={colors.white} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
