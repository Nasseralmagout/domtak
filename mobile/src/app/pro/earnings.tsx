import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen, ScreenHeader } from '../../components/layout';
import { Button, Card, Divider, Icon, type IconName, KeyValue, Pill, Row, SectionTitle, Segmented, T } from '../../components/ui';
import { analytics, transactions, type Transaction } from '../../data/mock';
import type { IncomingRequest } from '../../data/types';
import { euro, isoDay, shortDate, TODAY } from '../../lib/format';
import { toast } from '../../store/toast';
import { type Payout, useApp } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

type Tab = 'earnings' | 'insights';
type MetricKey = 'views' | 'followers' | 'requests' | 'tickets';

const num = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
const money = (n: number) => euro(Math.abs(n), !Number.isInteger(n));

/** ISO days for the 14 analytics points, oldest first, ending on TODAY. */
const DAYS = analytics.profileViews.map((_, i, all) => isoDay(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - (all.length - 1 - i), 12)));

const TX_STATUS: Record<Transaction['status'], { label: string; tone: 'success' | 'warning' | 'neutral' | 'brand'; icon: IconName }> = {
  escrow: { label: 'In escrow', tone: 'warning', icon: 'lock-clock' },
  available: { label: 'Available', tone: 'success', icon: 'arrow-down-bold-circle-outline' },
  'paid out': { label: 'Paid out', tone: 'neutral', icon: 'bank-transfer-out' },
  fee: { label: 'Fee', tone: 'neutral', icon: 'receipt-text-outline' },
};

const PAYOUT_STATUS: Record<Payout['status'], { label: string; tone: 'success' | 'warning' }> = {
  paid: { label: 'Paid', tone: 'success' },
  processing: { label: 'Processing', tone: 'warning' },
};

const KNOWN_TITLES = new Set(transactions.map((t) => t.title));

/**
 * Mock transactions plus an escrow row for every accepted request that has none yet
 * (offer minus the 10% Domtak fee), so a gig accepted in Requests shows up here the
 * same way it does in the workspace escrow total. Once the balance has been paid out,
 * "available" income is shown as paid out.
 */
function ledger(requests: IncomingRequest[], balance: number): Transaction[] {
  const accepted: Transaction[] = requests
    .filter((r) => r.status === 'accepted' && !KNOWN_TITLES.has(r.title))
    .map((r) => ({ id: `req_${r.id}`, title: r.title, sub: `${r.requester} · booking`, amount: Math.round(r.offer * 0.9), date: isoDay(TODAY), status: 'escrow' }));
  return [...accepted, ...transactions]
    .map((t) => (t.status === 'available' && balance <= 0 ? { ...t, status: 'paid out' as const } : t))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Change of the last 7 days against the 7 days before, in percent (undefined when there is no baseline). */
function weekDelta(series: number[]) {
  const last = sum(series.slice(-7));
  const prev = sum(series.slice(-14, -7));
  if (prev === 0) return undefined;
  return Math.round(((last - prev) / prev) * 100);
}

function DeltaPill({ delta }: { delta?: number }) {
  if (delta === undefined) return <Pill label="New" tone="brand" />;
  const up = delta >= 0;
  return <Pill label={`${up ? '+' : '−'}${Math.abs(delta)}% vs last week`} tone={up ? 'success' : 'danger'} icon={up ? 'trending-up' : 'trending-down'} />;
}

function BarChart({ data, title }: { data: number[]; title: string }) {
  const max = Math.max(1, ...data);
  const plot = 132;
  const lastIdx = data.length - 1;
  const summary = data.map((v, i) => `${shortDate(DAYS[i])} ${v}`).join(', ');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${title}, last 14 days. ${summary}. Today ${data[lastIdx]}.`}>
      <View style={{ height: plot + 20, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {data.map((v, i) => {
          const last = i === lastIdx;
          return (
            <View key={DAYS[i]} style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
              {last ? <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, marginBottom: 4 }}>{num(v)}</Text> : null}
              <View style={{ width: '100%', maxWidth: 18, height: Math.max(3, (v / max) * plot), borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: last ? colors.brand : v === 0 ? colors.track : colors.lilac }} />
            </View>
          );
        })}
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={{ flexDirection: 'row', gap: 2, marginTop: 6 }}>
        {DAYS.map((d, i) => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontFamily: i === lastIdx ? fonts.bodyBold : fonts.body, fontSize: 11, color: i === lastIdx ? colors.ink : colors.muted }}>
            {(lastIdx - i) % 2 === 0 ? Number(d.slice(8)) : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={{ flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, gap: 2, ...shadow(1) }}>
      <T v="small" style={{ fontSize: 12 }}>{label}</T>
      <T v="h3">{value}</T>
      <T v="small" style={{ fontSize: 12 }}>{sub}</T>
    </View>
  );
}

function EarningsTab() {
  const balance = useApp((s) => s.balance);
  const payouts = useApp((s) => s.payouts);
  const methods = useApp((s) => s.paymentMethods);
  const requestPayout = useApp((s) => s.requestPayout);
  const requests = useApp((s) => s.requests);

  const account = methods.find((m) => m.badge === 'SEPA')?.sub ?? 'your bank account';
  const txs = ledger(requests, balance);
  const escrow = sum(txs.filter((t) => t.status === 'escrow').map((t) => t.amount));
  const paidOut = sum(payouts.map((p) => p.amount));

  const payout = () => {
    const amount = requestPayout();
    toast(amount > 0 ? `${euro(amount)} payout on its way to ${account}` : 'Nothing to pay out yet');
  };

  return (
    <>
      <View style={{ padding: 18, borderRadius: radius.xl, backgroundColor: colors.brandDeep, gap: 12, ...shadow(2) }}>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <T v="small" color={colors.lilacLight}>Available balance</T>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 42, color: colors.white }}>{euro(balance)}</Text>
          </View>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="wallet-outline" size={22} color={colors.gold} />
          </View>
        </Row>
        <T v="small" color={colors.lilacLight}>
          {balance > 0 ? `To ${account} · arrives in 1–2 business days` : 'All caught up. New earnings land here 24 h after each gig.'}
        </T>
        <Button title={balance > 0 ? `Pay out ${euro(balance)}` : 'Pay out'} icon="bank-transfer-out" variant="light" size="md" disabled={balance <= 0} onPress={payout} />
      </View>

      <Row gap={10} align="stretch">
        <StatTile label="Held in escrow" value={euro(escrow)} sub="Released 24 h after the gig" />
        <StatTile label="Paid out" value={euro(paidOut)} sub={`${payouts.length} ${payouts.length === 1 ? 'payout' : 'payouts'}`} />
      </Row>

      <Card
        padded={false}
        onPress={() => router.push('/payment-methods')}
        accessibilityLabel={`Payout account, SEPA, ${account}. Manage payment methods`}
        style={{ paddingHorizontal: 16, minHeight: 64, justifyContent: 'center' }}
      >
        <Row gap={12}>
          <Icon name="bank-outline" size={22} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <T v="bodyBold">Payout account</T>
            <T v="small">SEPA · {account}</T>
          </View>
          <T v="smallBold" color={colors.brand}>Manage</T>
          <Icon name="chevron-right" size={20} color={colors.subtle} />
        </Row>
      </Card>

      <View>
        <SectionTitle title="Transactions" />
        <Card padded={false}>
          {txs.map((t, i) => {
            const st = TX_STATUS[t.status];
            const income = t.amount > 0;
            return (
              <View key={t.id}>
                {i > 0 ? <Divider style={{ marginLeft: 68 }} /> : null}
                <Row
                  gap={12}
                  style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                  accessibilityLabel={`${t.title}, ${t.sub}, ${shortDate(t.date)}, ${income ? 'plus' : 'minus'} ${money(t.amount)}, ${st.label}`}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: income ? colors.brandSoft : colors.chipIdle, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={st.icon} size={20} color={income ? colors.brand : colors.label} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyBold" numberOfLines={1}>{t.title}</T>
                    <T v="small" numberOfLines={1}>{t.sub} · {shortDate(t.date)}</T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <T v="bodyBold" color={income ? colors.success : colors.ink}>{income ? '+' : '−'}{money(t.amount)}</T>
                    <Pill label={st.label} tone={st.tone} />
                  </View>
                </Row>
              </View>
            );
          })}
        </Card>
      </View>

      <View>
        <SectionTitle title="Payout history" />
        <Card padded={false}>
          {payouts.length === 0 ? (
            <View style={{ padding: 16 }}>
              <T v="small">No payouts yet. Your first payout appears here once you transfer your balance.</T>
            </View>
          ) : (
            payouts.map((p, i) => {
              const st = PAYOUT_STATUS[p.status];
              return (
                <View key={p.id}>
                  {i > 0 ? <Divider style={{ marginLeft: 68 }} /> : null}
                  <Row gap={12} style={{ paddingHorizontal: 16, paddingVertical: 12 }} accessibilityLabel={`Payout of ${euro(p.amount)} on ${shortDate(p.date)}, ${st.label}`}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.chipIdle, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="bank-transfer-out" size={20} color={colors.label} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="bodyBold">{euro(p.amount)}</T>
                      <T v="small">{shortDate(p.date)} · to {account}</T>
                    </View>
                    <Pill label={st.label} tone={st.tone} />
                  </Row>
                </View>
              );
            })
          )}
        </Card>
      </View>
    </>
  );
}

function InsightsTab() {
  const role = useApp((s) => s.user.role);
  const metrics: { key: MetricKey; label: string; icon: IconName; series: number[] }[] = [
    { key: 'views', label: 'Profile views', icon: 'eye-outline', series: analytics.profileViews },
    { key: 'followers', label: 'Followers gained', icon: 'account-plus-outline', series: analytics.followersGained },
    { key: 'requests', label: 'Booking requests', icon: 'inbox-arrow-down', series: analytics.bookingRequests },
    ...(role === 'organizer' ? [{ key: 'tickets' as const, label: 'Ticket sales', icon: 'ticket-confirmation-outline' as const, series: analytics.ticketSales }] : []),
  ];
  const [selected, setSelected] = useState<MetricKey>('views');
  const [showTable, setShowTable] = useState(false);
  const metric = metrics.find((m) => m.key === selected) ?? metrics[0];
  const range = `${shortDate(DAYS[0]).slice(4)} – ${shortDate(DAYS[DAYS.length - 1]).slice(4)}`;

  const cta =
    role === 'organizer'
      ? { title: 'Turn views into tickets', body: 'Publish your next night while interest is high.', action: 'New event', href: '/create-event' }
      : role === 'venue'
        ? { title: 'Fresh photos get more requests', body: 'Keep your venue listing and prices up to date.', action: 'My venue', href: '/pro/venue-listing' }
        : { title: 'Be easy to book', body: 'Open days and a clear fee turn profile views into requests.', action: 'Availability', href: '/pro/availability' };

  return (
    <>
      <Row justify="space-between">
        <T v="h3">Last 14 days</T>
        <T v="small">{range}</T>
      </Row>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {metrics.map((m) => {
          const on = m.key === metric.key;
          const total = sum(m.series);
          const delta = weekDelta(m.series);
          return (
            <Pressable
              key={m.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${m.label}, ${num(total)}${delta === undefined ? '' : `, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)} percent versus last week`}. Show chart`}
              onPress={() => setSelected(m.key)}
              style={({ pressed }) => ({
                flexBasis: '46%',
                flexGrow: 1,
                padding: 14,
                gap: 6,
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: on ? colors.brand : 'transparent',
                opacity: pressed ? 0.9 : 1,
                ...shadow(1),
              })}
            >
              <Row gap={6}>
                <Icon name={m.icon} size={18} color={colors.brand} />
                <T v="small" style={{ fontSize: 12, flex: 1 }} numberOfLines={1}>{m.label}</T>
              </Row>
              <T v="h2">{num(total)}</T>
              <DeltaPill delta={delta} />
            </Pressable>
          );
        })}
      </View>

      <Card style={{ gap: 14 }}>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <T v="title">{metric.label} per day</T>
            <T v="small">Today {num(metric.series[metric.series.length - 1])} · peak {num(Math.max(...metric.series))}</T>
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showTable }} onPress={() => setShowTable((v) => !v)} hitSlop={10} style={{ minHeight: 32, justifyContent: 'center' }}>
            <T v="smallBold" color={colors.brand}>{showTable ? 'Hide values' : 'Show values'}</T>
          </Pressable>
        </Row>
        <BarChart data={metric.series} title={metric.label} />
        {showTable ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 }}>
            {[...DAYS].reverse().map((d, ri) => (
              <KeyValue key={d} k={shortDate(d)} v={num(metric.series[metric.series.length - 1 - ri])} />
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: 14 }}>
        <View>
          <T v="title">Where people find you</T>
          <T v="small">Share of profile views by source</T>
        </View>
        {analytics.topSources.map((s) => (
          <View key={s.label} accessible accessibilityLabel={`${s.label}, ${s.share} percent`} style={{ gap: 6 }}>
            <Row justify="space-between">
              <T v="smallBold">{s.label}</T>
              <T v="smallBold" color={colors.muted}>{s.share}%</T>
            </Row>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.brandSoft, overflow: 'hidden' }}>
              <View style={{ width: `${s.share}%`, height: '100%', borderRadius: 5, backgroundColor: colors.brand }} />
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 10, backgroundColor: colors.brandTint }}>
        <T v="title">{cta.title}</T>
        <T v="small" color={colors.inkSoft}>{cta.body}</T>
        <Button title={cta.action} size="md" variant="secondary" icon="arrow-right" onPress={() => router.push(cta.href as never)} style={{ alignSelf: 'flex-start' }} />
      </Card>
    </>
  );
}

export default function Earnings() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'insights' ? 'insights' : 'earnings');

  return (
    <Screen header={<ScreenHeader title={tab === 'insights' ? 'Insights' : 'Earnings'} subtitle="Domtak Pro" />}>
      <Segmented
        dark
        options={[
          { key: 'earnings', label: 'Earnings' },
          { key: 'insights', label: 'Insights' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'earnings' ? <EarningsTab /> : <InsightsTab />}
    </Screen>
  );
}
