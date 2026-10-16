import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AdminGate, RecordRow } from '../../components/admin';
import { goBack, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Banner, Button, Card, Divider, EmptyState, Field, LineItems, PaymentPill, Pill, Row, Segmented, StatusPill, T, TimeLeft } from '../../components/ui';
import type { Booking, IncomingRequest } from '../../data/types';
import { bookingExceptions, EXCEPTION_ICON, EXCEPTION_LABEL, EXCEPTION_TONE, exceptionsOf, FINANCE_NOTE, matchesBooking, requestAmount, requestRef } from '../../lib/admin';
import { bookingRef, chargeItems, isOverdue, PAYMENT_PROVIDER_LABEL, PAYMENT_TONE, providerOf, REQUEST_STATUS_LABEL, STATUS_LABEL, STATUS_NEXT_OWNER } from '../../lib/booking';
import { dateTime, euro, shortDate } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp } from '../../store/useApp';
import { colors, shadow } from '../../theme';

type Tab = 'exceptions' | 'bookings' | 'requests';

const FINANCE_STATES = ['capture_pending', 'release_pending', 'refund_pending', 'payout_pending', 'disputed'];

function BookingRow({ b, onPress }: { b: Booking; onPress: () => void }) {
  const p = providerOf(b);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Booking ${bookingRef(b)}, ${p.name}, ${b.eventTitle}, ${STATUS_LABEL[b.status]}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.surface, opacity: pressed ? 0.92 : 1, ...shadow(1) })}
    >
      <Avatar src={p.image} size={44} label={p.name} />
      <View style={{ flex: 1, gap: 4 }}>
        <T v="bodyBold" numberOfLines={1}>{bookingRef(b)} · {p.name}</T>
        <T v="small" numberOfLines={1}>{b.eventTitle} · {shortDate(b.date)} · {euro(b.amount)}</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <StatusPill booking={b} />
          <PaymentPill state={b.payment} provider />
        </Row>
      </View>
    </Pressable>
  );
}

function RequestRow({ r }: { r: IncomingRequest }) {
  return (
    <Card onPress={() => router.push(`/pro/request/${r.id}`)} accessibilityLabel={`Request ${requestRef(r)} from ${r.requester}, ${REQUEST_STATUS_LABEL[r.status]}`} style={{ gap: 6 }}>
      <T v="bodyBold" numberOfLines={1}>{requestRef(r)} · {r.requester} · {r.title}</T>
      <T v="small">{r.date} · {euro(requestAmount(r))} · {r.requesterRole}</T>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <Pill label={REQUEST_STATUS_LABEL[r.status]} tone={r.status === 'new' ? 'warning' : r.status === 'expired' || r.status === 'declined' ? 'neutral' : 'success'} />
        {r.payment ? <Pill label={PAYMENT_PROVIDER_LABEL[r.payment]} tone={PAYMENT_TONE[r.payment]} icon="credit-card-outline" /> : null}
        {r.status === 'new' ? <TimeLeft deadline={r.deadline} /> : null}
      </Row>
    </Card>
  );
}

export default function AdminBookings() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const adminMode = useApp((s) => s.adminMode);
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  const requests = useApp((s) => s.requests);
  const cases = useApp((s) => s.supportCases);
  const expireOverdue = useApp((s) => s.expireOverdue);
  const [tab, setTab] = useState<Tab>('exceptions');
  const [query, setQuery] = useState('');

  const exceptions = useMemo(() => bookingExceptions(bookings, requests), [bookings, requests]);
  const found = useMemo(() => [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((b) => matchesBooking(b, query)), [bookings, query]);

  if (!adminMode) return <AdminGate title="Bookings" />;

  const overdue = bookings.filter((b) => isOverdue(b)).length + requests.filter((r) => isOverdue(r)).length;
  const expireNow = () => {
    const n = expireOverdue();
    toast(n ? `${n} overdue ${n === 1 ? 'request' : 'requests'} expired · release started` : 'Nothing is past its deadline');
  };

  // ---------- Investigation detail ----------
  if (id) {
    const b = bookings.find((x) => x.id === id);
    if (!b) {
      return (
        <Screen header={<ScreenHeader title="Booking" onBack={() => goBack('/admin/bookings')} />}>
          <EmptyState icon="calendar-remove-outline" title="Booking not found" body="Search by reference to find another booking." action="All bookings" onAction={() => router.replace('/admin/bookings')} />
        </Screen>
      );
    }
    const p = providerOf(b);
    const kinds = exceptionsOf(b);
    const linked = cases.filter((c) => c.linked?.kind === 'booking' && c.linked.id === b.id);
    const inFinance = !!b.payment && FINANCE_STATES.includes(b.payment);
    const timeline = b.timeline ?? [];
    return (
      <Screen header={<ScreenHeader title={`Booking ${bookingRef(b)}`} subtitle="Investigation · admin demo" onBack={() => goBack('/admin/bookings')} />}>
        <Card style={{ gap: 10 }}>
          <Row gap={12}>
            <Avatar src={p.image} size={52} label={p.name} />
            <View style={{ flex: 1 }}>
              <T v="h3" numberOfLines={1}>{b.eventTitle}</T>
              <T v="small">{shortDate(b.date)}, {b.startTime} – {b.endTime} · {b.guests} guests</T>
              <T v="small" numberOfLines={1}>{b.location}</T>
            </View>
          </Row>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <StatusPill booking={b} />
            <PaymentPill state={b.payment} provider />
            {b.status === 'pending' ? <TimeLeft deadline={b.deadline} /> : null}
          </Row>
          {kinds.length ? (
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {kinds.map((k) => <Pill key={k} label={EXCEPTION_LABEL[k]} tone={EXCEPTION_TONE[k]} icon={EXCEPTION_ICON[k]} />)}
            </Row>
          ) : null}
        </Card>

        <Card style={{ gap: 8 }}>
          <T v="title" accessibilityRole="header">Participants</T>
          <RecordRow icon="account-outline" title={`Customer · ${user.name}`} sub={user.handle} />
          <Divider />
          <RecordRow icon={p.kind === 'venue' ? 'storefront-outline' : 'account-music-outline'} title={`Provider · ${p.name}`} sub={p.subtitle} onPress={() => router.push(p.href as never)} />
          <Divider />
          <Row justify="space-between" gap={12} style={{ paddingTop: 4 }}>
            <T v="small">Next action</T>
            <T v="bodyBold" style={{ flexShrink: 1, textAlign: 'right' }}>{STATUS_NEXT_OWNER[b.status]}</T>
          </Row>
          {b.deadline && b.status === 'pending' ? (
            <Row justify="space-between" gap={12}>
              <T v="small">Provider deadline</T>
              <T v="bodyBold">{dateTime(b.deadline)}</T>
            </Row>
          ) : null}
        </Card>

        <Card style={{ gap: 8 }}>
          <T v="title" accessibilityRole="header">Verified payment state</T>
          {b.payment ? (
            <>
              <T v="bodyBold">{PAYMENT_PROVIDER_LABEL[b.payment]}</T>
              {FINANCE_NOTE[b.payment] ? <T v="small">{FINANCE_NOTE[b.payment]}</T> : null}
            </>
          ) : (
            <T v="small">No payment recorded on this booking.</T>
          )}
          <Row justify="space-between"><T v="small">Payment attempts</T><T v="bodyBold">{b.paymentAttempts ?? 0}</T></Row>
          <Row justify="space-between"><T v="small">Reference</T><T v="bodyBold">{b.paymentRef ?? 'None yet'}</T></Row>
          {inFinance ? <Button title="Open finance record" variant="light" size="sm" icon="bank-transfer" onPress={() => router.push(`/admin/finance?id=${b.id}`)} style={{ alignSelf: 'flex-start' }} /> : null}
        </Card>

        <Card style={{ gap: 10 }}>
          <T v="title" accessibilityRole="header">Agreed terms</T>
          <LineItems items={chargeItems(b)} total={b.amount} />
          <Banner icon="lock-outline">Support can’t change agreed prices. A different price needs a change request that both sides accept.</Banner>
          {b.change ? <T v="small">{`Change requested ${dateTime(b.change.requestedAt)}: ${b.change.note}. Until both sides agree, the previously agreed terms stay in place (${STATUS_LABEL[b.change.previous].toLowerCase()}).`}</T> : null}
          {b.pendingCancellation ? <T v="small">{`Event cancelled ${dateTime(b.pendingCancellation.at)}: ${b.pendingCancellation.reason}. The booking goes through the cancellation process; it isn’t cancelled automatically.`}</T> : null}
          {b.cancelReason ? <T v="small">Cancellation reason: {b.cancelReason}</T> : null}
        </Card>

        <Card style={{ gap: 10 }}>
          <T v="title" accessibilityRole="header">Record timeline</T>
          {timeline.length ? (
            timeline.map((t, i) => (
              <Row key={`${t.at}-${i}`} gap={10} align="flex-start">
                <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: i === timeline.length - 1 ? colors.brand : colors.borderStrong }} />
                <View style={{ flex: 1 }}>
                  <T v="body">{t.label}</T>
                  <T v="small" style={{ fontSize: 12 }}>{dateTime(t.at)}</T>
                </View>
              </Row>
            ))
          ) : (
            <T v="small">{`No timeline entries recorded. Created ${shortDate(b.createdAt)}.`}</T>
          )}
          {b.evidence?.length ? (
            <View style={{ gap: 4 }}>
              <T v="smallBold">Evidence</T>
              {b.evidence.map((e, i) => <T key={`${e}-${i}`} v="small">• {e}</T>)}
            </View>
          ) : null}
        </Card>

        <Card style={{ gap: 6 }}>
          <T v="title" accessibilityRole="header">Linked support cases</T>
          {linked.length ? (
            linked.map((c) => <RecordRow key={c.id} icon="lifebuoy" title={`${c.ref} · ${c.topic}`} sub={c.status === 'resolved' ? 'Resolved' : c.status === 'waiting' ? 'Waiting on the member' : 'Needs a reply'} onPress={() => router.push(`/support/${c.id}`)} />)
          ) : (
            <T v="small">No support case is linked. The customer can open one from the booking or from Help.</T>
          )}
        </Card>

        {kinds.includes('overdue') ? <Button title="Expire overdue requests now" icon="timer-sand-complete" variant="secondary" onPress={expireNow} /> : null}
        <Button title="Open booking as the customer sees it" icon="open-in-new" variant="secondary" onPress={() => router.push(`/booking/${b.id}`)} />
      </Screen>
    );
  }

  // ---------- Queues ----------
  return (
    <Screen keyboard header={<ScreenHeader title="Bookings" subtitle="Admin · demo" onBack={() => goBack('/admin')} />}>
      <Field value={query} onChangeText={(t) => { setQuery(t); if (t.trim() && tab !== 'bookings') setTab('bookings'); }} placeholder="Find by reference, e.g. #B7, event or provider" icon="magnify" autoCapitalize="none" accessibilityLabel="Find booking by reference" />
      <Segmented
        options={[
          { key: 'exceptions', label: `Exceptions · ${exceptions.length}` },
          { key: 'bookings', label: `Bookings · ${bookings.length}` },
          { key: 'requests', label: `Requests · ${requests.length}` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'exceptions' ? (
        <>
          {overdue ? (
            <Banner icon="timer-sand-complete" tone="danger">
              <View style={{ gap: 8 }}>
                <T v="small" color={colors.danger}>{`${overdue} ${overdue === 1 ? 'request is' : 'requests are'} past the 24-hour deadline without an answer. Expiring closes them and starts the release; the release itself is tracked in the finance queue.`}</T>
                <Button title="Expire overdue requests" size="sm" variant="danger" onPress={expireNow} style={{ alignSelf: 'flex-start' }} />
              </View>
            </Banner>
          ) : null}
          {exceptions.length ? (
            <Card style={{ paddingVertical: 6 }}>
              {exceptions.map((x, i) => (
                <View key={x.id}>
                  {i ? <Divider /> : null}
                  <RecordRow
                    icon={EXCEPTION_ICON[x.kind]}
                    title={`${x.ref} · ${x.title}`}
                    sub={x.sub}
                    pill={EXCEPTION_LABEL[x.kind]}
                    tone={EXCEPTION_TONE[x.kind]}
                    onPress={() => router.push(x.bookingId ? `/admin/bookings?id=${x.bookingId}` : `/pro/request/${x.requestId}`)}
                  />
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState icon="check-circle-outline" title="No booking exceptions" body="Expired requests, payment failures, disputes and date conflicts appear here when they happen." />
          )}
        </>
      ) : null}

      {tab === 'bookings' ? (
        found.length ? (
          found.map((b) => <BookingRow key={b.id} b={b} onPress={() => router.push(`/admin/bookings?id=${b.id}`)} />)
        ) : (
          <EmptyState icon="magnify-close" title={bookings.length ? 'No booking matches' : 'No bookings yet'} body={bookings.length ? 'Check the reference. It looks like #B7 and is shown on every booking.' : 'Bookings appear here once a customer sends a request.'} />
        )
      ) : null}

      {tab === 'requests' ? (
        requests.length ? (
          <>
            <T v="small">Requests received by the provider account in this app.</T>
            {requests.map((r) => <RequestRow key={r.id} r={r} />)}
          </>
        ) : (
          <EmptyState icon="inbox-outline" title="No provider requests" body="Requests sent to the provider account in this app appear here." />
        )
      ) : null}
    </Screen>
  );
}
