import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack } from '../../components/layout';
import { Banner, Button, type IconName, IconButton, Photo, Pill, Row, T, type Tone } from '../../components/ui';
import { venueById } from '../../data/mock';
import { eventState } from '../../lib/events';
import { dateTime, euro, isoDay, parse, time, TODAY } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp, useEvent } from '../../store/useApp';
import { colors, fonts } from '../../theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** What the holder sees: the ticket's own status, or the event's cancellation, which also ends its validity (F21). */
type Validity = 'valid' | 'used' | 'cancelled' | 'refunded' | 'event_cancelled' | 'ended';

const LOOK: Record<Validity, { label: string; tone: Tone; icon: IconName }> = {
  valid: { label: 'Valid', tone: 'success', icon: 'check-decagram' },
  used: { label: 'Checked in', tone: 'neutral', icon: 'check' },
  cancelled: { label: 'Cancelled', tone: 'danger', icon: 'close-circle-outline' },
  refunded: { label: 'Refunded', tone: 'neutral', icon: 'cash-refund' },
  event_cancelled: { label: 'Event cancelled', tone: 'danger', icon: 'calendar-remove-outline' },
  ended: { label: 'Event ended', tone: 'neutral', icon: 'calendar-check-outline' },
};

function Notch({ side }: { side: 'left' | 'right' }) {
  return <View style={{ position: 'absolute', [side]: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandDeep, top: -22 }} />;
}

export default function ETicket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tickets = useApp((s) => s.tickets);
  const bookings = useApp((s) => s.bookings);
  const ticket = tickets.find((t) => t.id === id);
  // Every ticket in the same order has its own QR, so let the holder page through them.
  const siblings = useMemo(() => (ticket ? tickets.filter((t) => t.eventId === ticket.eventId && t.status === ticket.status) : []), [tickets, ticket]);
  const event = useEvent(ticket?.eventId);
  const going = useApp((s) => (ticket ? !!s.going[ticket.eventId] : false));
  const toggleGoing = useApp((s) => s.toggleGoing);
  const reviewed = useApp((s) => (ticket ? !!s.reviews[ticket.eventId] : false));

  if (!ticket || !event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.brandDeep }}>
        <Row style={{ paddingHorizontal: 8 }}>
          <IconButton name="chevron-left" label="Back" color={colors.white} iconSize={30} onPress={() => goBack('/my-bookings?tab=tickets')} />
        </Row>
        <View style={{ padding: 24, gap: 12 }}>
          <T v="h2" color={colors.white}>Ticket not found</T>
          <T v="body" color={colors.lilacLight}>It may have been refunded or moved to another account.</T>
          <Button title="Your tickets" variant="outlineLight" onPress={() => router.replace('/my-bookings?tab=tickets')} />
        </View>
      </SafeAreaView>
    );
  }
  const addToCalendar = () => {
    // Tickets already count as plans; marking "going" keeps the event in the calendar even after check-in.
    if (!going) toggleGoing(event.id);
    toast(going ? `${event.title} is in your calendar` : `Added ${event.title} to your calendar`);
    router.push({ pathname: '/(tabs)/calendar', params: { date: isoDay(parse(event.start)) } });
  };
  const type = event.ticketTypes.find((t) => t.id === ticket.typeId);
  const d = parse(event.start);
  const pos = siblings.findIndex((t) => t.id === ticket.id);
  const ended = parse(event.end) < TODAY;
  const cancelledEvent = eventState(event, bookings) === 'cancelled';
  const validity: Validity =
    ticket.status === 'refunded'
      ? 'refunded'
      : ticket.status === 'cancelled'
        ? 'cancelled'
        : ticket.status === 'used'
          ? 'used'
          : cancelledEvent
            ? 'event_cancelled'
            : ended
              ? 'ended'
              : 'valid';
  const look = LOOK[validity];
  const usable = validity === 'valid';
  const changed = validity === 'cancelled' || validity === 'refunded' || validity === 'event_cancelled';
  const statusLabel = validity === 'used' && ticket.checkedInAt ? `Checked in at ${time(ticket.checkedInAt)}` : look.label;
  // After the night (or once scanned in) the useful next step is a review, not the calendar.
  const over = ended || validity === 'used';
  const showTicket = (i: number) => router.setParams({ id: siblings[i].id });
  const payload = JSON.stringify({ t: ticket.id, e: event.id, c: ticket.code });
  const paid = ticket.paid ?? type?.price;

  const changedNote =
    validity === 'refunded'
      ? `This ticket was refunded${paid ? ` (${euro(paid, !Number.isInteger(paid))})` : ''}. It can no longer be used for entry.`
      : validity === 'cancelled'
        ? 'This ticket was cancelled and can no longer be used for entry.'
        : validity === 'event_cancelled'
          ? `The host cancelled this event${event.cancelReason ? `: ${event.cancelReason}` : ''}. The ticket is no longer valid for entry. Any refund is handled under the event’s refund policy.`
          : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.brandDeep }}>
      <Row style={{ paddingHorizontal: 8 }} justify="space-between">
        <IconButton name="chevron-left" label="Back" color={colors.white} iconSize={30} onPress={() => goBack('/my-bookings?tab=tickets')} />
        {usable ? (
          <IconButton name="share-variant-outline" label="Share ticket" color={colors.white} onPress={() => Share.share({ message: `My ticket for ${event.title}: ${ticket.code}` }).catch(() => toast('Could not open the share sheet'))} />
        ) : null}
      </Row>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 8, justifyContent: 'center', gap: 14 }} showsVerticalScrollIndicator={false}>
        {changedNote ? (
          <Banner icon={look.icon} tone="danger">{changedNote}</Banner>
        ) : null}
        <View style={{ backgroundColor: '#F8F7FB', borderRadius: 18 }}>
          <View style={{ alignItems: 'center', padding: 20, gap: 12 }}>
            <Photo src={event.cover} style={{ width: 200, height: 150, opacity: changed ? 0.6 : 1 }} radius={18} />
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: changed ? colors.subtle : '#7A3BC0', textAlign: 'center', textDecorationLine: changed ? 'line-through' : 'none' }}>
              {event.title}
              {event.subtitle ? <Text style={{ fontSize: 15 }}> {event.subtitle}</Text> : null}
            </Text>
            <View accessibilityLiveRegion="polite">
              <Pill label={statusLabel} tone={look.tone} icon={look.icon} />
            </View>
            {validity === 'used' && ticket.checkedInAt ? <T v="small" center>Scanned at the entrance on {dateTime(ticket.checkedInAt)}</T> : null}
          </View>
          <View style={{ height: 2, backgroundColor: colors.brandDeep }}>
            <Notch side="left" />
            <Notch side="right" />
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            <Row justify="space-between" align="flex-start" gap={12}>
              <View style={{ gap: 4, flex: 1 }}><T v="small" color={colors.ink}>Date</T><T v="bodyBold" color={colors.brandDeep}>{DAYS[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()} {d.getFullYear()}</T></View>
              <View style={{ gap: 4, flex: 1, alignItems: 'flex-end' }}><T v="small" color={colors.ink}>Time</T><T v="bodyBold" color={colors.brandDeep} style={{ textAlign: 'right' }}>Start {time(event.start)}</T></View>
            </Row>
            <Row justify="space-between" align="flex-start" gap={12}>
              <View style={{ gap: 4, flex: 1 }}><T v="small" color={colors.ink}>Venue</T><T v="bodyBold" color={colors.brandDeep}>{venueById(event.venueId)?.name ?? 'To be announced'}</T></View>
              <View style={{ gap: 4, flex: 1, alignItems: 'flex-end' }}><T v="small" color={colors.ink}>Ticket</T><T v="bodyBold" color={colors.brandDeep} style={{ textAlign: 'right' }}>{type?.name ?? 'Entry'} · No seat</T></View>
            </Row>
            {event.isPrivate ? (
              <Row gap={6}>
                <Pill label="Private event" icon="lock-outline" tone="neutral" />
                {ticket.paid ? <Pill label={`Contribution ${euro(ticket.paid, !Number.isInteger(ticket.paid))} paid`} tone="neutral" icon="cash" /> : null}
              </Row>
            ) : null}
          </View>
          <View style={{ height: 2, backgroundColor: colors.brandDeep }}>
            <Notch side="left" />
            <Notch side="right" />
          </View>
          <View style={{ alignItems: 'center', padding: 20, gap: 10 }}>
            <T v="title">QR code</T>
            <View accessible accessibilityLabel={usable ? `Entry QR code for ticket ${ticket.code}` : `QR code, ${statusLabel}. Not valid for entry`} style={{ padding: 12, backgroundColor: colors.white, borderRadius: 12 }}>
              <View style={{ opacity: usable ? 1 : 0.2 }}>
                <QRCode value={payload} size={170} color={colors.brandDeep} backgroundColor={colors.white} />
              </View>
              {!usable ? (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: look.tone === 'danger' ? colors.danger : colors.inkSoft }}>
                    <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 15 }}>{validity === 'used' ? 'Already used' : validity === 'ended' ? 'Event ended' : 'Not valid'}</Text>
                  </View>
                </View>
              ) : null}
            </View>
            <T v="smallBold" color={colors.muted} style={{ letterSpacing: 2, textDecorationLine: changed ? 'line-through' : 'none' }}>{ticket.code}</T>
            <T v="small" center>
              {usable
                ? `Holder: ${ticket.holder} · show this at the entrance. Staff scan it once; validity is checked at the door.`
                : validity === 'used'
                  ? `Holder: ${ticket.holder} · this ticket has been used for entry.`
                  : `Holder: ${ticket.holder}`}
            </T>
            {siblings.length > 1 ? (
              <Row gap={8}>
                <IconButton name="chevron-left" label="Previous ticket" disabled={pos <= 0} onPress={() => showTicket(pos - 1)} bg={colors.brandSoft} color={colors.brandDeep} size={44} />
                <T v="bodyBold" color={colors.brandDeep} accessibilityLiveRegion="polite">Ticket {pos + 1} of {siblings.length}</T>
                <IconButton name="chevron-right" label="Next ticket" disabled={pos >= siblings.length - 1} onPress={() => showTicket(pos + 1)} bg={colors.brandSoft} color={colors.brandDeep} size={44} />
              </Row>
            ) : null}
          </View>
        </View>
      </ScrollView>
      <View style={{ padding: 24, paddingTop: 0, gap: 10 }}>
        {changed ? (
          <>
            <Button title="Refund details" icon="cash-refund" variant="outlineLight" onPress={() => router.push('/help?section=refunds')} />
            {ticket.inviteId ? <Button title="View invitation" icon="email-open-outline" variant="outlineLight" size="md" onPress={() => router.push(`/invitation/${ticket.inviteId}`)} /> : null}
          </>
        ) : over ? (
          <Button title={reviewed ? 'Edit your review' : 'Leave a review'} icon="star-outline" variant="outlineLight" onPress={() => router.push(`/review/${event.id}`)} />
        ) : (
          <Button title={going ? 'View in calendar' : 'Add to calendar'} icon="calendar-plus" variant="outlineLight" onPress={addToCalendar} />
        )}
      </View>
    </SafeAreaView>
  );
}
