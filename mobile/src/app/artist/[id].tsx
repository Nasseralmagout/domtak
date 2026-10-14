import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet } from '../../components/ActionSheet';
import { BackOverlay, EventRow, HeartToggle } from '../../components/cards';
import { BottomBar, goBack } from '../../components/layout';
import { Avatar, Banner, Button, Icon, IconButton, Photo, Row, SectionTitle, Stars, T } from '../../components/ui';
import { followersOf, profileById, reviewsFor } from '../../data/mock';
import { compact, euro, shortDate } from '../../lib/format';
import { toast } from '../../store/toast';
import { useAllEvents, useApp, useFeedPosts } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

const fmtRating = (n: number) => n.toFixed(1).replace('.', ',');

export default function ArtistProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const artist = profileById(id ?? '');
  const following = useApp((s) => (id ? !!s.following[id] : false));
  const wished = useApp((s) => (id ? s.wishlist.artists.includes(id) : false));
  const blocked = useApp((s) => s.blocked);
  const bookings = useApp((s) => s.bookings);
  const myReviews = useApp((s) => s.reviews);
  const user = useApp((s) => s.user);
  const toggleFollow = useApp((s) => s.toggleFollow);
  const toggleWish = useApp((s) => s.toggleWish);
  const toggleBlock = useApp((s) => s.toggleBlock);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const events = useAllEvents();
  const posts = useFeedPosts();
  const [menuOpen, setMenuOpen] = useState(false);

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
  const fans = followersOf(artist.id).filter((p) => !blocked.includes(p.id)).slice(0, 5);
  const cell = (width - 32 - 8) / 3;
  const links = [
    artist.links?.soundcloud ? { icon: 'soundcloud' as const, color: '#FF5500', label: 'SoundCloud', url: 'https://soundcloud.com' } : null,
    artist.links?.spotify ? { icon: 'spotify' as const, color: '#1DB954', label: 'Spotify', url: 'https://open.spotify.com' } : null,
    artist.links?.youtube ? { icon: 'youtube' as const, color: '#FF0000', label: 'YouTube', url: 'https://youtube.com' } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);

  // Reviews: your own (from completed bookings) first, then everyone else, newest first.
  const mine = bookings
    .filter((b) => b.targetId === artist.id && myReviews[b.id])
    .map((b) => ({ id: `mine-${b.id}`, authorId: 'me', rating: myReviews[b.id].rating, text: myReviews[b.id].text, date: b.date, context: b.eventTitle }));
  const allReviews = [
    ...mine,
    ...reviewsFor(artist.id)
      .filter((r) => !blocked.includes(r.authorId))
      .sort((a, b) => b.date.localeCompare(a.date)),
  ];
  const reviewCount = allReviews.length;
  const rating = reviewCount ? allReviews.reduce((n, r) => n + r.rating, 0) / reviewCount : artist.rating;
  const followerCount = artist.followers + (following ? 1 : 0);
  const isBlocked = blocked.includes(artist.id);

  const openConnections = (tab: 'followers' | 'following') => router.push(`/connections/${artist.id}?tab=${tab}`);
  const openRatings = () => router.push(`/ratings/${artist.id}`);
  const block = () => {
    if (isBlocked) {
      toggleBlock(artist.id);
      toast(`${artist.name} is unblocked`);
      return;
    }
    if (following) toggleFollow(artist.id);
    toggleBlock(artist.id);
    toast(`${artist.name} is blocked`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ height: 380 }}>
          <Photo src={artist.cover ?? artist.avatar} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(20,10,40,0.9)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <SafeAreaView edges={['top']} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4 }}>
            <BackOverlay onPress={() => goBack('/(tabs)/artists')} />
            <Row gap={8}>
              <IconButton name="dots-horizontal" label="More options" color={colors.white} bg="rgba(0,0,0,0.35)" size={44} iconSize={26} onPress={() => setMenuOpen(true)} />
              <HeartToggle on={wished} onPress={() => toggleWish('artists', artist.id)} label={wished ? 'Remove from wishlist' : 'Save to wishlist'} />
            </Row>
          </SafeAreaView>
          <Row style={{ position: 'absolute', left: 20, right: 16, bottom: 20 }} justify="space-between" align="flex-end">
            <View style={{ flex: 1 }}>
              <Row gap={6}>
                <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 32 }}>{artist.name}</Text>
                {artist.verified ? <Icon name="check-decagram" size={22} color="#A78BFA" /> : null}
              </Row>
              <Text style={{ color: colors.lilacLight, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{artist.title}</Text>
            </View>
            {isBlocked ? null : (
              <Button title={following ? 'Following' : 'Follow'} icon={following ? 'check' : 'plus'} size="md" variant={following ? 'secondary' : 'primary'} onPress={() => toggleFollow(artist.id)} />
            )}
          </Row>
        </View>

        <View style={{ padding: 16, gap: 18 }}>
          <Row gap={16} style={{ flexWrap: 'wrap' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${compact(followerCount)} followers. Show followers`}
              onPress={() => openConnections('followers')}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, opacity: pressed ? 0.6 : 1 })}
            >
              {fans.length ? (
                <Row gap={0}>
                  {fans.map((f, i) => <View key={f.id} style={{ marginLeft: i ? -10 : 0 }}><Avatar src={f.avatar} size={34} /></View>)}
                </Row>
              ) : null}
              <T v="bodyBold" color={colors.brandDeep}>{compact(followerCount)} <T v="body" color={colors.brandDeep}>Followers</T></T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${compact(artist.following)} following. Show who ${artist.name} follows`}
              onPress={() => openConnections('following')}
              style={({ pressed }) => ({ justifyContent: 'center', minHeight: 44, opacity: pressed ? 0.6 : 1 })}
            >
              <T v="bodyBold" color={colors.brandDeep}>{compact(artist.following)} <T v="body" color={colors.brandDeep}>Following</T></T>
            </Pressable>
          </Row>

          {isBlocked ? (
            <Banner icon="block-helper" tone="danger">
              <View style={{ gap: 8 }}>
                <T v="smallBold" color={colors.danger}>You blocked {artist.name}</T>
                <T v="small" color={colors.danger}>They can’t message you or send you booking offers, and you won’t see their posts.</T>
                <Button title="Unblock" variant="secondary" size="sm" icon="account-check-outline" style={{ alignSelf: 'flex-start' }} onPress={block} />
              </View>
            </Banner>
          ) : null}

          <Row gap={16} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, ...shadow(1) }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={rating ? `Rated ${fmtRating(rating)} out of 5 from ${reviewCount} reviews. See all reviews` : 'No rating yet. See reviews'}
              onPress={openRatings}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
            >
              <T v="h3">{rating ? fmtRating(rating) : '—'}</T>
              <Stars value={rating ?? 0} size={12} />
              <T v="small" style={{ fontSize: 11 }}>{reviewCount ? `${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'No reviews'}</T>
            </Pressable>
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
            <Row justify="space-between">
              <T v="h3">Reviews</T>
              {reviewCount && rating ? (
                <Row gap={6}>
                  <Icon name="star" size={18} color={colors.star} />
                  <T v="bodyBold">{fmtRating(rating)}</T>
                  <T v="small">({reviewCount})</T>
                </Row>
              ) : null}
            </Row>
            {allReviews.slice(0, 3).map((r) => {
              const isMine = r.authorId === 'me';
              const p = isMine ? undefined : profileById(r.authorId);
              const authorName = isMine ? 'You' : p?.name ?? 'Domtak guest';
              return (
                <Row key={r.id} gap={12} align="flex-start" style={{ backgroundColor: colors.surface, padding: 12, borderRadius: radius.md, ...shadow(1) }}>
                  <Avatar src={isMine ? user.avatar : p?.avatar} size={36} label={authorName} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row justify="space-between"><T v="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>{authorName}</T><Stars value={r.rating} size={12} /></Row>
                    <T v="small" style={{ fontSize: 12 }} numberOfLines={1}>{r.context} · {shortDate(r.date)}</T>
                    {r.text ? <T v="small" color={colors.inkSoft} style={{ marginTop: 2 }}>{r.text}</T> : null}
                  </View>
                </Row>
              );
            })}
            {reviewCount ? (
              <Button title={`See all ${reviewCount} reviews`} variant="secondary" size="md" icon="star-outline" onPress={openRatings} />
            ) : (
              <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: radius.md, gap: 4, ...shadow(1) }}>
                <T v="bodyBold">No reviews yet</T>
                <T v="small">Book {artist.name} through Domtak and be the first to leave a review.</T>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      {isBlocked ? null : (
        <BottomBar>
          <Row gap={12}>
            <Button title="Message" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => router.push(`/chat/${ensureConversation(artist.id)}`)} />
            <Button title="Book" size="lg" style={{ flex: 1.4 }} onPress={() => router.push({ pathname: '/booking/new', params: { type: 'musician', id: artist.id } })} />
          </Row>
        </BottomBar>
      )}
      <ActionSheet
        visible={menuOpen}
        title={artist.name}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: 'Share profile', icon: 'share-variant-outline', onPress: () => Share.share({ message: `${artist.name} (${artist.handle}) on Domtak: ${artist.title} from ${artist.city}` }).catch(() => {}) },
          { label: 'See all reviews', icon: 'star-outline', onPress: openRatings },
          isBlocked
            ? { label: `Unblock ${artist.name}`, icon: 'account-check-outline', onPress: block }
            : { label: `Block ${artist.name}`, icon: 'account-cancel-outline', destructive: true, onPress: block },
          { label: 'Report profile', icon: 'flag-outline', destructive: true, onPress: () => toast('Thanks, our team will review this profile') },
        ]}
      />
    </View>
  );
}
