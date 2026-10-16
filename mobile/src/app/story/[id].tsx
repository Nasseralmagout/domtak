import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useReducer, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Icon, IconButton, Photo, Row } from '../../components/ui';
import { profileById, stories } from '../../data/mock';
import type { Story } from '../../data/types';
import { toast } from '../../store/toast';
import { useApp } from '../../store/useApp';
import { colors, fonts } from '../../theme';

const FRAME_MS = 5000;
const LIVE_RED = '#E5484D';

type Pos = { story: number; frame: number; done: boolean };
type Move = { dir: 1 | -1; list: Story[] };

/** Moves through the frames of `list` (the stories you can watch: blocked authors are left out). */
function step(pos: Pos, { dir, list }: Move): Pos {
  const current = list[pos.story];
  if (!current) return { ...pos, done: true };
  const frames = current.frames.length;
  if (dir === 1) {
    if (pos.frame < frames - 1) return { ...pos, frame: pos.frame + 1 };
    if (pos.story < list.length - 1) return { story: pos.story + 1, frame: 0, done: false };
    return { ...pos, done: true };
  }
  if (pos.frame > 0) return { ...pos, frame: pos.frame - 1 };
  if (pos.story > 0) return { story: pos.story - 1, frame: 0, done: false };
  return pos;
}

export default function StoryViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Stories from accounts you blocked are skipped (fixed when the viewer opens, so the order does not jump).
  const [playlist] = useState(() => {
    const blockedNow = useApp.getState().blocked;
    return stories.filter((s) => !blockedNow.includes(s.authorId));
  });
  const requested = playlist.findIndex((s) => s.id === id);
  // A link to the story of an account you blocked shows a notice instead of someone else's story.
  const hiddenRequest = requested < 0 && stories.some((s) => s.id === id);
  const playable = playlist.length > 0 && !hiddenRequest;
  const [pos, move] = useReducer(step, { story: Math.max(0, requested), frame: 0, done: false });
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  // The pause button sets a lock, so releasing a hold or leaving the reply box does not silently resume.
  const [locked, setLocked] = useState(false);
  const [reply, setReply] = useState('');
  const elapsed = useRef(0);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const sendMessage = useApp((s) => s.sendMessage);
  const likes = useApp((s) => s.likes);
  const toggleLike = useApp((s) => s.toggleLike);
  const blocked = useApp((s) => s.blocked);

  const storyIndex = pos.story;
  const frame = pos.frame;
  const story = playlist[storyIndex] as Story | undefined;
  const author = story ? profileById(story.authorId) : undefined;
  const likeKey = `story:${story?.id ?? ''}`;
  const liked = !!likes[likeKey];

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const go = (dir: 1 | -1) => {
    elapsed.current = 0;
    setProgress(0);
    move({ dir, list: playlist });
  };
  const next = () => go(1);
  const prev = () => go(-1);

  // Auto-advance: the timer callback (not the render) moves to the next frame.
  useEffect(() => {
    if (paused || pos.done || !playable) return;
    const t = setInterval(() => {
      elapsed.current += 100 / FRAME_MS;
      if (elapsed.current >= 1) {
        elapsed.current = 0;
        move({ dir: 1, list: playlist });
      }
      setProgress(elapsed.current);
    }, 100);
    return () => clearInterval(t);
  }, [paused, pos.done, playlist, playable]);

  useEffect(() => {
    if (pos.done) close();
  }, [pos.done]);

  const send = () => {
    if (!reply.trim() || !author) return;
    // A blocked account cannot be messaged (F10).
    if (blocked.includes(author.id)) {
      toast(`You blocked ${author.name}. Unblock them to reply.`);
      return;
    }
    const cid = ensureConversation(author.id);
    sendMessage(cid, { type: 'text', text: `Replied to your story: ${reply.trim()}` });
    setReply('');
    toast(`Reply sent to ${author.name}`);
  };

  if (!story || !playable) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <Icon name="eye-off-outline" size={40} color={colors.white} />
        <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 16, textAlign: 'center' }}>{hiddenRequest ? 'This story is hidden' : 'No stories to show'}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 14, textAlign: 'center' }}>Stories from accounts you blocked are hidden.</Text>
        <IconButton name="close" label="Close stories" color={colors.white} bg="rgba(255,255,255,0.15)" size={48} onPress={close} />
      </SafeAreaView>
    );
  }

  const watchLive = () => router.replace(`/live/${story.id}`);
  const togglePause = () => {
    setLocked(!locked);
    setPaused(!locked);
  };
  const hold = () => setPaused(true);
  const release = () => setPaused(locked);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <Photo src={story.frames[frame]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <Row gap={4} style={{ paddingHorizontal: 10, paddingTop: 8 }}>
          {story.frames.map((f, i) => (
            <View key={`${f}-${i}`} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
              <View style={{ height: 3, width: `${i < frame ? 100 : i === frame ? Math.min(progress, 1) * 100 : 0}%`, backgroundColor: colors.white }} />
            </View>
          ))}
        </Row>
        <Row gap={10} style={{ paddingHorizontal: 10, paddingTop: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={author ? `Open ${author.name}’s profile` : 'Open profile'} onPress={() => author && router.push(`/artist/${author.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Avatar src={author?.avatar} size={36} />
            <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 15 }}>{author?.name}</Text>
            {story.live ? (
              <View style={{ backgroundColor: LIVE_RED, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 11 }}>LIVE</Text>
              </View>
            ) : (
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 13 }}>2h</Text>
            )}
          </Pressable>
          <IconButton name={locked ? 'play' : 'pause'} label={locked ? 'Resume story' : 'Pause story'} selected={locked} color={colors.white} onPress={togglePause} />
          <IconButton name="close" label="Close story" color={colors.white} onPress={close} />
        </Row>
        <Row style={{ flex: 1 }} gap={0}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous story" accessibilityHint="Hold to pause" onPress={prev} onLongPress={hold} onPressOut={release} style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Next story" accessibilityHint="Hold to pause" onPress={next} onLongPress={hold} onPressOut={release} style={{ flex: 2 }} />
        </Row>
        {story.live ? (
          <View style={{ alignItems: 'center', paddingBottom: 14 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Watch ${author?.name ?? 'this'} live`}
              onPress={watchLive}
              style={({ pressed }) => ({ height: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: LIVE_RED, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.85 : 1 })}
            >
              <Icon name="broadcast" size={20} color={colors.white} />
              <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 15 }}>Watch live</Text>
            </Pressable>
          </View>
        ) : null}
        <Row gap={10} style={{ paddingHorizontal: 14, paddingBottom: 16 }}>
          <View style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.95)', flexDirection: 'row', alignItems: 'center', paddingLeft: 14 }}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              onFocus={hold}
              onBlur={release}
              onSubmitEditing={send}
              placeholder="Send message"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Reply to story"
              style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink }}
            />
            <IconButton name="send" label="Send reply" onPress={send} />
          </View>
          <IconButton name={liked ? 'heart' : 'heart-outline'} label={liked ? 'Unlike story' : 'Like story'} color={liked ? LIVE_RED : colors.white} onPress={() => toggleLike(likeKey)} />
        </Row>
      </SafeAreaView>
    </View>
  );
}
