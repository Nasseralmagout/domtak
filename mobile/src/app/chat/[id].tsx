import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';

import { ActionSheet } from '../../components/ActionSheet';
import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Banner, Button, Chip, EmptyState, Icon, IconButton, Photo, Row, T } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { profileById } from '../../data/mock';
import type { Message } from '../../data/types';
import { toast } from '../../store/toast';
import { useApp, useVenue } from '../../store/useApp';
import { colors, fonts } from '../../theme';

const PHOTOS: ImgKey[] = ['feed_crowd', 'feed_friends', 'ev_dancing', 'feed_rooftop', 'ev_selfie', 'feed_decks', 'ev_hands', 'feed_club'];
const QUICK_REPLIES = ['Hi! Are you available?', 'What’s your fee for 3 hours?', 'Thanks, see you there!'];

// Muted chats are remembered for the app session.
const mutedChats = new Set<string>();

const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** The other side of a chat: a person (musician, organizer, fan) or a venue. */
interface ChatParty {
  id: string;
  name: string;
  avatar?: ImgKey;
  title: string;
  verified?: boolean;
  /** Second line under the name in the chat intro. */
  meta: string;
  href: string;
  isVenue: boolean;
}

function Bubble({ m, liked, onToggleLike }: { m: Message; liked: boolean; onToggleLike: () => void }) {
  const mine = m.from === 'me';
  const what = m.type === 'image' ? 'Photo' : m.type === 'voice' ? `Voice message, ${m.duration}` : m.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${mine ? 'You' : 'They'}: ${what}, ${m.time}${liked ? ', liked' : ''}`}
      accessibilityHint="Double tap to like or unlike"
      accessibilityActions={[{ name: 'activate', label: liked ? 'Unlike' : 'Like' }]}
      onAccessibilityAction={onToggleLike}
      onLongPress={onToggleLike}
      delayLongPress={300}
      style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', gap: 4, alignItems: mine ? 'flex-end' : 'flex-start' }}
    >
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
        {liked ? <Icon name="heart" size={13} color={colors.danger} /> : null}
        <T v="small" style={{ fontSize: 11 }}>{m.time}</T>
      </Row>
    </Pressable>
  );
}

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversations = useApp((s) => s.conversations);
  const blockedList = useApp((s) => s.blocked);
  const send = useApp((s) => s.sendMessage);
  const markRead = useApp((s) => s.markConversationRead);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const toggleBlock = useApp((s) => s.toggleBlock);
  const toggleMessageLike = useApp((s) => s.toggleMessageLike);
  // Links may carry the conversation id or the other party's id.
  const conv = conversations.find((c) => c.id === id) ?? conversations.find((c) => c.withId === id);
  const withId = conv?.withId ?? id ?? '';
  const person = profileById(withId);
  // Venues chat too (e.g. venue bookings); the owner's own venue shows its listing edits.
  const venue = useVenue(person ? undefined : withId);
  const other = useMemo<ChatParty | undefined>(() => {
    if (person) {
      const artist = person.kind === 'dj' || person.kind === 'musician' || person.kind === 'band';
      return {
        id: person.id,
        name: person.name,
        avatar: person.avatar,
        title: person.title,
        verified: person.verified,
        meta: `${person.handle} · ${person.city}`,
        href: artist ? `/artist/${person.id}` : `/profile/${person.id}`,
        isVenue: false,
      };
    }
    if (venue) {
      return { id: venue.id, name: venue.name, avatar: venue.cover, title: `Venue · ${venue.area}`, meta: `${venue.type} · ${venue.area}, ${venue.city}`, href: `/venue/${venue.id}`, isVenue: true };
    }
    return undefined;
  }, [person, venue]);
  const convId = conv?.id;
  const [text, setText] = useState('');
  const [tray, setTray] = useState(false);
  const [recording, setRecording] = useState<number>();
  const [menu, setMenu] = useState(false);
  const [muted, setMuted] = useState(() => mutedChats.has(conv?.id ?? id ?? ''));
  const list = useRef<FlatList>(null);

  useFocusEffect(useCallback(() => { if (convId) markRead(convId); }, [convId, markRead]));

  // Voice recorder timer (max 2 minutes).
  useEffect(() => {
    if (recording === undefined) return;
    if (recording >= 120) return;
    const t = setTimeout(() => setRecording((s) => (s === undefined ? s : s + 1)), 1000);
    return () => clearTimeout(t);
  }, [recording]);

  if (!other) {
    return (
      <Screen header={<ScreenHeader title="Chat" onBack={() => goBack('/inbox')} />}>
        <EmptyState icon="message-off-outline" title="Conversation not found" body="This chat may have been deleted." action="Back to messages" onAction={() => router.replace('/inbox')} />
      </Screen>
    );
  }
  if (!conv) {
    return (
      <Screen header={<ScreenHeader title={other.name} subtitle={other.title} onBack={() => goBack('/inbox')} />}>
        <EmptyState
          icon="message-text-outline"
          title={`Start a chat with ${other.name}`}
          body="Messages about bookings, tickets and guest lists stay in one place."
          action="Start conversation"
          onAction={() => router.replace(`/chat/${ensureConversation(other.id)}`)}
        />
      </Screen>
    );
  }

  const isBlocked = blockedList.includes(other.id);
  const scrollDown = () => setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60);
  const submit = (value = text) => {
    const t = value.trim();
    if (!t || isBlocked) return;
    send(conv.id, { type: 'text', text: t });
    setText('');
    scrollDown();
  };
  const sendPhoto = (image: ImgKey) => {
    send(conv.id, { type: 'image', image });
    setTray(false);
    scrollDown();
  };
  const stopRecording = (keep: boolean) => {
    const secs = recording ?? 0;
    setRecording(undefined);
    if (!keep) {
      toast('Voice message discarded');
      return;
    }
    if (secs < 1) {
      toast('Hold on a little longer to record');
      return;
    }
    send(conv.id, { type: 'voice', duration: fmtDuration(secs) });
    scrollDown();
  };
  // Stored with the message, so likes survive leaving the chat and restarting the app.
  const toggleLike = (m: Message) => {
    toggleMessageLike(conv.id, m.id);
    toast(m.liked ? 'Like removed' : 'Liked message');
  };

  const profileHref = other.href;
  const profileAction = other.isVenue ? 'View venue' : 'View profile';

  return (
    <Screen
      keyboard
      scroll={false}
      header={
        <ScreenHeader
          title={other.name}
          subtitle={muted ? `${other.title} · muted` : other.title}
          onBack={() => goBack('/inbox')}
          right={
            <Row gap={0}>
              <Pressable accessibilityRole="button" accessibilityLabel={other.isVenue ? `Open ${other.name} venue page` : `Open ${other.name}’s profile`} onPress={() => router.push(profileHref as never)} hitSlop={4} style={{ paddingRight: 4 }}>
                <Avatar src={other.avatar} size={38} verified={other.verified} />
              </Pressable>
              <IconButton name="dots-vertical" label="Chat options" onPress={() => setMenu(true)} />
            </Row>
          }
        />
      }
      footer={
        isBlocked ? (
          <BottomBar>
            <Banner icon="block-helper" tone="danger">{`You blocked ${other.name}. They can’t message you.`}</Banner>
            <Button title={`Unblock ${other.name}`} variant="secondary" style={{ marginTop: 10 }} onPress={() => { toggleBlock(other.id); toast(`${other.name} is unblocked`); }} />
          </BottomBar>
        ) : (
          <BottomBar style={{ paddingTop: 8 }}>
            {tray ? (
              <View style={{ gap: 8, marginBottom: 10 }}>
                <Row justify="space-between">
                  <T v="smallBold">Send a photo</T>
                  <IconButton name="close" label="Close photos" size={36} iconSize={18} onPress={() => setTray(false)} />
                </Row>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {PHOTOS.map((p) => (
                    <Pressable key={p} accessibilityRole="button" accessibilityLabel="Send this photo" onPress={() => sendPhoto(p)}>
                      <Photo src={p} style={{ width: 76, height: 76 }} radius={12} />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {recording !== undefined ? (
              <Row gap={10}>
                <IconButton name="delete-outline" label="Discard voice message" color={colors.danger} size={44} onPress={() => stopRecording(false)} />
                <Row gap={8} style={{ flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: colors.dangerBg, paddingHorizontal: 16 }} accessibilityLabel={`Recording, ${fmtDuration(recording)}`}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger }} />
                  <T v="bodyBold" color={colors.danger} accessibilityLiveRegion="polite">Recording {fmtDuration(recording)}</T>
                </Row>
                <IconButton name="send" label="Send voice message" bg={colors.brand} color={colors.white} size={46} iconSize={20} onPress={() => stopRecording(true)} />
              </Row>
            ) : (
              <Row gap={8}>
                <IconButton name={tray ? 'image' : 'image-outline'} label={tray ? 'Hide photos' : 'Send photo'} selected={tray} color={colors.brand} size={44} onPress={() => setTray(!tray)} />
                <IconButton name="microphone" label="Record voice message" color={colors.brand} size={44} onPress={() => { setTray(false); setRecording(0); }} />
                <View style={{ flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 16, justifyContent: 'center' }}>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    onSubmitEditing={() => submit()}
                    submitBehavior="submit"
                    returnKeyType="send"
                    placeholder="Type here…"
                    placeholderTextColor={colors.subtle}
                    accessibilityLabel={`Message ${other.name}`}
                    style={{ fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: 10, maxHeight: 120 }}
                    multiline
                  />
                </View>
                <IconButton name="send" label="Send" bg={text.trim() ? colors.brand : colors.track} color={colors.white} size={46} iconSize={20} disabled={!text.trim()} onPress={() => submit()} />
              </Row>
            )}
          </BottomBar>
        )
      }
    >
      <FlatList
        ref={list}
        data={conv.messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={
          <View style={{ alignItems: 'center', gap: 6, paddingVertical: 16 }}>
            <Avatar src={other.avatar} size={72} verified={other.verified} />
            <T v="title">{other.name}</T>
            <T v="small">{other.meta}</T>
            <Button title={profileAction} variant="light" size="sm" onPress={() => router.push(profileHref as never)} style={{ marginTop: 4 }} />
            {conv.messages.length ? <T v="small" style={{ fontSize: 11, marginTop: 6 }}>Long-press a message to like it</T> : null}
          </View>
        }
        ListEmptyComponent={
          isBlocked ? null : (
            <View style={{ alignItems: 'center', gap: 10 }}>
              <T v="body" color={colors.muted}>Say hi to {other.name}</T>
              <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                {QUICK_REPLIES.map((r) => <Chip key={r} label={r} onPress={() => submit(r)} />)}
              </Row>
            </View>
          )
        }
        renderItem={({ item }) => <Bubble m={item} liked={!!item.liked} onToggleLike={() => toggleLike(item)} />}
      />

      <ActionSheet
        visible={menu}
        title={other.name}
        actions={[
          { label: profileAction, icon: other.isVenue ? 'storefront-outline' : 'account-outline', onPress: () => router.push(profileHref as never) },
          {
            label: muted ? 'Unmute notifications' : 'Mute notifications',
            icon: muted ? 'bell-outline' : 'bell-off-outline',
            onPress: () => {
              if (muted) mutedChats.delete(conv.id);
              else mutedChats.add(conv.id);
              setMuted(!muted);
              toast(muted ? `Notifications from ${other.name} are on` : `${other.name} is muted`);
            },
          },
          { label: isBlocked ? `Unblock ${other.name}` : `Block ${other.name}`, icon: 'block-helper', destructive: !isBlocked, onPress: () => { toggleBlock(other.id); toast(isBlocked ? `${other.name} is unblocked` : `${other.name} is blocked`); } },
          { label: 'Report conversation', icon: 'flag-outline', destructive: true, onPress: () => toast('Thanks, our team will review this conversation') },
        ]}
        onClose={() => setMenu(false)}
      />
    </Screen>
  );
}
