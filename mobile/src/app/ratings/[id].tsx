import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { RecommendBadge, ReviewTags } from '../../components/cards';
import { BottomBar, Screen, ScreenHeader, goBack } from '../../components/layout';
import { Avatar, Banner, Button, Card, Chip, EmptyState, Photo, Pill, ProgressBar, Row, Stars, T } from '../../components/ui';
import { profileById, reviewsFor, venueById } from '../../data/mock';
import { plural, shortDate } from '../../lib/format';
import { isMusician, PRAISE_TAGS, verifiedMusicianReviews } from '../../lib/ratings';
import { useApp, useArtistScore, useRating, useVenue } from '../../store/useApp';
import { colors, fonts } from '../../theme';

interface Item {
  id: string;
  authorId: string;
  rating: number;
  text: string;
  date: string;
  context: string;
  bookingId?: string;
  recommend?: boolean;
  tags: string[];
}

type RecommendFilter = 'all' | 'yes' | 'no';

const fmt = (n: number) => n.toFixed(1).replace('.', ',');

export default function Ratings() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  const myReviews = useApp((s) => s.reviews);
  const blocked = useApp((s) => s.blocked);
  const [stars, setStars] = useState(0);
  const [rec, setRec] = useState<RecommendFilter>('all');
  // Venues first (every venue also has a stand-in profile); useVenue includes the owner's listing edits.
  const venue = useVenue(id);
  const artist = venue ? undefined : profileById(id);
  // Venues keep stars; musicians, DJs and bands are scored by "would book again".
  const musician = !!artist && isMusician(id);
  const { rating: avg } = useRating(id);
  const score = useArtistScore(id);

  if (!artist && !venue) {
    return (
      <Screen header={<ScreenHeader title="Reviews" />}>
        <EmptyState icon="star-off-outline" title="Nothing to review here" body="This artist or venue could not be found." action="Go back" onAction={() => goBack('/')} />
      </Screen>
    );
  }

  const name = artist ? artist.name : venue!.name;
  const sub = artist ? artist.title : `${venue!.type} · ${venue!.area}, ${venue!.city}`;
  const image = artist ? artist.avatar : venue!.cover;
  const profileHref = !artist ? `/venue/${venue!.id}` : artist.kind === 'fan' || artist.kind === 'organizer' ? `/profile/${artist.id}` : `/artist/${artist.id}`;
  const isBlocked = blocked.includes(id);
  const bookable = !isBlocked && (!!venue || musician);

  // Your own reviews of completed bookings with this target come first (the same ones the score counts).
  const mine: Item[] = bookings
    .filter((b) => b.targetId === id && myReviews[b.id] && (musician ? b.type !== 'venue' && b.status === 'completed' && myReviews[b.id].recommend != null : myReviews[b.id].rating > 0))
    .map((b) => {
      const r = myReviews[b.id];
      const tags = r.tags ?? [];
      return {
        id: `mine-${b.id}`,
        authorId: 'me',
        rating: r.rating,
        recommend: r.recommend,
        tags,
        text: r.text || (!musician && tags.length ? `Loved the ${tags.join(', ').toLowerCase()}.` : ''),
        date: b.date,
        context: b.eventTitle,
        bookingId: b.id,
      };
    });
  const seeded: Item[] = (musician ? verifiedMusicianReviews(id, blocked) : reviewsFor(id).filter((r) => !blocked.includes(r.authorId)))
    .map((r) => ({ id: r.id, authorId: r.authorId, rating: r.rating, text: r.text, date: r.date, context: r.context, recommend: r.recommend, tags: r.tags ?? [] }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const all = [...mine, ...seeded];
  const total = all.length;

  // Stars (venues)
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: all.filter((r) => Math.round(r.rating) === n).length }));
  // Recommendation (musicians)
  const yes = all.filter((r) => r.recommend).length;
  const no = total - yes;
  const tagCounts = [...PRAISE_TAGS, ...all.flatMap((r) => r.tags).filter((t) => !(PRAISE_TAGS as readonly string[]).includes(t))]
    .filter((t, i, list) => list.indexOf(t) === i)
    .map((tag) => ({ tag, count: all.filter((r) => r.tags.includes(tag)).length }))
    .sort((a, b) => b.count - a.count);

  const shown = musician
    ? all.filter((r) => rec === 'all' || (rec === 'yes' ? r.recommend : !r.recommend))
    : stars
      ? all.filter((r) => Math.round(r.rating) === stars)
      : all;
  // Prefer a completed booking you have not reviewed yet; otherwise offer to edit the latest review.
  const completedAll = bookings.filter((b) => b.targetId === id && b.status === 'completed');
  const completed = completedAll.find((b) => !myReviews[b.id]) ?? completedAll[0];

  const openAuthor = (authorId: string) => {
    if (authorId === 'me') return router.push('/profile/me');
    if (venueById(authorId)) return router.push(`/venue/${authorId}`);
    const p = profileById(authorId);
    if (!p) return;
    router.push(p.kind === 'fan' || p.kind === 'organizer' ? `/profile/${p.id}` : `/artist/${p.id}`);
  };

  return (
    <Screen
      header={<ScreenHeader title="Reviews" subtitle={name} />}
      footer={
        completed ? (
          <BottomBar>
            <Button title={myReviews[completed.id] ? 'Edit your review' : 'Write a review'} icon="pencil-outline" onPress={() => router.push(`/review/${completed.id}`)} />
          </BottomBar>
        ) : undefined
      }
    >
      <Card onPress={() => router.push(profileHref as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Photo src={image} style={{ width: 56, height: 56 }} radius={artist ? 28 : 14} accessibilityLabel={name} />
        <View style={{ flex: 1 }}>
          <T v="title" numberOfLines={1}>{name}</T>
          <T v="small" numberOfLines={1}>{sub}</T>
        </View>
        <T v="smallBold" color={colors.brand}>View</T>
      </Card>

      {total && musician ? (
        <>
          <Card style={{ gap: 12 }}>
            <Row gap={16} align="center">
              <View accessible accessibilityLabel={`${score.recommendPct ?? 0}% would book again, ${yes} of ${total} verified bookings`} style={{ alignItems: 'center', minWidth: 104 }}>
                <T style={{ fontFamily: fonts.display, fontSize: 44, lineHeight: 50, color: colors.brandDeep }}>{score.recommendPct ?? 0}%</T>
                <T v="small" center>would book again</T>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <T v="bodyBold">{yes} of {plural(total, 'verified booking')}</T>
                <ProgressBar value={total ? yes / total : 0} color={colors.success} label="Share who would book again" />
                <T v="small">{no ? `${plural(no, 'customer')} would not book again.` : 'Everyone would book again.'}</T>
              </View>
            </Row>
          </Card>

          <Card style={{ gap: 10 }}>
            <T v="title">Praise from bookers</T>
            {tagCounts.map(({ tag, count }) => (
              <View key={tag} accessible accessibilityLabel={`${tag}: ${plural(count, 'booking')}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 26 }}>
                <T v="smallBold" color={count ? colors.ink : colors.subtle} style={{ width: 118 }} numberOfLines={1}>{tag}</T>
                <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.divider, overflow: 'hidden' }}>
                  <View style={{ height: 8, borderRadius: 4, width: `${Math.round((count / total) * 100)}%`, backgroundColor: colors.brand }} />
                </View>
                <T v="small" style={{ width: 22, textAlign: 'right' }}>{count}</T>
              </View>
            ))}
          </Card>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            <Chip label={`All ${total}`} selected={rec === 'all'} onPress={() => setRec('all')} />
            <Chip label={`Recommended (${yes})`} icon="thumb-up-outline" selected={rec === 'yes'} onPress={() => setRec('yes')} />
            <Chip label={`Not recommended (${no})`} icon="thumb-down-outline" selected={rec === 'no'} onPress={() => setRec('no')} />
          </ScrollView>
        </>
      ) : null}

      {total && !musician ? (
        <>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <View accessible accessibilityLabel={`Average rating ${fmt(avg)} out of 5 from ${plural(total, 'review')}`} style={{ alignItems: 'center', gap: 4, minWidth: 96 }}>
              <T style={{ fontFamily: fonts.display, fontSize: 44, lineHeight: 50, color: colors.brandDeep }}>{fmt(avg)}</T>
              <Stars value={avg} size={16} />
              <T v="small">{plural(total, 'review')}</T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              {dist.map(({ n, count }) => {
                const on = stars === n;
                return (
                  <View key={n} accessible accessibilityLabel={`${n} star${n > 1 ? 's' : ''}: ${plural(count, 'review')}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 }}>
                    <T v="smallBold" color={on ? colors.brand : colors.inkSoft} style={{ width: 10, textAlign: 'right' }}>{n}</T>
                    <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.divider, overflow: 'hidden' }}>
                      <View style={{ height: 8, borderRadius: 4, width: `${Math.round((count / total) * 100)}%`, backgroundColor: on || !stars ? colors.star : colors.disabled }} />
                    </View>
                    <T v="small" style={{ width: 22, textAlign: 'right' }}>{count}</T>
                  </View>
                );
              })}
            </View>
          </Card>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            <Chip label={`All ${total}`} selected={stars === 0} onPress={() => setStars(0)} />
            {dist.map(({ n, count }) => (
              <Chip key={n} label={`${n} (${count})`} icon="star" selected={stars === n} onPress={() => setStars(n)} />
            ))}
          </ScrollView>
        </>
      ) : null}

      {total ? (
        shown.length ? (
          shown.map((r) => {
            const isMine = r.authorId === 'me';
            const author = isMine ? undefined : profileById(r.authorId);
            const authorName = isMine ? user.name : author?.name ?? 'Domtak guest';
            return (
              <Card key={r.id} style={{ gap: 10 }}>
                <Row gap={12}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${isMine ? 'your' : `${authorName}’s`} profile`}
                    disabled={!isMine && !author}
                    onPress={() => openAuthor(r.authorId)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minHeight: 44 }}
                  >
                    <Avatar src={isMine ? user.avatar : author?.avatar} size={42} label={authorName} />
                    <View style={{ flex: 1 }}>
                      <Row gap={6}>
                        <T v="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>{authorName}</T>
                        {isMine ? <Pill label="Your review" tone="brand" /> : null}
                      </Row>
                      <T v="small" numberOfLines={1}>{r.context}</T>
                    </View>
                  </Pressable>
                  <T v="small" style={{ fontSize: 12 }}>{shortDate(r.date)}</T>
                </Row>
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {musician ? <RecommendBadge recommend={!!r.recommend} /> : <Stars value={r.rating} size={15} />}
                  <Pill label="Verified booking" tone="success" icon="check" />
                </Row>
                {musician ? <ReviewTags tags={r.tags} /> : null}
                {r.text ? <T v="body" color={colors.inkSoft}>{r.text}</T> : null}
                {isMine && r.bookingId ? (
                  <Button title="Edit review" variant="ghost" size="sm" icon="pencil-outline" hitSlop={6} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => router.push(`/review/${r.bookingId}`)} />
                ) : null}
              </Card>
            );
          })
        ) : (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
            <T v="bodyBold" center>{musician ? (rec === 'yes' ? 'No recommendations yet' : 'Nobody said they would not book again') : `No ${stars}-star reviews yet`}</T>
            <Button title="Show all reviews" variant="secondary" size="md" onPress={() => (musician ? setRec('all') : setStars(0))} />
          </View>
        )
      ) : (
        <EmptyState
          icon={musician ? 'account-music-outline' : 'star-outline'}
          title={musician ? 'No verified bookings yet' : 'No reviews yet'}
          body={musician ? `${name} has no reviews from completed Domtak bookings yet, so there is no score to show.` : `${name} hasn’t been reviewed yet. Reviews appear after a completed booking on Domtak.`}
          action={!completed && bookable ? `Book ${name}` : undefined}
          onAction={!completed && bookable ? () => router.push({ pathname: '/booking/new', params: { type: musician ? 'musician' : 'venue', id } }) : undefined}
        />
      )}

      <Banner icon="shield-check-outline">
        {musician
          ? 'Musicians are not rated with stars. Their score is the share of customers from completed Domtak bookings who would book them again, plus the praise those customers picked.'
          : 'Only people who booked through Domtak can leave a review, so every rating comes from a real event.'}
      </Banner>
    </Screen>
  );
}
