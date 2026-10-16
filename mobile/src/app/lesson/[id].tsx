import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackOverlay, BookAgainLine, HeartToggle, LessonCard, lessonPriceLabel } from '../../components/cards';
import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Banner, Button, Card, EmptyState, Icon, IconButton, InfoRow, Photo, Pill, Row, T } from '../../components/ui';
import type { Lesson } from '../../data/types';
import { bookingLabel, bookingTone, isClosed, PAYMENT_NOTE } from '../../lib/booking';
import { euro, isoDay, shortDate, TODAY } from '../../lib/format';
import { LEARNER_FORMAT_LABEL } from '../../store/discovery';
import { LESSON_FORMAT_ICON, OWN_ARTIST_ID, useArtistServices, useLesson } from '../../store/services';
import { activeWorkspace, useApp, type Weekday } from '../../store/useApp';
import { colors, fonts, radius } from '../../theme';

const WEEK: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TODAY_ISO = isoDay(TODAY);

const isQuote = (l: Lesson) => !!l.quote || l.price == null;

function locationText(l: Lesson) {
  if (l.format === 'online') return 'Online. The link is shared in chat once the teacher confirms.';
  if (l.location) return l.location;
  if (l.format === 'at-studio') return 'The teacher’s studio. The address is shared once the session is confirmed.';
  return 'Agree the place in your request.';
}

export default function LessonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hit = useLesson(id);
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  const blocked = useApp((s) => s.blocked);
  const availability = useApp((s) => s.availability);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const wishlist = useApp((s) => s.wishlist.artists);
  const toggleWish = useApp((s) => s.toggleWish);
  const services = useArtistServices(hit?.artist.id);

  // Your latest request for this lesson that is still open (awaiting, accepted, confirmed…).
  const openRequest = useMemo(
    () => (hit ? bookings.find((b) => b.type === 'lesson' && b.lessonId === hit.lesson.id && !isClosed(b.status) && b.status !== 'completed') : undefined),
    [bookings, hit],
  );

  if (!hit) {
    return (
      <Screen header={<ScreenHeader title="Lesson" onBack={() => goBack('/lessons')} />}>
        <EmptyState icon="school-outline" title="Lesson not available" body="This lesson is no longer offered, or the link is out of date. Other teachers may offer something similar." action="Browse lessons" onAction={() => router.replace('/lessons' as never)} />
      </Screen>
    );
  }

  const { artist, lesson } = hit;
  const quote = isQuote(lesson);
  const price = lessonPriceLabel(lesson);
  const isOwner = activeWorkspace(user) === 'musician' && artist.id === OWN_ARTIST_ID;
  const isBlocked = blocked.includes(artist.id);
  const wished = wishlist.includes(artist.id);
  const otherLessons = (artist.lessons ?? []).filter((l) => l.id !== lesson.id);

  // Published calendar (only when the teacher manages one in the app). It helps planning and never confirms a session.
  const calendar = services?.showCalendar;
  const openDays = WEEK.filter((d) => availability.days[d]);
  const blockedSoon = availability.blockedDates.filter((d) => d >= TODAY_ISO).sort().slice(0, 3);

  const book = (asQuote: boolean) =>
    router.push({ pathname: '/booking/new', params: { type: 'lesson', id: artist.id, lesson: lesson.id, ...(asQuote ? { quote: '1' } : {}) } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ height: 270 }}>
          <Photo src={artist.cover ?? artist.avatar} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityLabel={artist.name} />
          <LinearGradient colors={['rgba(20,10,40,0.35)', 'rgba(20,10,40,0.92)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <SafeAreaView edges={['top']} style={{ position: 'absolute', left: 0, right: 0 }}>
            <Row justify="space-between" style={{ paddingHorizontal: 12, paddingTop: 4 }}>
              <BackOverlay onPress={() => goBack('/lessons')} />
              <HeartToggle on={wished} onPress={() => toggleWish('artists', artist.id)} label={wished ? `Remove ${artist.name} from wishlist` : `Save ${artist.name} to wishlist`} />
            </Row>
          </SafeAreaView>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 20, gap: 4 }}>
            <Text style={{ color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 }}>{`LESSON · ${lesson.instrument.toUpperCase()}`}</Text>
            <Text accessibilityRole="header" style={{ color: colors.white, fontFamily: fonts.display, fontSize: 26 }} numberOfLines={2}>{lesson.title}</Text>
            <Text style={{ color: colors.lilacLight, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{`${lesson.level} · ${lesson.durationMin} min · ${LEARNER_FORMAT_LABEL[lesson.format]}`}</Text>
          </View>
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          {openRequest ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`You already asked for this lesson. Status: ${bookingLabel(openRequest)}. Open request`} onPress={() => router.push(`/booking/${openRequest.id}`)}>
              <Banner icon="calendar-check-outline">
                <View style={{ gap: 6 }}>
                  <T v="smallBold" color="#2E1D5E">You already asked {artist.name} for this lesson</T>
                  <Row gap={8}>
                    <Pill label={bookingLabel(openRequest)} tone={bookingTone(openRequest)} />
                    <T v="smallBold" color={colors.brand}>Open request</T>
                  </Row>
                </View>
              </Banner>
            </Pressable>
          ) : null}
          {isBlocked ? <Banner icon="account-cancel-outline" tone="warning">You blocked {artist.name}. Unblock them to book or message about this lesson.</Banner> : null}
          {isOwner ? <Banner icon="eye-outline">This is how learners see your lesson. Change it in Services and pricing.</Banner> : null}

          <Card onPress={() => router.push(`/artist/${artist.id}`)} accessibilityLabel={`Teacher: ${artist.name}, ${artist.title}. Open profile`}>
            <Row gap={12}>
              <Avatar src={artist.avatar} size={56} verified={artist.verified} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="caption">TEACHER</T>
                <T v="title" numberOfLines={1}>{artist.name}</T>
                <T v="small" numberOfLines={1}>{artist.title} · {artist.city}</T>
                <BookAgainLine id={artist.id} />
              </View>
              <Icon name="chevron-right" size={22} color={colors.subtle} />
            </Row>
          </Card>

          <Card style={{ gap: 6 }}>
            <Row justify="space-between">
              <T v="label">Price</T>
              <Pill label={quote ? 'Quote' : 'Per session'} tone={quote ? 'brand' : 'neutral'} icon={quote ? 'file-document-edit-outline' : 'cash'} />
            </Row>
            <T v="h2">{price}</T>
            <T v="small">
              {quote
                ? `Describe what you want to learn and ${artist.name} sends an itemised quote. Nothing is charged until you accept it.`
                : `For one ${lesson.durationMin}-minute session. Lesson prices are set separately from ${artist.name}’s performance fee.`}
            </T>
          </Card>

          <Card style={{ gap: 4 }}>
            <T v="title" accessibilityRole="header" style={{ marginBottom: 4 }}>Lesson details</T>
            <InfoRow icon="music-note" label="Instrument" value={lesson.instrument} />
            <InfoRow icon={LESSON_FORMAT_ICON[lesson.format]} label="Format" value={LEARNER_FORMAT_LABEL[lesson.format]} />
            <InfoRow icon="map-marker-outline" label="Location" value={locationText(lesson)} />
            <InfoRow icon="clock-outline" label="Duration" value={`${lesson.durationMin} minutes per session`} />
            <InfoRow icon="stairs" label="Level" value={lesson.level} />
          </Card>

          {lesson.description ? (
            <View style={{ gap: 6 }}>
              <T v="h3" accessibilityRole="header">What you will learn</T>
              <T v="body" color={colors.inkSoft}>{lesson.description}</T>
            </View>
          ) : null}

          <Card style={{ gap: 8 }}>
            <Row gap={10}>
              <Icon name="calendar-week" size={20} color={colors.brand} />
              <T v="title" accessibilityRole="header" style={{ flex: 1 }}>Availability</T>
            </Row>
            {calendar ? (
              <>
                <T v="bodyBold">{openDays.length ? `Usually free ${openDays.join(', ')}` : 'No regular days published'}</T>
                {blockedSoon.length ? <T v="small">Not available {blockedSoon.map(shortDate).join(', ')}</T> : null}
              </>
            ) : (
              <T v="body" color={colors.inkSoft}>{artist.name} has not published a calendar. Suggest a date and time in your request.</T>
            )}
            <T v="small">A free day never confirms a session by itself. {artist.name} confirms or declines each request, and you get the details once it is confirmed.</T>
          </Card>

          {services?.lessonTerms?.trim() ? (
            <View style={{ gap: 4 }}>
              <T v="label">Lesson terms</T>
              <T v="small">{services.lessonTerms.trim()}</T>
            </View>
          ) : null}

          {otherLessons.length ? (
            <View style={{ gap: 10 }}>
              <T v="h3" accessibilityRole="header">More lessons by {artist.name}</T>
              {otherLessons.map((l) => <LessonCard key={l.id} lesson={l} onPress={() => router.push(`/lesson/${l.id}` as never)} />)}
            </View>
          ) : null}

          <Pressable accessibilityRole="button" accessibilityLabel="Browse all lessons" onPress={() => router.push('/lessons' as never)} hitSlop={8} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md }}>
            <Icon name="school-outline" size={18} color={colors.brand} />
            <T v="bodyBold" color={colors.brand}>Browse all lessons</T>
          </Pressable>
        </View>
      </ScrollView>

      <BottomBar>
        {isOwner ? (
          <Button title="Edit in Services and pricing" icon="pencil-outline" onPress={() => router.push('/pro/services')} />
        ) : isBlocked ? (
          <Button title="Manage blocked accounts" variant="secondary" onPress={() => router.push('/blocked')} />
        ) : (
          <View style={{ gap: 8 }}>
            <Row gap={10}>
              <IconButton name="message-text-outline" label={`Message ${artist.name}`} bg={colors.brandSoft} color={colors.brand} size={56} onPress={() => router.push(`/chat/${ensureConversation(artist.id)}`)} />
              {quote ? (
                <Button title="Request a quote" icon="file-document-edit-outline" style={{ flex: 1 }} onPress={() => book(true)} />
              ) : (
                <Button title={`Book a session · ${euro(lesson.price ?? 0)}`} accessibilityLabel={`Book a session, ${price}`} style={{ flex: 1 }} onPress={() => book(false)} />
              )}
            </Row>
            {!quote ? <Button title="Request a quote instead" variant="ghost" size="md" accessibilityLabel="Request a quote for a custom package" onPress={() => book(true)} /> : null}
            <T v="small" center>{quote ? 'Nothing is charged until you accept a quote.' : PAYMENT_NOTE.authorized}</T>
          </View>
        )}
      </BottomBar>
    </View>
  );
}
