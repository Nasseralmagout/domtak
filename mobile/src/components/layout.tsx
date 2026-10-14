import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { conversations, notifications } from '../data/mock';
import { useApp } from '../store/useApp';
import { colors, fonts } from '../theme';
import { IconButton, Row, T } from './ui';

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
  const unread = (convs.length ? convs : conversations).reduce((n, c) => n + c.unread, 0);
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
