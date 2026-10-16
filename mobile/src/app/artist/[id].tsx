import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet, ReasonSheet } from '../../components/ActionSheet';
import { ArtistPricingCard, BackOverlay, EventRow, HeartToggle, LessonCard, RecommendBadge, ReviewTags } from '../../components/cards';
import { BottomBar, goBack } from '../../components/layout';
import { Avatar, Banner, BookAgainBadge, Button, Icon, IconButton, Photo, Row, SectionTitle, Stars, T, TagCounts } from '../../components/ui';
import { followersOf, profileById, reviewsFor } from '../../data/mock';
import { compact, isoDay, plural, shortDate, TODAY } from '../../lib/format';
import { isMusician, verifiedMusicianReviews } from '../../lib/ratings';
import { isUpcoming } from '../../store/filters';
import { OWN_ARTIST_ID, overlayArtist, useArtist, useArtistServices, useServices } from '../../store/services';
import { toast } from '../../store/toast';
import { activeWorkspace, useAllEvents, useApp, useArtistScore, useFeedPosts, useRating } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const REPORT_REASONS = ['Fake or impersonating profile', 'Spam or scam', 'Harassment or hate', 'Inappropriate photos', 'Something else'];
const TODAY_ISO = isoDay(TODAY);

interface ReviewRow {
  id: string;
  authorId: string;
  text: string;
  date: string;
  context: string;
  rating: number;
  recommend?: boolean;
  tags: string[];
}

export default function ArtistProfile() {
  const { id, preview } = useLocalSearchParams<{ id: string; preview?: string }>();
  const { width } = useWindowDimensions();
  // Includes the musician's published services (price, quote mode, charges, lessons) for their own profile.
  const published = useArtist(id);
  const publishedServices = useArtistServices(id);
  const user = useApp((s) => s.user);
  // The approved musician working in their workspace manages this profile (see store/services).
  const ownsProfile = activeWorkspace(user) === 'musician' && id === OWN_ARTIST_ID;
  // Pro → Services and pricing → Preview profile: show the saved, unpublished draft instead (owner only).
  const servicesDraft = useServices((s) => s.servicesDraft);
  const draft = preview === 'draft' && ownsProfile ? servicesDraft : undefined;
  const artist = useMemo(() => (draft && published ? overlayArtist(published, draft, draft.feePerHour) : published), [draft, published]);
  const services = draft ?? publishedServices;
  const score = useArtistScore(id ?? '');
  const stars = useRating(id ?? '');
  const following = useApp((s) => (id ? !!s.following[id] : false));
  const wished = useApp((s) => (id ? s.wishlist.artists.includes(id) : false));
  const blocked = useApp((s) => s.blocked);
  const bookings = useApp((s) => s.bookings);
  const myReviews = useApp((s) => s.reviews);
  const availability = useApp((s) => s.availability);
  const toggleFollow = useApp((s) => s.toggleFollow);
  const toggleWish = useApp((s) => s.toggleWish);
  const toggleBlock = useApp((s) => s.toggleBlock);
  const reportContent = useApp((s) => s.reportContent);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const events = useAllEvents();
  const posts = useFeedPosts();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  if (!artist) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 24, gap: 12 }}>
        <T v="h2">Artist not found</T>
        <Button title="Back" onPress={() => goBack('/(tabs)/artists')} />
      </SafeAreaView>
    );
  }
  // Musicians, DJs and bands are rated by "would book again", never stars.
  const musician = isMusician(artist.id);
  // Upcoming public gigs (your own private events only for you); drafts, cancelled and past events are not gigs.
  const gigs = events
    .filter((e) => e.lineup.includes(artist.id) && (!e.isPrivate || e.organizerId === 'me') && e.state !== 'draft' && e.state !== 'cancelled' && isUpcoming(e))
    .sort((a, b) => a.start.localeCompare(b.start));
  const media = [...posts.filter((p) => p.authorId === artist.id).flatMap((p) => p.media), ...(artist.gallery ?? [])].slice(0, 6);
  const fans = followersOf(artist.id).filter((p) => !blocked.includes(p.id)).slice(0, 5);
  const cell = (width - 32 - 8) / 3;
  const links = [
    artist.links?.soundcloud ? { icon: 'soundcloud' as const, color: '#FF5500', label: 'SoundCloud', url: 'https://soundcloud.com' } : null,
    artist.links?.spotify ? { icon: 'spotify' as const, color: '#1DB954', label: 'Spotify', url: 'https://open.spotify.com' } : null,
    artist.links?.youtube ? { icon: 'youtube' as const, color: '#FF0000', label: 'YouTube', url: 'https://youtube.com' } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);
  const lessons = artist.lessons ?? [];
  const quote = artist.pricing === 'quote' || !artist.feePerHour;
  const isOwner = ownsProfile;
  // Lessons that are only in the unpublished draft have no public page yet.
  const publishedLessonIds = (published?.lessons ?? []).map((l) => l.id);

  // Reviews: your own (from completed bookings, the same ones the score counts) first, then verified reviews from other customers, newest first.
  const mine: ReviewRow[] = bookings
    .filter((b) => b.targetId === artist.id && b.type !== 'venue' && myReviews[b.id] && (musician ? b.status === 'completed' && myReviews[b.id].recommend != null : myReviews[b.id].rating > 0))
    .map((b) => {
      const r = myReviews[b.id];
      return { id: `mine-${b.id}`, authorId: 'me', rating: r.rating, recommend: r.recommend, tags: r.tags ?? [], text: r.text, date: b.date, context: b.eventTitle };
    });
  const others: ReviewRow[] = (musician ? verifiedMusicianReviews(artist.id, blocked) : reviewsFor(artist.id).filter((r) => !blocked.includes(r.authorId)))
    .map((r) => ({ id: r.id, authorId: r.authorId, rating: r.rating, recommend: r.recommend, tags: r.tags ?? [], text: r.text, date: r.date, context: r.context }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const allReviews = [...mine, ...others];
  const reviewCount = musician ? score.total : stars.count;
  const reviewsLabel = plural(reviewCount, musician ? 'verified booking' : 'review');
  const followerCount = artist.followers + (following ? 1 : 0);
  const isBlocked = blocked.includes(artist.id);

  // Optional published availability (F05): helps planning, never confirms a booking.
  const openDays = WEEK.filter((d) => availability.days[d]);
  const blockedSoon = availability.blockedDates.filter((d) => d >= TODAY_ISO).sort().slice(0, 4);
  const showCalendar = !!services?.showCalendar;

  const openConnections = (tab: 'followers' | 'following') => router.push(`/connections/${artist.id}?tab=${tab}`);
  const openRatings = () => router.push(`/ratings/${artist.id}`);
  const book = () => router.push({ pathname: '/booking/new', params: { type: 'musician', id: artist.id } });
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
        <View style={{ height: 360 }}>
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
                <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 32, flexShrink: 1 }}>{artist.name}</Text>
                {artist.verified ? <Icon name="check-decagram" size={22} color="#A78BFA" /> : null}
              </Row>
              <Text style={{ color: colors.lilacLight, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{artist.title} · {artist.city}</Text>
            </View>
            {isBlocked || isOwner ? null : (
              <Button
                title={following ? 'Following' : 'Follow'}
                accessibilityLabel={following ? `Unfollow ${artist.name}` : `Follow ${artist.name}`}
                icon={following ? 'check' : 'plus'}
                size="md"
                variant={following ? 'secondary' : 'primary'}
                style={{ marginLeft: 12 }}
                onPress={() => toggleFollow(artist.id)}
              />
            )}
          </Row>
        </View>

        <View style={{ padding: 16, gap: 20 }}>
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

          {draft ? (
            <Banner icon="eye-outline" tone="warning">
              <View style={{ gap: 8 }}>
                <T v="smallBold" color={colors.warning}>Preview of your unpublished changes</T>
                <T v="small" color={colors.warning}>Bookers still see your published services until you publish this draft.</T>
                <Button title="Back to editor" size="sm" variant="secondary" icon="pencil-outline" hitSlop={4} style={{ alignSelf: 'flex-start' }} onPress={() => goBack('/pro/services')} />
              </View>
            </Banner>
          ) : null}

          {isBlocked ? (
            <Banner icon="block-helper" tone="danger">
              <View style={{ gap: 8 }}>
                <T v="smallBold" color={colors.danger}>You blocked {artist.name}</T>
                <T v="small" color={colors.danger}>They can’t message you or send you booking offers, and you won’t see their posts.</T>
                <Button title="Unblock" accessibilityLabel={`Unblock ${artist.name}`} variant="secondary" size="sm" icon="account-check-outline" hitSlop={4} style={{ alignSelf: 'flex-start' }} onPress={block} />
              </View>
            </Banner>
          ) : null}

          {/* Score: "would book again" from verified bookings (musicians), stars for anyone else. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 12, ...shadow(1) }}>
            <Row gap={16}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  musician
                    ? score.recommendPct == null
                      ? 'No verified bookings yet. See reviews'
                      : `${score.recommendPct}% would book again, from ${reviewsLabel}. See reviews`
                    : `Rated ${stars.rating.toFixed(1)} out of 5. See reviews`
                }
                onPress={openRatings}
                style={({ pressed }) => ({ flex: 1.3, alignItems: 'center', minHeight: 44, opacity: pressed ? 0.6 : 1 })}
              >
                {musician ? (
                  <>
                    <Row gap={4}>
                      <Icon name={score.recommendPct == null ? 'account-music-outline' : 'thumb-up'} size={18} color={colors.brand} />
                      <T v="h3">{score.recommendPct == null ? 'New' : `${score.recommendPct}%`}</T>
                    </Row>
                    <T v="small" style={{ fontSize: 11 }} center>{score.recommendPct == null ? 'No verified bookings' : 'would book again'}</T>
                  </>
                ) : (
                  <>
                    <T v="h3">{stars.rating ? stars.rating.toFixed(1).replace('.', ',') : 'New'}</T>
                    <Stars value={stars.rating} size={12} />
                  </>
                )}
              </Pressable>
              <View style={{ width: 1, height: 36, backgroundColor: colors.divider }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <T v="h3">{reviewCount}</T>
                <T v="small" style={{ fontSize: 11 }} center>{musician ? 'verified bookings' : 'reviews'}</T>
              </View>
              <View style={{ width: 1, height: 36, backgroundColor: colors.divider }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <T v="h3">{artist.eventsCount ?? 0}</T>
                <T v="small" style={{ fontSize: 11 }} center>gigs played</T>
              </View>
            </Row>
            {musician && score.topTags.length ? (
              <View style={{ gap: 8 }}>
                <T v="label">What bookers praise</T>
                <TagCounts tags={score.topTags.slice(0, 4)} />
              </View>
            ) : null}
          </View>

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

          {musician ? (
            <View style={{ gap: 10 }}>
              <T v="h3" accessibilityRole="header">Services and pricing</T>
              <ArtistPricingCard artist={artist} services={services} />
              <Banner icon="shield-check-outline">
                {quote
                  ? `A quote request carries no payment. ${artist.name} replies with an itemised quote, and you pay only if you accept it.`
                  : `Requests reach ${artist.name} with payment pending their decision. If they decline or don’t answer within 24 hours, the payment is released or refunded.`}
              </Banner>
            </View>
          ) : null}

          {musician && showCalendar ? (
            <View style={{ gap: 10 }}>
              <T v="h3" accessibilityRole="header">Availability</T>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 8, ...shadow(1) }}>
                <Row gap={10}>
                  <Icon name="calendar-week" size={20} color={colors.brand} />
                  <T v="bodyBold" style={{ flex: 1 }}>{openDays.length ? `Usually plays ${openDays.join(', ')}` : 'No regular days published'}</T>
                </Row>
                <T v="small">Minimum booking {plural(availability.minHours, 'hour')}{blockedSoon.length ? ` · not available ${blockedSoon.map(shortDate).join(', ')}` : ''}</T>
                <T v="small" color={colors.inkSoft}>The calendar helps you plan. It never confirms a booking: {artist.name} still accepts or declines each request.</T>
              </View>
            </View>
          ) : null}

          {lessons.length ? (
            <View style={{ gap: 10 }}>
              <View style={{ gap: 2 }}>
                <T v="h3" accessibilityRole="header">Lessons</T>
                <T v="small">Booked separately from performances, with their own price and terms.</T>
              </View>
              {lessons.map((l) => (
                <LessonCard key={l.id} lesson={l} onPress={!draft || publishedLessonIds.includes(l.id) ? () => router.push(`/lesson/${l.id}`) : undefined} />
              ))}
              {draft && lessons.some((l) => !publishedLessonIds.includes(l.id)) ? <T v="small">New lessons get their own page once you publish.</T> : null}
              {services?.lessonTerms?.trim() ? (
                <View style={{ gap: 2 }}>
                  <T v="label">Lesson terms</T>
                  <T v="small">{services.lessonTerms.trim()}</T>
                </View>
              ) : null}
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
              <T v="h3" accessibilityRole="header">Reviews</T>
              {musician ? (
                <Pressable accessibilityRole="button" accessibilityLabel="See all reviews" onPress={openRatings} hitSlop={8}>
                  <BookAgainBadge pct={score.recommendPct} total={score.total} />
                </Pressable>
              ) : null}
            </Row>
            {allReviews.slice(0, 3).map((r) => {
              const isMine = r.authorId === 'me';
              const p = isMine ? undefined : profileById(r.authorId);
              const authorName = isMine ? 'You' : p?.name ?? 'Domtak guest';
              return (
                <Row key={r.id} gap={12} align="flex-start" style={{ backgroundColor: colors.surface, padding: 12, borderRadius: radius.md, ...shadow(1) }}>
                  <Avatar src={isMine ? user.avatar : p?.avatar} size={36} label={authorName} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Row justify="space-between" gap={8}>
                      <T v="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>{authorName}</T>
                      {musician ? r.recommend != null ? <RecommendBadge recommend={r.recommend} /> : null : <Stars value={r.rating} size={12} />}
                    </Row>
                    <T v="small" style={{ fontSize: 12 }} numberOfLines={1}>{r.context} · {shortDate(r.date)}</T>
                    {musician ? <ReviewTags tags={r.tags} /> : null}
                    {r.text ? <T v="small" color={colors.inkSoft}>{r.text}</T> : null}
                  </View>
                </Row>
              );
            })}
            {allReviews.length ? (
              <Button title={`See all reviews (${allReviews.length})`} variant="secondary" size="md" icon={musician ? 'thumb-up-outline' : 'star-outline'} onPress={openRatings} />
            ) : (
              <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: radius.md, gap: 4, ...shadow(1) }}>
                <T v="bodyBold">No verified bookings yet</T>
                <T v="small">{`Scores only come from bookings completed through Domtak. Book ${artist.name} and you can say whether you’d book them again.`}</T>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      {isBlocked ? null : (
        <BottomBar>
          {isOwner || draft ? (
            <View style={{ gap: 8 }}>
              <T v="small" center>{draft ? 'Preview only. Nothing here is live yet.' : 'This is how bookers see your profile.'}</T>
              <Button title={draft ? 'Back to editor' : 'Edit services and pricing'} icon="pencil-outline" onPress={() => (draft ? goBack('/pro/services') : router.navigate('/pro/services'))} />
            </View>
          ) : musician ? (
            <Row gap={12}>
              <Button title="Message" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => router.push(`/chat/${ensureConversation(artist.id)}`)} />
              <Button title={quote ? 'Request quote' : 'Book'} accessibilityLabel={quote ? `Request a quote from ${artist.name}` : `Book ${artist.name}`} size="lg" style={{ flex: 1.4 }} onPress={book} />
            </Row>
          ) : (
            <Button title="Message" size="lg" onPress={() => router.push(`/chat/${ensureConversation(artist.id)}`)} />
          )}
        </BottomBar>
      )}
      <ActionSheet
        visible={menuOpen}
        title={artist.name}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: 'Share profile', icon: 'share-variant-outline', onPress: () => Share.share({ message: `${artist.name} (${artist.handle}) on Domtak: ${artist.title} from ${artist.city}` }).catch(() => {}) },
          { label: 'See all reviews', icon: musician ? 'thumb-up-outline' : 'star-outline', onPress: openRatings },
          // You don't block or report your own profile.
          ...(isOwner
            ? []
            : [
                isBlocked
                  ? { label: `Unblock ${artist.name}`, icon: 'account-check-outline' as const, onPress: block }
                  : { label: `Block ${artist.name}`, icon: 'account-cancel-outline' as const, destructive: true, onPress: block },
                { label: 'Report profile', icon: 'flag-outline' as const, destructive: true, onPress: () => setReportOpen(true) },
              ]),
        ]}
      />
      <ReasonSheet
        visible={reportOpen}
        title={`Report ${artist.name}`}
        body={`Our team reviews every report against the community rules. ${artist.name} won’t see who reported them.`}
        reasons={REPORT_REASONS}
        confirmLabel="Send report"
        destructive
        notePlaceholder="Anything else we should know (optional)"
        onClose={() => setReportOpen(false)}
        onSubmit={(reason, note) => {
          reportContent('profile', artist.id, reason, note || undefined);
          toast('Report sent. Our team will review this profile.');
        }}
      />
    </View>
  );
}
