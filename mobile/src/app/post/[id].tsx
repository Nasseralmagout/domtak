import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { BottomBar, Screen, ScreenHeader } from '../../components/layout';
import { authorFor, PostCard } from '../../components/PostCard';
import { Avatar, Field, IconButton, Row, T } from '../../components/ui';
import { useApp, useFeedPosts } from '../../store/useApp';
import { colors } from '../../theme';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const posts = useFeedPosts();
  const post = posts.find((p) => p.id === id);
  const user = useApp((s) => s.user);
  const extra = useApp((s) => (id ? s.extraComments[id] : undefined));
  const addComment = useApp((s) => s.addComment);
  const [text, setText] = useState('');

  if (!post) {
    return (
      <Screen header={<ScreenHeader title="Post" />}>
        <T v="body">This post is no longer available.</T>
      </Screen>
    );
  }
  const comments = [...post.comments, ...(extra ?? [])];
  const send = () => {
    if (!text.trim()) return;
    addComment(post.id, text.trim());
    setText('');
  };

  return (
    <Screen
      keyboard
      scroll={false}
      header={<ScreenHeader title="Post" />}
      footer={
        <BottomBar style={{ paddingTop: 8 }}>
          <Row gap={10}>
            <Avatar src={user.avatar} size={36} label={user.name} />
            <Field placeholder="Add a comment…" value={text} onChangeText={setText} onSubmitEditing={send} style={{ flex: 1 }} />
            <IconButton name="send" label="Post comment" color={colors.brand} onPress={send} />
          </Row>
        </BottomBar>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <PostCard post={post} />
        <View style={{ padding: 16, gap: 16 }}>
          <T v="h3">Comments</T>
          {comments.length === 0 ? <T v="body" color={colors.muted}>No comments yet — start the conversation.</T> : null}
          {comments.map((c) => {
            const a = authorFor(c.authorId, user);
            return (
              <Row key={c.id} gap={12} align="flex-start">
                <Avatar src={a?.avatar} size={36} label={a?.name} />
                <View style={{ flex: 1 }}>
                  <T v="body"><T v="bodyBold">{a?.name} </T>{c.text}</T>
                  <T v="small" style={{ fontSize: 12 }}>{c.time === 'now' ? 'Just now' : c.time} · {c.likes} likes · Reply</T>
                </View>
                <IconButton name="heart-outline" label="Like comment" size={36} iconSize={16} color={colors.muted} />
              </Row>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
