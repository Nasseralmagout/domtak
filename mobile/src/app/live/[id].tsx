import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { goBack, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Button, Card, EmptyState, Icon, IconButton, Photo, Row, T } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { liveComments, profileById, stories } from '../../data/mock';
import type { Profile, Story } from '../../data/types';
import { compact, uid } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp } from '../../store/useApp';
import { colors, fonts } from '../../theme';

const LIVE_RED = '#E5484D';
const CHAT_MS = 2500;
const VIEWERS_MS = 3000;
const SEED_COUNT = 3;
const MAX_LINES = 40;
const BOOKABLE = ['musician', 'dj', 'band'];

type ChatLine = { id: string; authorId?: string; name: string; avatar?: ImgKey; text: string; mine?: boolean };
type FloatHeart = { seed: number; n: number };

/** The i-th sample comment, cycling through liveComments. */
function sampleLine(i: number): ChatLine {
  const c = liveComments[i % liveComments.length];
  const p = profileById(c.authorId);
  return { id: `${c.id}-${i}`, authorId: c.authorId, name: p?.name ?? 'Guest', avatar: p?.avatar, text: c.text };
}

const absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

function FloatingHeart({ heart, onDone }: { heart: FloatHeart; onDone: (seed: number) => void }) {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.timing(anim, { toValue: 1, duration: 1500, useNativeDriver: Platform.OS !== 'web' });
    a.start(({ finished }) => {
      if (finished) onDone(heart.seed);
    });
    return () => a.stop();
  }, [anim, onDone, heart.seed]);
  const drift = ((heart.seed * 37) % 36) - 18;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        pointerEvents: 'none',
        opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -200] }) },
          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
          { scale: anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.5, 1.2, 1] }) },
        ],
      }}
    >
      <Icon name="heart" size={30} color={LIVE_RED} />
      <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 13, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }}>+{heart.n}</Text>
    </Animated.View>
  );
}

function LiveViewer({ story, author }: { story: Story; author: Profile }) {
  const user = useApp((s) => s.user);
  const blocked = useApp((s) => s.blocked);
  const following = useApp((s) => !!s.following[author.id]);
  const toggleFollow = useApp((s) => s.toggleFollow);

  const [chat, setChat] = useState<ChatLine[]>(() => Array.from({ length: SEED_COUNT }, (_, i) => sampleLine(i)));
  const baseViewers = 1180 + (author.followers % 60);
  const [viewers, setViewers] = useState(baseViewers);
  const [text, setText] = useState('');
  const [hearts, setHearts] = useState<FloatHeart[]>([]);
  const [sent, setSent] = useState(0);
  const nextSample = useRef(SEED_COUNT);
  const heartSeq = useRef(0);
  const chatRef = useRef<ScrollView>(null);

  // New chat lines arrive from the interval callback (never synchronously in the effect body).
  useEffect(() => {
    const t = setInterval(() => {
      const line = sampleLine(nextSample.current);
      nextSample.current += 1;
      setChat((prev) => [...prev.slice(-MAX_LINES), line]);
    }, CHAT_MS);
    return () => clearInterval(t);
  }, []);

  // The audience drifts slowly up and down around its starting size (it never runs away).
  useEffect(() => {
    const t = setInterval(() => {
      setViewers((v) => Math.max(900, v + Math.round((baseViewers - v) * 0.08 + Math.random() * 40 - 18)));
    }, VIEWERS_MS);
    return () => clearInterval(t);
  }, [baseViewers]);

  const removeHeart = useCallback((seed: number) => setHearts((h) => h.filter((x) => x.seed !== seed)), []);

  // A ref counter keeps every floating heart key unique, even for taps faster than a re-render.
  const tapHeart = () => {
    heartSeq.current += 1;
    const n = heartSeq.current;
    setSent(n);
    setHearts((h) => [...h.slice(-8), { seed: n, n }]);
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setChat((prev) => [...prev.slice(-MAX_LINES), { id: uid('lc'), authorId: 'me', name: user.name, avatar: user.avatar, text: t, mine: true }]);
    setText('');
  };

  const share = () => {
    Share.share({ message: `${author.name} is live on Domtak right now. Tune in!` }).catch(() => toast('Could not open the share sheet'));
  };

  const follow = () => {
    toggleFollow(author.id);
    toast(following ? `You unfollowed ${author.name}` : `You’re now following ${author.name}`);
  };

  const openProfile = (id?: string) => {
    if (!id) return;
    if (id === 'me') return router.push('/profile/me');
    const p = profileById(id);
    if (!p) return;
    router.push(p.kind === 'fan' || p.kind === 'organizer' ? `/profile/${p.id}` : `/artist/${p.id}`);
  };

  const close = () => goBack('/(tabs)');
  const bookable = BOOKABLE.includes(author.kind);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <Photo src={story.frames[0]} style={absoluteFill} accessibilityLabel={`${author.name} performing live`} />
      <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 }} />
      <LinearGradient colors={['transparent', 'rgba(14,6,32,0.92)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 460 }} />

      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Top bar */}
          <Row gap={10} style={{ paddingLeft: 12, paddingRight: 4, paddingTop: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${author.name}’s profile`}
              onPress={() => openProfile(author.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minHeight: 44 }}
            >
              <Avatar src={author.avatar} size={42} ring={LIVE_RED} />
              <View style={{ flexShrink: 1 }}>
                <Row gap={4}>
                  <Text numberOfLines={1} style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 15, flexShrink: 1 }}>{author.name}</Text>
                  {author.verified ? <Icon name="check-decagram" size={15} color="#A78BFA" /> : null}
                </Row>
                <Text numberOfLines={1} style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 12 }}>{author.title}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={following ? `Unfollow ${author.name}` : `Follow ${author.name}`}
              accessibilityState={{ selected: following }}
              onPress={follow}
              hitSlop={6}
              style={({ pressed }) => ({
                height: 34,
                paddingHorizontal: 14,
                borderRadius: 17,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: following ? 'rgba(255,255,255,0.18)' : colors.brand,
                borderWidth: following ? 1 : 0,
                borderColor: 'rgba(255,255,255,0.45)',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              {following ? <Icon name="check" size={14} color={colors.white} /> : null}
              <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 13 }}>{following ? 'Following' : 'Follow'}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <IconButton name="close" label="Close live stream" color={colors.white} bg="rgba(0,0,0,0.3)" size={44} onPress={close} />
          </Row>

          <Row gap={8} style={{ paddingHorizontal: 12, marginTop: 10 }}>
            <Row gap={5} style={{ backgroundColor: LIVE_RED, paddingHorizontal: 10, height: 26, borderRadius: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.white }} />
              <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8 }}>LIVE</Text>
            </Row>
            <Row gap={5} accessibilityLabel={`${compact(viewers)} watching`} style={{ backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, height: 26, borderRadius: 6 }}>
              <Icon name="eye-outline" size={15} color={colors.white} />
              <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 12 }}>{compact(viewers)}</Text>
            </Row>
          </Row>

          <View style={{ flex: 1 }} />

          {/* Chat + side actions */}
          {/* Fixed 260 px, but allowed to shrink so the comment box stays visible on short screens or with the keyboard open. */}
          <Row align="flex-end" gap={12} style={{ paddingLeft: 12, paddingRight: 10, height: 260, minHeight: 140, flexShrink: 1 }}>
            <View style={{ flex: 1, alignSelf: 'stretch' }}>
              <ScrollView
                ref={chatRef}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: true })}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}
                accessibilityLabel="Live chat"
              >
                {/* Lines from accounts you blocked are hidden. */}
                {chat.filter((line) => !line.authorId || !blocked.includes(line.authorId)).map((line) => (
                  <Row key={line.id} align="flex-start" gap={8}>
                    <Pressable accessibilityRole="button" accessibilityLabel={line.mine ? 'Open your profile' : `Open ${line.name}’s profile`} onPress={() => openProfile(line.authorId)} hitSlop={8}>
                      <Avatar src={line.avatar} size={30} label={line.name} />
                    </Pressable>
                    <View style={{ flexShrink: 1, backgroundColor: line.mine ? 'rgba(59,31,139,0.75)' : 'rgba(0,0,0,0.38)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: line.mine ? colors.gold : colors.lilacLight, fontFamily: fonts.bodyBold, fontSize: 12 }}>{line.name}</Text>
                      <Text style={{ color: colors.white, fontFamily: fonts.body, fontSize: 14, lineHeight: 19 }}>{line.text}</Text>
                    </View>
                  </Row>
                ))}
              </ScrollView>
            </View>

            <View style={{ alignItems: 'center', gap: 6, paddingBottom: 4 }}>
              <View style={{ width: 52, alignItems: 'center' }}>
                <View style={{ position: 'absolute', bottom: 56, left: 0, right: 0, height: 1, pointerEvents: 'none' }}>
                  {hearts.map((h) => (
                    <FloatingHeart key={h.seed} heart={h} onDone={removeHeart} />
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send a heart"
                  accessibilityHint={sent ? `You sent ${sent} hearts` : undefined}
                  onPress={tapHeart}
                  style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.9 : 1 }] })}
                >
                  <Icon name={sent ? 'heart' : 'heart-outline'} size={28} color={sent ? LIVE_RED : colors.white} />
                </Pressable>
              </View>
              <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 12 }}>{compact(4820 + sent)}</Text>
              <IconButton name="share-variant" label="Share live stream" color={colors.white} bg="rgba(255,255,255,0.18)" size={52} iconSize={24} onPress={share} />
            </View>
          </Row>

          {/* Book CTA + comment input */}
          {bookable ? (
            <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
              <Button
                title={`Book ${author.name}`}
                icon="calendar-star"
                size="md"
                full
                onPress={() => router.push({ pathname: '/booking/new', params: { type: 'musician', id: author.id } })}
              />
            </View>
          ) : null}
          <Row gap={8} style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 }}>
            <Avatar src={user.avatar} size={36} label={user.name} />
            <View style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}>
              <TextInput
                value={text}
                onChangeText={setText}
                onSubmitEditing={send}
                submitBehavior="submit"
                returnKeyType="send"
                placeholder="Say something…"
                placeholderTextColor="rgba(255,255,255,0.7)"
                accessibilityLabel="Write a comment in the live chat"
                style={{ flex: 1, height: 46, fontFamily: fonts.body, fontSize: 15, color: colors.white }}
              />
              <IconButton name="send" label="Send comment" color={text.trim() ? colors.gold : colors.white} disabled={!text.trim()} size={46} iconSize={22} onPress={send} />
            </View>
          </Row>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function LiveUnavailable({ story }: { story?: Story }) {
  const others = stories.filter((s) => s.live && s.id !== story?.id);
  return (
    <Screen header={<ScreenHeader title="Live" close onBack={() => goBack('/(tabs)')} />}>
      <EmptyState
        icon="broadcast-off"
        title="This live has ended"
        body={story ? 'The stream is over, but you can still catch the latest story.' : 'We couldn’t find this live stream. It may have ended, or the link is no longer valid.'}
        action={story ? 'Watch story' : 'Back to home'}
        onAction={() => (story ? router.replace(`/story/${story.id}`) : router.replace('/(tabs)'))}
      />
      {others.length ? (
        <View style={{ gap: 10 }}>
          <T v="h3">Live now</T>
          {others.map((s) => {
            const p = profileById(s.authorId);
            if (!p) return null;
            return (
              <Card key={s.id} accessibilityLabel={`Watch ${p.name} live`} onPress={() => router.replace(`/live/${s.id}`)}>
                <Row gap={12}>
                  <Avatar src={p.avatar} size={48} ring={LIVE_RED} />
                  <View style={{ flex: 1 }}>
                    <T v="title" numberOfLines={1}>{p.name}</T>
                    <T v="small" numberOfLines={1}>{p.title}</T>
                  </View>
                  <View style={{ backgroundColor: LIVE_RED, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 11 }}>LIVE</Text>
                  </View>
                </Row>
              </Card>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

export default function LiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const story = stories.find((s) => s.id === id);
  const author = story ? profileById(story.authorId) : undefined;
  if (!story || !story.live || !author) return <LiveUnavailable story={story} />;
  return <LiveViewer key={story.id} story={story} author={author} />;
}
