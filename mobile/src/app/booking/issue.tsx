import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionSheet } from '../../components/ActionSheet';
import { BottomBar, DemoBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Field, Icon, KeyValue, PaymentPill, Photo, Pill, Radio, Row, StatusPill, Steps, T } from '../../components/ui';
import { bookingRef, nextPaymentStep, PAYMENT_LABEL, PAYMENT_NOTE, providerOf } from '../../lib/booking';
import { dateTime, euro, parse, shortDate, TODAY } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp } from '../../store/useApp';
import { colors, radius, shadow } from '../../theme';

type Mode = 'cancel' | 'dispute' | 'case' | 'tracking' | 'nothing';

const DAY = 86_400_000;
const CANCEL_REASONS = ['Plans changed', 'Event cancelled', 'The provider asked to cancel', 'Illness or emergency', 'Other'];
const DISPUTE_REASONS = ['Provider didn’t show up', 'Arrived late or left early', 'Sound or equipment problems', 'Different from what was agreed', 'Other'];

/** Demo cancellation policy. The final refund, no-show and late-cancellation rules are still open decisions. */
const POLICY = [
  { when: 'Before the provider accepts', what: 'Cancel for free. The payment authorization is released.' },
  { when: 'More than 14 days before the event', what: 'Full refund of the booking total.' },
  { when: '7 to 14 days before the event', what: '50% refund. The rest goes to the provider.' },
  { when: 'Less than 7 days before, or a no-show', what: 'No refund unless the provider agrees or support decides otherwise.' },
  { when: 'The provider cancels', what: 'Full refund.' },
];

/** Summary line whose value is free text, so it wraps instead of running off the card. */
function TextLine({ k, v }: { k: string; v: string }) {
  return (
    <Row justify="space-between" align="flex-start" gap={12} style={{ paddingVertical: 4 }}>
      <T v="body" color={colors.muted}>{k}</T>
      <T v="bodyBold" style={{ flex: 1, textAlign: 'right' }}>{v}</T>
    </Row>
  );
}

/** Refund and cancellation case for one booking (blueprint F18). */
export default function BookingIssue() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  const cases = useApp((s) => s.supportCases);
  const setStatus = useApp((s) => s.setBookingStatus);
  const cancelBooking = useApp((s) => s.cancelBooking);
  const addBookingEvidence = useApp((s) => s.addBookingEvidence);
  const openCase = useApp((s) => s.openCase);
  const replyCase = useApp((s) => s.replyCase);
  const setPayment = useApp((s) => s.setPayment);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const [reason, setReason] = useState<string>();
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');
  const [evidenceSheet, setEvidenceSheet] = useState(false);
  const [withdrawSheet, setWithdrawSheet] = useState(false);
  const linkedCase = useMemo(() => cases.find((c) => c.linked?.kind === 'booking' && c.linked.id === id), [cases, id]);

  if (!booking) {
    return (
      <Screen header={<ScreenHeader title="Refund and cancellation" onBack={() => goBack('/my-bookings?tab=musician')} />}>
        <T v="body">Booking not found.</T>
        <Button title="Your bookings" onPress={() => router.replace('/my-bookings?tab=musician')} />
      </Screen>
    );
  }

  const b = booking;
  const provider = providerOf(b);
  const name = provider.name;
  const ref = bookingRef(b);
  const payment = b.payment;
  const daysToEvent = (parse(b.date).getTime() - TODAY.getTime()) / DAY;
  const eventPassed = daysToEvent < 0;
  const withinReportWindow = TODAY.getTime() <= parse(b.date).getTime() + 2 * DAY;
  const paid = payment === 'paid' || payment === 'payout_pending' || payment === 'paid_out';
  const confirmed = b.status === 'confirmed' || b.status === 'paid' || b.status === 'change_requested';
  const toBooking = () => router.replace(`/booking/${b.id}`);
  const chat = () => router.push(`/chat/${ensureConversation(b.targetId)}`);

  let mode: Mode;
  if (b.status === 'disputed') mode = 'case';
  else if (b.status === 'cancelled' || b.status === 'declined' || b.status === 'expired') mode = 'tracking';
  else if (confirmed && paid && !eventPassed) mode = 'cancel';
  else if ((b.status === 'completed' || confirmed) && paid && eventPassed) mode = 'dispute';
  else mode = 'nothing';

  // ---------- Eligibility under the (demo) policy ----------
  const share = daysToEvent > 14 ? 1 : daysToEvent >= 7 ? 0.5 : 0;
  const eligible = Math.round(b.amount * share * 100) / 100;
  const late = mode === 'cancel' && share === 0;
  const eligibility =
    mode === 'cancel'
      ? share === 1
        ? `More than 14 days before the event: a full refund of ${euro(b.amount, true)} can be requested.`
        : share > 0
          ? `7 to 14 days before the event: a 50% refund of ${euro(eligible, true)} can be requested.`
          : 'Less than 7 days before the event: no refund under the policy. Support reviews your request, and the booking stays confirmed until they decide.'
      : mode === 'dispute'
        ? withinReportWindow
          ? 'Problems can be reported up to 48 hours after the event. Support reviews evidence from both sides before any refund.'
          : 'The 48-hour window to report a problem has passed. You can still contact support.'
        : '';

  const addEvidence = (kind: string) => {
    addBookingEvidence(b.id, kind);
    toast(`${kind} added to ${ref}`);
  };

  const submit = () => {
    if (!reason) return;
    const text = `${reason}${note.trim() ? `: ${note.trim()}` : ''}`;
    if (mode === 'cancel') {
      if (late) {
        openCase(`Late cancellation request · ${ref}`, `${text}. Booking total ${euro(b.amount, true)}; no refund under the policy unless agreed.`, { kind: 'booking', id: b.id });
        toast('Request sent to support. The booking stays confirmed until they decide.');
      } else {
        // The requested amount stays on the booking record (reason and history), so the refund is tracked with its amount.
        cancelBooking(b.id, `${text} · refund requested ${euro(eligible, true)} of ${euro(b.amount, true)}`);
        openCase(`Refund request · ${ref}`, `${text}. Refund requested under the policy: ${euro(eligible, true)} of ${euro(b.amount, true)}.`, { kind: 'booking', id: b.id });
        toast('Booking cancelled and refund requested. It’s complete only once the payment provider confirms it.');
      }
    } else if (mode === 'dispute') {
      setStatus(b.id, 'disputed');
      openCase(`Problem with booking ${ref}`, text, { kind: 'booking', id: b.id });
      toast('Problem reported. Support reviews the case before any refund.');
    }
    setReason(undefined);
    setNote('');
  };

  const sendReply = () => {
    if (!linkedCase || !reply.trim()) return;
    replyCase(linkedCase.id, reply.trim());
    setReply('');
    toast(`Reply added to ${linkedCase.ref}`);
  };

  // ---------- Money tracking ----------
  const refundFlow = payment === 'refund_pending' || payment === 'refunded';
  const releaseFlow = payment === 'release_pending' || payment === 'released';
  const trackSteps = refundFlow
    ? [
        { title: 'Refund requested', note: b.cancelReason ? `Reason: ${b.cancelReason}` : undefined },
        { title: 'Refund pending', note: 'Approved and sent to the payment provider. Not complete yet.' },
        { title: 'Refunded', note: 'Confirmed by the payment provider' },
      ]
    : [
        { title: b.status === 'declined' ? `${name} declined` : b.status === 'expired' ? 'Request expired' : 'Request cancelled' },
        { title: 'Release pending', note: 'The authorization is being released. Not complete yet.' },
        { title: 'Released', note: 'Confirmed by the payment provider · you weren’t charged' },
      ];
  const trackCurrent = payment === 'refunded' || payment === 'released' ? 3 : 1;
  const next = nextPaymentStep(payment);

  const canSubmit = (mode === 'cancel' || (mode === 'dispute' && withinReportWindow)) && !(late && linkedCase);
  const needsEvidence = mode === 'dispute' && !(b.evidence?.length);

  return (
    <Screen
      keyboard
      header={<ScreenHeader title="Refund and cancellation" subtitle={`Booking ${ref}`} onBack={() => goBack(`/booking/${b.id}`)} />}
      footer={
        canSubmit ? (
          <BottomBar>
            <Button
              title={mode === 'cancel' ? (late ? 'Send request to support' : share === 1 ? 'Cancel and request full refund' : 'Cancel and request 50% refund') : 'Report problem'}
              variant={mode === 'cancel' && !late ? 'danger' : 'primary'}
              disabled={!reason || needsEvidence}
              onPress={submit}
            />
            <T v="small" center style={{ marginTop: 8 }}>
              {!reason ? 'Choose a reason first.' : needsEvidence ? 'Add at least one piece of evidence.' : 'A refund request is not a completed refund.'}
            </T>
          </BottomBar>
        ) : null
      }
    >
      <Pressable accessibilityRole="button" accessibilityLabel={`Open booking ${ref}`} onPress={toBooking} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadow(1) }}>
        <Photo src={provider.image ?? 'ven_moon'} style={{ width: 60, height: 60 }} radius={16} />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="title" numberOfLines={1}>{name}</T>
          <T v="small" numberOfLines={1}>{b.eventTitle} · {shortDate(b.date)}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <StatusPill booking={b} />
            <PaymentPill state={payment} />
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={colors.subtle} />
      </Pressable>

      <Card style={{ gap: 6 }}>
        <T v="title" style={{ marginBottom: 2 }}>Money on this booking</T>
        <KeyValue k="Booking total" v={euro(b.amount, true)} />
        <KeyValue k="Payment" v={payment ? PAYMENT_LABEL[payment] : 'No payment'} />
        {b.paymentRef ? <KeyValue k="Reference" v={b.paymentRef} /> : null}
        <T v="small">{payment ? PAYMENT_NOTE[payment] : 'No payment was taken for this booking.'}</T>
      </Card>

      {mode === 'nothing' ? (
        <Card style={{ gap: 10, alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="cash-remove" size={40} color={colors.brand} />
          <T v="h3" center>Nothing to refund</T>
          <T v="body" color={colors.muted} center>
            {payment === 'authorized' || payment === 'capture_pending'
              ? 'The payment hasn’t been captured. Cancelling the request on the booking page releases the authorization, so no refund is needed.'
              : 'No payment has been taken for this booking, so there is nothing to refund. You can cancel it from the booking page.'}
          </T>
          <Button title="Open booking" size="md" onPress={toBooking} />
        </Card>
      ) : null}

      {mode === 'tracking' ? (
        refundFlow || releaseFlow ? (
          <Card style={{ gap: 12 }}>
            <T v="title">{refundFlow ? 'Refund status' : 'Release status'}</T>
            {refundFlow && b.cancelReason ? <TextLine k="Request" v={b.cancelReason} /> : null}
            {releaseFlow ? <KeyValue k="Authorized amount" v={euro(b.amount, true)} /> : null}
            <Steps steps={trackSteps} current={trackCurrent} />
            {payment === 'refund_pending' ? <Banner icon="timer-sand" tone="warning">A refund request is not a completed refund. This shows as refunded once the payment provider confirms it.</Banner> : null}
            {payment === 'release_pending' ? <Banner icon="timer-sand" tone="warning">Release pending is not released yet. This updates once the payment provider confirms it.</Banner> : null}
          </Card>
        ) : (
          <Banner icon="information-outline">{payment === 'failed' || payment === 'not_started' || !payment ? 'No payment was taken, so nothing needs to be released or refunded.' : PAYMENT_NOTE[payment]}</Banner>
        )
      ) : null}

      {mode === 'cancel' || mode === 'dispute' ? (
        <Card style={{ gap: 10 }}>
          <T v="title">Your eligibility</T>
          <Banner icon={late || (mode === 'dispute' && !withinReportWindow) ? 'alert-outline' : 'check-circle-outline'} tone={late || (mode === 'dispute' && !withinReportWindow) ? 'warning' : 'success'}>{eligibility}</Banner>
          {mode === 'cancel' ? (
            <>
              <KeyValue k="Event in" v={`${Math.max(0, Math.floor(daysToEvent))} days`} />
              <KeyValue k="Refund you can request" v={euro(eligible, true)} strong />
              <T v="small">Support can’t promise more than the policy before an authorized decision.</T>
            </>
          ) : null}
        </Card>
      ) : null}

      {mode === 'cancel' || mode === 'dispute' || mode === 'tracking' ? (
        <Card style={{ gap: 8 }}>
          <Row justify="space-between">
            <T v="title">Cancellation policy</T>
            <Pill label="Demo terms" tone="neutral" />
          </Row>
          {POLICY.map((p) => (
            <View key={p.when} style={{ gap: 1, paddingVertical: 2 }}>
              <T v="bodyBold">{p.when}</T>
              <T v="small">{p.what}</T>
            </View>
          ))}
          <T v="small">Final rules for partial refunds, fees, no-shows and late cancellations are still being decided.</T>
        </Card>
      ) : null}

      {canSubmit ? (
        <Card style={{ gap: 10 }}>
          <T v="title">{mode === 'cancel' ? 'Why are you cancelling?' : 'What went wrong?'}</T>
          <View accessibilityRole="radiogroup">
            {(mode === 'cancel' ? CANCEL_REASONS : DISPUTE_REASONS).map((r) => (
              <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: reason === r }} onPress={() => setReason(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
                <Radio selected={reason === r} />
                <T v="body" style={{ flex: 1 }}>{r}</T>
              </Pressable>
            ))}
          </View>
          <Field label="Details (optional)" value={note} onChangeText={setNote} multiline placeholder={mode === 'cancel' ? 'Anything the provider or support should know' : 'Describe what happened and when'} />
        </Card>
      ) : null}

      {mode === 'dispute' && !withinReportWindow && !linkedCase ? (
        <Button
          title="Contact support about this booking"
          icon="lifebuoy"
          variant="secondary"
          onPress={() => {
            openCase(`Question about booking ${ref}`, 'I have a question about this booking after the event.', { kind: 'booking', id: b.id });
            toast('Support case opened. Their replies appear below and under Support.');
          }}
        />
      ) : null}

      {(mode === 'dispute' && withinReportWindow) || mode === 'case' || (mode === 'cancel' && !late) ? (
        <Card style={{ gap: 8 }}>
          <Row justify="space-between">
            <T v="title">Evidence</T>
            {mode === 'dispute' ? <Pill label="Required" tone="warning" /> : <Pill label="Optional" tone="neutral" />}
          </Row>
          {b.evidence?.length ? (
            b.evidence.map((e, i) => (
              <Row key={`${e}-${i}`} gap={8}>
                <Icon name="paperclip" size={18} color={colors.brand} />
                <T v="body" style={{ flex: 1 }}>{e}</T>
              </Row>
            ))
          ) : (
            <T v="small">No evidence yet. Photos, chat screenshots or a short statement help support decide.</T>
          )}
          <Button title="Add evidence" icon="paperclip" variant="light" size="md" onPress={() => setEvidenceSheet(true)} />
        </Card>
      ) : null}

      {linkedCase ? (
        <Card style={{ gap: 8 }}>
          <Row justify="space-between">
            <T v="title">Support case {linkedCase.ref}</T>
            <Pill label={linkedCase.status === 'resolved' ? 'Resolved' : linkedCase.status === 'waiting' ? 'Support replied' : 'Open'} tone={linkedCase.status === 'resolved' ? 'success' : linkedCase.status === 'waiting' ? 'brand' : 'warning'} />
          </Row>
          <T v="small">{linkedCase.topic} · opened {shortDate(linkedCase.createdAt)}</T>
          {linkedCase.messages.slice(-3).map((m, i) => (
            <View key={`${m.at}-${i}`} style={{ padding: 10, borderRadius: 12, backgroundColor: m.from === 'me' ? colors.brandTint : colors.chipIdle, gap: 2 }}>
              <T v="smallBold">{m.from === 'me' ? 'You' : 'Domtak support'} · {dateTime(m.at)}</T>
              <T v="body">{m.text}</T>
            </View>
          ))}
          {linkedCase.status !== 'resolved' ? (
            <Row gap={8} align="flex-start">
              <Field placeholder="Add a message for support" value={reply} onChangeText={setReply} style={{ flex: 1 }} accessibilityLabel="Message for support" onSubmitEditing={sendReply} />
              <Button title="Send" size="md" disabled={!reply.trim()} onPress={sendReply} style={{ marginTop: 4 }} />
            </Row>
          ) : null}
          <Button title="Open the full case" icon="lifebuoy" variant="ghost" size="md" onPress={() => router.push(`/support/${linkedCase.id}`)} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ) : mode === 'case' ? (
        <Banner icon="lifebuoy">Support is reviewing this booking. Add evidence above; they reply here and under Support.</Banner>
      ) : null}

      {mode === 'case' ? (
        <View style={{ gap: 8 }}>
          <Button title={`Message ${name}`} variant="secondary" icon="message-text-outline" onPress={chat} />
          <Button title="Withdraw report" variant="ghost" onPress={() => setWithdrawSheet(true)} />
        </View>
      ) : null}

      {b.timeline?.length ? (
        <Card style={{ gap: 8 }}>
          <T v="title">Audit trail</T>
          {b.timeline.map((e, i) => (
            <TextLine key={`${e.at}-${i}`} k={dateTime(e.at)} v={e.label} />
          ))}
        </Card>
      ) : null}

      {next && (payment === 'release_pending' || payment === 'refund_pending') ? (
        <DemoBar note="Simulate the payment provider’s confirmation. Until then the money stays pending.">
          <Button title={`Payment provider confirms: ${PAYMENT_LABEL[next].toLowerCase()}`} variant="light" size="md" onPress={() => { setPayment(b.id, next); toast(`${PAYMENT_LABEL[next]} · reference saved`); }} />
        </DemoBar>
      ) : null}

      <ActionSheet
        visible={evidenceSheet}
        title="Add evidence"
        actions={[
          { label: 'Photo from the event', icon: 'image-outline', onPress: () => addEvidence('Photo from the event') },
          { label: 'Screenshot of the chat', icon: 'message-image-outline', onPress: () => addEvidence('Chat screenshot') },
          { label: 'Written statement', icon: 'text-box-outline', onPress: () => addEvidence('Written statement') },
        ]}
        onClose={() => setEvidenceSheet(false)}
      />
      <ActionSheet
        visible={withdrawSheet}
        title="Withdraw your report?"
        actions={[
          {
            label: 'Withdraw report',
            sub: 'The booking goes back to completed. The payment stays as it is.',
            icon: 'flag-remove-outline',
            destructive: true,
            onPress: () => {
              setStatus(b.id, 'completed');
              // Support sees the withdrawal on the case and closes it; a closure never hides a pending refund.
              if (linkedCase && linkedCase.status !== 'resolved') replyCase(linkedCase.id, 'I’m withdrawing my report about this booking.');
              toast('Report withdrawn');
              toBooking();
            },
          },
        ]}
        onClose={() => setWithdrawSheet(false)}
      />
    </Screen>
  );
}
