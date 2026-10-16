import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionSheet, type SheetAction } from '../components/ActionSheet';
import { BottomBar, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Divider, Icon, type IconName, Pill, Row, Segmented, T } from '../components/ui';
import { euro, MONTHS_LONG, TODAY } from '../lib/format';
import { canPostToFeed, useApp } from '../store/useApp';
import { toast } from '../store/toast';
import { colors, radius, shadow } from '../theme';

type Billing = 'monthly' | 'yearly';

const MONTHLY = 9.99;
const YEARLY = 89;
const SAVING = MONTHLY * 12 - YEARLY;
const SAVING_PCT = Math.round((SAVING / (MONTHLY * 12)) * 100);

const FEATURES: { label: string; icon: IconName; standard: boolean }[] = [
  { label: 'Like & comment', icon: 'thumb-up-outline', standard: true },
  { label: 'Photos in comments and event discussions', icon: 'image-outline', standard: true },
  { label: 'Create private events', icon: 'lock-outline', standard: true },
  { label: 'Invite friends', icon: 'account-multiple-plus-outline', standard: true },
  { label: 'Chat', icon: 'message-text-outline', standard: true },
  { label: 'Buy tickets', icon: 'ticket-outline', standard: true },
  { label: 'Book musicians & venues', icon: 'calendar-check-outline', standard: true },
  { label: 'Wishlist', icon: 'heart-outline', standard: true },
  { label: 'Feed posts, videos & stories', icon: 'image-multiple-outline', standard: false },
  { label: 'Receive bookings & payments in-app', icon: 'cash-check', standard: false },
  { label: 'Verified badge', icon: 'check-decagram', standard: false },
  { label: 'Booking fee & availability management', icon: 'calendar-clock', standard: false },
  { label: 'Live streaming', icon: 'broadcast', standard: false },
  { label: 'Analytics', icon: 'chart-line', standard: false },
];

const PLAN_NAME = { free: 'Standard', monthly: 'Pro · monthly', yearly: 'Pro · yearly' } as const;

const priceLabel = (b: Billing) => (b === 'monthly' ? `${euro(MONTHLY, true)}/month` : `${euro(YEARLY)}/year`);

function longDate(d: Date) {
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

function Mark({ on, label }: { on: boolean; label: string }) {
  return (
    <View accessibilityLabel={`${label}: ${on ? 'included' : 'not included'}`} style={{ width: 64, alignItems: 'center' }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.successBg : colors.chipIdle }}>
        <Icon name={on ? 'check' : 'close'} size={16} color={on ? colors.success : colors.disabled} />
      </View>
    </View>
  );
}

export default function Subscription() {
  const plan = useApp((s) => s.plan);
  const setPlan = useApp((s) => s.setPlan);
  const user = useApp((s) => s.user);
  // Pro tools need an approved professional workspace that is in use; the plan alone never unlocks them.
  const proActive = canPostToFeed(user);
  const hasProRole = user.approvedRoles.some((r) => r !== 'fan');
  const app = user.application;
  const methods = useApp((s) => s.paymentMethods);
  const selectedPayment = useApp((s) => s.selectedPayment);
  const [billing, setBilling] = useState<Billing>(plan === 'yearly' ? 'yearly' : 'monthly');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const subscribed = plan !== 'free';
  const onSelected = subscribed && plan === billing;
  const method = methods.find((m) => m.id === selectedPayment);
  // Demo: the first month is free, so the first charge (and renewal) is one month from today.
  const renewal = new Date(TODAY);
  renewal.setMonth(renewal.getMonth() + 1);

  const start = () => {
    setPlan(billing);
    toast(`Pro started. Your free month runs until ${longDate(renewal)}.`);
  };

  const switchPlan = () => {
    setPlan(billing);
    toast(`Switched to Pro ${billing}: ${priceLabel(billing)}`);
  };

  const cancelActions: SheetAction[] = [
    {
      label: 'Cancel Pro plan',
      icon: 'close-circle-outline',
      destructive: true,
      onPress: () => {
        setPlan('free');
        setBilling('monthly');
        toast('Pro plan cancelled. You’re on Standard now.');
      },
    },
    ...(plan === 'monthly'
      ? [{ label: `Switch to yearly and save ${euro(SAVING, true)}`, icon: 'swap-horizontal' as const, onPress: () => { setPlan('yearly'); setBilling('yearly'); toast(`Switched to Pro yearly: ${priceLabel('yearly')}`); } }]
      : []),
  ];

  const footer = !subscribed ? (
    <BottomBar>
      <Button title="Start free month" icon="crown-outline" onPress={start} />
      <T v="small" center style={{ marginTop: 6 }}>Then {priceLabel(billing)} · cancel anytime</T>
    </BottomBar>
  ) : !onSelected ? (
    <BottomBar>
      <Button title={`Switch plan to ${billing}`} icon="swap-horizontal" onPress={switchPlan} />
      <T v="small" center style={{ marginTop: 6 }}>{billing === 'yearly' ? `Save ${euro(SAVING, true)} a year` : `${priceLabel('monthly')} from ${longDate(renewal)}`}</T>
    </BottomBar>
  ) : (
    <BottomBar>
      {proActive ? (
        <Button title="Open Pro workspace" icon="view-grid-outline" onPress={() => router.push('/pro/workspace')} />
      ) : hasProRole ? (
        <Button title="Switch to your professional workspace" icon="swap-horizontal" onPress={() => router.push('/workspace')} />
      ) : app ? (
        <Button title="Check application status" icon="file-document-outline" onPress={() => router.push('/application')} />
      ) : (
        <Button title="Apply for a professional account" icon="check-decagram" onPress={() => router.push('/apply')} />
      )}
    </BottomBar>
  );

  return (
    <Screen header={<ScreenHeader title="Domtak plans" />} footer={footer}>
      <View style={{ backgroundColor: colors.brandDeep, borderRadius: radius.xl, padding: 20, gap: 12 }}>
        <Row justify="space-between" align="flex-start">
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="crown" size={28} color={colors.brandDark} />
          </View>
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: subscribed ? colors.gold : 'rgba(255,255,255,0.14)' }}>
            <T v="smallBold" color={subscribed ? colors.brandDark : colors.white}>{subscribed ? `Current: ${PLAN_NAME[plan]}` : 'Current: Standard'}</T>
          </View>
        </Row>
        <View style={{ gap: 4 }}>
          <T v="h2" color={colors.white}>Domtak Pro</T>
          <T v="body" color={colors.lilacLight}>For musicians, DJs, venues and organizers: get booked, get paid and grow your audience.</T>
        </View>
        <Row gap={6} align="flex-end">
          <T v="h1" color={colors.white}>{billing === 'monthly' ? euro(MONTHLY, true) : euro(YEARLY)}</T>
          <T v="body" color={colors.lilacLight} style={{ marginBottom: 4 }}>{billing === 'monthly' ? '/ month' : '/ year'}</T>
        </Row>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Row gap={6} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(242,182,50,0.2)' }}>
            <Icon name="gift-outline" size={14} color={colors.gold} />
            <T v="smallBold" color={colors.gold}>First month free</T>
          </Row>
          {billing === 'yearly' ? (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)' }}>
              <T v="smallBold" color={colors.white}>Just {euro(YEARLY / 12, true)} a month</T>
            </View>
          ) : null}
        </Row>
      </View>

      <View style={{ gap: 8 }}>
        <Segmented
          options={[
            { key: 'monthly', label: 'Monthly' },
            { key: 'yearly', label: `Yearly · save ${SAVING_PCT}%` },
          ]}
          value={billing}
          onChange={setBilling}
        />
        <T v="small" center>
          {billing === 'yearly'
            ? `${euro(YEARLY)} billed once a year: you save ${euro(SAVING, true)} compared to monthly.`
            : `${euro(MONTHLY, true)} billed every month. Go yearly and save ${euro(SAVING, true)}.`}
        </T>
      </View>

      {subscribed ? (
        <Card style={{ gap: 12 }}>
          <Row justify="space-between">
            <T v="title">Your subscription</T>
            <Pill label="Free month" tone="success" icon="gift-outline" />
          </Row>
          <View style={{ gap: 2 }}>
            <Row justify="space-between" style={{ paddingVertical: 4 }}>
              <T v="body" color={colors.muted}>Plan</T>
              <T v="bodyBold">{PLAN_NAME[plan]}</T>
            </Row>
            <Row justify="space-between" style={{ paddingVertical: 4 }}>
              <T v="body" color={colors.muted}>Renews on</T>
              <T v="bodyBold">{longDate(renewal)}</T>
            </Row>
            <Row justify="space-between" style={{ paddingVertical: 4 }}>
              <T v="body" color={colors.muted}>Then</T>
              <T v="bodyBold">{priceLabel(plan)}</T>
            </Row>
            <Row justify="space-between" style={{ paddingVertical: 4 }}>
              <T v="body" color={colors.muted}>Billed to</T>
              <Pressable accessibilityRole="button" accessibilityLabel={`Billed to ${method?.label ?? 'no payment method'}. Change payment method`} onPress={() => router.push('/payment-methods')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
                <T v="bodyBold" color={colors.brand}>{method?.label ?? 'Add a card'}</T>
                <Icon name="chevron-right" size={18} color={colors.brand} />
              </Pressable>
            </Row>
          </View>
          <Divider />
          <T v="small">Cancel before {longDate(renewal)} and you won’t be charged. Cancelling moves you back to Standard right away.</T>
          <Button title="Cancel plan" variant="ghost" size="md" icon="close-circle-outline" onPress={() => setConfirmCancel(true)} style={{ alignSelf: 'flex-start', paddingHorizontal: 8 }} />
        </Card>
      ) : null}

      {!proActive ? (
        <Banner icon="check-decagram">
          {hasProRole
            ? 'Switch to your professional workspace to use Pro tools.'
            : app?.status === 'pending'
              ? 'Your professional application is in review. Pro tools unlock once it’s approved.'
              : app?.status === 'info'
                ? 'Your professional application needs more information. Pro tools unlock once it’s approved.'
                : 'Pro tools are for approved artists, venues and organizers. The plan adds tools; access itself needs an approved professional application.'}
        </Banner>
      ) : null}

      <View style={{ gap: 10 }}>
        <T v="h3">Standard vs Pro</T>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow(1) }}>
          <Row gap={0} style={{ paddingLeft: 16, minHeight: 60 }}>
            <T v="caption" style={{ flex: 1 }}>FEATURES</T>
            <View style={{ width: 64, alignItems: 'center' }}>
              <T v="smallBold">Standard</T>
              <T v="small" style={{ fontSize: 11 }}>Free</T>
            </View>
            <View style={{ width: 64, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }}>
              <T v="smallBold" color={colors.white}>Pro</T>
              <T v="small" color={colors.lilacLight} style={{ fontSize: 11 }}>{billing === 'monthly' ? euro(MONTHLY, true) : euro(YEARLY)}</T>
            </View>
          </Row>
          {FEATURES.map((f) => (
            <Row key={f.label} gap={0} accessibilityLabel={`${f.label}. Standard: ${f.standard ? 'included' : 'not included'}. Pro: included.`} style={{ paddingLeft: 16, minHeight: 52, borderTopWidth: 1, borderTopColor: colors.divider }}>
              <Row gap={10} style={{ flex: 1, paddingVertical: 8, paddingRight: 8 }}>
                <Icon name={f.icon} size={20} color={f.standard ? colors.muted : colors.brand} />
                <T v={f.standard ? 'body' : 'bodyBold'} style={{ flex: 1 }}>{f.label}</T>
              </Row>
              <Mark on={f.standard} label="Standard" />
              <View style={{ alignSelf: 'stretch', justifyContent: 'center', backgroundColor: colors.brandTint }}>
                <Mark on label="Pro" />
              </View>
            </Row>
          ))}
        </View>
      </View>

      <Banner icon="shield-check-outline">Payments are handled securely by our payment provider. Cancel anytime in Settings → Subscription.</Banner>

      <ActionSheet
        visible={confirmCancel}
        title="Cancel Domtak Pro? Uploads, live streaming, analytics and in-app payouts stop right away."
        actions={cancelActions}
        cancelLabel="Keep Pro"
        onClose={() => setConfirmCancel(false)}
      />
    </Screen>
  );
}
