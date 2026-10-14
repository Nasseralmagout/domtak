import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackOverlay, EventRow, HeartToggle } from '../../components/cards';
import { BottomBar, goBack } from '../../components/layout';
import { Avatar, Button, Icon, Photo, Row, SectionTitle, Stars, T } from '../../components/ui';
import { profileById, profiles } from '../../data/mock';
import { compact, euro } from '../../lib/format';
import { useAllEvents, useApp, useFeedPosts } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

const REVIEWS = [
  { by: 'maya', rating: 5, text: 'Absolutely made our wedding. Read the room perfectly.' },
  { by: 'ben', rating: 5, text: 'On time, professional, great sound. Booking again.' },
  { by: 'clara', rating: 4, text: 'Amazing set — chat replies were a bit slow.' },
];

export default function ArtistProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const artist = profileById(id ?? '');
  const following = useApp((s) => (id ? !!s.following[id] : false));
  const wished = useApp((s) => (id ? s.wishlist.artists.includes(id) : false));
  const toggleFollow = useApp((s) => s.toggleFollow);
  const toggleWish = useApp((s) => s.toggleWish);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const events = useAllEvents();
  const posts = useFeedPosts();

  if (!artist) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 24, gap: 12 }}>
        <T v="h2">Artist not found</T>
        <Button title="Back" onPress={() => goBack('/(tabs)/artists')} />
      </SafeAreaView>
    );
  }
  const gigs = events.filter((e) => e.lineup.includes(artist.id)).sort((a, b) => a.start.localeCompare(b.start));
  const media = [...posts.filter((p) => p.authorId === artist.id).flatMap((p) => p.media), ...(artist.gallery ?? [])].slice(0, 6);
  const fans = profiles.filter((p) => p.kind === 'fan').slice(0, 5);
  const cell = (width - 32 - 8) / 3;
  const links = [
    artist.links?.soundcloud ? { icon: 'soundcloud' as const, color: '#FF5500', label: 'SoundCloud', url: 'https://soundcloud.com' } : null,
    artist.links?.spotify ? { icon: 'spotify' as const, color: '#1DB954', label: 'Spotify', url: 'https://open.spotify.com' } : null,
    artist.links?.youtube ? { icon: 'youtube' as const, color: '#FF0000', label: 'YouTube', url: 'https://youtube.com' } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ height: 380 }}>
          <Photo src={artist.cover ?? artist.avatar} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(20,10,40,0.9)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <SafeAreaView edges={['top']} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4 }}>
            <BackOverlay onPress={() => goBack('/(tabs)/artists')} />
            <HeartToggle on={wished} onPress={() => toggleWish('artists', artist.id)} label={wished ? 'Remove from wishlist' : 'Save to wishlist'} />
          </SafeAreaView>
          <Row style={{ position: 'absolute', left: 20, right: 16, bottom: 20 }} justify="space-between" align="flex-end">
            <View style={{ flex: 1 }}>
              <Row gap={6}>
                <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 32 }}>{artist.name}</Text>
                {artist.verified ? <Icon name="check-decagram" size={22} color="#A78BFA" /> : null}
              </Row>
              <Text style={{ color: colors.lilacLight, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{artist.title}</Text>
            </View>
            <Button title={following ? 'Following' : 'Follow'} icon={following ? 'check' : 'plus'} size="md" variant={following ? 'secondary' : 'primary'} onPress={() => toggleFollow(artist.id)} />
          </Row>
        </View>

        <View style={{ padding: 16, gap: 18 }}>
          <Row gap={12}>
            <Row gap={0}>
              {fans.map((f, i) => <View key={f.id} style={{ marginLeft: i ? -10 : 0 }}><Avatar src={f.avatar} size={34} /></View>)}
            </Row>
            <T v="bodyBold" color={colors.brandDeep}>{compact(artist.followers + (following ? 1 : 0))} <T v="body" color={colors.brandDeep}>Followers</T></T>
            <T v="bodyBold" color={colors.brandDeep}>{compact(artist.following)} <T v="body" color={colors.brandDeep}>Following</T></T>
          </Row>

          <Row gap={16} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, ...shadow(1) }}>
            <View style={{ flex: 1, alignItems: 'center' }}><T v="h3">{artist.rating?.toFixed(1) ?? '—'}</T><Stars value={artist.rating ?? 0} size={12} /></View>
            <View style={{ width: 1, height: 36, backgroundColor: colors.divider }} />
            <View style={{ flex: 1, alignItems: 'center' }}><T v="h3">{artist.eventsCount ?? 0}</T><T v="small">Gigs played</T></View>
            <View style={{ width: 1, height: 36, backgroundColor: colors.divider }} />
            <View style={{ flex: 1, alignItems: 'center' }}><T v="h3">&lt;2h</T><T v="small">Replies</T></View>
          </Row>

          <View style={{ gap: 6 }}>
            <T v="h3">About me</T>
            <T v="body" color={colors.inkSoft}>{artist.bio}</T>
          </View>
          <View style={{ gap: 8 }}>
            <T v="h3">Music style</T>
            <Row gap={16} style={{ flexWrap: 'wrap' }}>
              {artist.genres.map((g) => <Row key={g} gap={4}><Icon name="music-note" size={18} color={colors.brandDeep} /><T v="bodyBold">{g}</T></Row>)}
              {artist.instruments?.map((ins) => <Row key={ins} gap={4}><Icon name="speaker" size={18} color={colors.brandDeep} /><T v="body">{ins}</T></Row>)}
            </Row>
          </View>
          {artist.feePerHour ? (
            <View style={{ gap: 6 }}>
              <T v="h3">Book me</T>
              <T v="body" color={colors.inkSoft}>My booking fee is <T v="bodyBold">{euro(artist.feePerHour)}</T> per hour. Payment is held in Domtak escrow until the gig is confirmed.</T>
            </View>
          ) : null}
          {links.length ? (
            <View style={{ gap: 10 }}>
              <T v="h3">Listen to me</T>
              <Row gap={14}>
                {links.map((l) => (
                  <Pressable key={l.label} accessibilityRole="link" accessibilityLabel={`Listen on ${l.label}`} onPress={() => Linking.openURL(l.url).catch(() => {})} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow(1) }}>
                    <Icon name={l.icon} size={30} color={l.color} />
                  </Pressable>
                ))}
              </Row>
            </View>
          ) : null}

          {gigs.length ? (
            <View style={{ gap: 10 }}>
              <SectionTitle title="Upcoming gigs" />
              {gigs.map((g) => <EventRow key={g.id} event={g} />)}
            </View>
          ) : null}

          {media.length ? (
            <View>
              <SectionTitle title="Photos & videos" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {media.map((m, i) => <Photo key={`${m}-${i}`} src={m} style={{ width: cell, height: cell }} radius={8} />)}
              </View>
            </View>
          ) : null}

          <View style={{ gap: 12 }}>
            <SectionTitle title="Reviews" />
            {REVIEWS.map((r) => {
              const p = profileById(r.by);
              return (
                <Row key={r.by} gap={12} align="flex-start" style={{ backgroundColor: colors.surface, padding: 12, borderRadius: radius.md }}>
                  <Avatar src={p?.avatar} size={36} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row justify="space-between"><T v="bodyBold">{p?.name}</T><Stars value={r.rating} size={12} /></Row>
                    <T v="small" color={colors.inkSoft}>{r.text}</T>
                  </View>
                </Row>
              );
            })}
          </View>
        </View>
      </ScrollView>
      <BottomBar>
        <Row gap={12}>
          <Button title="Message" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => router.push(`/chat/${ensureConversation(artist.id)}`)} />
          <Button title="Book" size="lg" style={{ flex: 1.4 }} onPress={() => router.push({ pathname: '/booking/new', params: { type: 'musician', id: artist.id } })} />
        </Row>
      </BottomBar>
    </View>
  );
}
