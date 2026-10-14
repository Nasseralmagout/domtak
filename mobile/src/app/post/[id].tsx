import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, type TextInput, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { authorFor, PostCard } from '../../components/PostCard';
import { Avatar, Button, EmptyState, Field, Icon, IconButton, Row, T } from '../../components/ui';
import { profileById, venueById } from '../../data/mock';
import { compact } from '../../lib/format';
import { useApp, useFeedPosts } from '../../store/useApp';
import { colors } from '../../theme';

// Comment likes last for the app session (sample comments are read-only data).
const likedComments = new Set<string>();

/** "@handle " for replies: the profile handle, else the first name. */
function mentionFor(authorId: string, name: string) {
  const handle = profileById(authorId)?.handle ?? `@${name.split(' ')[0]}`;
  return `${handle.startsWith('@') ? handle : `@${handle}`} `;
}

function profileHref(id: string) {
  if (id === 'me') return '/profile/me';
  if (venueById(id)) return `/venue/${id}`;
  const p = profileById(id);
  return p && (p.kind === 'dj' || p.kind === 'musician' || p.kind === 'band') ? `/artist/${id}` : `/profile/${id}`;
}

export default function PostDetail() {
  const { id, reply } = useLocalSearchParams<{ id: string; reply?: string }>();
  const posts = useFeedPosts();
  const post = posts.find((p) => p.id === id);
  const user = useApp((s) => s.user);
  const extra = useApp((s) => (id ? s.extraComments[id] : undefined));
  const addComment = useApp((s) => s.addComment);
  const [text, setText] = useState('');
  const [liked, setLiked] = useState<Record<string, boolean>>(() => Object.fromEntries([...likedComments].map((k) => [k, true])));
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  if (!post) {
    return (
      <Screen header={<ScreenHeader title="Post" onBack={() => goBack('/(tabs)')} />}>
        <EmptyState icon="image-off-outline" title="Post not available" body="It may have been removed by its author." action="Back to feed" onAction={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }
  const comments = [...post.comments, ...(extra ?? [])];
  const send = () => {
    const t = text.trim();
    if (!t) return;
    addComment(post.id, t);
    setText('');
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
  };
  const replyTo = (authorId: string) => {
    const a = authorFor(authorId, user);
    if (a && authorId !== 'me') {
      const mention = mentionFor(authorId, a.name);
      // Replace a leading @mention from an earlier Reply instead of stacking them.
      setText((cur) => `${mention}${cur.replace(/^@\S+\s+/, '')}`);
    }
    input.current?.focus();
  };
  const toggleCommentLike = (commentId: string) => {
    const on = !liked[commentId];
    if (on) likedComments.add(commentId);
    else likedComments.delete(commentId);
    setLiked((m) => ({ ...m, [commentId]: on }));
  };

  return (
    <Screen
      keyboard
      scroll={false}
      header={<ScreenHeader title="Post" onBack={() => goBack('/(tabs)')} />}
      footer={
        <BottomBar style={{ paddingTop: 8 }}>
          <Row gap={10}>
            <Avatar src={user.avatar} size={36} label={user.name} />
            <Field
              inputRef={input}
              placeholder="Add a comment…"
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              returnKeyType="send"
              autoFocus={reply === '1'}
              accessibilityLabel="Comment"
              style={{ flex: 1 }}
            />
            <IconButton name="send" label="Post comment" color={text.trim() ? colors.brand : colors.disabled} disabled={!text.trim()} onPress={send} />
          </Row>
        </BottomBar>
      }
    >
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled">
        <PostCard post={post} onComment={() => input.current?.focus()} />
        <View style={{ padding: 16, gap: 16 }}>
          <T v="h3">Comments{comments.length ? ` (${comments.length})` : ''}</T>
          {comments.length === 0 ? (
            <View style={{ gap: 10, alignItems: 'flex-start' }}>
              <T v="body" color={colors.muted}>No comments yet. Start the conversation.</T>
              <Button title="Write a comment" variant="light" size="sm" icon="comment-outline" onPress={() => input.current?.focus()} />
            </View>
          ) : null}
          {comments.map((c) => {
            const a = authorFor(c.authorId, user);
            const on = !!liked[c.id];
            const likes = c.likes + (on ? 1 : 0);
            return (
              <Row key={c.id} gap={12} align="flex-start">
                <Pressable accessibilityRole="button" accessibilityLabel={`Open ${a?.name ?? 'author'}’s profile`} onPress={() => router.push(profileHref(c.authorId) as never)} hitSlop={4}>
                  <Avatar src={a?.avatar} size={36} label={a?.name} />
                </Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="body"><T v="bodyBold">{a?.name} </T>{c.text}</T>
                  <Row gap={14}>
                    <T v="small" style={{ fontSize: 12 }}>{c.time === 'now' ? 'Just now' : c.time}</T>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${a?.name ?? 'comment'}`} onPress={() => replyTo(c.authorId)} hitSlop={12}>
                      <T v="smallBold" style={{ fontSize: 12 }} color={colors.muted}>Reply</T>
                    </Pressable>
                  </Row>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${on ? 'Unlike' : 'Like'} comment by ${a?.name ?? 'author'}, ${likes} like${likes === 1 ? '' : 's'}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => toggleCommentLike(c.id)}
                  style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
                >
                  <Icon name={on ? 'heart' : 'heart-outline'} size={18} color={on ? colors.danger : colors.muted} />
                  {likes > 0 ? <T v="small" style={{ fontSize: 11 }} color={on ? colors.danger : colors.muted}>{compact(likes)}</T> : null}
                </Pressable>
              </Row>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
