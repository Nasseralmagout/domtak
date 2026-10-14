import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ArtistCard, EventCard, VenueCard } from '../components/cards';
import { Screen, ScreenHeader } from '../components/layout';
import { EmptyState, Row, Segmented } from '../components/ui';
import { profileById, venueById } from '../data/mock';
import { useAllEvents, useApp } from '../store/useApp';

export default function Wishlist() {
  const wish = useApp((s) => s.wishlist);
  const events = useAllEvents();
  const [tab, setTab] = useState<'events' | 'artists' | 'venues'>('events');

  const savedEvents = wish.events.map((id) => events.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);
  const savedArtists = wish.artists.map((id) => profileById(id)).filter((p): p is NonNullable<typeof p> => !!p);
  const savedVenues = wish.venues.map((id) => venueById(id)).filter((v): v is NonNullable<typeof v> => !!v);
  const empty = tab === 'events' ? !savedEvents.length : tab === 'artists' ? !savedArtists.length : !savedVenues.length;
  const noun = tab === 'events' ? 'event' : tab === 'artists' ? 'artist' : 'venue';

  return (
    <Screen header={<ScreenHeader title="Wishlist" />}>
      <Segmented dark options={[{ key: 'events', label: `Events (${savedEvents.length})` }, { key: 'artists', label: `Artists (${savedArtists.length})` }, { key: 'venues', label: `Venues (${savedVenues.length})` }]} value={tab} onChange={setTab} />
      {empty ? (
        <EmptyState
          icon="heart-outline"
          title="Nothing saved yet"
          body={`Tap the heart on any ${noun} to keep it here for later.`}
          action={`Discover ${noun}s`}
          onAction={() => router.push(tab === 'events' ? '/events/all' : tab === 'artists' ? '/artists/all' : '/venues')}
        />
      ) : null}
      {tab === 'events' ? savedEvents.map((e) => <EventCard key={e.id} event={e} />) : null}
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
