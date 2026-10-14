import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomBar, Screen, ScreenHeader } from '../../components/layout';
import { Button, Card, Chip, Field, Icon, Photo, Row, Stars, T } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { profileById, venueById } from '../../data/mock';
import { shortDate } from '../../lib/format';
import { useApp, useEvent } from '../../store/useApp';
import { colors } from '../../theme';

const WORDS = ['', 'Not great', 'It was okay', 'Good night', 'Great night', 'Unforgettable'];
const TAGS = ['Sound', 'Lineup', 'Crowd', 'Venue', 'Door & queue', 'Value', 'Punctual', 'Communication'];

export default function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  const existing = useApp((s) => (id ? s.reviews[id] : undefined));
  const submit = useApp((s) => s.submitReview);
  const addPost = useApp((s) => s.addPost);
  const [rating, setRating] = useState(existing?.rating ?? 4);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? ['Sound']);
  const [text, setText] = useState(existing?.text ?? '');
  const [share, setShare] = useState(true);
  const [done, setDone] = useState(false);

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

  if (done) {
    return (
      <Screen header={<ScreenHeader close />} contentStyle={{ alignItems: 'center', paddingTop: 48, gap: 14, paddingHorizontal: 24 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="star" size={48} color={colors.gold} />
        </View>
        <T v="h2" center>Thanks for the review!</T>
        <T v="body" color={colors.muted} center>{share ? 'It’s on the page and shared with your followers.' : 'It’s now visible on the page.'}</T>
        <Button title="Done" full onPress={() => router.back()} style={{ marginTop: 16 }} />
        <Button title="Edit review" variant="ghost" full onPress={() => setDone(false)} />
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      header={<ScreenHeader title="Leave a review" close />}
      footer={
        <BottomBar>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: share }} onPress={() => setShare(!share)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Icon name={share ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={colors.brand} />
            <T v="body">Also share to my feed</T>
          </Pressable>
          <Button
            title="Post review"
            onPress={() => {
              if (!id) return;
              submit(id, { rating, tags, text });
              if (share) addPost({ kind: 'photo', media: [image], caption: `${'★'.repeat(rating)} ${title} — ${text || WORDS[rating]}`, eventId: event?.id });
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
      <Row gap={10}>
        <Pressable accessibilityRole="button" accessibilityLabel="Add photo" style={{ width: 72, height: 72, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#9C8FC2', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={26} color={colors.brand} />
        </Pressable>
        <Photo src={image} style={{ width: 72, height: 72 }} radius={14} />
      </Row>
    </Screen>
  );
}
