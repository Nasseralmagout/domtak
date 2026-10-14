import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useReducer, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, IconButton, Photo, Row } from '../../components/ui';
import { profileById, stories } from '../../data/mock';
import { useApp } from '../../store/useApp';
import { colors, fonts } from '../../theme';

const FRAME_MS = 5000;

type Pos = { story: number; frame: number; done: boolean };

function step(pos: Pos, dir: 1 | -1): Pos {
  const frames = stories[pos.story].frames.length;
  if (dir === 1) {
    if (pos.frame < frames - 1) return { ...pos, frame: pos.frame + 1 };
    if (pos.story < stories.length - 1) return { story: pos.story + 1, frame: 0, done: false };
    return { ...pos, done: true };
  }
  if (pos.frame > 0) return { ...pos, frame: pos.frame - 1 };
  if (pos.story > 0) return { story: pos.story - 1, frame: 0, done: false };
  return pos;
}

export default function StoryViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const startIndex = Math.max(0, stories.findIndex((s) => s.id === id));
  const [pos, move] = useReducer(step, { story: startIndex, frame: 0, done: false });
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const elapsed = useRef(0);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const sendMessage = useApp((s) => s.sendMessage);

  const storyIndex = pos.story;
  const frame = pos.frame;
  const story = stories[storyIndex];
  const author = profileById(story.authorId);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const go = (dir: 1 | -1) => {
    elapsed.current = 0;
    setProgress(0);
    move(dir);
  };
  const next = () => go(1);
  const prev = () => go(-1);

  // Auto-advance: the timer callback (not the render) moves to the next frame.
  useEffect(() => {
    if (paused || pos.done) return;
    const t = setInterval(() => {
      elapsed.current += 100 / FRAME_MS;
      if (elapsed.current >= 1) {
        elapsed.current = 0;
        move(1);
      }
      setProgress(elapsed.current);
    }, 100);
    return () => clearInterval(t);
  }, [paused, pos.done]);

  useEffect(() => {
    if (pos.done) close();
  }, [pos.done]);

  const send = () => {
    if (!reply.trim() || !author) return;
    const cid = ensureConversation(author.id);
    sendMessage(cid, { type: 'text', text: `Replied to your story: ${reply.trim()}` });
    setReply('');
  };

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
          <Pressable accessibilityRole="button" onPress={() => author && router.push(`/artist/${author.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Avatar src={author?.avatar} size={36} />
            <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 15 }}>{author?.name}</Text>
            {story.live ? (
              <View style={{ backgroundColor: '#E5484D', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 11 }}>LIVE</Text>
              </View>
            ) : (
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 13 }}>2h</Text>
            )}
          </Pressable>
          <IconButton name={paused ? 'play-circle' : 'dots-horizontal'} label={paused ? 'Resume' : 'Pause'} color={colors.white} onPress={() => setPaused(!paused)} />
          <IconButton name="close" label="Close story" color={colors.white} onPress={close} />
        </Row>
        <Row style={{ flex: 1 }} gap={0}>
          <Pressable accessibilityLabel="Previous" onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} style={{ flex: 1 }} />
          <Pressable accessibilityLabel="Next" onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} style={{ flex: 2 }} />
        </Row>
        <Row gap={10} style={{ paddingHorizontal: 14, paddingBottom: 16 }}>
          <View style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.95)', flexDirection: 'row', alignItems: 'center', paddingLeft: 14 }}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              onSubmitEditing={send}
              placeholder="Send message"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Reply to story"
              style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink }}
            />
            <IconButton name="send" label="Send reply" onPress={send} />
          </View>
          <IconButton name="heart-outline" label="Like story" color={colors.white} />
        </Row>
      </SafeAreaView>
    </View>
  );
}
