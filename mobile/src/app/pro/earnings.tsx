import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../../components/layout';
import { Button, Card, Divider, Icon, type IconName, KeyValue, Pill, Row, SectionTitle, Segmented, T } from '../../components/ui';
import { analytics, transactions, type Transaction } from '../../data/mock';
import type { IncomingRequest } from '../../data/types';
import { euro, isoDay, parse, shortDate, TODAY } from '../../lib/format';
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

/** A ledger row: a mock transaction, an accepted gig in escrow, or a payout you requested (processing). */
type LedgerRow = Omit<Transaction, 'status'> & { status: Transaction['status'] | 'processing' };

const TX_STATUS: Record<LedgerRow['status'], { label: string; tone: 'success' | 'warning' | 'neutral' | 'brand'; icon: IconName }> = {
  escrow: { label: 'In escrow', tone: 'warning', icon: 'lock-clock' },
  available: { label: 'Available', tone: 'success', icon: 'arrow-down-bold-circle-outline' },
  'paid out': { label: 'Paid out', tone: 'neutral', icon: 'bank-transfer-out' },
  fee: { label: 'Fee', tone: 'neutral', icon: 'receipt-text-outline' },
  processing: { label: 'Processing', tone: 'warning', icon: 'bank-transfer-out' },
};

const PAYOUT_STATUS: Record<Payout['status'], { label: string; tone: 'success' | 'warning' }> = {
  paid: { label: 'Paid', tone: 'success' },
  processing: { label: 'Processing', tone: 'warning' },
};

const KNOWN_TITLES = new Set(transactions.map((t) => t.title));
/** Seed payouts ("po1"…) are already in the mock history; payouts requested in the app get ids like "po_…". */
const isSeedPayout = (p: Payout) => /^po\d+$/.test(p.id);

/** The day a transfer requested on `from` arrives: `n` business days later (demo clock, never the device clock). */
function businessDaysAfter(from: Date, n: number) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  for (let left = n; left > 0; ) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return isoDay(d);
}
const arrivesBy = (iso: string) => shortDate(businessDaysAfter(parse(iso), 2));

/** "DE•• •••• 0391" -> "Payout to IBAN ••0391" (same wording as the mock history). */
const payoutTitle = (account: string) => {
  const tail = /(\d{4})\s*$/.exec(account)?.[1];
  return tail ? `Payout to IBAN ••${tail}` : 'Payout to your bank';
};

/**
 * Mock transactions plus an escrow row for every accepted request that has none yet
 * (offer minus the 10% Domtak fee, same as the workspace escrow total) and a row for each
 * payout you requested. "Available" rows add up to the balance; once it has been paid out,
 * they show as paid out.
 */
function ledger(requests: IncomingRequest[], balance: number, payouts: Payout[], account: string): LedgerRow[] {
  const accepted: LedgerRow[] = requests
    .filter((r) => r.status === 'accepted' && !KNOWN_TITLES.has(r.title))
    .map((r) => ({ id: `req_${r.id}`, title: r.title, sub: `${r.requester} · booking`, amount: Math.round(r.offer * 0.9), date: isoDay(TODAY), status: 'escrow' }));
  const requested: LedgerRow[] = payouts
    .filter((p) => !isSeedPayout(p))
    .map((p) => ({ id: `pay_${p.id}`, title: payoutTitle(account), sub: 'Bank transfer', amount: -p.amount, date: p.date, status: p.status === 'processing' ? 'processing' : 'paid out' }));
  return [...accepted, ...requested, ...transactions]
    .map((t): LedgerRow => (t.status === 'available' && balance <= 0 ? { ...t, status: 'paid out' } : t))
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
  const txs = ledger(requests, balance, payouts, account);
  const escrow = sum(txs.filter((t) => t.status === 'escrow').map((t) => t.amount));
  const available = txs.filter((t) => t.status === 'available');
  const paidOut = sum(payouts.filter((p) => p.status === 'paid').map((p) => p.amount));
  const processing = payouts.filter((p) => p.status === 'processing');
  const processingTotal = sum(processing.map((p) => p.amount));
  const today = isoDay(TODAY);

  const payout = () => {
    const amount = requestPayout();
    toast(amount > 0 ? `${euro(amount)} payout on its way to ${account}, arrives by ${arrivesBy(today)}` : 'Nothing to pay out yet');
  };
  const gigs = available.length === 1 ? '1 completed gig' : `${available.length} completed gigs`;

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
          {balance > 0
            ? `${available.length && sum(available.map((t) => t.amount)) === balance ? `From ${gigs}. ` : ''}Pay out to ${account} and it arrives by ${arrivesBy(today)}.`
            : processing.length
              ? `${euro(processingTotal)} is on its way to ${account} and arrives by ${arrivesBy(processing[0].date)}. New earnings land here 24 h after each gig.`
              : 'All caught up. New earnings land here 24 h after each gig.'}
        </T>
        <Button title={balance > 0 ? `Pay out ${euro(balance)}` : 'Pay out'} icon="bank-transfer-out" variant="light" size="md" disabled={balance <= 0} onPress={payout} />
      </View>

      <Row gap={10} align="stretch">
        <StatTile label="Held in escrow" value={euro(escrow)} sub="Released 24 h after the gig" />
        <StatTile
          label="Paid out"
          value={euro(paidOut)}
          sub={processing.length ? `${euro(processingTotal)} processing` : `${payouts.length} ${payouts.length === 1 ? 'payout' : 'payouts'}`}
        />
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
                  <Row
                    gap={12}
                    style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                    accessibilityLabel={`Payout of ${euro(p.amount)} on ${shortDate(p.date)}, ${st.label}${p.status === 'processing' ? `, arrives by ${arrivesBy(p.date)}` : ''}`}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.chipIdle, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="bank-transfer-out" size={20} color={colors.label} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="bodyBold">{euro(p.amount)}</T>
                      <T v="small">{p.status === 'processing' ? `${shortDate(p.date)} · arrives by ${arrivesBy(p.date)}` : `${shortDate(p.date)} · to ${account}`}</T>
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
    <Screen header={<ScreenHeader title={tab === 'insights' ? 'Insights' : 'Earnings'} subtitle="Domtak Pro" onBack={() => goBack('/pro/workspace')} />}>
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
