import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { goBack, PermissionNotice, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Divider, Icon, type IconName, KeyValue, Pill, Row, SectionTitle, Segmented, T } from '../../components/ui';
import { analytics, transactions } from '../../data/mock';
import type { IncomingRequest } from '../../data/types';
import { euro, isoDay, parse, plural, shortDate, TODAY } from '../../lib/format';
import { PLATFORM_COMMISSION_RATE } from '../../lib/pricing';
import { toast } from '../../store/toast';
import { activeWorkspace, type Payout, useApp } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

type Tab = 'earnings' | 'insights';
type MetricKey = 'views' | 'followers' | 'requests' | 'tickets';

const num = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
const money = (n: number) => euro(Math.abs(n), !Number.isInteger(n));

/** ISO days for the 14 analytics points, oldest first, ending on TODAY. */
const DAYS = analytics.profileViews.map((_, i, all) => isoDay(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - (all.length - 1 - i), 12)));

type RowStatus = 'awaiting' | 'pending' | 'available' | 'paid out' | 'processing' | 'fee' | 'refund';

/** One line of the earnings ledger. Booking rows carry gross, commission and net separately. */
interface LedgerRow {
  id: string;
  title: string;
  sub: string;
  date: string;
  kind: 'booking' | 'payout' | 'fee' | 'refund';
  /** What you receive (negative for payouts, fees and refunds). */
  net: number;
  gross?: number;
  commission?: number;
  status: RowStatus;
  /** The request behind a booking row, for the settlement detail. */
  requestId?: string;
}

const TX_STATUS: Record<RowStatus, { label: string; tone: 'success' | 'warning' | 'neutral' | 'brand' | 'danger'; icon: IconName }> = {
  awaiting: { label: 'Awaiting payment', tone: 'brand', icon: 'credit-card-clock-outline' },
  pending: { label: 'Payout pending', tone: 'warning', icon: 'timer-sand' },
  available: { label: 'Available', tone: 'success', icon: 'arrow-down-bold-circle-outline' },
  'paid out': { label: 'Paid out', tone: 'neutral', icon: 'bank-transfer-out' },
  processing: { label: 'Processing', tone: 'warning', icon: 'bank-transfer-out' },
  fee: { label: 'Subscription', tone: 'neutral', icon: 'receipt-text-outline' },
  refund: { label: 'Refund', tone: 'danger', icon: 'cash-refund' },
};

const PAYOUT_STATUS: Record<Payout['status'], { label: string; tone: 'success' | 'warning' }> = {
  paid: { label: 'Paid', tone: 'success' },
  processing: { label: 'Processing', tone: 'warning' },
};

const KNOWN_TITLES = new Set(transactions.map((t) => t.title));
/** Seed payouts ("po1"…) are already in the mock history; payouts requested in the app get ids like "po_…". */
const isSeedPayout = (p: Payout) => /^po\d+$/.test(p.id);
const round2 = (n: number) => Math.round(n * 100) / 100;
/** Gross from a net amount recorded after the platform commission. */
const grossOf = (net: number) => Math.round(net / (1 - PLATFORM_COMMISSION_RATE));

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
 * Settlement ledger: recorded transactions plus every request that isn't in them yet.
 * Accepted requests without a verified payment are listed as "Awaiting payment" and never counted.
 * "Available" rows add up to the balance; once it has been paid out they show as paid out.
 * `withHistory` = false leaves out the recorded history, balance payouts and fees (they belong to the artist workspace).
 */
function ledger(requests: IncomingRequest[], balance: number, payouts: Payout[], account: string, withHistory: boolean): LedgerRow[] {
  const byTitle = (title: string) => requests.find((r) => r.title === title)?.id;
  const recorded: LedgerRow[] = (withHistory ? transactions : []).map((t) => {
    if (t.status === 'fee') return { id: t.id, title: t.title, sub: t.sub, date: t.date, kind: 'fee', net: t.amount, status: 'fee' };
    if (t.amount < 0) return { id: t.id, title: t.title, sub: t.sub, date: t.date, kind: 'payout', net: t.amount, status: 'paid out' };
    const gross = grossOf(t.amount);
    const status: RowStatus = t.status === 'escrow' ? 'pending' : t.status === 'available' ? (balance > 0 ? 'available' : 'paid out') : 'paid out';
    return { id: t.id, title: t.title, sub: t.sub, date: t.date, kind: 'booking', net: t.amount, gross, commission: round2(gross - t.amount), status, requestId: byTitle(t.title) };
  });
  const fromRequests: LedgerRow[] = requests
    .filter((r) => !(withHistory && KNOWN_TITLES.has(r.title)) && (r.status === 'accepted' || r.status === 'past' || r.payment === 'refund_pending' || r.payment === 'refunded'))
    .map((r): LedgerRow => {
      const gross = r.pricing === 'quote' && r.quote ? r.quote.total : r.offer;
      const commission = round2(gross * PLATFORM_COMMISSION_RATE);
      const base = { id: `req_${r.id}`, title: r.title, date: r.isoDate ?? isoDay(TODAY), requestId: r.id, gross, commission };
      if (r.payment === 'refund_pending' || r.payment === 'refunded') return { ...base, sub: `${r.requester} · ${r.payment === 'refunded' ? 'refunded' : 'refund pending'}`, kind: 'refund', net: -round2(gross - commission), status: 'refund' };
      const verified = r.payment === 'paid' || r.payment === 'payout_pending' || r.payment === 'paid_out';
      if (!verified) return { ...base, sub: `${r.requester} · ${r.payment === 'failed' ? 'customer payment failed' : 'not yet verified'}`, kind: 'booking', net: round2(gross - commission), status: 'awaiting' };
      return { ...base, sub: `${r.requester} · booking`, kind: 'booking', net: round2(gross - commission), status: r.payment === 'paid_out' ? 'paid out' : 'pending' };
    });
  const requested: LedgerRow[] = (withHistory ? payouts : [])
    .filter((p) => !isSeedPayout(p))
    .map((p) => ({ id: `pay_${p.id}`, title: payoutTitle(account), sub: 'Bank transfer', date: p.date, kind: 'payout', net: -p.amount, status: p.status === 'processing' ? 'processing' : 'paid out' }));
  return [...fromRequests, ...requested, ...recorded].sort((a, b) => b.date.localeCompare(a.date));
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

function StatusTile({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: IconName }) {
  return (
    <View style={{ flexBasis: '46%', flexGrow: 1, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, gap: 2, ...shadow(1) }}>
      <Row gap={6}>
        <Icon name={icon} size={16} color={colors.brand} />
        <T v="small" style={{ fontSize: 12, flex: 1 }} numberOfLines={1}>{label}</T>
      </Row>
      <T v="h3">{value}</T>
      <T v="small" style={{ fontSize: 12 }}>{sub}</T>
    </View>
  );
}

function EarningsTab() {
  const user = useApp((s) => s.user);
  const balance = useApp((s) => s.balance);
  const payouts = useApp((s) => s.payouts);
  const methods = useApp((s) => s.paymentMethods);
  const requestPayout = useApp((s) => s.requestPayout);
  const requests = useApp((s) => s.requests);
  const openCase = useApp((s) => s.openCase);

  const workspace = activeWorkspace(user);
  if (workspace === 'fan') {
    return <PermissionNotice role={user.role === 'fan' ? 'musician' : user.role} action="see booking earnings and payouts" />;
  }

  // Same split as the workspace dashboards: the artist workspace owns the recorded history, balance and payouts;
  // the venue workspace counts venue-hire requests only; an organizer pays providers and earns nothing here.
  const withHistory = workspace === 'musician';
  const mine = requests.filter((r) => (workspace === 'venue' ? r.kind === 'venue' : workspace === 'musician' ? r.kind !== 'venue' : false));
  const available = withHistory ? balance : 0;
  const myPayouts = withHistory ? payouts : [];
  const sepa = methods.find((m) => m.badge === 'SEPA');
  const account = sepa?.sub ?? 'your bank account';
  const txs = ledger(mine, balance, payouts, account, withHistory);
  const counted = txs.filter((t) => t.kind === 'booking' && t.status !== 'awaiting');
  const refundRows = txs.filter((t) => t.kind === 'refund');
  // A refunded booking counts in gross and commission once, and its reversed net amount shows under refunds, so it nets to zero.
  const gross = sum([...counted, ...refundRows].map((t) => t.gross ?? 0));
  const commission = sum([...counted, ...refundRows].map((t) => t.commission ?? 0));
  const refunds = -sum(refundRows.map((t) => t.net));
  const net = gross - commission - refunds;
  const awaiting = txs.filter((t) => t.status === 'awaiting');
  const pending = sum(txs.filter((t) => t.kind === 'booking' && t.status === 'pending').map((t) => t.net));
  const paidOut = sum(myPayouts.filter((p) => p.status === 'paid').map((p) => p.amount));
  const processing = myPayouts.filter((p) => p.status === 'processing');
  const processingTotal = sum(processing.map((p) => p.amount));
  const subscriptions = -sum(txs.filter((t) => t.kind === 'fee').map((t) => t.net));
  const today = isoDay(TODAY);
  const pct = `${Math.round(PLATFORM_COMMISSION_RATE * 100)}%`;

  const payout = () => {
    if (!sepa) {
      router.push('/payment-methods?iban=1');
      return;
    }
    if (available <= 0) return;
    const amount = requestPayout();
    toast(amount > 0 ? `${euro(amount)} payout on its way to ${account}, arrives by ${arrivesBy(today)}` : 'Nothing to pay out yet');
  };
  const reportIssue = () => {
    const caseId = openCase('Earnings or payout question', 'I have a question about my earnings and payouts.', { kind: 'account', id: 'earnings' });
    const ref = useApp.getState().supportCases.find((c) => c.id === caseId)?.ref;
    toast(ref ? `Support case ${ref} opened` : 'Support case opened');
    router.push(`/support/${caseId}`);
  };
  const openRow = (t: LedgerRow) => (t.requestId ? () => router.push(`/pro/request/${t.requestId}`) : undefined);

  return (
    <>
      <View style={{ padding: 18, borderRadius: radius.xl, backgroundColor: colors.brandDeep, gap: 12, ...shadow(2) }}>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <T v="small" color={colors.lilacLight}>Available for payout</T>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 42, color: colors.white }}>{euro(available)}</Text>
          </View>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="wallet-outline" size={22} color={colors.gold} />
          </View>
        </Row>
        <T v="small" color={colors.lilacLight}>
          {!sepa
            ? 'Add a payout account before you can transfer your balance.'
            : available > 0
              ? `Net amount after the platform commission. Pay out to ${account} and it arrives by ${arrivesBy(today)}.`
              : processing.length
                ? `${euro(processingTotal)} is on its way to ${account} and arrives by ${arrivesBy(processing[0].date)}.`
                : workspace === 'organizer'
                  ? 'Organizers pay providers through their bookings. Booking earnings belong to an artist or venue workspace.'
                  : 'Nothing to pay out yet. Completed bookings become available once the settlement policy allows.'}
        </T>
        <Button title={!sepa ? 'Set up payouts' : available > 0 ? `Pay out ${euro(available)}` : 'Pay out'} icon="bank-transfer-out" variant="light" size="md" disabled={!!sepa && available <= 0} onPress={payout} />
      </View>

      <Card style={{ gap: 6 }}>
        <T v="title" style={{ marginBottom: 2 }}>Booking earnings</T>
        <KeyValue k="Gross booking value" v={euro(gross)} />
        <KeyValue k={`Platform commission (${pct})`} v={`−${euro(commission)}`} />
        <KeyValue k="Refunds and adjustments" v={refunds > 0 ? `−${euro(refunds)}` : euro(0)} />
        <Divider style={{ marginVertical: 4 }} />
        <KeyValue k="Net earnings" v={euro(net)} strong color={colors.brand} />
        <T v="small" style={{ fontSize: 12 }}>
          {`Gross is what customers paid for your verified bookings, not what you receive. ${refunds > 0 ? 'Refunds reduce what is payable.' : 'No refunds or adjustments so far.'}${awaiting.length ? ` ${plural(awaiting.length, 'accepted booking')} without a verified payment ${awaiting.length === 1 ? 'is' : 'are'} not counted.` : ''}`}
        </T>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatusTile label="Awaiting payment" value={euro(sum(awaiting.map((t) => t.gross ?? 0)))} sub={awaiting.length ? `${plural(awaiting.length, 'booking')} · not counted yet` : 'Nothing waiting'} icon="credit-card-clock-outline" />
        <StatusTile label="Payout pending" value={euro(pending)} sub="Net, after the event" icon="timer-sand" />
        <StatusTile label="Available" value={euro(available)} sub="Ready to transfer" icon="arrow-down-bold-circle-outline" />
        <StatusTile label="Paid out" value={euro(paidOut)} sub={processing.length ? `${euro(processingTotal)} processing` : plural(myPayouts.length, 'payout')} icon="bank-transfer-out" />
      </View>

      <Card
        padded={false}
        onPress={() => router.push(sepa ? '/payment-methods' : '/payment-methods?iban=1')}
        accessibilityLabel={sepa ? `Payout account, SEPA, ${account}. Manage` : 'Set up a payout account'}
        style={{ paddingHorizontal: 16, paddingVertical: 12, minHeight: 64, justifyContent: 'center' }}
      >
        <Row gap={12}>
          <Icon name="bank-outline" size={22} color={colors.brand} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="bodyBold">Payout setup</T>
            <T v="small">{sepa ? `SEPA · ${account}` : 'No payout account yet'}</T>
            <T v="small" color={sepa ? colors.inkSoft : colors.warning}>{sepa ? 'Payouts for all your workspaces go to this account' : 'Add a bank account to receive payouts'}</T>
          </View>
          <T v="smallBold" color={colors.brand}>{sepa ? 'Manage' : 'Set up'}</T>
          <Icon name="chevron-right" size={20} color={colors.subtle} />
        </Row>
      </Card>

      {subscriptions > 0 ? <Banner icon="information-outline">{`Your Pro plan (${euro(subscriptions, true)}) is a subscription charge and isn’t deducted from booking earnings.`}</Banner> : null}

      <View>
        <SectionTitle title="Transactions" />
        <Card padded={false}>
          {txs.length === 0 ? (
            <View style={{ padding: 16 }}>
              <T v="small">No transactions yet. Paid bookings appear here with their gross value, commission and net amount.</T>
            </View>
          ) : (
            txs.map((t, i) => {
              const st = TX_STATUS[t.status];
              const income = t.net > 0;
              const onPress = openRow(t);
              const row = (
                <Row gap={12} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: income ? colors.brandSoft : colors.chipIdle, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={st.icon} size={20} color={income ? colors.brand : colors.label} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyBold" numberOfLines={1}>{t.title}</T>
                    <T v="small" numberOfLines={1}>{t.sub} · {shortDate(t.date)}</T>
                    {t.gross !== undefined ? <T v="small" style={{ fontSize: 12 }}>Gross {euro(t.gross)} · commission −{euro(t.commission ?? 0)}</T> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <T v="bodyBold" color={t.status === 'awaiting' ? colors.muted : income ? colors.success : colors.ink}>{income ? '+' : '−'}{money(t.net)}</T>
                    <Pill label={st.label} tone={st.tone} />
                  </View>
                </Row>
              );
              const label = `${t.title}, ${t.sub}, ${shortDate(t.date)}, ${income ? 'plus' : 'minus'} ${money(t.net)}${t.gross !== undefined ? `, gross ${euro(t.gross)}` : ''}, ${st.label}`;
              return (
                <View key={t.id}>
                  {i > 0 ? <Divider style={{ marginLeft: 68 }} /> : null}
                  {onPress ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Open settlement detail`} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                      {row}
                    </Pressable>
                  ) : (
                    <View accessible accessibilityLabel={label}>{row}</View>
                  )}
                </View>
              );
            })
          )}
        </Card>
      </View>

      <View>
        <SectionTitle title="Payout history" />
        <Card padded={false}>
          {myPayouts.length === 0 ? (
            <View style={{ padding: 16 }}>
              <T v="small">No payouts yet. Your first payout appears here once you transfer your balance.</T>
            </View>
          ) : (
            myPayouts.map((p, i) => {
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

      <Button title="Report a payout issue" icon="lifebuoy" variant="ghost" onPress={reportIssue} />
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
