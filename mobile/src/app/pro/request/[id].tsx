import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../../components/layout';
import { Avatar, Banner, Button, Card, Divider, Field, Icon, KeyValue, Radio, Row, Stepper, T } from '../../../components/ui';
import { profiles } from '../../../data/mock';
import type { IncomingRequest } from '../../../data/types';
import { euro, isoDay, MONTHS_LONG } from '../../../lib/format';
import { toast } from '../../../store/toast';
import { type Availability, useApp, type Weekday } from '../../../store/useApp';
import { colors } from '../../../theme';

const REASONS = ['Already booked that date', 'Offer below my fee', 'Not my music style', 'Other reason'];
const FEE_RATE = 0.1;
const WEEKDAY: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Text colour on brand-tinted banners (same as Banner's own text). */
const COUNTER_INK = '#2E1D5E';

/** "Thu 24 Dec 2026" -> Date */
function requestDate(label: string) {
  const [, d, mon, y] = label.split(' ');
  const m = MONTHS_LONG.findIndex((x) => x.startsWith(mon ?? ''));
  const date = new Date(Number(y), m, Number(d), 12);
  return Number.isNaN(date.getTime()) || m < 0 ? undefined : date;
}

/** Checks the request against your availability and other accepted gigs. */
function conflictFor(req: IncomingRequest, all: IncomingRequest[], availability: Availability) {
  const date = requestDate(req.date);
  if (!date) return undefined;
  const iso = isoDay(date);
  const other = all.find((r) => r.id !== req.id && r.status === 'accepted' && r.date === req.date);
  if (other) return { tone: 'danger' as const, text: `You already accepted ${other.title} that night.` };
  if (availability.blockedDates.includes(iso)) return { tone: 'warning' as const, text: 'You blocked this date in your availability.' };
  const wd = WEEKDAY[date.getDay()];
  if (!availability.days[wd]) return { tone: 'warning' as const, text: `${wd} isn’t one of your usual gig days.` };
  return undefined;
}

export default function RequestReview() {
  const { id, decline } = useLocalSearchParams<{ id: string; decline?: string }>();
  const insets = useSafeAreaInsets();
  const req = useApp((s) => s.requests.find((r) => r.id === id));
  const requests = useApp((s) => s.requests);
  const availability = useApp((s) => s.availability);
  const setStatus = useApp((s) => s.setRequestStatus);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const sendMessage = useApp((s) => s.sendMessage);
  const counterRequest = useApp((s) => s.counterRequest);
  const [sheet, setSheet] = useState(decline === '1');
  const [reason, setReason] = useState(REASONS[0]);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counter, setCounter] = useState(0);
  const [counterNote, setCounterNote] = useState('');

  if (!req) {
    return (
      <Screen header={<ScreenHeader title="Request" onBack={() => goBack('/pro/requests')} />}>
        <T v="body">Request not found.</T>
        <Button title="All requests" onPress={() => router.replace('/pro/requests')} />
      </Screen>
    );
  }
  // A saved counter offer is pending until the booker answers; accepting takes their original offer.
  const countered = req.status === 'new' ? req.counterOffer : undefined;
  const amount = countered ?? req.offer;
  const fee = amount * FEE_RATE;
  const first = req.requester.split(' ')[0];
  // Requests from people with a Domtak profile can be answered in chat.
  const contact = profiles.find((p) => p.name === req.requester);
  const conflict = conflictFor(req, requests, availability);
  const openChat = () => (contact ? router.push(`/chat/${ensureConversation(contact.id)}`) : router.push('/inbox'));
  const startCounter = () => {
    setCounter(countered ?? Math.max(availability.feePerHour * req.hours, req.offer + 100));
    setCounterNote(req.counterNote ?? '');
    setCounterOpen(true);
  };
  const sendCounter = () => {
    const note = counterNote.trim();
    const edited = countered !== undefined;
    counterRequest(req.id, counter, note);
    setCounterOpen(false);
    if (contact) {
      const cid = ensureConversation(contact.id);
      sendMessage(cid, { type: 'text', text: `${edited ? 'Updated counter offer' : 'Counter offer'} for ${req.title} (${req.date}): ${euro(counter)} for ${req.hours} h.${note ? ` ${note}` : ''}` });
    }
    toast(`${edited ? 'Updated counter offer' : 'Counter offer'} of ${euro(counter)} sent to ${first}`);
  };
  const accept = () => {
    setStatus(req.id, 'accepted');
    toast(`Accepted ${req.title} for ${euro(req.offer)}. ${first} has 24 h to pay.`);
  };

  if (req.status === 'accepted' && !sheet) {
    return (
      <Screen
        header={<ScreenHeader title={req.title} onBack={() => goBack('/pro/requests')} />}
        footer={
          <BottomBar>
            <Button title={contact ? `Message ${first}` : 'Open inbox'} icon="message-text-outline" onPress={openChat} />
            <Button title="Open calendar" variant="ghost" onPress={() => { const d = requestDate(req.date); router.push(d ? { pathname: '/(tabs)/calendar', params: { date: isoDay(d) } } : '/(tabs)/calendar'); }} style={{ marginTop: 6 }} />
          </BottomBar>
        }
        contentStyle={{ alignItems: 'center', gap: 14, paddingTop: 40, paddingHorizontal: 24 }}
      >
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={48} color={colors.white} />
        </View>
        <T v="h2" center>Booking accepted</T>
        <T v="body" color={colors.muted} center>{req.requester} has 24 h to pay. We’ll notify you when {euro(req.offer)} is held in escrow and the date is locked in your calendar.</T>
        <Card style={{ alignSelf: 'stretch', gap: 6, marginTop: 8 }}>
          <KeyValue k="Date" v={req.date} />
          <KeyValue k="Time" v={req.time} />
          <KeyValue k="Offer" v={euro(req.offer, true)} />
          <KeyValue k="You receive" v={euro(req.offer * (1 - FEE_RATE), true)} color={colors.brand} />
        </Card>
      </Screen>
    );
  }

  return (
    <>
      <Screen
        header={<ScreenHeader title={`Request from ${first}`} onBack={() => goBack('/pro/requests')} />}
        footer={
          req.status === 'new' ? (
            <BottomBar>
              <Row gap={8}>
                <Button title="Decline" variant="secondary" size="md" style={{ flex: 1, borderColor: colors.borderStrong }} onPress={() => setSheet(true)} />
                <Button title="Counter" accessibilityLabel={countered ? `Edit your counter offer of ${euro(countered)}` : 'Make a counter offer'} variant="secondary" size="md" style={{ flex: 1, paddingHorizontal: 12 }} onPress={startCounter} />
                <Button title="Accept" accessibilityLabel={`Accept ${first}’s offer of ${euro(req.offer)}`} size="md" style={{ flex: 1 }} onPress={accept} />
              </Row>
            </BottomBar>
          ) : null
        }
      >
        <Row gap={12}>
          <Avatar src={contact?.avatar} label={req.initials} size={48} verified={contact?.verified} />
          <View style={{ flex: 1 }}>
            <T v="bodyBold">{req.requester}</T>
            <T v="small">{req.requesterRole}</T>
          </View>
          {req.status === 'new' ? <T v="smallBold" color={colors.warning}>Expires in {req.expires}</T> : null}
        </Row>
        <Card style={{ gap: 12 }}>
          <T v="h2">{req.title}</T>
          <KeyValue k="Date" v={req.date} />
          <KeyValue k="Time" v={`${req.time} (${req.hours} h)`} />
          <KeyValue k="Location" v={req.location} />
          <KeyValue k="Guests" v={`~${req.guests} people`} />
          <KeyValue k="Equipment" v={req.equipment} />
          {req.message ? <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.brandTint }}><T v="body" color="#2E1D5E">“{req.message}”</T></View> : null}
        </Card>
        {req.status === 'new' ? (
          conflict ? (
            <Banner icon="calendar-alert" tone={conflict.tone}>{conflict.text}</Banner>
          ) : (
            <Banner icon="calendar-check" tone="success">You’re free that night. No calendar conflicts.</Banner>
          )
        ) : null}
        {countered !== undefined ? (
          <Banner icon="swap-horizontal" tone="brand">
            <View style={{ gap: 8 }}>
              <View style={{ gap: 2 }}>
                <T v="bodyBold" color={COUNTER_INK}>Counter offer {euro(countered)} sent</T>
                <T v="small" color={COUNTER_INK}>{`${first} offered ${euro(req.offer)} and can accept your counter or reply${contact ? ' in chat' : ''}. Tap Accept to take the original offer instead.`}</T>
                {req.counterNote ? <T v="small" color={COUNTER_INK}>{`Your note: “${req.counterNote}”`}</T> : null}
              </View>
              <Button title="Edit counter offer" icon="pencil-outline" variant="secondary" size="sm" accessibilityLabel={`Edit your counter offer of ${euro(countered)}`} style={{ alignSelf: 'flex-start' }} onPress={startCounter} />
            </View>
          </Banner>
        ) : null}
        <Card style={{ gap: 6 }}>
          {countered !== undefined ? <KeyValue k="Their offer" v={euro(req.offer, true)} /> : null}
          <KeyValue k={countered !== undefined ? 'Your counter offer' : 'Offer'} v={euro(amount, true)} />
          <KeyValue k="Domtak fee (10%)" v={`−${euro(fee, true)}`} />
          <Divider style={{ marginVertical: 6 }} />
          <KeyValue k={countered !== undefined ? `You receive if ${first} accepts` : 'You receive'} v={euro(amount - fee, true)} strong color={colors.brand} />
          <T v="small" style={{ fontSize: 12 }}>Paid into escrow when the booker pays, released 24 h after the gig.</T>
        </Card>
        {req.status === 'declined' ? <Banner icon="close" tone="danger">You declined this request. The booker was notified and not charged.</Banner> : null}
        {req.status === 'past' ? <Banner icon="check" tone="success">Completed and paid out.</Banner> : null}
        {contact && req.status !== 'new' ? <Button title={`Message ${first}`} variant="secondary" icon="message-text-outline" onPress={openChat} /> : null}
      </Screen>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1 }} onPress={() => setSheet(false)} />
          <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: insets.bottom + 20, gap: 12 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
            <T v="h3">Why are you declining?</T>
            <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
              {REASONS.map((r) => (
                <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: reason === r }} onPress={() => setReason(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: reason === r ? 2 : 1, borderColor: reason === r ? colors.brand : colors.border, backgroundColor: reason === r ? colors.brandTint : colors.surface }}>
                  <Radio selected={reason === r} />
                  <T v="body">{r}</T>
                </Pressable>
              ))}
            </View>
            <T v="small">The requester is notified and not charged.</T>
            <Row gap={10}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setSheet(false)} />
              <Button
                title="Decline request"
                variant="danger"
                style={{ flex: 1 }}
                onPress={() => {
                  setStatus(req.id, 'declined');
                  setSheet(false);
                  toast(`Declined: ${reason.toLowerCase()}`);
                  goBack('/pro/requests');
                }}
              />
            </Row>
          </View>
        </View>
      </Modal>

      <Modal visible={counterOpen} transparent animationType="slide" onRequestClose={() => setCounterOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close counter offer" style={{ flex: 1 }} onPress={() => setCounterOpen(false)} />
            <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: insets.bottom + 20, gap: 14 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
              <T v="h3">{countered !== undefined ? 'Edit counter offer' : 'Counter offer'}</T>
              <T v="small">{req.title} · {req.date} · {req.hours} h. {first} offered {euro(req.offer)}; your usual fee is {euro(availability.feePerHour)}/h ({euro(availability.feePerHour * req.hours)}).</T>
              <Row justify="space-between">
                <View>
                  <T v="label">Your price</T>
                  <T v="small">{euro(counter / req.hours)}/h</T>
                </View>
                <Stepper value={counter} onChange={setCounter} min={50} max={20000} step={50} label="counter offer" format={(n) => euro(n)} />
              </Row>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {[req.offer + 100, req.offer + 250, availability.feePerHour * req.hours].filter((v, i, all) => v > 0 && all.indexOf(v) === i).map((v) => (
                  <Button key={v} title={euro(v)} variant={counter === v ? 'primary' : 'light'} size="sm" accessibilityState={{ selected: counter === v }} onPress={() => setCounter(v)} />
                ))}
              </Row>
              <Field label="Note (optional)" value={counterNote} onChangeText={setCounterNote} placeholder="e.g. Includes my own CDJs and an extra 30 min" multiline />
              <KeyValue k="You’d receive" v={euro(counter * (1 - FEE_RATE), true)} color={colors.brand} />
              <Row gap={10}>
                <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setCounterOpen(false)} />
                <Button title={countered !== undefined ? 'Update counter' : 'Send counter'} style={{ flex: 1 }} disabled={counter === req.offer} onPress={sendCounter} />
              </Row>
              {counter === req.offer ? <T v="small" center>That’s the same as the offer. Tap Accept instead.</T> : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
