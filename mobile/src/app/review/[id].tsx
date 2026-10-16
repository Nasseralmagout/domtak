import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Chip, Field, Icon, IconButton, Photo, Row, Stars, T } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { profileById, venueById } from '../../data/mock';
import { lessonOf, providerOf } from '../../lib/booking';
import { parse, shortDate, TODAY } from '../../lib/format';
import { isMusician, PRAISE_TAGS } from '../../lib/ratings';
import { toast } from '../../store/toast';
import { canPostToFeed, type Review as ReviewData, useApp, useEvent } from '../../store/useApp';
import { colors } from '../../theme';

const WORDS = ['', 'Not great', 'It was okay', 'Good night', 'Great night', 'Unforgettable'];
/** Star reviews (venues and events). Musicians get praise tags instead (PRAISE_TAGS). */
const TAGS = ['Sound', 'Lineup', 'Crowd', 'Venue', 'Door & queue', 'Value', 'Punctual', 'Communication'];

/** Yes / No choice for "Would you book them again?". */
function Choice({ yes, selected, onPress }: { yes: boolean; selected: boolean; onPress: () => void }) {
  const tint = yes ? colors.success : colors.danger;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={yes ? 'Yes, I would book them again' : 'No, I would not book them again'}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 96,
        borderRadius: 18,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? tint : colors.borderStrong,
        backgroundColor: selected ? (yes ? colors.successBg : colors.dangerBg) : colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name={yes ? (selected ? 'thumb-up' : 'thumb-up-outline') : selected ? 'thumb-down' : 'thumb-down-outline'} size={30} color={selected ? tint : colors.muted} />
      <T v="bodyBold" color={selected ? tint : colors.ink}>{yes ? 'Yes' : 'No'}</T>
    </Pressable>
  );
}

export default function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  const existing = useApp((s) => (id ? s.reviews[id] : undefined));
  const usedTicket = useApp((s) => (id ? s.tickets.some((t) => t.eventId === id && t.status === 'used') : false));
  const user = useApp((s) => s.user);
  const back = () => goBack(booking ? `/booking/${booking.id}` : '/my-bookings?tab=tickets');

  if (!event && !booking) {
    return (
      <Screen header={<ScreenHeader title="Leave a review" close onBack={back} />}>
        <T v="body">There’s nothing to review here yet.</T>
        <Button title="Your bookings" onPress={() => router.replace('/my-bookings?tab=tickets')} />
      </Screen>
    );
  }

  let title = 'Your experience';
  let sub = '';
  let image: ImgKey = 'ev_dance_world';
  if (event) {
    title = event.title;
    sub = `Attended ${shortDate(event.start)} · ${venueById(event.venueId)?.name ?? 'Venue'}`;
    image = event.cover;
  } else if (booking) {
    const p = providerOf(booking);
    const lesson = lessonOf(booking);
    title = p.name;
    sub = `${lesson ? lesson.title : booking.eventTitle} · ${shortDate(booking.date)}`;
    image = p.image ?? image;
  }
  // Musicians, DJs and bands (performances and lessons) are reviewed with "would book again", never stars.
  const musician = !event && !!booking && booking.type !== 'venue' && isMusician(booking.targetId);

  // Reviews open once the night is over: a past event or used ticket, or a completed booking.
  const canReview = !!existing || (event ? parse(event.end) < TODAY || usedTicket : booking?.status === 'completed');
  if (!canReview) {
    const when = event ? shortDate(event.start) : booking ? shortDate(booking.date) : '';
    return (
      <Screen header={<ScreenHeader title="Leave a review" close onBack={back} />}>
        <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Photo src={image} style={{ width: 60, height: 60 }} radius={14} />
          <View style={{ flex: 1 }}>
            <T v="title">{title}</T>
            <T v="small">{sub}</T>
          </View>
        </Card>
        <T v="h3">Reviews open after the {booking ? 'booking is completed' : 'event'}</T>
        <T v="body" color={colors.muted}>
          {booking ? `Only completed bookings can be reviewed, so every score comes from a real booking. Come back after ${when}.` : `Come back after ${when} to rate ${title}.`}
        </T>
        <Button title={booking ? 'Back to booking' : 'Your tickets'} variant="secondary" onPress={back} />
      </Screen>
    );
  }

  return (
    <ReviewForm
      key={`${id}-${musician ? 'm' : 's'}`}
      id={id!}
      title={title}
      sub={sub}
      image={image}
      musician={musician}
      existing={existing}
      canShare={canPostToFeed(user)}
      eventId={event?.id}
      isBooking={!!booking}
      gallery={(() => {
        if (event) return [event.cover, ...(venueById(event.venueId)?.gallery ?? [])];
        if (booking?.type === 'venue') return [image, ...(venueById(booking.targetId)?.gallery ?? [])];
        if (booking) return [image, ...(profileById(booking.targetId)?.gallery ?? [])];
        return [image];
      })().filter((k, i, all) => all.indexOf(k) === i)}
      onBack={back}
    />
  );
}

function ReviewForm({
  id,
  title,
  sub,
  image,
  musician,
  existing,
  canShare,
  eventId,
  isBooking,
  gallery,
  onBack,
}: {
  id: string;
  title: string;
  sub: string;
  image: ImgKey;
  musician: boolean;
  existing?: ReviewData;
  /** Only approved professionals post to the feed; members keep reviews on the page. */
  canShare: boolean;
  eventId?: string;
  isBooking: boolean;
  gallery: ImgKey[];
  onBack: () => void;
}) {
  const submit = useApp((s) => s.submitReview);
  const addPost = useApp((s) => s.addPost);
  const praise = PRAISE_TAGS as readonly string[];
  const [rating, setRating] = useState(existing?.rating && existing.rating > 0 ? existing.rating : 4);
  const [recommend, setRecommend] = useState<boolean | undefined>(existing?.recommend);
  const [tags, setTags] = useState<string[]>(() => (musician ? (existing?.tags ?? []).filter((t) => praise.includes(t)) : existing?.tags ?? ['Sound']));
  const [text, setText] = useState(existing?.text ?? '');
  const [share, setShare] = useState(canShare && !existing);
  const [done, setDone] = useState(false);
  const [photos, setPhotos] = useState<ImgKey[]>([]);

  const nextPhoto = gallery.find((g) => !photos.includes(g));
  const toggleTag = (t: string) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  const ready = !musician || recommend != null;
  const sharing = canShare && share;

  const post = () => {
    if (!ready) return;
    const body = text.trim();
    // Musician bookings store rating 0: their score comes from recommend + tags, never stars.
    submit(id, musician ? { rating: 0, recommend, tags, text: body } : { rating, tags, text: body });
    if (sharing) {
      const media = photos.length ? photos : [image];
      const verdict = musician ? (recommend ? 'Would book again' : 'Would not book again') : '★'.repeat(rating);
      addPost({ kind: media.length > 1 ? 'carousel' : 'photo', media, caption: `${verdict} · ${title} — ${body || (musician ? tags.join(', ') : WORDS[rating])}`, eventId });
    }
    toast(existing ? 'Review updated' : 'Review posted');
    setDone(true);
  };

  if (done) {
    return (
      <Screen header={<ScreenHeader close onBack={onBack} />} contentStyle={{ alignItems: 'center', paddingTop: 48, gap: 14, paddingHorizontal: 24 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={musician ? 'thumb-up' : 'star'} size={48} color={colors.gold} />
        </View>
        <T v="h2" center>Thanks for the review!</T>
        <T v="body" color={colors.muted} center>
          {musician
            ? `It counts toward ${title}’s “would book again” score, which only uses completed bookings${sharing ? '. It’s also shared to your feed' : ''}.`
            : isBooking
              ? `It’s now on ${title}’s page${sharing ? ' and shared to your feed' : ''}.`
              : sharing
                ? 'It’s shared to your feed. You can edit it any time from Your bookings.'
                : 'It’s saved with your tickets. You can edit it any time from Your bookings.'}
        </T>
        <Button title="Done" full onPress={onBack} style={{ marginTop: 16 }} />
        <Button
          title="Edit review"
          variant="ghost"
          full
          onPress={() => {
            // It's already been shared once; editing shouldn't post it to the feed a second time by default.
            setShare(false);
            setDone(false);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      header={<ScreenHeader title={existing ? 'Edit your review' : 'Leave a review'} close onBack={onBack} />}
      footer={
        <BottomBar>
          {canShare ? (
            <Pressable accessibilityRole="checkbox" accessibilityLabel="Also share to my feed" accessibilityState={{ checked: share }} onPress={() => setShare(!share)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, minHeight: 44 }}>
              <Icon name={share ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={colors.brand} />
              <T v="body">Also share to my feed</T>
            </Pressable>
          ) : null}
          {!ready ? <T v="small" center style={{ marginBottom: 8 }}>Choose Yes or No to post your review.</T> : null}
          <Button title={existing ? 'Update review' : 'Post review'} disabled={!ready} onPress={post} />
        </BottomBar>
      }
    >
      <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Photo src={image} style={{ width: 60, height: 60 }} radius={musician ? 30 : 14} />
        <View style={{ flex: 1 }}>
          <T v="title">{title}</T>
          <T v="small">{sub}</T>
        </View>
      </Card>

      {musician ? (
        <>
          <View style={{ gap: 10 }}>
            <T v="h3" center>Would you book them again?</T>
            <Row gap={12}>
              <Choice yes selected={recommend === true} onPress={() => setRecommend(true)} />
              <Choice yes={false} selected={recommend === false} onPress={() => setRecommend(false)} />
            </Row>
          </View>
          <View style={{ gap: 10 }}>
            <T v="label">{recommend === false ? 'Anything they did well? (optional)' : 'What did they do well?'}</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {PRAISE_TAGS.map((t) => <Chip key={t} label={t} icon={tags.includes(t) ? 'check' : undefined} selected={tags.includes(t)} onPress={() => toggleTag(t)} />)}
            </Row>
            <T v="small">Praise tags are counted on their profile, e.g. “On time · 12”.</T>
          </View>
          <Field label="Your review" value={text} onChangeText={setText} multiline placeholder={recommend === false ? 'What should other bookers know?' : 'Kept the floor full all night…'} maxLength={500} />
          <Banner icon="shield-check-outline">Musicians aren’t rated with stars. Your answer counts toward the share of customers from completed bookings who would book them again.</Banner>
        </>
      ) : (
        <>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <T v="h3">How was it?</T>
            <Stars value={rating} size={40} onChange={setRating} />
            <T v="bodyBold" color={colors.brand}>{WORDS[rating]}</T>
          </View>
          <View style={{ gap: 10 }}>
            <T v="label">What stood out?</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {TAGS.map((t) => <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => toggleTag(t)} />)}
            </Row>
          </View>
          <Field label="Your review" value={text} onChangeText={setText} multiline placeholder="The sound was unreal…" maxLength={500} />
        </>
      )}

      {sharing ? (
        <View style={{ gap: 8 }}>
          <T v="label">Photos for your post{photos.length ? ` (${photos.length})` : ''}</T>
          <Row gap={10} style={{ flexWrap: 'wrap' }}>
            {photos.map((p) => (
              <View key={p}>
                <Photo src={p} style={{ width: 72, height: 72 }} radius={14} />
                <View style={{ position: 'absolute', top: -10, right: -10 }}>
                  <IconButton name="close" label="Remove photo" size={28} iconSize={14} bg={colors.ink} color={colors.white} onPress={() => setPhotos(photos.filter((x) => x !== p))} />
                </View>
              </View>
            ))}
            {nextPhoto ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a photo"
                onPress={() => setPhotos([...photos, nextPhoto])}
                style={{ width: 72, height: 72, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#9C8FC2', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="image-plus" size={26} color={colors.brand} />
              </Pressable>
            ) : null}
          </Row>
          <T v="small">Photos go into the feed post only.</T>
        </View>
      ) : !canShare ? (
        <T v="small">{eventId ? 'Your review is saved with your tickets. Want to share photos from the night? Add them in a comment in the event discussion.' : `Your review appears on ${title}’s page.`}</T>
      ) : null}
    </Screen>
  );
}
