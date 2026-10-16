import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Icon, type IconName, Pill, type Tone, T } from '../components/ui';
import { WORKSPACE_ICON, WORKSPACE_LABEL } from '../lib/access';
import { activeWorkspace, APPLICATION_STATUS_LABEL, APPLICATION_STATUS_TONE, isPro, useApp } from '../store/useApp';
import { colors } from '../theme';

/** `sub` is a second line (long statuses would squeeze the label as a pill); `badge` is a short pill. */
type Item = { icon: IconName; label: string; href: string; badge?: string; sub?: string; tone?: Tone };

const SUB_COLOR: Record<Tone, string> = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  brand: colors.brand,
  neutral: colors.muted,
};

export default function Menu() {
  const user = useApp((s) => s.user);
  const signOut = useApp((s) => s.signOut);
  const plan = useApp((s) => s.plan);
  const workspace = activeWorkspace(user);
  const app = user.application;
  const hasProRole = user.approvedRoles.some((r) => r !== 'fan');

  const go = (href: string) => {
    router.back();
    setTimeout(() => router.push(href as never), 10);
  };

  const earnings: Item = { icon: 'cash-multiple', label: 'Earnings', href: '/pro/earnings' };
  const roleItems: Item[] =
    workspace === 'musician'
      ? [{ icon: 'calendar-clock', label: 'Availability', href: '/pro/availability' }, earnings]
      : workspace === 'organizer'
        ? [{ icon: 'calendar-star', label: 'Organizer events', href: '/pro/events' }, earnings]
        : workspace === 'venue'
          ? [{ icon: 'storefront-outline', label: 'My venue', href: '/pro/venue-listing' }, earnings]
          : [];

  // One row for professional status: the application when there is one, else the way to apply.
  const applicationItem: Item | undefined = app
    ? { icon: 'file-document-outline', label: 'Professional application', href: '/application', sub: `${WORKSPACE_LABEL[app.role]} · ${APPLICATION_STATUS_LABEL[app.status]}`, tone: APPLICATION_STATUS_TONE[app.status] }
    : hasProRole
      ? undefined
      : { icon: 'check-decagram', label: 'Apply as a professional', href: '/apply' };

  const items: Item[] = [
    { icon: 'account-circle-outline', label: 'Profile', href: '/profile/me' },
    { icon: 'swap-horizontal', label: 'Switch workspace', href: '/workspace', sub: `Now: ${WORKSPACE_LABEL[workspace]}`, tone: 'neutral' },
    ...(isPro(workspace) ? [{ icon: 'view-grid-outline' as const, label: 'Pro workspace', href: '/pro/workspace' }] : []),
    ...roleItems,
    { icon: 'calendar-heart', label: 'My events', href: '/my-events' },
    { icon: 'basket-outline', label: 'Your bookings', href: '/my-bookings?tab=musician' },
    { icon: 'ticket-confirmation-outline', label: 'Your tickets', href: '/my-bookings?tab=tickets' },
    { icon: 'heart-outline', label: 'Wishlist', href: '/wishlist' },
    { icon: 'credit-card-outline', label: 'Payment methods', href: '/payment-methods' },
    { icon: 'ticket-percent-outline', label: 'Promo code', href: '/help?section=promo' },
    { icon: 'bell-outline', label: 'Notifications', href: '/notifications' },
    { icon: 'crown-outline', label: 'Pro plan', href: '/subscription', badge: plan === 'free' ? '1 month free' : 'Active', tone: plan === 'free' ? 'brand' : 'success' },
    ...(applicationItem ? [applicationItem] : []),
    { icon: 'help-circle-outline', label: 'Help', href: '/help' },
    { icon: 'information-outline', label: 'About', href: '/help?section=about' },
  ];

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.scrim }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ width: '78%', maxWidth: 340, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Your profile: ${user.name}, ${WORKSPACE_LABEL[workspace]} workspace`} onPress={() => go('/profile/me')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 16 }}>
            <Avatar src={user.avatar} size={52} label={user.name} verified={user.pro === 'verified'} />
            <View style={{ flex: 1 }}>
              <T v="bodyBold" numberOfLines={1}>{user.name}</T>
              <T v="small" numberOfLines={1}>{user.email}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Icon name={WORKSPACE_ICON[workspace]} size={13} color={colors.brandMid} />
                <T v="caption" numberOfLines={1}>{`${WORKSPACE_LABEL[workspace]} workspace`.toUpperCase()}</T>
              </View>
            </View>
          </Pressable>
          {items.map((it) => (
            <Pressable key={it.label} accessibilityRole="button" accessibilityLabel={[it.label, it.sub, it.badge].filter(Boolean).join(', ')} onPress={() => go(it.href)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48, paddingVertical: it.sub ? 8 : 12, paddingHorizontal: 8, borderRadius: 12, backgroundColor: pressed ? colors.brandSoft : 'transparent' })}>
              <Icon name={it.icon} size={24} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <T v="bodyBold" style={{ fontSize: 16 }} numberOfLines={1}>{it.label}</T>
                {it.sub ? <T v="small" color={SUB_COLOR[it.tone ?? 'neutral']} numberOfLines={2}>{it.sub}</T> : null}
              </View>
              {it.badge ? <Pill label={it.badge} tone={it.tone ?? 'brand'} /> : null}
            </Pressable>
          ))}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
          <Pressable accessibilityRole="button" onPress={() => go('/settings')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48, paddingVertical: 13, paddingHorizontal: 8 }}>
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
            style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48, paddingVertical: 13, paddingHorizontal: 8 }}
          >
            <Icon name="logout" size={24} color={colors.muted} />
            <T v="bodyBold" color={colors.muted}>Log out</T>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
      <Pressable accessibilityRole="button" accessibilityLabel="Close menu" style={{ flex: 1 }} onPress={() => router.back()} />
    </View>
  );
}
