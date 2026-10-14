import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Icon, type IconName, T } from '../components/ui';
import { isPro, ROLE_LABEL, useApp } from '../store/useApp';
import { colors } from '../theme';

type Item = { icon: IconName; label: string; href: string };

export default function Menu() {
  const user = useApp((s) => s.user);
  const signOut = useApp((s) => s.signOut);

  const go = (href: string) => {
    router.back();
    setTimeout(() => router.push(href as never), 10);
  };

  const items: Item[] = [
    { icon: 'account-circle-outline', label: 'Profile', href: '/profile/me' },
    ...(isPro(user.role) ? [{ icon: 'view-grid-outline' as const, label: 'Pro workspace', href: '/pro/workspace' }] : []),
    { icon: 'basket-outline', label: 'Your bookings', href: '/my-bookings?tab=musician' },
    { icon: 'ticket-confirmation-outline', label: 'Your tickets', href: '/my-bookings?tab=tickets' },
    { icon: 'heart-outline', label: 'Wishlist', href: '/wishlist' },
    { icon: 'credit-card-outline', label: 'Payment methods', href: '/payment-methods' },
    { icon: 'ticket-percent-outline', label: 'Promo code', href: '/help?section=promo' },
    { icon: 'bell-outline', label: 'Notifications', href: '/notifications' },
    { icon: 'check-decagram', label: 'Join us as Pro', href: '/pro-verification' },
    { icon: 'help-circle-outline', label: 'Help', href: '/help' },
    { icon: 'information-outline', label: 'About', href: '/help?section=about' },
  ];

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.scrim }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ width: '78%', maxWidth: 340, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
          <Pressable accessibilityRole="button" onPress={() => go('/profile/me')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 16 }}>
            <Avatar src={user.avatar} size={52} label={user.name} verified={user.pro === 'verified'} />
            <View style={{ flex: 1 }}>
              <T v="bodyBold" numberOfLines={1}>{user.name}</T>
              <T v="small" numberOfLines={1}>{user.email}</T>
              <T v="caption" style={{ marginTop: 2 }}>{ROLE_LABEL[user.role].toUpperCase()}</T>
            </View>
          </Pressable>
          {items.map((it) => (
            <Pressable key={it.label} accessibilityRole="button" onPress={() => go(it.href)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 13, paddingHorizontal: 8, borderRadius: 12, backgroundColor: pressed ? colors.brandSoft : 'transparent' })}>
              <Icon name={it.icon} size={24} color={colors.ink} />
              <T v="bodyBold" style={{ fontSize: 16 }}>{it.label}</T>
            </Pressable>
          ))}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
          <Pressable accessibilityRole="button" onPress={() => go('/settings')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 13, paddingHorizontal: 8 }}>
            <Icon name="cog-outline" size={24} color={colors.muted} />
            <T v="bodyBold" color={colors.muted}>Settings</T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.back();
              signOut();
              setTimeout(() => router.replace('/login'), 10);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 13, paddingHorizontal: 8 }}
          >
            <Icon name="logout" size={24} color={colors.muted} />
            <T v="bodyBold" color={colors.muted}>Log out</T>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
      <Pressable accessibilityLabel="Close menu" style={{ flex: 1 }} onPress={() => router.back()} />
    </View>
  );
}
