import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { BottomBar, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Icon, IconButton, Photo, Row, T } from '../../components/ui';
import { profileById, venueById } from '../../data/mock';
import type { Message } from '../../data/types';
import { useApp } from '../../store/useApp';
import { colors, fonts } from '../../theme';

function Bubble({ m }: { m: Message }) {
  const mine = m.from === 'me';
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', gap: 4, alignItems: mine ? 'flex-end' : 'flex-start' }}>
      {m.type === 'image' && m.image ? (
        <Photo src={m.image} style={{ width: 220, height: 290 }} radius={16} />
      ) : m.type === 'voice' ? (
        <Row gap={10} style={{ backgroundColor: mine ? colors.brand : '#DCD7E6', paddingHorizontal: 14, height: 52, borderRadius: 18, minWidth: 200 }}>
          <Icon name="play-circle" size={30} color={mine ? colors.white : colors.brand} />
          <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: mine ? 'rgba(255,255,255,0.5)' : colors.brandMid }} />
          <T v="smallBold" color={mine ? colors.white : colors.brand}>{m.duration}</T>
        </Row>
      ) : (
        <View style={{ backgroundColor: mine ? colors.brand : '#E7E3EF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4 }}>
          <T v="body" color={mine ? colors.white : colors.ink}>{m.text}</T>
        </View>
      )}
      <Row gap={4}>
        {m.liked ? <Icon name="heart" size={13} color={colors.danger} /> : null}
        <T v="small" style={{ fontSize: 11 }}>{m.time}</T>
      </Row>
    </View>
  );
}

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversations = useApp((s) => s.conversations);
  const send = useApp((s) => s.sendMessage);
  const markRead = useApp((s) => s.markConversationRead);
  const conv = conversations.find((c) => c.id === id);
  const other = conv ? profileById(conv.withId) : undefined;
  const [text, setText] = useState('');
  const list = useRef<FlatList>(null);

  useFocusEffect(useCallback(() => { if (id) markRead(id); }, [id, markRead]));

  if (!conv || !other) {
    return (
      <Screen header={<ScreenHeader title="Chat" />}>
        <T v="body">Conversation not found.</T>
      </Screen>
    );
  }

  const submit = () => {
    if (!text.trim()) return;
    send(conv.id, { type: 'text', text: text.trim() });
    setText('');
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
  };

  const profileHref = other.kind === 'fan' || other.kind === 'organizer' ? (venueById(other.id) ? `/venue/${other.id}` : `/profile/${other.id}`) : `/artist/${other.id}`;

  return (
    <Screen
      keyboard
      scroll={false}
      header={
        <ScreenHeader
          title={other.name}
          subtitle={other.title}
          right={
            <Row gap={0}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${other.name}'s profile`} onPress={() => router.push(profileHref as never)} style={{ paddingRight: 12 }}>
                <Avatar src={other.avatar} size={38} verified={other.verified} />
              </Pressable>
            </Row>
          }
        />
      }
      footer={
        <BottomBar style={{ paddingTop: 8 }}>
          <Row gap={8}>
            <IconButton name="image-outline" label="Send photo" color={colors.brand} size={44} onPress={() => send(conv.id, { type: 'image', image: 'feed_crowd' })} />
            <IconButton name="microphone" label="Send voice message" color={colors.brand} size={44} onPress={() => send(conv.id, { type: 'voice', duration: '0:12' })} />
            <View style={{ flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 16, justifyContent: 'center' }}>
              <TextInput value={text} onChangeText={setText} onSubmitEditing={submit} placeholder="Type here…" placeholderTextColor={colors.subtle} accessibilityLabel="Message" style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: 10 }} multiline />
            </View>
            <IconButton name="send" label="Send" bg={colors.brand} color={colors.white} size={46} iconSize={20} onPress={submit} />
          </Row>
        </BottomBar>
      }
    >
      <FlatList
        ref={list}
        data={conv.messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={
          <View style={{ alignItems: 'center', gap: 6, paddingVertical: 16 }}>
            <Avatar src={other.avatar} size={72} verified={other.verified} />
            <T v="title">{other.name}</T>
            <T v="small">{other.handle} · {other.city}</T>
          </View>
        }
        renderItem={({ item }) => <Bubble m={item} />}
      />
    </Screen>
  );
}
