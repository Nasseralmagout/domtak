import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Share, View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Checklist, EmptyState, Icon, Photo, Pill, Row, T } from '../components/ui';
import { hostsEvent, readinessLine } from '../lib/eventHost';
import { draftIssues, EVENT_STATE_TONE, eventState, eventStateLabel, linkedBookings, readiness } from '../lib/events';
import { shortDate, time } from '../lib/format';
import { toast } from '../store/toast';
import { useApp, useEvent, useVenue } from '../store/useApp';
import { colors, radius, shadow } from '../theme';

export default function EventCreated() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const venue = useVenue(event?.venueId);
  const bookings = useApp((s) => s.bookings);
  const user = useApp((s) => s.user);
  const linked = useMemo(() => (event ? linkedBookings(event, bookings) : []), [event, bookings]);

  if (!event) {
    return (
      <Screen header={<ScreenHeader title="Event" onBack={() => router.replace('/(tabs)')} />}>
        <EmptyState icon="calendar-remove-outline" title="Event not found" body="We could not find this event. You can create a new one from the plus button." action="Create event" onAction={() => router.replace('/create-event')} />
      </Screen>
    );
  }
  // Next steps are for the person who created the event.
  if (!hostsEvent(event, user)) {
    return (
      <Screen header={<ScreenHeader title="Event" onBack={() => router.replace(`/event/${event.id}`)} />}>
        <EmptyState icon="account-lock-outline" title="Only the host can manage this event" body="Next steps, provider requests and invitations are for the person who runs the event." action="View event" onAction={() => router.replace(`/event/${event.id}`)} />
      </Screen>
    );
  }

  const state = eventState(event, bookings);
  const isDraft = state === 'draft';
  const issues = isDraft ? draftIssues(event) : [];
  const r = readiness(event, bookings);
  const hasArtist = linked.some((b) => b.type === 'musician');
  const hasVenueBooking = linked.some((b) => b.type === 'venue');
  const invited = event.invitations?.length ?? 0;
  // Promotion is for public events that are live (never drafts, private or cancelled events).
  const canPromote = !event.isPrivate && state !== 'draft' && state !== 'cancelled' && state !== 'completed';
  const over = state === 'cancelled' || state === 'completed';
  const heading = state === 'cancelled' ? 'Event cancelled' : state === 'completed' ? 'This event has ended' : isDraft ? 'Draft saved' : event.isPrivate ? 'Invitations are open' : 'Your event is published!';
  const body = over
    ? 'Open the event workspace to resolve its bookings and payments.'
    : isDraft
      ? event.isPrivate
        ? 'Only you can see it. Next: find artists and a venue, then invite your guests.'
        : 'Only you can see it until you publish. Arrange your providers, then publish from the event workspace.'
      : event.isPrivate
        ? 'Invite guests and set cost sharing. Only people you invite can see it.'
        : 'It is visible in Discover, Search and on the map.';

  // Only public events are shared as a link: a private event opens only through an invitation (F11).
  const share = () => Share.share({ message: `Join me at ${event.title} on Domtak` }).catch(() => toast('Could not open the share sheet'));

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ paddingHorizontal: 20, paddingTop: 24, gap: 14 }}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={state === 'cancelled' ? 'calendar-remove-outline' : isDraft ? 'content-save-outline' : 'check'} size={44} color={colors.white} />
        </View>
        <T v="h1" color={colors.brandMid} center>{heading}</T>
        <T v="body" color={colors.muted} center>{body}</T>
      </View>

      <Card padded={false} style={{ overflow: 'hidden' }} onPress={() => router.push(`/event/${event.id}`)} accessibilityLabel={`${event.title}. Open event page`}>
        <Photo src={event.cover} style={{ height: 150 }} accessibilityLabel={`${event.title} cover`} />
        <View style={{ padding: 14, gap: 6 }}>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Pill label={eventStateLabel(state, event.isPrivate)} tone={EVENT_STATE_TONE[state]} />
            <Pill label={event.isPrivate ? 'Private' : 'Public'} icon={event.isPrivate ? 'lock-outline' : 'earth'} tone="neutral" />
          </Row>
          <T v="h3">{event.title}</T>
          <T v="small">{shortDate(event.start)} at {time(event.start)} · {venue ? `${venue.name}, ${venue.area}` : 'Venue not decided yet'}</T>
          {linked.length ? <T v="smallBold" color={r.ready ? colors.success : colors.warning}>{readinessLine(r)}</T> : null}
        </View>
      </Card>

      {issues.length ? (
        <Banner icon="clipboard-alert-outline" tone="warning">{`To finish before ${event.isPrivate ? 'inviting guests' : 'publishing'}: ${issues.join('; ')}.`}</Banner>
      ) : null}

      {over ? null : (
        <Card style={{ gap: 4 }}>
          <Checklist
            title="Next steps"
            items={[
              {
                label: 'Find artists',
                done: hasArtist,
                hint: 'Send each artist a separate request and pick this event in the form, so it is linked here.',
                onPress: () => router.push('/artists/all'),
              },
              venue
                ? {
                    label: `Request ${venue.name}`,
                    done: hasVenueBooking,
                    hint: 'Venue hire, plus catering and security priced by guest count.',
                    onPress: () => router.push({ pathname: '/booking/new', params: { type: 'venue', id: venue.id, eventId: event.id } }),
                  }
                : { label: 'Find a venue', done: hasVenueBooking, hint: 'Compare capacity, parking and outdoor space.', onPress: () => router.push('/venues') },
              {
                label: event.isPrivate ? 'Invite guests and set cost sharing' : 'Invite friends',
                done: invited > 0,
                hint: isDraft && issues.length ? 'Finish the draft first, then invite.' : event.isPrivate ? 'Friends or people you follow; guests pay their share when they accept.' : 'Send the event to friends on Domtak.',
                onPress: () => router.push(`/invite?event=${event.id}`),
              },
            ]}
          />
        </Card>
      )}

      {canPromote ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Promote event. Featured in Discover, Map and Search from 49 euros a week"
          onPress={() => router.push(`/pro/promote/${event.id}`)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 64,
            padding: 14,
            borderRadius: radius.lg,
            backgroundColor: colors.brandDeep,
            opacity: pressed ? 0.9 : 1,
            ...shadow(1),
          })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="rocket-launch-outline" size={22} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="bodyBold" color={colors.white}>Promote event</T>
            <T v="small" color={colors.lilacLight}>Featured in Discover, Map and Search from €49 / week</T>
          </View>
          <Icon name="chevron-right" size={22} color={colors.lilacLight} />
        </Pressable>
      ) : null}

      <Button title="Open event workspace" icon="view-dashboard-outline" full onPress={() => router.replace(`/event-workspace/${event.id}`)} />
      <Row gap={12}>
        {!over ? <Button title="Edit event" icon="pencil-outline" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/create-event', params: { edit: event.id } })} /> : null}
        {!isDraft && !event.isPrivate ? <Button title="Share" icon="share-variant-outline" variant="secondary" size="md" style={{ flex: 1 }} onPress={share} /> : null}
      </Row>
      <Button title="To Home page" variant="ghost" full onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
