import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { authorFor } from '../../components/PostCard';
import { Avatar, Button, EmptyState, Icon, IconButton, Photo, Pill, Row, T } from '../../components/ui';
import { eventDiscussion, profileById } from '../../data/mock';
import { eventWhen } from '../../lib/format';
import { useApp, useEvent } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

export default function EventComments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const user = useApp((s) => s.user);
  const extra = useApp((s) => (id ? s.extraComments[`event:${id}`] : undefined));
  const addComment = useApp((s) => s.addComment);
  const [text, setText] = useState('');
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<ScrollView>(null);
  const justSent = useRef(false);

  if (!event) {
    return (
      <Screen header={<ScreenHeader title="Discussion" onBack={() => goBack('/(tabs)/events')} />}>
        <EmptyState
          icon="calendar-remove-outline"
          title="Event not found"
          body="This event may have been removed or the link is no longer valid."
          action="Browse events"
          onAction={() => router.replace('/(tabs)/events')}
        />
      </Screen>
    );
  }

  const comments = [...(eventDiscussion[event.id] ?? []), ...(extra ?? [])];
  const count = comments.length;

  const send = () => {
    const t = text.trim();
    if (!t) return;
    justSent.current = true;
    addComment(`event:${event.id}`, t);
    setText('');
  };

  const toggleLike = (cid: string) => setLiked((l) => ({ ...l, [cid]: !l[cid] }));

  const reply = (name: string, authorId: string) => {
    const handle = authorId === 'me' ? '' : profileById(authorId)?.handle ?? `@${name}`;
    setText(handle ? `${handle} ` : '');
    inputRef.current?.focus();
  };

  const openAuthor = (authorId: string) => {
    if (authorId === 'me') return router.push('/profile/me');
    const p = profileById(authorId);
    if (!p) return;
    router.push(p.kind === 'fan' || p.kind === 'organizer' ? `/profile/${p.id}` : `/artist/${p.id}`);
  };

  return (
    <Screen
      keyboard
      scroll={false}
      header={<ScreenHeader title={event.title} subtitle={`${count} ${count === 1 ? 'comment' : 'comments'} · Discussion`} onBack={() => goBack(`/event/${event.id}`)} />}
      footer={
        <BottomBar style={{ paddingTop: 8 }}>
          <Row gap={10}>
            <Avatar src={user.avatar} size={36} label={user.name} />
            <View style={{ flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 14 }}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                onSubmitEditing={send}
                returnKeyType="send"
                placeholder="Ask a question or say hi…"
                placeholderTextColor={colors.subtle}
                accessibilityLabel="Write a comment about this event"
                style={{ fontFamily: fonts.body, fontSize: 16, color: colors.ink, minHeight: 46 }}
              />
            </View>
            <IconButton name="send" label="Post comment" color={text.trim() ? colors.brand : colors.disabled} onPress={send} />
          </Row>
        </BottomBar>
      }
    >
      <ScrollView
        ref={listRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}
        onContentSizeChange={() => {
          if (!justSent.current) return;
          justSent.current = false;
          listRef.current?.scrollToEnd({ animated: true });
        }}
      >
        <Row gap={12} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 10, ...shadow(1) }}>
          <Photo src={event.cover} style={{ width: 64, height: 64 }} radius={12} accessibilityLabel={event.title} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="title" numberOfLines={1}>{event.title}</T>
            <T v="small" numberOfLines={1}>{eventWhen(event.start, event.end)}</T>
          </View>
          <Button title="Tickets" size="sm" variant="light" onPress={() => router.push(`/tickets/${event.id}`)} />
        </Row>

        {count === 0 ? (
          <EmptyState
            icon="comment-text-multiple-outline"
            title="No comments yet"
            body="Ask about set times, the dress code or who else is going. The organizer and other guests will see it."
            action="Write the first comment"
            onAction={() => inputRef.current?.focus()}
          />
        ) : (
          <View style={{ gap: 14 }}>
            {comments.map((c) => {
              const a = authorFor(c.authorId, user);
              const name = a?.name ?? 'Guest';
              const on = !!liked[c.id];
              const likes = c.likes + (on ? 1 : 0);
              const isOrganizer = c.authorId === event.organizerId;
              return (
                <Row key={c.id} gap={10} align="flex-start">
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}’s profile`} onPress={() => openAuthor(c.authorId)} hitSlop={6}>
                    <Avatar src={a?.avatar} size={40} label={name} verified={a?.verified} />
                  </Pressable>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ backgroundColor: c.authorId === 'me' ? colors.brandTint : colors.surface, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, ...shadow(1) }}>
                      <Row gap={6} style={{ marginBottom: 2, flexWrap: 'wrap' }}>
                        <T v="smallBold">{c.authorId === 'me' ? 'You' : name}</T>
                        {isOrganizer ? <Pill label="Organizer" tone="brand" /> : null}
                      </Row>
                      <T v="body">{c.text}</T>
                    </View>
                    <Row gap={16} style={{ paddingLeft: 4 }}>
                      <T v="small" style={{ fontSize: 12 }}>{c.time === 'now' ? 'Just now' : c.time}</T>
                      <T v="small" style={{ fontSize: 12 }}>{likes} {likes === 1 ? 'like' : 'likes'}</T>
                      {c.authorId !== 'me' ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${name}`} onPress={() => reply(name, c.authorId)} hitSlop={10}>
                          <T v="smallBold" style={{ fontSize: 12 }} color={colors.brand}>Reply</T>
                        </Pressable>
                      ) : null}
                    </Row>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={on ? 'Unlike comment' : 'Like comment'}
                    accessibilityState={{ selected: on }}
                    onPress={() => toggleLike(c.id)}
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.dangerBg : 'transparent' }}>
                      <Icon name={on ? 'heart' : 'heart-outline'} size={18} color={on ? colors.danger : colors.muted} />
                    </View>
                  </Pressable>
                </Row>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
