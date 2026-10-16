import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { toast } from '../store/toast';
import { useApp } from '../store/useApp';
import { colors } from '../theme';
import { goBack, Screen, ScreenHeader } from './layout';
import { Banner, Button, Card, Icon, type IconName, Pill, Row, T, type Tone } from './ui';

/**
 * Shared pieces of the proposed admin console (demo). The console is reachable only while
 * adminMode is on; every number it shows is derived from records in the store.
 */

/** Restricted state shown on admin routes while the demo admin console is off. */
export function AdminGate({ title = 'Admin console' }: { title?: string }) {
  const setAdminMode = useApp((s) => s.setAdminMode);
  return (
    <Screen header={<ScreenHeader title={title} onBack={() => goBack('/help')} />}>
      <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 12 }}>
        <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="shield-lock-outline" size={48} color={colors.brand} />
        </View>
        <T v="h2" center>Admin access needed</T>
        <T v="body" color={colors.muted} center>
          Reviewers, support, finance and moderators work here, and access is limited to Domtak staff. This demo opens the proposed console on the records in this app: your application, the sample review queue, your bookings, support cases and reports.
        </T>
        <Button
          title="Open admin console (demo)"
          icon="shield-account-outline"
          size="md"
          onPress={() => {
            setAdminMode(true);
            toast('Admin console (demo) is on');
          }}
          style={{ marginTop: 8 }}
        />
        <Button title="Back to Help" variant="ghost" size="md" onPress={() => router.replace('/help')} />
      </View>
      <Banner icon="information-outline">Turn it off again from the console or from Help. Decisions you make in the console change the demo records for real and are written to the audit log.</Banner>
    </Screen>
  );
}

const TONE_FG: Record<Tone, string> = { success: colors.success, warning: colors.warning, danger: colors.danger, brand: colors.brand, neutral: colors.label };
const TONE_BG: Record<Tone, string> = { success: colors.successBg, warning: colors.warningBg, danger: colors.dangerBg, brand: colors.brandSoft, neutral: colors.chipIdle };

/** Dashboard panel: what it shows, a live count, its rows and the primary action. */
export function QueuePanel({
  icon,
  title,
  count,
  countLabel,
  tone = 'brand',
  note,
  children,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  count: number;
  countLabel: string;
  tone?: Tone;
  note?: string;
  children?: ReactNode;
  action: string;
  onAction: () => void;
}) {
  const t: Tone = count ? tone : 'neutral';
  return (
    <Card style={{ gap: 12 }}>
      <Row gap={12}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: TONE_BG[t], alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={22} color={TONE_FG[t]} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="title" accessibilityRole="header">{title}</T>
          <T v="small">{count ? `${count} ${countLabel}` : `No ${countLabel}`}</T>
        </View>
        <T v="h2" color={count ? TONE_FG[t] : colors.subtle} accessibilityLabel={`${count} ${countLabel}`}>{count}</T>
      </Row>
      {note ? <T v="small">{note}</T> : null}
      {children}
      <Button title={action} variant="light" size="sm" icon="arrow-right" onPress={onAction} style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
}

/** One tappable record row inside a panel or list. */
export function RecordRow({ icon, title, sub, pill, tone = 'brand', onPress, right }: { icon?: IconName; title: string; sub?: string; pill?: string; tone?: Tone; onPress?: () => void; right?: ReactNode }) {
  const body = (
    <Row gap={12} style={{ minHeight: 48, paddingVertical: 6 }}>
      {icon ? <Icon name={icon} size={20} color={TONE_FG[tone]} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyBold" numberOfLines={2}>{title}</T>
        {sub ? <T v="small" numberOfLines={2}>{sub}</T> : null}
        {pill ? <Pill label={pill} tone={tone} /> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={20} color={colors.subtle} /> : null)}
    </Row>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}${sub ? `, ${sub}` : ''}${pill ? `, ${pill}` : ''}`} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

/** Small "Admin · demo" marker for console headers. */
export function AdminBadge() {
  return <Pill label="Admin · demo" tone="neutral" icon="shield-account-outline" />;
}
