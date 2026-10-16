import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AdminGate, RecordRow } from '../../components/admin';
import { goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Chip, Divider, EmptyState, LineItems, Pill, Row, T, type Tone } from '../../components/ui';
import type { PaymentState } from '../../data/types';
import { FINANCE_NOTE, FINANCE_STATE_LABEL, type FinanceItem, financeQueue, financeTotals, requestAmount, requestRef } from '../../lib/admin';
import { bookingRef, PAYMENT_PROVIDER_LABEL, PAYMENT_TONE, providerOf } from '../../lib/booking';
import { euro, plural } from '../../lib/format';
import { CASE_QUEUE_LABEL } from '../../lib/support';
import { toast } from '../../store/toast';
import { useApp } from '../../store/useApp';
import { colors } from '../../theme';

type Filter = 'all' | 'money_back' | 'capture' | 'payout' | 'disputed';

const FILTER_STATES: Record<Exclude<Filter, 'all'>, string[]> = {
  money_back: ['release_pending', 'refund_pending'],
  capture: ['capture_pending'],
  payout: ['payout_pending', 'processing'],
  disputed: ['disputed'],
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'money_back', label: 'Releases and refunds' },
  { key: 'capture', label: 'Captures' },
  { key: 'payout', label: 'Payouts' },
  { key: 'disputed', label: 'Disputes' },
];

/** The verified result finance records next for each pending state. */
const COMPLETE: Partial<Record<PaymentState, { label: string; to: PaymentState; done: string }>> = {
  release_pending: { label: 'Confirm release', to: 'released', done: 'Release confirmed' },
  refund_pending: { label: 'Confirm refund', to: 'refunded', done: 'Refund confirmed' },
  payout_pending: { label: 'Confirm payout', to: 'paid_out', done: 'Payout confirmed' },
  capture_pending: { label: 'Record verified payment', to: 'paid', done: 'Payment verified' },
};

/** Final money states that are kept with their reference. */
const DONE: PaymentState[] = ['released', 'refunded', 'paid_out'];

const toneOf = (state: FinanceItem['state']): Tone => (state === 'processing' ? 'warning' : PAYMENT_TONE[state]);

export default function AdminFinance() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const adminMode = useApp((s) => s.adminMode);
  const bookings = useApp((s) => s.bookings);
  const requests = useApp((s) => s.requests);
  const payouts = useApp((s) => s.payouts);
  const cases = useApp((s) => s.supportCases);
  const setPayment = useApp((s) => s.setPayment);
  const verifyPayment = useApp((s) => s.verifyPayment);
  const failPayment = useApp((s) => s.failPayment);
  const setRequestPayment = useApp((s) => s.setRequestPayment);
  const [filter, setFilter] = useState<Filter>('all');

  const queue = useMemo(() => financeQueue(bookings, requests, payouts, cases), [bookings, requests, payouts, cases]);
  const totals = useMemo(() => financeTotals(bookings, requests, payouts), [bookings, requests, payouts]);
  const completed = useMemo(() => bookings.filter((b) => b.payment && DONE.includes(b.payment)), [bookings]);
  const completedRequests = useMemo(() => requests.filter((r) => r.payment && DONE.includes(r.payment)), [requests]);

  if (!adminMode) return <AdminGate title="Payments and refunds" />;

  const focused = id ? queue.filter((q) => q.bookingId === id) : [];
  const list = focused.length ? focused : filter === 'all' ? queue : queue.filter((q) => FILTER_STATES[filter].includes(q.state));
  const count = (f: Exclude<Filter, 'all'>) => queue.filter((q) => FILTER_STATES[f].includes(q.state)).length;

  const complete = (item: FinanceItem) => {
    if (item.state === 'processing' || item.state === 'disputed') return;
    const step = COMPLETE[item.state];
    if (!step) return;
    if (item.bookingId) {
      if (item.state === 'capture_pending') verifyPayment(item.bookingId);
      else setPayment(item.bookingId, step.to);
      const ref = useApp.getState().bookings.find((b) => b.id === item.bookingId)?.paymentRef;
      toast(`${step.done}${ref ? ` · ${ref}` : ''} · ${item.ref}`);
    } else if (item.requestId) {
      setRequestPayment(item.requestId, step.to);
      toast(`${step.done} · ${item.ref}`);
    }
  };

  const fail = (item: FinanceItem) => {
    if (!item.bookingId) return;
    failPayment(item.bookingId);
    toast(`Payment failed · ${item.ref} · nothing charged, the customer can retry on the same booking`);
  };

  return (
    <Screen header={<ScreenHeader title="Payments and refunds" subtitle="Finance · admin demo" onBack={() => goBack('/admin')} />}>
      <Card style={{ gap: 10 }}>
        <T v="title" accessibilityRole="header">Totals</T>
        <T v="small">All records in this app. Booking value, fees, refunds and payouts are kept apart: booking value is not earnings, and a refund request is not a completed refund.</T>
        <LineItems
          total={false}
          items={[
            { label: 'Booking value', note: `Verified payments · ${plural(totals.counts.captured, 'booking')}`, amount: totals.bookingValue },
            { label: 'Service fees recorded', amount: totals.fees },
            { label: 'Refunds pending', note: plural(totals.counts.refundPending, 'refund'), amount: totals.refundPending },
            { label: 'Refunded', note: plural(totals.counts.refunded, 'refund'), amount: totals.refunded },
            { label: 'Released without a charge', note: plural(totals.counts.released, 'authorization'), amount: totals.released },
            { label: 'Provider payouts paid', amount: totals.payoutsPaid },
            { label: 'Provider payouts processing', amount: totals.payoutsProcessing },
          ]}
        />
      </Card>

      <Banner icon="shield-check-outline">A support case closure never hides an unresolved refund or release. Items stay in this queue until the payment provider confirms the result, whatever the case status.</Banner>

      {focused.length ? (
        <Button title="Show the whole queue" variant="ghost" size="sm" icon="format-list-bulleted" onPress={() => router.replace('/admin/finance')} style={{ alignSelf: 'flex-start' }} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={`${f.label} · ${f.key === 'all' ? queue.length : count(f.key)}`} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </View>
      )}
      {id && !focused.length ? <Banner icon="information-outline">This booking has nothing left to reconcile. The whole queue is shown.</Banner> : null}

      {list.length ? (
        list.map((item) => {
          const step = item.state === 'processing' || item.state === 'disputed' ? undefined : COMPLETE[item.state];
          const hiddenRisk = (item.state === 'refund_pending' || item.state === 'release_pending') && item.cases.some((c) => c.status === 'resolved');
          return (
            <Card key={item.id} style={{ gap: 10 }}>
              <Row justify="space-between" align="flex-start" gap={10}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="bodyBold">{item.ref} · {item.title}</T>
                  <T v="small">{item.sub}</T>
                </View>
                <T v="h3">{euro(item.amount)}</T>
              </Row>
              <Pill label={FINANCE_STATE_LABEL[item.state]} tone={toneOf(item.state)} icon="credit-card-outline" />
              {FINANCE_NOTE[item.state] ? <T v="small">{FINANCE_NOTE[item.state]}</T> : null}
              {item.cases.map((c) => (
                <RecordRow
                  key={c.id}
                  icon="lifebuoy"
                  title={`Case ${c.ref} · ${CASE_QUEUE_LABEL[c.status]}`}
                  sub={c.status === 'resolved' && hiddenRisk ? 'Case closed, money still pending: kept in this queue' : c.topic}
                  tone={c.status === 'resolved' && hiddenRisk ? 'warning' : 'brand'}
                  onPress={() => router.push(`/support/${c.id}`)}
                />
              ))}
              {item.state === 'processing' ? <T v="small" color={colors.muted}>Nothing to do until the bank confirms the transfer.</T> : null}
              {item.state === 'disputed' ? <T v="small" color={colors.muted}>Support decides first. The payment stays in its current state until then.</T> : null}
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {step ? <Button title={step.label} size="sm" icon="check" onPress={() => complete(item)} /> : null}
                {item.state === 'capture_pending' && item.bookingId ? <Button title="Record failed payment" size="sm" variant="secondary" icon="close" onPress={() => fail(item)} /> : null}
                {item.bookingId ? <Button title="Investigate" size="sm" variant="light" icon="magnify" onPress={() => router.push(`/admin/bookings?id=${item.bookingId}`)} /> : null}
                {item.requestId ? <Button title="Investigate" size="sm" variant="light" icon="magnify" onPress={() => router.push(`/admin/bookings?request=${item.requestId}`)} /> : null}
              </Row>
            </Card>
          );
        })
      ) : (
        <EmptyState icon="cash-check" title="Nothing to reconcile" body="Pending captures, releases, refunds, payouts and disputed payments appear here." />
      )}

      <Card style={{ gap: 6 }}>
        <T v="title" accessibilityRole="header">Completed with a reference</T>
        {completed.length || completedRequests.length ? (
          <>
            {completed.map((b, i) => (
              <View key={b.id}>
                {i ? <Divider /> : null}
                <RecordRow
                  icon="receipt-text-outline"
                  title={`${bookingRef(b)} · ${providerOf(b).name}`}
                  sub={`${b.payment ? PAYMENT_PROVIDER_LABEL[b.payment] : ''} · ${euro(b.amount)}${b.paymentRef ? ` · ${b.paymentRef}` : ''}`}
                  tone="success"
                  onPress={() => router.push(`/admin/bookings?id=${b.id}`)}
                />
              </View>
            ))}
            {completedRequests.map((r, i) => (
              <View key={r.id}>
                {i || completed.length ? <Divider /> : null}
                <RecordRow
                  icon="receipt-text-outline"
                  title={`${requestRef(r)} · ${r.requester}`}
                  sub={`Provider request · ${r.payment ? PAYMENT_PROVIDER_LABEL[r.payment] : ''} · ${euro(requestAmount(r))}`}
                  tone="success"
                  onPress={() => router.push(`/admin/bookings?request=${r.id}`)}
                />
              </View>
            ))}
          </>
        ) : (
          <T v="small">No completed releases, refunds or payouts yet.</T>
        )}
      </Card>

      <T v="small" center>Finance actions need finance permission. In this demo the console has it, and each booking result is written to that booking’s timeline.</T>
    </Screen>
  );
}
