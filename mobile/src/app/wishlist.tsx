import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ArtistCard, EventCard, VenueCard } from '../components/cards';
import { goBack, Screen, ScreenHeader } from '../components/layout';
import { EmptyState, Row, Segmented, T } from '../components/ui';
import { profileById } from '../data/mock';
import type { EventItem } from '../data/types';
import { isUpcoming } from '../store/filters';
import { useAllEvents, useApp, useInvitedEvents, useVenues } from '../store/useApp';

type Tab = 'events' | 'artists' | 'venues';

export default function Wishlist() {
  const wish = useApp((s) => s.wishlist);
  const blocked = useApp((s) => s.blocked);
  const events = useAllEvents();
  const invited = useInvitedEvents();
  // Includes the owner's saved listing, so a saved venue shows its current name and photos.
  const venues = useVenues();
  const [tab, setTab] = useState<Tab>('events');

  const { upcoming, past, savedArtists, savedVenues } = useMemo(() => {
    // Saved events can be public ones, your own, or private events you were invited to.
    const pool: EventItem[] = [...events, ...invited.map((x) => x.event)];
    const saved = wish.events.map((id) => pool.find((e) => e.id === id)).filter((e): e is EventItem => !!e);
    return {
      upcoming: saved.filter((e) => isUpcoming(e)),
      past: saved.filter((e) => !isUpcoming(e)),
      // Blocked accounts stay out of your lists until you unblock them.
      savedArtists: wish.artists.filter((id) => !blocked.includes(id)).map((id) => profileById(id)).filter((p): p is NonNullable<typeof p> => !!p),
      savedVenues: wish.venues.map((id) => venues.find((v) => v.id === id)).filter((v): v is NonNullable<typeof v> => !!v),
    };
  }, [events, invited, wish, blocked, venues]);

  const eventCount = upcoming.length + past.length;
  const empty = tab === 'events' ? !eventCount : tab === 'artists' ? !savedArtists.length : !savedVenues.length;
  const noun = tab === 'events' ? 'event' : tab === 'artists' ? 'artist' : 'venue';

  return (
    <Screen header={<ScreenHeader title="Wishlist" onBack={() => goBack('/(tabs)')} />}>
      <Segmented dark options={[{ key: 'events', label: `Events (${eventCount})` }, { key: 'artists', label: `Artists (${savedArtists.length})` }, { key: 'venues', label: `Venues (${savedVenues.length})` }]} value={tab} onChange={setTab} />
      {empty ? (
        <EmptyState
          icon="heart-outline"
          title="Nothing saved yet"
          body={`Tap the heart on any ${noun} to keep it here for later.`}
          action={`Discover ${noun}s`}
          onAction={() => router.push(tab === 'events' ? '/events/all' : tab === 'artists' ? '/artists/all' : '/venues')}
        />
      ) : null}
      {tab === 'events' ? (
        <>
          {upcoming.map((e) => <EventCard key={e.id} event={e} />)}
          {past.length ? (
            <View style={{ gap: 12 }}>
              <T v="label" accessibilityRole="header">Already happened</T>
              {past.map((e) => <EventCard key={e.id} event={e} />)}
            </View>
          ) : null}
        </>
      ) : null}
      {tab === 'artists' ? (
        <View style={{ gap: 12 }}>
          {Array.from({ length: Math.ceil(savedArtists.length / 2) }).map((_, i) => (
            <Row key={i} gap={12} align="stretch">
              {savedArtists.slice(i * 2, i * 2 + 2).map((a) => <ArtistCard key={a.id} artist={a} />)}
              {savedArtists.slice(i * 2, i * 2 + 2).length === 1 ? <View style={{ flex: 1 }} /> : null}
            </Row>
          ))}
        </View>
      ) : null}
      {tab === 'venues' ? savedVenues.map((v) => <VenueCard key={v.id} venue={v} />) : null}
    </Screen>
  );
}
