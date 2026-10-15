import { router } from 'expo-router';
import { type ReactNode, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { conversations, notifications } from '../data/mock';
import type { Role } from '../data/types';
import { toast } from '../store/toast';
import { APPLICATION_STATUS_LABEL, isApproved, ROLE_LABEL, useApp } from '../store/useApp';
import { colors, fonts, radius } from '../theme';
import { Button, Icon, IconButton, Row, T } from './ui';

export function Screen({
  children,
  scroll = true,
  header,
  footer,
  bg = colors.bg,
  edges = ['top'],
  contentStyle,
  keyboard,
}: {
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  bg?: string;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
}) {
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ padding: 16, paddingBottom: 32, gap: 16 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );
  const inner = (
    <>
      {header}
      {body}
      {footer}
    </>
  );
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: bg }}>
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function goBack(fallback: string = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

export function ScreenHeader({
  title,
  subtitle,
  back = true,
  right,
  dark,
  onBack,
  close,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  dark?: boolean;
  onBack?: () => void;
  close?: boolean;
}) {
  const fg = dark ? colors.white : colors.ink;
  return (
    <Row style={{ minHeight: 60, paddingHorizontal: 4, paddingVertical: 6 }} gap={4}>
      {back ? <IconButton name={close ? 'close' : 'chevron-left'} label={close ? 'Close' : 'Back'} color={fg} iconSize={close ? 24 : 30} onPress={onBack ?? (() => goBack())} /> : <View style={{ width: 12 }} />}
      <View style={{ flex: 1 }}>
        {title ? (
          <T v="h3" color={fg} numberOfLines={1} accessibilityRole="header">
            {title}
          </T>
        ) : null}
        {subtitle ? (
          <T v="small" color={dark ? colors.lilac : colors.muted} numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </Row>
  );
}

export function DomtakHeader({ showMenu = true }: { showMenu?: boolean }) {
  const read = useApp((s) => s.readNotifications);
  const convs = useApp((s) => s.conversations);
  const blocked = useApp((s) => s.blocked);
  // Messages from blocked accounts never light up the inbox dot.
  const unread = useMemo(() => (convs.length ? convs : conversations).reduce((n, c) => n + (blocked.includes(c.withId) ? 0 : c.unread), 0), [convs, blocked]);
  return (
    <View style={{ backgroundColor: colors.brandDeep }}>
      <Row style={{ height: 60, paddingLeft: showMenu ? 4 : 18, paddingRight: 4 }} gap={0}>
        {showMenu ? <IconButton name="menu" label="Open menu" color={colors.white} onPress={() => router.push('/menu')} /> : null}
        <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.wordmark, fontSize: 28, color: colors.white, letterSpacing: 0.5 }}>
          DOMTAK
        </Text>
        <IconButton name="email-outline" label="Messages" color={colors.lilac} badge={unread > 0} onPress={() => router.push('/inbox')} />
        <IconButton name="map-marker-outline" label="Map" color={colors.lilac} onPress={() => router.push('/map')} />
        <IconButton name="bell-outline" label="Notifications" color={colors.lilac} badge={!read && notifications.length > 0} onPress={() => router.push('/notifications')} />
      </Row>
    </View>
  );
}

export function BottomBar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) + 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }, style]}>
      {children}
    </View>
  );
}

/**
 * Container for clearly labelled demo shortcuts (e.g. "Provider accepts", "Approve my application").
 * Everything inside must still change real store state; the label tells people it is a simulation.
 */
export function DemoBar({ title = 'Demo controls', note, children, style }: { title?: string; note?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityLabel={title} style={[{ gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.chipIdle }, style]}>
      <Row gap={8}>
        <Icon name="flask-outline" size={18} color={colors.label} />
        <T v="caption" color={colors.label}>{title.toUpperCase()}</T>
      </Row>
      {note ? <T v="small">{note}</T> : null}
      {children}
    </View>
  );
}

/**
 * "Missing permission" state (blueprint section 13): explains eligibility and routes to the
 * application or the right workspace. Render it instead of a professional screen when
 * the user is not working in an approved `role` workspace.
 */
export function PermissionNotice({ role, action }: { role: Exclude<Role, 'fan'>; action?: string }) {
  const user = useApp((s) => s.user);
  const switchWorkspace = useApp((s) => s.switchWorkspace);
  const approved = isApproved(user, role);
  const app = user.application?.role === role ? user.application : undefined;
  const what = action ?? 'use this';
  let title = `${ROLE_LABEL[role]} approval needed`;
  let body = `To ${what}, apply as ${ROLE_LABEL[role].toLowerCase()}. Our team reviews applications, usually within 24 hours. Your member account keeps working meanwhile.`;
  let button: { label: string; onPress: () => void } = { label: 'Apply', onPress: () => router.push('/pro-verification') };
  if (approved) {
    title = `Switch to your ${ROLE_LABEL[role]} workspace`;
    body = `You’re approved as ${ROLE_LABEL[role].toLowerCase()}. Switch workspace to ${what}.`;
    button = {
      label: `Switch to ${ROLE_LABEL[role]}`,
      onPress: () => {
        if (switchWorkspace(role)) toast(`Switched to your ${ROLE_LABEL[role]} workspace`);
      },
    };
  } else if (app) {
    title = `Application: ${APPLICATION_STATUS_LABEL[app.status]}`;
    body =
      app.status === 'pending'
        ? 'Your application is being reviewed. You get access once it is approved.'
        : app.status === 'info'
          ? `We need more information: ${app.missing?.join(', ') || app.reason || 'see your application'}.`
          : `Your application was not approved${app.reason ? `: ${app.reason}` : ''}. You can update it and apply again.`;
    button = { label: app.status === 'pending' ? 'View application' : 'Update application', onPress: () => router.push('/pro-verification') };
  }
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 12 }}>
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={approved ? 'swap-horizontal' : 'shield-account-outline'} size={44} color={colors.brand} />
      </View>
      <T v="h2" center>{title}</T>
      <T v="body" color={colors.muted} center>{body}</T>
      <Button title={button.label} size="md" onPress={button.onPress} style={{ marginTop: 8 }} />
    </View>
  );
}
