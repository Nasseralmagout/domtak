import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Share, View } from 'react-native';

import { PersonRow } from '../components/cards';
import { BottomBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Chip, EmptyState, Field, Icon, IconButton, Photo, Pill, Row, T, Toggle } from '../components/ui';
import { profiles } from '../data/mock';
import type { EventItem, Profile } from '../data/types';
import { deadlineChoices, hostsEvent, invitationLabel } from '../lib/eventHost';
import { budget, draftIssues, EVENT_STATE_TONE, eventState, eventStateLabel, guestSummary } from '../lib/events';
import { euro, eventWhen, parse, plural, shortDate, TODAY } from '../lib/format';
import { toast } from '../store/toast';
import { useApp, useEvent } from '../store/useApp';
import { colors, radius } from '../theme';

const MAX_SHARE = 500;

/** Public events only: a private event opens only through an explicit invitation (F11), so it has no shareable link. */
const shareInvite = (event: EventItem) =>
  Share.share({ message: `Join me at ${event.title} (${eventWhen(event.start, event.end)}) on Domtak` }).catch(() => toast('Could not open the share sheet'));

/** Invite friends or permitted contacts and set cost sharing for one event you host (F20). */
function InviteForm({ event }: { event: EventItem }) {
  const following = useApp((s) => s.following);
  const friends = useApp((s) => s.friends);
  const blocked = useApp((s) => s.blocked);
  const bookings = useApp((s) => s.bookings);
  const inviteGuests = useApp((s) => s.inviteGuests);
  const setCostSharing = useApp((s) => s.setCostSharing);
  const setEventState = useApp((s) => s.setEventState);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const cs0 = event.costSharing;
  const [csOn, setCsOn] = useState(!!cs0?.enabled);
  const [csAmount, setCsAmount] = useState(String(cs0?.perGuest ?? 15));
  const [csDeadline, setCsDeadline] = useState<string | undefined>(cs0?.deadline);
  const [csNote, setCsNote] = useState(cs0?.note ?? '');
  const [error, setError] = useState<string>();

  const state = eventState(event, bookings);
  const money = useMemo(() => budget(event, bookings), [event, bookings]);
  const g = guestSummary(event);
  const issues = state === 'draft' ? draftIssues(event) : [];
  const closed = state === 'cancelled' || state === 'completed';
  const already = event.invitations ?? [];
  const workspace = `/event-workspace/${event.id}`;

  // Permitted contacts: your friends, plus members you follow. Blocked accounts never appear.
  const contacts = useMemo(() => {
    const ok = (p: Profile) => !blocked.includes(p.id) && (friends.includes(p.id) || (p.kind === 'fan' && !!following[p.id]));
    return profiles.filter(ok);
  }, [blocked, friends, following]);
  const t = q.trim().toLowerCase();
  const shown = contacts.filter((p) => !t || `${p.name} ${p.handle}`.toLowerCase().includes(t));
  const friendRows = shown.filter((p) => friends.includes(p.id));
  const followRows = shown.filter((p) => !friends.includes(p.id));
  const isInvited = (pid: string) => already.some((i) => i.profileId === pid);
  const selectable = shown.filter((p) => !isInvited(p.id));
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.includes(p.id));
  const toggle = (pid: string) => setSelected((list) => (list.includes(pid) ? list.filter((x) => x !== pid) : [...list, pid]));

  const csN = Number(csAmount) || 0;
  // Once a guest has paid, the amount is fixed: changing it would make paid and unpaid guests owe different amounts.
  const csLocked = g.paid > 0 && !!cs0?.enabled;
  const csDirty = event.isPrivate && !csLocked && (csOn !== !!cs0?.enabled || (csOn && (csN !== (cs0?.perGuest ?? 0) || csDeadline !== cs0?.deadline || csNote.trim() !== (cs0?.note ?? ''))));
  const deadlines = deadlineChoices(event.start);
  const expected = event.expectedGuests ?? 0;
  const suggested = money.total > 0 && expected > 0 ? Math.ceil(money.total / expected) : 0;
  const count = selected.length;
  // Guest limit set in the event (capacity rules are not final, so this is a warning, not a block).
  const limit = event.ticketTypes.reduce((n, tt) => n + tt.capacity, 0);
  const overLimit = event.isPrivate && limit > 0 && already.length + count > limit;

  const send = () => {
    if (csOn && csDirty && (csN <= 0 || csN > MAX_SHARE)) {
      setError(`Set a contribution between €1 and €${MAX_SHARE} per guest`);
      return;
    }
    if (csOn && csDirty && csDeadline && parse(csDeadline).getTime() >= parse(event.start).getTime()) {
      setError('The pay-by date must be before the event. Pick it again.');
      return;
    }
    if (csOn && csDirty && csDeadline && csDeadline !== cs0?.deadline && parse(csDeadline).getTime() <= TODAY.getTime()) {
      setError('The pay-by date has passed. Pick a later one.');
      return;
    }
    if (count && issues.length) {
      setError(`Finish the draft before inviting: ${issues[0]}`);
      return;
    }
    if (count && state === 'draft' && !event.isPrivate) {
      setError('Publish the event before inviting guests');
      return;
    }
    setError(undefined);
    if (csDirty) setCostSharing(event.id, csOn ? { enabled: true, perGuest: csN, deadline: csDeadline, note: csNote.trim() || undefined } : undefined);
    let opened = false;
    if (count) {
      inviteGuests(event.id, selected);
      // A complete private draft opens to the people you invite.
      if (state === 'draft' && event.isPrivate) opened = setEventState(event.id, 'published');
    }
    const parts = [count ? `${plural(count, 'invitation')} sent` : '', opened ? 'invitations are open' : '', csDirty ? 'cost sharing saved' : ''].filter(Boolean);
    toast(parts.length ? parts.join(' · ').replace(/^./, (c) => c.toUpperCase()) : 'No changes');
    goBack(workspace);
  };

  if (closed) {
    return (
      <Screen header={<ScreenHeader title="Invite guests" subtitle={event.title} onBack={() => goBack(workspace)} />}>
        <EmptyState icon="calendar-remove-outline" title={state === 'cancelled' ? 'This event is cancelled' : 'This event has ended'} body="Invitations can’t be sent for it any more." action="Back to the event workspace" onAction={() => router.replace(workspace as never)} />
      </Screen>
    );
  }

  const personRight = (p: Profile) => {
    const inv = already.find((i) => i.profileId === p.id);
    if (inv) {
      const st = invitationLabel(inv, event.costSharing?.enabled ? event.costSharing : undefined);
      return <Pill label={st.label} tone={st.tone} />;
    }
    const on = selected.includes(p.id);
    return (
      <Button
        title={on ? 'Selected' : 'Invite'}
        icon={on ? 'check' : undefined}
        accessibilityLabel={on ? `Remove ${p.name} from the invitation list` : `Invite ${p.name}`}
        accessibilityState={{ selected: on }}
        size="sm"
        variant={on ? 'secondary' : 'primary'}
        onPress={() => toggle(p.id)}
      />
    );
  };

  return (
    <Screen
      keyboard
      header={
        <ScreenHeader
          title="Invite guests"
          subtitle={event.title}
          onBack={() => goBack(workspace)}
          right={event.isPrivate ? undefined : <IconButton name="share-variant-outline" label="Share event link" onPress={() => shareInvite(event)} />}
        />
      }
      footer={
        <BottomBar>
          {error ? <T v="small" color={colors.danger} style={{ marginBottom: 8 }}>{error}</T> : null}
          <Button title={count ? `Send ${plural(count, 'invitation')}` : csDirty ? 'Save cost sharing' : 'Done'} icon={count ? 'send' : undefined} onPress={send} />
        </BottomBar>
      }
    >
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
        <Photo src={event.cover} style={{ width: 56, height: 56 }} radius={12} accessibilityLabel={`${event.title} cover`} />
        <View style={{ flex: 1, gap: 3 }}>
          <T v="bodyBold" numberOfLines={1}>{event.title}</T>
          <T v="small" numberOfLines={1}>{eventWhen(event.start, event.end)}</T>
          <Row gap={6}>
            <Pill label={eventStateLabel(state, event.isPrivate)} tone={EVENT_STATE_TONE[state]} />
            {g.invited ? <T v="small">{`${g.invited} invited · ${g.accepted} accepted`}</T> : null}
          </Row>
        </View>
      </Card>

      {issues.length ? (
        <Banner icon="clipboard-alert-outline" tone="warning">
          <View style={{ gap: 6 }}>
            <T v="small" color={colors.warning}>{`Finish the draft before inviting: ${issues.join('; ')}.`}</T>
            <Button title="Edit event" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => router.push({ pathname: '/create-event', params: { edit: event.id } })} />
          </View>
        </Banner>
      ) : state === 'draft' && event.isPrivate ? (
        <Banner icon="information-outline">Sending the first invitations opens your draft to the people you invite. Nobody else can see it.</Banner>
      ) : null}

      {event.isPrivate ? (
        <Card style={{ gap: 12 }}>
          <Row gap={12}>
            <View style={{ flex: 1 }}>
              <T v="bodyBold">Cost sharing</T>
              <T v="small">Guests who accept pay their contribution, then get a ticket with a QR code. A failed payment issues no ticket.</T>
            </View>
            {csLocked ? <Pill label="Locked" icon="lock-outline" tone="neutral" /> : <Toggle label="Share costs with guests" value={csOn} onValueChange={setCsOn} />}
          </Row>
          {csLocked ? (
            <Banner icon="lock-outline">{`${plural(g.paid, 'guest')} already paid ${euro(cs0?.perGuest ?? 0)}, so the contribution stays as it is.`}</Banner>
          ) : null}
          {csOn && !csLocked ? (
            <>
              <Field label="Contribution per guest (€)" value={csAmount} onChangeText={(v) => setCsAmount(String(Math.min(9999, Number(v.replace(/\D/g, '')) || 0)))} keyboardType="number-pad" error={csN <= 0 ? 'Required' : csN > MAX_SHARE ? `Max €${MAX_SHARE}` : undefined} />
              {suggested > 0 ? (
                <Row gap={10} style={{ padding: 10, borderRadius: radius.sm, backgroundColor: colors.brandTint }}>
                  <Icon name="calculator-variant-outline" size={18} color={colors.brand} />
                  <T v="small" style={{ flex: 1 }}>{`Provider costs so far ${euro(money.total)} (${euro(money.agreed)} agreed). Split across ${expected} expected guests: about ${euro(suggested)} each.`}</T>
                  <Button title={`Use ${euro(suggested)}`} size="sm" variant="light" onPress={() => setCsAmount(String(Math.min(MAX_SHARE, suggested)))} />
                </Row>
              ) : null}
              <View style={{ gap: 8 }}>
                <T v="label">Pay by</T>
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  <Chip label="No deadline" selected={!csDeadline} onPress={() => setCsDeadline(undefined)} />
                  {csDeadline && !deadlines.some((d) => d.day === csDeadline) ? <Chip label={`Current · ${shortDate(csDeadline)}`} selected onPress={() => setCsDeadline(csDeadline)} /> : null}
                  {deadlines.map((d) => <Chip key={d.day} label={`${d.label} · ${shortDate(d.day)}`} selected={csDeadline === d.day} onPress={() => setCsDeadline(d.day)} />)}
                </Row>
              </View>
              <Field label="What it covers (optional)" value={csNote} onChangeText={setCsNote} placeholder="e.g. DJ and rooftop hire" maxLength={80} />
              {g.accepted > g.paid ? <T v="small">{`${plural(g.accepted - g.paid, 'guest')} who accepted and haven’t paid yet will see the new amount.`}</T> : null}
            </>
          ) : null}
          {!csOn && !csLocked ? <T v="small">Free for guests: accepting issues a ticket straight away.</T> : null}
        </Card>
      ) : (
        <Banner icon="information-outline">Invited friends get the event in their invitations. Tickets for public events are bought as usual.</Banner>
      )}

      <Field placeholder="Search friends and people you follow" value={q} onChangeText={setQ} icon="magnify" accessibilityLabel="Search contacts" />
      <Row justify="space-between">
        <T v="small">{count ? `${count} selected` : `${contacts.length} contacts`}</T>
        {selectable.length ? (
          <Button
            title={allSelected ? 'Clear' : 'Select all'}
            variant="ghost"
            size="sm"
            onPress={() => setSelected((list) => (allSelected ? list.filter((pid) => !selectable.some((p) => p.id === pid)) : Array.from(new Set([...list, ...selectable.map((p) => p.id)]))))}
          />
        ) : null}
      </Row>

      {overLimit ? <Banner icon="account-alert-outline" tone="warning">{`That makes ${already.length + count} invitations for a guest limit of ${limit}. If everyone accepts, raise the limit in Edit event.`}</Banner> : null}

      {friendRows.length ? (
        <View>
          <T v="caption" style={{ marginBottom: 4 }}>FRIENDS</T>
          {friendRows.map((p) => <PersonRow key={p.id} id={p.id} subtitle={p.handle} right={personRight(p)} />)}
        </View>
      ) : null}
      {followRows.length ? (
        <View>
          <T v="caption" style={{ marginBottom: 4 }}>PEOPLE YOU FOLLOW</T>
          {followRows.map((p) => <PersonRow key={p.id} id={p.id} subtitle={p.handle} right={personRight(p)} />)}
        </View>
      ) : null}
      {!shown.length ? (
        <EmptyState
          icon="account-search-outline"
          title={t ? 'No one found' : 'No contacts yet'}
          body={t ? `No friend or person you follow matches “${q}”.` : 'You can invite friends and members you follow. Add friends first, then invite them here.'}
          action={t ? 'Clear search' : 'Find friends'}
          onAction={() => (t ? setQ('') : router.push('/friends'))}
        />
      ) : null}
      {event.isPrivate ? (
        <T v="small" center>Private events have no public link: only the people you invite here can see it.</T>
      ) : (
        <Button title="Share the event link instead" icon="link-variant" variant="ghost" size="sm" onPress={() => shareInvite(event)} />
      )}
    </Screen>
  );
}

export default function Invite() {
  const { event: eventId } = useLocalSearchParams<{ event?: string }>();
  const event = useEvent(eventId);
  const user = useApp((s) => s.user);
  const myEvents = useApp((s) => s.myEvents);
  const bookings = useApp((s) => s.bookings);
  const choices = useMemo(
    () => myEvents.map((e) => ({ e, state: eventState(e, bookings) })).filter((x) => x.state !== 'cancelled' && x.state !== 'completed'),
    [myEvents, bookings],
  );

  if (event && hostsEvent(event, user)) return <InviteForm key={event.id} event={event} />;

  if (event) {
    return (
      <Screen header={<ScreenHeader title="Invite guests" onBack={() => goBack(`/event/${event.id}`)} />}>
        <EmptyState icon="account-lock-outline" title="Only the host can invite guests" body="Ask the host to invite your friends, or share the event page." action="View event" onAction={() => router.replace(`/event/${event.id}`)} />
      </Screen>
    );
  }
  if (eventId) {
    return (
      <Screen header={<ScreenHeader title="Invite guests" onBack={() => goBack('/my-events')} />}>
        <EmptyState icon="calendar-remove-outline" title="Event not found" body="This event may have been removed." action="My events" onAction={() => router.replace('/my-events')} />
      </Screen>
    );
  }
  return (
    <Screen header={<ScreenHeader title="Invite guests" subtitle="Choose an event" onBack={() => goBack('/my-events')} />}>
      {choices.length ? (
        <>
          <T v="body" color={colors.muted}>Invitations belong to an event. Which one are you inviting people to?</T>
          {choices.map(({ e, state }) => (
            <Card key={e.id} onPress={() => router.setParams({ event: e.id })} accessibilityLabel={`Invite guests to ${e.title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
              <Photo src={e.cover} style={{ width: 56, height: 56 }} radius={12} />
              <View style={{ flex: 1, gap: 3 }}>
                <T v="bodyBold" numberOfLines={1}>{e.title}</T>
                <T v="small" numberOfLines={1}>{eventWhen(e.start, e.end)}</T>
                <Pill label={eventStateLabel(state, e.isPrivate)} tone={EVENT_STATE_TONE[state]} />
              </View>
              <Icon name="chevron-right" size={22} color={colors.subtle} />
            </Card>
          ))}
        </>
      ) : (
        <EmptyState icon="calendar-lock-outline" title="No event to invite to" body="Create a private event first, then invite friends and set cost sharing." action="Create private event" onAction={() => router.push('/create-event?private=1')} />
      )}
    </Screen>
  );
}
