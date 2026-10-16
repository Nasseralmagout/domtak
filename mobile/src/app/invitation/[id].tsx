import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ActionSheet } from '../../components/ActionSheet';
import { BottomBar, DemoBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Banner, Button, Card, Divider, EmptyState, Icon, KeyValue, Photo, Pill, Row, Steps, T } from '../../components/ui';
import { profileById } from '../../data/mock';
import { guestInviteLabel } from '../../lib/eventHost';
import { eventState } from '../../lib/events';
import { ago, euro, eventWhen, parse, shortDate, TODAY } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp, useEvent, useVenue } from '../../store/useApp';
import { colors, radius } from '../../theme';

export default function InvitationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invites = useApp((s) => s.guestInvites);
  const invite = invites.find((g) => g.id === id);
  const event = useEvent(invite?.eventId);
  const venue = useVenue(event?.venueId);
  const tickets = useApp((s) => s.tickets);
  const blocked = useApp((s) => s.blocked);
  const bookings = useApp((s) => s.bookings);
  const methods = useApp((s) => s.paymentMethods);
  const selectedPayment = useApp((s) => s.selectedPayment);
  const respondInvite = useApp((s) => s.respondInvite);
  const payContribution = useApp((s) => s.payContribution);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const [paying, setPaying] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!invite || !event) {
    return (
      <Screen header={<ScreenHeader title="Invitation" onBack={() => goBack('/my-events')} />}>
        <EmptyState icon="email-remove-outline" title="Invitation not found" body="It may have been withdrawn by the host, or the link is no longer valid." action="My events" onAction={() => router.replace('/my-events')} />
      </Screen>
    );
  }
  if (blocked.includes(invite.fromId)) {
    return (
      <Screen header={<ScreenHeader title="Invitation" onBack={() => goBack('/my-events')} />}>
        <EmptyState icon="account-cancel-outline" title="Invitation hidden" body="You blocked the person who sent this invitation. Unblock them to see it again." action="Blocked accounts" onAction={() => router.push('/blocked')} />
      </Screen>
    );
  }

  const host = profileById(invite.fromId);
  const hostName = host?.name ?? 'The host';
  const ticket = invite.ticketId ? tickets.find((t) => t.id === invite.ticketId) : undefined;
  const contribution = invite.contribution ?? 0;
  const cs = event.costSharing;
  const method = methods.find((m) => m.id === selectedPayment) ?? methods[0];
  const state = eventState(event, bookings);
  const cancelled = state === 'cancelled';
  const ended = parse(event.end).getTime() < TODAY.getTime();
  const failed = invite.payment === 'failed';
  const st = guestInviteLabel(invite);
  const needsPayment = invite.status === 'accepted' && contribution > 0 && !ticket;
  const canAnswer = !cancelled && !ended;
  const current = invite.status === 'invited' || invite.status === 'declined' ? 0 : ticket ? 2 : 1;

  const accept = () => {
    respondInvite(invite.id, 'accepted');
    toast(contribution > 0 ? `Accepted · pay ${euro(contribution)} to get your ticket` : 'You’re going · your ticket is ready');
  };
  const pay = () => {
    if (paying) return;
    setPaying(true);
    timer.current = setTimeout(() => {
      const res = payContribution(invite.id);
      setPaying(false);
      toast(res.ok ? 'Payment verified · your ticket is ready' : 'Payment failed · no ticket issued');
    }, 700);
  };
  const failPayment = () => {
    payContribution(invite.id, { fail: true });
    toast('Payment failed · nothing charged, no ticket issued');
  };
  const message = () => router.push(`/chat/${ensureConversation(invite.fromId)}`);

  let footer = null;
  if (canAnswer && invite.status === 'invited') {
    footer = (
      <BottomBar>
        <Row gap={10}>
          <Button title="Decline" variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmDecline(true)} />
          <Button title={contribution > 0 ? 'Accept' : 'Accept · get ticket'} icon="check" style={{ flex: 1.4 }} onPress={accept} />
        </Row>
      </BottomBar>
    );
  } else if (canAnswer && needsPayment) {
    footer = (
      <BottomBar>
        <Button title={failed ? `Try again · ${euro(contribution)}` : `Pay ${euro(contribution)}`} icon="credit-card-outline" loading={paying} accessibilityLabel={`Pay your contribution of ${euro(contribution)}`} onPress={pay} />
      </BottomBar>
    );
  } else if (canAnswer && invite.status === 'declined') {
    footer = (
      <BottomBar>
        <Button title="Accept instead" variant="secondary" onPress={accept} />
      </BottomBar>
    );
  }

  return (
    <Screen header={<ScreenHeader title="Invitation" subtitle={`From ${hostName}`} onBack={() => goBack('/my-events')} />} footer={footer}>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <Photo src={event.cover} style={{ height: 170 }} accessibilityLabel={`${event.title} cover`} />
        <View style={{ padding: 14, gap: 6 }}>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Pill label={st.label} tone={st.tone} />
            <Pill label="Private · invite only" icon="lock-outline" tone="neutral" />
          </Row>
          <T v="h2">{event.title}</T>
          <T v="body">{eventWhen(event.start, event.end)}</T>
          <T v="small">{venue ? `${venue.name}, ${venue.area}` : 'Venue to be confirmed by the host'}</T>
        </View>
      </Card>

      {cancelled ? (
        <Banner icon="calendar-remove-outline" tone="danger">
          {`${hostName} cancelled this event${event.cancelReason ? `: ${event.cancelReason}` : ''}.${ticket?.paid ? ` Your ${euro(ticket.paid)} contribution is recorded; the host decides on refunds. Contact Help if you need support.` : ''}`}
        </Banner>
      ) : ended ? (
        <Banner icon="history">This event has ended.</Banner>
      ) : null}

      <Card style={{ gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${hostName}’s profile`} onPress={() => host && router.push(`/profile/${host.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar src={host?.avatar} size={48} label={hostName} verified={host?.verified} />
          <View style={{ flex: 1 }}>
            <T v="bodyBold">{hostName} invited you</T>
            <T v="small">{invite.sentAt ? `Sent ${ago(invite.sentAt)}` : 'Host'}</T>
          </View>
          <Icon name="chevron-right" size={20} color={colors.subtle} />
        </Pressable>
        {invite.message ? (
          <View style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.brandTint }}>
            <T v="body" color={colors.inkSoft}>“{invite.message}”</T>
          </View>
        ) : null}
        <T v="body" color={colors.muted}>{event.description}</T>
      </Card>

      <Card style={{ gap: 4 }}>
        <T v="title" style={{ marginBottom: 4 }}>{contribution > 0 ? 'Cost sharing' : 'Free invitation'}</T>
        {contribution > 0 ? (
          <>
            <KeyValue k="Your contribution" v={euro(contribution)} strong />
            {cs?.deadline ? <KeyValue k="Pay by" v={shortDate(cs.deadline)} /> : null}
            {cs?.note ? <KeyValue k="Covers" v={cs.note} /> : null}
            <KeyValue k="If it’s cancelled" v={event.refundPolicy} />
            <T v="small" style={{ marginTop: 4 }}>You pay only after accepting. Your ticket is issued once the payment is verified.</T>
          </>
        ) : (
          <T v="small">No contribution needed. Accepting issues your ticket straight away.</T>
        )}
      </Card>

      <Card>
        <Steps
          steps={[
            { title: 'Review the invitation', note: invite.status === 'declined' ? 'You declined' : undefined },
            { title: contribution > 0 ? `Accept and pay ${euro(contribution)}` : 'Accept', note: failed && !ticket ? 'Payment failed · nothing charged' : undefined },
            { title: 'Ticket with QR code', note: ticket ? `Code ${ticket.code}` : undefined },
          ]}
          current={current}
          failed={failed && !ticket && invite.status === 'accepted'}
        />
      </Card>

      {invite.status === 'declined' ? (
        <Banner icon="information-outline">{`You declined. ${hostName} can see your answer; their bookings are not affected.`}</Banner>
      ) : null}

      {needsPayment && canAnswer ? (
        <Card style={{ gap: 10 }}>
          <T v="title">Payment</T>
          {failed ? <Banner icon="credit-card-off-outline" tone="danger">The payment didn’t go through. Nothing was charged and no ticket was issued. Try again or choose another method.</Banner> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Pay with ${method?.label ?? 'card'}. Change payment method`}
            onPress={() => router.push('/payment-methods')}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}
          >
            <View style={{ minWidth: 48, height: 32, paddingHorizontal: 6, borderRadius: 8, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
              <T v="smallBold" color={colors.white} style={{ fontSize: 11 }}>{method?.badge ?? 'CARD'}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{method?.label ?? 'Add a payment method'}</T>
              <T v="small">{method?.sub ?? 'Needed to pay your contribution'}</T>
            </View>
            <T v="smallBold" color={colors.brand}>Change</T>
          </Pressable>
          <Divider />
          <KeyValue k="Total" v={euro(contribution)} strong />
          <Button title="Can’t come after all? Decline" variant="ghost" size="sm" onPress={() => setConfirmDecline(true)} />
          <DemoBar title="Demo: payment result" note="Shows what happens when the card is declined: no charge and no ticket.">
            <Button title="Simulate a failed payment" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={failPayment} />
          </DemoBar>
        </Card>
      ) : null}

      {ticket ? (
        <Card style={{ alignItems: 'center', gap: 10 }}>
          <Row justify="space-between" style={{ alignSelf: 'stretch' }}>
            <T v="title">Your ticket</T>
            {/* A cancelled event or a refunded ticket shows its changed status (F21), never "Valid". */}
            <Pill
              label={ticket.status === 'refunded' ? 'Refunded' : ticket.status === 'cancelled' ? 'Cancelled' : cancelled ? 'Event cancelled' : ticket.status === 'used' ? 'Checked in' : ended ? 'Event ended' : 'Valid'}
              tone={ticket.status === 'valid' && !cancelled && !ended ? 'success' : (ticket.status === 'used' || ended) && !cancelled ? 'neutral' : 'danger'}
            />
          </Row>
          {ticket.status === 'valid' && !cancelled && !ended ? (
            <View accessible accessibilityLabel={`QR code for ticket ${ticket.code}`} style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border }}>
              <QRCode value={JSON.stringify({ t: ticket.id, e: event.id, c: ticket.code })} size={168} color={colors.brandDeep} backgroundColor={colors.white} />
            </View>
          ) : (
            <Row gap={8} style={{ alignSelf: 'stretch', padding: 12, borderRadius: radius.md, backgroundColor: colors.chipIdle }}>
              <Icon name={ticket.status === 'used' && !cancelled ? 'check-circle-outline' : 'qrcode-remove'} size={20} color={colors.label} />
              <T v="small" style={{ flex: 1 }}>
                {ticket.status === 'used' && !cancelled ? 'Already scanned at the door.' : ended && !cancelled && ticket.status === 'valid' ? 'The event is over.' : 'This ticket is no longer valid for entry.'}
              </T>
            </Row>
          )}
          <T v="h3">{ticket.code}</T>
          <T v="small" center>{`${ticket.holder}${ticket.paid ? ` · paid ${euro(ticket.paid)}` : ' · free invitation'}`}</T>
          <Row gap={10} style={{ alignSelf: 'stretch' }}>
            <Button title="Open ticket" icon="qrcode" size="md" style={{ flex: 1 }} onPress={() => router.push(`/ticket/${ticket.id}`)} />
            <Button title="Event page" size="md" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/event/${event.id}`)} />
          </Row>
        </Card>
      ) : (
        <Button title="Open event page" variant="secondary" icon="calendar-text-outline" onPress={() => router.push(`/event/${event.id}`)} />
      )}

      <Button title={`Message ${hostName}`} variant="ghost" icon="message-outline" onPress={message} />

      <ActionSheet
        visible={confirmDecline}
        title="Decline the invitation?"
        cancelLabel="Keep the invitation"
        onClose={() => setConfirmDecline(false)}
        actions={[
          {
            label: 'Decline',
            icon: 'close-circle-outline',
            destructive: true,
            sub: `${hostName} is told you can’t come. Nothing is charged.`,
            onPress: () => {
              respondInvite(invite.id, 'declined');
              toast('Invitation declined');
            },
          },
        ]}
      />
    </Screen>
  );
}
