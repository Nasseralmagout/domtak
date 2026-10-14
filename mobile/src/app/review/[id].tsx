import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Button, Card, Chip, Field, Icon, IconButton, Photo, Row, Stars, T } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { profileById, venueById } from '../../data/mock';
import { parse, shortDate, TODAY } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp, useEvent } from '../../store/useApp';
import { colors } from '../../theme';

const WORDS = ['', 'Not great', 'It was okay', 'Good night', 'Great night', 'Unforgettable'];
const TAGS = ['Sound', 'Lineup', 'Crowd', 'Venue', 'Door & queue', 'Value', 'Punctual', 'Communication'];

export default function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  const existing = useApp((s) => (id ? s.reviews[id] : undefined));
  const usedTicket = useApp((s) => (id ? s.tickets.some((t) => t.eventId === id && t.status === 'used') : false));
  const submit = useApp((s) => s.submitReview);
  const addPost = useApp((s) => s.addPost);
  const [rating, setRating] = useState(existing?.rating ?? 4);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? ['Sound']);
  const [text, setText] = useState(existing?.text ?? '');
  const [share, setShare] = useState(!existing);
  const [done, setDone] = useState(false);
  const [photos, setPhotos] = useState<ImgKey[]>([]);

  let title = 'Your experience';
  let sub = '';
  let image: ImgKey = 'ev_dance_world';
  if (event) {
    title = event.title;
    sub = `Attended ${shortDate(event.start)} · ${venueById(event.venueId)?.name}`;
    image = event.cover;
  } else if (booking) {
    const a = booking.type === 'musician' ? profileById(booking.targetId) : undefined;
    const v = booking.type === 'venue' ? venueById(booking.targetId) : undefined;
    title = a?.name ?? v?.name ?? 'Booking';
    sub = `${booking.eventTitle} · ${shortDate(booking.date)}`;
    image = a?.avatar ?? v?.cover ?? image;
  }
  // Photos you can attach: the event or venue gallery, falling back to the cover.
  const gallery: ImgKey[] = (() => {
    if (event) return [event.cover, ...(venueById(event.venueId)?.gallery ?? [])];
    if (booking?.type === 'venue') return [image, ...(venueById(booking.targetId)?.gallery ?? [])];
    if (booking) return [image, ...(profileById(booking.targetId)?.gallery ?? [])];
    return [image];
  })().filter((k, i, all) => all.indexOf(k) === i);
  const nextPhoto = gallery.find((g) => !photos.includes(g));
  const back = () => goBack(booking ? `/booking/${booking.id}` : '/my-bookings?tab=tickets');

  if (!event && !booking) {
    return (
      <Screen header={<ScreenHeader title="Leave a review" close onBack={back} />}>
        <T v="body">There’s nothing to review here yet.</T>
        <Button title="Your bookings" onPress={() => router.replace('/my-bookings?tab=tickets')} />
      </Screen>
    );
  }

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
        <T v="h3">Reviews open after the event</T>
        <T v="body" color={colors.muted}>{`Come back after ${when} to rate ${title}.`}</T>
        <Button title={booking ? 'Back to booking' : 'Your tickets'} variant="secondary" onPress={back} />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen header={<ScreenHeader close onBack={back} />} contentStyle={{ alignItems: 'center', paddingTop: 48, gap: 14, paddingHorizontal: 24 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="star" size={48} color={colors.gold} />
        </View>
        <T v="h2" center>Thanks for the review!</T>
        <T v="body" color={colors.muted} center>
          {booking
            ? `It’s now on ${title}’s page${share ? ' and shared to your feed' : ''}.`
            : share
              ? 'It’s shared to your feed. You can edit it any time from Your bookings.'
              : 'It’s saved with your tickets. You can edit it any time from Your bookings.'}
        </T>
        <Button title="Done" full onPress={back} style={{ marginTop: 16 }} />
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
      header={<ScreenHeader title={existing ? 'Edit your review' : 'Leave a review'} close onBack={back} />}
      footer={
        <BottomBar>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Also share to my feed" accessibilityState={{ checked: share }} onPress={() => setShare(!share)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, minHeight: 40 }}>
            <Icon name={share ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={colors.brand} />
            <T v="body">Also share to my feed</T>
          </Pressable>
          <Button
            title={existing ? 'Update review' : 'Post review'}
            onPress={() => {
              if (!id) return;
              submit(id, { rating, tags, text: text.trim() });
              if (share) {
                const media = photos.length ? photos : [image];
                addPost({ kind: media.length > 1 ? 'carousel' : 'photo', media, caption: `${'★'.repeat(rating)} ${title} — ${text.trim() || WORDS[rating]}`, eventId: event?.id });
              }
              toast(existing ? 'Review updated' : 'Review posted');
              setDone(true);
            }}
          />
        </BottomBar>
      }
    >
      <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Photo src={image} style={{ width: 60, height: 60 }} radius={14} />
        <View style={{ flex: 1 }}>
          <T v="title">{title}</T>
          <T v="small">{sub}</T>
        </View>
      </Card>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <T v="h3">How was it?</T>
        <Stars value={rating} size={40} onChange={setRating} />
        <T v="bodyBold" color={colors.brand}>{WORDS[rating]}</T>
      </View>
      <View style={{ gap: 10 }}>
        <T v="label">What stood out?</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {TAGS.map((t) => <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} />)}
        </Row>
      </View>
      <Field label="Your review" value={text} onChangeText={setText} multiline placeholder="The sound was unreal…" />
      <View style={{ gap: 8 }}>
        <T v="label">Photos{photos.length ? ` (${photos.length})` : ''}</T>
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
              accessibilityLabel="Add a photo from this event"
              onPress={() => setPhotos([...photos, nextPhoto])}
              style={{ width: 72, height: 72, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#9C8FC2', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="image-plus" size={26} color={colors.brand} />
            </Pressable>
          ) : null}
        </Row>
        <T v="small">{photos.length ? 'Photos are added to the post when you share to your feed.' : 'Add photos from the night to your review.'}</T>
      </View>
    </Screen>
  );
}
