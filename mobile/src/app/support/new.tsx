import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Divider, Field, Icon, Radio, Row, Segmented, T } from '../../components/ui';
import type { SupportCase } from '../../data/types';
import { bookingLabel, bookingRef, providerOf } from '../../lib/booking';
import { shortDate } from '../../lib/format';
import { ISSUE_TOPICS, LINK_KIND_LABEL, type LinkKind, TICKET_STATUS_LABEL, topicByKey } from '../../lib/support';
import { toast } from '../../store/toast';
import { useAllEvents, useApp, useInvitedEvents } from '../../store/useApp';
import { colors } from '../../theme';

type Choice = LinkKind | 'none';

interface Option {
  id: string;
  label: string;
  sub: string;
}

const MIN_TEXT = 10;
const PREVIEW = 5;

const PLACEHOLDER: Record<string, string> = {
  booking: 'What happened, and what would you like us to do?',
  payment: 'Which payment, what you expected and what you see now',
  ticket: 'What happens when you open or scan the ticket?',
  event: 'What changed, or what do you need from the host?',
  account: 'What are you trying to do in your account?',
  safety: 'What happened? For an appeal, tell us which decision and why.',
  other: 'Tell us what you need help with',
};

const topicForKind = (kind?: string) => (kind === 'booking' ? 'booking' : kind === 'ticket' ? 'ticket' : kind === 'event' ? 'event' : kind === 'account' ? 'account' : undefined);

export default function NewSupportCase() {
  const params = useLocalSearchParams<{ topic?: string; kind?: string; id?: string }>();
  const bookings = useApp((s) => s.bookings);
  const tickets = useApp((s) => s.tickets);
  const myEvents = useApp((s) => s.myEvents);
  const openCase = useApp((s) => s.openCase);
  const allEvents = useAllEvents();
  const invited = useInvitedEvents();

  const initialTopic = topicByKey(params.topic) ?? topicByKey(topicForKind(params.kind));
  const initialKind: Choice = params.kind === 'booking' || params.kind === 'ticket' || params.kind === 'event' ? params.kind : initialTopic?.links[0] ?? 'none';

  const [topicKey, setTopicKey] = useState<string | undefined>(initialTopic?.key);
  const [kind, setKind] = useState<Choice>(initialKind);
  const [picked, setPicked] = useState<string | undefined>(params.id);
  const [showAll, setShowAll] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [createdId, setCreatedId] = useState<string>();
  const created = useApp((s) => (createdId ? s.supportCases.find((c) => c.id === createdId) : undefined));

  const topic = topicByKey(topicKey);

  const eventTitle = useMemo(() => {
    const map: Record<string, string> = {};
    allEvents.forEach((e) => (map[e.id] = e.title));
    invited.forEach(({ event }) => (map[event.id] = event.title));
    return map;
  }, [allEvents, invited]);

  // The user's own records only: bookings, tickets, and events they host, were invited to or hold a ticket for.
  const options = useMemo<Record<LinkKind, Option[]>>(() => {
    const booking = [...bookings]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((b) => ({ id: b.id, label: `${providerOf(b).name} · ${b.eventTitle}`, sub: `${bookingRef(b)} · ${bookingLabel(b)} · ${shortDate(b.date)}` }));
    const ticket = tickets.map((t) => ({ id: t.id, label: eventTitle[t.eventId] ?? 'Ticket', sub: `Ticket ${t.code} · ${TICKET_STATUS_LABEL[t.status]}` }));
    const seen = new Set<string>();
    const event: Option[] = [];
    const add = (id: string, role: string) => {
      if (seen.has(id)) return;
      const e = allEvents.find((x) => x.id === id) ?? invited.find((x) => x.event.id === id)?.event;
      if (!e) return;
      seen.add(id);
      event.push({ id, label: e.title, sub: `${shortDate(e.start)} · ${role}` });
    };
    myEvents.forEach((e) => add(e.id, 'You host it'));
    invited.forEach(({ event: e }) => add(e.id, 'You were invited'));
    tickets.forEach((t) => add(t.eventId, 'You have a ticket'));
    return { booking, ticket, event };
  }, [bookings, tickets, myEvents, allEvents, invited, eventTitle]);

  const list = kind === 'none' ? [] : options[kind];
  const pickedOption = kind === 'none' ? undefined : list.find((o) => o.id === picked);
  // A record picked from a deep link stays visible even when it is beyond the first few.
  const pickedIndex = pickedOption ? list.indexOf(pickedOption) : -1;
  const visible = showAll ? list : pickedOption && pickedIndex >= PREVIEW ? [pickedOption, ...list.slice(0, PREVIEW - 1)] : list.slice(0, PREVIEW);

  const chooseTopic = (key: string) => {
    const next = topicByKey(key);
    setTopicKey(key);
    setError(undefined);
    if (!next) return;
    if (next.account || !next.links.length) return setKind('none');
    if (kind === 'none' || !next.links.includes(kind)) {
      setKind(next.links[0]);
      setPicked(undefined);
      setShowAll(false);
    }
  };

  const chooseKind = (k: Choice) => {
    setKind(k);
    setPicked(undefined);
    setShowAll(false);
  };

  const submit = () => {
    if (!topic) return setError('Choose what your issue is about');
    if (text.trim().length < MIN_TEXT) return setError(`Describe the issue in at least ${MIN_TEXT} characters`);
    let linked: SupportCase['linked'];
    let suffix = '';
    if (topic.account) linked = { kind: 'account', id: 'account' };
    else if (kind !== 'none' && pickedOption) {
      linked = { kind, id: pickedOption.id };
      const b = kind === 'booking' ? bookings.find((x) => x.id === pickedOption.id) : undefined;
      const t = kind === 'ticket' ? tickets.find((x) => x.id === pickedOption.id) : undefined;
      suffix = b ? ` · Booking ${bookingRef(b)}` : t ? ` · Ticket ${t.code}` : ` · ${pickedOption.label}`;
    }
    const id = openCase(`${topic.label}${suffix}`, text.trim(), linked);
    setCreatedId(id);
    const ref = useApp.getState().supportCases.find((c) => c.id === id)?.ref;
    toast(ref ? `Case ${ref} opened` : 'Support case opened');
  };

  if (createdId) {
    return (
      <Screen header={<ScreenHeader title="Case opened" close onBack={() => router.replace('/support')} />}>
        <View style={{ alignItems: 'center', paddingTop: 24, gap: 12 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check-circle-outline" size={48} color={colors.success} />
          </View>
          <T v="h2" center>{created ? `Case ${created.ref}` : 'Case opened'}</T>
          <T v="body" color={colors.muted} center>Keep this reference. You’ll find the case and every reply under My cases.</T>
        </View>
        <Card style={{ gap: 10 }}>
          <T v="title">What happens next</T>
          {[
            { icon: 'account-search-outline' as const, text: 'Support reads your case and the record you linked.' },
            { icon: 'message-text-outline' as const, text: 'If they need more information, they ask in the case and you get a notification.' },
            { icon: 'scale-balance' as const, text: 'You see the outcome in the case timeline and can appeal it from there.' },
          ].map((r) => (
            <Row key={r.icon} gap={12} align="flex-start">
              <Icon name={r.icon} size={20} color={colors.brand} />
              <T v="body" style={{ flex: 1 }}>{r.text}</T>
            </Row>
          ))}
        </Card>
        <Banner icon="information-outline">Response times are not fixed yet during the beta. Support can’t promise a refund before an authorized decision.</Banner>
        <Button title="View case" icon="file-document-outline" onPress={() => router.replace(`/support/${createdId}`)} />
        <Button title="All my cases" variant="secondary" onPress={() => router.replace('/support')} />
      </Screen>
    );
  }

  const kinds: Choice[] = topic && !topic.account ? [...topic.links, 'none'] : [];

  return (
    <Screen
      keyboard
      header={<ScreenHeader title="New support case" subtitle="Help › Support" onBack={() => goBack('/help')} />}
      footer={
        <BottomBar>
          <Button title="Submit case" icon="send-outline" onPress={submit} />
        </BottomBar>
      }
    >
      <View style={{ gap: 10 }}>
        <T v="h3" accessibilityRole="header">1. What is it about?</T>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {ISSUE_TOPICS.map((t) => {
            const on = t.key === topicKey;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${t.label}. ${t.hint}`}
                onPress={() => chooseTopic(t.key)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 56, borderRadius: 16, backgroundColor: on ? colors.brandSoft : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.border, opacity: pressed ? 0.85 : 1 })}
              >
                <Icon name={t.icon} size={22} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <T v="bodyBold">{t.label}</T>
                  <T v="small">{t.hint}</T>
                </View>
                <Radio selected={on} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {topic ? (
        <View style={{ gap: 10 }}>
          <T v="h3" accessibilityRole="header">2. Link the record</T>
          {topic.key === 'safety' ? (
            <Banner icon="alert-octagon-outline" tone="danger">Someone in danger right now? Call 112 first and tell the venue or organizer on site. A support case is for follow-up.</Banner>
          ) : null}
          {topic.account ? (
            <Banner icon="account-circle-outline">This case is linked to your account. Support sees your account details, not your private messages.</Banner>
          ) : kinds.length > 1 ? (
            <>
              <T v="small">Optional. Linking it lets support see the booking, payment state and timeline.</T>
              {kinds.length > 2 ? (
                <Segmented options={kinds.map((k) => ({ key: k, label: k === 'none' ? 'None' : LINK_KIND_LABEL[k] }))} value={kind} onChange={chooseKind} />
              ) : null}
              {kind === 'none' ? (
                <Banner icon="information-outline">No record linked. Your case goes to general account support.</Banner>
              ) : list.length ? (
                <Card style={{ paddingVertical: 4 }}>
                  <View accessibilityRole="radiogroup">
                    {visible.map((o, i) => {
                      const on = o.id === picked;
                      return (
                        <View key={o.id}>
                          {i ? <Divider /> : null}
                          <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${o.label}, ${o.sub}`} onPress={() => setPicked(on ? undefined : o.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 }}>
                            <Radio selected={on} />
                            <View style={{ flex: 1 }}>
                              <T v="bodyBold" numberOfLines={1}>{o.label}</T>
                              <T v="small" numberOfLines={1}>{o.sub}</T>
                            </View>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                  {list.length > PREVIEW ? (
                    <Button title={showAll ? 'Show fewer' : `Show all ${list.length}`} variant="ghost" size="sm" onPress={() => setShowAll(!showAll)} style={{ alignSelf: 'flex-start' }} />
                  ) : null}
                </Card>
              ) : (
                <Banner icon="information-outline">{`You have no ${LINK_KIND_LABEL[kind].toLowerCase()}s yet. Submit without a record and your case goes to general support.`}</Banner>
              )}
              {kind !== 'none' && list.length && !pickedOption ? <T v="small">No record selected: the case goes to general support.</T> : null}
            </>
          ) : (
            <Banner icon="information-outline">No record needed. Your case goes to general support.</Banner>
          )}
        </View>
      ) : null}

      {topic ? (
        <View style={{ gap: 10 }}>
          <T v="h3" accessibilityRole="header">3. Describe it</T>
          <Field
            value={text}
            onChangeText={(t) => {
              setText(t);
              setError(undefined);
            }}
            multiline
            placeholder={PLACEHOLDER[topic.key] ?? PLACEHOLDER.other}
            accessibilityLabel="Describe the issue"
          />
          <T v="small">Don’t share card numbers or passwords. Support never asks for them.</T>
        </View>
      ) : null}

      {error ? (
        <Row gap={6}>
          <Icon name="alert-circle-outline" size={18} color={colors.danger} />
          <T v="small" color={colors.danger}>{error}</T>
        </Row>
      ) : null}
    </Screen>
  );
}
